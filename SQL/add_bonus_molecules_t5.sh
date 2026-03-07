#!/bin/bash
# Create BONUS_ACTIVITY_LINK and BONUS_RULE_ID molecules for tenant 5
BASE="http://127.0.0.1:4001"

echo "=== Creating BONUS_ACTIVITY_LINK ==="
curl -s -X POST "$BASE/v1/molecules" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 5,
    "molecule_key": "BONUS_ACTIVITY_LINK",
    "label": "Bonus Activity Link",
    "context": "activity",
    "attaches_to": "A",
    "value_kind": "value",
    "scalar_type": "char",
    "is_required": false,
    "is_active": true,
    "molecule_type": "D",
    "value_structure": "single",
    "storage_size": 5,
    "value_type": "link",
    "input_type": "P",
    "system_required": false,
    "is_static": false,
    "is_permanent": false
  }'
echo ""

echo ""
echo "=== Creating BONUS_RULE_ID ==="
curl -s -X POST "$BASE/v1/molecules" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 5,
    "molecule_key": "BONUS_RULE_ID",
    "label": "Bonus Rule",
    "context": "activity",
    "attaches_to": "A",
    "value_kind": "value",
    "scalar_type": "numeric",
    "is_required": true,
    "is_active": true,
    "molecule_type": "D",
    "value_structure": "single",
    "storage_size": 2,
    "value_type": "key",
    "input_type": "P",
    "system_required": false,
    "is_static": false,
    "is_permanent": false
  }'
echo ""

echo ""
echo "=== Done. Restart server to reload caches. ==="
