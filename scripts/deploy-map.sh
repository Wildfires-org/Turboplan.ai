#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy-map.sh <environment> [pr-number]
#
# Deploys the Python map service as a Cloudflare Container.
#
# Arguments:
#   environment  - One of: production, staging, preview
#   pr-number    - Required when environment is "preview"
#
# Environment variables required:
#   CLOUDFLARE_API_TOKEN
#   CLOUDFLARE_ACCOUNT_ID
#   MAP_SERVICE_API_KEY

ENVIRONMENT="${1:?Usage: deploy-map.sh <environment> [pr-number]}"
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
  production) WORKER_NAME="${PROJECT}-map-prod" ;;
  staging)    WORKER_NAME="${PROJECT}-map-staging" ;;
  preview)    WORKER_NAME="${PROJECT}-map-pr-${PR_NUMBER}" ;;
esac

echo "==> Deploying map service as ${WORKER_NAME} (${ENVIRONMENT})"

cd packages/services/turboplan-map-server

# Ensure wrangler.jsonc is restored on any exit (e.g. deploy failure with set -e)
trap 'if [ -f wrangler.jsonc.bak ]; then mv wrangler.jsonc.bak wrangler.jsonc; fi' EXIT
cp wrangler.jsonc wrangler.jsonc.bak

# Cloudflare derives the container application name from the config "name" field,
# not the --name CLI flag. Override it so each deployment gets a unique container.
sed -i "s/\"name\": \"turboplan-map\"/\"name\": \"${WORKER_NAME}\"/" wrangler.jsonc

# Production can serve a custom domain when PRODUCTION_MAP_DOMAIN is set; otherwise
# (and for every other environment) the worker stays on its workers.dev subdomain.
if [[ "$ENVIRONMENT" == "production" && -n "${PRODUCTION_MAP_DOMAIN:-}" ]]; then
  echo "==> Attaching custom domain: ${PRODUCTION_MAP_DOMAIN}"
  if [[ ! "$PRODUCTION_MAP_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "ERROR: PRODUCTION_MAP_DOMAIN contains invalid characters" >&2
    exit 1
  fi
  sed -i "s|\"name\": \"${WORKER_NAME}\",|\"name\": \"${WORKER_NAME}\",\n  \"routes\": [{ \"pattern\": \"${PRODUCTION_MAP_DOMAIN}\", \"custom_domain\": true }],|" wrangler.jsonc
  grep -q "\"pattern\": \"${PRODUCTION_MAP_DOMAIN}\"" wrangler.jsonc || {
    echo "ERROR: custom-domain route injection failed (sed anchor drifted?)" >&2
    exit 1
  }
fi

# Non-sensitive vars passed via --var
VARS=(
  --var "ENVIRONMENT:${ENVIRONMENT}"
  --var "ALLOWED_ORIGINS:${ALLOWED_ORIGINS:-*}"
)

# Sentry error monitoring (optional — monitoring disabled when unset)
if [[ -n "${SENTRY_DSN:-}" ]]; then
  VARS+=(--var "SENTRY_DSN:${SENTRY_DSN}")
fi

if [[ -n "${RELEASE_VERSION:-}" ]]; then
  VARS+=(--var "RELEASE_VERSION:${RELEASE_VERSION}")
fi

if [[ -n "${RELEASE_DATE:-}" ]]; then
  VARS+=(--var "RELEASE_DATE:${RELEASE_DATE}")
fi

if [[ -n "${RELEASE_BRANCH:-}" ]]; then
  VARS+=(--var "RELEASE_BRANCH:${RELEASE_BRANCH}")
fi

# Deploy container + worker
npx wrangler deploy \
  --name "$WORKER_NAME" \
  "${VARS[@]}"

# Sensitive values set as encrypted secrets (bulk upload — single restart)
echo "==> Setting secrets for ${WORKER_NAME}"

jq -n --arg MAP_SERVICE_API_KEY "${MAP_SERVICE_API_KEY:?MAP_SERVICE_API_KEY env var is required}" \
  '{MAP_SERVICE_API_KEY: $MAP_SERVICE_API_KEY}' | npx wrangler secret bulk --name "$WORKER_NAME"

echo "==> Deployed ${WORKER_NAME} successfully"

if [[ "$ENVIRONMENT" == "preview" ]]; then
  echo "Preview URL: https://${WORKER_NAME}.workers.dev"
fi
