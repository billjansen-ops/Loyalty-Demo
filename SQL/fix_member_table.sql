-- Fix member table
-- Date: 2025-11-13
-- Purpose: Convert member_id back to BIGINT, add membership_number, remove timestamps

-- Step 1: Drop foreign key constraints that reference member
ALTER TABLE activity DROP CONSTRAINT IF EXISTS fk_activity_member;
ALTER TABLE activity DROP CONSTRAINT IF EXISTS activity_member_id_fkey;
ALTER TABLE member_tier DROP CONSTRAINT IF EXISTS fk_member_tier_member;
ALTER TABLE point_lot DROP CONSTRAINT IF EXISTS point_lot_member_id_fkey;

-- Step 2: Add membership_number field and copy current member_id values to it
ALTER TABLE member ADD COLUMN IF NOT EXISTS membership_number VARCHAR(16);
UPDATE member SET membership_number = member_id WHERE membership_number IS NULL;

-- Step 3: Convert member_id back to BIGINT
ALTER TABLE member ALTER COLUMN member_id TYPE BIGINT USING member_id::BIGINT;

-- Step 4: Remove timestamp columns
ALTER TABLE member DROP COLUMN IF EXISTS created_at;
ALTER TABLE member DROP COLUMN IF EXISTS updated_at;

-- Step 5: Add index on membership_number for fast lookup
CREATE INDEX IF NOT EXISTS idx_member_membership_number ON member(membership_number);

-- Step 6: Recreate foreign key constraints
ALTER TABLE activity 
  ADD CONSTRAINT fk_activity_member 
  FOREIGN KEY (member_id) REFERENCES member(member_id);

ALTER TABLE member_tier 
  ADD CONSTRAINT fk_member_tier_member 
  FOREIGN KEY (member_id) REFERENCES member(member_id);

ALTER TABLE point_lot 
  ADD CONSTRAINT fk_point_lot_member 
  FOREIGN KEY (member_id) REFERENCES member(member_id);

-- Step 7: Reset auto-increment sequence to continue from current max
SELECT setval('member_member_id_seq', (SELECT COALESCE(MAX(member_id), 1) FROM member));

-- Verification
\d member

-- Show sample data
SELECT member_id, membership_number, fname, lname FROM member ORDER BY member_id LIMIT 5;
