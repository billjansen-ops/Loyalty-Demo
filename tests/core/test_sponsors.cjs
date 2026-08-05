/**
 * Core: Group Sponsors / corporate accounts (BI point-transfer session, v154).
 *
 * A sponsor is a MEMBER (a company is just a member) attached to a member
 * group with a divvy in basis points of the ORIGINAL base points: child_bp
 * scales what the group member earns of their own base (bonuses then amplify
 * the SCALED base), sponsor_bp is the sponsor's independent slice — they need
 * not total 100. The sponsor's award is its OWN accrual (adjustment door,
 * INACTIVE 'SPONSOR' code), in the sponsor's configured point type, carrying
 * SPONSOR_SOURCE_LINK back to the originating activity. Sponsor earnings
 * never re-enter bonus/promotion evaluation.
 *
 * Proves:
 *   1. v154 census: SPONSOR_SOURCE_LINK molecule + INACTIVE SPONSOR
 *      adjustment on every tenant.
 *   2. Definition guards in plain English: sponsor inside its own group
 *      refused; percentages outside 0–100 refused; unknown sponsor 404;
 *      unsponsored group GET 404; one sponsor per group (PUT is upsert).
 *   3. Full divvy at 100/10: member earns full base; sponsor's own J
 *      activity carries exactly round(10% of base) in the CONFIGURED point
 *      type; SPONSOR_SOURCE_LINK byte-proven → the originating activity.
 *   4. Child scaling at 50/10: the member's activity-level points are
 *      round(50% of base) while the sponsor still earns 10% of the
 *      ORIGINAL base (both slices independent, same denominator).
 *   5. A member REMOVED from the group earns full base again and generates
 *      no sponsor award; an INACTIVE sponsor is inert.
 *
 * Own enrolled fixtures on Delta (assertions are activity-level and
 * delta-based — enrollment awards and auto-promotions never touch them).
 * Snapshot/restore wipes everything.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty',
  // One clock (S167): pin the test's Postgres session to the MACHINE's
  // timezone so date_to_molecule_int(CURRENT_DATE) answers the same
  // "today" the platform's JS date helpers compute. Without the pin, a
  // Postgres server configured in another zone answers a different day
  // for part of every day (found in Bangalore: IST machine, Central
  // Postgres — every IST morning until 10:30 the two clocks disagreed).
  options: `-c TimeZone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`
};

// Same route + class every time → the server's calc lands on the same base
const FLIGHT = { carrier: 'DL', origin: 'MSP', destination: 'LAX', fare_class: 'Y',
                 flight_number: '900', mqd: 100, seat_type: 'W', base_points: 1000 };

module.exports = {
  name: 'Core: Group sponsors / corporate accounts (divvy, own accrual, SPONSOR_SOURCE_LINK, v154 census)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const tenantId = 1;

    // The member's own points on their NEWEST type-A activity (activity-level,
    // immune to enrollment awards and promotion noise).
    // link_bytes(link, 5), NOT the bare CHAR column: bpchar comparison
    // ignores trailing spaces, and a link whose LAST byte is 0x20 (space —
    // a legal squish byte, ~1 in 127 allocations) sorts as if it were four
    // bytes long. Bit us on CI where suite-order link allocation landed an
    // accrual exactly there. (Not ::bytea either — that goes through the
    // bytea literal parser and dies on backslash bytes; link_bytes is the
    // one door, v155.)
    const newestActivity = async (link, type) => (await db.query(
      `SELECT a.link FROM activity a WHERE a.p_link = $1 AND a.activity_type = $2 ORDER BY link_bytes(a.link, 5) DESC LIMIT 1`,
      [link, type])).rows[0]?.link;
    const activityPoints = async (actLink, mpmol) => Number((await db.query(
      `SELECT COALESCE(SUM(n1),0) AS s FROM "5_data_54" WHERE p_link=$1 AND molecule_id=$2 AND attaches_to='A'`,
      [actLink, mpmol])).rows[0].s);
    const jCount = async (link) => Number((await db.query(
      `SELECT COUNT(*)::int AS n FROM activity WHERE p_link = $1 AND activity_type = 'J'`, [link])).rows[0].n);

    try {
      const loginRes = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(loginRes._ok, `login (${loginRes._status})`);
      const bindRes = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });
      ctx.assert(bindRes._ok, `tenant bind to Delta (${bindRes._status}${bindRes.error ? ': ' + bindRes.error : ''})`);

      // ── 1. Census ──
      ctx.log('Step 1: v154 census across every tenant');
      const census = (await db.query(`
        SELECT (SELECT COUNT(*) FROM tenant)::int AS tenants,
               (SELECT COUNT(DISTINCT tenant_id) FROM molecule_def WHERE molecule_key = 'SPONSOR_SOURCE_LINK')::int AS mol,
               (SELECT COUNT(*) FROM adjustment WHERE adjustment_code = 'SPONSOR' AND is_active = false)::int AS adj`)).rows[0];
      ctx.assertEqual(census.mol, census.tenants, `SPONSOR_SOURCE_LINK on every tenant (${census.mol}/${census.tenants})`);
      ctx.assertEqual(census.adj, census.tenants, `SPONSOR adjustment on every tenant, INACTIVE (dropdown-invisible)`);

      const mpmol = (await db.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id=$1 AND molecule_key='MEMBER_POINTS'`, [tenantId])).rows[0].molecule_id;
      const srcmol = (await db.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id=$1 AND molecule_key='SPONSOR_SOURCE_LINK'`, [tenantId])).rows[0].molecule_id;

      // A non-default point type that has an expiration rule covering today —
      // the sponsor's corporate bucket must have somewhere to land
      const corpType = (await db.query(`
        SELECT per.point_type_id FROM point_expiration_rule per
        JOIN point_type pt ON pt.point_type_id = per.point_type_id
        WHERE per.tenant_id = $1 AND CURRENT_DATE BETWEEN per.start_date AND per.end_date
          AND pt.point_type_id <> 1
        ORDER BY per.point_type_id LIMIT 1`, [tenantId])).rows[0];
      ctx.assert(!!corpType, 'precondition: a non-default point type with a current expiration rule exists');

      // ── 2. Fixtures ──
      ctx.log('Step 2: enroll Corp + Employee, group them');
      const numCorp = (await ctx.fetch('/v1/member/next-number')).membership_number;
      ctx.assert((await ctx.fetch('/v1/member', { method: 'POST', body: { membership_number: numCorp, fname: 'Sponsor', lname: 'Corp' } }))._ok, `corp enrolled (${numCorp})`);
      const numEmp = (await ctx.fetch('/v1/member', { method: 'POST', body: { membership_number: (await ctx.fetch('/v1/member/next-number')).membership_number, fname: 'Sponsored', lname: 'Employee' } })).member?.membership_number
        || null;
      ctx.assert(!!numEmp, `employee enrolled (${numEmp})`);
      const linkCorp = (await db.query(`SELECT link FROM member WHERE tenant_id=$1 AND membership_number=$2`, [tenantId, numCorp])).rows[0].link;
      const linkEmp = (await db.query(`SELECT link FROM member WHERE tenant_id=$1 AND membership_number=$2`, [tenantId, numEmp])).rows[0].link;

      const G = 'TSPON154';
      ctx.assert((await ctx.fetch('/v1/groups', { method: 'POST', body: { group_code: G, group_name: 'Sponsor test group' } }))._ok, 'group created');
      ctx.assert((await ctx.fetch(`/v1/groups/${G}/members`, { method: 'POST', body: { membership_number: numEmp } }))._ok, 'employee in group');

      // ── 3. Definition guards ──
      ctx.log('Step 3: definition guards refuse in plain English');
      const noSponsor = await ctx.fetch(`/v1/groups/${G}/sponsor`);
      ctx.assert(!noSponsor._ok && noSponsor._status === 404, 'unsponsored group GET answers 404');
      ctx.assert((await ctx.fetch(`/v1/groups/${G}/members`, { method: 'POST', body: { membership_number: numCorp } }))._ok, 'corp temporarily in group');
      const selfSponsor = await ctx.fetch(`/v1/groups/${G}/sponsor`, {
        method: 'PUT', body: { sponsor_member_id: numCorp, child_pct: 100, sponsor_pct: 10 } });
      ctx.assert(!selfSponsor._ok && selfSponsor._status === 400 && /member of the group/i.test(selfSponsor.error),
        `sponsor inside its own group refused (${selfSponsor.error})`);
      ctx.assert((await ctx.fetch(`/v1/groups/${G}/members/${numCorp}`, { method: 'DELETE' }))._ok, 'corp removed from group');
      const badPct = await ctx.fetch(`/v1/groups/${G}/sponsor`, {
        method: 'PUT', body: { sponsor_member_id: numCorp, child_pct: 150, sponsor_pct: 10 } });
      ctx.assert(!badPct._ok && badPct._status === 400, 'percentage above 100 refused');
      const ghostSponsor = await ctx.fetch(`/v1/groups/${G}/sponsor`, {
        method: 'PUT', body: { sponsor_member_id: '000000000000', sponsor_pct: 10 } });
      ctx.assert(!ghostSponsor._ok && ghostSponsor._status === 404, 'unknown sponsor member 404');

      // ── 4. The 100/10 divvy ──
      ctx.log('Step 4: 100/10 — full earn for the member, 10% own-accrual for the sponsor');
      const def = await ctx.fetch(`/v1/groups/${G}/sponsor`, {
        method: 'PUT', body: { sponsor_member_id: numCorp, child_pct: 100, sponsor_pct: 10, point_type_id: corpType.point_type_id } });
      ctx.assert(def._ok, `sponsor defined (${def.message || def._status})`);
      const readBack = await ctx.fetch(`/v1/groups/${G}/sponsor`);
      ctx.assert(readBack._ok && readBack.sponsor_membership_number === numCorp && readBack.child_pct === 100 && readBack.sponsor_pct === 10,
        'definition reads back exactly');

      const jBefore = await jCount(linkCorp);
      const acc1 = await ctx.fetch(`/v1/members/${numEmp}/accruals`, {
        method: 'POST', body: { activity_date: '2026-08-04', ...FLIGHT } });
      ctx.assert(acc1._ok, `accrual 1 posted (${acc1._status}${acc1.error ? ': ' + acc1.error : ''})`);
      const base = Number(acc1.base_points);
      ctx.assert(base > 0, `server computed base ${base}`);

      const empAct1 = await newestActivity(linkEmp, 'A');
      ctx.assertEqual(await activityPoints(empAct1, mpmol), base, `member earned FULL base (${base}) at child 100%`);

      ctx.assertEqual(await jCount(linkCorp), jBefore + 1, 'sponsor gained exactly one own accrual');
      const corpAct1 = await newestActivity(linkCorp, 'J');
      const expectedAward = Math.round(base * 0.10);
      ctx.assertEqual(await activityPoints(corpAct1, mpmol), expectedAward, `sponsor award = round(10% of ${base}) = ${expectedAward}`);

      // The award landed in the CONFIGURED point type
      const corpBucketType = (await db.query(`
        SELECT per.point_type_id FROM "5_data_54" d
        JOIN member_point_bucket b ON b.link = d.c1
        JOIN point_expiration_rule per ON per.rule_id = b.rule_id
        WHERE d.p_link = $1 AND d.molecule_id = $2 AND d.attaches_to = 'A'`, [corpAct1, mpmol])).rows[0];
      ctx.assertEqual(corpBucketType.point_type_id, corpType.point_type_id, `award in configured point type ${corpType.point_type_id}`);

      // SPONSOR_SOURCE_LINK byte-proof → the originating activity
      const src = (await db.query(
        `SELECT c1, attaches_to FROM "5_data_5" WHERE p_link = $1 AND molecule_id = $2`, [corpAct1, srcmol])).rows;
      ctx.assert(src.length === 1 && src[0].c1 === empAct1 && src[0].attaches_to === 'A',
        'SPONSOR_SOURCE_LINK → originating activity (byte-proven, side A)');

      // ── 5. The 50/10 divvy — independent slices of the SAME base ──
      ctx.log('Step 5: 50/10 — member scaled, sponsor unchanged');
      ctx.assert((await ctx.fetch(`/v1/groups/${G}/sponsor`, {
        method: 'PUT', body: { sponsor_member_id: numCorp, child_pct: 50, sponsor_pct: 10, point_type_id: corpType.point_type_id } }))._ok, 'divvy flipped to 50/10');
      const acc2 = await ctx.fetch(`/v1/members/${numEmp}/accruals`, {
        method: 'POST', body: { activity_date: '2026-08-04', ...FLIGHT } });
      ctx.assert(acc2._ok, 'accrual 2 posted');
      const base2 = Number(acc2.base_points);
      const empAct2 = await newestActivity(linkEmp, 'A');
      ctx.assertEqual(await activityPoints(empAct2, mpmol), Math.round(base2 * 0.5), `member earned round(50% of ${base2})`);
      const corpAct2 = await newestActivity(linkCorp, 'J');
      ctx.assert(corpAct2 !== corpAct1, 'sponsor gained a second own accrual');
      ctx.assertEqual(await activityPoints(corpAct2, mpmol), Math.round(base2 * 0.10), `sponsor still earns 10% of the ORIGINAL base`);

      // ── 6. Removal and deactivation are inert ──
      ctx.log('Step 6: removed member and inactive sponsor generate nothing');
      ctx.assert((await ctx.fetch(`/v1/groups/${G}/members/${numEmp}`, { method: 'DELETE' }))._ok, 'employee removed from group');
      const jAfterTwo = await jCount(linkCorp);
      const acc3 = await ctx.fetch(`/v1/members/${numEmp}/accruals`, {
        method: 'POST', body: { activity_date: '2026-08-04', ...FLIGHT } });
      ctx.assert(acc3._ok, 'accrual 3 posted (member no longer in group)');
      const empAct3 = await newestActivity(linkEmp, 'A');
      ctx.assertEqual(await activityPoints(empAct3, mpmol), Number(acc3.base_points), 'removed member earns FULL base again');
      ctx.assertEqual(await jCount(linkCorp), jAfterTwo, 'no sponsor award for a removed member');

      // Deliberate re-add (a person), then deactivate the sponsorship
      ctx.assert((await ctx.fetch(`/v1/groups/${G}/members`, { method: 'POST', body: { membership_number: numEmp } }))._ok, 'employee deliberately re-added');
      ctx.assert((await ctx.fetch(`/v1/groups/${G}/sponsor`, {
        method: 'PUT', body: { sponsor_member_id: numCorp, child_pct: 50, sponsor_pct: 10, point_type_id: corpType.point_type_id, is_active: false } }))._ok, 'sponsorship deactivated');
      const acc4 = await ctx.fetch(`/v1/members/${numEmp}/accruals`, {
        method: 'POST', body: { activity_date: '2026-08-04', ...FLIGHT } });
      ctx.assert(acc4._ok, 'accrual 4 posted (sponsor inactive)');
      const empAct4 = await newestActivity(linkEmp, 'A');
      ctx.assertEqual(await activityPoints(empAct4, mpmol), Number(acc4.base_points), 'inactive sponsor: member earns FULL base (no child scaling)');
      ctx.assertEqual(await jCount(linkCorp), jAfterTwo, 'inactive sponsor: no award');

    } finally {
      await db.end();
    }
  }
};
