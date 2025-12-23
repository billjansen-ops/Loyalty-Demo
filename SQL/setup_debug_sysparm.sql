-- Create debug sysparm
INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
VALUES (1, 'debug', 'text', 'Debug logging enabled (Y/N)')
ON CONFLICT (tenant_id, sysparm_key) DO NOTHING;

-- Add initial value (default to N)
INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, NULL, NULL, 'N', 0
FROM sysparm WHERE sysparm_key = 'debug' AND tenant_id = 1
ON CONFLICT DO NOTHING;

-- Verify
SELECT s.sysparm_key, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.sysparm_key = 'debug' AND s.tenant_id = 1;
