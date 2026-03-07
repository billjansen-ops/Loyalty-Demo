-- ============================================================================
-- Add lookup_table_key to molecule_column_def
-- ============================================================================
-- This allows multi-column molecules to have per-column lookup tables.
-- Existing rows (member_points) get NULL which is correct - they don't need lookups.
-- ============================================================================

ALTER TABLE molecule_column_def 
  ADD COLUMN IF NOT EXISTS lookup_table_key TEXT;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'molecule_column_def'
ORDER BY ordinal_position;
