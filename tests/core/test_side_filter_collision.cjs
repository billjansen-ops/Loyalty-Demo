/**
 * Core: side-filtered molecule reads (Session 137 Step-0 defusal) — member
 * and activity links mint from separate counters in the same 5-byte value
 * space, so once the counters cross (~member #337) two different owners can
 * hold the same p_link value. Every value-molecule read now filters
 * attaches_to (resolved by resolveRowSide, the same resolution the write
 * path stamps). This test PLANTS deliberate cross-side collisions — a row
 * with the same p_link value and molecule_id on the OTHER side — and proves
 * each read family returns only its own side:
 *
 *   1. Timeline points (moleculeJoinSQL): an 'M'-side MEMBER_POINTS row
 *      planted on a real activity link must not change the member's totals.
 *   2. Roster + profile reads (bulkGetMoleculeValues / getMoleculeRows): an
 *      'A'-side REFERRAL_SOURCE row planted on a member link must not
 *      change what the wellness roster or the member profile shows.
 *   3. Assignment find/delete (findMoleculeRow / deleteMoleculeRow): an
 *      'A'-side ASSIGNED_CLINICIAN clone must survive an unassign, not
 *      block a re-assign, and never appear in the clinician list.
 *   4. v105 coherence: the ML risk-score history reads ONE pile — every
 *      stored row for the member (the 'A'-stamped live rows were restamped
 *      to 'M', the definition's side).
 *
 * The planted rows are byte-identical to what a colliding future write
 * would leave (same encoding, other side). Links never ride the shell —
 * all planting uses SELECT-based INSERTs inside Postgres. The suite's
 * snapshot/restore wipes the plants.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const CONN = `-h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'}`;

function sql(query) {
  return execSync(`${PSQL} ${CONN} -t -A -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

module.exports = {
  name: 'Core: side-filtered molecule reads (planted cross-side collisions)',

  async run(ctx) {
    // ── 1. Timeline points ignore a planted member-side row (moleculeJoinSQL) ──
    ctx.log('Step 1: Delta timeline — M-side MEMBER_POINTS plant on an activity link');
    const T1 = 1;
    const MOL1 = (key) => `(SELECT molecule_id FROM molecule_def WHERE tenant_id = ${T1} AND UPPER(molecule_key) = '${key}')`;

    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });
    const before = await ctx.fetch(`/v1/member/1002/activities?tenant_id=${T1}&limit=2000`);
    ctx.assert(before._ok, 'Timeline responds OK before the plant');
    // The total may be ANY number (earlier suite tests redeem/adjust freely) —
    // the proof is that the planted row doesn't move it.
    const sumBefore = (before.activities || []).reduce((s, a) => s + (Number(a.base_points) || 0), 0);
    ctx.assert((before.activities || []).length > 0, `Member 1002 has activities (${(before.activities || []).length}, points ${sumBefore})`);

    // Plant: copy a real A-side points row of one of 1002's activities to the
    // 'M' side with a loud amount — the row a colliding member would own.
    const planted54 = sql(`
      INSERT INTO "5_data_54" (p_link, attaches_to, molecule_id, c1, n1)
      SELECT s.p_link, 'M', s.molecule_id, s.c1, 31000
      FROM "5_data_54" s
      JOIN activity a ON a.link = s.p_link
        AND a.p_link = (SELECT link FROM member WHERE tenant_id = ${T1} AND membership_number = '1002')
      WHERE s.molecule_id = ${MOL1('MEMBER_POINTS')} AND s.attaches_to = 'A'
      LIMIT 1
      RETURNING 1`);
    ctx.assertEqual(planted54.split('\n')[0], '1', 'Planted an M-side MEMBER_POINTS collision row');

    const after = await ctx.fetch(`/v1/member/1002/activities?tenant_id=${T1}&limit=2000`);
    const sumAfter = (after.activities || []).reduce((s, a) => s + (Number(a.base_points) || 0), 0);
    ctx.assertEqual(sumAfter, sumBefore, `Timeline totals unchanged by the M-side plant (${sumBefore})`);

    // ── wi_php scenarios need the harness superuser on tenant 5 ──
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 5 } });
    const T5 = 5;
    const MOL5 = (key) => `(SELECT molecule_id FROM molecule_def WHERE tenant_id = ${T5} AND UPPER(molecule_key) = '${key}')`;
    const MEMBER59 = `(SELECT link FROM member WHERE tenant_id = ${T5} AND membership_number = '59')`;
    const MEMBER34 = `(SELECT link FROM member WHERE tenant_id = ${T5} AND membership_number = '34')`;

    // ── 2. Roster + profile ignore a planted activity-side row ──
    ctx.log('Step 2: wi_php member 59 — A-side REFERRAL_SOURCE plant on a member link');
    const roster1 = await ctx.fetch('/v1/wellness/members');
    ctx.assert(roster1._ok, 'Wellness roster responds OK');
    const m59a = (roster1.members || []).find(m => String(m.membership_number) === '59');
    ctx.assert(m59a && m59a.referral_source?.code === 'EMP', `Member 59 referral source is EMP before the plant (${m59a?.referral_source?.code})`);

    // Plant the OTHER side with a DIFFERENT value (SELF, value_id 1 → CHR(2)),
    // the row a colliding activity would own. A leak is instantly visible.
    const planted1 = sql(`
      INSERT INTO "5_data_1" (p_link, attaches_to, molecule_id, c1)
      SELECT ${MEMBER59}, 'A', ${MOL5('REFERRAL_SOURCE')}, CHR(2)
      RETURNING 1`);
    ctx.assertEqual(planted1.split('\n')[0], '1', 'Planted an A-side REFERRAL_SOURCE collision row');

    const roster2 = await ctx.fetch('/v1/wellness/members');
    const m59b = (roster2.members || []).find(m => String(m.membership_number) === '59');
    ctx.assertEqual(m59b?.referral_source?.code, 'EMP', 'Roster still shows EMP — bulk read ignores the A-side plant');

    const profile = await ctx.fetch('/v1/member/59/molecules');
    ctx.assert(profile._ok, 'Member profile molecules respond OK');
    const refVal = profile.values?.REFERRAL_SOURCE;
    ctx.assertEqual(String(refVal), 'EMP', `Profile form still shows EMP — getMoleculeRows reads the member side only (${refVal})`);

    // ── 3. Assignment find/delete touch only their own side ──
    // Self-sufficient setup: earlier tests in the suite may have changed
    // member 34's assignments (one shared snapshot per suite run), so
    // ensure a clinician is assigned rather than assuming one.
    ctx.log('Step 3: wi_php member 34 — A-side ASSIGNED_CLINICIAN clone');
    let clinBefore = await ctx.fetch('/v1/members/34/clinicians');
    ctx.assert(clinBefore._ok, 'Clinician list responds OK');
    if ((clinBefore.clinicians || []).length === 0) {
      const allClin = await ctx.fetch('/v1/clinicians');
      ctx.assert(allClin._ok && (allClin.clinicians || []).length > 0, 'Tenant has clinicians to assign');
      const setup = await ctx.fetch('/v1/members/34/clinicians', {
        method: 'POST', body: { clinician_membership_number: allClin.clinicians[0].membership_number } });
      ctx.assert(setup._ok, 'Setup: assigned a clinician to member 34');
      clinBefore = await ctx.fetch('/v1/members/34/clinicians');
    }
    const nBefore = (clinBefore.clinicians || []).length;
    ctx.assert(nBefore >= 1, `Member 34 has a clinician assigned (${nBefore})`);
    const clinNumber = clinBefore.clinicians[0].membership_number;

    // Everything below is scoped to THIS physician-clinician pair, so other
    // assignments (whatever earlier tests left) can't disturb the counts.
    const CLIN_LINK = `(SELECT link FROM member WHERE tenant_id = ${T5} AND membership_number = '${clinNumber}')`;
    const PAIR = `p_link = ${MEMBER34} AND molecule_id = ${MOL5('ASSIGNED_CLINICIAN')} AND c1 = ${CLIN_LINK}`;

    const planted5 = sql(`
      INSERT INTO "5_data_5" (p_link, attaches_to, molecule_id, c1)
      SELECT d.p_link, 'A', d.molecule_id, d.c1
      FROM "5_data_5" d
      WHERE d.p_link = ${MEMBER34} AND d.molecule_id = ${MOL5('ASSIGNED_CLINICIAN')}
        AND d.c1 = ${CLIN_LINK} AND d.attaches_to = 'M'
      LIMIT 1
      RETURNING 1`);
    ctx.assertEqual(planted5.split('\n')[0], '1', 'Planted an A-side ASSIGNED_CLINICIAN clone');

    // The clone must not show up in the list read
    const clinPlanted = await ctx.fetch('/v1/members/34/clinicians');
    ctx.assertEqual((clinPlanted.clinicians || []).length, nBefore, `Clinician list unchanged (${nBefore}) — the A-side clone is invisible`);

    // Unassign deletes ONLY the member side; the clone survives
    const del = await ctx.fetch(`/v1/members/34/clinicians/${clinNumber}`, { method: 'DELETE' });
    ctx.assert(del._ok, 'Unassign succeeds');
    const sides = sql(`
      SELECT attaches_to || ':' || COUNT(*) FROM "5_data_5"
      WHERE ${PAIR}
      GROUP BY attaches_to ORDER BY attaches_to`);
    ctx.assertEqual(sides, 'A:1', `Unassign removed only the M row — the A-side clone survived (${sides.replace(/\n/g, ' ')})`);

    // Re-assign must succeed — the duplicate check reads the M side only
    // (unfiltered, the surviving A clone would have satisfied "already
    // assigned" and the re-assign would silently do nothing)
    const reassign = await ctx.fetch('/v1/members/34/clinicians', { method: 'POST', body: { clinician_membership_number: clinNumber } });
    ctx.assert(reassign._ok, 'Re-assign succeeds despite the A-side clone');
    const mRows = sql(`
      SELECT COUNT(*) FROM "5_data_5"
      WHERE ${PAIR} AND attaches_to = 'M'`);
    ctx.assertEqual(mRows, '1', 'Re-assign wrote the M row back');
    const clinAfter = await ctx.fetch('/v1/members/34/clinicians');
    ctx.assertEqual((clinAfter.clinicians || []).length, nBefore, `Clinician list back to ${nBefore} after the round trip`);

    // ── 4. v105: the ML history is ONE coherent pile again ──
    ctx.log('Step 4: wi_php member 34 — ML history sees every stored score');
    const dbScoreRows = parseInt(sql(`
      SELECT COUNT(*) FROM "5_data_22"
      WHERE p_link = ${MEMBER34} AND molecule_id = ${MOL5('ML_RISK_SCORE')}`), 10);
    const dbSideM = parseInt(sql(`
      SELECT COUNT(*) FROM "5_data_22"
      WHERE p_link = ${MEMBER34} AND molecule_id = ${MOL5('ML_RISK_SCORE')} AND attaches_to = 'M'`), 10);
    ctx.assertEqual(dbSideM, dbScoreRows, `All ${dbScoreRows} stored scores are on the member side (v105 restamp)`);
    const history = await ctx.fetch('/v1/ml/member/34/history');
    ctx.assert(history._ok, 'ML history responds OK');
    ctx.assertEqual((history.history || []).length, dbScoreRows, `ML history returns every stored score (${dbScoreRows})`);

    // Re-login as the harness user
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
