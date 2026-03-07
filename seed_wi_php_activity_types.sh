#!/bin/bash
# Seed activity_display and activity_type sysparms for Wisconsin PHP (tenant_id = 5)
# Run with server running: ./seed_wi_php_activity_types.sh

API=http://127.0.0.1:4001/v1/sysparms

echo "Creating activity_display sysparm for tenant 5..."
curl -s -X POST $API \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 5,
    "sysparm_key": "activity_display",
    "value_type": "text",
    "description": "Display configuration per activity type",
    "details": [
      {"category":"A","code":"label","value":"Activity","sort_order":0},
      {"category":"A","code":"icon","value":"📈","sort_order":1},
      {"category":"A","code":"color","value":"#1e3a5f","sort_order":2},
      {"category":"A","code":"bg_color","value":"#eff6ff","sort_order":3},
      {"category":"A","code":"border_color","value":"#1e3a5f","sort_order":4},
      {"category":"A","code":"show_bonuses","value":"false","sort_order":5},
      {"category":"A","code":"action_verb","value":"Recorded","sort_order":6},

      {"category":"R","code":"label","value":"Redemption","sort_order":0},
      {"category":"R","code":"icon","value":"🎁","sort_order":1},
      {"category":"R","code":"color","value":"#dc2626","sort_order":2},
      {"category":"R","code":"bg_color","value":"#fee2e2","sort_order":3},
      {"category":"R","code":"border_color","value":"#dc2626","sort_order":4},
      {"category":"R","code":"show_bonuses","value":"false","sort_order":5},
      {"category":"R","code":"action_verb","value":"Redeemed","sort_order":6},

      {"category":"J","code":"label","value":"Adjustment","sort_order":0},
      {"category":"J","code":"icon","value":"⚖️","sort_order":1},
      {"category":"J","code":"color","value":"#7c3aed","sort_order":2},
      {"category":"J","code":"bg_color","value":"#faf5ff","sort_order":3},
      {"category":"J","code":"border_color","value":"#7c3aed","sort_order":4},
      {"category":"J","code":"show_bonuses","value":"false","sort_order":5},
      {"category":"J","code":"action_verb","value":"Adjusted","sort_order":6},

      {"category":"P","code":"label","value":"Partner","sort_order":0},
      {"category":"P","code":"icon","value":"🤝","sort_order":1},
      {"category":"P","code":"color","value":"#0891b2","sort_order":2},
      {"category":"P","code":"bg_color","value":"#ecfeff","sort_order":3},
      {"category":"P","code":"border_color","value":"#0891b2","sort_order":4},
      {"category":"P","code":"show_bonuses","value":"false","sort_order":5},
      {"category":"P","code":"action_verb","value":"Added","sort_order":6},

      {"category":"M","code":"label","value":"Promotion","sort_order":0},
      {"category":"M","code":"icon","value":"🎯","sort_order":1},
      {"category":"M","code":"color","value":"#f59e0b","sort_order":2},
      {"category":"M","code":"bg_color","value":"#fef3c7","sort_order":3},
      {"category":"M","code":"border_color","value":"#f59e0b","sort_order":4},
      {"category":"M","code":"show_bonuses","value":"false","sort_order":5},
      {"category":"M","code":"action_verb","value":"Awarded","sort_order":6},

      {"category":"N","code":"label","value":"Bonus","sort_order":0},
      {"category":"N","code":"icon","value":"🎁","sort_order":1},
      {"category":"N","code":"color","value":"#10b981","sort_order":2},
      {"category":"N","code":"bg_color","value":"#d1fae5","sort_order":3},
      {"category":"N","code":"border_color","value":"#10b981","sort_order":4},
      {"category":"N","code":"show_bonuses","value":"false","sort_order":5},
      {"category":"N","code":"action_verb","value":"Awarded","sort_order":6}
    ]
  }' | python3 -m json.tool

echo ""
echo "Creating activity_type sysparm for tenant 5..."
curl -s -X POST $API \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 5,
    "sysparm_key": "activity_type",
    "value_type": "text",
    "description": "Type of activity",
    "details": [
      {"category":"A","code":"label","value":"Activity","sort_order":1},
      {"category":"J","code":"label","value":"Adjustment","sort_order":2},
      {"category":"R","code":"label","value":"Redemption","sort_order":3},
      {"category":"P","code":"label","value":"Partner","sort_order":4},
      {"category":"M","code":"label","value":"Promotion","sort_order":5},
      {"category":"N","code":"label","value":"Bonus","sort_order":6}
    ]
  }' | python3 -m json.tool

echo ""
echo "Done. Activity types configured for Wisconsin PHP."
