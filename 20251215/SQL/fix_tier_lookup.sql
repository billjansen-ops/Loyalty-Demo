-- Connect tier molecule to tier_definition table
-- (molecule_id 23 based on your output)

INSERT INTO molecule_value_lookup (
  molecule_id,
  table_name,
  id_column,
  code_column,
  label_column,
  is_tenant_specific
) VALUES (
  23,  -- tier molecule_id
  'tier_definition',
  'tier_id',
  'tier_code',
  'tier_description',
  true
);

-- Verify
SELECT 
  md.molecule_key,
  mvl.table_name,
  mvl.id_column,
  mvl.code_column,
  mvl.label_column
FROM molecule_def md
JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
WHERE md.molecule_key = 'tier';
