#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/cleanup-preview.sh <pr-number>
#
# Deletes all Cloudflare Workers created for a PR preview deployment.
#
# Arguments:
#   pr-number - The PR number whose preview workers should be deleted
#
# Environment variables required:
#   CLOUDFLARE_API_TOKEN
#   CLOUDFLARE_ACCOUNT_ID
#
# Examples:
#   ./scripts/cleanup-preview.sh 42

PR_NUMBER="${1:?Usage: cleanup-preview.sh <pr-number>}"

PROJECT="turboplan"

# Apps with plain workers (map's container application is deleted separately below)
APPS=(landing api web mcp map)

echo "==> Cleaning up preview workers for PR #${PR_NUMBER}"

# Delete Hyperdrive config for this PR. Uses the REST API directly:
# `wrangler hyperdrive delete` has no --force flag (passing one is a hard
# error) and `wrangler hyperdrive list` only emits a table whose rows wrap,
# which breaks line-based grep. Exact name match via jq avoids both.
echo "==> Deleting Hyperdrive config for PR ${PR_NUMBER}"
HYPERDRIVE_NAME="${PROJECT}-db-pr-${PR_NUMBER}"
CF_API="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/hyperdrive/configs"
HYPERDRIVE_ID=$(curl -sf "$CF_API" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  | jq -r --arg name "$HYPERDRIVE_NAME" \
      '.result[] | select(.name == $name) | .id' | head -1 || true)
if [[ -n "$HYPERDRIVE_ID" ]]; then
  if curl -sf -X DELETE "${CF_API}/${HYPERDRIVE_ID}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" >/dev/null; then
    echo "Deleted Hyperdrive config: ${HYPERDRIVE_NAME} (${HYPERDRIVE_ID})"
  else
    echo "Warning: failed to delete Hyperdrive config ${HYPERDRIVE_NAME} (${HYPERDRIVE_ID})" >&2
  fi
else
  echo "No Hyperdrive config found for: ${HYPERDRIVE_NAME}"
fi

FAILED=0

for APP_NAME in "${APPS[@]}"; do
  WORKER_NAME="${PROJECT}-${APP_NAME}-pr-${PR_NUMBER}"
  echo "--> Deleting worker: ${WORKER_NAME}"

  if wrangler delete --name "$WORKER_NAME" --force 2>/dev/null; then
    echo "    Deleted ${WORKER_NAME}"
  else
    echo "    Warning: failed to delete ${WORKER_NAME} (may not exist)" >&2
    FAILED=$((FAILED + 1))
  fi
done

if [[ "$FAILED" -eq "${#APPS[@]}" ]]; then
  echo "==> No workers were deleted (none found for PR #${PR_NUMBER})"
else
  echo "==> Cleanup complete for PR #${PR_NUMBER}"
fi

# Delete the Stripe webhook endpoint provisioned for this PR (if billing was enabled).
# Matches on the api worker hostname; the trailing dot keeps pr-1 from matching pr-12.
if [[ -n "${STRIPE_SECRET_KEY:-}" ]]; then
  HOST_FRAGMENT="${PROJECT}-api-pr-${PR_NUMBER}."
  echo "--> Deleting Stripe webhook endpoint(s) for PR ${PR_NUMBER}"
  ENDPOINT_IDS=$(curl -sf "https://api.stripe.com/v1/webhook_endpoints?limit=100" \
    -u "${STRIPE_SECRET_KEY}:" \
    | jq -r --arg f "$HOST_FRAGMENT" '.data[] | select(.url | contains($f)) | .id' || true)
  if [[ -n "$ENDPOINT_IDS" ]]; then
    for endpoint_id in $ENDPOINT_IDS; do
      curl -sf -X DELETE "https://api.stripe.com/v1/webhook_endpoints/${endpoint_id}" \
        -u "${STRIPE_SECRET_KEY}:" >/dev/null \
        && echo "    Deleted endpoint ${endpoint_id}" \
        || echo "    Warning: failed to delete endpoint ${endpoint_id}" >&2
    done
  else
    echo "    No Stripe webhook endpoint found for PR ${PR_NUMBER}"
  fi
fi

# `wrangler delete` removes only the Worker — the container application (and its
# billed instances) must be deleted separately via `wrangler containers delete`.
# Requires the API token to have the Containers Edit permission.
CONTAINER_APP_NAME="${PROJECT}-map-pr-${PR_NUMBER}-mapcontainer"
echo "--> Deleting map container application: ${CONTAINER_APP_NAME}"
if ! CONTAINERS_JSON=$(wrangler containers list --json); then
  echo "Error: failed to list container applications (check token Containers permission)" >&2
  exit 1
fi
CONTAINER_APP_ID=$(jq -r --arg name "$CONTAINER_APP_NAME" \
  '.[] | select(.name == $name) | .id' <<<"$CONTAINERS_JSON" | head -1)
if [[ -n "$CONTAINER_APP_ID" ]]; then
  if wrangler containers delete "$CONTAINER_APP_ID"; then
    echo "    Deleted container application ${CONTAINER_APP_NAME} (${CONTAINER_APP_ID})"
  else
    echo "Error: failed to delete container application ${CONTAINER_APP_NAME} (${CONTAINER_APP_ID})" >&2
    exit 1
  fi
else
  echo "    No container application found for: ${CONTAINER_APP_NAME}"
fi
