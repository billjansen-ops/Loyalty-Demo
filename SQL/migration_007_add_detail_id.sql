-- Migration 007: Add detail_id to member_detail_2244 for bucket references
-- This allows activity_detail_54.col_5 to reference specific buckets

-- Add sequence for detail_id
CREATE SEQUENCE IF NOT EXISTS member_detail_2244_detail_id_seq;

-- Add detail_id column
ALTER TABLE member_detail_2244 ADD COLUMN IF NOT EXISTS detail_id BIGINT;

-- Set default from sequence
ALTER TABLE member_detail_2244 ALTER COLUMN detail_id SET DEFAULT nextval('member_detail_2244_detail_id_seq');

-- Populate existing rows (if any)
UPDATE member_detail_2244 SET detail_id = nextval('member_detail_2244_detail_id_seq') WHERE detail_id IS NULL;

-- Make it NOT NULL and add primary key
ALTER TABLE member_detail_2244 ALTER COLUMN detail_id SET NOT NULL;

-- Add unique constraint (can't add PK if there might be existing PK, so use unique)
ALTER TABLE member_detail_2244 ADD CONSTRAINT member_detail_2244_detail_id_unique UNIQUE (detail_id);
