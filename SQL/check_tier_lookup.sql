-- Check if tier molecule_value_lookup is configured
SELECT 
  md.molecule_id,
  md.molecule_key,
  mvl.table_name,
  mvl.id_column,
  mvl.code_column,
  mvl.label_column,
  mvl.is_tenant_specific
FROM molecule_def md
LEFT JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
WHERE md.molecule_key = 'tier';
