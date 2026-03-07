-- Wisconsin PHP (tenant_id = 5) — Healthcare Accrual Setup
-- Molecules, internal list values, composite, display templates, input templates
-- Run: psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/setup_wi_php_accruals.sql

BEGIN;

-- ============================================================
-- 1. MOLECULE DEFINITIONS
-- ============================================================

-- ACCRUAL_TYPE: Internal list identifying which of the 6 streams (storage_size=1, value_type=code)
INSERT INTO molecule_def (
  molecule_key, label, value_kind, scalar_type, lookup_table_key, tenant_id, context,
  is_static, is_permanent, is_required, is_active, description, display_order,
  molecule_type, value_structure, storage_size, value_type, attaches_to, input_type
) VALUES (
  'ACCRUAL_TYPE', 'Accrual Type', 'internal_list', NULL, NULL, 5, 'activity',
  false, false, true, true, 'Which data stream produced this accrual (SURVEY, COMP, EVENT, etc.)', 0,
  'D', 'single', 1, 'code', 'A', 'P'
) RETURNING molecule_id;
-- Capture molecule_id for ACCRUAL_TYPE (will be used below)

-- MEMBER_SURVEY_LINK: Pointer to member_survey table (storage_size=4, value_type=key)
INSERT INTO molecule_def (
  molecule_key, label, value_kind, scalar_type, lookup_table_key, tenant_id, context,
  is_static, is_permanent, is_required, is_active, description, display_order,
  molecule_type, value_structure, storage_size, value_type, attaches_to, input_type
) VALUES (
  'MEMBER_SURVEY_LINK', 'Survey Reference', 'value', 'numeric', NULL, 5, 'activity',
  false, false, false, true, 'Link to member_survey record (optional, only for survey accruals)', 0,
  'D', 'single', 4, 'key', 'A', 'P'
) RETURNING molecule_id;

-- ============================================================
-- 2. MOLECULE VALUE LOOKUP (column definitions)
-- ============================================================

-- ACCRUAL_TYPE lookup row
INSERT INTO molecule_value_lookup (
  molecule_id, table_name, id_column, code_column, label_column,
  maintenance_page, maintenance_description, is_tenant_specific,
  column_order, column_type, decimal_places, col_description,
  value_type, lookup_table_key, value_kind, scalar_type, context,
  storage_size, attaches_to
) SELECT molecule_id, NULL, NULL, NULL, NULL,
  NULL, NULL, true,
  1, 'internal_list', 0, 'Which data stream produced this accrual',
  'code', NULL, 'internal_list', NULL, 'activity',
  1, 'A'
FROM molecule_def WHERE molecule_key = 'ACCRUAL_TYPE' AND tenant_id = 5;

-- MEMBER_SURVEY_LINK lookup row
INSERT INTO molecule_value_lookup (
  molecule_id, table_name, id_column, code_column, label_column,
  maintenance_page, maintenance_description, is_tenant_specific,
  column_order, column_type, decimal_places, col_description,
  value_type, lookup_table_key, value_kind, scalar_type, context,
  storage_size, attaches_to
) SELECT molecule_id, NULL, NULL, NULL, NULL,
  NULL, NULL, true,
  1, 'numeric', 0, 'Link to member_survey record',
  'key', NULL, 'value', 'numeric', 'activity',
  4, 'A'
FROM molecule_def WHERE molecule_key = 'MEMBER_SURVEY_LINK' AND tenant_id = 5;

-- ============================================================
-- 3. INTERNAL LIST VALUES for ACCRUAL_TYPE
-- ============================================================

INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order, is_active)
SELECT molecule_id, code, label, ord, true
FROM molecule_def,
(VALUES
  ('SURVEY', 'Survey',     1),
  ('COMP',   'Compliance', 2),
  ('EVENT',  'Event Report', 3),
  ('OPS',    'Operational Strain', 4),
  ('WEAR',   'Wearable',   5),
  ('PULSE',  'Stability Pulse', 6)
) AS v(code, label, ord)
WHERE molecule_key = 'ACCRUAL_TYPE' AND tenant_id = 5;

-- ============================================================
-- 4. COMPOSITE for type 'A' (Healthcare Accrual)
-- ============================================================

-- Get the molecule_ids we need
DO $$
DECLARE
  v_accrual_type_id SMALLINT;
  v_survey_link_id SMALLINT;
  v_member_points_id SMALLINT;
  v_composite_link SMALLINT;
  v_detail_link SMALLINT;
  v_template_id INTEGER;
  v_line_id INTEGER;
