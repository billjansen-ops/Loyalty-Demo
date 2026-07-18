/**
 * Core: bulk molecule reads (Session 136) — bulkGetMoleculeValues +
 * moleculeJoinSQL/moleculeCondSQL replace the N+1 loops and every hand-tuned
 * 5_data_* join in the survey-join family. The proof is output parity on
 * live data: the endpoints that adopted the new door must serve the same
 * numbers the OLD hand-written SQL produces (frozen below, resolved with
 * $-free subselects so no binary link ever rides the shell).
 *
 *   1. Wellness roster (wi_php): referral-source counts, licensing-board
 *      counts, and clinic counts from GET /v1/wellness/members must equal
 *      frozen direct-SQL aggregates over the same molecule rows (clinician
 *      exclusion applied, like the endpoint's FILTER_MEMBER_LIST hook).
 *   2. Member timeline (Delta 1002): activity count and total base_points
 *      from GET /v1/member/1002/activities must equal the frozen pre-136
 *      timeline SQL (MEMBER_POINTS sum per activity, soft-deletes excluded).
 *
 * Read-only — no data is created or mutated.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const CONN = `-h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'}`;

function sql(query) {
  return execSync(`${PSQL} ${CONN} -t -A -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

module.exports = {
  name: 'Core: bulk molecule reads (endpoint parity vs frozen hand-written SQL)',

  async run(ctx) {
    // ── 1. Wellness roster parity (wi_php, tenant 5) ──
    ctx.log('Step 1: wellness roster — bulk-read fields vs frozen SQL aggregates');
    const T5 = 5;
    const MOL = (key) => `(SELECT molecule_id FROM molecule_def WHERE tenant_id = ${T5} AND UPPER(molecule_key) = '${key}')`;
    // The endpoint's roster excludes clinicians (FILTER_MEMBER_LIST → IS_CLINICIAN flag)…
    const NOT_CLINICIAN = `NOT EXISTS (SELECT 1 FROM "5_data_0" f WHERE f.p_link = m.link
                      AND f.molecule_id = ${MOL('IS_CLINICIAN')} AND f.attaches_to = 'M')`;
    // …and registrants (Session 142 intake rebuild): the roster is
    // participants only — a member whose INTAKE_STATUS is any
    // non-Participant value lives on the Intake Queue, not here. No status
    // row = fail-open = on the roster, mirroring the endpoint. This also
    // keeps parity when an earlier suite test dispositioned someone
    // (route-to-resources etc.) — the suite restores the DB once at the
    // end, not between tests.
    const NOT_REGISTRANT = `NOT EXISTS (SELECT 1 FROM "5_data_1" s WHERE s.p_link = m.link
                      AND s.molecule_id = ${MOL('INTAKE_STATUS')} AND s.attaches_to = 'M'
                      AND ascii(s.c1)-1 <> (SELECT value_id FROM molecule_value_text
                        WHERE molecule_id = ${MOL('INTAKE_STATUS')} AND text_value = 'PARTICIPANT'))`;
    const MEMBER_JOIN = `JOIN member m ON m.link = d.p_link AND m.tenant_id = ${T5} AND m.is_active = true AND ${NOT_CLINICIAN} AND ${NOT_REGISTRANT}`;

    // Tenant switch (harness superuser), then the endpoint
    await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: T5 } });
    const wellness = await ctx.fetch('/v1/wellness/members');
    ctx.assert(wellness._ok, 'Wellness roster responds OK');
    const roster = wellness.members || [];
    ctx.assert(roster.length > 0, `Roster has members (${roster.length})`);

    const rosterCount = parseInt(sql(`SELECT COUNT(*) FROM member m WHERE m.tenant_id = ${T5} AND m.is_active = true AND ${NOT_CLINICIAN} AND ${NOT_REGISTRANT}`), 10);
    ctx.assertEqual(roster.length, rosterCount, `Roster size matches direct SQL (${rosterCount})`);

    // Referral-source counts (REFERRAL_SOURCE: 1-byte internal list; stored
    // byte = squished per-molecule value_id — ASCII(c1)-1 decodes it, allowed
    // here as §7 read-only verification)
    const endpointRefCounts = {};
    for (const m of roster) {
      if (m.referral_source?.code) endpointRefCounts[m.referral_source.code] = (endpointRefCounts[m.referral_source.code] || 0) + 1;
    }
    const sqlRefRows = sql(`
      SELECT mvt.text_value || ':' || COUNT(*) FROM "5_data_1" d
      ${MEMBER_JOIN}
      JOIN molecule_value_text mvt ON mvt.molecule_id = ${MOL('REFERRAL_SOURCE')} AND mvt.value_id = ASCII(d.c1) - 1
      WHERE d.molecule_id = ${MOL('REFERRAL_SOURCE')} AND d.attaches_to = 'M'
      GROUP BY mvt.text_value ORDER BY mvt.text_value`);
    const sqlRefCounts = {};
    for (const line of sqlRefRows.split('\n').filter(Boolean)) {
      const [code, n] = line.split(':');
      sqlRefCounts[code] = parseInt(n, 10);
    }
    ctx.assertEqual(JSON.stringify(endpointRefCounts, Object.keys(endpointRefCounts).sort()),
                    JSON.stringify(sqlRefCounts, Object.keys(sqlRefCounts).sort()),
                    'Referral-source counts match frozen SQL exactly');

    // Licensing-board counts (2-byte 'key' storage: board_id = n1 + 32768)
    const endpointBoardCounts = {};
    for (const m of roster) {
      if (m.licensing_board?.board_code) endpointBoardCounts[m.licensing_board.board_code] = (endpointBoardCounts[m.licensing_board.board_code] || 0) + 1;
    }
    const sqlBoardRows = sql(`
      SELECT lb.board_code || ':' || COUNT(*) FROM "5_data_2" d
      ${MEMBER_JOIN}
      JOIN licensing_board lb ON lb.licensing_board_id = d.n1 + 32768
      WHERE d.molecule_id = ${MOL('LICENSING_BOARD')} AND d.attaches_to = 'M'
      GROUP BY lb.board_code ORDER BY lb.board_code`);
    const sqlBoardCounts = {};
    for (const line of sqlBoardRows.split('\n').filter(Boolean)) {
      const [code, n] = line.split(':');
      sqlBoardCounts[code] = parseInt(n, 10);
    }
    ctx.assertEqual(JSON.stringify(endpointBoardCounts, Object.keys(endpointBoardCounts).sort()),
                    JSON.stringify(sqlBoardCounts, Object.keys(sqlBoardCounts).sort()),
                    'Licensing-board counts match frozen SQL exactly');

    // Clinic counts (PARTNER_PROGRAM col 2 'key': program_id = n2 + 32768)
    const endpointClinicCounts = {};
    for (const m of roster) {
      if (m.program_name && m.program_name !== 'Unassigned') endpointClinicCounts[m.program_name] = (endpointClinicCounts[m.program_name] || 0) + 1;
    }
    const sqlClinicRows = sql(`
      SELECT pp.program_name || ':' || COUNT(*) FROM "5_data_22" d
      ${MEMBER_JOIN}
      JOIN partner_program pp ON pp.program_id = d.n2 + 32768
      WHERE d.molecule_id = ${MOL('PARTNER_PROGRAM')} AND d.attaches_to = 'M'
      GROUP BY pp.program_name ORDER BY pp.program_name`);
    const sqlClinicCounts = {};
    for (const line of sqlClinicRows.split('\n').filter(Boolean)) {
      const [name, n] = line.split(':');
      sqlClinicCounts[name] = parseInt(n, 10);
    }
    ctx.assertEqual(JSON.stringify(endpointClinicCounts, Object.keys(endpointClinicCounts).sort()),
                    JSON.stringify(sqlClinicCounts, Object.keys(sqlClinicCounts).sort()),
                    'Clinic counts match frozen SQL exactly');

    // ── 2. Timeline parity (Delta member 1002) ──
    ctx.log('Step 2: member timeline — fragment-built query vs frozen pre-136 SQL');
    const T1 = 1;
    const MOL1 = (key) => `(SELECT molecule_id FROM molecule_def WHERE tenant_id = ${T1} AND UPPER(molecule_key) = '${key}')`;
    const MEMBER1002 = `(SELECT link FROM member WHERE tenant_id = ${T1} AND membership_number = '1002')`;

    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });
    // Limit above the member's activity count so ordering ties can't matter
    const timeline = await ctx.fetch(`/v1/member/1002/activities?tenant_id=${T1}&limit=2000`);
    ctx.assert(timeline._ok, 'Timeline responds OK');
    const acts = timeline.activities || [];
    ctx.assert(acts.length > 0, `Timeline has activities (${acts.length})`);

    // The frozen pre-136 timeline points query, verbatim shape: LEFT JOIN
    // MEMBER_POINTS by molecule_id, SUM per activity, exclude type N and
    // soft-deleted. Compare row count and total points.
    const frozen = sql(`
      SELECT COUNT(*) || '|' || COALESCE(SUM(base_points), 0) FROM (
        SELECT a.link, COALESCE(SUM(ad54.N1), 0) AS base_points
        FROM activity a
        LEFT JOIN "5_data_54" ad54 ON a.link = ad54.p_link AND ad54.molecule_id = ${MOL1('MEMBER_POINTS')}
        WHERE a.p_link = ${MEMBER1002}
          AND a.activity_type != 'N'
          AND NOT EXISTS (SELECT 1 FROM "5_data_0" fd WHERE fd.p_link = a.link
                          AND fd.molecule_id = ${MOL1('IS_DELETED')} AND fd.attaches_to = 'A')
        GROUP BY a.link
      ) t`);
    const [frozenCount, frozenSum] = frozen.split('|').map(Number);
    const endpointSum = acts.reduce((s, a) => s + (Number(a.base_points) || 0), 0);
    ctx.assertEqual(acts.length, frozenCount, `Timeline activity count matches frozen SQL (${frozenCount})`);
    ctx.assertEqual(endpointSum, frozenSum, `Timeline total base_points matches frozen SQL (${frozenSum})`);

    // Re-login as the harness user
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
