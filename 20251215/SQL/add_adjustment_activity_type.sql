-- Add Adjustment (J) activity type to activity_display molecule
-- Adjustments are manual corrections, write-offs, or administrative changes

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'J',
  'label',
  'Adjustment',
  1,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'J',
  'icon',
  '⚖️',
  2,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'J',
  'color',
  '#7c3aed',
  3,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'J',
  'bg_color',
  '#faf5ff',
  4,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'J',
  'border_color',
  '#7c3aed',
  5,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'J',
  'show_bonuses',
  'false',
  6,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'J',
  'action_verb',
  'Adjusted',
  7,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

-- Verification
SELECT category, code, description, sort_order
FROM molecule_value_embedded_list
WHERE molecule_id = (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1)
  AND category = 'J'
ORDER BY sort_order;
