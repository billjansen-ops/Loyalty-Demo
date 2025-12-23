#!/usr/bin/env bash
# bootstrap/start.sh — Stable launcher (no edits required)
# Runs HTML + API together on port 4001 and connects to the 'loyalty' database.

set -euo pipefail

# Move to project root (this file lives in ./bootstrap)
cd "$(dirname "$0")/.."

# --- Web server config ---
export PORT=4001
export NODE_ENV=development

# --- Database config ---
export PGHOST=localhost
export PGUSER=bill
export PGDATABASE=loyalty
# NOTE: We do not set PGPASSWORD here to avoid clobbering your local auth.
# If your DB requires it, set it once in your shell:
#   export PGPASSWORD='your_password'

echo "────────────────────────────────────────────────────────"
echo "Loyalty-Demo starting (HTML + API)"
echo "  URL: http://127.0.0.1:${PORT}/activity.html?memberId=2153442807"
echo "  DB : ${PGHOST}/${PGDATABASE} (user: ${PGUSER})"
echo "────────────────────────────────────────────────────────"

# Run the combined server that serves pages and API
exec node server_db_static.js
