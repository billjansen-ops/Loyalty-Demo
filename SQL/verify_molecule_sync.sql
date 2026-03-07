-- Compare molecule_def header with molecule_value_lookup column 1
SELECT 
  md.molecule_id,
  md.molecule_key,
  md.tenant_id,
  md.value_type as header_value_type,
  mvl.column_type as child_column_type,
  md.lookup_table_key as header_lookup_table,
  mvl.table_name as child_table_name,
  CASE WHEN md.value_type IS DISTINCT FROM mvl.column_type THEN 'MISMATCH' ELSE 'OK' END as type_check,
  CASE WHEN md.lookup_table_key IS DISTINCT FROM mvl.table_name THEN 'MISMATCH' ELSE 'OK' END as table_check
FROM molecule_def md
LEFT JOIN molecule_value_lookup mvl ON mvl.molecule_id = md.molecule_id AND mvl.column_order = 1
WHERE md.is_active = true
ORDER BY md.tenant_id, md.molecule_key;
