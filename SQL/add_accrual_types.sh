#!/bin/bash
# Add remaining ACCRUAL_TYPE list values via platform API
# SURVEY (value_id 1) already exists
BASE="http://127.0.0.1:4001"

echo "=== Updating SURVEY description ==="
curl -s -X PUT "$BASE/v1/molecules/106/values/1" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": 5, "label": "Survey"}'
echo ""

echo "=== Adding COMP ==="
curl -s -X POST "$BASE/v1/molecules/106/values" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": 5, "value": "COMP", "label": "Compensation"}'
echo ""

echo "=== Adding WEAR ==="
curl -s -X POST "$BASE/v1/molecules/106/values" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": 5, "value": "WEAR", "label": "Wearable"}'
echo ""

echo "=== Adding COACH ==="
curl -s -X POST "$BASE/v1/molecules/106/values" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": 5, "value": "COACH", "label": "Coaching"}'
echo ""

echo "=== Adding PEER ==="
curl -s -X POST "$BASE/v1/molecules/106/values" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": 5, "value": "PEER", "label": "Peer Support"}'
echo ""

echo "=== Adding SELF ==="
curl -s -X POST "$BASE/v1/molecules/106/values" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": 5, "value": "SELF", "label": "Self-Reported"}'
echo ""

echo "=== Done. Six accrual types configured. ==="
