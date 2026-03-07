-- Insert MEMBER_POINTS for any tenant missing it, using tenant 1 as template
-- Safe to run multiple times (ON CONFLICT DO NOTHING)

INSERT INTO molecule_def (
  molecule_key, label, value_kind, scalar_type, lookup_table_key, tenant_id,
  context, is_static, is_permanent, is_required, is_active, foreign_schema,
  description, display_order, sample_code, sample_description, decimal_places,
  ref_table_name, ref_field_name, ref_function_name, parent_molecule_key,
  parent_fk_field, can_be_promotion_counter, display_width, list_context,
  system_required, input_type, molecule_type, value_structure, storage_size,
  value_type, attaches_to, param1_label, param2_label, param3_label, param4_label
)
SELECT
  m.molecule_key, m.label, m.value_kind, m.scalar_type, m.lookup_table_key, t.tenant_id,
  m.context, m.is_static, m.is_permanent, m.is_required, m.is_active, m.foreign_schema,
  m.description, m.display_order, m.sample_code, m.sample_description, m.decimal_places,
  m.ref_table_name, m.ref_field_name, m.ref_function_name, m.parent_molecule_key,
  m.parent_fk_field, m.can_be_promotion_counter, m.display_width, m.list_context,
  m.system_required, m.input_type, m.molecule_type, m.value_structure, m.storage_size,
  m.value_type, m.attaches_to, m.param1_label, m.param2_label, m.param3_label, m.param4_label
FROM molecule_def m
CROSS JOIN tenant t
WHERE m.molecule_key = 'MEMBER_POINTS' AND m.tenant_id = 1
AND NOT EXISTS (
  SELECT 1 FROM molecule_def WHERE molecule_key = 'MEMBER_POINTS' AND tenant_id = t.tenant_id
);
