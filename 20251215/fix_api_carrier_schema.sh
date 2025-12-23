#!/bin/bash
# Fix carrier save SQL to include tenant schema prefix properly

perl -0777 -i -pe '
s{
INSERT\s+INTO\s+carriers\s*\(code,\s*name,\s*alliance,\s*country,\s*is_active\)
\s*VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5\)
\s*ON\s+CONFLICT\s+\(code\)\s+DO\s+UPDATE
\s*SET\s+name\s*=\s*EXCLUDED\.name,\s*alliance\s*=\s*EXCLUDED\.alliance,\s*country\s*=\s*EXCLUDED\.country,\s*is_active\s*=\s*EXCLUDED\.is_active
}{
INSERT INTO %I.carriers (code, name, alliance, country, is_active)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      alliance = EXCLUDED.alliance,
      country = EXCLUDED.country,
      is_active = EXCLUDED.is_active
}xms' api.js

echo "✅ Carrier save now includes tenant schema. Restart node to apply."
