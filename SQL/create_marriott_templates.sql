-- Marriott Display and Input Templates
-- Date: 2025-12-29
-- Tenant ID 3 = Marriott

-- =====================================================
-- DISPLAY TEMPLATES
-- =====================================================

-- Efficient display (single line)
INSERT INTO display_template (template_id, tenant_id, template_name, template_type, is_active, activity_type)
SELECT COALESCE(MAX(template_id), 0) + 1, 3, 'Hotel Stay Efficient', 'E', true, 'A'
FROM display_template
RETURNING template_id;

-- Get the template_id we just created for efficient
DO $$
DECLARE
  v_template_id INTEGER;
  v_line_id INTEGER;
BEGIN
  SELECT template_id INTO v_template_id 
  FROM display_template 
  WHERE tenant_id = 3 AND template_name = 'Hotel Stay Efficient';
  
  SELECT COALESCE(MAX(line_id), 0) + 1 INTO v_line_id FROM display_template_line;
  
  -- Single line: "2 nights at Westin Minneapolis - $450.00"
  INSERT INTO display_template_line (line_id, template_id, line_number, template_string)
  VALUES (v_line_id, v_template_id, 10, 
    '[M,nights,"Code"],[T," nights at "],[M,brand,"Code"],[T," "],[M,property,"Description"],[T," - $"],[M,eligible_spend,"Code"]');
  
  RAISE NOTICE 'Created efficient display template_id: %, line_id: %', v_template_id, v_line_id;
END $$;

-- Verbose display (multiple lines)
INSERT INTO display_template (template_id, tenant_id, template_name, template_type, is_active, activity_type)
SELECT COALESCE(MAX(template_id), 0) + 1, 3, 'Hotel Stay Verbose', 'V', true, 'A'
FROM display_template;

DO $$
DECLARE
  v_template_id INTEGER;
  v_line_id INTEGER;
BEGIN
  SELECT template_id INTO v_template_id 
  FROM display_template 
  WHERE tenant_id = 3 AND template_name = 'Hotel Stay Verbose';
  
  SELECT COALESCE(MAX(line_id), 0) + 1 INTO v_line_id FROM display_template_line;
  
  -- Line 10: Brand and Property
  INSERT INTO display_template_line (line_id, template_id, line_number, template_string)
  VALUES (v_line_id, v_template_id, 10, 
    '[T,"Brand: "],[M,brand,"Both"],[T,"    Property: "],[M,property,"Both"]');
  v_line_id := v_line_id + 1;
  
  -- Line 20: Nights and Spend
  INSERT INTO display_template_line (line_id, template_id, line_number, template_string)
  VALUES (v_line_id, v_template_id, 20, 
    '[T,"Nights: "],[M,nights,"Code"],[T,"    Eligible Spend: $"],[M,eligible_spend,"Code"]');
  v_line_id := v_line_id + 1;
  
  -- Line 30: Folio (if present)
  INSERT INTO display_template_line (line_id, template_id, line_number, template_string)
  VALUES (v_line_id, v_template_id, 30, 
    '[T,"Folio: "],[M,folio,"Code"]');
  
  RAISE NOTICE 'Created verbose display template_id: %', v_template_id;
END $$;

-- =====================================================
-- INPUT TEMPLATES
-- =====================================================

INSERT INTO input_template (template_id, tenant_id, template_name, activity_type, is_active)
SELECT COALESCE(MAX(template_id), 0) + 1, 3, 'Hotel Stay Entry', 'A', true
FROM input_template;

DO $$
DECLARE
  v_template_id INTEGER;
  v_field_id INTEGER;
BEGIN
  SELECT template_id INTO v_template_id 
  FROM input_template 
  WHERE tenant_id = 3 AND template_name = 'Hotel Stay Entry';
  
  SELECT COALESCE(MAX(field_id), 0) + 1 INTO v_field_id FROM input_template_field;
  
  -- Row 10: Brand (required, drives property list)
  INSERT INTO input_template_field (field_id, template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_field_id, v_template_id, 10, 'brand', 1, 50, 10, 'Y', true, 'Brand', 1);
  v_field_id := v_field_id + 1;
  
  -- Row 10: Property (required)
  INSERT INTO input_template_field (field_id, template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_field_id, v_template_id, 10, 'property', 51, 50, 20, 'Y', true, 'Property', 2);
  v_field_id := v_field_id + 1;
  
  -- Row 20: Nights (required)
  INSERT INTO input_template_field (field_id, template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_field_id, v_template_id, 20, 'nights', 1, 33, 3, 'Y', true, 'Nights', 3);
  v_field_id := v_field_id + 1;
  
  -- Row 20: Eligible Spend (required)
  INSERT INTO input_template_field (field_id, template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_field_id, v_template_id, 20, 'eligible_spend', 34, 33, 10, 'Y', true, 'Eligible Spend ($)', 4);
  v_field_id := v_field_id + 1;
  
  -- Row 20: Folio (optional)
  INSERT INTO input_template_field (field_id, template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
  VALUES (v_field_id, v_template_id, 20, 'folio', 67, 34, 20, 'Y', false, 'Folio #', 5);
  
  RAISE NOTICE 'Created input template_id: %', v_template_id;
END $$;

-- Verify
SELECT 'Display Templates' as type, template_id, tenant_id, template_name, template_type, activity_type
FROM display_template WHERE tenant_id = 3
UNION ALL
SELECT 'Input Templates', template_id, tenant_id, template_name, '', activity_type
FROM input_template WHERE tenant_id = 3;
