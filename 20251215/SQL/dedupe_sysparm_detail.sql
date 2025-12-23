-- Remove duplicate rows from sysparm_detail
-- Keeps the row with the lowest detail_id for each unique (sysparm_id, category, code)

DELETE FROM sysparm_detail
WHERE detail_id NOT IN (
  SELECT MIN(detail_id)
  FROM sysparm_detail
  GROUP BY sysparm_id, category, code
);

-- Verify
SELECT s.sysparm_key, sd.category, sd.code, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.sysparm_key = 'activity_processing' AND s.tenant_id = 1
ORDER BY sd.category, sd.sort_order;
