#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy-landing.sh <environment> [pr-number]
#
# Deploys the landing page (Next.js via OpenNext) to Cloudflare Workers.
#
# Arguments:
#   environment  - One of: production, staging, preview
#   pr-number    - Required when environment is "preview"
#
# Environment variables required:
#   CLOUDFLARE_API_TOKEN
#   CLOUDFLARE_ACCOUNT_ID
#   AUTH_SECRET
#
# Optional environment variables:
#   AUTH_COOKIE_DOMAIN
#   POSTHOG_API_KEY
#   R2_PUBLIC_URL - comma-separated R2 bucket URLs; baked into next/image
#                   remotePatterns at build time (images 400 without it)

ENVIRONMENT="${1:?Usage: deploy-landing.sh <environment> [pr-number]}"
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
  production) WORKER_NAME="${PROJECT}-landing-prod" ;;
  staging)    WORKER_NAME="${PROJECT}-landing-staging" ;;
  preview)    WORKER_NAME="${PROJECT}-landing-pr-${PR_NUMBER}" ;;
esac

echo "==> Deploying landing as ${WORKER_NAME} (${ENVIRONMENT})"

cd apps/landing-page

# Ensure wrangler.jsonc is restored on any exit (e.g. deploy failure with set -e)
trap 'if [ -f wrangler.jsonc.bak ]; then mv wrangler.jsonc.bak wrangler.jsonc; fi' EXIT

# Production can serve the apex custom domain when PRODUCTION_LANDING_DOMAIN is set;
# otherwise (and for every other environment) the worker stays on workers.dev.
if [[ "$ENVIRONMENT" == "production" && -n "${PRODUCTION_LANDING_DOMAIN:-}" ]]; then
  echo "==> Attaching custom domain: ${PRODUCTION_LANDING_DOMAIN}"
  if [[ ! "$PRODUCTION_LANDING_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "ERROR: PRODUCTION_LANDING_DOMAIN contains invalid characters" >&2
    exit 1
  fi
  cp wrangler.jsonc wrangler.jsonc.bak
  sed -i "s|\"name\": \"turboplan-landing\",|\"name\": \"turboplan-landing\",\n  \"routes\": [{ \"pattern\": \"${PRODUCTION_LANDING_DOMAIN}\", \"custom_domain\": true }],|" wrangler.jsonc
  grep -q "\"pattern\": \"${PRODUCTION_LANDING_DOMAIN}\"" wrangler.jsonc || {
    echo "ERROR: custom-domain route injection failed (sed anchor drifted?)" >&2
    exit 1
  }
fi

VARS=(
  --var "ENVIRONMENT:${ENVIRONMENT}"
  --var "POSTHOG_API_KEY:${POSTHOG_API_KEY:-}"
)

if [[ "$ENVIRONMENT" == "preview" ]]; then
  VARS+=(--var "PR_NUMBER:${PR_NUMBER}")
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
  '{AUTH_SECRET: $AUTH_SECRET}')

if [[ -n "${AUTH_COOKIE_DOMAIN:-}" ]]; then
  SECRETS_JSON=$(echo "$SECRETS_JSON" | jq --arg v "$AUTH_COOKIE_DOMAIN" '. + {AUTH_COOKIE_DOMAIN: $v}')
fi

echo "$SECRETS_JSON" | npx wrangler secret bulk --name "$WORKER_NAME"

echo "==> Deployed ${WORKER_NAME} successfully"

if [[ "$ENVIRONMENT" == "preview" ]]; then
  echo "Preview URL: https://${WORKER_NAME}.workers.dev"
fi
