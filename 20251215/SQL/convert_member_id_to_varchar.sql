-- Complete member_id migration to VARCHAR(16)
-- Date: 2025-11-13

-- Step 1: Drop any existing foreign key constraints that would block the change
ALTER TABLE activity DROP CONSTRAINT IF EXISTS fk_activity_member;
ALTER TABLE activity DROP CONSTRAINT IF EXISTS activity_member_id_fkey;

-- Step 2: Convert member_id in all tables
ALTER TABLE member ALTER COLUMN member_id TYPE VARCHAR(16);
ALTER TABLE member_tier ALTER COLUMN member_id TYPE VARCHAR(16);
ALTER TABLE activity ALTER COLUMN member_id TYPE VARCHAR(16);
ALTER TABLE bucket ALTER COLUMN member_id TYPE VARCHAR(16);

-- Step 3: Trim any spaces
UPDATE member SET member_id = TRIM(member_id);
UPDATE member_tier SET member_id = TRIM(member_id);
UPDATE activity SET member_id = TRIM(member_id);
UPDATE bucket SET member_id = TRIM(member_id);

-- Step 4: Verify the changes
SELECT 
  'member' as table_name,
  data_type,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'member' AND column_name = 'member_id'

UNION ALL

SELECT 
  'activity' as table_name,
  data_type,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'activity' AND column_name = 'member_id'

UNION ALL

SELECT 
  'member_tier' as table_name,
  data_type,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'member_tier' AND column_name = 'member_id';

-- Step 5: Show sample data
SELECT 'member' as source, member_id, LENGTH(member_id) as len FROM member LIMIT 3
UNION ALL
SELECT 'activity' as source, member_id, LENGTH(member_id) as len FROM activity LIMIT 3;
