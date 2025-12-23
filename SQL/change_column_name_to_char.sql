-- ============================================================================
-- CHANGE column_name FROM VARCHAR(10) TO CHAR(1) WITH A,B,C VALUES
-- ============================================================================

-- Step 1: Add new column
ALTER TABLE molecule_value_list ADD COLUMN col CHAR(1);

-- Step 2: Migrate values v1->A, v2->B, etc.
UPDATE molecule_value_list SET col = 'A' WHERE column_name = 'v1';
UPDATE molecule_value_list SET col = 'B' WHERE column_name = 'v2';
UPDATE molecule_value_list SET col = 'C' WHERE column_name = 'v3';
UPDATE molecule_value_list SET col = 'D' WHERE column_name = 'v4';
UPDATE molecule_value_list SET col = 'E' WHERE column_name = 'v5';
UPDATE molecule_value_list SET col = 'F' WHERE column_name = 'v6';

-- Step 3: Drop old column, make new column NOT NULL
ALTER TABLE molecule_value_list DROP COLUMN column_name;
ALTER TABLE molecule_value_list ALTER COLUMN col SET NOT NULL;

-- Step 4: Update index
DROP INDEX IF EXISTS idx_mvl_molecule_context_row;
CREATE INDEX idx_mvl_molecule_context_row ON molecule_value_list(molecule_id, context_id, row_num);

-- Step 5: Verify
SELECT * FROM molecule_value_list ORDER BY value_id DESC LIMIT 10;

-- ============================================================================
-- UPDATE molecule_column_def TO USE A,B,C
-- ============================================================================

UPDATE molecule_column_def SET column_name = 'A' WHERE column_name = 'v1';
UPDATE molecule_column_def SET column_name = 'B' WHERE column_name = 'v2';
UPDATE molecule_column_def SET column_name = 'C' WHERE column_name = 'v3';
UPDATE molecule_column_def SET column_name = 'D' WHERE column_name = 'v4';
UPDATE molecule_column_def SET column_name = 'E' WHERE column_name = 'v5';
UPDATE molecule_column_def SET column_name = 'F' WHERE column_name = 'v6';

-- Verify
SELECT * FROM molecule_column_def ORDER BY molecule_id, column_order LIMIT 20;
