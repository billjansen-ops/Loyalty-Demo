-- migrate_member_link_to_pk.sql
-- Make member.link the primary key, drop member_id
-- Run with: psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/migrate_member_link_to_pk.sql

BEGIN;

-- Step 1: Check that all members have a link value
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM member WHERE link IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot migrate: % members have NULL link values', null_count;
  END IF;
END $$;

-- Step 2: Drop any remaining FK constraints that reference member.member_id
-- Use DO blocks to handle missing tables/constraints gracefully

DO $$ BEGIN
  ALTER TABLE member_tier DROP CONSTRAINT IF EXISTS fk_member_tier_member;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE member_tier DROP CONSTRAINT IF EXISTS member_tier_member_id_fkey;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE member_promotion DROP CONSTRAINT IF EXISTS member_promotion_member_id_fkey;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE member_detail_list DROP CONSTRAINT IF EXISTS member_detail_list_member_id_fkey;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE member_promotion_detail DROP CONSTRAINT IF EXISTS member_promotion_detail_enrolled_member_id_fkey;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP TABLE IF EXISTS member_attr;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Step 3: Drop the primary key constraint on member_id
ALTER TABLE member DROP CONSTRAINT member_pkey;

-- Step 4: Ensure link is NOT NULL and add primary key
ALTER TABLE member ALTER COLUMN link SET NOT NULL;
ALTER TABLE member ADD PRIMARY KEY (link);

-- Step 5: Create index on membership_number for lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_member_membership_number ON member(membership_number);

-- Step 6: Drop member_id column
ALTER TABLE member DROP COLUMN member_id;

-- Step 7: Drop the sequence
DROP SEQUENCE IF EXISTS member_member_id_seq;

-- Step 8: Clean up member_promotion_detail.enrolled_member_id if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'member_promotion_detail' AND column_name = 'enrolled_member_id'
  ) THEN
    ALTER TABLE member_promotion_detail DROP COLUMN enrolled_member_id;
  END IF;
END $$;

COMMIT;

-- Verify
SELECT 'Migration complete. Member table PK is now link:' as status;
\d member