BEGIN
  SELECT molecule_id INTO v_accrual_type_id
  FROM molecule_def WHERE molecule_key = 'ACCRUAL_TYPE' AND tenant_id = 5;

  SELECT molecule_id INTO v_survey_link_id
  FROM molecule_def WHERE molecule_key = 'MEMBER_SURVEY_LINK' AND tenant_id = 5;

  SELECT molecule_id INTO v_member_points_id
  FROM molecule_def WHERE molecule_key = 'MEMBER_POINTS' AND tenant_id = 5;

  -- Get next composite link from link_tank
  -- Check if tenant 5 has a composite link_tank entry
  IF NOT EXISTS (SELECT 1 FROM link_tank WHERE table_key = 'composite' AND tenant_id = 5) THEN
    INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link) VALUES (5, 'composite', 2, -32767);
  END IF;

  UPDATE link_tank SET next_link = next_link + 1
  WHERE table_key = 'composite' AND tenant_id = 5
  RETURNING next_link - 1 INTO v_composite_link;

  -- Create composite for type 'A'
  INSERT INTO composite (link, tenant_id, composite_type, description, validate_function, point_type_molecule_id)
  VALUES (v_composite_link, 5, 'A', 'Healthcare Accrual', NULL, NULL);

  -- Composite details
  -- Check if tenant 5 has a composite_detail link_tank entry
  IF NOT EXISTS (SELECT 1 FROM link_tank WHERE table_key = 'composite_detail' AND tenant_id = 5) THEN
    INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link) VALUES (5, 'composite_detail', 2, -32767);
  END IF;

  -- Detail 1: ACCRUAL_TYPE (required)
  UPDATE link_tank SET next_link = next_link + 1
  WHERE table_key = 'composite_detail' AND tenant_id = 5
  RETURNING next_link - 1 INTO v_detail_link;
  INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
  VALUES (v_detail_link, v_composite_link, v_accrual_type_id, true, false, NULL, 1);

  -- Detail 2: MEMBER_SURVEY_LINK (optional)
  UPDATE link_tank SET next_link = next_link + 1
  WHERE table_key = 'composite_detail' AND tenant_id = 5
  RETURNING next_link - 1 INTO v_detail_link;
  INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
  VALUES (v_detail_link, v_composite_link, v_survey_link_id, false, false, NULL, 2);

  -- Detail 3: MEMBER_POINTS (required, system)
  UPDATE link_tank SET next_link = next_link + 1
  WHERE table_key = 'composite_detail' AND tenant_id = 5
  RETURNING next_link - 1 INTO v_detail_link;
  INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
  VALUES (v_detail_link, v_composite_link, v_member_points_id, true, false, NULL, 100);

  -- ============================================================
  -- 5. DISPLAY TEMPLATES
  -- ============================================================

  -- Efficient display template
  INSERT INTO display_template (tenant_id, template_name, template_type, is_active, activity_type)
  VALUES (5, 'Healthcare Activity Efficient', 'E', true, 'A')
  RETURNING template_id INTO v_template_id;

  INSERT INTO display_template_line (template_id, line_number, template_string)
  VALUES (v_template_id, 10, '[M,ACCRUAL_TYPE,"Description"]');

  -- Verbose display template
  INSERT INTO display_template (tenant_id, template_name, template_type, is_active, activity_type)
  VALUES (5, 'Healthcare Activity Verbose', 'V', true, 'A')
  RETURNING template_id INTO v_template_id;

  INSERT INTO display_template_line (template_id, line_number, template_string)
  VALUES (v_template_id, 10, '[T,"Type: "],[M,ACCRUAL_TYPE,"Both"]');

  -- ============================================================
  -- 6. INPUT TEMPLATE
  -- ============================================================

  INSERT INTO input_template (tenant_id, template_name, activity_type, is_active)
  VALUES (5, 'Healthcare Accrual Entry', 'A', true)
  RETURNING template_id INTO v_template_id;

  -- Row 1: Accrual Type (required)
  INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, system_generated, is_required, display_label, sort_order, composite_link)
  VALUES (v_template_id, 10, 'ACCRUAL_TYPE', 1, 50, 10, 'Y', NULL, true, 'Accrual Type', 1, NULL);

  -- Row 1: Member Survey Link (optional)
  INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, system_generated, is_required, display_label, sort_order, composite_link)
  VALUES (v_template_id, 10, 'MEMBER_SURVEY_LINK', 51, 50, 10, 'Y', NULL, false, 'Survey Ref', 2, NULL);

  RAISE NOTICE 'Wisconsin PHP accrual setup complete:';
  RAISE NOTICE '  ACCRUAL_TYPE molecule_id: %', v_accrual_type_id;
  RAISE NOTICE '  MEMBER_SURVEY_LINK molecule_id: %', v_survey_link_id;
  RAISE NOTICE '  MEMBER_POINTS molecule_id: %', v_member_points_id;
  RAISE NOTICE '  Composite link: %', v_composite_link;
END $$;

COMMIT;
