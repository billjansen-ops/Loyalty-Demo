-- Transform Database to Proper Bucket Structure
-- Run this from terminal: psql -h 127.0.0.1 -U billjansen -d loyalty -f fix_buckets.sql

-- 1. Add ranking column to point_expiration_rule
ALTER TABLE point_expiration_rule 
ADD COLUMN IF NOT EXISTS ranking INTEGER DEFAULT 0;

-- 2. Rename point_lot to member_point_bucket
ALTER TABLE point_lot RENAME TO member_point_bucket;

-- 3. Rename columns to match design
ALTER TABLE member_point_bucket RENAME COLUMN lot_id TO bucket_id;
ALTER TABLE member_point_bucket RENAME COLUMN qty TO accrued;
ALTER TABLE member_point_bucket RENAME COLUMN expires_at TO expiry_date;

-- 4. Add missing redeemed column
ALTER TABLE member_point_bucket 
ADD COLUMN IF NOT EXISTS redeemed BIGINT DEFAULT 0;

-- 5. Add unique constraint for UPSERT
ALTER TABLE member_point_bucket 
ADD CONSTRAINT member_point_bucket_unique 
UNIQUE (member_id, expiry_date);

-- 6. Add point_bucket_id to activity table
ALTER TABLE activity 
ADD COLUMN IF NOT EXISTS point_bucket_id BIGINT 
REFERENCES member_point_bucket(bucket_id);

-- 7. Update point_expiration_rule to have proper primary key
ALTER TABLE point_expiration_rule DROP CONSTRAINT IF EXISTS point_expiration_rule_pkey;
ALTER TABLE point_expiration_rule ADD COLUMN IF NOT EXISTS rule_id SERIAL PRIMARY KEY;

-- Verify changes
SELECT 'Tables updated successfully!' as status;
