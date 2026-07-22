/**
 * The participant's day — ONE person's continuous journey through every
 * stage Erica exercises when she tests (Session 145; the follow-up logged
 * after her July feedback, when this journey was broken at two points and
 * every stage's own test was green — the SEAMS are what this test owns):
 *
 *   invited    — staff mints a registration link (typed code)
 *   registered — the public door creates a REGISTRANT + intake item
 *   activated  — a Case Manager records the signed agreement → Participant,
 *                clinic assigned, intake item resolved, ON the roster
 *   assigned   — staff assigns PHQ-9 (one-time screener) to her
 *   portal     — the participant portal offers EXACTLY the assigned
 *                instrument (Erica defect 2: offers were hardcoded, an
 *                assigned PHQ-9 could never appear)
 *   take       — she answers with item 9 positive
 *   alert      — the safety chain fires: SENTINEL registry item (v126), and the
 *                portal stops offering the satisfied screener
 *
 * This is Erica's own blocked question-9 test, end to end on one record.
 * Self-contained: fresh registrant + throwaway CM login per run (harness
 * snapshot/restore); staff-page browser hygiene lives in test_erica_walk.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const DB_HOST = process.env.DATABASE_HOST || '127.0.0.1';
const DB_USER = process.env.DATABASE_USER || 'billjansen';
const DB_NAME = process.env.DATABASE_NAME || 'loyalty';

function sql(q) {
  return execSync(
    `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -t -A -c "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
}

module.exports = {
  name: "Insight: the participant's day (invited → registered → activated → assigned → portal → take → alert)",

  async run(ctx) {
    const TENANT = 5;

    // publicFetch — NO session cookie: the registrant has no login.
    async function publicFetch(urlPath, options = {}) {
      const resp = await fetch(`${ctx.apiBase}${urlPath}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      let data;
      try { data = await resp.json(); } catch (e) { data = {}; }
      data._status = resp.status;
      data._ok = resp.ok;
      return data;
    }

    // ── Staff side: Claude superuser + a throwaway Case Manager ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');

    const partners = await ctx.fetch(`/v1/partners?tenant_id=${TENANT}`);
    const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${TENANT}`);
    ctx.assert(Array.isArray(programs) && programs.length > 0, 'Insight has a clinic to activate into');
    const stamp = Math.floor(Math.random() * 1e9);
    const cm = await ctx.fetch('/v1/users', {
      method: 'POST', body: { username: `walk_cm_${stamp}`, password: 'cmpass1', display_name: 'Walk CaseManager', tenant_id: TENANT, role: 'csr' }
    });
    ctx.assert(cm._ok && cm.user_id, 'Throwaway case-manager login created');
    await ctx.fetch(`/v1/users/${cm.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['CASEMAN', programs[0].program_id] }
    });

    // ── 1. INVITED: a registration link exists for her ──
    ctx.log('1: invited — staff mints a registration link');
    const code = await ctx.fetch(`/v1/codes?tenant_id=${TENANT}`, {
      method: 'POST',
      body: { code_type: 'registration', context: { target: '/register', referral_type: 'Board-mandated', affiliation: 'Walk Test Board' } }
    });
    ctx.assert(code._ok && code.code, 'Registration link minted');

    // ── 2. REGISTERED: she comes through the public door ──
    ctx.log('2: registered — the public form creates a registrant + intake item');
    const reg = await publicFetch('/v1/register', {
      method: 'POST',
      body: { code: code.code, fname: 'Wanda', lname: 'Walkday', email: 'wanda.walkday@test.io', phone: '555-0177' }
    });
    ctx.assert(reg._ok && reg.success, 'Public registration accepted (no login, no session)');

    const memberLink = sql(`SELECT link FROM member WHERE tenant_id = ${TENANT} AND fname = 'Wanda' AND lname = 'Walkday'`);
    ctx.assert(memberLink !== '', 'A member record exists for Wanda');
    const memberNum = sql(`SELECT membership_number FROM member WHERE tenant_id = ${TENANT} AND fname = 'Wanda' AND lname = 'Walkday'`);

    const queue = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
    const item = (queue.items || []).find(i => i.member_name === 'Wanda Walkday');
    ctx.assert(!!item, 'Her registration sits on the intake queue');

    const rosterBefore = await ctx.fetch(`/v1/wellness/members?tenant_id=${TENANT}`);
    const listBefore = rosterBefore.members || (Array.isArray(rosterBefore) ? rosterBefore : []);
    ctx.assert(!listBefore.find(m => m.fname === 'Wanda' && m.lname === 'Walkday'),
      'As a registrant she is NOT on the participant roster');

    // ── 3. ACTIVATED: the Case Manager records her signed agreement ──
    ctx.log('3: activated — signed agreement recorded, she becomes a Participant');
    const cmLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `walk_cm_${stamp}`, password: 'cmpass1' } });
    ctx.assert(cmLogin._ok, 'Case manager logs in');
    const act = await ctx.fetch('/v1/participant-activations', {
      method: 'POST', body: { membership_number: memberNum, program_id: programs[0].program_id }
    });
    ctx.assert(act._ok, `Activation succeeds for a Case Manager (${act._status}: ${act.error || 'ok'})`);

    const rosterAfter = await ctx.fetch(`/v1/wellness/members?tenant_id=${TENANT}`);
    const listAfter = rosterAfter.members || (Array.isArray(rosterAfter) ? rosterAfter : []);
    ctx.assert(!!listAfter.find(m => m.fname === 'Wanda' && m.lname === 'Walkday'),
      'As a Participant she now appears on the roster');

    // ── 4. ASSIGNED: staff gives her the PHQ-9 screener ──
    ctx.log('4: assigned — PHQ-9 one-time screener');
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    const assign = await ctx.fetch(`/v1/members/${memberNum}/instruments`, {
      method: 'POST', body: { survey_code: 'PHQ9', mode: 'one_time' }
    });
    ctx.assert(assign._ok && assign.member_instrument_id, `PHQ-9 assigned (${assign._status})`);

    // ── 5. PORTAL: her portal offers exactly what she was assigned ──
    // (Erica defect 2 — the offers were hardcoded; an assigned PHQ-9 could
    // never appear. This is the seam her question-9 test died on.)
    let portal = null;
    if (ctx.hasBrowser()) {
      ctx.log('5: portal — the assigned PHQ-9 is offered, nothing hardcoded');
      portal = await ctx.openPage('/verticals/workforce_monitoring/physician_portal.html');
      const readRows = async () => await portal.evaluate(async (num) => {
        physician = { membership_number: num, fname: 'Wanda', lname: 'Walkday', title: '' };
        showPortal();
        await new Promise(r => setTimeout(r, 1500));
        return Array.from(document.querySelectorAll('#assessmentList .assess-row'))
          .map(r => r.textContent.replace(/\s+/g, ' ').trim());
      }, memberNum);

      const offered = await readRows();
      ctx.assert(offered.length === 1 && offered[0].includes('PHQ-9'),
        `her portal offers exactly the assigned PHQ-9 (got ${JSON.stringify(offered).substring(0, 120)})`);
      ctx.assert(offered[0].includes('Take now'), 'the never-taken screener is offered as Take now');

      // ── 6+7. TAKE with item 9 positive → the safety chain fires ──
      ctx.log('6: take — item 9 positive through the survey doors');
      const surveys = await ctx.fetch(`/v1/surveys?tenant_id=${TENANT}`);
      const phq9 = surveys.find(s => s.survey_code === 'PHQ9');
      ctx.assert(!!phq9, 'PHQ9 survey resolved');
      const qs = await ctx.fetch(`/v1/surveys/${phq9.link}/questions?tenant_id=${TENANT}`);
      ctx.assert(Array.isArray(qs) && qs.length === 9, `PHQ-9 has 9 questions (got ${qs.length})`);

      // TODAY, not yesterday: the screener was assigned today, and a
      // one-time assignment is satisfied only by a completion on/after its
      // start date — she takes it the day she gets it (Erica's real flow).
      const activityDate = new Date().toLocaleDateString('en-CA');
      const created = await ctx.fetch(`/v1/members/${memberNum}/surveys`, {
        method: 'POST', body: { survey_link: phq9.link, tenant_id: TENANT, activity_date: activityDate }
      });
      ctx.assert(created._ok && created.member_survey_link, 'Her PHQ-9 sitting created');
      const submitted = await ctx.fetch(`/v1/member-surveys/${created.member_survey_link}/answers`, {
        method: 'PUT',
        body: {
          answers: qs.map(q => ({ question_link: q.question_link, answer: q.category_code === 'PHQ9_SI' ? 2 : 1 })),
          submit: true, tenant_id: TENANT, activity_date: activityDate
        }
      });
      ctx.assert(submitted._ok, 'PHQ-9 submitted with item 9 positive');

      ctx.log('7: alert — the SENTINEL registry item exists for HER (v126, Erica\'s word)');
      const registry = await ctx.fetch(`/v1/stability-registry/member/${memberNum}?tenant_id=${TENANT}`);
      const items = registry.registry_items || registry.items || (Array.isArray(registry) ? registry : []);
      const open = (Array.isArray(items) ? items : []).filter(i => i.status === 'O');
      const sentinel = open.find(i => String(i.urgency).toUpperCase() === 'SENTINEL');
      ctx.assert(!!sentinel, `an open SENTINEL registry item exists from her item-9 answer (open items: ${open.length})`);

      // The portal reflects the taken screener — no more Take now offer.
      const afterTake = await readRows();
      ctx.assert(!afterTake.some(r => r.includes('PHQ-9') && r.includes('Take now')),
        `the satisfied one-time screener is no longer offered as Take now (got ${JSON.stringify(afterTake).substring(0, 120)})`);

      await portal.close();
    } else {
      ctx.log('Browser not available — portal + take stages skipped (the seam this test exists for needs the browser)');
    }
  }
};
