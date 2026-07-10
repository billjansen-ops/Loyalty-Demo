/**
 * Core: concurrent accruals on ONE member are serialized (Session 138, audit 1.1).
 *
 * The accrual member lock now lives on the route's transaction client and is
 * held to COMMIT, so N simultaneous accruals for the same member must line up
 * one at a time. Before this fix the FOR UPDATE was a pool autocommit no-op:
 * two racing accruals could create duplicate point buckets and double-fire
 * bonuses. This test fires 6 flights at one member in parallel and proves:
 *   1. every POST succeeds (nobody deadlocks, nobody errors),
 *   2. exactly 6 base activities land,
 *   3. the bonus children match exactly what the responses reported,
 *   4. the bucket-level accrued total moves by exactly the reported sum
 *      (a double-fire or lost update shows up here),
 *   5. no (member, rule) pair holds two buckets anywhere (v107 unique index).
 *
 * S137 suite rules honored: all assertions are RELATIVE to baselines taken in
 * this test; no dependence on other tests' state or hand-entered local data.
 * Mutates the DB — the harness snapshot/restore wipes it.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const CONN = `-h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'}`;

function sql(query) {
  return execSync(`${PSQL} ${CONN} -t -A -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

module.exports = {
  name: 'Core: concurrent accruals serialize on the member lock (audit 1.1)',

  async run(ctx) {
    const MEMBER = '2153442807';
    const N = 6;
    const today = new Date().toLocaleDateString('en-CA');
    const MEMBER_LINK_SQL = `(SELECT link FROM member WHERE tenant_id = 1 AND membership_number = '${MEMBER}')`;

    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(login._ok, 'DeltaADMIN login');

    // ── Baselines (relative — S137 rule) ──
    const actBefore = Number(sql(`SELECT COUNT(*) FROM activity WHERE p_link = ${MEMBER_LINK_SQL} AND activity_type = 'A'`));
    const bonusActBefore = Number(sql(`SELECT COUNT(*) FROM activity WHERE p_link = ${MEMBER_LINK_SQL} AND activity_type = 'N'`));
    const accruedBefore = Number(sql(`SELECT COALESCE(SUM(accrued), 0) FROM member_point_bucket WHERE p_link = ${MEMBER_LINK_SQL}`));
    ctx.log(`Baselines: ${actBefore} base activities, ${bonusActBefore} bonus children, ${accruedBefore} accrued`);

    // ── Fire N flights at the same member SIMULTANEOUSLY ──
    ctx.log(`Firing ${N} concurrent flights at member ${MEMBER}...`);
    const flights = Array.from({ length: N }, (_, i) => ctx.fetch(`/v1/members/${MEMBER}/accruals`, {
      method: 'POST',
      body: {
        activity_date: today, base_points: 100 + i, // distinct amounts — a lost update is visible in the sum
        carrier: 'DL', origin: 'MSP', destination: 'LAX',
        fare_class: 'F', seat_type: 'A', flight_number: String(200 + i), mqd: 100
      }
    }));
    const results = await Promise.all(flights);

    // 1. Every accrual succeeded — serialization means waiting, never failing
    const failures = results.filter(r => r._status !== 201);
    ctx.assert(failures.length === 0,
      `all ${N} concurrent accruals returned 201 (${failures.length} failed${failures.length ? ': ' + (failures[0].error || failures[0]._status) : ''})`);

    // 2. Exactly N base activities landed
    const actAfter = Number(sql(`SELECT COUNT(*) FROM activity WHERE p_link = ${MEMBER_LINK_SQL} AND activity_type = 'A'`));
    ctx.assert(actAfter - actBefore === N, `exactly ${N} base activities landed (${actBefore} → ${actAfter})`);

    // 3. Bonus children match what the responses reported — a double-fired
    //    bonus engine would mint extras the responses never mentioned
    const reportedBonusActivities = results.reduce((s, r) => s + (r.bonuses || []).length, 0);
    const bonusActAfter = Number(sql(`SELECT COUNT(*) FROM activity WHERE p_link = ${MEMBER_LINK_SQL} AND activity_type = 'N'`));
    ctx.assert(bonusActAfter - bonusActBefore === reportedBonusActivities,
      `bonus children match the responses exactly (${bonusActBefore} → ${bonusActAfter}, responses reported ${reportedBonusActivities})`);

    // 4. Bucket accrued moved by exactly the reported total (base + bonuses)
    const expectedDelta = results.reduce((s, r) =>
      s + Number(r.base_points || 0) + (r.bonuses || []).reduce((bs, b) => bs + Number(b.bonus_points || 0), 0), 0);
    const accruedAfter = Number(sql(`SELECT COALESCE(SUM(accrued), 0) FROM member_point_bucket WHERE p_link = ${MEMBER_LINK_SQL}`));
    ctx.assert(accruedAfter - accruedBefore === expectedDelta,
      `bucket accrued moved by exactly the reported sum (${accruedBefore} → ${accruedAfter}, expected +${expectedDelta})`);

    // 5. No duplicate buckets anywhere — the invariant the v107 unique index enforces
    const dupBuckets = Number(sql(`SELECT COUNT(*) FROM (SELECT p_link, rule_id FROM member_point_bucket GROUP BY p_link, rule_id HAVING COUNT(*) > 1) d`));
    ctx.assert(dupBuckets === 0, `no (member, rule) pair holds two buckets (${dupBuckets} duplicates)`);

    // 6. And no member+promotion pair holds two OPEN enrollments (v107 partial unique)
    const dupOpen = Number(sql(`SELECT COUNT(*) FROM (SELECT p_link, promotion_id FROM member_promotion WHERE qualify_date IS NULL GROUP BY p_link, promotion_id HAVING COUNT(*) > 1) d`));
    ctx.assert(dupOpen === 0, `no member+promotion pair holds two open enrollments (${dupOpen} duplicates)`);
  }
};
