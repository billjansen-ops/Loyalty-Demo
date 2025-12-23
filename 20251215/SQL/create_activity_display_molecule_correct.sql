-- Create activity_display molecule for display configuration
-- Uses embedded_list with JSON stored in description field

-- Step 1: Delete existing if present (from failed attempts)
DELETE FROM molecule_value_embedded_list 
WHERE molecule_id = (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1);

DELETE FROM molecule_def 
WHERE molecule_key = 'activity_display' AND tenant_id = 1;

-- Step 2: Create molecule definition
INSERT INTO molecule_def (
  tenant_id,
  molecule_key,
  label,
  value_kind,
  context
) VALUES (
  1,
  'activity_display',
  'Activity Display Config',
  'embedded_list',
  'activity'
);

-- Step 3: Add embedded list values (one row per activity type)
-- Store display config as JSON in description field

INSERT INTO molecule_value_embedded_list (
  molecule_id,
  tenant_id,
  category,
  code,
  description,
  sort_order
) VALUES
  -- Activity type 'A' (Flight)
  (
    (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1),
    1,
    'display',
    'A',
    '{"label":"Flight","icon":"✈️","color":"#059669","bg_color":"#f0fdf4","border_color":"#059669","show_bonuses":true,"action_verb":"Added"}',
    1
  ),
  -- Activity type 'R' (Redemption)
  (
    (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1),
    1,
    'display',
    'R',
    '{"label":"Redemption","icon":"🎁","color":"#dc2626","bg_color":"#fee2e2","border_color":"#dc2626","show_bonuses":false,"action_verb":"Redeemed"}',
    2
  );

-- Verify
SELECT 
  md.molecule_key,
  md.label,
  md.value_kind,
  mve.category,
  mve.code,
  mve.description
FROM molecule_def md
JOIN molecule_value_embedded_list mve ON md.molecule_id = mve.molecule_id
WHERE md.molecule_key = 'activity_display' AND md.tenant_id = 1
ORDER BY mve.sort_order;
