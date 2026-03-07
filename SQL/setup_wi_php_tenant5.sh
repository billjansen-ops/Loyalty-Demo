#!/bin/bash
# Setup Wisconsin PHP (tenant 5) - molecules, composite, and activity processing
# Uses platform APIs so link_tank, caches, and sequences are handled correctly

BASE="http://127.0.0.1:4001"

echo "=== Creating ACCRUAL_TYPE molecule ==="
ACCRUAL_RESULT=$(curl -s -X POST "$BASE/v1/molecules" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 5,
    "molecule_key": "ACCRUAL_TYPE",
    "label": "Accrual Type",
    "context": "activity",
    "attaches_to": "A",
    "value_kind": "internal_list",
    "is_required": true,
    "is_active": true,
    "molecule_type": "D",
    "value_structure": "single",
    "storage_size": 1,
    "value_type": "code",
    "input_type": "P",
    "list_context": "activity",
    "system_required": false,
    "is_static": false,
    "is_permanent": false
  }')
echo "$ACCRUAL_RESULT"
ACCRUAL_ID=$(echo "$ACCRUAL_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['molecule_id'])" 2>/dev/null)
echo "ACCRUAL_TYPE molecule_id: $ACCRUAL_ID"

echo ""
echo "=== Adding ACCRUAL_TYPE list values ==="
for pair in "SURVEY:Survey" "COMP:Compliance" "EVENT:Event Report" "OPS:Operational" "WEAR:Wearable" "PULSE:Monthly Pulse"; do
  CODE="${pair%%:*}"
  LABEL="${pair#*:}"
  echo -n "  $CODE -> "
  curl -s -X POST "$BASE/v1/molecules/$ACCRUAL_ID/values" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_id\": 5, \"value\": \"$CODE\", \"label\": \"$LABEL\"}"
  echo ""
done

echo ""
echo "=== Creating MEMBER_SURVEY_LINK molecule ==="
SURVEY_LINK_RESULT=$(curl -s -X POST "$BASE/v1/molecules" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 5,
    "molecule_key": "MEMBER_SURVEY_LINK",
    "label": "Survey Link",
    "context": "activity",
    "attaches_to": "A",
    "value_kind": "value",
    "scalar_type": "numeric",
    "is_required": false,
    "is_active": true,
    "molecule_type": "D",
    "value_structure": "single",
    "storage_size": 4,
    "value_type": "key",
    "input_type": "P",
    "system_required": false,
    "is_static": false,
    "is_permanent": false
  }')
echo "$SURVEY_LINK_RESULT"
SURVEY_LINK_ID=$(echo "$SURVEY_LINK_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['molecule_id'])" 2>/dev/null)
echo "MEMBER_SURVEY_LINK molecule_id: $SURVEY_LINK_ID"

echo ""
echo "=== Creating composite for tenant 5, type A ==="
curl -s -X POST "$BASE/v1/composites" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\": 5,
    \"composite_type\": \"A\",
    \"description\": \"Healthcare Accrual Entry\",
    \"details\": [
      {\"molecule_id\": $ACCRUAL_ID, \"is_required\": true, \"sort_order\": 1},
      {\"molecule_id\": $SURVEY_LINK_ID, \"is_required\": false, \"sort_order\": 2},
      {\"molecule_id\": 101, \"is_required\": true, \"sort_order\": 100}
    ]
  }"
echo ""

echo ""
echo "=== Adding activity_processing sysparm for tenant 5 type A ==="
# First check if activity_processing sysparm exists for tenant 5
SYSPARM_CHECK=$(curl -s "$BASE/v1/admin/sysparms?tenant_id=5" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for s in data:
    if s.get('sysparm_key') == 'activity_processing':
        print(s['sysparm_id'])
        break
" 2>/dev/null)

if [ -z "$SYSPARM_CHECK" ]; then
  echo "  Creating activity_processing sysparm..."
  psql -h 127.0.0.1 -U billjansen -d loyalty -c "
    INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
    VALUES (5, 'activity_processing', 'text', 'Activity type processing configuration')
    RETURNING sysparm_id;
  "
fi

# Add points_mode = manual for type A
psql -h 127.0.0.1 -U billjansen -d loyalty -c "
  INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
  SELECT s.sysparm_id, 'A', 'points_mode', 'manual', 1
  FROM sysparm s WHERE s.tenant_id = 5 AND s.sysparm_key = 'activity_processing'
  AND NOT EXISTS (
    SELECT 1 FROM sysparm_detail sd
    WHERE sd.sysparm_id = s.sysparm_id AND sd.category = 'A' AND sd.code = 'points_mode'
  );
"

echo ""
echo "=== Done! Restart server to pick up cache changes ==="
