-- Create activity_display molecule for display configuration
-- Fixed: Use correct column name for embedded list

-- Step 1: Create molecule definition
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

-- Step 2: Add embedded list values with display configuration
INSERT INTO molecule_value_embedded_list (
  molecule_id,
  embed_value
) VALUES (
  (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'activity_display' AND tenant_id = 1),
  '[
    {
      "code": "A",
      "label": "Flight",
      "icon": "✈️",
      "color": "#059669",
      "bg_color": "#f0fdf4",
      "border_color": "#059669",
      "show_bonuses": true,
      "action_verb": "Added"
    },
    {
      "code": "R",
      "label": "Redemption",
      "icon": "🎁",
      "color": "#dc2626",
      "bg_color": "#fee2e2",
      "border_color": "#dc2626",
      "show_bonuses": false,
      "action_verb": "Redeemed"
    }
  ]'::jsonb
);

-- Verify
SELECT 
  md.molecule_key,
  md.label,
  md.value_kind,
  mve.embed_value
FROM molecule_def md
JOIN molecule_value_embedded_list mve ON md.molecule_id = mve.molecule_id
WHERE md.molecule_key = 'activity_display' AND md.tenant_id = 1;
