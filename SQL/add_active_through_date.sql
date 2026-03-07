-- ============================================================
-- ADD active_through_date TO MEMBER TABLE
-- Session 71 - 2026-02-21
-- ============================================================

-- 1. Add column to member table (Bill-epoch smallint, consistent with enroll_date)
ALTER TABLE member ADD COLUMN IF NOT EXISTS active_through_date SMALLINT;

-- 2. Add sysparm for active_through_months (default 18) for each active tenant
-- sysparm_id 36-39, detail_id 256-259

INSERT INTO sysparm (sysparm_id, tenant_id, sysparm_key, value_type, description) VALUES
  (36, 1, 'active_through_months', 'numeric', 'Months to extend active_through_date on activity (default 18)'),
  (37, 2, 'active_through_months', 'numeric', 'Months to extend active_through_date on activity (default 18)'),
  (38, 3, 'active_through_months', 'numeric', 'Months to extend active_through_date on activity (default 18)'),
  (39, 4, 'active_through_months', 'numeric', 'Months to extend active_through_date on activity (default 18)')
ON CONFLICT DO NOTHING;

INSERT INTO sysparm_detail (detail_id, sysparm_id, category, code, value, sort_order) VALUES
  (256, 36, NULL, NULL, '18', 0),
  (257, 37, NULL, NULL, '18', 0),
  (258, 38, NULL, NULL, '18', 0),
  (259, 39, NULL, NULL, '18', 0)
ON CONFLICT DO NOTHING;

-- Update sequences
SELECT setval('sysparm_sysparm_id_seq', 39);
SELECT setval('sysparm_detail_detail_id_seq', 259);

