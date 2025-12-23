#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/Projects/Loyalty-Demo}"
API_PORT="${API_PORT:-3000}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-postgres}"
PGUSER="${PGUSER:-$USER}"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1"; exit 1; }; }
need psql; need nc; need curl
JQ="cat"; command -v jq >/dev/null 2>&1 && JQ="jq"

API_PID=""
cleanup(){ [ -n "${API_PID}" ] && kill "${API_PID}" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

echo
echo "1) DB ping…"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -v ON_ERROR_STOP=1 -q -c "select 1;"

echo
echo "2) Core tables present?"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -F '|' -t <<'SQL'
select 'tenant'            , to_regclass('public.tenant');
select 'member'            , to_regclass('public.member');
select 'activity'          , to_regclass('public.activity');
select 'activity_detail'   , to_regclass('public.activity_detail');
select 'point_type'        , to_regclass('public.point_type');
select 'tenant_settings'   , to_regclass('public.tenant_settings');
select 'tenant_terms'      , to_regclass('public.tenant_terms');
SQL

echo
echo "3) Ensure demo tenant/member + seed one activity (molecule keys in activity_detail)…"
TENANT_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c "select tenant_id from tenant order by tenant_id limit 1;")
if [ -z "$TENANT_ID" ]; then
  TENANT_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c \
    "insert into tenant(tenant_key,name,industry) values('demo','Demo Tenant','airline') returning tenant_id;")
  echo "   created tenant_id=${TENANT_ID}"
else
  echo "   using tenant_id=${TENANT_ID}"
fi

MEMBER_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c \
  "select member_id from member where tenant_id=${TENANT_ID} order by member_id limit 1;")
if [ -z "$MEMBER_ID" ]; then
  MEMBER_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c \
    "insert into member(member_id,tenant_id,name) values(100001, ${TENANT_ID}, 'Bill Demo') returning member_id;")
  echo "   created member_id=${MEMBER_ID}"
else
  echo "   using member_id=${MEMBER_ID}"
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
  echo "   seeded activity_id=${AID}"
fi

echo
echo "4) Start API and probe endpoints…"
cd "$PROJECT_DIR"
if [ -f server.cjs ]; then
  node server.cjs --port "${API_PORT}" >/tmp/loyalty_xv_api.log 2>&1 & API_PID=$!
elif [ -f server.js ]; then
  node server.js --port "${API_PORT}"  >/tmp/loyalty_xv_api.log 2>&1 & API_PID=$!
else
  echo "No server.cjs or server.js in ${PROJECT_DIR}"; exit 1
fi

for _ in $(seq 1 40); do sleep 0.25; nc -z localhost "${API_PORT}" && break; done
nc -z localhost "${API_PORT}" || { echo "API not listening on ${API_PORT}"; tail -n 120 /tmp/loyalty_xv_api.log; exit 1; }
echo "   API up on :${API_PORT}"

BASE="http://localhost:${API_PORT}"

echo
echo "→ GET /v1/member/search?q=Bill"
curl -s "${BASE}/v1/member/search?q=Bill" | ${JQ}

echo
echo "→ GET /v1/member/${MEMBER_ID}/activities"
curl -s "${BASE}/v1/member/${MEMBER_ID}/activities" | ${JQ}

echo
echo "→ GET /v1/member/${MEMBER_ID}/balances"
curl -s "${BASE}/v1/member/${MEMBER_ID}/balances" | ${JQ}

echo
echo "Done. (logs: /tmp/loyalty_xv_api.log)"
