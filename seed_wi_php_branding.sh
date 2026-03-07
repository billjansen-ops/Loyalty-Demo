#!/bin/bash
# Seed branding for Wisconsin PHP (tenant_id = 5)
# Run with server running: ./seed_wi_php_branding.sh

curl -s -X PUT http://127.0.0.1:4001/v1/tenants/5/branding \
  -H "Content-Type: application/json" \
  -d '{
    "colors": {
      "primary": "#1e3a5f",
      "accent": "#2d8659"
    },
    "logo": {
      "url": "",
      "alt": "Wisconsin PHP"
    },
    "text": {
      "company_name": "Wisconsin PHP"
    }
  }' | python3 -m json.tool

echo ""
echo "Done. Clear browser localStorage and reload to see changes."
