-- Fix duplicate activity_type_label for Marriott
-- Keep only 'Stay', remove 'Flight'

-- First see what we have
SELECT sd.sysparm_detail_id, s.sysparm_id, s.sysparm_key, sd.category, sd.code, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.tenant_id = 3 AND s.sysparm_key = 'activity_type_label';

-- Delete the 'Flight' entry
DELETE FROM sysparm_detail 
WHERE sysparm_detail_id IN (
  SELECT sd.sysparm_detail_id
  FROM sysparm s
  JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
  WHERE s.tenant_id = 3 
    AND s.sysparm_key = 'activity_type_label'
    AND sd.value = 'Flight'
);

-- Verify fix
SELECT s.tenant_id, s.sysparm_key, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.tenant_id = 3 
  AND s.sysparm_key IN ('activity_type_label', 'currency_label')
ORDER BY s.sysparm_key;
