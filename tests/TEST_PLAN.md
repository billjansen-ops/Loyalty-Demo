# Pointer Platform — Master Test Plan

## Insight Health Solutions / Wisconsin PHP

*Created: April 5, 2026*

---

## CRITICAL (must pass before any demo or pilot)

| # | Test | Page/API | Modifies Data | What to Verify |
|---|------|----------|---------------|----------------|
| C1 | PPSI Survey Entry | clinic.html, POST surveys, PUT answers | YES | 34 questions scored, accrual created, PPSI total correct, any answer >= 3 fires PULSE_Q3 signal + registry item, Section 8 = 3 fires STABILITY_IMMEDIATE, POST_ACCRUAL recalculates PPII |
| C2 | Provider Pulse Entry | clinic.html, POST surveys, POST pulse-respondents, PUT answers | YES | 14 questions scored, pulse_respondent created, accrual created, Q14=3 fires STABILITY_IMMEDIATE (SENTINEL), Q14=2 fires STABILITY_EMERGING (ORANGE), any Q>=3 fires PULSE_Q3 (YELLOW) |
| C3 | Compliance Entry | clinic.html, POST compliance/entry | YES | Score calculated per weight, sentinel statuses (Confirmed Positive, Refused/Tampered, Suspension) trigger SENTINEL registry item, POST_ACCRUAL fires PPII recalc |
| C4 | Event Reporting | clinic.html, POST accruals | YES | Event accrual created, severity 3 triggers SENTINEL registry item via PRE_ACCRUAL, notification fires |
| C5 | Mobile PPSI Check-In | poser_mobile.html, POST surveys, PUT answers | YES | Mobile survey completes, note field triggers PPSI_NOTE_ENTERED notification (critical, all clinical staff), survey_note_review record created |
| C6 | PPSI Notes for Review | physician_detail.html, GET/PATCH survey-note-reviews | YES | Pending notes display, "Reviewed - No Action" marks reviewed, "Create Registry Item" marks escalated + creates registry item |
| C7 | Physician Roster Display | clinic.html, GET wellness/members | NO | All physicians show with correct PPII, tier badge, trend arrow, sparkline, MEDS flags |
| C8 | Registry Item Display | action_queue.html, GET stability-registry | NO | Items sorted by urgency, SLA badges correct, protocol card + extended card badges visible, dominant driver shown |
| C9 | Resolve Registry Item | action_queue.html, PUT stability-registry/:link | YES | Status -> Resolved, follow-ups auto-scheduled (2/4/8wk Yellow/Orange, weekly Red, 48h+weekly SENTINEL), audit trail entry, physician color recalculates |
| C10 | PPII Composite Scoring | custauth POST_ACCRUAL, scorePPII.js | YES | 4-stream weighted composite (PP 35%, PPSI 25%, Comp 25%, Events 15%), threshold crossing creates PPII signal + registry item |
| C11 | Dominant Driver Analysis | custauth POST_ACCRUAL | YES | Stream deltas compared, highest delta = dominant driver, sub-domain identified if PPSI, protocol card auto-assigned |
| C12 | MEDS Scheduled Scan | MEDS job handler | YES | Overdue surveys/compliance detected, consecutive miss escalation (3+ = critical notification), MEDS flags on roster |
| C13 | Notification Rules Engine | fireNotificationEvent() | YES | All 12 rules fire correctly, role fan-out works, timing offsets (missed survey 24h/48h), severity levels correct |
| C14 | Signal/Promotion/Registry Pipeline | Full chain | YES | Signal molecule -> promotion match -> external reward -> createRegistryItem -> registry INSERT with urgency, driver, card, follow-ups, notifications |
| C15 | Login + Auth Middleware | login.html, POST auth/login | YES | Valid credentials = session, invalid = error, all protected endpoints return 401 without session |

## HIGH

