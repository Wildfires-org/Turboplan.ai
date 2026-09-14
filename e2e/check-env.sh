#!/bin/bash

# E2E Test Environment Variables Checker (CI only)
# Validates that required environment variables are set in CI

set -e

# Define required environment variables (must be set in CI)
REQUIRED_ENV_VARS=(
  "AUTH_SECRET"
  "INTERNAL_API_SECRET"
  "ENCRYPTION_KEY"
  "JWT_SIGNING_SECRET"
  "NODE_ENV"
  "TEST_POSTGRES_URL"
  "R2_ACCESS_KEY_ID"
  "R2_SECRET_ACCESS_KEY"
  "R2_BUCKET_NAME"
  "R2_ACCOUNT_ID"
  "R2_PUBLIC_URL"
  "OPENROUTER_API_KEY"
  "NEXT_PUBLIC_SERVER_URL"
  "NEXT_PUBLIC_TURBOPLAN_URL"
  "NEXT_PUBLIC_IS_TASKS_PACKAGE_ENABLED"
  "NEXT_PUBLIC_IS_FIELDS_PACKAGE_ENABLED"
  "NEXT_PUBLIC_IS_MAPS_PACKAGE_ENABLED"
  "NEXT_PUBLIC_IS_DOCUMENTS_PACKAGE_ENABLED"
  "NEXT_PUBLIC_IS_TIMELINE_RECORDS_PACKAGE_ENABLED"
)

echo "Validating environment variables..."

missing=()
for var in "${REQUIRED_ENV_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    missing+=("$var")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: Required environment variables are not set!"
  echo "Missing variables:"
  for var in "${missing[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Please ensure all required variables are set in the GitHub workflow."
  exit 1
fi

echo "All required environment variables are set ✓"
