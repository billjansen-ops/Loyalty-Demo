-- Migration: Add molecule_type and value_structure columns to molecule_def
-- Date: 2024-12-01
-- Purpose: Separate static/dynamic/reference from single/embedded storage pattern

-- Step 1: Add new columns
ALTER TABLE molecule_def 
ADD COLUMN IF NOT EXISTS molecule_type CHAR(1) DEFAULT 'D';

ALTER TABLE molecule_def 
ADD COLUMN IF NOT EXISTS value_structure VARCHAR(20) DEFAULT 'single';

-- Step 2: Fix data issues - these should be static
UPDATE molecule_def SET is_static = true WHERE molecule_key = 'state';
UPDATE molecule_def SET is_static = true WHERE molecule_key = 'activity_display';

-- Step 3: Migrate molecule_type 
-- S = Static, D = Dynamic, R = Reference
UPDATE molecule_def 
SET molecule_type = CASE 
    WHEN value_kind = 'reference' THEN 'R'
    WHEN value_kind = 'dynamic_list' THEN 'D'
    WHEN value_kind = 'embedded_list' THEN 'S'
    WHEN is_static = true THEN 'S'
    WHEN context IN ('activity', 'member') THEN 'D'
    ELSE 'S'
END;

-- Step 4: Migrate value_structure from value_kind
-- 'single' or 'embedded' or NULL for reference
UPDATE molecule_def 
SET value_structure = CASE 
    WHEN value_kind = 'reference' THEN NULL
    WHEN value_kind IN ('embedded_list', 'dynamic_list') THEN 'embedded'
    ELSE 'single'
END;

-- Step 5: Update value_kind to new naming convention for single-value molecules
-- scalar → value
-- list → internal_list  
-- lookup → external_list
-- reference stays as reference
-- embedded_list, dynamic_list → NULL (structure is in value_structure now)
UPDATE molecule_def 
SET value_kind = CASE 
    WHEN value_kind = 'scalar' THEN 'value'
    WHEN value_kind = 'list' THEN 'internal_list'
    WHEN value_kind = 'lookup' THEN 'external_list'
    WHEN value_kind = 'reference' THEN 'reference'
    WHEN value_kind IN ('embedded_list', 'dynamic_list') THEN NULL
    ELSE value_kind
END;

-- Step 6: Update sysparm molecule_types to new naming
UPDATE molecule_value_embedded_list 
SET code = 'value-text', description = 'Value - Text'
WHERE category = 'molecule_types' AND code = 'scalar-text';

UPDATE molecule_value_embedded_list 
SET code = 'value-numeric', description = 'Value - Numeric'
WHERE category = 'molecule_types' AND code = 'scalar-numeric';

UPDATE molecule_value_embedded_list 
SET code = 'value-date', description = 'Value - Date'
WHERE category = 'molecule_types' AND code = 'scalar-date';

UPDATE molecule_value_embedded_list 
SET code = 'value-boolean', description = 'Value - Boolean'
WHERE category = 'molecule_types' AND code = 'scalar-boolean';

UPDATE molecule_value_embedded_list 
SET code = 'internal_list', description = 'Internal List'
WHERE category = 'molecule_types' AND code = 'list';

UPDATE molecule_value_embedded_list 
SET code = 'external_list', description = 'External List (Lookup)'
WHERE category = 'molecule_types' AND code = 'lookup';

-- Remove embedded_list from molecule_types (now handled by value_structure toggle)
DELETE FROM molecule_value_embedded_list 
WHERE category = 'molecule_types' AND code = 'embedded_list';

-- Step 7: Add comments
COMMENT ON COLUMN molecule_def.molecule_type IS 'S=Static (tenant level), D=Dynamic (per activity/member), R=Reference (query on demand)';
COMMENT ON COLUMN molecule_def.value_structure IS 'single=one value, embedded=multi-row with columns, NULL for reference';

-- Verify migration
SELECT molecule_key, molecule_type, value_structure, value_kind, scalar_type, is_static, context 
FROM molecule_def 
ORDER BY molecule_type, value_structure, molecule_key;
