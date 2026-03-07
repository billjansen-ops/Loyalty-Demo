-- ============================================================
-- SEED active_through_date FOR EXISTING MEMBERS
-- Logic: date of first activity + 18 months
--        if no activity: random date within past 2 years
-- Session 71 - 2026-02-21
-- Bill-epoch: days since 1959-12-03, stored as days - 32768
-- ============================================================

-- Today in Bill-epoch for reference:
-- SELECT (CURRENT_DATE - DATE '1959-12-03') - 32768

-- Seed from first activity date + 18 months where activity exists
UPDATE member m
SET active_through_date = (
  SELECT (
    (DATE '1959-12-03' + (a.activity_date + 32768) + INTERVAL '18 months')::date
    - DATE '1959-12-03'
  ) - 32768
  FROM activity a
  WHERE a.p_link = m.link
  ORDER BY a.activity_date ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM activity a WHERE a.p_link = m.link
);

-- Seed members with no activity: random date within past 2 years
UPDATE member m
SET active_through_date = (
  (CURRENT_DATE - (random() * 730)::int) - DATE '1959-12-03' - 32768
)
WHERE active_through_date IS NULL;

-- Verify
SELECT 
  t.name AS tenant,
  COUNT(*) AS total_members,
  COUNT(active_through_date) AS seeded,
  COUNT(CASE WHEN (DATE '1959-12-03' + (active_through_date + 32768)) >= CURRENT_DATE THEN 1 END) AS active,
  COUNT(CASE WHEN (DATE '1959-12-03' + (active_through_date + 32768)) < CURRENT_DATE THEN 1 END) AS inactive
FROM member m
JOIN tenant t ON t.tenant_id = m.tenant_id
GROUP BY t.name
ORDER BY t.name;

