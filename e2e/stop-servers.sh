#!/bin/bash

# E2E Test Server Cleanup Script
# Gracefully stops all test servers and cleans up resources

set +e  # Don't exit on error for cleanup script

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_ROOT/e2e/logs/pids.txt"
LOG_DIR="$PROJECT_ROOT/e2e/logs"

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping E2E test servers...${NC}"

# Try to stop using PIDs first
if [ -f "$PID_FILE" ]; then
  echo -e "${YELLOW}Sending SIGTERM to processes...${NC}"
  
  while IFS= read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "Stopping process $pid..."
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  
  # Wait for graceful shutdown
  echo -e "${YELLOW}Waiting for graceful shutdown (2s)...${NC}"
  sleep 2
  
  # Force kill any remaining processes
  while IFS= read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${YELLOW}Force killing process $pid...${NC}"
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  
  rm -f "$PID_FILE"
else
  echo -e "${YELLOW}No PID file found, skipping PID-based cleanup${NC}"
fi

# Fallback: kill by port
echo -e "${YELLOW}Cleaning up any remaining processes on ports 3000, 3001, 3002...${NC}"
lsof -ti:3000,3001,3002 | xargs kill -9 2>/dev/null || true

# Clean up log files — keep them in CI so the server-logs artifact upload
# (and failure debugging) can still read them after cleanup runs.
if [ -z "$CI" ]; then
  echo -e "${YELLOW}Cleaning up log files...${NC}"
  rm -f "$LOG_DIR"/*.log
fi
rm -f "$PID_FILE"

echo -e "${GREEN}Cleanup complete!${NC}"
exit 0
