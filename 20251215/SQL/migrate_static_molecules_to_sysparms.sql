-- Migrate Static Molecules to Sysparms
-- Run after sysparm tables are created
-- Skip last_member_number (moves to link_tank per roadmap)

-- First, clear existing activity_display sample data and replace with full molecule data
DELETE FROM sysparm_detail WHERE sysparm_id = 2;

-- Activity Display - full data from molecule_id=20
INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order) VALUES
-- Type A (Base Activity)
(2, 'A', 'label', 'Base Activity', 0),
(2, 'A', 'icon', '✈️', 1),
(2, 'A', 'color', '#059669', 2),
(2, 'A', 'bg_color', '#f0fdf4', 3),
(2, 'A', 'border_color', '#059669', 4),
(2, 'A', 'show_bonuses', 'true', 5),
(2, 'A', 'action_verb', 'Added', 6),
-- Type R (Redemption)
(2, 'R', 'label', 'Redemption', 1),
(2, 'R', 'icon', '🎁', 2),
(2, 'R', 'color', '#dc2626', 3),
(2, 'R', 'bg_color', '#fee2e2', 4),
(2, 'R', 'border_color', '#dc2626', 5),
(2, 'R', 'show_bonuses', 'false', 6),
(2, 'R', 'action_verb', 'Redeemed', 7),
-- Type P (Partner)
(2, 'P', 'label', 'Partner', 1),
(2, 'P', 'icon', '🤝', 2),
(2, 'P', 'color', '#0891b2', 3),
(2, 'P', 'bg_color', '#ecfeff', 4),
(2, 'P', 'border_color', '#0891b2', 5),
(2, 'P', 'show_bonuses', 'false', 6),
(2, 'P', 'action_verb', 'Added', 7),
-- Type J (Adjustment)
(2, 'J', 'label', 'Adjustment', 1),
(2, 'J', 'icon', '⚖️', 2),
(2, 'J', 'color', '#7c3aed', 3),
(2, 'J', 'bg_color', '#faf5ff', 4),
(2, 'J', 'border_color', '#7c3aed', 5),
(2, 'J', 'show_bonuses', 'false', 6),
(2, 'J', 'action_verb', 'Adjusted', 7),
-- Type M (Promotion)
(2, 'M', 'label', 'Promotion', 1),
(2, 'M', 'icon', '🎯', 2),
(2, 'M', 'color', '#f59e0b', 3),
(2, 'M', 'bg_color', '#fef3c7', 4),
(2, 'M', 'border_color', '#f59e0b', 5),
(2, 'M', 'show_bonuses', 'false', 6),
(2, 'M', 'action_verb', 'Awarded', 7),
-- Type N (Bonus - if used)
(2, 'N', 'label', 'Bonus', 1),
(2, 'N', 'icon', '🎁', 2),
(2, 'N', 'color', '#10b981', 3),
(2, 'N', 'bg_color', '#d1fae5', 4),
(2, 'N', 'border_color', '#10b981', 5),
(2, 'N', 'show_bonuses', 'false', 6),
(2, 'N', 'action_verb', 'Awarded', 7);

-- Numeric Scalars
INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description) VALUES
(1, 'retro_days_allowed', 'numeric', 'Number of days back activities can be entered'),
(1, 'max_tier_qualification_days', 'numeric', 'Maximum days to qualify for tier status');

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, NULL, NULL, '999', 0 FROM sysparm WHERE sysparm_key = 'retro_days_allowed' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, NULL, NULL, '365', 0 FROM sysparm WHERE sysparm_key = 'max_tier_qualification_days' AND tenant_id = 1;

-- Text Scalars
INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description) VALUES
(1, 'currency_label', 'text', 'Label used in Platform (plural)'),
(1, 'currency_label_singular', 'text', 'Singular form of points/miles'),
(1, 'activity_type_label', 'text', 'Core unit - Airline = Flight, etc');

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, NULL, NULL, 'Miles', 0 FROM sysparm WHERE sysparm_key = 'currency_label' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, NULL, NULL, 'Mile', 0 FROM sysparm WHERE sysparm_key = 'currency_label_singular' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, NULL, NULL, 'Flight', 0 FROM sysparm WHERE sysparm_key = 'activity_type_label' AND tenant_id = 1;

