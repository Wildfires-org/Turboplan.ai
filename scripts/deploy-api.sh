#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy-api.sh <environment> [pr-number]
#
# Deploys the Hono API server to Cloudflare Workers.
#
# Arguments:
#   environment  - One of: production, staging, preview
#   pr-number    - Required when environment is "preview"
#
# Environment variables required:
#   CLOUDFLARE_API_TOKEN
#   CLOUDFLARE_ACCOUNT_ID
#   AUTH_SECRET
#   INTERNAL_API_SECRET   (must match the web app's)
#   ENCRYPTION_KEY
#   JWT_SIGNING_SECRET    (must match the web app's)
#   POSTGRES_URL
#   OPENROUTER_API_KEY
#   SERVER_API_KEY
#   R2_ACCESS_KEY_ID
#   R2_SECRET_ACCESS_KEY

ENVIRONMENT="${1:?Usage: deploy-api.sh <environment> [pr-number]}"
PR_NUMBER="${2:-}"

PROJECT="turboplan"

if [[ ! "$ENVIRONMENT" =~ ^(production|staging|preview)$ ]]; then
  echo "Error: environment must be one of: production, staging, preview" >&2
  exit 1
fi

if [[ "$ENVIRONMENT" == "preview" && -z "$PR_NUMBER" ]]; then
  echo "Error: pr-number is required for preview deployments" >&2
  exit 1
fi

case "$ENVIRONMENT" in
  production) WORKER_NAME="${PROJECT}-api-prod" ;;
  staging)    WORKER_NAME="${PROJECT}-api-staging" ;;
  preview)    WORKER_NAME="${PROJECT}-api-pr-${PR_NUMBER}" ;;
esac

echo "==> Deploying api as ${WORKER_NAME} (${ENVIRONMENT})"

cd apps/server

# Ensure wrangler.jsonc is restored on any exit (e.g. deploy failure with set -e)
trap 'if [ -f wrangler.jsonc.bak ]; then mv wrangler.jsonc.bak wrangler.jsonc; fi' EXIT

# Non-sensitive vars passed via --var
VARS=(
  --var "WORKER_RUNTIME:true"
  --var "ENVIRONMENT:${ENVIRONMENT}"
  --var "NODE_ENV:production"
  --var "APP_NAME:${TC_APP_NAME:-}"
  --var "APP_ENV:${TC_APP_ENV:-}"
  --var "TURBOPLAN_URL:${TURBOPLAN_URL:-}"
  --var "SERVER_URL:${SERVER_URL:-}"
  --var "LANDING_URL:${LANDING_URL:-}"
  --var "ALLOWED_ORIGINS:${ALLOWED_ORIGINS:-}"
  --var "POSTHOG_API_KEY:${POSTHOG_API_KEY:-}"
  # Sentry error monitoring (optional — monitoring disabled when empty)
  --var "SENTRY_DSN:${SENTRY_DSN:-}"
  --var "RELEASE_VERSION:${RELEASE_VERSION:-}"
  --var "RELEASE_DATE:${RELEASE_DATE:-}"
  --var "RELEASE_BRANCH:${RELEASE_BRANCH:-}"
  # Feature flags
  --var "IS_TASKS_PACKAGE_ENABLED:${IS_TASKS_PACKAGE_ENABLED:-false}"
  --var "IS_FIELDS_PACKAGE_ENABLED:${IS_FIELDS_PACKAGE_ENABLED:-false}"
  --var "IS_MAPS_PACKAGE_ENABLED:${IS_MAPS_PACKAGE_ENABLED:-false}"
  --var "IS_DOCUMENTS_PACKAGE_ENABLED:${IS_DOCUMENTS_PACKAGE_ENABLED:-false}"
  --var "IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED:${IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED:-false}"
  --var "IS_TIMELINE_RECORDS_PACKAGE_ENABLED:${IS_TIMELINE_RECORDS_PACKAGE_ENABLED:-false}"
  --var "IS_PROJECT_CONTEXT_PACKAGE_ENABLED:${IS_PROJECT_CONTEXT_PACKAGE_ENABLED:-false}"
  --var "IS_BILLING_PACKAGE_ENABLED:${IS_BILLING_PACKAGE_ENABLED:-false}"
  --var "IS_SIGNING_PACKAGE_ENABLED:${IS_SIGNING_PACKAGE_ENABLED:-false}"
  # Documenso signing (API URL is non-sensitive; key and webhook secret are secrets below)
  --var "DOCUMENSO_API_URL:${DOCUMENSO_API_URL:-}"
  # AI model names (non-sensitive)
  --var "OPENROUTER_MODEL_PRIMARY:${OPENROUTER_MODEL_PRIMARY:-}"
  --var "OPENROUTER_MODEL_LITE:${OPENROUTER_MODEL_LITE:-}"
  --var "OPENROUTER_MODEL_IMAGE_PRIMARY:${OPENROUTER_MODEL_IMAGE_PRIMARY:-}"
  --var "OPENROUTER_MODEL_IMAGE_LITE:${OPENROUTER_MODEL_IMAGE_LITE:-}"
  --var "DISABLE_AUTO_PROJECT_IMAGE_GENERATION:${DISABLE_AUTO_PROJECT_IMAGE_GENERATION:-false}"
  # Service URLs (non-sensitive)
  --var "MAP_SERVICE_URL:${MAP_SERVICE_URL:-}"
  --var "RESEARCH_AGENT_SERVICE_URL:${RESEARCH_AGENT_SERVICE_URL:-}"
  --var "RESEND_FROM_EMAIL:${RESEND_FROM_EMAIL:-}"
  # R2 storage (non-sensitive)
  --var "R2_ACCOUNT_ID:${R2_ACCOUNT_ID:-}"
  --var "R2_BUCKET_NAME:${R2_BUCKET_NAME:-}"
  --var "R2_PUBLIC_URL:${R2_PUBLIC_URL:-}"
  # Stripe price IDs (non-sensitive — public identifiers)
  --var "STRIPE_PRICE_STARTER:${STRIPE_PRICE_STARTER:-}"
  --var "STRIPE_PRICE_PRO:${STRIPE_PRICE_PRO:-}"
  --var "STRIPE_PRICE_MAX:${STRIPE_PRICE_MAX:-}"
)

