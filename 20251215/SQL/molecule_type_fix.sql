-- Fix migration: Remove NOT NULL constraint and complete value_kind updates
-- Date: 2024-12-01

-- Step 1: Remove NOT NULL constraint on value_kind
ALTER TABLE molecule_def ALTER COLUMN value_kind DROP NOT NULL;

-- Step 2: Set value_kind to NULL for embedded molecules
UPDATE molecule_def 
SET value_kind = NULL 
WHERE value_structure = 'embedded';

-- Step 3: Update value_kind to new naming for single-value molecules
UPDATE molecule_def 
SET value_kind = CASE 
    WHEN value_kind = 'scalar' THEN 'value'
    WHEN value_kind = 'list' THEN 'internal_list'
    WHEN value_kind = 'lookup' THEN 'external_list'
    ELSE value_kind
END
WHERE value_kind IS NOT NULL;

-- Verify
SELECT molecule_key, molecule_type, value_structure, value_kind, scalar_type, is_static, context 
FROM molecule_def 
ORDER BY molecule_type, value_structure, molecule_key;
