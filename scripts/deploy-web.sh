#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy-web.sh <environment> [pr-number]
#
# Deploys the TurboPlan web app (Next.js via OpenNext) to Cloudflare Workers.
#
# Arguments:
#   environment  - One of: production, staging, preview
#   pr-number    - Required when environment is "preview"
#
# Environment variables required:
#   CLOUDFLARE_API_TOKEN
#   CLOUDFLARE_ACCOUNT_ID
#   AUTH_SECRET
#   INTERNAL_API_SECRET   (must match the API server's)
#   JWT_SIGNING_SECRET    (must match the API server's)
#   POSTGRES_URL
#   OPENROUTER_API_KEY
#
# Optional environment variables:
#   AUTH_COOKIE_DOMAIN, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, EXA_API_KEY
#   R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL
#   POSTHOG_API_KEY, OPENROUTER_MODEL_*, ADMIN_EMAILS, USE_EXTERNAL_PROMPTS
#   HYPERDRIVE_ID         (Hyperdrive config id — pooled Postgres connection)

ENVIRONMENT="${1:?Usage: deploy-web.sh <environment> [pr-number]}"
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
  production) WORKER_NAME="${PROJECT}-web-prod" ;;
  staging)    WORKER_NAME="${PROJECT}-web-staging" ;;
  preview)    WORKER_NAME="${PROJECT}-web-pr-${PR_NUMBER}" ;;
esac

echo "==> Deploying web as ${WORKER_NAME} (${ENVIRONMENT})"

cd apps/turboplan

# Ensure wrangler.jsonc is restored on any exit (e.g. deploy failure with set -e)
trap 'if [ -f wrangler.jsonc.bak ]; then mv wrangler.jsonc.bak wrangler.jsonc; fi' EXIT

# Production can serve a custom domain when PRODUCTION_APP_DOMAIN is set; otherwise
# (and for every other environment) the worker stays on its workers.dev subdomain.
if [[ "$ENVIRONMENT" == "production" && -n "${PRODUCTION_APP_DOMAIN:-}" ]]; then
  echo "==> Attaching custom domain: ${PRODUCTION_APP_DOMAIN}"
  if [[ ! "$PRODUCTION_APP_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "ERROR: PRODUCTION_APP_DOMAIN contains invalid characters" >&2
    exit 1
  fi
  cp wrangler.jsonc wrangler.jsonc.bak
  sed -i "s|\"name\": \"turboplan-web\",|\"name\": \"turboplan-web\",\n  \"routes\": [{ \"pattern\": \"${PRODUCTION_APP_DOMAIN}\", \"custom_domain\": true }],|" wrangler.jsonc
  grep -q "\"pattern\": \"${PRODUCTION_APP_DOMAIN}\"" wrangler.jsonc || {
    echo "ERROR: custom-domain route injection failed (sed anchor drifted?)" >&2
    exit 1
  }
fi

# Hyperdrive configuration — replace placeholder ID in wrangler config.
# `opennextjs-cloudflare deploy` boots a Miniflare platform proxy to read the
# bindings, and Miniflare refuses to start the Hyperdrive binding (even the
# placeholder one) without a local Postgres string. It is only used by that
# proxy, never by the deployed Worker, so the direct database URL is fine here.
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="${POSTGRES_URL:?POSTGRES_URL env var is required}"

# The custom-domain block above may already have taken the backup; only create
# it when missing so the EXIT trap still restores the pristine file.
if [[ -n "${HYPERDRIVE_ID:-}" ]]; then
  echo "==> Configuring Hyperdrive binding: ${HYPERDRIVE_ID}"
  [ -f wrangler.jsonc.bak ] || cp wrangler.jsonc wrangler.jsonc.bak
  sed -i "s/HYPERDRIVE_ID_PLACEHOLDER/${HYPERDRIVE_ID}/" wrangler.jsonc
  grep -q "\"id\": \"${HYPERDRIVE_ID}\"" wrangler.jsonc || {
    echo "ERROR: Hyperdrive id injection failed (placeholder missing?)" >&2
    exit 1
  }
fi

# Non-sensitive runtime vars passed via --var
VARS=(
  --var "AUTH_TRUST_HOST:true"
  --var "WORKER_RUNTIME:true"
  --var "ENVIRONMENT:${ENVIRONMENT}"
  --var "POSTHOG_API_KEY:${POSTHOG_API_KEY:-}"
  --var "OPENROUTER_MODEL_PRIMARY:${OPENROUTER_MODEL_PRIMARY:-}"
  --var "OPENROUTER_MODEL_LITE:${OPENROUTER_MODEL_LITE:-}"
  --var "OPENROUTER_MODEL_IMAGE_PRIMARY:${OPENROUTER_MODEL_IMAGE_PRIMARY:-}"
  --var "OPENROUTER_MODEL_IMAGE_LITE:${OPENROUTER_MODEL_IMAGE_LITE:-}"
  # R2 storage (non-sensitive)
  --var "R2_ACCOUNT_ID:${R2_ACCOUNT_ID:-}"
  --var "R2_BUCKET_NAME:${R2_BUCKET_NAME:-}"
  --var "R2_PUBLIC_URL:${R2_PUBLIC_URL:-}"
)

if [[ "$ENVIRONMENT" == "preview" ]]; then
  VARS+=(--var "PR_NUMBER:${PR_NUMBER}")
fi

if [[ -n "${USE_EXTERNAL_PROMPTS:-}" ]]; then
  VARS+=(--var "USE_EXTERNAL_PROMPTS:${USE_EXTERNAL_PROMPTS}")
fi

# Next.js app — build with OpenNext then deploy
npx @opennextjs/cloudflare build

npx @opennextjs/cloudflare deploy \
  --name "$WORKER_NAME" \
  "${VARS[@]}"

# Sensitive values set as encrypted secrets (bulk upload — single restart)
echo "==> Setting secrets for ${WORKER_NAME}"

SECRETS_JSON=$(jq -n \
  --arg AUTH_SECRET "${AUTH_SECRET:?AUTH_SECRET env var is required}" \
  --arg INTERNAL_API_SECRET "${INTERNAL_API_SECRET:?INTERNAL_API_SECRET env var is required}" \
  --arg JWT_SIGNING_SECRET "${JWT_SIGNING_SECRET:?JWT_SIGNING_SECRET env var is required}" \
  --arg POSTGRES_URL "${POSTGRES_URL:?POSTGRES_URL env var is required}" \
  --arg OPENROUTER_API_KEY "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY env var is required}" \
  '{AUTH_SECRET: $AUTH_SECRET, INTERNAL_API_SECRET: $INTERNAL_API_SECRET, JWT_SIGNING_SECRET: $JWT_SIGNING_SECRET, POSTGRES_URL: $POSTGRES_URL, OPENROUTER_API_KEY: $OPENROUTER_API_KEY}')

for VAR_NAME in AUTH_COOKIE_DOMAIN R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY EXA_API_KEY ADMIN_EMAILS; do
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
