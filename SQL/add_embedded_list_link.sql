-- Add link column to molecule_value_embedded_list
ALTER TABLE molecule_value_embedded_list ADD COLUMN IF NOT EXISTS link character(1);

-- Populate link from existing code values (for backward compatibility)
UPDATE molecule_value_embedded_list 
SET link = LEFT(code, 1)
WHERE link IS NULL;

-- Add E006 error message
INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, 'E006', NULL, 'Maximum values (127) reached for this category', 6
FROM sysparm WHERE sysparm_key = 'error_messages' AND tenant_id = 1
ON CONFLICT DO NOTHING;

-- Verify
SELECT molecule_id, category, link, code, description 
FROM molecule_value_embedded_list 
ORDER BY molecule_id, category, sort_order
LIMIT 20;
