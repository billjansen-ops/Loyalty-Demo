-- Fix is_tenant_specific for brand/property lookups
-- These tables don't have a tenant_id column

UPDATE molecule_value_lookup
SET is_tenant_specific = false
WHERE molecule_id IN (
  SELECT molecule_id FROM molecule_def 
  WHERE tenant_id = 3 AND molecule_key IN ('brand', 'property')
);

-- Verify
SELECT md.molecule_key, mvl.table_name, mvl.is_tenant_specific
FROM molecule_def md
JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
WHERE md.tenant_id = 3 AND md.molecule_key IN ('brand', 'property');
