#!/usr/bin/env bash
# start.sh - standard startup routine for Loyalty-Demo
# Launches the real API and UI together on port 4001

cd "$(dirname "$0")/.."

# --- Environment Configuration ---
export PORT=4001
export NODE_ENV=development
export PGHOST=localhost
export PGUSER=bill
export PGPASSWORD=your_password_here
export PGDATABASE=loyaltydemo

echo "Starting Loyalty-Demo on port ${PORT}..."
echo "Postgres: ${PGHOST}/${PGDATABASE} (user: ${PGUSER})"
echo ""

node server_fixed.js
