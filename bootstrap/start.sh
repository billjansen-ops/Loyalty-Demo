#!/usr/bin/env bash
set -euo pipefail
export PGHOST=localhost
export PGPORT=5432
export PGUSER=billjansen
export PGDATABASE=loyalty
export PORT=4001
export STARTCHECK=Billy
cd "$(dirname "$0")/.."
echo "──────────────────────────────────────────────"
echo "Loyalty-Demo starting (HTML + API)"
echo "  URL: http://127.0.0.1:${PORT}/activity.html?memberId=2153442807"
echo "  DB : ${PGHOST}/${PGDATABASE} (user: ${PGUSER})"
echo "──────────────────────────────────────────────"
exec node server_db_api.js
