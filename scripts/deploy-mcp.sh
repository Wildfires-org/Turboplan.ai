#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy-mcp.sh <environment> [pr-number]
#
# Deploys the MCP server to Cloudflare Workers.
#
# Arguments:
#   environment  - One of: production, staging, preview
#   pr-number    - Required when environment is "preview"
#
# Environment variables required:
#   CLOUDFLARE_API_TOKEN
#   CLOUDFLARE_ACCOUNT_ID
#   AUTH_SECRET
#   POSTGRES_URL
#   R2_PUBLIC_URL
#   R2_ACCESS_KEY_ID
#   R2_SECRET_ACCESS_KEY
#   R2_ACCOUNT_ID
#   R2_BUCKET_NAME
#   OPENROUTER_API_KEY

ENVIRONMENT="${1:?Usage: deploy-mcp.sh <environment> [pr-number]}"
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
  production) WORKER_NAME="${PROJECT}-mcp-prod" ;;
  staging)    WORKER_NAME="${PROJECT}-mcp-staging" ;;
  preview)    WORKER_NAME="${PROJECT}-mcp-pr-${PR_NUMBER}" ;;
esac

echo "==> Deploying MCP server as ${WORKER_NAME} (${ENVIRONMENT})"

cd apps/mcp-server

# Ensure wrangler.toml is restored on any exit (e.g. deploy failure with set -e)
trap 'if [ -f wrangler.toml.bak ]; then mv wrangler.toml.bak wrangler.toml; fi' EXIT

# Production can serve a custom domain when PRODUCTION_MCP_DOMAIN is set; otherwise
# (and for every other environment) the worker stays on its workers.dev subdomain.
# Injected after the "name" line so the key stays top-level (before the first TOML table).
if [[ "$ENVIRONMENT" == "production" && -n "${PRODUCTION_MCP_DOMAIN:-}" ]]; then
  echo "==> Attaching custom domain: ${PRODUCTION_MCP_DOMAIN}"
  if [[ ! "$PRODUCTION_MCP_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "ERROR: PRODUCTION_MCP_DOMAIN contains invalid characters" >&2
    exit 1
  fi
  cp wrangler.toml wrangler.toml.bak
  sed -i "1a routes = [{ pattern = \"${PRODUCTION_MCP_DOMAIN}\", custom_domain = true }]" wrangler.toml
  grep -q "pattern = \"${PRODUCTION_MCP_DOMAIN}\"" wrangler.toml || {
    echo "ERROR: custom-domain route injection failed (sed anchor drifted?)" >&2
    exit 1
  }
fi

# Non-sensitive vars passed via --var
VARS=(
  --var "WORKER_RUNTIME:true"
  --var "ENVIRONMENT:${ENVIRONMENT}"
  --var "TURBOPLAN_URL:${TURBOPLAN_URL:-}"
  --var "LANDING_URL:${LANDING_URL:-}"
  # Feature flags
  --var "IS_TASKS_PACKAGE_ENABLED:${IS_TASKS_PACKAGE_ENABLED:-false}"
  --var "IS_FIELDS_PACKAGE_ENABLED:${IS_FIELDS_PACKAGE_ENABLED:-false}"
  --var "IS_MAPS_PACKAGE_ENABLED:${IS_MAPS_PACKAGE_ENABLED:-false}"
  --var "IS_DOCUMENTS_PACKAGE_ENABLED:${IS_DOCUMENTS_PACKAGE_ENABLED:-false}"
  --var "IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED:${IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED:-false}"
  --var "IS_TIMELINE_RECORDS_PACKAGE_ENABLED:${IS_TIMELINE_RECORDS_PACKAGE_ENABLED:-false}"
  --var "IS_PROJECT_CONTEXT_PACKAGE_ENABLED:${IS_PROJECT_CONTEXT_PACKAGE_ENABLED:-false}"
  --var "R2_PUBLIC_URL:${R2_PUBLIC_URL:-}"
  --var "R2_ACCOUNT_ID:${R2_ACCOUNT_ID:-}"
  --var "R2_BUCKET_NAME:${R2_BUCKET_NAME:-}"
  # AI image models (fall back to env defaults when empty)
  --var "OPENROUTER_MODEL_IMAGE_PRIMARY:${OPENROUTER_MODEL_IMAGE_PRIMARY:-}"
  --var "OPENROUTER_MODEL_IMAGE_LITE:${OPENROUTER_MODEL_IMAGE_LITE:-}"
  # Sentry error monitoring (optional — monitoring disabled when empty)
  --var "SENTRY_DSN:${SENTRY_DSN:-}"
  --var "RELEASE_VERSION:${RELEASE_VERSION:-}"
  # PostHog analytics (optional — analytics disabled when empty)
  --var "POSTHOG_API_KEY:${POSTHOG_API_KEY:-}"
)

if [[ "$ENVIRONMENT" == "preview" ]]; then
  VARS+=(--var "PR_NUMBER:${PR_NUMBER}")
fi

npx wrangler deploy \
  --name "$WORKER_NAME" \
  "${VARS[@]}"

# Sensitive values set as encrypted secrets (bulk upload — single restart)
echo "==> Setting secrets for ${WORKER_NAME}"

SECRETS_JSON=$(jq -n \
  --arg AUTH_SECRET "${AUTH_SECRET:?AUTH_SECRET env var is required}" \
  --arg POSTGRES_URL "${POSTGRES_URL:?POSTGRES_URL env var is required}" \
  --arg R2_ACCESS_KEY_ID "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID env var is required}" \
  --arg R2_SECRET_ACCESS_KEY "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY env var is required}" \
  --arg OPENROUTER_API_KEY "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY env var is required}" \
  '{AUTH_SECRET: $AUTH_SECRET, POSTGRES_URL: $POSTGRES_URL, R2_ACCESS_KEY_ID: $R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: $R2_SECRET_ACCESS_KEY, OPENROUTER_API_KEY: $OPENROUTER_API_KEY}')

if [[ -n "${ADMIN_EMAILS:-}" ]]; then
  SECRETS_JSON=$(echo "$SECRETS_JSON" | jq --arg k "ADMIN_EMAILS" --arg v "$ADMIN_EMAILS" '. + {($k): $v}')
fi

if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  SECRETS_JSON=$(echo "$SECRETS_JSON" | jq --arg k "OPENROUTER_API_KEY" --arg v "$OPENROUTER_API_KEY" '. + {($k): $v}')
fi

echo "$SECRETS_JSON" | npx wrangler secret bulk --name "$WORKER_NAME"

echo "==> Deployed ${WORKER_NAME} successfully"

if [[ "$ENVIRONMENT" == "preview" ]]; then
  echo "Preview URL: https://${WORKER_NAME}.workers.dev"
fi
