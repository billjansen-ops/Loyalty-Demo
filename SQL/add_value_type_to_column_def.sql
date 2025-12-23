-- Add value_type to molecule_column_def
-- This enables per-column encoding rules for composite molecules

ALTER TABLE molecule_column_def 
ADD COLUMN IF NOT EXISTS value_type VARCHAR(10);

COMMENT ON COLUMN molecule_column_def.value_type IS 'Storage encoding: link, key, code, numeric, date, bigdate';

-- Update existing member_point_bucket columns (molecule_id 41)
-- N1: rule_id (key) - offset encoding for positive FK
-- N2: expire_date (date) - no offset
-- N3: accrued (numeric) - no offset, supports negative
-- N4: redeemed (numeric) - no offset, supports negative
UPDATE molecule_column_def SET value_type = 'key' WHERE molecule_id = 41 AND column_order = 1;
UPDATE molecule_column_def SET value_type = 'date' WHERE molecule_id = 41 AND column_order = 2;
UPDATE molecule_column_def SET value_type = 'numeric' WHERE molecule_id = 41 AND column_order = 3;
UPDATE molecule_column_def SET value_type = 'numeric' WHERE molecule_id = 41 AND column_order = 4;

-- Update existing member_points columns (molecule_id 42)
-- C1: bucket_link (link) - raw bytes for FK lookup
-- N1: amount (numeric) - no offset, supports negative
UPDATE molecule_column_def SET value_type = 'link' WHERE molecule_id = 42 AND column_order = 1;
UPDATE molecule_column_def SET value_type = 'numeric' WHERE molecule_id = 42 AND column_order = 2;
