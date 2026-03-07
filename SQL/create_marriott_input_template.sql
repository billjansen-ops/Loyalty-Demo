-- Marriott Input Template (fixed for identity columns)
-- Date: 2025-12-29

INSERT INTO input_template (tenant_id, template_name, activity_type, is_active)
VALUES (3, 'Hotel Stay Entry', 'A', true);

DO $$
DECLARE
  v_template_id INTEGER;
BEGIN
  SELECT template_id INTO v_template_id 
  FROM input_template 
  WHERE tenant_id = 3 AND template_name = 'Hotel Stay Entry';
  
  -- Row 10: Brand (required)
  INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_template_id, 10, 'brand', 1, 50, 10, 'Y', true, 'Brand', 1);
  
  -- Row 10: Property (required)
  INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_template_id, 10, 'property', 51, 50, 20, 'Y', true, 'Property', 2);
  
  -- Row 20: Nights (required)
  INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_template_id, 20, 'nights', 1, 33, 3, 'Y', true, 'Nights', 3);
  
  -- Row 20: Eligible Spend (required)
  INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_template_id, 20, 'eligible_spend', 34, 33, 10, 'Y', true, 'Eligible Spend ($)', 4);
  
  -- Row 20: Folio (optional)
  INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_template_id, 20, 'folio', 67, 34, 20, 'Y', false, 'Folio #', 5);
  
  RAISE NOTICE 'Created input template_id: %', v_template_id;
END $$;

-- Verify
SELECT template_id, tenant_id, template_name, activity_type 
FROM input_template WHERE tenant_id = 3;

SELECT f.field_id, f.template_id, f.row_number, f.molecule_key, f.display_label, f.is_required
FROM input_template_field f
JOIN input_template t ON t.template_id = f.template_id
WHERE t.tenant_id = 3
ORDER BY f.row_number, f.sort_order;
