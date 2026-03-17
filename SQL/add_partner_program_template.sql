-- Add PARTNER_PROGRAM to Member Profile Attributes input template (template_id=4, tenant_id=1)
-- row_number=20, after PASSPORT (row 10). display_width=100 (full row), is_required=true
INSERT INTO input_template_field 
  (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, system_generated, is_required, display_label, sort_order, composite_link)
VALUES 
  (4, 20, 'PARTNER_PROGRAM', 1, 100, NULL, 'Y', NULL, false, 'Clinic Assignment', 1, NULL)
ON CONFLICT DO NOTHING;

-- Also add member display template for tenant 5 (if not already present)
-- This shows clinic assignment on the member activity view
INSERT INTO display_template (tenant_id, template_name, template_type, is_active, activity_type)
VALUES (5, 'Member Profile', 'E', true, 'M')
ON CONFLICT DO NOTHING;
