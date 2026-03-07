-- Fix activity_type_label for Delta and Marriott

-- Delta: change 'Nights' to 'Flight'
UPDATE sysparm_detail sd
SET value = 'Flight'
FROM sysparm s
WHERE sd.sysparm_id = s.sysparm_id
  AND s.tenant_id = 1 
  AND s.sysparm_key = 'activity_type_label';

-- Marriott: change category/code from 'default' to NULL (API expects NULL)
UPDATE sysparm_detail sd
SET category = NULL, code = NULL
FROM sysparm s
WHERE sd.sysparm_id = s.sysparm_id
  AND s.tenant_id = 3 
  AND s.sysparm_key = 'activity_type_label';

-- Verify
SELECT s.tenant_id, s.sysparm_key, sd.category, sd.code, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.sysparm_key = 'activity_type_label'
ORDER BY s.tenant_id;
