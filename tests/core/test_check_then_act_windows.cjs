/**
 * Audit Tier-2 part 2 — the four check-then-act windows close (Session 145).
 *
 * Each site used to look (check/read) and then act (insert/delete+insert)
 * with nothing holding the world still in between, so two staff acting at
 * the same moment could duplicate or lose data. All four now ride one
 * transaction serialized on the member's row lock (the Session-138 accrual
 * pattern), with plain-English 409s where a human should hear "someone
 * else just did this":
 *
 *   1. Member-molecules PUT — whole profile save is one transaction;
 *      two simultaneous saves queue; exactly ONE row per field survives.
 *   2. Clinician assign — the already-assigned check happens inside the
 *      lock; the second assigner gets a 409, the chart lists the
 *      clinician once.
 *   3. ML score store — read-compare-insert rides the lock; two
 *      concurrent scoring runs write at most one new history row.
 *   4. Badge add — gained the missing duplicate guard: an overlapping
 *      same-badge period answers 409; a later, non-overlapping period is
 *      a legitimate re-award and succeeds.
 *
 * Self-contained: fresh Insight + Delta members created per run (harness
 * snapshot/restore covers everything); ML uses Steadman resolved by NAME
 * (fresh members have no feature history to score).
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const DB_HOST = process.env.DATABASE_HOST || '127.0.0.1';
const DB_USER = process.env.DATABASE_USER || 'billjansen';
const DB_NAME = process.env.DATABASE_NAME || 'loyalty';

function psql(sql) {
  const out = execSync(
    `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
  return out;
}

module.exports = {
  name: 'Core: check-then-act windows serialize on the member lock (audit Tier-2 part 2)',

  async run(ctx) {
    const WI = 5;
    const DELTA = 1;

    // ── Auth: Claude superuser, session into Insight ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WI } });
    ctx.assert(sw._ok, 'Session switched into Insight (tenant 5)');

    // ── Fresh Insight member for sites 1 + 2 ──
    const num = await ctx.fetch('/v1/member/next-number');
    const mnum = num.membership_number;
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: mnum, fname: 'Test', lname: 'CheckThenAct' }
    });
    ctx.assert(created._ok, `Created Insight member ${mnum}`);

    // ══ Site 1: member-molecules PUT — two simultaneous profile saves ══
    ctx.log('Site 1: two simultaneous profile saves → one row per field, both succeed');
    const [saveA, saveB] = await Promise.all([
      ctx.fetch(`/v1/member/${mnum}/molecules`, { method: 'PUT', body: { molecules: { REFERRAL_SOURCE: 'SELF' } } }),
      ctx.fetch(`/v1/member/${mnum}/molecules`, { method: 'PUT', body: { molecules: { REFERRAL_SOURCE: 'EMP' } } })
    ]);
    ctx.assert(saveA._ok && saveB._ok, 'both simultaneous saves succeed (serialized, not failed)');

    // Byte-level: exactly ONE member-side row — the interleaving used to
    // leave two rows (both deletes ran, then both inserts).
    const rowCount = psql(
      `SELECT COUNT(*) FROM "5_data_1"
       WHERE p_link = (SELECT link FROM member WHERE tenant_id = ${WI} AND membership_number = '${mnum}')
       AND molecule_id = (SELECT molecule_id FROM molecule_def WHERE tenant_id = ${WI} AND molecule_key = 'REFERRAL_SOURCE')
       AND attaches_to = 'M'`
    );
    ctx.assert(rowCount === '1', `exactly one REFERRAL_SOURCE row survives (got ${rowCount})`);

    const read = await ctx.fetch(`/v1/member/${mnum}/molecules?tenant_id=${WI}`);
    const val = read._ok && read.values ? read.values.REFERRAL_SOURCE : null;
    ctx.assert(val != null, `the surviving value reads back (got: ${val})`);

    // ══ Site 2: clinician assign — two simultaneous assigns ══
    ctx.log('Site 2: two simultaneous clinician assigns → one lands, one hears 409');
    const clinResp = await ctx.fetch(`/v1/clinicians?tenant_id=${WI}`);
    const clinicians = clinResp.clinicians || [];
    ctx.assert(clinicians.length > 0, `Insight has at least one clinician (got ${clinicians.length})`);
    const clinician = clinicians[0];

    const [asgA, asgB] = await Promise.all([
      ctx.fetch(`/v1/members/${mnum}/clinicians?tenant_id=${WI}`, {
        method: 'POST', body: { clinician_membership_number: clinician.membership_number }
      }),
      ctx.fetch(`/v1/members/${mnum}/clinicians?tenant_id=${WI}`, {
        method: 'POST', body: { clinician_membership_number: clinician.membership_number }
      })
    ]);
    const asgStatuses = [asgA._status, asgB._status].sort((a, b) => a - b);
    ctx.assert(asgStatuses[0] === 200 && asgStatuses[1] === 409,
      `one assign lands, the other answers 409 (got ${asgStatuses.join(',')})`);

    const assigned = await ctx.fetch(`/v1/members/${mnum}/clinicians?tenant_id=${WI}`);
    const matches = (assigned.clinicians || []).filter(c => String(c.membership_number) === String(clinician.membership_number));
    ctx.assert(matches.length === 1, `the clinician is listed exactly once (got ${matches.length})`);

    // A later re-assign hears the same plain-English refusal.
    const again = await ctx.fetch(`/v1/members/${mnum}/clinicians?tenant_id=${WI}`, {
      method: 'POST', body: { clinician_membership_number: clinician.membership_number }
    });
    ctx.assert(again._status === 409 && /already assigned/i.test(again.error || ''),
      `re-assign answers a plain-English 409 (got ${again._status}: ${again.error})`);

    // ══ Site 3: ML score — two concurrent scoring runs, at most one new row ══
    ctx.log('Site 3: two concurrent ML scores → history grows by at most one row');
    const steadman = psql(`SELECT membership_number FROM member WHERE tenant_id = ${WI} AND lname = 'Steadman' LIMIT 1`);
    ctx.assert(steadman !== '', 'Steadman resolved by name');

    const histBefore = await ctx.fetch(`/v1/ml/member/${steadman}/history?tenant_id=${WI}`);
    const beforeCount = (histBefore.history || []).length;

    const [mlA, mlB] = await Promise.all([
      ctx.fetch(`/v1/ml/member/${steadman}?tenant_id=${WI}`),
      ctx.fetch(`/v1/ml/member/${steadman}?tenant_id=${WI}`)
    ]);
    ctx.assert(mlA._ok && mlB._ok, 'both concurrent scoring calls answer 200');

    const histAfter = await ctx.fetch(`/v1/ml/member/${steadman}/history?tenant_id=${WI}`);
    const afterCount = (histAfter.history || []).length;
    const grew = afterCount - beforeCount;
    ctx.assert(grew >= 0 && grew <= 1,
      `history grew by at most one row (before ${beforeCount}, after ${afterCount}) — both runs used to insert`);

    // ══ Site 4: badge add — duplicate guard + legitimate re-award ══
    ctx.log('Site 4: badge add — simultaneous duplicate refused, later re-award allowed');
    const swD = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: DELTA } });
    ctx.assert(swD._ok, 'Session switched into Delta (tenant 1)');

    const dnum = await ctx.fetch('/v1/member/next-number');
    const dmnum = dnum.membership_number;
    const dcreated = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: dmnum, fname: 'Test', lname: 'BadgeWindow' }
    });
    ctx.assert(dcreated._ok, `Created Delta member ${dmnum}`);

    const badgeList = await ctx.fetch(`/v1/badges?tenant_id=${DELTA}`);
    const badges = Array.isArray(badgeList) ? badgeList : (badgeList.badges || []);
    ctx.assert(badges.length > 0, `Delta has at least one badge defined (got ${badges.length})`);
    const badgeCode = badges[0].badge_code;

    const period = { badge_code: badgeCode, start_date: '2020-01-01', end_date: '2020-12-31' };
    const [bA, bB] = await Promise.all([
      ctx.fetch(`/v1/members/${dmnum}/badges?tenant_id=${DELTA}`, { method: 'POST', body: period }),
      ctx.fetch(`/v1/members/${dmnum}/badges?tenant_id=${DELTA}`, { method: 'POST', body: period })
    ]);
    const bStatuses = [bA._status, bB._status].sort((a, b) => a - b);
    ctx.assert(bStatuses[0] === 200 && bStatuses[1] === 409,
      `one badge add lands, the simultaneous duplicate answers 409 (got ${bStatuses.join(',')})`);

    let held = await ctx.fetch(`/v1/members/${dmnum}/badges?tenant_id=${DELTA}`);
    ctx.assert(Array.isArray(held) && held.length === 1, `member holds the badge exactly once (got ${held.length})`);

    // Overlapping period → plain-English 409.
    const overlap = await ctx.fetch(`/v1/members/${dmnum}/badges?tenant_id=${DELTA}`, {
      method: 'POST', body: { badge_code: badgeCode, start_date: '2020-06-01' }
    });
    ctx.assert(overlap._status === 409 && /already has that badge/i.test(overlap.error || ''),
      `overlapping period answers a plain-English 409 (got ${overlap._status}: ${overlap.error})`);

    // A period AFTER the first one ended is a legitimate re-award.
    const reAward = await ctx.fetch(`/v1/members/${dmnum}/badges?tenant_id=${DELTA}`, {
      method: 'POST', body: { badge_code: badgeCode, start_date: '2021-01-01', end_date: '2021-06-30' }
    });
    ctx.assert(reAward._ok, 'a non-overlapping later period is a legitimate re-award (200)');
    held = await ctx.fetch(`/v1/members/${dmnum}/badges?tenant_id=${DELTA}`);
    ctx.assert(held.length === 2, `member now holds two distinct periods of the badge (got ${held.length})`);

    // Date honesty: the stored start date is the calendar day sent — the old
    // new Date('YYYY-MM-DD') wrapper shifted it a day in negative-UTC zones.
    const firstStart = String(held.map(b => b.start_date).sort()[0] || '');
    ctx.assert(firstStart.startsWith('2020-01-01'),
      `stored start date is the calendar day sent, no UTC day-shift (got ${firstStart})`);
  }
};
