-- Check if member_activity uses BIGINT for activity_id
-- This is important for high-volume tables that could exceed 2 billion records

SELECT 
    column_name,
    data_type,
    CASE 
        WHEN data_type = 'bigint' THEN '✅ Correct (BIGINT)'
        WHEN data_type = 'integer' THEN '⚠️ Should be BIGINT for high volume'
        ELSE '❓ Check type: ' || data_type
    END as status
FROM information_schema.columns
WHERE table_name = 'member_activity'
  AND column_name IN ('activity_id', 'member_id')
ORDER BY column_name;

-- If the above shows 'integer' instead of 'bigint', uncomment and run the following:

-- WARNING: This requires downtime and can take a long time on large tables!
-- Only run this if you need to convert from INTEGER to BIGINT

/*
-- Step 1: Create a new column as BIGINT
ALTER TABLE member_activity ADD COLUMN activity_id_new BIGINT;

-- Step 2: Copy data
UPDATE member_activity SET activity_id_new = activity_id;

-- Step 3: Drop old column and rename (requires dropping constraints first)
-- This is complex and should be done with a proper migration tool
-- Recommend: Create new table with BIGINT and migrate data instead

*/

-- Note: If member_activity already uses BIGINT, you're all set! ✅
