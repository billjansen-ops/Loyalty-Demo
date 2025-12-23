-- =====================================================
-- ACTIVITY TYPE CONSOLIDATION
-- Source of Truth: activity_display molecule
-- =====================================================

-- STEP 1: Add missing fields to existing activity types

-- Type A - Base Activity
INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
VALUES 
  (20, 1, 'A', 'label', 'Base Activity', 0, true),
  (20, 1, 'A', 'sort_order', '1', 0, true),
  (20, 1, 'A', 'display_in_activity_list', 'true', 0, true);

-- Type P - Partner Activity (label already exists as 'Partner')
INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
VALUES 
  (20, 1, 'P', 'sort_order', '2', 0, true),
  (20, 1, 'P', 'display_in_activity_list', 'true', 0, true);

-- Type M - Promotion Reward (label already exists as 'Promotion')
INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
VALUES 
  (20, 1, 'M', 'sort_order', '3', 0, true),
  (20, 1, 'M', 'display_in_activity_list', 'true', 0, true);

-- Type R - Redemption (label already exists as 'Redemption')
INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
VALUES 
  (20, 1, 'R', 'sort_order', '4', 0, true),
  (20, 1, 'R', 'display_in_activity_list', 'true', 0, true);

-- Type J - Adjustment (label already exists as 'Adjustment')
INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
VALUES 
  (20, 1, 'J', 'sort_order', '5', 0, true),
  (20, 1, 'J', 'display_in_activity_list', 'true', 0, true);

-- STEP 2: Add new activity type N (Bonus)
INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active)
VALUES 
  (20, 1, 'N', 'label', 'Bonus', 1, true),
  (20, 1, 'N', 'icon', '⭐', 2, true),
  (20, 1, 'N', 'color', '#eab308', 3, true),
  (20, 1, 'N', 'bg_color', '#fef9c3', 4, true),
  (20, 1, 'N', 'border_color', '#eab308', 5, true),
  (20, 1, 'N', 'show_bonuses', 'false', 6, true),
  (20, 1, 'N', 'action_verb', 'Awarded', 7, true),
  (20, 1, 'N', 'sort_order', '6', 0, true),
  (20, 1, 'N', 'display_in_activity_list', 'false', 0, true);

-- STEP 3: Delete duplicate/obsolete data

-- Delete activity_type from sysparm (molecule_id=16)
DELETE FROM molecule_value_embedded_list 
WHERE molecule_id = 16 AND category = 'activity_type';

-- Delete activity_type list molecule values (molecule_id=12)
DELETE FROM molecule_value_text WHERE molecule_id = 12;

-- Deactivate the activity_type molecule definition
UPDATE molecule_def SET is_active = false WHERE molecule_id = 12;

-- STEP 4: Update input_template constraint to include M and N
ALTER TABLE input_template DROP CONSTRAINT IF EXISTS input_template_activity_type_check;
ALTER TABLE input_template ADD CONSTRAINT input_template_activity_type_check 
  CHECK (activity_type = ANY (ARRAY['A'::bpchar, 'R'::bpchar, 'P'::bpchar, 'J'::bpchar, 'M'::bpchar, 'N'::bpchar]));

-- VERIFY:
SELECT category, code, description FROM molecule_value_embedded_list 
WHERE molecule_id = 20 ORDER BY category, code;
