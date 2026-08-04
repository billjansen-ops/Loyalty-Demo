/**
 * MONITORING CORE STORY 1 — the configuration spine (Session 166;
 * docs/MONITORING_CORE_DESIGN.md is the contract; Erica's WPHP rank 1).
 *
 * What this proves, all through real doors on the SANDBOX (a copied
 * tenant — nothing here may be Wisconsin-only):
 *   1. Collection sites: create / duplicate refusal / update / retire.
 *   2. Testing paradigms: create with validations (tests_per_period,
 *      period vocabulary), duplicate refusal, retire.
 *   3. Per-participant assignment is TEMPORAL: assign (paradigm + site),
 *      re-assign (old row end-dated, history grows), end ({paradigm_code:
 *      null}), history never rewritten. Assignment changes write the
 *      member 'E' audit (chart-timeline surfacing).
 *   4. Deletes REFUSE while referenced (paradigm and site both); an
 *      unreferenced row deletes clean.
 *   5. Tenant confinement: another tenant's list never shows these rows.
 *
 * Self-contained: stamped codes, harness snapshot/restore backstops.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

module.exports = {
  name: 'Insight: monitoring core story 1 (paradigms, collection sites, temporal assignment)',

  async run(ctx) {
    const SB = 7, WI = 5;
    const stamp = Math.floor(Math.random() * 1e9);
    const SITE = `QA-SITE-${String(stamp).slice(0, 6)}`;
    const PDGM = `QA-P-${String(stamp).slice(0, 6)}`;

    const asClaude = async (tenant) => {
      const l = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(l._ok, 'Claude login');
      const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenant } });
      ctx.assert(sw._ok, `Session on tenant ${tenant}`);
    };
    await asClaude(SB);

    // ── 1. Collection sites ──
    const s1 = await ctx.fetch('/v1/collection-sites', { method: 'POST',
      body: { site_code: SITE, site_name: 'QA Lab Downtown', address: '1 QA Way', phone: '555-0100', hours: 'M-F 7-5' } });
    ctx.assert(s1._ok && s1.site_code === SITE && s1.is_active === true, 'Site created (active)');
    const sDup = await ctx.fetch('/v1/collection-sites', { method: 'POST',
      body: { site_code: SITE, site_name: 'dup' } });
    ctx.assert(sDup._status === 409, 'Duplicate site code refuses with 409');
    const sBad = await ctx.fetch('/v1/collection-sites', { method: 'POST', body: { site_code: 'X' } });
    ctx.assert(sBad._status === 400, 'Site without a name refuses');
    const sUpd = await ctx.fetch(`/v1/collection-sites/${s1.collection_site_id}`, { method: 'PUT',
      body: { hours: 'M-Sa 6-6' } });
    ctx.assert(sUpd._ok && sUpd.hours === 'M-Sa 6-6' && sUpd.site_name === 'QA Lab Downtown',
      'Site update changes only what was sent');

    // ── 2. Testing paradigms ──
    const p1 = await ctx.fetch('/v1/test-paradigms', { method: 'POST',
      body: { paradigm_code: PDGM, paradigm_name: 'QA Twice Monthly', tests_per_period: 2, period: 'month', min_gap_days: 3 } });
    ctx.assert(p1._ok && p1.paradigm_code === PDGM && p1.weekdays_only === true,
      'Paradigm created (weekdays-only default)');
    const pZero = await ctx.fetch('/v1/test-paradigms', { method: 'POST',
      body: { paradigm_code: 'QA-Z', paradigm_name: 'z', tests_per_period: 0 } });
    ctx.assert(pZero._status === 400, 'Zero tests per period refuses');
    const pWeek = await ctx.fetch('/v1/test-paradigms', { method: 'POST',
      body: { paradigm_code: 'QA-W', paradigm_name: 'w', tests_per_period: 1, period: 'week' } });
    ctx.assert(pWeek._status === 400, "Unknown period ('week') refuses — vocabulary is month/quarter/year");
    const pDup = await ctx.fetch('/v1/test-paradigms', { method: 'POST',
      body: { paradigm_code: PDGM, paradigm_name: 'dup', tests_per_period: 1 } });
    ctx.assert(pDup._status === 409, 'Duplicate paradigm code refuses with 409');

    // ── 3. Temporal assignment ──
    const db = new Client(DB_CONFIG);
    await db.connect();
    try {
      const member = (await db.query(
        `SELECT membership_number FROM member WHERE tenant_id = $1 ORDER BY link_bytes(link, 5) LIMIT 1`, [SB])).rows[0];
      ctx.assert(!!member, `Found a sandbox member (#${member?.membership_number})`);
      const MNUM = member.membership_number;

      const eBefore = parseInt((await db.query(
        `SELECT COUNT(*) FROM audit_log_5 al
         JOIN audit_entity_type aet ON aet.link = al.p_link AND aet.table_name = 'member'
         WHERE al.action = 'E' AND aet.tenant_id = $1`, [SB])).rows[0].count);

      const baseline = await ctx.fetch(`/v1/members/${MNUM}/paradigm`);
      ctx.assert(baseline._ok, 'Assignment read works');
      const baseHistory = baseline.history.length;

      const a1 = await ctx.fetch(`/v1/members/${MNUM}/paradigm`, { method: 'PUT',
        body: { paradigm_code: PDGM, site_code: SITE } });
      ctx.assert(a1._ok && a1.current.paradigm_code === PDGM && a1.current.site_code === SITE
        && a1.current.end_date === null, 'Assigned: paradigm + site, open-ended');
      const aBadP = await ctx.fetch(`/v1/members/${MNUM}/paradigm`, { method: 'PUT',
        body: { paradigm_code: 'NOSUCH' } });
      ctx.assert(aBadP._status === 400, 'Unknown paradigm refuses');
      const aBadS = await ctx.fetch(`/v1/members/${MNUM}/paradigm`, { method: 'PUT',
        body: { paradigm_code: PDGM, site_code: 'NOSUCH' } });
      ctx.assert(aBadS._status === 400, 'Unknown site refuses');

      // Re-assign (same paradigm, no site): old row end-dates, history grows.
      const a2 = await ctx.fetch(`/v1/members/${MNUM}/paradigm`, { method: 'PUT',
        body: { paradigm_code: PDGM } });
      ctx.assert(a2._ok && a2.current.site_code === null, 'Re-assigned without a site');
      const h2 = await ctx.fetch(`/v1/members/${MNUM}/paradigm`);
      ctx.assert(h2.history.length === baseHistory + 2,
        `History grew to ${baseHistory + 2} rows — nothing rewritten (got ${h2.history.length})`);
      ctx.assert(h2.history.filter(h => h.end_date === null).length === 1,
        'Exactly ONE open assignment at a time');

      // End it.
      const aEnd = await ctx.fetch(`/v1/members/${MNUM}/paradigm`, { method: 'PUT',
        body: { paradigm_code: null } });
      ctx.assert(aEnd._ok && aEnd.current === null, 'Ended — no current paradigm');
      const reEnd = await ctx.fetch(`/v1/members/${MNUM}/paradigm`, { method: 'PUT',
        body: { paradigm_code: null } });
      ctx.assert(reEnd._status === 409, 'Ending again refuses (nothing active)');
      const h3 = await ctx.fetch(`/v1/members/${MNUM}/paradigm`);
      ctx.assert(h3.current === null && h3.history.length === baseHistory + 2
        && h3.history.every(h => h.end_date !== null),
        'History intact, every row closed');

      const eAfter = parseInt((await db.query(
        `SELECT COUNT(*) FROM audit_log_5 al
         JOIN audit_entity_type aet ON aet.link = al.p_link AND aet.table_name = 'member'
         WHERE al.action = 'E' AND aet.tenant_id = $1`, [SB])).rows[0].count);
      ctx.assert(eAfter > eBefore,
        `Assignment changes wrote member audit rows for the chart timeline (E: ${eBefore} → ${eAfter})`);

      // ── 4. Deletes refuse while referenced; clean rows delete ──
      const delP = await ctx.fetch(`/v1/test-paradigms/${p1.paradigm_id}`, { method: 'DELETE' });
      ctx.assert(delP._status === 409, 'Deleting a referenced paradigm refuses (history keeps the reference)');
      const delS = await ctx.fetch(`/v1/collection-sites/${s1.collection_site_id}`, { method: 'DELETE' });
      ctx.assert(delS._status === 409, 'Deleting a referenced site refuses');
      const retire = await ctx.fetch(`/v1/test-paradigms/${p1.paradigm_id}`, { method: 'PUT',
        body: { is_active: false } });
      ctx.assert(retire._ok && retire.is_active === false, 'Retiring the paradigm works instead');
      const assignRetired = await ctx.fetch(`/v1/members/${MNUM}/paradigm`, { method: 'PUT',
        body: { paradigm_code: PDGM } });
      ctx.assert(assignRetired._status === 400, 'A retired paradigm cannot be newly assigned');

      const pFree = await ctx.fetch('/v1/test-paradigms', { method: 'POST',
        body: { paradigm_code: `QA-F-${String(stamp).slice(0, 6)}`, paradigm_name: 'never assigned', tests_per_period: 1 } });
      const delFree = await ctx.fetch(`/v1/test-paradigms/${pFree.paradigm_id}`, { method: 'DELETE' });
      ctx.assert(delFree._ok && delFree.deleted === true, 'An unreferenced paradigm deletes clean');

      // ── 5. Tenant confinement ──
      await asClaude(WI);
      const wiSites = await ctx.fetch('/v1/collection-sites');
      const wiPdgms = await ctx.fetch('/v1/test-paradigms');
      ctx.assert(wiSites._ok && !wiSites.some(s => s.site_code === SITE),
        "Wisconsin's site list does not show the sandbox site");
      ctx.assert(wiPdgms._ok && !wiPdgms.some(p => p.paradigm_code === PDGM),
        "Wisconsin's paradigm list does not show the sandbox paradigm");
      const wiDel = await ctx.fetch(`/v1/collection-sites/${s1.collection_site_id}`, { method: 'DELETE' });
      ctx.assert(wiDel._status === 404, "Another tenant's session cannot delete the site (tenant-scoped 404)");
    } finally {
      await db.end();
    }
  }
};
