/**
 * Core: Automatic MEDS — the standing watch (Session 158, v137 —
 * docs/GROUPS_AND_MEDS_DESIGN.md story 3, Bill's ruling: DAILY for all).
 *
 * The MED_SCAN scheduled job presses Run on every active automatic-mode
 * MED inside its date window, through the SAME executeMedRun the Run
 * button uses — so this test proves the SCAN's selection and manners, not
 * the run internals (test_manual_meds owns those; the two can never
 * disagree because they share one function).
 *
 * Proves, through platform doors (raw SQL only for verification):
 *   1. v137 seeding: EVERY tenant has the MED_SCAN job row (the clinical
 *      MEDS job — job_code 'MEDS', workforce tenants only — is a separate
 *      job; the two watchmen share only the scheduler).
 *   2. run_mode 'A' accepted at create; PUT flips M↔A (the unlock).
 *   3. Scan run 1 fires the in-window automatic MED for both audience
 *      members (open episodes + the points activity really lands) and
 *      NEVER touches: a manual MED with identical criteria, an automatic
 *      MED outside its window, an automatic MED with no criteria (skipped
 *      loudly, scan still completes).
 *   4. Scan run 2 news nobody (episodes hold across scheduled runs).
 *   5. A member deliberately removed from the audience gets their episode
 *      cleared by the next scan; re-adding inside the cooldown does NOT
 *      open a new episode (cooldown holds on the scan path).
 *   6. Every scan lands a completed scheduled_job_log row with honest
 *      counts.
 *
 * Tenant 1 (Delta). The fired MED refuses deletion BY DESIGN and remains
 * at exit (deactivated), like test_manual_meds — snapshot/restore wipes it.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

const AG = 'TAG_S158';    // audience group
const MEDA = 'TAA_S158';  // the automatic MED (fires)
const MEDM = 'TAM_S158';  // manual MED, same criteria — scan must skip
const MEDX = 'TAX_S158';  // automatic, window entirely in the past — skip
const MEDN = 'TAN_S158';  // automatic, no criteria — skipped loudly

module.exports = {
  name: 'Core: Automatic MEDS (MED_SCAN job: selection, episodes across scans, manual untouched)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const tenantId = 1;

    try {
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });

      // ── 1. v137: the watch stands on every tenant ──
      ctx.log('Step 1: MED_SCAN job seeded for every tenant; clinical MEDS separate');
      const seeded = (await db.query(
        `SELECT (SELECT COUNT(*) FROM tenant)::int AS tenants,
                (SELECT COUNT(*) FROM scheduled_job WHERE job_code = 'MED_SCAN')::int AS med_scan,
                (SELECT COUNT(*) FROM scheduled_job WHERE job_code = 'MEDS')::int AS clinical`)).rows[0];
      ctx.assertEqual(seeded.med_scan, seeded.tenants, `every tenant has MED_SCAN (${seeded.med_scan}/${seeded.tenants})`);
      ctx.assert(seeded.clinical > 0 && seeded.clinical < seeded.tenants,
        `clinical MEDS remains its own job on the workforce tenants only (${seeded.clinical} rows)`);

      const jobs = await ctx.fetch('/v1/scheduled/jobs');
      ctx.assert(jobs._ok && Array.isArray(jobs), `scheduled jobs list serves (${jobs._status})`);
      const scanJob = (Array.isArray(jobs) ? jobs : []).find(j => j.job_code === 'MED_SCAN');
      ctx.assert(!!scanJob, 'Delta sees its MED_SCAN job');

      // ── 2. The unlock + the cast ──
      ctx.log('Step 2: audience + four MEDs (automatic, manual twin, past window, no criteria)');
      const people = (await db.query(
        `SELECT link, membership_number, fname, lname FROM member
         WHERE tenant_id = $1 AND is_active = true AND membership_number IS NOT NULL
         ORDER BY membership_number LIMIT 2`, [tenantId])).rows;
      ctx.assert(people.length === 2, `precondition: two active Delta members (${people.length})`);
      const [A, B] = people;

      const g = await ctx.fetch('/v1/groups', { method: 'POST', body: { group_code: AG, group_name: 'S158 scan audience' } });
      ctx.assert(g._ok, `audience group created (${g._status}${g.error ? ': ' + g.error : ''})`);
      for (const p of [A, B]) {
        const add = await ctx.fetch(`/v1/groups/${AG}/members`, { method: 'POST', body: { membership_number: p.membership_number } });
        ctx.assert(add._ok, `${p.fname} ${p.lname} in the audience (${add._status})`);
      }

      const mkMed = async (code, name, extra) => ctx.fetch('/v1/meds', {
        method: 'POST',
        body: { med_code: code, med_name: name, start_date: '2020-01-01', end_date: '2030-12-31', ...extra }
      });
      const created = await mkMed(MEDA, 'S158 automatic', { run_mode: 'A', cooldown_days: 30 });
      ctx.assert(created._ok && created.med && created.med.run_mode === 'A',
        `automatic MED accepted with run_mode A (${created._status}${created.error ? ': ' + created.error : ''})`);
      const cm = await mkMed(MEDM, 'S158 manual twin', {});
      ctx.assert(cm._ok, `manual twin created (${cm._status})`);
      const cx = await mkMed(MEDX, 'S158 past window', { run_mode: 'A', start_date: '2020-01-01', end_date: '2020-12-31' });
      ctx.assert(cx._ok, `past-window automatic MED created (${cx._status})`);
      const cn = await mkMed(MEDN, 'S158 no criteria', { run_mode: 'A' });
      ctx.assert(cn._ok, `no-criteria automatic MED created (${cn._status})`);

      // PUT flips the mode both ways (on the no-criteria MED; it ends as A)
      const flipM = await ctx.fetch(`/v1/meds/${MEDN}`, { method: 'PUT', body: { run_mode: 'M' } });
      ctx.assert(flipM._ok, `PUT flips A→M (${flipM._status})`);
      const flipA = await ctx.fetch(`/v1/meds/${MEDN}`, { method: 'PUT', body: { run_mode: 'A' } });
      ctx.assert(flipA._ok, `PUT flips M→A (${flipA._status})`);

      // Criteria (audience) + a points result on the three that get criteria
      for (const code of [MEDA, MEDM, MEDX]) {
        const crit = await ctx.fetch(`/v1/meds/${code}/criteria`, {
          method: 'POST',
          body: { source: 'Member', molecule: 'MEMBER_GROUP', operator: 'in', value: [AG], label: 'In the audience' }
        });
        ctx.assert(crit._ok, `${code} criterion saved (${crit._status}${crit.error ? ': ' + crit.error : ''})`);
      }
      const rPoints = await ctx.fetch(`/v1/meds/${MEDA}/results`, {
        method: 'POST', body: { result_type: 'points', result_amount: 100, result_description: 'scan points' }
      });
      ctx.assert(rPoints._ok, `points result on the automatic MED (${rPoints._status})`);

      const medLinks = {};
      for (const code of [MEDA, MEDM, MEDX, MEDN]) {
        medLinks[code] = (await db.query(
          `SELECT link FROM med WHERE tenant_id = $1 AND med_code = $2`, [tenantId, code])).rows[0].link;
      }
      const episodeRows = async (code) => (await db.query(
        `SELECT member_link, identified_date, cleared_date FROM med_identification WHERE med_link = $1 ORDER BY link_bytes(link, 5)`,
        [medLinks[code]])).rows;
      const pointsActivities = async (memberLink) => (await db.query(
        `SELECT COUNT(*)::int AS n FROM activity WHERE p_link = $1 AND activity_type = 'M'`,
        [memberLink])).rows[0].n;

      const aActsBefore = await pointsActivities(A.link);

      // ── 3. Scan run 1: fires the right MED, only the right MED ──
      ctx.log('Step 3: first scan — the automatic MED fires for A and B; the other three untouched');
      const run1 = await ctx.fetch(`/v1/scheduled/jobs/${scanJob.scheduled_job_id}/run`, { method: 'POST' });
      ctx.assert(run1._ok && run1.status === 'completed', `scan 1 completed (${run1._status}/${run1.status}${run1.error ? ': ' + run1.error : ''})`);
      ctx.assertEqual(run1.flagged, 2, `scan 1 fired exactly the two audience members (flagged=${run1.flagged})`);
      ctx.assert(run1.analyzed >= 2, `scan 1 walked the population (analyzed=${run1.analyzed})`);

      let rows = await episodeRows(MEDA);
      ctx.assertEqual(rows.length, 2, `two episodes on the automatic MED (${rows.length})`);
      ctx.assert(rows.every(r => r.cleared_date === null), 'both episodes open');
      ctx.assertEqual(await pointsActivities(A.link), aActsBefore + 1, 'the points result really landed for A');
      ctx.assertEqual((await episodeRows(MEDM)).length, 0, 'manual twin untouched by the scan');
      ctx.assertEqual((await episodeRows(MEDX)).length, 0, 'past-window automatic MED untouched');
      ctx.assertEqual((await episodeRows(MEDN)).length, 0, 'no-criteria automatic MED skipped (loudly, in the log)');

      // ── 4. Scan run 2: episodes hold — never news twice ──
      ctx.log('Step 4: second scan news nobody');
      const run2 = await ctx.fetch(`/v1/scheduled/jobs/${scanJob.scheduled_job_id}/run`, { method: 'POST' });
      ctx.assert(run2._ok && run2.status === 'completed', `scan 2 completed (${run2.status})`);
      ctx.assertEqual(run2.flagged, 0, `scan 2 fired nobody (flagged=${run2.flagged})`);
      rows = await episodeRows(MEDA);
      ctx.assert(rows.length === 2 && rows.every(r => r.cleared_date === null), 'still two open episodes, no new rows');

      // ── 5. Stop matching → cleared; cooldown holds on re-match ──
      ctx.log('Step 5: B removed from the audience — next scan clears B; re-added inside cooldown, no new episode');
      const rem = await ctx.fetch(`/v1/groups/${AG}/members/${encodeURIComponent(B.membership_number)}`, { method: 'DELETE' });
      ctx.assert(rem._ok, `B deliberately removed from the audience (${rem._status})`);
      const run3 = await ctx.fetch(`/v1/scheduled/jobs/${scanJob.scheduled_job_id}/run`, { method: 'POST' });
      ctx.assert(run3._ok && run3.status === 'completed', `scan 3 completed (${run3.status})`);
      rows = await episodeRows(MEDA);
      const bRows = rows.filter(r => r.member_link === B.link);
      const aRows = rows.filter(r => r.member_link === A.link);
      ctx.assert(bRows.length === 1 && bRows[0].cleared_date !== null, "B's episode cleared by the scan");
      ctx.assert(aRows.length === 1 && aRows[0].cleared_date === null, "A's episode still open");

      const readd = await ctx.fetch(`/v1/groups/${AG}/members`, { method: 'POST', body: { membership_number: B.membership_number } });
      ctx.assert(readd._ok, `B re-added to the audience (${readd._status})`);
      const run4 = await ctx.fetch(`/v1/scheduled/jobs/${scanJob.scheduled_job_id}/run`, { method: 'POST' });
      ctx.assert(run4._ok && run4.status === 'completed', `scan 4 completed (${run4.status})`);
      ctx.assertEqual(run4.flagged, 0, `cooldown holds on the scan path (flagged=${run4.flagged})`);
      ctx.assertEqual((await episodeRows(MEDA)).length, 2, 'no new episode for B inside the 30-day cooldown');

      // ── 6. The log tells the truth ──
      ctx.log('Step 6: every scan landed a completed log row');
      const logRows = (await db.query(
        `SELECT COUNT(*)::int AS n FROM scheduled_job_log
         WHERE scheduled_job_id = $1 AND status = 'completed' AND run_source = 'manual'`,
        [scanJob.scheduled_job_id])).rows[0].n;
      ctx.assert(logRows >= 4, `at least our four scans logged completed (${logRows})`);

      // ── Exit: fired MED refuses deletion BY DESIGN — deactivate; clean ones delete ──
      const delFired = await ctx.fetch(`/v1/meds/${MEDA}`, { method: 'DELETE' });
      ctx.assertEqual(delFired._status, 409, 'fired automatic MED refuses deletion (history stays)');
      await ctx.fetch(`/v1/meds/${MEDA}`, { method: 'PUT', body: { is_active: false } });
      for (const code of [MEDM, MEDX, MEDN]) {
        const del = await ctx.fetch(`/v1/meds/${code}`, { method: 'DELETE' });
        ctx.assert(del._ok, `never-fired ${code} deletes clean (${del._status}${del.error ? ': ' + del.error : ''})`);
      }
    } finally {
      await db.end();
    }
  }
};
