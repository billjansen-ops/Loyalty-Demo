-- ============================================================
-- Migration: Convert member_point_bucket molecule to table
-- ============================================================

-- Step 1: Create the new table
CREATE TABLE member_point_bucket (
  link CHAR(5) PRIMARY KEY,
  p_link CHAR(5) NOT NULL,        -- member's link
  rule_id SMALLINT NOT NULL,       -- from N1
  expire_date SMALLINT NOT NULL,   -- from N2 (2-byte date)
  accrued INTEGER DEFAULT 0,       -- from N3
  redeemed INTEGER DEFAULT 0       -- from N4
);

-- Step 2: Create indexes
CREATE INDEX idx_member_point_bucket_p_link ON member_point_bucket(p_link);
CREATE INDEX idx_member_point_bucket_rule ON member_point_bucket(p_link, rule_id);

-- Step 3: Migrate data from 5_data_2244
-- link = squish(detail_id) - we need a function for this
-- For now, use a PL/pgSQL function to do the conversion

CREATE OR REPLACE FUNCTION squish_to_char5(val BIGINT) RETURNS CHAR(5) AS $$
DECLARE
  remaining BIGINT;
  i INT;
  bytes BYTEA;
BEGIN
  remaining := val;
  -- Build bytes in reverse order (high-order first like JS unshift)
  bytes := E''::bytea;
  FOR i IN 1..5 LOOP
    bytes := chr(((remaining % 127) + 1)::int)::bytea || bytes;
    remaining := remaining / 127;
  END LOOP;
  
  RETURN convert_from(bytes, 'SQL_ASCII');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Insert migrated data
INSERT INTO member_point_bucket (link, p_link, rule_id, expire_date, accrued, redeemed)
SELECT 
  squish_to_char5(detail_id),
  p_link,
  n1 + 32768 as rule_id,           -- decode from offset encoding
  n2 as expire_date,               -- already a 2-byte date
  n3 as accrued,
  n4 as redeemed
FROM "5_data_2244"
WHERE molecule_id = (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'member_point_bucket');

-- Step 5: Seed link_tank for member_point_bucket
INSERT INTO link_tank (table_key, link_bytes, next_link, tenant_id)
SELECT 'member_point_bucket', 5, COALESCE(MAX(detail_id), 0) + 1, 1
FROM "5_data_2244"
ON CONFLICT (table_key, tenant_id) DO UPDATE SET next_link = EXCLUDED.next_link;

-- Step 6: Deactivate the molecule definition
UPDATE molecule_def SET is_active = false WHERE molecule_key = 'member_point_bucket';

-- Step 7: Clean up - remove migrated rows from 5_data_2244
DELETE FROM "5_data_2244" 
WHERE molecule_id = (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'member_point_bucket');

-- Done! The activity member_points molecule C1 values already contain squished detail_ids
-- which now match the link values in member_point_bucket
