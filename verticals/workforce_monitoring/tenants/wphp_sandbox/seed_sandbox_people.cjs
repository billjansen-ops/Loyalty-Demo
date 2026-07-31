/**
 * seed_sandbox_people.cjs — one-time people seeding for the WPHP Exploration
 * sandbox (Session 160, Bill's go). Companion to migration v139, which stood
 * up the tenant's CONFIGURATION; this script adds the PEOPLE.
 *
 * EVERYTHING goes through real platform doors over HTTP — never SQL — so
 * every chart, intake trail, score, and registry item is a genuine artifact
 * of the same workflows Chris's team will explore. The Claude system account
 * only creates the staff logins and grants; every person-facing step is then
 * performed AS the sandbox staff (Kellie/Chris), exactly as real staff would.
 *
 * Run locally:   node verticals/workforce_monitoring/tenants/wphp_sandbox/seed_sandbox_people.cjs
 * Run on Heroku: SEED_API=https://... SEED_USER=... SEED_PASS=... node ...
 *
 * Idempotent: existing staff logins are reused (their generated passwords are
 * NOT re-printed — password resets go through the admin screen); people
 * already on the roster are skipped by name.
 *
 * Staff passwords are GENERATED here and printed ONCE at the end — hand them
 * to Bill/Erica for distribution; they are stored only as bcrypt hashes.
 */
const crypto = require('crypto');

const API = process.env.SEED_API || 'http://127.0.0.1:4001';
const SUPER_USER = process.env.SEED_USER || 'Claude';
const SUPER_PASS = process.env.SEED_PASS || 'claude123';
const TENANT_KEY = 'wphp_sandbox';

