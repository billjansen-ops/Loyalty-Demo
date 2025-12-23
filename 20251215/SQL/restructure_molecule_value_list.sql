-- ============================================================================
-- RESTRUCTURE molecule_value_list TO USE SINGLE context_id
-- ============================================================================

-- Step 1: Create new table structure
CREATE TABLE IF NOT EXISTS molecule_value_list_new (
    value_id BIGSERIAL PRIMARY KEY,
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    context_id BIGINT NOT NULL,  -- activity_id or member_id depending on molecule context
    row_num INTEGER NOT NULL DEFAULT 1,
    column_name VARCHAR(10) NOT NULL,
    value BIGINT
);

-- Step 2: Migrate data from old table (activity_id becomes context_id)
INSERT INTO molecule_value_list_new (molecule_id, context_id, row_num, column_name, value)
SELECT molecule_id, 
       COALESCE(activity_id, member_id) as context_id,
       row_num, 
       column_name, 
       value
FROM molecule_value_list
WHERE activity_id IS NOT NULL OR member_id IS NOT NULL;

-- Step 3: Drop old table and rename new
DROP TABLE molecule_value_list;
ALTER TABLE molecule_value_list_new RENAME TO molecule_value_list;

-- Step 4: Add indexes
CREATE INDEX idx_mvl_molecule ON molecule_value_list(molecule_id);
CREATE INDEX idx_mvl_context ON molecule_value_list(context_id);
CREATE INDEX idx_mvl_molecule_context ON molecule_value_list(molecule_id, context_id);
CREATE INDEX idx_mvl_molecule_context_row ON molecule_value_list(molecule_id, context_id, row_num);

-- Step 5: Verify
SELECT COUNT(*) as total_rows FROM molecule_value_list;
