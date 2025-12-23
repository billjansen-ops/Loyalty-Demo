-- Setup activity_processing sysparm for activity type processing configuration
-- This controls validation functions, points calculation mode, and calc functions per activity type

-- Create the parent sysparm
INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
VALUES (1, 'activity_processing', 'text', 'Activity type processing configuration: validation functions, points mode, calc functions')
ON CONFLICT (tenant_id, sysparm_key) DO NOTHING;

-- Activity Type 'A' (Base/Flight) - system calculated points
INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'A', 'data_edit_function', 'validateRetroDate', 1 
FROM sysparm WHERE sysparm_key = 'activity_processing' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'A', 'points_mode', 'calculated', 2 
FROM sysparm WHERE sysparm_key = 'activity_processing' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'A', 'calc_function', 'calculateFlightMiles', 3 
FROM sysparm WHERE sysparm_key = 'activity_processing' AND tenant_id = 1;

-- Activity Type 'P' (Partner) - manual points entry
INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'P', 'data_edit_function', 'validateRetroDate', 1 
FROM sysparm WHERE sysparm_key = 'activity_processing' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'P', 'points_mode', 'manual', 2 
FROM sysparm WHERE sysparm_key = 'activity_processing' AND tenant_id = 1;

-- Activity Type 'J' (Adjustment) - manual points entry
INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'J', 'data_edit_function', '', 1 
FROM sysparm WHERE sysparm_key = 'activity_processing' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'J', 'points_mode', 'manual', 2 
FROM sysparm WHERE sysparm_key = 'activity_processing' AND tenant_id = 1;

-- Activity Type 'R' (Redemption) - manual points entry (negative)
INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'R', 'data_edit_function', '', 1 
FROM sysparm WHERE sysparm_key = 'activity_processing' AND tenant_id = 1;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'R', 'points_mode', 'manual', 2 
FROM sysparm WHERE sysparm_key = 'activity_processing' AND tenant_id = 1;

-- Verify
SELECT s.sysparm_key, sd.category, sd.code, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.sysparm_key = 'activity_processing' AND s.tenant_id = 1
ORDER BY sd.category, sd.sort_order;
