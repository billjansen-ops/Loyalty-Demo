-- ============================================================
-- COMPLIANCE SEED DATA — Wisconsin PHP (tenant 5)
-- Session 82 — March 9, 2026
-- ============================================================

-- 6 Compliance Items with Erica's weights
INSERT INTO compliance_item (tenant_id, item_code, item_name, weight) VALUES
(5, 'DRUG_TEST_COMP', 'Drug Test Completion', 0.25),
(5, 'DRUG_TEST_RESULT', 'Drug Test Results', 0.35),
(5, 'CHECKIN', 'Monitoring Check-In', 0.10),
(5, 'APPOINTMENT', 'Appointment Attendance', 0.10),
(5, 'PROGRAM_STATUS', 'Program Status Change', 0.10),
(5, 'MONITORING_ENG', 'Monitoring System Engagement', 0.10);

-- Drug Test Completion statuses
INSERT INTO compliance_item_status (compliance_item_id, status_code, score, is_sentinel, sort_order)
SELECT compliance_item_id, s.status_code, s.score, s.is_sentinel, s.sort_order
FROM compliance_item, (VALUES
  ('COMPLETED', 0, false, 1),
  ('LATE', 2, false, 2),
  ('MISSED', 3, false, 3)
) AS s(status_code, score, is_sentinel, sort_order)
WHERE item_code = 'DRUG_TEST_COMP' AND tenant_id = 5;

-- Drug Test Result statuses
INSERT INTO compliance_item_status (compliance_item_id, status_code, score, is_sentinel, sort_order)
SELECT compliance_item_id, s.status_code, s.score, s.is_sentinel, s.sort_order
FROM compliance_item, (VALUES
  ('NEGATIVE', 0, false, 1),
  ('INCONCLUSIVE', 1, false, 2),
  ('PRELIM_POSITIVE', 2, false, 3),
  ('CONFIRMED_POSITIVE', 3, true, 4),
  ('REFUSED_TAMPERED', 3, true, 5)
) AS s(status_code, score, is_sentinel, sort_order)
WHERE item_code = 'DRUG_TEST_RESULT' AND tenant_id = 5;

-- Monitoring Check-In statuses
INSERT INTO compliance_item_status (compliance_item_id, status_code, score, is_sentinel, sort_order)
SELECT compliance_item_id, s.status_code, s.score, s.is_sentinel, s.sort_order
FROM compliance_item, (VALUES
  ('ON_TIME', 0, false, 1),
  ('DELAYED', 1, false, 2),
  ('MISSED', 2, false, 3),
  ('REPEATED_MISSED', 3, false, 4)
) AS s(status_code, score, is_sentinel, sort_order)
WHERE item_code = 'CHECKIN' AND tenant_id = 5;

-- Appointment Attendance statuses
INSERT INTO compliance_item_status (compliance_item_id, status_code, score, is_sentinel, sort_order)
SELECT compliance_item_id, s.status_code, s.score, s.is_sentinel, s.sort_order
FROM compliance_item, (VALUES
  ('ATTENDED', 0, false, 1),
  ('LATE_CANCEL', 1, false, 2),
  ('MISSED', 2, false, 3),
  ('REPEATED_MISSED', 3, false, 4)
) AS s(status_code, score, is_sentinel, sort_order)
WHERE item_code = 'APPOINTMENT' AND tenant_id = 5;

-- Program Status Change statuses
INSERT INTO compliance_item_status (compliance_item_id, status_code, score, is_sentinel, sort_order)
SELECT compliance_item_id, s.status_code, s.score, s.is_sentinel, s.sort_order
FROM compliance_item, (VALUES
  ('STABLE', 0, false, 1),
  ('ADMIN_REVIEW', 1, false, 2),
  ('MONITORING_ESCALATION', 2, false, 3),
  ('PROBATION_SUSPENSION', 3, true, 4)
) AS s(status_code, score, is_sentinel, sort_order)
WHERE item_code = 'PROGRAM_STATUS' AND tenant_id = 5;

-- Monitoring System Engagement statuses
INSERT INTO compliance_item_status (compliance_item_id, status_code, score, is_sentinel, sort_order)
SELECT compliance_item_id, s.status_code, s.score, s.is_sentinel, s.sort_order
FROM compliance_item, (VALUES
  ('ON_TIME', 0, false, 1),
  ('DELAYED', 1, false, 2),
  ('MISSED', 2, false, 3),
  ('REPEATED_MISSED', 3, false, 4)
) AS s(status_code, score, is_sentinel, sort_order)
WHERE item_code = 'MONITORING_ENG' AND tenant_id = 5;

-- Verify
SELECT ci.item_code, ci.item_name, ci.weight, 
       cis.status_code, cis.score, cis.is_sentinel
FROM compliance_item ci
JOIN compliance_item_status cis ON cis.compliance_item_id = ci.compliance_item_id
WHERE ci.tenant_id = 5
ORDER BY ci.compliance_item_id, cis.sort_order;
