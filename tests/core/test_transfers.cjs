/**
 * Core: Point Transfers (BI point-transfer session, v153).
 *
 * Member→member transfers as two linked halves through the standard doors:
 * a redemption (R, FIFO consumption) on the sender, an adjustment-style
 * accrual (J) on the receiver, one transaction end to end. The tenant's
 * transfer_mode sysparm picks expiration behavior: 'fresh' (default) =
 * arriving points get today's expiration rule; 'preserve' = consumed
 * buckets are rebuilt on the receiver under the SAME expiration rule.
 * TRANSFER_LINK rides both halves pointing at the counterpart activity;
 * direction derives from the point sign, never stored.
 *
 * Proves:
 *   1. v153 census: TRANSFER_LINK molecule + transfer_mode sysparm +
 *      TRANSFER redemption rule (INACTIVE) + TRANSFER adjustment
 *      (INACTIVE) on every tenant — the dropdown-invisibility contract.
 *   2. Guards in plain English: self-transfer, missing receiver, zero and
 *      negative amounts, insufficient balance (E003 path), unknown
 *      receiver 404.
 *   3. Fresh mode: balances move exactly; receiver gets ONE bucket under
 *      today's rule; both halves carry TRANSFER_LINK — byte-proven in
 *      5_data_5 (c1 = counterpart link, attaches_to = 'A').
 *   4. The transfer_mode flip takes effect WITHOUT a restart — the
 *      sysparm PUT door now updates caches.sysparm (the cache bug this
 *      session found and fixed).
 *   5. Preserve mode across TWO source buckets: receiver's per-rule
 *      deltas match the consumed amounts, and each receiving bucket
 *      carries the SAME rule_id + expire_date as its source bucket.
 *   6. MEMBER_POINTS honesty: out-activity rows sum to −amount,
 *      in-activity rows sum to +amount, one row per bucket.
 *
 * Own enrolled fixtures on Delta — snapshot/restore wipes everything.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

module.exports = {
  name: 'Core: Point transfers (fresh/preserve modes, TRANSFER_LINK, guards, v153 census)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const tenantId = 1;

    // Bucket layout for a member, keyed by rule
    const buckets = async (link) => (await db.query(
      `SELECT rule_id, expire_date, accrued, redeemed FROM member_point_bucket
       WHERE p_link = $1 ORDER BY expire_date, rule_id`, [link])).rows;
    const balance = async (link) => Number((await db.query(
      `SELECT COALESCE(SUM(accrued - redeemed), 0) AS bal FROM member_point_bucket WHERE p_link = $1`,
      [link])).rows[0].bal);

    try {
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });

      // ── 1. The v153 census — every tenant carries the transfer vocabulary ──
      ctx.log('Step 1: v153 census across every tenant');
      const census = (await db.query(`
        SELECT (SELECT COUNT(*) FROM tenant)::int AS tenants,
               (SELECT COUNT(DISTINCT tenant_id) FROM molecule_def WHERE molecule_key = 'TRANSFER_LINK')::int AS mol,
               (SELECT COUNT(DISTINCT tenant_id) FROM sysparm WHERE sysparm_key = 'transfer_mode')::int AS mode,
               (SELECT COUNT(*) FROM redemption_rule WHERE redemption_code = 'TRANSFER' AND status = 'I')::int AS red,
               (SELECT COUNT(*) FROM adjustment WHERE adjustment_code = 'TRANSFER' AND is_active = false)::int AS adj`)).rows[0];
      ctx.assertEqual(census.mol, census.tenants, `TRANSFER_LINK on every tenant (${census.mol}/${census.tenants})`);
      ctx.assertEqual(census.mode, census.tenants, `transfer_mode sysparm on every tenant`);
      ctx.assertEqual(census.red, census.tenants, `TRANSFER redemption rule on every tenant, INACTIVE (dropdown-invisible)`);
      ctx.assertEqual(census.adj, census.tenants, `TRANSFER adjustment on every tenant, INACTIVE (dropdown-invisible)`);

      // ── Fixtures: our own sender + receiver, funded through the adjustment door ──
      ctx.log('Step 2: enroll fixtures and fund the sender (two buckets, two rules)');
      const numA = (await ctx.fetch('/v1/member/next-number')).membership_number;
      const A = await ctx.fetch('/v1/member', { method: 'POST', body: { membership_number: numA, fname: 'Xfer', lname: 'Sender' } });
      ctx.assert(A._ok, `sender enrolled (${numA})`);
      const numB = (await ctx.fetch('/v1/member/next-number')).membership_number;
      const B = await ctx.fetch('/v1/member', { method: 'POST', body: { membership_number: numB, fname: 'Xfer', lname: 'Receiver' } });
      ctx.assert(B._ok, `receiver enrolled (${numB})`);
      const linkA = (await db.query(`SELECT link FROM member WHERE tenant_id=$1 AND membership_number=$2`, [tenantId, numA])).rows[0].link;
      const linkB = (await db.query(`SELECT link FROM member WHERE tenant_id=$1 AND membership_number=$2`, [tenantId, numB])).rows[0].link;

      const varAdj = (await db.query(
        `SELECT adjustment_id FROM adjustment WHERE tenant_id=$1 AND adjustment_type='V' AND is_active=true LIMIT 1`,
        [tenantId])).rows[0];
      ctx.assert(!!varAdj, 'precondition: an active variable adjustment exists on Delta');

      // Two funding adjustments in different years → at least two buckets
      // under two rules. Balances are asserted as DELTAS from the
      // post-enrollment baseline — Delta grants enrollment awards, and the
      // test must not depend on that config.
      const fund1 = await ctx.fetch(`/v1/members/${numA}/activities/adjustment`, {
        method: 'POST', body: { activity_date: '2025-03-01', adjustment_id: varAdj.adjustment_id, point_amount: 1000 }
      });
      ctx.assert(fund1._ok, `funded 1,000 dated 2025 (${fund1._status})`);
      const fund2 = await ctx.fetch(`/v1/members/${numA}/activities/adjustment`, {
        method: 'POST', body: { activity_date: '2026-03-01', adjustment_id: varAdj.adjustment_id, point_amount: 3000 }
      });
      ctx.assert(fund2._ok, `funded 3,000 dated 2026 (${fund2._status})`);

      const bucketsA0 = await buckets(linkA);
      ctx.assert(bucketsA0.length >= 2, `sender holds at least two buckets (${bucketsA0.map(b => b.rule_id).join(',')})`);
      const balA0 = await balance(linkA);
      const balB0 = await balance(linkB);
      ctx.assert(balA0 >= 4000, `sender funded (${balA0}, incl. any enrollment award)`);

      // ── 3. Guards ──
      ctx.log('Step 3: the guards refuse in plain English');
      const self = await ctx.fetch(`/v1/members/${numA}/transfers`, {
        method: 'POST', body: { to_member_id: numA, point_amount: 100 } });
      ctx.assert(!self._ok && self._status === 400 && /same member/i.test(self.error), `self-transfer refused (${self.error})`);
      const noTo = await ctx.fetch(`/v1/members/${numA}/transfers`, {
        method: 'POST', body: { point_amount: 100 } });
      ctx.assert(!noTo._ok && noTo._status === 400, 'missing receiver refused');
      const zero = await ctx.fetch(`/v1/members/${numA}/transfers`, {
        method: 'POST', body: { to_member_id: numB, point_amount: 0 } });
      ctx.assert(!zero._ok && zero._status === 400, 'zero amount refused');
      const neg = await ctx.fetch(`/v1/members/${numA}/transfers`, {
        method: 'POST', body: { to_member_id: numB, point_amount: -50 } });
      ctx.assert(!neg._ok && neg._status === 400, 'negative amount refused');
      const tooMuch = await ctx.fetch(`/v1/members/${numA}/transfers`, {
        method: 'POST', body: { to_member_id: numB, point_amount: 999999 } });
      ctx.assert(!tooMuch._ok && tooMuch._status === 400, `insufficient balance refused (${tooMuch.error})`);
      const ghost = await ctx.fetch(`/v1/members/${numA}/transfers`, {
        method: 'POST', body: { to_member_id: '000000000000', point_amount: 100 } });
      ctx.assert(!ghost._ok && ghost._status === 404, 'unknown receiver 404');
      ctx.assertEqual(await balance(linkA), balA0, 'sender untouched by refused attempts');
      ctx.assertEqual(await balance(linkB), balB0, 'receiver untouched by refused attempts');

      // ── 4. Fresh mode ──
      ctx.log('Step 4: fresh mode — balances move, one arriving bucket, TRANSFER_LINK byte-proof');
      const modeNow = await ctx.fetch('/v1/sysparms/key/transfer_mode/value');
      ctx.assertEqual(modeNow.value, 'fresh', `Delta starts in fresh mode (${modeNow.value})`);

      const t1 = await ctx.fetch(`/v1/members/${numA}/transfers`, {
        method: 'POST', body: { to_member_id: numB, point_amount: 1200, comment: 'standing-test fresh transfer' } });
      ctx.assert(t1._ok && t1.mode === 'fresh', `fresh transfer posted (mode=${t1.mode})`);
      ctx.assertEqual(await balance(linkA), balA0 - 1200, 'sender balance down exactly 1,200');
      ctx.assertEqual(await balance(linkB), balB0 + 1200, 'receiver balance up exactly 1,200');
      ctx.assertEqual(t1.to.buckets_received, 1, 'fresh mode: ONE arriving bucket under today\'s rule');

      // TRANSFER_LINK byte-proof — both directions, right side byte
      const tmol = (await db.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id=$1 AND molecule_key='TRANSFER_LINK'`, [tenantId])).rows[0].molecule_id;
      const outLink = t1.from.activity_link, inLink = t1.to.activity_link;
      const outRow = (await db.query(
        `SELECT c1, attaches_to FROM "5_data_5" WHERE p_link=$1 AND molecule_id=$2`, [outLink, tmol])).rows;
      const inRow = (await db.query(
        `SELECT c1, attaches_to FROM "5_data_5" WHERE p_link=$1 AND molecule_id=$2`, [inLink, tmol])).rows;
      ctx.assert(outRow.length === 1 && outRow[0].c1 === inLink && outRow[0].attaches_to === 'A',
        'out-half TRANSFER_LINK → in-activity (byte-proven, side A)');
      ctx.assert(inRow.length === 1 && inRow[0].c1 === outLink && inRow[0].attaches_to === 'A',
        'in-half TRANSFER_LINK → out-activity (byte-proven, side A)');

      // MEMBER_POINTS honesty on both halves
      const mpmol = (await db.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id=$1 AND molecule_key='MEMBER_POINTS'`, [tenantId])).rows[0].molecule_id;
      const mpSum = async (act) => Number((await db.query(
        `SELECT COALESCE(SUM(n1),0) AS s, COUNT(*)::int AS n FROM "5_data_54" WHERE p_link=$1 AND molecule_id=$2 AND attaches_to='A'`,
        [act, mpmol])).rows[0].s);
      ctx.assertEqual(await mpSum(outLink), -1200, 'out-activity MEMBER_POINTS sum to −1,200');
      ctx.assertEqual(await mpSum(inLink), 1200, 'in-activity MEMBER_POINTS sum to +1,200');

      // ── 5. The flip takes effect WITHOUT restart (the cache fix) ──
      ctx.log('Step 5: flip to preserve through the sysparm door — no restart');
      const flip = await ctx.fetch('/v1/sysparms/key/transfer_mode/value', {
        method: 'PUT', body: { value: 'preserve' } });
      ctx.assert(flip._ok, 'transfer_mode flipped to preserve');

      // ── 6. Preserve mode across two source buckets ──
      ctx.log('Step 6: preserve mode — bucket ages survive the move');
      const bucketsA1 = await buckets(linkA);
      // The engine's own FIFO order: redemption priority, then expire date —
      // size the amount to drain the FIRST bucket and bite 200 into the second
      const fifo = (await db.query(`
        SELECT mpb.rule_id, mpb.accrued - mpb.redeemed AS avail
        FROM member_point_bucket mpb
        LEFT JOIN point_expiration_rule per ON mpb.rule_id = per.rule_id
        LEFT JOIN point_type pt ON per.point_type_id = pt.point_type_id
        WHERE mpb.p_link = $1 AND mpb.accrued - mpb.redeemed > 0
        ORDER BY COALESCE(pt.redemption_priority, 50), mpb.expire_date`, [linkA])).rows;
      ctx.assert(fifo.length >= 2, `sender still holds ${fifo.length} funded buckets`);
      const amount2 = Number(fifo[0].avail) + 200;   // spans exactly into the second FIFO bucket
      const balA1 = await balance(linkA);
      const balB1 = await balance(linkB);
      const bucketsB_before = await buckets(linkB);
      const bByRuleBefore = new Map(bucketsB_before.map(b => [b.rule_id, Number(b.accrued) - Number(b.redeemed)]));

      const t2 = await ctx.fetch(`/v1/members/${numA}/transfers`, {
        method: 'POST', body: { to_member_id: numB, point_amount: amount2 } });
      ctx.assert(t2._ok && t2.mode === 'preserve', `preserve transfer posted (mode=${t2.mode})`);
      ctx.assert(t2.from.buckets_used === 2, `two source buckets consumed (${t2.from.buckets_used})`);
      ctx.assertEqual(await balance(linkA), balA1 - amount2, `sender balance down by ${amount2}`);
      ctx.assertEqual(await balance(linkB), balB1 + amount2, `receiver balance up by ${amount2}`);

      // Per-rule: receiver gained exactly what each source bucket gave, at the SAME rule + expire date
      const bucketsA2 = await buckets(linkA);
      const bucketsB2 = await buckets(linkB);
      const consumed = [];
      for (const b of bucketsA1) {
        const after = bucketsA2.find(x => x.rule_id === b.rule_id);
        const used = (Number(b.accrued) - Number(b.redeemed)) - (Number(after.accrued) - Number(after.redeemed));
        if (used > 0) consumed.push({ rule_id: b.rule_id, expire_date: b.expire_date, used });
      }
      ctx.assertEqual(consumed.length, 2, 'sender: exactly two buckets gave points');
      for (const c of consumed) {
        const rb = bucketsB2.find(x => x.rule_id === c.rule_id);
        ctx.assert(!!rb, `receiver holds a bucket under source rule ${c.rule_id}`);
        ctx.assertEqual(rb.expire_date, c.expire_date, `rule ${c.rule_id}: expire date survived the move (${rb.expire_date})`);
        const gained = (Number(rb.accrued) - Number(rb.redeemed)) - (bByRuleBefore.get(c.rule_id) || 0);
        ctx.assertEqual(gained, c.used, `rule ${c.rule_id}: receiver gained exactly ${c.used}`);
      }

      // In-activity carries one MEMBER_POINTS row per arriving bucket
      const rows2 = (await db.query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(n1),0) AS s FROM "5_data_54" WHERE p_link=$1 AND molecule_id=$2 AND attaches_to='A'`,
        [t2.to.activity_link, mpmol])).rows[0];
      ctx.assertEqual(rows2.n, 2, 'preserve in-activity: one MEMBER_POINTS row per arriving bucket');
      ctx.assertEqual(Number(rows2.s), amount2, `preserve in-activity rows sum to +${amount2}`);

      // ── 7. Flip back; the door reads back what it wrote ──
      const back = await ctx.fetch('/v1/sysparms/key/transfer_mode/value', {
        method: 'PUT', body: { value: 'fresh' } });
      ctx.assert(back._ok, 'flipped back to fresh');
      const readBack = await ctx.fetch('/v1/sysparms/key/transfer_mode/value');
      ctx.assertEqual(readBack.value, 'fresh', 'read-back agrees without restart');

    } finally {
      await db.end();
    }
  }
};
