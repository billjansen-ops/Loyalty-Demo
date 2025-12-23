#!/usr/bin/env bash
set -euo pipefail

# --- Config ---
PROJECT_DIR="${PROJECT_DIR:-$HOME/Projects/Loyalty-Demo}"
API_PORT="${API_PORT:-3000}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-postgres}"
PGUSER="${PGUSER:-$USER}"

say(){ printf "\n%s\n" "$*"; }

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1"; exit 1; }; }

# Dependencies we use
need psql
need nc
need curl

# jq is optional; we’ll fall back to raw JSON if it’s missing
if command -v jq >/dev/null 2>&1; then JQ=jq; else JQ=cat; fi

# Stop API automatically on exit
API_PID=""
cleanup(){ [ -n "$API_PID" ] && kill "$API_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

# 1) DB sanity
say "1) Checking DB connectivity…"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -v ON_ERROR_STOP=1 -q -c "select 1;"

for t in tenant member activity activity_detail point_type tenant_settings tenant_terms; do
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -q -c "\d+ $t" >/dev/null
done
say "   ✓ Core tables present"

# 2) Seed a tenant/member/activity if needed (molecule keys live in activity_detail)
say "2) Ensuring demo tenant and member exist…"
TENANT_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c "select tenant_id from tenant limit 1;")
if [ -z "$TENANT_ID" ]; then
  TENANT_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c \
    "insert into tenant(tenant_key,name,industry) values('demo','Demo Tenant','airline') returning tenant_id;")
  say "   Created tenant_id=${TENANT_ID}"
else
  say "   Using existing tenant_id=${TENANT_ID}"
fi

MEMBER_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c \
  "select member_id from member where tenant_id=${TENANT_ID} order by member_id limit 1;")
if [ -z "$MEMBER_ID" ]; then
  MEMBER_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c \
    "insert into member(member_id,tenant_id,name) values(100001, ${TENANT_ID}, 'Bill Demo') returning member_id;")
  say "   Created member_id=${MEMBER_ID}"
else
  say "   Using existing member_id=${MEMBER_ID}"
fi

HAS_ACTIVITY=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c \
  "select exists(select 1 from activity where member_id=${MEMBER_ID});")
if [ "$HAS_ACTIVITY" != "t" ]; then
  AID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c \
    "insert into activity(member_id,activity_date,kind,subtype,point_amount,point_type)
     values(${MEMBER_ID}, current_date, 'accrual','base', 500, 'miles') returning activity_id;")
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -q -c \
    "insert into activity_detail(activity_id,k,v_text) values
      (${AID}, 'carrier_code','DL'),
      (${AID}, 'origin','MSP'),
      (${AID}, 'destination','ATL'),
      (${AID}, 'fare_class','Y');"
  say "   Seeded activity_id=${AID} with molecule keys (carrier_code, origin, destination, fare_class)"
fi

# 3) Start API (prefer server.cjs; fall back to server.js)
say "3) Starting API on port ${API_PORT}…"
cd "$PROJECT_DIR"
if [ -f server.cjs ]; then
  node server.cjs --port "${API_PORT}" >/tmp/loyalty_xv_api.log 2>&1 & API_PID=$!
elif [ -f server.js ]; then
  node server.js --port "${API_PORT}" >/tmp/loyalty_xv_api.log 2>&1 & API_PID=$!
else
  echo "No server.cjs or server.js in ${PROJECT_DIR}"
  exit 1
fi

for i in {1..20}; do
  sleep 0.25
  if nc -z localhost "${API_PORT}" 2>/dev/null; then break; fi
done
say "   ✓ API is listening (logs: /tmp/loyalty_xv_api.log)"

# 4) Hit endpoints
BASE="http://localhost:${API_PORT}"
say "4) Exercising endpoints…"

say "   → GET /v1/member/search?q=Bill"
curl -s "${BASE}/v1/member/search?q=Bill" | ${JQ}

say "   → GET /v1/member/${MEMBER_ID}/activities"
curl -s "${BASE}/v1/member/${MEMBER_ID}/activities" | ${JQ}

say "   → GET /v1/member/${MEMBER_ID}/balances"
curl -s "${BASE}/v1/member/${MEMBER_ID}/balances" | ${JQ}

say "Done. To stop the API manually: kill ${API_PID}"
