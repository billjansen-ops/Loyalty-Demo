-- Add ONLY the lookup metadata for promotion molecules
-- (Molecules already exist from previous run)

-- Check current state
\echo '=== Current State ==='
SELECT md.molecule_id, md.molecule_key, md.lookup_table_key,
       EXISTS(SELECT 1 FROM molecule_value_lookup mvl WHERE mvl.molecule_id = md.molecule_id) as has_lookup_metadata
FROM molecule_def md
WHERE md.molecule_key IN ('member_promotion', 'promotion')
ORDER BY md.molecule_key;

\echo ''
\echo '=== Adding Lookup Metadata ==='

-- Add lookup metadata for member_promotion (if not exists)
INSERT INTO molecule_value_lookup (
  molecule_id,
  table_name,
  id_column,
  code_column,
  label_column,
  maintenance_page,
  maintenance_description,
  created_at,
  updated_at,
  is_tenant_specific
)
SELECT 
  molecule_id,
  'member_promotion',
  'member_promotion_id',
  'member_promotion_id',
  'member_promotion_id',
  NULL,
  NULL,
  NOW(),
  NOW(),
  true
FROM molecule_def
WHERE molecule_key = 'member_promotion' 
  AND tenant_id = 1
  AND NOT EXISTS (
    SELECT 1 FROM molecule_value_lookup mvl 
    WHERE mvl.molecule_id = molecule_def.molecule_id
  );

\echo '✓ Added member_promotion lookup metadata (if missing)'

-- Add lookup metadata for promotion (if not exists)
INSERT INTO molecule_value_lookup (
  molecule_id,
  table_name,
  id_column,
  code_column,
  label_column,
  maintenance_page,
  maintenance_description,
  created_at,
  updated_at,
  is_tenant_specific
)
SELECT 
  molecule_id,
  'promotion',
  'promotion_id',
  'promotion_code',
  'promotion_name',
  'admin_promotions.html',
  'Promotion values are maintained in the <a href="admin_promotions.html">Promotion Management</a> page.',
  NOW(),
  NOW(),
  true
FROM molecule_def
WHERE molecule_key = 'promotion' 
  AND tenant_id = 1
  AND NOT EXISTS (
    SELECT 1 FROM molecule_value_lookup mvl 
    WHERE mvl.molecule_id = molecule_def.molecule_id
  );

\echo '✓ Added promotion lookup metadata (if missing)'

\echo ''
\echo '=== Final Verification ==='
SELECT 
  mvl.lookup_id,
  md.molecule_key,
  mvl.table_name,
  mvl.id_column,
  mvl.code_column,
  mvl.label_column,
  mvl.is_tenant_specific
FROM molecule_value_lookup mvl
JOIN molecule_def md ON mvl.molecule_id = md.molecule_id
WHERE md.molecule_key IN ('member_promotion', 'promotion')
ORDER BY md.molecule_key;

\echo ''
\echo '=== COMPLETE ==='
\echo 'Lookup metadata is now in place. Ready to test!'
