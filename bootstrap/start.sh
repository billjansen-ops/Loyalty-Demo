#!/usr/bin/env bash
set -euo pipefail
export PGHOST=localhost
export PGPORT=5432
export PGUSER=billjansen
export PGDATABASE=loyalty
export PORT=4001
export STARTCHECK=Pointers
# Public-door rate limiting OFF for local dev + the test suite (the suite
# drives many logins/registrations from one IP). Heroku leaves this unset,
# so the limiter is live in the deployed environment. (Session 147 audit #5)
export RATE_LIMIT_DISABLED=1
cd "$(dirname "$0")/.."
echo "──────────────────────────────────────────────"
echo "Pointers starting (HTML + API)"
echo "  URL: http://127.0.0.1:${PORT}/activity.html?memberId=2153442807"
echo "  DB : ${PGHOST}/${PGDATABASE} (user: ${PGUSER})"
echo "──────────────────────────────────────────────"
exec node pointers.js