| # | Test | Page/API | Modifies Data | What to Verify |
|---|------|----------|---------------|----------------|
| H1 | MEDS Dashboard Summary | dashboard.html, GET meds/summary | NO | Overdue physicians shown with item pills, days overdue, click navigates to physician detail |
| H2 | Partner/Clinic Select Modal | dashboard.html, GET partners, GET programs | NO | Modal opens, partners load, clinics load, selection navigates with correct context |
| H3 | Clinician Assignments | clinic.html Clinicians tab, POST/DELETE clinicians | YES | Assign/unassign physicians to clinicians, molecule updates, caseload counts correct |
| H4 | Notification Bell | clinic.html + other pages, GET notifications | YES (mark read) | Unread count, critical animation, click navigates, mark all read clears badge |
| H5 | Summary Strip | physician_detail.html | NO | PPII score, tier badge, trend, last PPSI/Pulse dates, compliance score, MEDS flags all correct |
| H6 | Activity Timeline | physician_detail.html, GET activities | NO | All activity types display, click opens detail modal with question-by-question scores |
| H7 | Report Event from Detail | physician_detail.html | YES | Event modal opens, submission creates accrual, same triggers as C4 |
| H8 | Follow-Up Queue | action_queue.html Follow-ups tab, GET registry-followups | NO | Pending follow-ups shown, overdue highlighted, tab badge shows overdue count |
| H9 | Follow-Up Outcome Capture | action_queue.html, PATCH registry-followups/:id | YES | Outcome recorded (improving/stable/declining/escalated), notes saved, completed timestamp set |
| H10 | Protocol Card Badge Click | action_queue.html + physician_detail.html, GET protocol-cards/:id | NO | Full protocol card detail modal with steps, timelines, assignment, success metrics, escalation triggers |
| H11 | Physician Portal Flows | physician_portal.html | YES | Lookup by name/number/caseload, weekly check-in, report event, add annotation, open mobile app |
| H12 | Compliance Member Page | compliance_member.html, GET compliance/member/:id | NO | Summary cards with latest result, cadence badge, history table, score chips |
| H13 | Compliance Item Assignment | compliance_member.html, POST/DELETE assign | YES | Assign creates member_compliance with default cadence, unassign removes |
| H14 | Compliance Rules Admin | compliance_rules.html, GET/POST/PUT compliance/items | YES | CRUD on 6 compliance items, weights, statuses, default cadence persist |
| H15 | Physician Roster + Enrollment | physician_management.html, POST member | YES | Roster displays, enroll creates member with program assignment + default compliance items |
| H16 | Notification Queue Display | notification_queue.html, GET notification-deliveries | NO | All deliveries shown with status/channel/severity, filter chips work, counts correct |
| H17 | Delivery Configuration | notification_queue.html, GET/PUT delivery-config | YES | Config displays (timezone, window, digest hour, channel toggles), edits persist |
| H18 | Reopen Registry Item | registry_history.html, PUT stability-registry/:link | YES | Item reopens, audit trail entry, physician color recalculates |
| H19 | Extended Card Detection | extendedCardDetector.js via POST_ACCRUAL | YES | M1-M3, T1-T4, D2-D3 patterns detected, priority ordering correct, T2/T4 auto-elevate to ORANGE |
| H20 | F1/T5 Batch Detection | F1_T5 scheduled job | YES | T5: Yellow 12+ weeks, F1: declining/escalated follow-up, registry items created with extended cards |
| H21 | Pattern-Based Triggers | custauth POST_ACCRUAL | YES | PPII_TREND_UP, PPII_SPIKE, PROTECTIVE_COLLAPSE detected, configurable thresholds, YELLOW registry items created |
| H22 | Notification Delivery System | NOTIFY_DELIVER + NOTIFY_DIGEST jobs | YES | Pending deliveries processed, delivery window enforced, daily digest batches routine notifications |
| H23 | Scheduled Job Management | GET/POST scheduled jobs | YES | List jobs, run manually, view logs, enable/disable |
| H24 | Tenant Selection | POST auth/tenant | YES | Switch tenant, session updated, data isolation verified |

## MEDIUM

| # | Test | Page/API | Modifies Data |
|---|------|----------|---------------|
| M1 | Clinics Table | dashboard.html | NO |
| M2 | Clinician Caseloads Table | dashboard.html | NO |
| M3 | Tier/Clinician Filters | clinic.html | NO |
| M4 | Physician Annotations | physician_detail.html + physician_portal.html | YES |
| M5 | Clinician Display | physician_detail.html | NO |
| M6 | Affiliation Chips | physician_detail.html | NO |
| M7 | ML Predictive Risk Card | physician_detail.html, GET ml/member/:id | NO |
| M8 | Urgency/Caseload Filters | action_queue.html | NO |
| M9 | CSV Export (registry/roster/followups/compliance) | GET export/:report | NO |
| M10 | Protocol Card Reference Library | protocol_cards.html, GET protocol-cards | NO |
| M11 | Physician Annotation Entry | physician_portal.html, POST physician-annotations | YES |
| M12 | Mobile Event + Notifications | poser_mobile.html | YES |
| M13 | Cadence Override | compliance_member.html, PUT cadence | YES |
| M14 | Affiliations Admin | affiliations page | YES |
| M15 | Channel/Severity Filters | notification_queue.html | NO |
| M16 | Registry Audit Trail Display | registry_history.html, GET audit-history | NO |
| M17 | ML Prediction + Batch | GET/POST ml endpoints | YES |
| M18 | Usage Logging | POST/GET usage-log | YES |
| M19 | Anchor Battery Instruments | Survey system endpoints | YES |

## LOW

| # | Test | What |
|---|------|------|
| L1 | Navigation Card Rendering | dashboard.html nav cards display correctly |
| L2 | ML Service Banner | Yellow warning when ML down |
| L3 | Affiliation Chips Display | Chips render on physician detail |
| L4 | Compliance Navigation Link | physician_management.html link |
| L5 | Settings Page Navigation | admin_settings.html cards render |
| L6 | ML Health/Diagnostic | GET ml/health, GET ml/diagnostic |

## KNOWN UNTESTED AREAS (from Build Notes)

1. PPII composite end-to-end — needs 4-stream data to cross thresholds (35/55/75)
2. PPII composite triggers (PPII_RED, PPII_ORANGE, PPII_YELLOW) — wired, untested
3. POST_ACCRUAL hook — needs verification it fires after survey and compliance COMMIT
4. PPSI sentinel end-to-end — scoring wired, needs full chain test
5. ppii_current ML feature — currently copies ppsi_current, should use actual composite
6. Survey portal return bug — may be fixed, needs verification

## Test File Mapping

| Test File | Covers |
|-----------|--------|
| tests/insight/test_login_search.cjs | C15 (partial), basic API plumbing |
| *remaining tests to be built* | |

---

*This is a living document. Updated as tests are written and features are added.*
