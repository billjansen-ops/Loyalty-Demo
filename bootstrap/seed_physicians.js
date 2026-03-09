#!/usr/bin/env node
/**
 * seed_physicians.js — Wisconsin PHP Demo Data
 * Run from project root: node bootstrap/seed_physicians.js [base_url]
 * SAFE: uses membership number generator, lives in bootstrap/ not tenants/
 */

const BASE_URL = process.argv[2] || 'http://localhost:4001';
const TENANT_ID = 5;

async function api(method, urlPath, body) {
  const resp = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `${method} ${urlPath} failed: ${resp.status}`);
  return data;
}

async function nextMemberNumber() {
  const data = await api('GET', `/v1/member/next-number?tenant_id=${TENANT_ID}`);
  return data.membership_number;
}

async function enroll(fname, lname, email) {
  const membership_number = await nextMemberNumber();
  await api('POST', '/v1/member', { tenant_id: TENANT_ID, membership_number, fname, lname, email });
  return membership_number;
}

let ppsiQuestions = null;
async function getPPSIQuestions() {
  if (ppsiQuestions) return ppsiQuestions;
  const data = await api('GET', `/v1/surveys/1/questions?tenant_id=${TENANT_ID}`);
  ppsiQuestions = data.questions || data;
  return ppsiQuestions;
}

async function submitPPSI(membershipNumber, answerValues, weeksAgo) {
  const date = new Date();
  date.setDate(date.getDate() - (weeksAgo * 7));
  const activityDate = date.toISOString().slice(0, 10);

  const questions = await getPPSIQuestions();
  const answers = questions.map((q, i) => ({
    question_link: q.question_link,
    answer: answerValues[i] || 1
  }));

  const surveyResp = await api('POST', `/v1/members/${membershipNumber}/surveys`, {
    survey_link: 1, tenant_id: TENANT_ID, activity_date: activityDate
  });
  await api('PUT', `/v1/member-surveys/${surveyResp.member_survey_link}/answers`, {
    answers, submit: true, tenant_id: TENANT_ID, activity_date: activityDate
  });
}

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

const LOW    = Array(34).fill(1);
const MED    = Array(34).fill(2);
const HIGH   = Array(34).fill(3);
const SEVERE = Array(34).fill(3).map((v, i) => i < 17 ? 3 : 2);

const physicians = [
  { fname: 'James',    lname: 'Okafor',    email: 'j.okafor@wi-php.org',    story: 'improving' },
  { fname: 'Sarah',    lname: 'Chen',      email: 's.chen@wi-php.org',      story: 'stable_good' },
  { fname: 'Marcus',   lname: 'Reed',      email: 'm.reed@wi-php.org',      story: 'trending_up' },
  { fname: 'Patricia', lname: 'Walsh',     email: 'p.walsh@wi-php.org',     story: 'orange' },
  { fname: 'David',    lname: 'Nguyen',    email: 'd.nguyen@wi-php.org',    story: 'sleep' },
  { fname: 'Elena',    lname: 'Vasquez',   email: 'e.vasquez@wi-php.org',   story: 'spike_recovered' },
  { fname: 'Robert',   lname: 'Holmberg',  email: 'r.holmberg@wi-php.org',  story: 'red' },
  { fname: 'Michelle', lname: 'Ostrowski', email: 'm.ostrowski@wi-php.org', story: 'new' },
];

