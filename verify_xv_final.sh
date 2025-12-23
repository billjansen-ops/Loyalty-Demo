set -euo pipefail
PROJECT_DIR="${PROJECT_DIR:-$HOME/Projects/Loyalty-Demo}"
API_PORT="${API_PORT:-3000}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-loyalty}"
PGUSER="${PGUSER:-$USER}"
command -v psql >/dev/null 2>&1 || { echo "psql missing"; exit 1; }
command -v nc >/dev/null 2>&1 || { echo "nc missing"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl missing"; exit 1; }
JQ="cat"
command -v jq >/dev/null 2>&1 && JQ="jq"
API_PID=""
cleanup(){ [ -n "${API_PID}" ] && kill "${API_PID}" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -v ON_ERROR_STOP=1 -q -c "select 1;"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c "select current_database(), current_setting('search_path');"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -F '|' -t <<'SQL'
select 'tenant'            , to_regclass('public.tenant');
select 'member'            , to_regclass('public.member');
select 'activity'          , to_regclass('public.activity');
select 'activity_detail'   , to_regclass('public.activity_detail');
select 'point_type'        , to_regclass('public.point_type');
select 'tenant_settings'   , to_regclass('public.tenant_settings');
select 'tenant_terms'      , to_regclass('public.tenant_terms');
SQL
TENANT_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c "select tenant_id from public.tenant order by tenant_id limit 1;")
if [ -z "$TENANT_ID" ]; then
  TENANT_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c "insert into public.tenant(tenant_key,name,industry) values('demo','Demo Tenant','airline') returning tenant_id;")
fi
MEMBER_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c "select member_id from public.member where tenant_id=${TENANT_ID} order by member_id limit 1;")
if [ -z "$MEMBER_ID" ]; then
  MEMBER_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c "insert into public.member(member_id,tenant_id,name) values(1001, ${TENANT_ID}, 'Bill Demo') returning member_id;")
fi
HAS_ACTIVITY=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c "select exists(select 1 from public.activity where member_id=${MEMBER_ID});")
if [ "$HAS_ACTIVITY" != "t" ]; then
  AID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -A -t -c "insert into public.activity(member_id,activity_date,kind,subtype,point_amount,point_type) values(${MEMBER_ID}, current_date, 'accrual','base', 500, 'miles') returning activity_id;")
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -q -v aid="$AID" <<'SQL2'
insert into public.activity_detail(activity_id,k,v_text) values (:aid,'carrier_code','DL');
insert into public.activity_detail(activity_id,k,v_text) values (:aid,'origin','MSP');
insert into public.activity_detail(activity_id,k,v_text) values (:aid,'destination','ATL');
insert into public.activity_detail(activity_id,k,v_text) values (:aid,'fare_class','Y');
SQL2
fi
cd "$PROJECT_DIR"
if [ -f server.cjs ]; then
  node server.cjs --port "${API_PORT}" >/tmp/loyalty_xv_api.log 2>&1 & API_PID=$!
elif [ -f server.js ]; then
  node server.js --port "${API_PORT}" >/tmp/loyalty_xv_api.log 2>&1 & API_PID=$!
else
  echo "no server file"
  exit 1
fi
for _ in $(seq 1 40); do sleep 0.25; nc -z localhost "${API_PORT}" && break; done
nc -z localhost "${API_PORT}" || { echo "api not listening"; tail -n 120 /tmp/loyalty_xv_api.log; exit 1; }
echo api up
BASE="http://localhost:${API_PORT}"
curl -s "${BASE}/v1/member/search?q=Bill" | ${JQ}
curl -s "${BASE}/v1/member/${MEMBER_ID}/activities" | ${JQ}
curl -s "${BASE}/v1/member/${MEMBER_ID}/balances" | ${JQ}
echo done
