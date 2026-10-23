#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/setup-hyperdrive.sh <environment> [pr-number]
#
# Creates or updates the Hyperdrive config for an environment so it points at
# DB_URL, and prints the config id on stdout. Everything else goes to stderr.
#
# deploy-api and deploy-web both run this at the same time. On a PR's first run
# neither finds a config and both create one; the loser gets code 2017 (name
# already exists) and updates the config the winner created instead of failing.
#
# Arguments:
#   environment - "production", "staging", or "preview"
#   pr-number   - Required for preview deployments
#
# Environment variables required:
#   CLOUDFLARE_API_TOKEN
#   CLOUDFLARE_ACCOUNT_ID
#   DB_URL (Postgres connection string the config points at)
#
# Examples:
#   ./scripts/setup-hyperdrive.sh production
#   ./scripts/setup-hyperdrive.sh preview 42

ENVIRONMENT="${1:?Usage: setup-hyperdrive.sh <production|staging|preview> [pr-number]}"
PR_NUMBER="${2:-}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN env var is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID env var is required}"
: "${DB_URL:?DB_URL env var is required}"

case "$ENVIRONMENT" in
  production) CONFIG_NAME="turboplan-db-prod" ;;
  staging) CONFIG_NAME="turboplan-db-staging" ;;
  preview)
    if [[ -z "$PR_NUMBER" ]]; then
      echo "Error: PR number is required for preview deployments" >&2
      exit 1
    fi
    CONFIG_NAME="turboplan-db-pr-${PR_NUMBER}"
    ;;
  *)
    echo "Error: Invalid environment '${ENVIRONMENT}'. Use production, staging, or preview." >&2
    exit 1
    ;;
esac

CF_API="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/hyperdrive/configs"

# Exact name match over the REST API: `wrangler hyperdrive list` only emits a
# table whose rows wrap, which breaks line-based grep (see cleanup-preview.sh).
lookup_id() {
  local configs
  if ! configs=$(curl -sf "$CF_API" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"); then
    echo "Error: could not list Hyperdrive configs" >&2
    return 1
  fi
  jq -r --arg name "$CONFIG_NAME" '.result[] | select(.name == $name) | .id' <<<"$configs" | head -1
}

echo "==> Looking for Hyperdrive config: ${CONFIG_NAME}" >&2
HID=$(lookup_id)

if [[ -z "$HID" ]]; then
  echo "==> Creating Hyperdrive config: ${CONFIG_NAME}" >&2
  if CREATE_OUTPUT=$(npx wrangler hyperdrive create "$CONFIG_NAME" --connection-string="$DB_URL" 2>&1); then
    echo "$CREATE_OUTPUT" >&2
    HID=$(lookup_id)
    if [[ -z "$HID" ]]; then
      echo "Error: created ${CONFIG_NAME} but could not find its id" >&2
      exit 1
    fi
    echo "$HID"
    exit 0
  fi

  echo "$CREATE_OUTPUT" >&2
  if ! grep -q "code: 2017" <<<"$CREATE_OUTPUT"; then
    exit 1
  fi
  echo "==> A concurrent deploy created ${CONFIG_NAME} first; updating it" >&2
  HID=$(lookup_id)
  if [[ -z "$HID" ]]; then
    echo "Error: ${CONFIG_NAME} already exists but could not find its id" >&2
    exit 1
  fi
fi

echo "==> Updating Hyperdrive config: ${CONFIG_NAME} (${HID})" >&2
npx wrangler hyperdrive update "$HID" --connection-string="$DB_URL" >&2
echo "$HID"
