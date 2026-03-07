-- Diagnose the duplicate activity_type_label issue
-- Show all sysparm and sysparm_detail records

SELECT s.sysparm_id, s.tenant_id, s.sysparm_key, sd.sysparm_detail_id, sd.category, sd.code, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.tenant_id = 3 AND s.sysparm_key = 'activity_type_label'
ORDER BY s.sysparm_id, sd.sysparm_detail_id;

-- If there are two sysparm records, delete the one with 'Flight'
-- First delete the detail, then the sysparm

DELETE FROM sysparm_detail 
WHERE sysparm_id IN (
  SELECT s.sysparm_id
  FROM sysparm s
  JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
  WHERE s.tenant_id = 3 
    AND s.sysparm_key = 'activity_type_label'
    AND sd.value = 'Flight'
);

DELETE FROM sysparm 
WHERE sysparm_id NOT IN (SELECT sysparm_id FROM sysparm_detail)
  AND tenant_id = 3 
  AND sysparm_key = 'activity_type_label';

-- Verify
SELECT s.sysparm_id, s.sysparm_key, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.tenant_id = 3 
  AND s.sysparm_key = 'activity_type_label';