if [[ "$ENVIRONMENT" == "preview" ]]; then
  VARS+=(--var "PR_NUMBER:${PR_NUMBER}")
fi

if [[ -n "${ADMIN_EMAILS:-}" ]]; then
  ADMIN_EMAILS_SECRET="$ADMIN_EMAILS"
fi

if [[ -n "${USE_EXTERNAL_PROMPTS:-}" ]]; then
  VARS+=(--var "USE_EXTERNAL_PROMPTS:${USE_EXTERNAL_PROMPTS}")
fi

# Hyperdrive configuration — replace placeholder ID in wrangler config
if [[ -n "${HYPERDRIVE_ID:-}" ]]; then
  echo "==> Configuring Hyperdrive binding: ${HYPERDRIVE_ID}"
  sed -i.bak "s/HYPERDRIVE_ID_PLACEHOLDER/${HYPERDRIVE_ID}/" wrangler.jsonc
fi

# Production can serve a custom domain when PRODUCTION_API_DOMAIN is set; otherwise
# (and for every other environment) the worker stays on its workers.dev subdomain.
if [[ "$ENVIRONMENT" == "production" && -n "${PRODUCTION_API_DOMAIN:-}" ]]; then
  echo "==> Attaching custom domain: ${PRODUCTION_API_DOMAIN}"
  if [[ ! "$PRODUCTION_API_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "ERROR: PRODUCTION_API_DOMAIN contains invalid characters" >&2
    exit 1
  fi
  [ -f wrangler.jsonc.bak ] || cp wrangler.jsonc wrangler.jsonc.bak
  sed -i "s|\"name\": \"turboplan-api\",|\"name\": \"turboplan-api\",\n  \"routes\": [{ \"pattern\": \"${PRODUCTION_API_DOMAIN}\", \"custom_domain\": true }],|" wrangler.jsonc
  grep -q "\"pattern\": \"${PRODUCTION_API_DOMAIN}\"" wrangler.jsonc || {
    echo "ERROR: custom-domain route injection failed (sed anchor drifted?)" >&2
    exit 1
  }
fi

# Hono API server — deploy directly with wrangler
npx wrangler deploy \
  --name "$WORKER_NAME" \
  "${VARS[@]}"

# Restoration handled by EXIT trap

# Stripe webhook endpoint.
#
# prod/staging have stable URLs, so their endpoints are created once in the
# Stripe dashboard and their signing secret is supplied via STRIPE_WEBHOOK_SECRET.
#
# preview URLs are unique per PR, so we provision an endpoint on the fly here and
# capture its signing secret (Stripe only returns it at creation time). Re-deploys
# delete the stale endpoint first, since the secret can't be re-fetched afterwards.
if [[ "$ENVIRONMENT" == "preview" && "${IS_BILLING_PACKAGE_ENABLED:-false}" == "true" ]]; then
  if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
    echo "Error: STRIPE_SECRET_KEY is required to provision the preview webhook" >&2
    exit 1
  fi

  WEBHOOK_URL="${SERVER_URL:-https://${WORKER_NAME}.${WORKERS_SUBDOMAIN:-}}/api/billing/stripe-webhook"
  echo "==> Provisioning Stripe webhook endpoint: ${WEBHOOK_URL}"

  STALE_IDS=$(curl -sf "https://api.stripe.com/v1/webhook_endpoints?limit=100" \
    -u "${STRIPE_SECRET_KEY}:" \
    | jq -r --arg u "$WEBHOOK_URL" '.data[] | select(.url == $u) | .id' || true)
  for endpoint_id in $STALE_IDS; do
    curl -sf -X DELETE "https://api.stripe.com/v1/webhook_endpoints/${endpoint_id}" \
      -u "${STRIPE_SECRET_KEY}:" >/dev/null || true
    echo "    Removed stale endpoint ${endpoint_id}"
  done

  # api_version pinned to match the Stripe SDK (stripe-service.ts) so delivered
  # event payloads have the shape the handler expects, regardless of the
  # account's default API version. Trailing `|| true` keeps `set -e` from
  # aborting before the explicit empty-secret check below produces a clear error.
  STRIPE_WEBHOOK_SECRET=$(curl -sf "https://api.stripe.com/v1/webhook_endpoints" \
    -u "${STRIPE_SECRET_KEY}:" \
    --data-urlencode "url=${WEBHOOK_URL}" \
    --data-urlencode "description=PR #${PR_NUMBER} preview (auto-managed)" \
    -d "api_version=2026-05-27.dahlia" \
    -d "enabled_events[]=checkout.session.completed" \
    -d "enabled_events[]=customer.subscription.created" \
    -d "enabled_events[]=customer.subscription.updated" \
    -d "enabled_events[]=customer.subscription.deleted" \
    | jq -r '.secret' || true)

  if [[ -z "$STRIPE_WEBHOOK_SECRET" || "$STRIPE_WEBHOOK_SECRET" == "null" ]]; then
    echo "Error: failed to create Stripe webhook endpoint" >&2
    exit 1
  fi
  export STRIPE_WEBHOOK_SECRET
  echo "    Created endpoint; signing secret captured"
fi

# Sensitive values set as encrypted secrets (bulk upload — single restart)
echo "==> Setting secrets for ${WORKER_NAME}"

SECRETS_JSON=$(jq -n \
  --arg AUTH_SECRET "${AUTH_SECRET:?AUTH_SECRET env var is required}" \
  --arg INTERNAL_API_SECRET "${INTERNAL_API_SECRET:?INTERNAL_API_SECRET env var is required}" \
  --arg ENCRYPTION_KEY "${ENCRYPTION_KEY:?ENCRYPTION_KEY env var is required}" \
  --arg JWT_SIGNING_SECRET "${JWT_SIGNING_SECRET:?JWT_SIGNING_SECRET env var is required}" \
  --arg POSTGRES_URL "${POSTGRES_URL:?POSTGRES_URL env var is required}" \
  --arg OPENROUTER_API_KEY "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY env var is required}" \
  --arg SERVER_API_KEY "${SERVER_API_KEY:?SERVER_API_KEY env var is required}" \
  '{AUTH_SECRET: $AUTH_SECRET, INTERNAL_API_SECRET: $INTERNAL_API_SECRET, ENCRYPTION_KEY: $ENCRYPTION_KEY, JWT_SIGNING_SECRET: $JWT_SIGNING_SECRET, POSTGRES_URL: $POSTGRES_URL, OPENROUTER_API_KEY: $OPENROUTER_API_KEY, SERVER_API_KEY: $SERVER_API_KEY}')

if [[ -n "${ADMIN_EMAILS_SECRET:-}" ]]; then
  SECRETS_JSON=$(echo "$SECRETS_JSON" | jq --arg k "ADMIN_EMAILS" --arg v "$ADMIN_EMAILS_SECRET" '. + {($k): $v}')
fi

for VAR_NAME in AUTH_COOKIE_DOMAIN R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY MAP_SERVICE_API_KEY RESEARCH_AGENT_SERVICE_API_KEY RESEND_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET RECONCILE_SECRET DOCUMENSO_API_KEY DOCUMENSO_WEBHOOK_SECRET; do
  VAR_VALUE="${!VAR_NAME:-}"
  if [[ -n "$VAR_VALUE" ]]; then
    SECRETS_JSON=$(echo "$SECRETS_JSON" | jq --arg k "$VAR_NAME" --arg v "$VAR_VALUE" '. + {($k): $v}')
  fi
done

echo "$SECRETS_JSON" | npx wrangler secret bulk --name "$WORKER_NAME"

echo "==> Deployed ${WORKER_NAME} successfully"

if [[ "$ENVIRONMENT" == "preview" ]]; then
  echo "Preview URL: https://${WORKER_NAME}.workers.dev"
fi
