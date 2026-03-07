#!/bin/bash
# Add SURVEY_LINK molecule to tenant 5 composite
# Uses platform APIs

BASE="http://127.0.0.1:4001"

echo "=== Creating SURVEY_LINK molecule ==="
RESULT=$(curl -s -X POST "$BASE/v1/molecules" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 5,
    "molecule_key": "SURVEY_LINK",
    "label": "Survey",
    "context": "activity",
    "attaches_to": "A",
    "value_kind": "lookup",
    "is_required": false,
    "is_active": true,
    "molecule_type": "D",
    "value_structure": "single",
    "storage_size": 2,
    "value_type": "key",
    "input_type": "P",
    "system_required": false,
    "is_static": false,
    "is_permanent": false
  }')
echo "$RESULT"
MOL_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['molecule_id'])" 2>/dev/null)
echo "SURVEY_LINK molecule_id: $MOL_ID"

echo ""
echo "=== Adding molecule_value_lookup for survey table ==="
# Need to insert lookup config so the display template can resolve survey.link → survey_name
psql -h 127.0.0.1 -U billjansen -d loyalty -c "
  INSERT INTO molecule_value_lookup (molecule_id, table_name, id_column, code_column, label_column, is_tenant_specific)
  VALUES ($MOL_ID, 'survey', 'link', 'survey_code', 'survey_name', true);
"

echo ""
echo "=== Adding SURVEY_LINK to composite (tenant 5, type A) ==="
# Use PUT to update existing composite - add SURVEY_LINK at sort_order 3 (between MEMBER_SURVEY_LINK at 2 and MEMBER_POINTS at 100)
# First get current composite details
COMPOSITE=$(curl -s "$BASE/v1/composites?tenant_id=5&composite_type=A")
echo "Current composite: $COMPOSITE"

# Get molecule IDs for all 4 molecules
ACCRUAL_TYPE_ID=$(psql -h 127.0.0.1 -U billjansen -d loyalty -t -c "SELECT molecule_id FROM molecule_def WHERE molecule_key='ACCRUAL_TYPE' AND tenant_id=5;")
SURVEY_LINK_ID=$MOL_ID
MEMBER_SURVEY_LINK_ID=$(psql -h 127.0.0.1 -U billjansen -d loyalty -t -c "SELECT molecule_id FROM molecule_def WHERE molecule_key='MEMBER_SURVEY_LINK' AND tenant_id=5;")
MEMBER_POINTS_ID=$(psql -h 127.0.0.1 -U billjansen -d loyalty -t -c "SELECT molecule_id FROM molecule_def WHERE molecule_key='MEMBER_POINTS' AND tenant_id=5;")

echo "ACCRUAL_TYPE_ID: $ACCRUAL_TYPE_ID"
echo "SURVEY_LINK_ID: $SURVEY_LINK_ID"
echo "MEMBER_SURVEY_LINK_ID: $MEMBER_SURVEY_LINK_ID"
echo "MEMBER_POINTS_ID: $MEMBER_POINTS_ID"

curl -s -X PUT "$BASE/v1/composites" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\": 5,
    \"composite_type\": \"A\",
    \"description\": \"Healthcare Accrual Entry\",
    \"details\": [
      {\"molecule_id\": ${ACCRUAL_TYPE_ID// /}, \"is_required\": true, \"sort_order\": 1},
      {\"molecule_id\": ${MEMBER_SURVEY_LINK_ID// /}, \"is_required\": false, \"sort_order\": 2},
      {\"molecule_id\": ${SURVEY_LINK_ID// /}, \"is_required\": false, \"sort_order\": 3},
      {\"molecule_id\": ${MEMBER_POINTS_ID// /}, \"is_required\": true, \"sort_order\": 100}
    ]
  }"
echo ""

echo ""
echo "=== Done. Restart server to reload caches ==="
