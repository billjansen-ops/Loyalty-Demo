-- Fix MEMBER_POINTS row 2 for all tenants
-- Row 2 is N1 (amount) - type should be 'numeric'

-- Tenant 1: molecule_id 42
UPDATE molecule_value_lookup 
SET value_type = 'numeric',
    context = 'activity',
    storage_size = 54,
    attaches_to = 'A'
WHERE molecule_id = 42 AND column_order = 2;

-- Tenant 3: molecule_id 62
UPDATE molecule_value_lookup 
SET value_type = 'numeric',
    context = 'activity',
    storage_size = 54,
    attaches_to = 'A'
WHERE molecule_id = 62 AND column_order = 2;

-- Verify
SELECT 
  mvl.molecule_id,
  md.molecule_key,
  md.tenant_id,
  mvl.column_order,
  mvl.value_type,
  mvl.context,
  mvl.storage_size
FROM molecule_value_lookup mvl
JOIN molecule_def md ON mvl.molecule_id = md.molecule_id
WHERE md.molecule_key = 'MEMBER_POINTS'
ORDER BY md.tenant_id, mvl.column_order;
