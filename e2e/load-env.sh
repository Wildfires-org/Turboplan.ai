#!/bin/bash

# Load Environment Variables Script
# Loads environment variables from ./e2e/.env file

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/e2e/.env"

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Loading environment variables...${NC}"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}Warning: .env file not found at $ENV_FILE${NC}"
  echo -e "${YELLOW}Continuing without loading environment variables...${NC}"
  return 0
fi

# Load environment variables from .env file
# This will export all variables, skipping comments and empty lines
set -a  # automatically export all variables
source "$ENV_FILE"
set +a  # stop automatically exporting

echo -e "${GREEN}Environment variables loaded from $ENV_FILE${NC}"
echo ""

