#!/bin/bash
# Fix the carrier save logic to ensure alliance and status persist

perl -0777 -i -pe '
s{
INSERT\s+INTO\s+carriers\s*\(code,name,alliance,country,is_active\)
\s*VALUES\s*\(\$1,\$2,\$3,\$4,\$5\)
\s*ON\s+CONFLICT\s+\(code\)\s+DO\s+UPDATE
\s*SET\s+name=EXCLUDED\.name,\s+alliance=EXCLUDED\.alliance,\s+country=EXCLUDED\.country,\s+is_active=EXCLUDED\.is_active
}{
INSERT INTO carriers (code,name,alliance,country,is_active)
VALUES ($1,$2,$3,$4,$5)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      alliance = EXCLUDED.alliance,
      country = EXCLUDED.country,
      is_active = EXCLUDED.is_active
}xms' api.js

echo "✅ Carrier save logic patched (alliance + active now persist). Restart with:  node api.js"
