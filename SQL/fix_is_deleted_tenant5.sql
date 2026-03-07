-- IS_DELETED molecule for tenant 5 (wi_php)
-- Run on loyaltydemo and loyalty_backup

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
  molecule_key, label, value_kind, scalar_type, lookup_table_key, 5,
  context, is_static, is_permanent, is_required, is_active, foreign_schema,
  description, display_order, sample_code, sample_description, decimal_places,
  ref_table_name, ref_field_name, ref_function_name, parent_molecule_key,
  parent_fk_field, can_be_promotion_counter, display_width, list_context,
  system_required, input_type, molecule_type, value_structure, storage_size,
  value_type, attaches_to, param1_label, param2_label, param3_label, param4_label
FROM molecule_def
WHERE molecule_key = 'IS_DELETED' AND tenant_id = 1;
