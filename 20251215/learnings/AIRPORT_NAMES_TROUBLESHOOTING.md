# Airport Names Not Displaying - Troubleshooting

## Issue
Airport names (Minneapolis St. Paul, Boston, etc.) are not showing in the expanded flight details section.

## What We Changed
Updated `server_db_api.js` to join the airports and carriers tables:
- LEFT JOIN airports o ON a.origin = o.code
- LEFT JOIN airports d ON a.destination = d.code
- LEFT JOIN carriers c ON a.carrier_code = c.code

## Potential Causes

### 1. Database Missing Lookup Data
Check if airports table has data:
```sql
SELECT * FROM airports WHERE code IN ('MSP', 'BOS', 'DEN', 'LGA');
```

Check if carriers table has data:
```sql
SELECT * FROM carriers WHERE code IN ('BJ', 'DL', 'AA');
```

### 2. Server Not Restarted
After updating server_db_api.js, you must restart:
```bash
# Stop the running server (Ctrl+C)
node server_db_api.js
```

### 3. Column Names Mismatch
The airports table might have different column names. Check schema:
```sql
\d airports
```

Expected columns:
- code (TEXT)
- name (TEXT)
- city (TEXT)

### 4. Test the API Directly
```bash
curl http://127.0.0.1:4001/v1/member/2153442807/activities?limit=1
```

Look for these fields in the response:
- origin_name
- origin_city
- destination_name
- destination_city
- carrier_name

## Quick Fix to Test
If lookups are empty, add sample data:
```sql
INSERT INTO airports (code, name, city) VALUES
  ('MSP', 'Minneapolis-St. Paul International Airport', 'Minneapolis'),
  ('BOS', 'Boston Logan International Airport', 'Boston'),
  ('DEN', 'Denver International Airport', 'Denver'),
  ('LGA', 'LaGuardia Airport', 'New York');

INSERT INTO carriers (code, name) VALUES
  ('BJ', 'Blue Jets Airways'),
  ('DL', 'Delta Air Lines'),
  ('AA', 'American Airlines');
```

Then restart server and test.
