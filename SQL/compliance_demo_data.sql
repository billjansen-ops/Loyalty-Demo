-- ============================================================
-- COMPLIANCE DEMO DATA — Realistic history for 8 physicians
-- Session 82 — March 9, 2026
-- Uses POST /v1/compliance/entry via curl commands
-- ============================================================

-- Dr. James Okafor (#34) — substance use, full compliance, mostly clean
-- Drug tests weekly, all items active
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"34","member_compliance_id":1,"status_id":1}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"34","member_compliance_id":2,"status_id":4}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"34","member_compliance_id":3,"status_id":9}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"34","member_compliance_id":4,"status_id":13}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"34","member_compliance_id":5,"status_id":24}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"34","member_compliance_id":6,"status_id":20}' > /dev/null

-- Dr. Sarah Chen (#35) — behavioral health, no drug tests, mostly compliant
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"35","member_compliance_id":7,"status_id":9}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"35","member_compliance_id":8,"status_id":13}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"35","member_compliance_id":9,"status_id":24}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"35","member_compliance_id":10,"status_id":20}' > /dev/null

-- Dr. Marcus Reed (#36) — substance use, monthly testing, one late test
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"36","member_compliance_id":11,"status_id":2,"notes":"Test submitted 2 days late"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"36","member_compliance_id":12,"status_id":4}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"36","member_compliance_id":13,"status_id":10,"notes":"Checked in 4 hours late"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"36","member_compliance_id":14,"status_id":13}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"36","member_compliance_id":15,"status_id":24}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"36","member_compliance_id":16,"status_id":20}' > /dev/null

-- Dr. Patricia Walsh (#37) — behavioral health, missed an appointment
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"37","member_compliance_id":17,"status_id":9}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"37","member_compliance_id":18,"status_id":15,"notes":"No-show for therapy session"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"37","member_compliance_id":19,"status_id":24}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"37","member_compliance_id":20,"status_id":21,"notes":"Late engagement with monitoring system"}' > /dev/null

-- Dr. David Nguyen (#38) — substance use, confirmed positive (SENTINEL)
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"38","member_compliance_id":21,"status_id":1}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"38","member_compliance_id":22,"status_id":7,"notes":"Confirmed positive — immediate escalation required"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"38","member_compliance_id":23,"status_id":11,"notes":"Missed weekly check-in"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"38","member_compliance_id":24,"status_id":15}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"38","member_compliance_id":25,"status_id":26,"notes":"Escalated to enhanced monitoring"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"38","member_compliance_id":26,"status_id":22}' > /dev/null

-- Dr. Elena Vasquez (#39) — substance use, early program, doing well
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"39","member_compliance_id":27,"status_id":1}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"39","member_compliance_id":28,"status_id":4}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"39","member_compliance_id":29,"status_id":9}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"39","member_compliance_id":30,"status_id":13}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"39","member_compliance_id":31,"status_id":24}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"39","member_compliance_id":32,"status_id":20}' > /dev/null

-- Dr. Robert Holmberg (#40) — behavioral health, repeated missed check-ins
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"40","member_compliance_id":33,"status_id":12,"notes":"Third consecutive missed check-in"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"40","member_compliance_id":34,"status_id":14,"notes":"Cancelled therapy 2 hours before"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"40","member_compliance_id":35,"status_id":24}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"40","member_compliance_id":36,"status_id":22,"notes":"Missed monitoring engagement"}' > /dev/null

-- Dr. Michelle Ostrowski (#41) — substance use, monthly testing, inconclusive result
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"41","member_compliance_id":37,"status_id":1}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"41","member_compliance_id":38,"status_id":5,"notes":"Dilute sample — retest scheduled"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"41","member_compliance_id":39,"status_id":9}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"41","member_compliance_id":40,"status_id":13}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"41","member_compliance_id":41,"status_id":25,"notes":"Under administrative review"}' > /dev/null
\! curl -s -X POST "http://127.0.0.1:4001/v1/compliance/entry" -H "Content-Type: application/json" -d '{"tenant_id":5,"membership_number":"41","member_compliance_id":42,"status_id":20}' > /dev/null

SELECT 'Compliance demo data loaded: ' || count(*) || ' events' FROM compliance_result WHERE tenant_id = 5;
