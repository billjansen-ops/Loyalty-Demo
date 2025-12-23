-- Insert activity_comment molecule for tenant 1
INSERT INTO molecule_def (
    molecule_key, label, value_kind, scalar_type, lookup_table_key,
    tenant_id, context, is_static, is_permanent, is_required, is_active,
    foreign_schema, description, display_order, molecule_id,
    sample_code, sample_description, decimal_places,
    ref_table_name, ref_field_name, ref_function_name,
    parent_molecule_key, parent_fk_field, can_be_promotion_counter,
    display_width, list_context, system_required, input_type,
    molecule_type, value_structure, storage_size, value_type, attaches_to
) VALUES (
    'activity_comment', 'Activity Comment', 'value', 'text', NULL,
    1, 'activity', false, false, false, true,
    NULL, 'Comment text for adjustment and other activities', 900, 50,
    NULL, NULL, 0,
    NULL, NULL, NULL,
    NULL, NULL, false,
    NULL, 'activity', false, 'P',
    'D', 'single', NULL, NULL, 'A'
);