async function seedAll() {
  console.log('=== Wisconsin PHP Physician Demo Seeder ===');
  console.log(`Target: ${BASE_URL}\n`);

  const ver = await api('GET', '/v1/version');
  console.log(`Server: OK (v${ver.version})\n`);

  for (let i = 0; i < physicians.length; i++) {
    const p = physicians[i];
    console.log(`[${i+1}/8] Enrolling Dr. ${p.fname} ${p.lname}...`);
    const num = await enroll(p.fname, p.lname, p.email);
    console.log(`  ✓ Enrolled — #${num}`);

    switch (p.story) {
      case 'improving':
        await submitPPSI(num, HIGH, 6); console.log('  ✓ PPSI (6wk)');
        await submitEvent(num, 'PERSONAL', 2, 6);
        await submitPPSI(num, HIGH, 5); console.log('  ✓ PPSI (5wk)');
        await submitPPSI(num, MED,  4); console.log('  ✓ PPSI (4wk)');
        await submitEvent(num, 'WORK', 1, 4);
        await submitPPSI(num, MED,  3); console.log('  ✓ PPSI (3wk)');
        await submitPPSI(num, LOW,  2); console.log('  ✓ PPSI (2wk)');
        await submitPPSI(num, LOW,  1); console.log('  ✓ PPSI (1wk)');
        break;
      case 'stable_good':
        for (let w = 6; w >= 1; w--) { await submitPPSI(num, LOW, w); console.log(`  ✓ PPSI (${w}wk)`); }
        break;
      case 'trending_up':
        await submitPPSI(num, MED,  6); console.log('  ✓ PPSI (6wk)');
        await submitPPSI(num, MED,  5); console.log('  ✓ PPSI (5wk)');
        await submitPPSI(num, MED,  4); console.log('  ✓ PPSI (4wk)');
        await submitPPSI(num, HIGH, 3); console.log('  ✓ PPSI (3wk)');
        await submitPPSI(num, HIGH, 2); console.log('  ✓ PPSI (2wk)');
        await submitPPSI(num, HIGH, 1); console.log('  ✓ PPSI (1wk)');
        await submitEvent(num, 'WORK', 2, 1);
        break;
      case 'orange':
        await submitPPSI(num, MED,    6); console.log('  ✓ PPSI (6wk)');
        await submitPPSI(num, HIGH,   5); console.log('  ✓ PPSI (5wk)');
        await submitPPSI(num, HIGH,   4); console.log('  ✓ PPSI (4wk)');
        await submitPPSI(num, HIGH,   3); console.log('  ✓ PPSI (3wk)');
        await submitEvent(num, 'INTERPERSONAL', 1, 3);
        await submitPPSI(num, SEVERE, 2); console.log('  ✓ PPSI (2wk)');
        await submitPPSI(num, SEVERE, 1); console.log('  ✓ PPSI (1wk)');
        await submitEvent(num, 'PERSONAL', 2, 1);
        break;
      case 'sleep':
        await submitPPSI(num, MED, 6); console.log('  ✓ PPSI (6wk)');
        await submitPPSI(num, MED, 5); console.log('  ✓ PPSI (5wk)');
        await submitPPSI(num, MED, 4); console.log('  ✓ PPSI (4wk)');
        await submitPPSI(num, MED, 3); console.log('  ✓ PPSI (3wk)');
        await submitEvent(num, 'SLEEP', 1, 3);
        await submitPPSI(num, MED, 2); console.log('  ✓ PPSI (2wk)');
        await submitPPSI(num, MED, 1); console.log('  ✓ PPSI (1wk)');
        break;
      case 'spike_recovered':
        await submitPPSI(num, LOW,  6); console.log('  ✓ PPSI (6wk)');
        await submitPPSI(num, LOW,  5); console.log('  ✓ PPSI (5wk)');
        await submitPPSI(num, LOW,  4); console.log('  ✓ PPSI (4wk)');
        await submitPPSI(num, HIGH, 3); console.log('  ✓ PPSI (3wk)');
        await submitEvent(num, 'PATIENT', 3, 3);
        await submitPPSI(num, LOW,  2); console.log('  ✓ PPSI (2wk)');
        await submitPPSI(num, LOW,  1); console.log('  ✓ PPSI (1wk)');
        break;
      case 'red':
        await submitPPSI(num, SEVERE, 5); console.log('  ✓ PPSI (5wk)');
        await submitPPSI(num, SEVERE, 4); console.log('  ✓ PPSI (4wk)');
        await submitPPSI(num, SEVERE, 3); console.log('  ✓ PPSI (3wk)');
        await submitPPSI(num, SEVERE, 2); console.log('  ✓ PPSI (2wk)');
        await submitEvent(num, 'WORK', 2, 2);
        await submitPPSI(num, SEVERE, 1); console.log('  ✓ PPSI (1wk)');
        await submitEvent(num, 'PERSONAL', 3, 1);
        console.log('  ⚠  Last week survey intentionally skipped');
        break;
      case 'new':
        await submitPPSI(num, MED, 2); console.log('  ✓ PPSI (2wk)');
        await submitEvent(num, 'WORK', 1, 2);
        await submitPPSI(num, MED, 1); console.log('  ✓ PPSI (1wk)');
        break;
    }
    console.log(`  ✓ Dr. ${p.lname} complete`);
  }

  console.log('\n=== COMPLETE ===');
}

seedAll().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
