-- Add promotion molecules for type 'M' activities
-- Based on actual molecule_def schema

-- 1. Create member_promotion molecule (lookup to member_promotion table)
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  scalar_type,
  lookup_table_key,
  created_at,
  tenant_id,
  context,
  is_static,
  is_permanent,
  is_required,
  is_active,
  foreign_schema,
  description,
  display_order,
  updated_at,
  ref_table_name,
  ref_field_name,
  ref_function_name,
  decimal_places,
  parent_molecule_key,
  parent_fk_field
) VALUES (
  'member_promotion',
  'Member Promotion Enrollment',
  'lookup',
  NULL,
  'member_promotion',
  NOW(),
  1,
  'activity',
  false,
  false,
  false,
  true,
  NULL,
  'Link to specific member promotion enrollment that spawned reward',
  100,
  NOW(),
  NULL,
  NULL,
  NULL,
  0,
  NULL,
  NULL
);

-- 2. Create promotion molecule (lookup to promotion table)
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  scalar_type,
  lookup_table_key,
  created_at,
  tenant_id,
  context,
  is_static,
  is_permanent,
  is_required,
  is_active,
  foreign_schema,
  description,
  display_order,
  updated_at,
  ref_table_name,
  ref_field_name,
  ref_function_name,
  decimal_places,
  parent_molecule_key,
  parent_fk_field
) VALUES (
  'promotion',
  'Promotion',
  'lookup',
  NULL,
  'promotion',
  NOW(),
  1,
  'activity',
  false,
  false,
  false,
  true,
  NULL,
  'Link to promotion rule for code and description',
  101,
  NOW(),
  NULL,
  NULL,
  NULL,
  0,
  NULL,
  NULL
);

-- Verify
SELECT molecule_id, molecule_key, label, value_kind, lookup_table_key
FROM molecule_def
WHERE molecule_key IN ('member_promotion', 'promotion');
