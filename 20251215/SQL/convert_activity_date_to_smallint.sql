-- Convert activity_date from DATE to SMALLINT (2-byte molecule date)
-- Epoch: 1959-12-03 = 0
-- Range: 0 to 65535 days (through ~2138)

-- IMPORTANT: After running this migration, update server_db_api.js:
-- Change: const ACTIVITY_DATE_MIGRATED = false;
-- To:     const ACTIVITY_DATE_MIGRATED = true;

-- Step 1: Add new column
ALTER TABLE activity ADD COLUMN activity_date_int SMALLINT;

-- Step 2: Convert existing dates
-- Formula: days since 1959-12-03
UPDATE activity 
SET activity_date_int = (activity_date - DATE '1959-12-03')::INTEGER;

-- Verify conversion
SELECT activity_id, activity_date, activity_date_int,
       DATE '1959-12-03' + activity_date_int as reconverted
FROM activity 
LIMIT 10;

-- Step 3: Drop old column, rename new
ALTER TABLE activity DROP COLUMN activity_date;
ALTER TABLE activity RENAME COLUMN activity_date_int TO activity_date;

-- Step 4: Remove post_date (per roadmap - audit trail will handle this later)
ALTER TABLE activity DROP COLUMN IF EXISTS post_date;

-- Verify final structure
\d activity

-- Verify data integrity
SELECT activity_id, activity_date,
       DATE '1959-12-03' + activity_date as date_value
FROM activity 
LIMIT 10;
