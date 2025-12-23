-- =============================================================================
-- ADD key_molecule_id TO member_alias
-- Tracks which molecule type (carrier, partner, etc.) the key_ref came from
-- Created: 2025-12-17
-- =============================================================================

-- Add the column
ALTER TABLE member_alias 
ADD COLUMN key_molecule_id INTEGER REFERENCES molecule_def(molecule_id);

-- Drop old unique index
DROP INDEX IF EXISTS idx_member_alias_unique;

-- Create new unique index including key_molecule_id
-- This allows: American #12345 AND Hertz #12345 (different molecule types)
-- But prevents: two American #12345 (same molecule type + value)
CREATE UNIQUE INDEX idx_member_alias_unique 
  ON member_alias(
    tenant_id, 
    alias_type_link, 
    COALESCE(key_molecule_id, 0), 
    COALESCE(key_ref, 0), 
    alias_value
  );

COMMENT ON COLUMN member_alias.key_molecule_id IS 'Which molecule type (carrier, partner) identifies this alias - for uniqueness';
