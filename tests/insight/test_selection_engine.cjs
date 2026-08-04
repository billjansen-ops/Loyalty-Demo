/**
 * MONITORING CORE STORY 2 — the random selection engine (Session 166;
 * docs/MONITORING_CORE_DESIGN.md §2b is the contract).
 *
 * What this proves, deterministically (no dice in any assert):
 *   1. A certain-selection paradigm (quota ≥ days left) selects on the
 *      run; a second run never duplicates (one row per member per day).
 *   2. The minimum gap blocks selection (yesterday's selection planted).
 *   3. A met quota goes quiet (quotaMet counted, nobody re-selected).
 *   4. The for-cause door: reason required, appears in the day's list,
 *      duplicate 409.
 *   5. Nobody sees the future: a future date on the selections door
 *      REFUSES; the calendar carries counts only up to today and
 *      expected volume (never names) beyond it.
 *   6. ONE BRAIN PER MEMBER: on Wisconsin (the only tenant with legacy
 *      random-mode compliance rows) the legacy 1-in-7 force-select
 *      fires for a member with NO paradigm, and is SUPPRESSED for the
 *      same member once a paradigm covers them — proven through the
 *      real RANDOM_DRUG_TEST job via the manual job-run door.
 *
 * Fixtures via real doors where possible; direct SQL only to plant
 * dates/counters the doors deliberately cannot write. Harness
 * snapshot/restore backstops everything.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

module.exports = {
  name: 'Insight: selection engine (story 2 — paradigm brain, one per member, nobody sees the future)',

  async run(ctx) {
    const SB = 7, WI = 5;
    const stamp = String(Math.floor(Math.random() * 1e9)).slice(0, 6);

    const asClaude = async (tenant) => {
      const l = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(l._ok, 'Claude login');
      const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenant } });
      ctx.assert(sw._ok, `Session on tenant ${tenant}`);
    };
    await asClaude(SB);

    const db = new Client(DB_CONFIG);
    await db.connect();
    try {
      const todayInt = parseInt((await db.query(
        `SELECT date_to_molecule_int(CURRENT_DATE) AS d`)).rows[0].d);

      // Three sandbox members with no active paradigm AND no selection
      // today (the demo for-cause row — or an earlier suite test's
      // leavings — must never be mistaken for this test's engine output;
      // the full-suite run caught exactly that order dependency).
      const members = (await db.query(
        `SELECT m.link, m.membership_number, m.fname, m.lname FROM member m
         WHERE m.tenant_id = $1 AND m.is_active = TRUE
           AND NOT EXISTS (SELECT 1 FROM member_paradigm mp WHERE mp.member_link = m.link AND mp.end_date IS NULL)
           AND NOT EXISTS (SELECT 1 FROM test_selection ts WHERE ts.member_link = m.link AND ts.selected_date = $2)
         ORDER BY link_bytes(m.link, 5) LIMIT 3`, [SB, todayInt])).rows;
      ctx.assert(members.length === 3, 'Three paradigm-free sandbox members found for fixtures');
      const [A, B, C] = members;

      const mkParadigm = (code, name, tests, gap) => ctx.fetch('/v1/test-paradigms', {
        method: 'POST', body: { paradigm_code: code, paradigm_name: name,
          tests_per_period: tests, period: 'month', min_gap_days: gap, weekdays_only: false } });
      const pSure = await mkParadigm(`QA-SURE-${stamp}`, 'QA certain daily', 31, 0);
      const pGap = await mkParadigm(`QA-GAP-${stamp}`, 'QA wide gap', 2, 25);
      const pOne = await mkParadigm(`QA-ONE-${stamp}`, 'QA one per month', 1, 0);
      ctx.assert(pSure._ok && pGap._ok && pOne._ok, 'Three fixture paradigms created (any-day, so weekends prove too)');

      const assign = (num, code) => ctx.fetch(`/v1/members/${num}/paradigm`, {
        method: 'PUT', body: { paradigm_code: code } });
      ctx.assert((await assign(A.membership_number, `QA-SURE-${stamp}`))._ok, `${A.fname} on the certain paradigm`);
      ctx.assert((await assign(B.membership_number, `QA-GAP-${stamp}`))._ok, `${B.fname} on the wide-gap paradigm`);
      ctx.assert((await assign(C.membership_number, `QA-ONE-${stamp}`))._ok, `${C.fname} on the one-per-month paradigm`);

      // Plant: B selected YESTERDAY (gap must block today); C already at
      // quota this month. Direct SQL — the doors deliberately cannot
      // write history.
      const nowTs = (await db.query(`SELECT timestamp_to_audit_ts(NOW()) AS ts`)).rows[0].ts;
      await db.query(
        `INSERT INTO test_selection (tenant_id, member_link, selected_date, source, created_ts)
         VALUES ($1, $2, $3, 'R', $4)`, [SB, B.link, todayInt - 1, nowTs]);
      await db.query(
        `INSERT INTO test_selection (tenant_id, member_link, selected_date, source, created_ts)
         VALUES ($1, $2, $3, 'R', $4)`, [SB, C.link, todayInt - 2, nowTs]);

      // ── 1-3. The run: certain selects, gap blocks, quota quiets ──
      const run1 = await ctx.fetch('/v1/monitoring/selection-run', { method: 'POST' });
      ctx.assert(run1._ok && run1.analyzed >= 3, `Run analyzed the assignments (${run1.analyzed})`);
      ctx.assert(run1.quotaMet >= 1, `A met quota was counted quiet (${run1.quotaMet})`);
      const day1 = await ctx.fetch('/v1/monitoring/selections');
      const names1 = day1.selections.map(s => s.member_number);
      ctx.assert(names1.includes(A.membership_number),
        'CERTAIN: quota ≥ days left means probability 1 — selected on the run');
      ctx.assert(!names1.includes(B.membership_number),
        'GAP: selected yesterday + min_gap 25 — NOT selected today');
      ctx.assert(!names1.includes(C.membership_number),
        'QUOTA: already at 1-of-1 this month — NOT selected');

      const before = day1.selections.length;
      const run2 = await ctx.fetch('/v1/monitoring/selection-run', { method: 'POST' });
      ctx.assert(run2._ok, 'Second run same day is safe');
      const day2 = await ctx.fetch('/v1/monitoring/selections');
      ctx.assert(day2.selections.length === before,
        'And selects nobody twice — one row per member per day');

      // The engine's selection stamped the legacy compliance pointers
      // (no-op here — the sandbox has no random-mode rows — proven for
      // real on Wisconsin below). The paradigm rode the selection row:
      const aRow = day2.selections.find(s => s.member_number === A.membership_number);
      ctx.assert(aRow && aRow.source === 'random' && aRow.paradigm === 'QA certain daily',
        "The selection row carries its paradigm and source 'random'");

      // ── 4. For-cause door ──
      const noReason = await ctx.fetch('/v1/monitoring/selections', {
        method: 'POST', body: { member_number: B.membership_number } });
      ctx.assert(noReason._status === 400, 'For-cause without a reason refuses');
      const cause = await ctx.fetch('/v1/monitoring/selections', {
        method: 'POST', body: { member_number: B.membership_number, reason: 'QA for-cause' } });
      ctx.assert(cause._ok && cause.selection.source === 'for-cause',
        'For-cause selection recorded (overrides the gap — a human decision)');
      const causeDup = await ctx.fetch('/v1/monitoring/selections', {
        method: 'POST', body: { member_number: B.membership_number, reason: 'again' } });
      ctx.assert(causeDup._status === 409, 'A second selection the same day refuses');

      // ── 4b. Excused absences (story 3a): a mark, never a deletion ──
      const bSel = cause.selection.selection_id;
      const exNoReason = await ctx.fetch(`/v1/monitoring/selections/${bSel}/excuse`, { method: 'POST', body: {} });
      ctx.assert(exNoReason._status === 400, 'Excusing without a reason refuses');
      const ex = await ctx.fetch(`/v1/monitoring/selections/${bSel}/excuse`, {
        method: 'POST', body: { reason: 'QA travel' } });
      ctx.assert(ex._ok && ex.selection.excused === true && ex.selection.excused_reason === 'QA travel',
        'Excused: the mark carries who and why; the selection row stands');
      const exDup = await ctx.fetch(`/v1/monitoring/selections/${bSel}/excuse`, {
        method: 'POST', body: { reason: 'again' } });
      ctx.assert(exDup._status === 409, 'An excusal is one-way (second refuses)');

      // Quota re-roll: C was quiet at quota; excusing C's planted row
      // frees the quota, so the next run no longer counts C quota-met.
      const runQ1 = await ctx.fetch('/v1/monitoring/selection-run', { method: 'POST' });
      const qBefore = runQ1.quotaMet;
      const cRow = (await db.query(
        `SELECT selection_id FROM test_selection WHERE member_link = $1 AND excused_ts IS NULL LIMIT 1`,
        [C.link])).rows[0];
      const exC = await ctx.fetch(`/v1/monitoring/selections/${cRow.selection_id}/excuse`, {
        method: 'POST', body: { reason: 'QA illness' } });
      ctx.assert(exC._ok, "C's quota-filling selection excused");
      const runQ2 = await ctx.fetch('/v1/monitoring/selection-run', { method: 'POST' });
      ctx.assert(runQ2.quotaMet === qBefore - 1,
        `Excused rows stop satisfying the quota — the engine re-rolls (quotaMet ${qBefore} → ${runQ2.quotaMet})`);

      // ── 5. Nobody sees the future ──
      const future = await ctx.fetch('/v1/monitoring/selections?date=2027-01-15');
      ctx.assert(future._status === 400 && (future.error || '').includes('never named'),
        'A future date on the selections door REFUSES in plain English');
      const cal = await ctx.fetch('/v1/monitoring/calendar');
      ctx.assert(cal._ok, 'Calendar serves');
      const today = cal.days.find(d => d.is_today);
      const futureDays = cal.days.filter(d => d.is_future);
      ctx.assert(today && today.count >= 2 && today.expected === null,
        `Today carries the actual count (${today?.count}), no estimate`);
      ctx.assert(futureDays.every(d => d.count === null),
        'Future days carry NO actual counts — expected volume only');
      ctx.assert(futureDays.some(d => (d.expected || 0) > 0),
        'And the expected volume is present (assignments still under quota)');

      // ── 6. One brain per member (Wisconsin, the legacy body) ──
      await asClaude(WI);
      const legacy = (await db.query(
        `SELECT mc.member_compliance_id, mc.member_link, m.membership_number, m.fname
         FROM member_compliance mc JOIN member m ON m.link = mc.member_link
         WHERE mc.tenant_id = $1 AND mc.schedule_mode = 'random' AND mc.status = 'active'
           AND m.is_active = TRUE
           AND NOT EXISTS (SELECT 1 FROM member_paradigm mp WHERE mp.member_link = mc.member_link AND mp.end_date IS NULL)
         ORDER BY mc.member_compliance_id LIMIT 1`, [WI])).rows[0];
      ctx.assert(!!legacy, `Found a Wisconsin random-mode compliance member (${legacy?.fname})`);
      const jobId = (await db.query(
        `SELECT scheduled_job_id FROM scheduled_job WHERE tenant_id = $1 AND job_code = 'RANDOM_DRUG_TEST'`,
        [WI])).rows[0].scheduled_job_id;

      // 6a. No paradigm: 11 days without → the legacy force-select fires.
      await db.query(
        `UPDATE member_compliance SET days_since_selected = 11, last_selected_date = $2, next_scheduled_date = NULL
         WHERE member_compliance_id = $1`, [legacy.member_compliance_id, todayInt - 12]);
      const job1 = await ctx.fetch(`/v1/scheduled/jobs/${jobId}/run`, { method: 'POST' });
      ctx.assert(job1._ok, 'RANDOM_DRUG_TEST job ran (manual trigger)');
      const after1 = (await db.query(
        `SELECT days_since_selected, next_scheduled_date FROM member_compliance WHERE member_compliance_id = $1`,
        [legacy.member_compliance_id])).rows[0];
      ctx.assert(after1.days_since_selected === 0 && after1.next_scheduled_date === todayInt,
        'LEGACY BRAIN: with no paradigm, the 10-day force-select fired (pointers stamped)');

      // 6b. Paradigm covers the member (at quota, so the paradigm brain is
      // deterministically quiet too): the legacy loop must NOT touch them.
      const wiP = await ctx.fetch('/v1/test-paradigms', { method: 'POST',
        body: { paradigm_code: `QA-WI-${stamp}`, paradigm_name: 'QA WI quota-met', tests_per_period: 1, period: 'month', weekdays_only: false } });
      ctx.assert(wiP._ok, 'Wisconsin fixture paradigm created');
      const wiAssign = await ctx.fetch(`/v1/members/${legacy.membership_number}/paradigm`, {
        method: 'PUT', body: { paradigm_code: `QA-WI-${stamp}` } });
      ctx.assert(wiAssign._ok, 'Legacy member now covered by a paradigm');
      await db.query(
        `INSERT INTO test_selection (tenant_id, member_link, selected_date, source, created_ts)
         VALUES ($1, $2, $3, 'R', $4) ON CONFLICT DO NOTHING`, [WI, legacy.member_link, todayInt - 3, nowTs]);
      await db.query(
        `UPDATE member_compliance SET days_since_selected = 11, next_scheduled_date = NULL, last_selected_date = $2
         WHERE member_compliance_id = $1`, [legacy.member_compliance_id, todayInt - 12]);
      const job2 = await ctx.fetch(`/v1/scheduled/jobs/${jobId}/run`, { method: 'POST' });
      ctx.assert(job2._ok, 'RANDOM_DRUG_TEST job ran again');
      const after2 = (await db.query(
        `SELECT days_since_selected, next_scheduled_date FROM member_compliance WHERE member_compliance_id = $1`,
        [legacy.member_compliance_id])).rows[0];
      ctx.assert(after2.days_since_selected === 11 && after2.next_scheduled_date === null,
        'ONE BRAIN: paradigm-covered member untouched by the legacy rules — even the 10-day force is suppressed');

      // ── 6c. Excusing TODAY's selection clears the missed-sweep pointer ──
      // (Wisconsin has the random-mode compliance rows the pointer lives on.)
      const wiSel = await ctx.fetch('/v1/monitoring/selections', {
        method: 'POST', body: { member_number: legacy.membership_number, reason: 'QA pointer proof' } });
      ctx.assert(wiSel._ok, 'For-cause selection today on the Wisconsin member (stamps the pointer)');
      const stamped = (await db.query(
        `SELECT next_scheduled_date FROM member_compliance WHERE member_compliance_id = $1`,
        [legacy.member_compliance_id])).rows[0];
      ctx.assert(stamped.next_scheduled_date === todayInt, 'Pointer stamped to today by the selection');
      const exWi = await ctx.fetch(`/v1/monitoring/selections/${wiSel.selection.selection_id}/excuse`, {
        method: 'POST', body: { reason: 'QA excused same day' } });
      ctx.assert(exWi._ok, "Today's selection excused");
      const cleared = (await db.query(
        `SELECT next_scheduled_date FROM member_compliance WHERE member_compliance_id = $1`,
        [legacy.member_compliance_id])).rows[0];
      ctx.assert(cleared.next_scheduled_date === null,
        'And the missed-sweep pointer is CLEARED — 5 PM never files a MISSED for an excused test');
    } finally {
      await db.end();
    }
  }
};
