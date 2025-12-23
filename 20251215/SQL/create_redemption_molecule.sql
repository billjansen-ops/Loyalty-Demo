-- Create redemption molecule as a lookup to redemption_rule table
-- Follows same pattern as carrier molecule

-- Step 1: Create molecule definition
INSERT INTO molecule_def (
  tenant_id,
  molecule_key,
  label,
  value_kind,
  context
) VALUES (
  1,
  'redemption',
  'Redemption Type',
  'lookup',
  'activity'
);

-- Step 2: Create lookup configuration
INSERT INTO molecule_value_lookup (
  molecule_id,
  table_name,
  id_column,
  code_column,
  label_column
) VALUES (
  (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'redemption' AND tenant_id = 1),
  'redemption_rule',
  'redemption_id',
  'redemption_code',
  'redemption_description'
);

-- Verify
SELECT 
  md.molecule_key,
  md.label,
  md.value_kind,
  md.context,
  mvl.table_name,
  mvl.id_column,
  mvl.code_column,
  mvl.label_column
FROM molecule_def md
JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
WHERE md.molecule_key = 'redemption' AND md.tenant_id = 1;
