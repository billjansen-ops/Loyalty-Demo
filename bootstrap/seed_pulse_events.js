#!/usr/bin/env node
/**
 * seed_pulse_events.js — Add Provider Pulse + Event data for PPII composite testing
 * Run from project root: node bootstrap/seed_pulse_events.js [base_url]
 *
 * Adds Provider Pulse assessments and Events to existing physicians
 * so the 4-stream PPII composite can fire end-to-end.
 *
 * Target physicians (already have PPSI + compliance data):
 *   #34 James Okafor   — improving story, give moderate Pulse
 *   #36 Marcus Reed     — trending up, give concerning Pulse
 *   #38 David Nguyen    — sleep issues, give moderate Pulse
 */

const BASE_URL = process.argv[2] || 'http://127.0.0.1:4001';
const TENANT_ID = 5;
const PULSE_SURVEY_LINK = 2;
const PULSE_QUESTION_LINKS = [35,36,37,38,39,40,41,42,43,44,45,46,47,48]; // 14 questions

let sessionCookie = null;

async function api(method, urlPath, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionCookie) headers['Cookie'] = sessionCookie;
  const resp = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  // Capture session cookie from login
  const setCookie = resp.headers.get('set-cookie');
  if (setCookie) sessionCookie = setCookie.split(';')[0];
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `${method} ${urlPath} failed: ${resp.status}`);
  return data;
}

async function login() {
  // Login — pass credentials via environment or command line
  // Usage: SEED_USER=Bill SEED_PASS=mypass node bootstrap/seed_pulse_events.js
  const username = process.env.SEED_USER || 'Claude';
  const password = process.env.SEED_PASS || 'claude123';
  const result = await api('POST', '/v1/auth/login', { username, password });
  console.log(`Logged in as ${result.display_name} (${result.role})\n`);
}

/**
 * Submit a Provider Pulse for a physician.
 * @param {string} membershipNumber - Physician's membership number
 * @param {number[]} answerValues - 14 answer values (0-3)
 * @param {string} respondentName - Clinician name completing the Pulse
 * @param {number} weeksAgo - How many weeks ago this assessment occurred
 */
async function submitPulse(membershipNumber, answerValues, respondentName, weeksAgo) {
  const date = new Date();
  date.setDate(date.getDate() - (weeksAgo * 7));
  const activityDate = date.toISOString().slice(0, 10);

  const answers = PULSE_QUESTION_LINKS.map((qLink, i) => ({
    question_link: qLink,
    answer: answerValues[i] || 0
  }));

  // Create member survey
  const surveyResp = await api('POST', `/v1/members/${membershipNumber}/surveys`, {
    survey_link: PULSE_SURVEY_LINK, tenant_id: TENANT_ID, activity_date: activityDate
  });

  // Create pulse respondent record
  const respondentResp = await api('POST', '/v1/pulse-respondents', {
    member_survey_link: surveyResp.member_survey_link,
    respondent_name: respondentName,
    tenant_id: TENANT_ID
  });

  // Submit answers — include pulse_respondent_link so molecule attaches to accrual
  await api('PUT', `/v1/member-surveys/${surveyResp.member_survey_link}/answers`, {
    answers, submit: true, tenant_id: TENANT_ID, activity_date: activityDate,
    pulse_respondent_link: respondentResp.link
  });
}

/**
 * Submit an Event for a physician.
 */
async function submitEvent(membershipNumber, comment, severity, weeksAgo) {
  const date = new Date();
  date.setDate(date.getDate() - (weeksAgo * 7));
  await api('POST', `/v1/members/${membershipNumber}/accruals`, {
    tenant_id: TENANT_ID,
    activity_date: date.toISOString().slice(0, 10),
    base_points: severity,
    ACCRUAL_TYPE: 'EVENT',
    ACTIVITY_COMMENT: comment
  });
}

// Answer templates (14 items, 0-3 scale)
// Sections: Treatment Engagement(3), Sleep(2), Mood/Safety(2), Cognitive(2), Work(2), Recovery(2), Overall(1)
const PULSE_LOW     = [0,0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0];        // All stable
const PULSE_MODERATE = [1,1,0, 1,1, 1,0, 1,0, 1,0, 1,0, 1];       // Early concern
const PULSE_HIGH    = [2,1,1, 2,1, 2,0, 1,1, 2,1, 1,1, 2];        // Moderate instability
const PULSE_SEVERE  = [2,2,2, 2,2, 2,1, 2,2, 2,2, 2,1, 3];        // High destabilization

async function seedAll() {
  console.log('=== Provider Pulse & Event Seeder for PPII Testing ===');
  console.log(`Target: ${BASE_URL}\n`);

  const ver = await api('GET', '/v1/version');
  console.log(`Server: OK (v${ver.version})`);

  await login();

  // --- James Okafor #34 — improving, moderate Pulse ---
  console.log('[1/3] Dr. James Okafor (#34) — moderate Pulse + event');
  await submitPulse('34', PULSE_MODERATE, 'Sarah Martinez, LCSW', 3);
  console.log('  ✓ Pulse (3wk ago) — moderate');
  await submitPulse('34', PULSE_LOW, 'Sarah Martinez, LCSW', 1);
  console.log('  ✓ Pulse (1wk ago) — low (improving)');
  await submitEvent('34', 'Schedule change — new rotation', 1, 2);
  console.log('  ✓ Event (2wk ago) — severity 1');

  // --- Marcus Reed #36 — trending up, severe Pulse to cross Yellow threshold ---
  console.log('\n[2/3] Dr. Marcus Reed (#36) — severe Pulse + events (should cross Yellow)');
  await submitPulse('36', PULSE_MODERATE, 'Sarah Martinez, LCSW', 4);
  console.log('  ✓ Pulse (4wk ago) — moderate');
  await submitPulse('36', PULSE_SEVERE, 'Sarah Martinez, LCSW', 2);
  console.log('  ✓ Pulse (2wk ago) — severe');
  await submitEvent('36', 'Adverse patient outcome', 2, 3);
  console.log('  ✓ Event (3wk ago) — severity 2');
  await submitEvent('36', 'Colleague departure from practice', 2, 1);
  console.log('  ✓ Event (1wk ago) — severity 2');

  // --- David Nguyen #38 — sleep issues, moderate Pulse ---
  console.log('\n[3/3] Dr. David Nguyen (#38) — sleep-focused Pulse + event');
  await submitPulse('38', [0,0,0, 2,2, 1,0, 1,0, 1,0, 0,0, 1], 'Sarah Martinez, LCSW', 3);
  console.log('  ✓ Pulse (3wk ago) — sleep elevated');
  await submitPulse('38', [0,0,0, 2,1, 1,0, 1,1, 1,0, 0,0, 1], 'Sarah Martinez, LCSW', 1);
  console.log('  ✓ Pulse (1wk ago) — sleep still elevated');
  await submitEvent('38', 'Call schedule surge — 3 consecutive weekends', 2, 2);
  console.log('  ✓ Event (2wk ago) — severity 2');

  console.log('\n=== COMPLETE — 3 physicians now have all 4 streams ===');
  console.log('PPII composite should fire on POST_ACCRUAL for each Pulse submission.');
}

seedAll().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
