-- Migration: Merge molecule_column_def into molecule_value_lookup
-- This consolidates per-column metadata into one table

-- Step 1: Add new columns to molecule_value_lookup
ALTER TABLE molecule_value_lookup 
  ADD COLUMN IF NOT EXISTS column_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS decimal_places SMALLINT,
  ADD COLUMN IF NOT EXISTS col_description TEXT;

-- Step 2: Make lookup columns nullable (for non-external_key columns)
ALTER TABLE molecule_value_lookup 
  ALTER COLUMN table_name DROP NOT NULL,
  ALTER COLUMN id_column DROP NOT NULL,
  ALTER COLUMN code_column DROP NOT NULL,
  ALTER COLUMN label_column DROP NOT NULL;

-- Step 3: Update existing rows with column_type based on molecule_def.value_kind
-- External list molecules already have rows - set their column_type
UPDATE molecule_value_lookup mvl
SET column_type = 'external_key'
WHERE column_type IS NULL
  AND table_name IS NOT NULL;

-- Step 4: Migrate data from molecule_column_def 
-- For rows that don't already exist in molecule_value_lookup
INSERT INTO molecule_value_lookup (molecule_id, column_order, column_type, col_description)
SELECT 
  mcd.molecule_id,
  mcd.column_order,
  CASE mcd.column_type
    WHEN 'key' THEN 'external_key'
    WHEN 'ref' THEN 'external_key'
    WHEN 'link' THEN 'internal_key'
    WHEN 'numeric' THEN 'numeric'
    WHEN 'date' THEN 'date'
    ELSE mcd.column_type
  END,
  mcd.description
FROM molecule_column_def mcd
WHERE NOT EXISTS (
  SELECT 1 FROM molecule_value_lookup mvl 
  WHERE mvl.molecule_id = mcd.molecule_id 
    AND mvl.column_order = mcd.column_order
);

-- Step 5: Update existing molecule_value_lookup rows with column_def info where applicable
UPDATE molecule_value_lookup mvl
SET 
  column_type = COALESCE(mvl.column_type, 
    CASE mcd.column_type
      WHEN 'key' THEN 'external_key'
      WHEN 'ref' THEN 'external_key'
      WHEN 'link' THEN 'internal_key'
      WHEN 'numeric' THEN 'numeric'
      WHEN 'date' THEN 'date'
      ELSE mcd.column_type
    END),
  col_description = COALESCE(mvl.col_description, mcd.description)
FROM molecule_column_def mcd
WHERE mvl.molecule_id = mcd.molecule_id 
  AND mvl.column_order = mcd.column_order;

-- Step 6: Create rows for molecules that have no molecule_value_lookup entry yet
-- These are internal_list, text, numeric, etc. molecules
INSERT INTO molecule_value_lookup (molecule_id, column_order, column_type, col_description)
SELECT 
  md.molecule_id,
  1 as column_order,
  CASE 
    WHEN md.value_kind = 'external_list' THEN 'external_key'
    WHEN md.value_kind = 'internal_list' THEN 'internal_list'
    WHEN md.value_kind = 'text' THEN 'text'
    WHEN md.value_kind = 'text_direct' THEN 'text_direct'
    WHEN md.value_type = 'link' THEN 'internal_key'
    WHEN md.value_type = 'numeric' THEN 'numeric'
    WHEN md.scalar_type = 'date' THEN 'date'
    ELSE 'numeric'  -- default fallback
  END,
  md.description
FROM molecule_def md
WHERE md.molecule_type = 'D'  -- Dynamic molecules only
  AND NOT EXISTS (
    SELECT 1 FROM molecule_value_lookup mvl 
    WHERE mvl.molecule_id = md.molecule_id 
      AND mvl.column_order = 1
  );

-- Step 7: Copy decimal_places from molecule_def to column 1 rows
UPDATE molecule_value_lookup mvl
SET decimal_places = md.decimal_places
FROM molecule_def md
WHERE mvl.molecule_id = md.molecule_id
  AND mvl.column_order = 1
  AND md.decimal_places IS NOT NULL;

-- Step 8: Add unique constraint on (molecule_id, column_order)
-- First check if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'molecule_value_lookup_molecule_column_unique'
  ) THEN
    ALTER TABLE molecule_value_lookup 
      ADD CONSTRAINT molecule_value_lookup_molecule_column_unique 
      UNIQUE (molecule_id, column_order);
  END IF;
END $$;

-- Step 9: Reset sequence for lookup_id
SELECT setval('molecule_value_lookup_lookup_id_seq', (SELECT COALESCE(MAX(lookup_id), 0) + 1 FROM molecule_value_lookup), false);

-- Verify migration
SELECT 'molecule_value_lookup rows:' as info, COUNT(*) as count FROM molecule_value_lookup;
SELECT 'Rows with column_type set:' as info, COUNT(*) as count FROM molecule_value_lookup WHERE column_type IS NOT NULL;
SELECT 'Rows by column_order:' as info, column_order, COUNT(*) as count FROM molecule_value_lookup GROUP BY column_order ORDER BY column_order;
