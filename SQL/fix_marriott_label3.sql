-- Recreate activity_type_label for Marriott with value 'Stay'

INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
VALUES (3, 'activity_type_label', 'text', 'Label for primary activity type')
RETURNING sysparm_id;

-- Get the sysparm_id we just created
INSERT INTO sysparm_detail (sysparm_id, category, code, value)
SELECT sysparm_id, 'default', 'default', 'Stay'
FROM sysparm 
WHERE tenant_id = 3 AND sysparm_key = 'activity_type_label';

-- Verify
SELECT s.sysparm_key, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.tenant_id = 3 
  AND s.sysparm_key = 'activity_type_label';
