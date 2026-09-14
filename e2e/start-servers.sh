#!/bin/bash

# E2E Test Server Orchestration Script
# Starts all required servers with health checks and timeout handling

set -e

TIMEOUT=30
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_ROOT/e2e/logs/pids.txt"
LOG_DIR="$PROJECT_ROOT/e2e/logs"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure cleanup runs on exit, error, or interrupt
cleanup_on_error() {
  echo -e "\n${YELLOW}Interrupt or error detected, cleaning up servers...${NC}"
  bash "$PROJECT_ROOT/e2e/stop-servers.sh"
  exit 1
}
trap cleanup_on_error ERR INT TERM

echo -e "${GREEN}Starting E2E test servers...${NC}"
echo ""

# Load environment variables from .env file
source "$PROJECT_ROOT/e2e/load-env.sh"

# Check environment variables using separate script
bash "$PROJECT_ROOT/e2e/check-env.sh"
if [ $? -ne 0 ]; then
  exit 1
fi
echo ""

# The landing-page /contact page fails its build when no support email is
# configured (deploy-time guard against shipping the placeholder inbox).
# E2E doesn't exercise real mail, so default a test address; a value from
# e2e/.env or CI takes precedence.
export NEXT_PUBLIC_SUPPORT_EMAIL="${NEXT_PUBLIC_SUPPORT_EMAIL:-support@turboplan.test}"

# Clean up any existing processes on required ports
echo -e "${YELLOW}Cleaning up existing processes on ports 3000, 3001, 3002...${NC}"
lsof -ti:3000,3001,3002 | xargs kill -9 2>/dev/null || true
sleep 1

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Remove old PID file and logs
rm -f "$PID_FILE"
rm -f "$LOG_DIR"/*.log

# Build packages (required for workspace dependencies)
echo -e "${YELLOW}Building workspace packages...${NC}"
pnpm build:packages
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to build packages${NC}"
  exit 1
fi

# Build apps
echo -e "${YELLOW}Building applications...${NC}"
pnpm build:apps
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to build applications${NC}"
  exit 1
fi

# Start landing-page (port 3002)
echo -e "${YELLOW}Starting landing-page on port 3002...${NC}"
cd apps/landing-page
pnpm start -p 3002 > "$LOG_DIR/landing-page.log" 2>&1 &
LANDING_PID=$!
echo "$LANDING_PID" >> "$PID_FILE"
cd ../..
echo -e "${GREEN}Landing-page started (PID: $LANDING_PID)${NC}"

# Start turboplan (port 3000)
echo -e "${YELLOW}Starting turboplan on port 3000...${NC}"
cd apps/turboplan
pnpm start -p 3000 > "$LOG_DIR/turboplan.log" 2>&1 &
TURBOPLAN_PID=$!
echo "$TURBOPLAN_PID" >> "$PID_FILE"
cd ../..
echo -e "${GREEN}Turboplan started (PID: $TURBOPLAN_PID)${NC}"

# Start server (port 3001)
echo -e "${YELLOW}Starting server on port 3001...${NC}"
cd apps/server
PORT=3001 node dist/local.js > "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >> "$PID_FILE"
cd ../..
echo -e "${GREEN}Server started (PID: $SERVER_PID)${NC}"

# Wait for all servers to be ready
echo -e "${YELLOW}Waiting for servers to be ready (timeout: ${TIMEOUT}s)...${NC}"
cd e2e
# `|| WAIT_EXIT_CODE=$?` keeps a wait-on failure from tripping `set -e` and
# the ERR trap, so the log tails below actually print on timeout.
WAIT_EXIT_CODE=0
pnpm exec wait-on -t ${TIMEOUT}000 http://localhost:3000 http://localhost:3001/health http://localhost:3002 || WAIT_EXIT_CODE=$?
cd ..

if [ $WAIT_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}All servers are ready!${NC}"
  echo -e "${GREEN}Logs available at:${NC}"
  echo -e "  - Landing-page: $LOG_DIR/landing-page.log"
  echo -e "  - Turboplan:    $LOG_DIR/turboplan.log"
  echo -e "  - Server:       $LOG_DIR/server.log"
  exit 0
else
  echo -e "${RED}Timeout waiting for servers to be ready${NC}"
  for log in "$LOG_DIR"/landing-page.log "$LOG_DIR"/turboplan.log "$LOG_DIR"/server.log; do
    echo -e "${RED}--- tail of $log ---${NC}"
    tail -30 "$log" 2>/dev/null || echo "(no log)"
  done


  # Call stop script to clean up
  bash e2e/stop-servers.sh
  exit 1
fi
