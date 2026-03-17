-- ============================================================
-- MEMBER COMPLIANCE ASSIGNMENTS — 8 Demo Physicians
-- Session 82 — March 9, 2026
-- Realistic mix: not all physicians have all items
-- ============================================================

-- Get compliance_item_ids into variables via subqueries
-- 1=DRUG_TEST_COMP, 2=DRUG_TEST_RESULT, 3=CHECKIN, 4=APPOINTMENT, 5=PROGRAM_STATUS, 6=MONITORING_ENG

-- Dr. James Okafor (#34) — Substance use monitoring, full compliance
-- All 6 items, drug testing weekly, rest monthly
INSERT INTO member_compliance (member_link, compliance_item_id, cadence, tenant_id) VALUES
((SELECT link FROM member WHERE membership_number = '34' AND tenant_id = 5), 1, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '34' AND tenant_id = 5), 2, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '34' AND tenant_id = 5), 3, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '34' AND tenant_id = 5), 4, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '34' AND tenant_id = 5), 5, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '34' AND tenant_id = 5), 6, 'weekly', 5);

-- Dr. Sarah Chen (#35) — Behavioral health, no substance use
-- No drug testing, 4 items
INSERT INTO member_compliance (member_link, compliance_item_id, cadence, tenant_id) VALUES
((SELECT link FROM member WHERE membership_number = '35' AND tenant_id = 5), 3, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '35' AND tenant_id = 5), 4, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '35' AND tenant_id = 5), 5, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '35' AND tenant_id = 5), 6, 'weekly', 5);

-- Dr. Marcus Reed (#36) — Substance use monitoring, full compliance
-- All 6 items, drug testing monthly (later in program)
INSERT INTO member_compliance (member_link, compliance_item_id, cadence, tenant_id) VALUES
((SELECT link FROM member WHERE membership_number = '36' AND tenant_id = 5), 1, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '36' AND tenant_id = 5), 2, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '36' AND tenant_id = 5), 3, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '36' AND tenant_id = 5), 4, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '36' AND tenant_id = 5), 5, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '36' AND tenant_id = 5), 6, 'weekly', 5);

-- Dr. Patricia Walsh (#37) — Behavioral health, no substance use
-- No drug testing, 4 items
INSERT INTO member_compliance (member_link, compliance_item_id, cadence, tenant_id) VALUES
((SELECT link FROM member WHERE membership_number = '37' AND tenant_id = 5), 3, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '37' AND tenant_id = 5), 4, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '37' AND tenant_id = 5), 5, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '37' AND tenant_id = 5), 6, 'weekly', 5);

-- Dr. David Nguyen (#38) — Substance use monitoring, full compliance
-- All 6 items, drug testing weekly
INSERT INTO member_compliance (member_link, compliance_item_id, cadence, tenant_id) VALUES
((SELECT link FROM member WHERE membership_number = '38' AND tenant_id = 5), 1, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '38' AND tenant_id = 5), 2, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '38' AND tenant_id = 5), 3, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '38' AND tenant_id = 5), 4, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '38' AND tenant_id = 5), 5, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '38' AND tenant_id = 5), 6, 'weekly', 5);

-- Dr. Elena Vasquez (#39) — Early in program, substance use
-- All 6 items, drug testing weekly
INSERT INTO member_compliance (member_link, compliance_item_id, cadence, tenant_id) VALUES
((SELECT link FROM member WHERE membership_number = '39' AND tenant_id = 5), 1, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '39' AND tenant_id = 5), 2, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '39' AND tenant_id = 5), 3, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '39' AND tenant_id = 5), 4, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '39' AND tenant_id = 5), 5, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '39' AND tenant_id = 5), 6, 'weekly', 5);

-- Dr. Robert Holmberg (#40) — Behavioral health only
-- No drug testing, 4 items
INSERT INTO member_compliance (member_link, compliance_item_id, cadence, tenant_id) VALUES
((SELECT link FROM member WHERE membership_number = '40' AND tenant_id = 5), 3, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '40' AND tenant_id = 5), 4, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '40' AND tenant_id = 5), 5, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '40' AND tenant_id = 5), 6, 'weekly', 5);

-- Dr. Michelle Ostrowski (#41) — Substance use, later in program
-- All 6 items, drug testing monthly
INSERT INTO member_compliance (member_link, compliance_item_id, cadence, tenant_id) VALUES
((SELECT link FROM member WHERE membership_number = '41' AND tenant_id = 5), 1, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '41' AND tenant_id = 5), 2, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '41' AND tenant_id = 5), 3, 'weekly', 5),
((SELECT link FROM member WHERE membership_number = '41' AND tenant_id = 5), 4, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '41' AND tenant_id = 5), 5, 'monthly', 5),
((SELECT link FROM member WHERE membership_number = '41' AND tenant_id = 5), 6, 'weekly', 5);

-- Verify
SELECT m.fname || ' ' || m.lname AS physician, m.membership_number,
       ci.item_code, mc.cadence,
       COUNT(*) OVER (PARTITION BY m.membership_number) AS total_items
FROM member_compliance mc
JOIN member m ON m.link = mc.member_link
JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
ORDER BY m.membership_number, ci.compliance_item_id;
