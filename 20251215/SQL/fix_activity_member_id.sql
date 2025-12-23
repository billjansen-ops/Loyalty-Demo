-- Migration Fix: Handle partially completed migration
-- Date: 2025-11-13
-- Purpose: Fix activity.member_id type mismatch and complete migration

-- Step 1: Check current state
SELECT 
  'member.member_id type' as check_name,
  data_type 
FROM information_schema.columns 
WHERE table_name = 'member' AND column_name = 'member_id';

SELECT 
  'activity.member_id type' as check_name,
  data_type 
FROM information_schema.columns 
WHERE table_name = 'activity' AND column_name = 'member_id';

-- Step 2: Convert activity.member_id from BIGINT to VARCHAR(16)
ALTER TABLE activity 
ALTER COLUMN member_id TYPE VARCHAR(16);

-- Step 3: Trim any spaces in activity.member_id
UPDATE activity 
SET member_id = TRIM(member_id);

-- Step 4: Verify the change
SELECT 
  'activity.member_id type' as check_name,
  data_type 
FROM information_schema.columns 
WHERE table_name = 'activity' AND column_name = 'member_id';

-- Step 5: Show sample data to verify
SELECT 
  activity_id,
  member_id,
  LENGTH(member_id) as id_length,
  activity_date
FROM activity
LIMIT 5;
