-- Add Partner (P) activity type to activity_display molecule
-- Based on existing pattern from A and R categories

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'P',
  'label',
  'Partner',
  1,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'P',
  'icon',
  '🤝',
  2,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'P',
  'color',
  '#0891b2',
  3,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'P',
  'bg_color',
  '#ecfeff',
  4,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'P',
  'border_color',
  '#0891b2',
  5,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'P',
  'show_bonuses',
  'false',
  6,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
SELECT 
  molecule_id,
  1,
  'P',
  'action_verb',
  'Added',
  7,
  true
FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1;

-- Verify
SELECT category, code, description, sort_order
FROM molecule_value_embedded_list
WHERE molecule_id = (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1)
  AND category = 'P'
ORDER BY sort_order;
