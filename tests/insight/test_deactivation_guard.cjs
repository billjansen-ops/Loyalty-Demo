/**
 * The deactivation guard (Session 155 — Erica's decision 2026-07-23,
 * master list Small Enhancement #3).
 *
 * Her words: a hard stop at the deactivation door until all open registry
 * items are addressed — "everything is completed, defensible, and no
 * safety items are left unseen or unaddressed." (Background: deactivated
 * members are skipped by every scan, so an open item on one — the live
 * site's Erica Kind RED — would otherwise sit unprocessed forever.)
 *
 * What this proves, all through platform doors (membership numbers, the
 * member registry endpoint, the profile save, the registry resolve door):
 *   1. Deactivating a member who carries open registry items is REFUSED
 *      with a plain-English 409 that names the person, the count, and
 *      each open item (urgency, reason, opened date) — both deactivation
 *      spellings (is_active off; active_through_date moved to the past).
 *   2. An ordinary profile edit on that same member (still active) is
 *      untouched by the guard.
 *   3. Resolving the open items unlocks the door: the same deactivation
 *      then succeeds, and reactivation was never guarded.
 *   4. A tenant with no registry (Delta) deactivates exactly as before —
 *      the guard is invisible outside the workforce vertical's data.
 *
 * Self-contained: uses whoever already carries open items in the seeded
 * data; every mutation is restored by the harness snapshot.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

module.exports = {
  name: 'Insight: deactivation guard (hard stop while registry items are open)',

  async run(ctx) {
    const WI = 5, DELTA = 1;
    const db = new Client(DB_CONFIG);
    await db.connect();

    try {
      // ── Auth ──
      const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(login._ok, 'Claude login successful');
      const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WI } });
      ctx.assert(sw._ok, 'Session on Wisconsin (tenant 5)');

      // Yesterday as YYYY-MM-DD, via the platform's own SQL date functions —
      // no new Date() arithmetic in tests either.
      const yd = await db.query(`SELECT molecule_int_to_date(date_to_molecule_int(CURRENT_DATE) - 1)::text AS d,
                                        molecule_int_to_date(date_to_molecule_int(CURRENT_DATE) + 365)::text AS future`);
      const YESTERDAY = yd.rows[0].d, FUTURE = yd.rows[0].future;

      // ── Find an ACTIVE member already carrying open registry items ──
      const registry = await ctx.fetch('/v1/stability-registry?tenant_id=' + WI);
      const items = Array.isArray(registry) ? registry : (registry.items || registry.registry || []);
      ctx.assert(items.length > 0, `Open registry items exist in the seeded data (got ${items.length})`);

      let target = null, profile = null;
      for (const it of items) {
        const num = it.membership_number;
        if (!num) continue;
        const p = await ctx.fetch(`/v1/member/${num}/profile`);
        if (p._ok && p.is_active !== false) { target = num; profile = p; break; }
      }
      ctx.assert(!!target, `Found an active member with open item(s) (member ${target})`);

      const openForTarget = async () => {
        const r = await ctx.fetch(`/v1/stability-registry/member/${target}?tenant_id=${WI}`);
        const rows = Array.isArray(r) ? r : (r.items || []);
        return rows.filter(x => x.status === 'O');
      };
      const openBefore = await openForTarget();
      ctx.assert(openBefore.length > 0, `Member ${target} carries ${openBefore.length} open item(s)`);

      // The profile body the page would send (full form, active state).
      const body = (over) => ({
        membership_number: profile.membership_number, title: profile.title,
        fname: profile.fname, lname: profile.lname, middle_initial: profile.middle_initial,
        email: profile.email, phone: profile.phone, address1: profile.address1,
        address2: profile.address2, city: profile.city, state: profile.state,
        zip: profile.zip, zip_plus4: profile.zip_plus4,
        is_active: true, ...over
      });

      // ── 1. Both deactivation spellings are refused, plainly ──
      const offFlag = await ctx.fetch(`/v1/member/${target}/profile`, { method: 'PUT', body: body({ is_active: false }) });
      ctx.assert(!offFlag._ok && offFlag._status === 409, `Deactivation via the active checkbox refused with 409 (got ${offFlag._status})`);
      ctx.assert(/open registry item/.test(offFlag.error || '') && (offFlag.error || '').includes(profile.fname),
        'The refusal names the person and says open registry items block it');
      ctx.assert(Array.isArray(offFlag.open_items) && offFlag.open_items.length === openBefore.length,
        `The refusal lists ALL ${openBefore.length} open item(s)`);
      ctx.assert(offFlag.open_items.every(b => b.label && /opened \d{4}-\d{2}-\d{2}/.test(b.label)),
        'Every listed item reads urgency/reason and its opened date');

      const pastDate = await ctx.fetch(`/v1/member/${target}/profile`, { method: 'PUT', body: body({ active_through_date: YESTERDAY }) });
      ctx.assert(!pastDate._ok && pastDate._status === 409,
        `Deactivation via a past active-through date refused with the same 409 (got ${pastDate._status})`);

      // ── 2. An ordinary edit on the same member is untouched ──
      const ordinary = await ctx.fetch(`/v1/member/${target}/profile`, { method: 'PUT', body: body({ phone: profile.phone }) });
      ctx.assert(ordinary._ok, 'An ordinary profile edit (still active) saves normally despite open items');

      // ── 3. Resolving the items unlocks the door ──
      for (const it of await openForTarget()) {
        const r = await ctx.fetch(`/v1/stability-registry/${it.link}?tenant_id=${WI}`, {
          method: 'PUT',
          body: { status: 'R', resolution_code: 'RESOLVED', resolution_notes: 'QA: resolved to prove the deactivation guard unlocks', user_id: login.user_id }
        });
        ctx.assert(r._ok, `Open item ${it.link} resolved through the registry door`);
      }
      ctx.assertEqual((await openForTarget()).length, 0, 'No open items remain on the member');

      const nowOff = await ctx.fetch(`/v1/member/${target}/profile`, { method: 'PUT', body: body({ is_active: false }) });
      ctx.assert(nowOff._ok, 'With everything addressed, the SAME deactivation now succeeds');

      // Reactivation is never guarded.
      const backOn = await ctx.fetch(`/v1/member/${target}/profile`, { method: 'PUT', body: body({ is_active: true, active_through_date: FUTURE }) });
      ctx.assert(backOn._ok, 'Reactivation goes through the same door unguarded');

      // ── 4. Delta control: no registry, no guard, no behavior change ──
      const swd = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: DELTA } });
      ctx.assert(swd._ok, 'Switched to Delta (tenant 1)');
      const dm = await db.query(`SELECT membership_number FROM member WHERE tenant_id = $1 AND is_active IS NOT FALSE ORDER BY link LIMIT 1`, [DELTA]);
      const deltaNum = dm.rows[0].membership_number;
      const dp = await ctx.fetch(`/v1/member/${deltaNum}/profile`);
      ctx.assert(dp._ok, `Delta member ${deltaNum} profile loads`);
      const dOff = await ctx.fetch(`/v1/member/${deltaNum}/profile`, {
        method: 'PUT',
        body: { membership_number: dp.membership_number, fname: dp.fname, lname: dp.lname, middle_initial: dp.middle_initial,
                email: dp.email, phone: dp.phone, address1: dp.address1, address2: dp.address2, city: dp.city,
                state: dp.state, zip: dp.zip, zip_plus4: dp.zip_plus4, is_active: false }
      });
      ctx.assert(dOff._ok, 'A Delta member deactivates exactly as before — the guard is invisible outside the vertical');
    } finally {
      await db.end();
    }
  }
};
