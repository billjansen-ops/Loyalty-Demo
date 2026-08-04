/**
 * Core: Manual MEDS (Session 157 — docs/GROUPS_AND_MEDS_DESIGN.md, story 2)
 *
 * A MED is a promotion's silhouette: header (dates, run_mode M, cooldown,
 * lifetime cap) + criteria via the shared rule pair + results 0–n. One
 * med_identification row per EPISODE: identified_date at firing, cleared_date
 * stamped when a run finds the member no longer matching. All manners read
 * off those rows. One transaction per member at run.
 *
 * Proves, through platform doors (raw SQL only for verification per
 * MOLECULES.md §7):
 *   1. Create + guards: duplicate 409; nonsense run mode refused (create
 *      AND update); activity-field criterion refused; no-criteria
 *      preview/run refused; self-watch guard BOTH directions (criteria
 *      watching a results-target group, result targeting a watched group).
 *   2. Preview annotates would_fire and WRITES NOTHING.
 *   3. Run fires: identification rows written; points activity (type M)
 *      carries the MED_LINK molecule — byte-proven (raw 3-byte link, 'A'
 *      side); 'group' result adds members to the winners group.
 *   4. Episodes: immediate re-run fires nobody (still_in_episode); a member
 *      who stops matching gets cleared_date stamped; re-matching later is a
 *      NEW episode.
 *   5. Cooldown blocks a new episode inside the window; clearing the
 *      cooldown lets it fire; lifetime cap stops the yo-yo at N ever.
 *   6. Date window: a MED outside its dates refuses to run in plain English.
 *   7. DAYS_SINCE_LAST_ACTIVITY: preview count matches the SQL function's
 *      count exactly (JS/SQL parity), using the criteria editor's 'gt'
 *      spelling — the operator-normalization fix proven end to end. Members
 *      with no accrual activity fail the comparison (NULL never matches).
 *   8. Delete: refused once fired (history stays; deactivate is retirement);
 *      a never-fired MED deletes clean (results + rule + criteria gone).
 *   9. Tenant isolation: another tenant cannot see or run the MED.
 *
 * Tenant 1 (Delta). MED1 + the two groups deliberately remain at exit (a
 * fired MED refuses deletion BY DESIGN) — snapshot/restore wipes them.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

const MG = 'TMG_S157';   // audience group (the MED watches this)
const MW = 'TMW_S157';   // winners group (the MED writes this)
const MED1 = 'TM_S157';  // the main MED
const MED3 = 'TM3_S157'; // never-fired MED for the clean-delete proof

module.exports = {
  name: 'Core: Manual MEDS (episodes, manners, results transaction, member-fact molecule)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const tenantId = 1;

    try {
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });

      // Two active members with membership numbers, hand-picked deterministically
      const people = (await db.query(
        `SELECT link, membership_number, fname, lname FROM member
         WHERE tenant_id = $1 AND is_active = true AND membership_number IS NOT NULL
         ORDER BY membership_number LIMIT 2`, [tenantId])).rows;
      ctx.assert(people.length === 2, `precondition: two active Delta members (${people.length})`);
      const [A, B] = people;

      // ── 0. The two groups: audience + winners ──
      ctx.log('Step 0: audience group + winners group, A and B in the audience');
      for (const [code, name] of [[MG, 'S157 MED audience'], [MW, 'S157 MED winners']]) {
        const g = await ctx.fetch('/v1/groups', { method: 'POST', body: { group_code: code, group_name: name } });
        ctx.assert(g._ok, `group ${code} created (${g._status}${g.error ? ': ' + g.error : ''})`);
      }
      for (const p of [A, B]) {
        const add = await ctx.fetch(`/v1/groups/${MG}/members`, { method: 'POST', body: { membership_number: p.membership_number } });
        ctx.assert(add._ok, `${p.fname} ${p.lname} added to audience (${add._status})`);
      }

      // ── 1. Create + the guards ──
      ctx.log('Step 1: create the MED; every door refuses nonsense in plain English');
      const created = await ctx.fetch('/v1/meds', {
        method: 'POST',
        body: { med_code: MED1, med_name: 'S157 test MED', start_date: '2020-01-01', end_date: '2030-12-31',
                cooldown_days: 30, lifetime_cap: 2 }
      });
      ctx.assert(created._ok, `MED created (${created._status}${created.error ? ': ' + created.error : ''})`);

      const dup = await ctx.fetch('/v1/meds', {
        method: 'POST', body: { med_code: MED1.toLowerCase(), med_name: 'dupe', start_date: '2020-01-01', end_date: '2030-12-31' }
      });
      ctx.assertEqual(dup._status, 409, `duplicate code refused case-insensitively (${dup._status})`);

      // Reserved words: the clinical MEDS detector owns /v1/meds/summary
      // (+ check/member/seed) — those can never be MED codes, and the
      // platform's :code routes step aside for them (S157 route collision)
      const reserved = await ctx.fetch('/v1/meds', {
        method: 'POST', body: { med_code: 'SUMMARY', med_name: 'x', start_date: '2020-01-01', end_date: '2030-12-31' }
      });
      ctx.assert(reserved._status === 400 && /reserved/i.test(reserved.error || ''),
        `reserved code refused in plain English (${reserved.error})`);

      // Run modes: M and A are the whole vocabulary (story 3 unlocked A —
      // test_automatic_meds proves the scan); nonsense is refused plainly
      const badMode = await ctx.fetch('/v1/meds', {
        method: 'POST', body: { med_code: 'TMA_S157', med_name: 'auto', run_mode: 'X', start_date: '2020-01-01', end_date: '2030-12-31' }
      });
      ctx.assert(badMode._status === 400 && /run mode/i.test(badMode.error || ''),
        `nonsense run mode refused at create (${badMode.error})`);
      const badModePut = await ctx.fetch(`/v1/meds/${MED1}`, { method: 'PUT', body: { run_mode: 'X' } });
      ctx.assert(badModePut._status === 400 && /run mode/i.test(badModePut.error || ''),
        `nonsense run mode refused at update (${badModePut.error})`);

      const noCrit = await ctx.fetch(`/v1/meds/${MED1}/preview`, { method: 'POST' });
      ctx.assert(noCrit._status === 400 && /criteria/i.test(noCrit.error || ''),
        `no-criteria preview refused (${noCrit.error})`);
      const noCritRun = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assertEqual(noCritRun._status, 400, `no-criteria run refused (${noCritRun._status})`);

      const actCrit = await ctx.fetch(`/v1/meds/${MED1}/criteria`, {
        method: 'POST',
        body: { source: 'Activity', molecule: 'FARE_CLASS', operator: 'equals', value: 'F', label: 'Fare F' }
      });
      ctx.assert(actCrit._status === 400 && /activity field/i.test(actCrit.error || ''),
        `activity-field criterion refused in plain English (${actCrit.error})`);

      // Criteria: in the audience group
      const crit = await ctx.fetch(`/v1/meds/${MED1}/criteria`, {
        method: 'POST',
        body: { source: 'Member', molecule: 'MEMBER_GROUP', operator: 'in', value: [MG], label: 'In the audience' }
      });
      ctx.assert(crit._ok, `MEMBER_GROUP criterion saved (${crit._status}${crit.error ? ': ' + crit.error : ''})`);

      // Self-watch guard, direction 1: result may not write the watched group
      const selfResult = await ctx.fetch(`/v1/meds/${MED1}/results`, {
        method: 'POST', body: { result_type: 'group', result_group_code: MG }
      });
      ctx.assert(selfResult._status === 400 && /watch/i.test(selfResult.error || ''),
        `result targeting the WATCHED group refused (${selfResult.error})`);

      // Real results: 250 points + add to winners
      const rPoints = await ctx.fetch(`/v1/meds/${MED1}/results`, {
        method: 'POST', body: { result_type: 'points', result_amount: 250, result_description: 'win-back points' }
      });
      ctx.assert(rPoints._ok, `points result saved (${rPoints._status})`);
      const rGroup = await ctx.fetch(`/v1/meds/${MED1}/results`, {
        method: 'POST', body: { result_type: 'group', result_group_code: MW }
      });
      ctx.assert(rGroup._ok, `group result saved (${rGroup._status})`);

      // sms/email (v133): in the vocabulary, honestly undeliverable — the
      // message is required, and a firing carries the no-op without breaking
      const smsNoMsg = await ctx.fetch(`/v1/meds/${MED1}/results`, {
        method: 'POST', body: { result_type: 'sms' }
      });
      ctx.assert(smsNoMsg._status === 400 && /message/i.test(smsNoMsg.error || ''),
        `SMS without message text refused (${smsNoMsg.error})`);
      const rSms = await ctx.fetch(`/v1/meds/${MED1}/results`, {
        method: 'POST', body: { result_type: 'sms', result_description: 'We miss you — fly soon!' }
      });
      ctx.assert(rSms._ok, `SMS result saved with its message (${rSms._status})`);
      const resultList = await ctx.fetch(`/v1/meds/${MED1}/results`);
      ctx.assert(resultList.some(r => r.result_type === 'sms'),
        'SMS result rides the result list (provider-less no-op at fire time)');

      // Self-watch guard, direction 2: criteria may not watch a results-target group
      const selfCrit = await ctx.fetch(`/v1/meds/${MED1}/criteria`, {
        method: 'POST',
        body: { source: 'Member', molecule: 'MEMBER_GROUP', operator: 'in', value: [MW], label: 'watch winners' }
      });
      ctx.assert(selfCrit._status === 400 && /results add members/i.test(selfCrit.error || ''),
        `criterion watching the results-target group refused (${selfCrit.error})`);

      const medLink = (await db.query(
        `SELECT link FROM med WHERE tenant_id = $1 AND med_code = $2`, [tenantId, MED1])).rows[0].link;

      // ── 2. Preview writes nothing ──
      ctx.log('Step 2: preview annotates and writes nothing');
      const preview = await ctx.fetch(`/v1/meds/${MED1}/preview`, { method: 'POST' });
      ctx.assert(preview._ok, `preview answers (${preview._status})`);
      ctx.assertEqual(preview.match_count, 2, `both audience members match (${preview.match_count})`);
      ctx.assertEqual(preview.would_fire, 2, `both would fire (${preview.would_fire})`);
      const identsAfterPreview = Number((await db.query(
        `SELECT COUNT(*)::int AS n FROM med_identification WHERE med_link = $1`, [medLink])).rows[0].n);
      ctx.assertEqual(identsAfterPreview, 0, 'preview wrote NOTHING');

      // ── 3. Run 1 fires both, everything in one transaction per member ──
      ctx.log('Step 3: run — identification + points activity + winners membership, together');
      const run1 = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assert(run1._ok, `run answers (${run1._status})`);
      ctx.assertEqual(run1.fired, 2, `run fired both (${run1.fired})`);
      ctx.assertEqual((run1.failed || []).length, 0, 'no member failed');

      const idents1 = (await db.query(
        `SELECT member_link, identified_date, cleared_date FROM med_identification WHERE med_link = $1`, [medLink])).rows;
      ctx.assertEqual(idents1.length, 2, `two identification rows (${idents1.length})`);
      ctx.assert(idents1.every(r => r.cleared_date == null), 'both episodes OPEN');

      // Points activity for A: type M today, carrying the MED_LINK molecule —
      // byte-proven (raw 3-byte med link on the 'A' side, MOLECULES.md §7)
      const actA = (await db.query(`
        SELECT a.link FROM activity a WHERE a.p_link = $1 AND a.activity_type = 'M'
        ORDER BY link_bytes(a.link, 5) DESC LIMIT 1`, [A.link])).rows;
      ctx.assert(actA.length === 1, `A has a type-M points activity`);
      const molRow = (await db.query(`
        SELECT d.c1, d.attaches_to FROM "5_data_3" d
        JOIN molecule_def md ON md.molecule_id = d.molecule_id
        WHERE md.molecule_key = 'MED_LINK' AND md.tenant_id = $1 AND d.p_link = $2`,
        [tenantId, actA[0].link])).rows;
      ctx.assertEqual(molRow.length, 1, 'MED_LINK molecule row present on the points activity');
      ctx.assertEqual(molRow[0].c1, medLink, 'stored bytes ARE the MED link (raw, value_type link)');
      ctx.assertEqual(molRow[0].attaches_to, 'A', "stored on the activity side ('A')");

      const winners = await ctx.fetch(`/v1/groups/${MW}/members`);
      ctx.assertEqual(winners.length, 2, `group result added both to winners (${winners.length})`);

      // ── 4. Episodes: re-run fires nobody; stop matching = cleared ──
      ctx.log('Step 4: episodes — never news twice; stops matching = cleared');
      const run2 = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assertEqual(run2.fired, 0, `immediate re-run fired nobody (${run2.fired})`);
      ctx.assertEqual(run2.still_in_episode, 2, `both skipped as open episodes (${run2.still_in_episode})`);

      const remA = await ctx.fetch(`/v1/groups/${MG}/members/${A.membership_number}`, { method: 'DELETE' });
      ctx.assert(remA._ok, `A removed from the audience (${remA._status})`);
      const run3 = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assertEqual(run3.cleared, 1, `A's episode cleared when they stopped matching (${run3.cleared})`);
      ctx.assertEqual(run3.fired, 0, 'nobody fired on the clearing run');
      const aCleared = (await db.query(
        `SELECT cleared_date FROM med_identification WHERE med_link = $1 AND member_link = $2`,
        [medLink, A.link])).rows[0];
      ctx.assert(aCleared.cleared_date != null, "A's identification row carries the cleared stamp");

      // ── 5. Cooldown, then the lifetime cap ──
      ctx.log('Step 5: cooldown blocks the new episode; cap stops the yo-yo');
      const readdA = await ctx.fetch(`/v1/groups/${MG}/members`, { method: 'POST', body: { membership_number: A.membership_number } });
      ctx.assert(readdA._ok, `A deliberately re-added to the audience (${readdA._status})`);
      const run4 = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assertEqual(run4.cooldown_skipped, 1, `cooldown blocked A's new episode (${run4.cooldown_skipped})`);
      ctx.assertEqual(run4.fired, 0, 'nobody fired under cooldown');

      const dropCooldown = await ctx.fetch(`/v1/meds/${MED1}`, { method: 'PUT', body: { cooldown_days: null } });
      ctx.assert(dropCooldown._ok, `cooldown cleared (${dropCooldown._status})`);
      const run5 = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assertEqual(run5.fired, 1, `A fired again — a NEW episode (${run5.fired})`);
      const aRows = (await db.query(
        `SELECT COUNT(*)::int AS n FROM med_identification WHERE med_link = $1 AND member_link = $2`,
        [medLink, A.link])).rows[0].n;
      ctx.assertEqual(Number(aRows), 2, `A has two episode rows (${aRows})`);

      await ctx.fetch(`/v1/groups/${MG}/members/${A.membership_number}`, { method: 'DELETE' });
      const run6 = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assertEqual(run6.cleared, 1, `A's second episode cleared (${run6.cleared})`);
      await ctx.fetch(`/v1/groups/${MG}/members`, { method: 'POST', body: { membership_number: A.membership_number } });
      const run7 = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assertEqual(run7.cap_skipped, 1, `lifetime cap 2 stops A forever (${run7.cap_skipped})`);
      ctx.assertEqual(run7.fired, 0, 'nobody fired at the cap');

      // A fired twice total → two type-M activities, 250 points each
      const aPointsActs = Number((await db.query(`
        SELECT COUNT(*)::int AS n FROM activity a
        JOIN "5_data_3" d ON d.p_link = a.link AND d.attaches_to = 'A'
        JOIN molecule_def md ON md.molecule_id = d.molecule_id
        WHERE a.p_link IS NOT NULL AND a.activity_type = 'M' AND a.p_link = $1
          AND md.molecule_key = 'MED_LINK' AND md.tenant_id = $2 AND d.c1 = $3`,
        [A.link, tenantId, medLink])).rows[0].n);
      ctx.assertEqual(aPointsActs, 2, `A carries exactly two MED points activities (${aPointsActs})`);

      // ── 6. Date window ──
      ctx.log('Step 6: a MED outside its window refuses to run');
      const pastDates = await ctx.fetch(`/v1/meds/${MED1}`, {
        method: 'PUT', body: { start_date: '2020-01-01', end_date: '2020-12-31' } });
      ctx.assert(pastDates._ok, `dates moved to the past (${pastDates._status})`);
      const runPast = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assert(runPast._status === 400 && /window/i.test(runPast.error || ''),
        `out-of-window run refused in plain English (${runPast.error})`);
      await ctx.fetch(`/v1/meds/${MED1}`, { method: 'PUT', body: { start_date: '2020-01-01', end_date: '2030-12-31' } });

      // ── 7. DAYS_SINCE_LAST_ACTIVITY — JS/SQL parity through 'gt' ──
      ctx.log("Step 7: the member-fact molecule agrees with its SQL twin, via the editor's 'gt' spelling");
      const med3 = await ctx.fetch('/v1/meds', {
        method: 'POST', body: { med_code: MED3, med_name: 'quiet 60', start_date: '2020-01-01', end_date: '2030-12-31' } });
      ctx.assert(med3._ok, `${MED3} created (${med3._status})`);
      const critDays = await ctx.fetch(`/v1/meds/${MED3}/criteria`, {
        method: 'POST',
        body: { source: 'Member', molecule: 'DAYS_SINCE_LAST_ACTIVITY', operator: 'gt', value: 60, label: 'quiet 60+' }
      });
      ctx.assert(critDays._ok, `days-since criterion saved with operator 'gt' (${critDays._status})`);
      const expectedQuiet = Number((await db.query(`
        SELECT COUNT(*)::int AS n FROM member m
        WHERE m.tenant_id = $1 AND m.is_active = true
          AND get_days_since_last_activity(m.link) > 60`, [tenantId])).rows[0].n);
      const prevDays = await ctx.fetch(`/v1/meds/${MED3}/preview`, { method: 'POST' });
      ctx.assert(prevDays._ok, `days-since preview answers (${prevDays._status})`);
      ctx.assertEqual(prevDays.match_count, expectedQuiet,
        `JS evaluation matches the SQL function exactly (${prevDays.match_count}/${expectedQuiet}) — NULL (never active) matches neither`);
      ctx.assert(expectedQuiet < prevDays.checked,
        `the criterion actually filters (${expectedQuiet} of ${prevDays.checked})`);

      // 'between' — real since S157 (it sat in the editor for years with no
      // engine code and silently passed). Inclusive, [low, high], SQL parity.
      const oldCrit = await ctx.fetch(`/v1/meds/${MED3}/criteria`);
      for (const c of oldCrit) {
        await ctx.fetch(`/v1/meds/${MED3}/criteria/${c.id}`, { method: 'DELETE' });
      }
      const critBetween = await ctx.fetch(`/v1/meds/${MED3}/criteria`, {
        method: 'POST',
        body: { source: 'Member', molecule: 'DAYS_SINCE_LAST_ACTIVITY', operator: 'between', value: [10, 400], label: 'quiet 10-400' }
      });
      ctx.assert(critBetween._ok, `between criterion saved (${critBetween._status})`);
      const expectedBetween = Number((await db.query(`
        SELECT COUNT(*)::int AS n FROM member m
        WHERE m.tenant_id = $1 AND m.is_active = true
          AND get_days_since_last_activity(m.link) BETWEEN 10 AND 400`, [tenantId])).rows[0].n);
      const prevBetween = await ctx.fetch(`/v1/meds/${MED3}/preview`, { method: 'POST' });
      ctx.assert(prevBetween._ok, `between preview answers (${prevBetween._status})`);
      ctx.assertEqual(prevBetween.match_count, expectedBetween,
        `between matches SQL's BETWEEN exactly (${prevBetween.match_count}/${expectedBetween})`);
      ctx.assert(expectedBetween > 0, `the between range actually catches someone (${expectedBetween})`);

      // Malformed bounds (one value) must FAIL for everyone — never pass
      const critList = await ctx.fetch(`/v1/meds/${MED3}/criteria`);
      for (const c of critList) {
        await ctx.fetch(`/v1/meds/${MED3}/criteria/${c.id}`, { method: 'DELETE' });
      }
      await ctx.fetch(`/v1/meds/${MED3}/criteria`, {
        method: 'POST',
        body: { source: 'Member', molecule: 'DAYS_SINCE_LAST_ACTIVITY', operator: 'between', value: [5], label: 'broken between' }
      });
      const prevBroken = await ctx.fetch(`/v1/meds/${MED3}/preview`, { method: 'POST' });
      ctx.assertEqual(prevBroken.match_count, 0,
        `malformed between bounds match NOBODY — the silent-pass hole stays closed (${prevBroken.match_count})`);

      // ── 8. Delete rules ──
      ctx.log('Step 8: fired = delete refused; never-fired = deletes clean');
      const delFired = await ctx.fetch(`/v1/meds/${MED1}`, { method: 'DELETE' });
      ctx.assert(delFired._status === 409 && /deactivate/i.test(delFired.error || ''),
        `fired MED refuses deletion, points to deactivate (${delFired.error})`);
      const deact = await ctx.fetch(`/v1/meds/${MED1}`, { method: 'PUT', body: { is_active: false } });
      ctx.assert(deact._ok, 'deactivate (the retirement path) works');
      const runInactive = await ctx.fetch(`/v1/meds/${MED1}/run`, { method: 'POST' });
      ctx.assert(runInactive._status === 400 && /deactivated/i.test(runInactive.error || ''),
        `deactivated MED refuses to run (${runInactive.error})`);

      const med3Rule = (await db.query(
        `SELECT rule_id FROM med WHERE tenant_id = $1 AND med_code = $2`, [tenantId, MED3])).rows[0].rule_id;
      const delClean = await ctx.fetch(`/v1/meds/${MED3}`, { method: 'DELETE' });
      ctx.assert(delClean._ok, `never-fired MED deletes clean (${delClean._status})`);
      const leftovers = Number((await db.query(`
        SELECT (SELECT COUNT(*) FROM med WHERE tenant_id = $1 AND med_code = $2)
             + (SELECT COUNT(*) FROM rule_criteria WHERE rule_id = $3)
             + (SELECT COUNT(*) FROM rule WHERE rule_id = $3) AS n`,
        [tenantId, MED3, med3Rule])).rows[0].n);
      ctx.assertEqual(leftovers, 0, 'clean delete left zero rows (med, rule, criteria)');

      // ── 9. Tenant isolation ──
      ctx.log('Step 9: another program cannot see the MED');
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 2 } });
      const foreign = await ctx.fetch(`/v1/meds/${MED1}`);
      ctx.assertEqual(foreign._status, 404, `tenant 2 sees no ${MED1} (${foreign._status})`);
      const foreignList = await ctx.fetch('/v1/meds');
      ctx.assert(foreignList._ok && !foreignList.some(d => d.med_code === MED1),
        "tenant 2's MED list is clean of it");
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });

      ctx.log('Manual MEDS: definition, preview, run, episodes, manners, results, parity, isolation — all proven');
    } finally {
      await db.end();
    }
  }
};