let cookie = null;
async function call(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const resp = await fetch(`${API}${path}`, {
    ...options, headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const setCookie = resp.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let data = null;
  try { data = await resp.json(); } catch { /* some doors return no body */ }
  if (!resp.ok) {
    const err = new Error(`${options.method || 'GET'} ${path} → ${resp.status}${data && data.error ? ': ' + data.error : ''}`);
    err.status = resp.status; err.data = data;
    throw err;
  }
  return data;
}
async function login(username, password) {
  cookie = null;
  return call('/v1/auth/login', { method: 'POST', body: { username, password } });
}
const genPass = () => 'Wphp-' + crypto.randomBytes(6).toString('base64url');

// ── The cast ─────────────────────────────────────────────────────────────
// Staff (real people, named logins — the exploration party):
const STAFF = [
  { username: 'ChrisB',    display: 'Dr. Chris Bundy',  role: 'admin', position: 'MEDDIR' },
  { username: 'KellieR',   display: 'Kellie Reilly',    role: 'csr',   position: 'CASEMAN' },
  { username: 'SamanthaC', display: 'Samantha Chow',    role: 'csr',   position: 'CASEMAN' },
];
// Grants: existing logins that get the sandbox added to their chooser.
const GRANTEES = ['EricaL', 'TomJ'];   // TomJ exists on Heroku only — skipped politely if absent

// Fictional participants. Twelve stories, not volume (Bill's leaning:
// Chris evaluates workflow, not scale). PPSI patterns: arrays of per-sitting
// average answer levels (0=best..4=worst on most items), oldest first —
// multiple sittings give the chart real trend lines.
const PEOPLE = [
  // ── Eight who complete the journey to Participant ──
  { fname: 'Marcus',  lname: 'Webb',        clinic: 'CAS-SEATTLE',  story: 'stable',    ppsi: [1, 1, 1] },
  { fname: 'Elena',   lname: 'Vasquez',     clinic: 'CAS-SEATTLE',  story: 'stable',    ppsi: [0, 1, 0] },
  { fname: 'James',   lname: 'Okafor',      clinic: 'CAS-BELLEVUE', story: 'moderate',  ppsi: [2, 2, 2] },
  { fname: 'Priya',   lname: 'Sharma',      clinic: 'PSM-TACOMA',   story: 'rising',    ppsi: [1, 2, 3] },   // upward trend — the pattern detectors get something to see
  { fname: 'David',   lname: 'Lindqvist',   clinic: 'PSM-OLYMPIA',  story: 'improving', ppsi: [3, 2, 1] },
  { fname: 'Rachel',  lname: 'Kim',         clinic: 'RRH-SPOKANE',  story: 'stable',    ppsi: [1, 1, 2] },
  { fname: 'Antoine', lname: 'Dubois',      clinic: 'RRH-YAKIMA',   story: 'overdue',   ppsi: [2] },          // one old sitting, then silence — the overdue/MEDS story
  { fname: 'Sofia',   lname: 'Petrov',      clinic: 'OPH-PORTANG',  story: 'elevated',  ppsi: [3, 3] },       // consistently elevated — worth clinical attention
  // ── Four registrants at different intake stages (the queue has life) ──
  { fname: 'Thomas',  lname: 'Reilly',      stage: 'cm_outreach' },   // fresh, outreach recorded, on the CM desk
  { fname: 'Nina',    lname: 'Castellanos', stage: 'md_desk' },       // sent to the Medical Director, awaiting review
  { fname: 'Owen',    lname: 'Blackburn',   stage: 'routed' },        // routed to resources
  { fname: 'Grace',   lname: 'Liu',         stage: 'closed' },        // file closed with reason
];

async function main() {
  console.log(`\n🏖️  WPHP Exploration sandbox — people seeding (${API})\n`);

  // ── 0. Superuser session; resolve the tenant ──
  await login(SUPER_USER, SUPER_PASS);
  const tenants = await call('/v1/tenants');
  const tenant = (tenants.tenants || tenants).find(t => t.tenant_key === TENANT_KEY);
  if (!tenant) throw new Error(`Tenant ${TENANT_KEY} not found — run migration v139 first`);
  const T = tenant.tenant_id;

  // ── 1. Staff logins (Claude account). Existing logins whose password we
  //      don't hold get a RESET through the admin door — the new password
  //      prints with the rest. ──
  const existingUsers = await call('/v1/users');
  const userList = existingUsers.users || existingUsers;
  const printedPasswords = [];
  const staffPass = {};
  for (const s of STAFF) {
    let u = userList.find(x => x.username === s.username);
    const pass = genPass();
    if (u) {
      await call(`/v1/users/${u.user_id}/password`, { method: 'POST', body: { password: pass } });
      console.log(`  🔁 ${s.username} already existed — password reset`);
    } else {
      u = await call('/v1/users', {
        method: 'POST',
        body: { username: s.username, password: pass, display_name: s.display, tenant_id: T, role: s.role },
      });
      console.log(`  ✅ ${s.username} (${s.display}) created (user_id ${u.user_id})`);
    }
    s.user_id = u.user_id;
    staffPass[s.username] = pass;
    printedPasswords.push([s.username, pass]);
  }

  // ── 2. Chooser grants for existing logins ──
  for (const name of GRANTEES) {
    const u = userList.find(x => x.username === name);
    if (!u) { console.log(`  ⏭️  ${name} not found in this environment — skipped`); continue; }
    try {
      await call(`/v1/users/${u.user_id}/tenants`, { method: 'POST', body: { tenant_id: T } });
      console.log(`  ✅ ${name} granted sandbox access (chooser)`);
    } catch (e) {
      if (e.status === 409 || e.status === 400) console.log(`  ⏭️  ${name}: ${e.data?.error || 'already granted'}`);
      else throw e;
    }
  }

  const kellie = () => login('KellieR', staffPass['KellieR']);
  const chris = () => login('ChrisB', staffPass['ChrisB']);

  // ── 3. Clinics + positions — from a TENANT-7 SESSION (the partner and
  //      position doors are session-tenant-scoped, correctly so). Chris is
  //      the sandbox admin; he sees his own tenant's clinics. ──
  await chris();
  const partners = await call(`/v1/partners?tenant_id=${T}`);
  const clinics = {};
  for (const p of partners) {
    for (const prog of await call(`/v1/partners/${p.partner_id}/programs?tenant_id=${T}`)) {
      clinics[prog.program_code] = prog.program_id;
    }
  }
  if (!clinics['CAS-SEATTLE']) throw new Error(`Sandbox clinics not found from Chris's session (got: ${Object.keys(clinics).join(', ')})`);
  console.log(`  Tenant ${T}: ${Object.keys(clinics).length} sandbox clinics visible from Chris's session`);
  for (const s of STAFF) {
    const existing = await call(`/v1/users/${s.user_id}/molecule-rows/POSITIONCLINIC`).catch(() => null);
    const rows = existing && (existing.rows || existing);
    if (Array.isArray(rows) && rows.length) {
      console.log(`  ⏭️  ${s.username} already holds a position`);
    } else {
      await call(`/v1/users/${s.user_id}/molecule-rows/POSITIONCLINIC`, {
        method: 'POST', body: { values: [s.position, clinics['CAS-SEATTLE']] },
      });
      console.log(`  ✅ ${s.username} — ${s.position} @ Cascadia Medical Center — Seattle`);
    }
  }

  // ── 4. People — as Kellie (CM) and Chris (MD), through the real doors ──
  await kellie();
  const roster = await call(`/v1/wellness/members?tenant_id=${T}`).catch(() => []);
  const rosterNames = new Set((roster.members || roster || []).map(m => `${m.fname} ${m.lname}`));

  const todo = PEOPLE.filter(p => !rosterNames.has(`${p.fname} ${p.lname}`));
  if (!todo.length) { console.log('\n  ⏭️  All twelve people already exist — nothing to seed'); finish(printedPasswords); return; }

  for (const person of todo) {
    // Kellie creates the registrant (REG_REVIEW files the intake item).
    await kellie();
    const num = await call('/v1/member/next-number');
    await call('/v1/member', { method: 'POST', body: { membership_number: num.membership_number, fname: person.fname, lname: person.lname } });
    const queue = await call(`/v1/intake-items?tenant_id=${T}`);
    const item = (queue.items || []).find(i => i.member_name === `${person.fname} ${person.lname}`);
    if (!item) throw new Error(`No intake item filed for ${person.fname} ${person.lname}`);
    const act = (action, body = {}) => call(`/v1/intake-items/${item.link}/actions`, { method: 'POST', body: { action, ...body } });

    if (person.stage === 'cm_outreach') {
      await act('record_outreach', { note: 'Left voicemail; second call scheduled for Friday.' });
      console.log(`  ✅ ${person.fname} ${person.lname} — registrant, outreach recorded (CM desk)`);
      continue;
    }
    if (person.stage === 'routed') {
      await act('route_resources', { reason: 'Self-referred for stress management; monitoring not indicated at this time.' });
      console.log(`  ✅ ${person.fname} ${person.lname} — routed to resources`);
      continue;
    }
    // Everyone else goes to the MD desk.
    await act('send_md', { reason: 'Intake screening complete; ready for Medical Director review.' });
    if (person.stage === 'md_desk') {
      console.log(`  ✅ ${person.fname} ${person.lname} — on the Medical Director desk`);
      continue;
    }

    await chris();
    if (person.stage === 'closed') {
      await act('close_file', { reason: 'Declined services after consultation; no monitoring indication.' });
      console.log(`  ✅ ${person.fname} ${person.lname} — file closed`);
      continue;
    }
    await act('approve_screening', {});

    // Kellie records the signed monitoring agreement — the conversion moment.
    await kellie();
    await call('/v1/participant-activations', {
      method: 'POST',
      body: { membership_number: num.membership_number, program_id: clinics[person.clinic], note: 'Monitoring agreement signed in office.' },
    });

    // Expected instruments: weekly PPSI for every participant.
    await call(`/v1/members/${num.membership_number}/instruments`, {
      method: 'POST', body: { survey_code: 'PPSI', mode: 'cadence' },
    }).catch(async e => {
      // fall back to the instrument's default mode vocabulary if 'cadence' isn't it
      if (e.status === 400) await call(`/v1/members/${num.membership_number}/instruments`, { method: 'POST', body: { survey_code: 'PPSI' } });
      else throw e;
    });

    // PPSI sittings — one per pattern entry, spaced a week apart, oldest first.
    const surveys = await call(`/v1/surveys?tenant_id=${T}`);
    const ppsi = (surveys.surveys || surveys).find(s => s.survey_code === 'PPSI');
    const qs = await call(`/v1/surveys/${ppsi.link}/questions?tenant_id=${T}`);
    // Refuse to seed against questions with no answer choices — the answer
    // pattern below sizes itself to each question's choice list, and an empty
    // list silently degrades every answer to 0 (exactly what happened before
    // v141 backfilled the copied tenants' options). Fail loud instead.
    const optionless = qs.filter(q => !(q.answers || []).length);
    if (optionless.length) {
      throw new Error(`PPSI has ${optionless.length} question(s) with no answer options on tenant ${T} — run migration v141 first (first one: "${optionless[0].question}")`);
    }
    const sittings = person.ppsi || [];
    for (let i = 0; i < sittings.length; i++) {
      const level = sittings[i];
      const weeksAgo = sittings.length - 1 - i;
      const d = new Date(); d.setDate(d.getDate() - weeksAgo * 7);
      const activityDate = d.toLocaleDateString('en-CA');
      const answers = qs.map((q, qi) => ({
        question_link: q.question_link,
        // vary answers around the story level so scores look human, never uniform
        answer: Math.max(0, Math.min((q.answers || []).length - 1, level + (qi % 3 === 0 ? 1 : 0) - (qi % 4 === 0 ? 1 : 0))),
      }));
      const sitting = await call(`/v1/members/${num.membership_number}/surveys`, {
        method: 'POST', body: { survey_link: ppsi.link, tenant_id: T, activity_date: activityDate },
      });
      await call(`/v1/member-surveys/${sitting.member_survey_link}/answers`, {
        method: 'PUT', body: { answers, submit: true, tenant_id: T, activity_date: activityDate },
      });
    }
    console.log(`  ✅ ${person.fname} ${person.lname} — Participant @ ${person.clinic} (${person.story}, ${sittings.length} PPSI sitting${sittings.length === 1 ? '' : 's'})`);
  }

  finish(printedPasswords);
}

function finish(printedPasswords) {
  if (printedPasswords.length) {
    console.log('\n🔑 GENERATED STAFF PASSWORDS — printed once, hand to Bill:\n');
    for (const [u, p] of printedPasswords) console.log(`    ${u}: ${p}`);
    console.log('\n(Stored only as hashes. Resets go through the admin Users screen.)');
  }
  console.log('\n🏖️  Seeding complete.\n');
}

main().catch(e => { console.error('\n❌ Seed failed:', e.message); if (e.data) console.error(e.data); process.exit(1); });
