-- Add is_tenant_specific column to molecule_value_lookup
-- Purpose: Distinguish between tenant-specific tables (carriers) and global tables (airports)
-- Date: 2025-11-05

-- Add the column (defaults to TRUE for backward compatibility)
ALTER TABLE molecule_value_lookup
ADD COLUMN is_tenant_specific BOOLEAN DEFAULT TRUE NOT NULL;

-- Comment on the column
COMMENT ON COLUMN molecule_value_lookup.is_tenant_specific IS 
'TRUE if lookup table has tenant_id column (e.g., carriers). FALSE if global shared data (e.g., airports)';

-- Update existing rows based on known table types
-- Set airports to FALSE (global shared data)
UPDATE molecule_value_lookup
SET is_tenant_specific = FALSE
WHERE table_name = 'airports';

-- Set carriers to TRUE (tenant-specific) - already default but being explicit
UPDATE molecule_value_lookup
SET is_tenant_specific = TRUE
WHERE table_name = 'carriers';

-- Verify the changes
SELECT 
  lookup_id,
  molecule_id,
  table_name,
  is_tenant_specific,
  code_column,
  label_column
FROM molecule_value_lookup
ORDER BY table_name;
