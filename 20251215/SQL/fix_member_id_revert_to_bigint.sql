-- FIX SCRIPT: Revert member_id to BIGINT and add membership_number
-- Date: 2025-11-13
-- Purpose: Fix the member_id type conversion disaster

-- ============================================
-- STEP 1: Drop Foreign Key Constraints
-- ============================================
ALTER TABLE activity DROP CONSTRAINT IF EXISTS fk_activity_member;
ALTER TABLE activity DROP CONSTRAINT IF EXISTS activity_member_id_fkey;
ALTER TABLE member_tier DROP CONSTRAINT IF EXISTS member_tier_member_id_fkey;
ALTER TABLE bucket DROP CONSTRAINT IF EXISTS bucket_member_id_fkey;

-- ============================================
-- STEP 2: Convert member_id back to BIGINT
-- ============================================
-- Convert member table
ALTER TABLE member ALTER COLUMN member_id TYPE BIGINT USING member_id::BIGINT;

-- Convert member_tier table
ALTER TABLE member_tier ALTER COLUMN member_id TYPE BIGINT USING member_id::BIGINT;

-- Convert activity table (might already be BIGINT, but safe to run)
ALTER TABLE activity ALTER COLUMN member_id TYPE BIGINT USING member_id::BIGINT;

-- Convert bucket table
ALTER TABLE bucket ALTER COLUMN member_id TYPE BIGINT USING member_id::BIGINT;

-- ============================================
-- STEP 3: Add new membership_number field
-- ============================================
ALTER TABLE member ADD COLUMN IF NOT EXISTS membership_number VARCHAR(16);

-- Copy existing member_id values to membership_number
UPDATE member SET membership_number = member_id::TEXT;

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_member_membership_number ON member(membership_number);

-- ============================================
-- STEP 4: Recreate Foreign Key Constraints
-- ============================================
ALTER TABLE activity 
  ADD CONSTRAINT fk_activity_member 
  FOREIGN KEY (member_id) REFERENCES member(member_id);

ALTER TABLE member_tier 
  ADD CONSTRAINT fk_member_tier_member 
  FOREIGN KEY (member_id) REFERENCES member(member_id);

ALTER TABLE bucket 
  ADD CONSTRAINT fk_bucket_member 
  FOREIGN KEY (member_id) REFERENCES member(member_id);

-- ============================================
-- STEP 5: Reset auto-increment sequence
-- ============================================
SELECT setval('member_member_id_seq', (SELECT MAX(member_id) FROM member));

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all member_id types
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
WHERE table_name = 'member_tier' AND column_name = 'member_id'

UNION ALL

SELECT 
  'bucket' as table_name,
  data_type,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'bucket' AND column_name = 'member_id';

-- Check membership_number field exists
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'member' AND column_name = 'membership_number';

-- Verify data integrity
SELECT 
  member_id,
  membership_number,
  fname,
  lname
FROM member
ORDER BY member_id
LIMIT 10;

-- Check foreign key constraints are back
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'member_id'
ORDER BY tc.table_name;

-- Check activity count by member (make sure children still attached)
SELECT 
  m.member_id,
  m.membership_number,
  m.fname,
  COUNT(a.activity_id) as activity_count
FROM member m
LEFT JOIN activity a ON m.member_id = a.member_id
GROUP BY m.member_id, m.membership_number, m.fname
ORDER BY m.member_id
LIMIT 10;

-- SUCCESS MESSAGE
SELECT '✅ Fix complete! All member_id columns are BIGINT, membership_number added, foreign keys restored.' as status;
