-- Stability Registry — Demo Seed Data
-- Session 83, March 10, 2026
--
-- Physician stories for the demo:
-- #34 Okafor:    Green — no open items (model physician)
-- #35 Chen:      Green — no open items (behavioral health, doing well)
-- #36 Reed:      Yellow — late drug test, delayed check-in
-- #37 Walsh:     Red — high composite score, missed appointments, trending up
-- #38 Nguyen:    Sentinel — confirmed positive drug test (the dramatic case)
-- #39 Vasquez:   Green — recently resolved Yellow (success story)
-- #40 Holmberg:  Yellow — repeated missed check-ins, disengagement
-- #41 Ostrowski: Orange — inconclusive drug test + elevated composite trending up

DO $$
DECLARE
  v_link INTEGER;
  v_ml CHAR(5);
  v_today SMALLINT := (CURRENT_DATE - DATE '1959-12-03')::SMALLINT - 32768;
  v_yesterday SMALLINT := v_today - 1;
  v_3days SMALLINT := v_today - 3;
  v_5days SMALLINT := v_today - 5;
  v_7days SMALLINT := v_today - 7;
  v_10days SMALLINT := v_today - 10;
  v_14days SMALLINT := v_today - 14;
  v_21days SMALLINT := v_today - 21;
BEGIN

  -- ========== #36 Reed: YELLOW — late drug test, delayed check-in ==========
  SELECT link INTO v_ml FROM member WHERE membership_number = '36' AND tenant_id = 5;

  SELECT nextval('link_tank_seq') INTO v_link;  -- will use getNextLink pattern
  -- Use raw link_tank
  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'YELLOW', 'COMP', 'LATE_DRUG_TEST', 'Drug test completed late — 3 days past window', 28, 72, NOW() - INTERVAL '2 days' + INTERVAL '72 hours', v_3days, NOW() - INTERVAL '3 days', 'O');

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'YELLOW', 'COMP', 'DELAYED_CHECKIN', 'Monitoring check-in delayed — 5 days late', 28, 72, NOW() - INTERVAL '1 day' + INTERVAL '72 hours', v_yesterday, NOW() - INTERVAL '1 day', 'O');

  -- ========== #37 Walsh: RED — high score, missed appointments, trend ==========
  SELECT link INTO v_ml FROM member WHERE membership_number = '37' AND tenant_id = 5;

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'RED', 'COMPOSITE', 'PPII_RED', 'PPII composite score 83 — acute risk threshold exceeded', 83, 24, NOW() - INTERVAL '4 hours' + INTERVAL '24 hours', v_today, NOW() - INTERVAL '4 hours', 'O');

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'YELLOW', 'COMP', 'MISSED_APPOINTMENT', 'Missed therapy appointment — second occurrence this month', 71, 72, NOW() - INTERVAL '5 days' + INTERVAL '72 hours', v_5days, NOW() - INTERVAL '5 days', 'O');

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'ORANGE', 'COMPOSITE', 'PPII_TREND_UP', 'PPII upward trend: +14 over 3 weeks (69 → 76 → 83)', 76, 48, NOW() - INTERVAL '7 days' + INTERVAL '48 hours', v_7days, NOW() - INTERVAL '7 days', 'O');

  -- ========== #38 Nguyen: SENTINEL — confirmed positive drug test ==========
  SELECT link INTO v_ml FROM member WHERE membership_number = '38' AND tenant_id = 5;

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'SENTINEL', 'COMP', 'SENTINEL_POSITIVE', 'Confirmed positive drug test — GC/MS confirmed. Immediate program review required.', 14, 0, NOW() - INTERVAL '2 hours', v_today, NOW() - INTERVAL '2 hours', 'O');

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'YELLOW', 'COMP', 'MISSED_CHECKIN', 'Missed monitoring check-in — no contact for 10 days', 14, 72, NOW() - INTERVAL '10 days' + INTERVAL '72 hours', v_10days, NOW() - INTERVAL '10 days', 'O');

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'ORANGE', 'COMP', 'MONITOR_ESCALATION', 'Monitoring status escalated to elevated review', 14, 48, NOW() - INTERVAL '5 days' + INTERVAL '48 hours', v_5days, NOW() - INTERVAL '5 days', 'O');

  -- ========== #39 Vasquez: GREEN — resolved Yellow (success story) ==========
  SELECT link INTO v_ml FROM member WHERE membership_number = '39' AND tenant_id = 5;

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status, assigned_to, assigned_ts, resolved_ts, resolution_code, resolution_notes)
  VALUES (v_link, v_ml, 5, 'YELLOW', 'PPSI', 'PPSI_ELEVATED', 'PPSI survey score elevated — sleep and burnout domains flagged', 38, 72, NOW() - INTERVAL '14 days' + INTERVAL '72 hours', v_14days, NOW() - INTERVAL '14 days',
    (SELECT user_id FROM platform_user WHERE tenant_id = 5 LIMIT 1),
    NOW() - INTERVAL '13 days',
    NOW() - INTERVAL '10 days', 'WORKED', 'Coordinator outreach completed. Physician connected with peer support. Follow-up survey showed improvement. Score returned to Green range.');

  -- ========== #40 Holmberg: YELLOW — missed check-ins, disengagement ==========
  SELECT link INTO v_ml FROM member WHERE membership_number = '40' AND tenant_id = 5;

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'YELLOW', 'COMP', 'REPEATED_MISSED_CHECKINS', 'Third missed monitoring check-in this month — disengagement pattern', 13, 72, NOW() - INTERVAL '2 days' + INTERVAL '72 hours', v_3days, NOW() - INTERVAL '2 days', 'O');

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'YELLOW', 'MEDS', 'MISSED_SURVEY', 'No PPSI survey submitted in 12 days — MEDS detection', 13, 72, NOW() - INTERVAL '1 day' + INTERVAL '72 hours', v_yesterday, NOW() - INTERVAL '1 day', 'O');

  -- ========== #41 Ostrowski: ORANGE — inconclusive drug test + trending up ==========
  SELECT link INTO v_ml FROM member WHERE membership_number = '41' AND tenant_id = 5;

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'ORANGE', 'COMPOSITE', 'PPII_ORANGE', 'PPII composite score 67 — destabilizing threshold', 67, 48, NOW() - INTERVAL '1 day' + INTERVAL '48 hours', v_yesterday, NOW() - INTERVAL '1 day', 'O');

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'YELLOW', 'COMP', 'INCONCLUSIVE_DRUG_TEST', 'Drug test result inconclusive — dilute specimen, retest ordered', 58, 72, NOW() - INTERVAL '5 days' + INTERVAL '72 hours', v_5days, NOW() - INTERVAL '5 days', 'O');

  UPDATE link_tank SET next_id = next_id + 1 WHERE table_name = 'stability_registry' RETURNING next_id - 1 INTO v_link;

  INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
  VALUES (v_link, v_ml, 5, 'YELLOW', 'PULSE', 'PULSE_QUESTION_3', 'Provider Pulse: clinician scored "Significant concern" on mood stability', 58, 72, NOW() - INTERVAL '7 days' + INTERVAL '72 hours', v_7days, NOW() - INTERVAL '7 days', 'O');

  RAISE NOTICE 'Stability Registry demo data seeded successfully';
END $$;
