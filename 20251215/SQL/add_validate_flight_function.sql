-- Add data_edit_function setting for Flight (A) activities
-- This enables validateFlightActivity to run before saving flights
-- Run against: loyalty, loyaltytest, loyaltybackup

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT 
    s.sysparm_id,
    'A',
    'data_edit_function',
    'validateFlightActivity',
    1
FROM sysparm s
WHERE s.sysparm_key = 'activity_processing'
  AND s.tenant_id = 1
  AND NOT EXISTS (
    SELECT 1 FROM sysparm_detail sd 
    WHERE sd.sysparm_id = s.sysparm_id 
      AND sd.category = 'A' 
      AND sd.code = 'data_edit_function'
  );

-- Verify
SELECT sd.* 
FROM sysparm_detail sd
JOIN sysparm s ON sd.sysparm_id = s.sysparm_id
WHERE s.sysparm_key = 'activity_processing'
  AND sd.category = 'A'
ORDER BY sd.code;
