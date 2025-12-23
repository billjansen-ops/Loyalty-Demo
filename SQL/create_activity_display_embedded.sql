-- Delete old activity_display molecule and create new structure
-- Uses embedded_list with one row per property

-- Step 1: Delete existing molecule
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

-- Step 3: Add properties for category 'A' (Accrual/Flight)
-- NOTE: 'A' does NOT have label - gets it from activity_type_label molecule
INSERT INTO molecule_value_embedded_list (
  molecule_id,
  tenant_id,
  category,
  code,
  description,
  sort_order
) VALUES
  -- Activity type 'A' properties
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'A', 'icon', '✈️', 1),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'A', 'color', '#059669', 2),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'A', 'bg_color', '#f0fdf4', 3),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'A', 'border_color', '#059669', 4),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'A', 'show_bonuses', 'true', 5),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'A', 'action_verb', 'Added', 6),

  -- Activity type 'R' properties (includes label since it's not core activity)
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'R', 'label', 'Redemption', 1),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'R', 'icon', '🎁', 2),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'R', 'color', '#dc2626', 3),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'R', 'bg_color', '#fee2e2', 4),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'R', 'border_color', '#dc2626', 5),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'R', 'show_bonuses', 'false', 6),
  ((SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1), 1, 'R', 'action_verb', 'Redeemed', 7);

-- Verify
SELECT 
  md.molecule_key,
  mve.category,
  mve.code,
  mve.description,
  mve.sort_order
FROM molecule_def md
JOIN molecule_value_embedded_list mve ON md.molecule_id = mve.molecule_id
WHERE md.molecule_key = 'activity_display' AND md.tenant_id = 1
ORDER BY mve.category, mve.sort_order;
