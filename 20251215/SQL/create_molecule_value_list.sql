-- ============================================================================
-- UNIFIED MOLECULE VALUE STORAGE
-- All molecule values stored as rows, not columns
-- ============================================================================

-- Step 1: Create the unified molecule value table
CREATE TABLE IF NOT EXISTS molecule_value_list (
    value_id BIGSERIAL PRIMARY KEY,
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    member_id BIGINT REFERENCES member(member_id),
    activity_id BIGINT REFERENCES activity(activity_id) ON DELETE CASCADE,
    row_num INTEGER NOT NULL DEFAULT 1,  -- Groups values into one "record"
    column_name VARCHAR(10) NOT NULL,     -- v1, v2, v3, etc.
    value BIGINT,                         -- All values are numbers
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_context CHECK (
        (member_id IS NOT NULL AND activity_id IS NULL) OR
        (member_id IS NULL AND activity_id IS NOT NULL)
    )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mvl_activity ON molecule_value_list(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mvl_member ON molecule_value_list(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mvl_molecule ON molecule_value_list(molecule_id);
CREATE INDEX IF NOT EXISTS idx_mvl_activity_molecule ON molecule_value_list(activity_id, molecule_id) WHERE activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mvl_member_molecule ON molecule_value_list(member_id, molecule_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mvl_row ON molecule_value_list(molecule_id, member_id, row_num) WHERE member_id IS NOT NULL;

-- Step 2: Migrate existing activity_detail data
-- Each row becomes one entry with column_name='v1'
INSERT INTO molecule_value_list (molecule_id, activity_id, row_num, column_name, value, created_at)
SELECT 
    ad.molecule_id,
    ad.activity_id,
    1,              -- All existing data is single-row
    'v1',           -- All existing data is single value
    ad.v_ref_id,
    NOW()
FROM activity_detail ad
WHERE NOT EXISTS (
    -- Don't duplicate if already migrated
    SELECT 1 FROM molecule_value_list mvl 
    WHERE mvl.activity_id = ad.activity_id 
    AND mvl.molecule_id = ad.molecule_id
);

-- Step 3: Verify migration
SELECT 'Migrated activity molecules' as status, COUNT(*) as count 
FROM molecule_value_list WHERE activity_id IS NOT NULL;

SELECT 'Original activity_detail rows' as status, COUNT(*) as count 
FROM activity_detail;

-- Step 4: Clean up old tables (OPTIONAL - uncomment when ready)
-- DROP TABLE IF EXISTS activity_detail_list;
-- DROP TABLE IF EXISTS member_detail_list;
-- Keep activity_detail as backup for now

-- ============================================================================
-- HELPER: Date conversion functions (for future use)
-- Epoch: December 3, 1959 = day 0
-- ============================================================================

CREATE OR REPLACE FUNCTION date_to_molecule_int(d DATE) RETURNS INTEGER AS $$
BEGIN
    RETURN d - DATE '1959-12-03';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION molecule_int_to_date(n INTEGER) RETURNS DATE AS $$
BEGIN
    RETURN DATE '1959-12-03' + n;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test the functions
SELECT 
    date_to_molecule_int(CURRENT_DATE) as today_as_int,
    molecule_int_to_date(date_to_molecule_int(CURRENT_DATE)) as back_to_date,
    date_to_molecule_int(DATE '1959-12-03') as epoch_check;
