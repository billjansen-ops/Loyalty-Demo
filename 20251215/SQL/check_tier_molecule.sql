-- Check if tier molecule exists
SELECT molecule_id, molecule_key, label, value_kind, context, lookup_table_key
FROM molecule_def
WHERE molecule_key = 'tier';

-- Check if molecule_value_lookup is configured
SELECT 
  md.molecule_key,
  mvl.table_name,
  mvl.id_column,
  mvl.code_column,
  mvl.label_column,
  mvl.sort_column
FROM molecule_def md
LEFT JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
WHERE md.molecule_key = 'tier';

-- Check tier_definition table
SELECT tier_id, tier_code, tier_description, tier_ranking, tenant_id
FROM tier_definition
ORDER BY tier_ranking;