-- Error Messages
INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description) VALUES
(1, 'error_messages', 'text', 'System error messages');

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'E001', NULL, 'Activity too old', 1 FROM sysparm WHERE sysparm_key = 'error_messages' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'E002', NULL, 'Expiration Rule Not Found', 2 FROM sysparm WHERE sysparm_key = 'error_messages' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'E003', NULL, 'Insufficient {{M,currency_label,value,,L}} for this Redemption', 3 FROM sysparm WHERE sysparm_key = 'error_messages' AND tenant_id = 1;

-- Activity Types (internal list)
INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description) VALUES
(1, 'activity_type', 'text', 'Type of activity: Base, Partner, Adjustment, Redemption, Promotion');

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'A', 'label', 'Base Activity', 1 FROM sysparm WHERE sysparm_key = 'activity_type' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'P', 'label', 'Partner', 2 FROM sysparm WHERE sysparm_key = 'activity_type' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'J', 'label', 'Adjustment', 3 FROM sysparm WHERE sysparm_key = 'activity_type' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'R', 'label', 'Redemption', 4 FROM sysparm WHERE sysparm_key = 'activity_type' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'M', 'label', 'Promotion', 5 FROM sysparm WHERE sysparm_key = 'activity_type' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'N', 'label', 'Bonus', 6 FROM sysparm WHERE sysparm_key = 'activity_type' AND tenant_id = 1;

-- State List (US States)
INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description) VALUES
(1, 'state', 'text', 'US states and territories');

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT s.sysparm_id, code, NULL, label, ord FROM sysparm s,
(VALUES 
  ('AL', 'Alabama', 1), ('AK', 'Alaska', 2), ('AZ', 'Arizona', 3), ('AR', 'Arkansas', 4),
  ('CA', 'California', 5), ('CO', 'Colorado', 6), ('CT', 'Connecticut', 7), ('DE', 'Delaware', 8),
  ('DC', 'District of Columbia', 9), ('FL', 'Florida', 10), ('GA', 'Georgia', 11), ('HI', 'Hawaii', 12),
  ('ID', 'Idaho', 13), ('IL', 'Illinois', 14), ('IN', 'Indiana', 15), ('IA', 'Iowa', 16),
  ('KS', 'Kansas', 17), ('KY', 'Kentucky', 18), ('LA', 'Louisiana', 19), ('ME', 'Maine', 20),
  ('MD', 'Maryland', 21), ('MA', 'Massachusetts', 22), ('MI', 'Michigan', 23), ('MN', 'Minnesota', 24),
  ('MS', 'Mississippi', 25), ('MO', 'Missouri', 26), ('MT', 'Montana', 27), ('NE', 'Nebraska', 28),
  ('NV', 'Nevada', 29), ('NH', 'New Hampshire', 30), ('NJ', 'New Jersey', 31), ('NM', 'New Mexico', 32),
  ('NY', 'New York', 33), ('NC', 'North Carolina', 34), ('ND', 'North Dakota', 35), ('OH', 'Ohio', 36),
  ('OK', 'Oklahoma', 37), ('OR', 'Oregon', 38), ('PA', 'Pennsylvania', 39), ('RI', 'Rhode Island', 40),
  ('SC', 'South Carolina', 41), ('SD', 'South Dakota', 42), ('TN', 'Tennessee', 43), ('TX', 'Texas', 44),
  ('UT', 'Utah', 45), ('VT', 'Vermont', 46), ('VA', 'Virginia', 47), ('WA', 'Washington', 48),
  ('WV', 'West Virginia', 49), ('WI', 'Wisconsin', 50), ('WY', 'Wyoming', 51)
) AS states(code, label, ord)
WHERE s.sysparm_key = 'state' AND s.tenant_id = 1;

-- Verify
SELECT s.sysparm_key, s.value_type, COUNT(sd.detail_id) as detail_count
FROM sysparm s
LEFT JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.tenant_id = 1
GROUP BY s.sysparm_id, s.sysparm_key, s.value_type
ORDER BY s.sysparm_key;
