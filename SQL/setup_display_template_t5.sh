#!/bin/bash
# Create display templates for tenant 5 type A (Healthcare Accrual)
# Uses platform APIs
BASE="http://127.0.0.1:4001"

echo "=== Creating Efficient display template ==="
E_RESULT=$(curl -s -X POST "$BASE/v1/display-templates" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 5,
    "template_name": "Healthcare Accrual Efficient",
    "template_type": "E",
    "activity_type": "A",
    "lines": [
      {"line_number": 10, "template_string": "[M,ACCRUAL_TYPE,\"Description\"],[M,SURVEY_LINK,\"Description\"]"}
    ]
  }')
echo "$E_RESULT"
E_ID=$(echo "$E_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['template_id'])" 2>/dev/null)
echo "Efficient template_id: $E_ID"

echo ""
echo "=== Activating Efficient template ==="
curl -s -X POST "$BASE/v1/display-templates/$E_ID/activate"
echo ""

echo ""
echo "=== Creating Verbose display template ==="
V_RESULT=$(curl -s -X POST "$BASE/v1/display-templates" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 5,
    "template_name": "Healthcare Accrual Verbose",
    "template_type": "V",
    "activity_type": "A",
    "lines": [
      {"line_number": 10, "template_string": "[M,ACCRUAL_TYPE,\"Description\"],[M,SURVEY_LINK,\"Description\"]"}
    ]
  }')
echo "$V_RESULT"
V_ID=$(echo "$V_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['template_id'])" 2>/dev/null)
echo "Verbose template_id: $V_ID"

echo ""
echo "=== Activating Verbose template ==="
curl -s -X POST "$BASE/v1/display-templates/$V_ID/activate"
echo ""

echo ""
echo "=== Done. Both templates created and activated. ==="
echo "Display line: [accrual type description] [survey name if survey]"
