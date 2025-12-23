-- ============================================================================
-- ADD TIER SUPPORT TO BONUS HEADER
-- Date: November 11, 2025
-- Purpose: Allow bonuses to specify required tier level
-- ============================================================================

-- 1. Add required_tier_id to bonus table
ALTER TABLE bonus ADD COLUMN required_tier_id INTEGER;

-- 2. Add foreign key constraint
ALTER TABLE bonus ADD CONSTRAINT fk_bonus_tier 
  FOREIGN KEY (required_tier_id) REFERENCES tier_definition(tier_id);

-- 3. Create tier molecule for UI dropdown
-- First, get next molecule_id
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  context,
  lookup_table_key,
  tenant_id,
  is_active,
  description,
  display_order
)
VALUES (
  'tier',
  'Member Tier',
  'lookup',
  'member',
  'tier_definition',
  1,  -- tenant_id (adjust if needed)
  true,
  'Member tier level (Basic, Silver, Gold, Platinum)',
  100
);

-- 4. Create molecule_value_lookup configuration
-- Get the molecule_id we just created
WITH new_molecule AS (
  SELECT molecule_id 
  FROM molecule_def 
  WHERE molecule_key = 'tier' AND tenant_id = 1
)
INSERT INTO molecule_value_lookup (
  molecule_id,
  table_name,
  id_column,
  code_column,
  label_column,
  is_tenant_specific
)
SELECT 
  molecule_id,
  'tier_definition',
  'tier_id',
  'tier_code',
  'tier_description',
  true
FROM new_molecule;

-- 5. Verify
SELECT 
  md.molecule_key,
  md.label,
  md.context,
  md.lookup_table_key,
  mvl.table_name,
  mvl.code_column,
  mvl.label_column
FROM molecule_def md
LEFT JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
WHERE md.molecule_key = 'tier';

-- 6. Check bonus table structure
\d bonus
