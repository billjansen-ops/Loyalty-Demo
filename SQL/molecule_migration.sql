-- MOLECULE CHILD TABLE MIGRATION
-- Consolidate header data into molecule_value_lookup

-- ============================================
-- STEP 1: Add header columns to molecule_value_lookup
-- These are the exact column names from molecule_def
-- ============================================

ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS value_type character varying(10);
ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS lookup_table_key text;
ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS value_kind text;
ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS scalar_type text;
ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS context text;
ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS storage_size smallint;
ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS attaches_to character varying(10);
ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS ref_table_name text;
ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS ref_field_name text;
ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS ref_function_name text;

-- ============================================
-- STEP 2: Populate row 1 for each molecule from header
-- ============================================

UPDATE molecule_value_lookup mvl
SET 
  value_type = md.value_type,
  lookup_table_key = md.lookup_table_key,
  value_kind = md.value_kind,
  scalar_type = md.scalar_type,
  context = md.context,
  storage_size = md.storage_size,
  attaches_to = md.attaches_to,
  ref_table_name = md.ref_table_name,
  ref_field_name = md.ref_field_name,
  ref_function_name = md.ref_function_name
FROM molecule_def md
WHERE mvl.molecule_id = md.molecule_id
  AND mvl.column_order = 1;

-- ============================================
-- STEP 3: Verify the migration
-- ============================================

SELECT 
  md.molecule_id,
  md.molecule_key,
  md.value_type as header_value_type,
  mvl.value_type as child_value_type,
  CASE WHEN md.value_type IS NOT DISTINCT FROM mvl.value_type THEN 'OK' ELSE 'MISMATCH' END as check
FROM molecule_def md
JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id AND mvl.column_order = 1
ORDER BY md.molecule_id;

-- ============================================
-- STEP 4: Delete BADGE molecule (will recreate properly later)
-- ============================================

DELETE FROM molecule_value_lookup WHERE molecule_id = 90;
DELETE FROM molecule_def WHERE molecule_id = 90;

-- ============================================
-- STEP 5: Drop the wrong child table
-- ============================================

DROP TABLE IF EXISTS molecule_column_def CASCADE;

-- ============================================
-- STEP 6: Drop the wrong storage table (we'll recreate)
-- ============================================

DROP TABLE IF EXISTS "5_data_222" CASCADE;

