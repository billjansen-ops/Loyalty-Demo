/**
 * Workforce Monitoring (Insight) — the monitoring + toxicology core,
 * Story 1: configuration doors (Session 166; docs/MONITORING_CORE_DESIGN.md
 * is the contract — Erica's WPHP rank 1, "build as one block").
 *
 *   - GET/POST/PUT/DELETE /v1/collection-sites(/:id)
 *   - GET/POST/PUT/DELETE /v1/test-paradigms(/:id)
 *   - GET/PUT /v1/members/:id/paradigm  (assignment + history)
 *
 * Collection sites are a simple program-owned list (Bill's ruling — the
 * shared-directory treatment can come later). Paradigms are the named
 * testing recipes the story-2 selection engine will read. Deletes REFUSE
 * when anything references the row (the S159 reward-object lesson);
 * retiring via is_active is the everyday path. The per-member assignment
 * is TEMPORAL like member_tier: ending stamps end_date, a new assignment
 * is a new row, history never rewritten. Assignment changes write the
 * member 'E' audit so they surface on the chart timeline (the
 * licensing-board precedent).
 */

export function register(app, ctx) {
  const { resolveMember, logAudit } = ctx;
  const { platformToday, moleculeIntToDate, formatDateLocal } = ctx.dates;

  // ── Collection sites ──────────────────────────────────────────────

  app.get('/v1/collection-sites', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const r = await dbClient.query(
        `SELECT collection_site_id, site_code, site_name, address, phone, hours, is_active
         FROM collection_site WHERE tenant_id = $1 ORDER BY site_name`, [tenantId]);
      res.json(r.rows);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  app.post('/v1/collection-sites', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { site_code, site_name, address, phone, hours } = req.body || {};
    if (!site_code || !site_name) return res.status(400).json({ error: 'site_code and site_name required' });
    try {
      const r = await dbClient.query(
        `INSERT INTO collection_site (tenant_id, site_code, site_name, address, phone, hours)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tenantId, String(site_code).trim().toUpperCase(), String(site_name).trim(),
         address || null, phone || null, hours || null]);
      res.json(r.rows[0]);
    } catch (e) {
      if (String(e.message).includes('duplicate key')) {
        return res.status(409).json({ error: `A site with code '${String(site_code).trim().toUpperCase()}' already exists in this program` });
      }
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });

  app.put('/v1/collection-sites/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { site_name, address, phone, hours, is_active } = req.body || {};
    try {
      const r = await dbClient.query(
        `UPDATE collection_site SET site_name = COALESCE($2, site_name), address = COALESCE($3, address),
           phone = COALESCE($4, phone), hours = COALESCE($5, hours), is_active = COALESCE($6, is_active)
         WHERE collection_site_id = $1 AND tenant_id = $7 RETURNING *`,
        [req.params.id, site_name, address, phone, hours, is_active, tenantId]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  app.delete('/v1/collection-sites/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      // Tenant ownership FIRST — the reference check must never answer for
      // another tenant's row (a 409 there would be a cross-tenant oracle).
      const mine = await dbClient.query(
        `SELECT collection_site_id FROM collection_site WHERE collection_site_id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]);
      if (!mine.rows.length) return res.status(404).json({ error: 'Not found' });
      const used = await dbClient.query(
        `SELECT COUNT(*)::int AS n FROM member_paradigm WHERE collection_site_id = $1`, [req.params.id]);
      if (used.rows[0].n > 0) {
        return res.status(409).json({ error: `This site is referenced by ${used.rows[0].n} participant assignment(s) — retire it instead (history keeps the reference)` });
      }
      await dbClient.query(
        `DELETE FROM collection_site WHERE collection_site_id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]);
      res.json({ deleted: true });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // ── Testing paradigms ─────────────────────────────────────────────

  app.get('/v1/test-paradigms', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const r = await dbClient.query(
        `SELECT p.paradigm_id, p.paradigm_code, p.paradigm_name, p.tests_per_period, p.period,
                p.min_gap_days, p.weekdays_only, p.is_active,
                (SELECT COUNT(*)::int FROM member_paradigm mp
                 WHERE mp.paradigm_id = p.paradigm_id AND mp.end_date IS NULL) AS assigned_count
         FROM test_paradigm p WHERE p.tenant_id = $1 ORDER BY p.paradigm_name`, [tenantId]);
      res.json(r.rows);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  app.post('/v1/test-paradigms', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { paradigm_code, paradigm_name, tests_per_period, period, min_gap_days, weekdays_only } = req.body || {};
    if (!paradigm_code || !paradigm_name) return res.status(400).json({ error: 'paradigm_code and paradigm_name required' });
    const n = parseInt(tests_per_period);
    if (isNaN(n) || n < 1) return res.status(400).json({ error: 'tests_per_period must be a positive number' });
    const per = String(period || 'month');
    if (!['month', 'quarter', 'year'].includes(per)) {
      return res.status(400).json({ error: "period must be 'month', 'quarter', or 'year'" });
    }
    const gap = min_gap_days === undefined || min_gap_days === null ? 0 : parseInt(min_gap_days);
    if (isNaN(gap) || gap < 0) return res.status(400).json({ error: 'min_gap_days must be 0 or more' });
    try {
      const r = await dbClient.query(
        `INSERT INTO test_paradigm (tenant_id, paradigm_code, paradigm_name, tests_per_period, period, min_gap_days, weekdays_only)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, String(paradigm_code).trim().toUpperCase(), String(paradigm_name).trim(),
         n, per, gap, weekdays_only === undefined ? true : !!weekdays_only]);
      res.json(r.rows[0]);
    } catch (e) {
      if (String(e.message).includes('duplicate key')) {
        return res.status(409).json({ error: `A paradigm with code '${String(paradigm_code).trim().toUpperCase()}' already exists in this program` });
      }
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });

  app.put('/v1/test-paradigms/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { paradigm_name, tests_per_period, period, min_gap_days, weekdays_only, is_active } = req.body || {};
    if (period !== undefined && !['month', 'quarter', 'year'].includes(String(period))) {
      return res.status(400).json({ error: "period must be 'month', 'quarter', or 'year'" });
    }
    if (tests_per_period !== undefined && (isNaN(parseInt(tests_per_period)) || parseInt(tests_per_period) < 1)) {
      return res.status(400).json({ error: 'tests_per_period must be a positive number' });
    }
    try {
      const r = await dbClient.query(
        `UPDATE test_paradigm SET paradigm_name = COALESCE($2, paradigm_name),
           tests_per_period = COALESCE($3, tests_per_period), period = COALESCE($4, period),
           min_gap_days = COALESCE($5, min_gap_days), weekdays_only = COALESCE($6, weekdays_only),
           is_active = COALESCE($7, is_active)
         WHERE paradigm_id = $1 AND tenant_id = $8 RETURNING *`,
        [req.params.id, paradigm_name, tests_per_period, period, min_gap_days, weekdays_only, is_active, tenantId]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  app.delete('/v1/test-paradigms/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      // Tenant ownership FIRST (no cross-tenant oracle from the 409).
      const mine = await dbClient.query(
        `SELECT paradigm_id FROM test_paradigm WHERE paradigm_id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]);
      if (!mine.rows.length) return res.status(404).json({ error: 'Not found' });
      const used = await dbClient.query(
        `SELECT COUNT(*)::int AS n FROM member_paradigm WHERE paradigm_id = $1`, [req.params.id]);
      if (used.rows[0].n > 0) {
        return res.status(409).json({ error: `This paradigm is referenced by ${used.rows[0].n} participant assignment(s), past or present — retire it instead (history keeps the reference)` });
      }
      await dbClient.query(
        `DELETE FROM test_paradigm WHERE paradigm_id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]);
      res.json({ deleted: true });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // ── Per-participant assignment ────────────────────────────────────

  const CURRENT_SQL = `
    SELECT mp.member_paradigm_id, mp.start_date, mp.end_date,
           p.paradigm_id, p.paradigm_code, p.paradigm_name, p.tests_per_period, p.period,
           s.collection_site_id, s.site_code, s.site_name,
           u.display_name AS assigned_by_name
    FROM member_paradigm mp
    JOIN test_paradigm p ON p.paradigm_id = mp.paradigm_id
    LEFT JOIN collection_site s ON s.collection_site_id = mp.collection_site_id
    LEFT JOIN platform_user u ON u.user_id = mp.assigned_by`;

  const dateOut = (d) => d == null ? null : formatDateLocal(moleculeIntToDate(d));

  const decorateAssignment = (row) => ({
    member_paradigm_id: row.member_paradigm_id,
    paradigm_code: row.paradigm_code,
    paradigm_name: row.paradigm_name,
    tests_per_period: row.tests_per_period,
    period: row.period,
    site_code: row.site_code || null,
    site_name: row.site_name || null,
    start_date: dateOut(row.start_date),
    end_date: dateOut(row.end_date),
    assigned_by: row.assigned_by_name || null,
  });

  app.get('/v1/members/:id/paradigm', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });
      const r = await dbClient.query(
        `${CURRENT_SQL} WHERE mp.member_link = $1 AND mp.tenant_id = $2
         ORDER BY mp.start_date DESC, mp.member_paradigm_id DESC`, [member.link, tenantId]);
      const current = r.rows.find(row => row.end_date === null) || null;
      res.json({
        current: current ? decorateAssignment(current) : null,
        history: r.rows.map(decorateAssignment),
      });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // PUT /v1/members/:id/paradigm — assign (or end) the monitoring
  // paradigm. Body: { paradigm_code, site_code? } assigns;
  // { paradigm_code: null } ends the current assignment. Temporal:
  // the current row (if any) is END-DATED, never rewritten.
  app.put('/v1/members/:id/paradigm', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const { paradigm_code, site_code } = req.body || {};
    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      const cur = await dbClient.query(
        `${CURRENT_SQL} WHERE mp.member_link = $1 AND mp.tenant_id = $2 AND mp.end_date IS NULL`,
        [member.link, tenantId]);
      const oldCode = cur.rows[0]?.paradigm_code || null;
      const today = platformToday();

      if (paradigm_code === null) {
        if (!cur.rows.length) return res.status(409).json({ error: 'No active paradigm to end' });
        await dbClient.query(
          `UPDATE member_paradigm SET end_date = $1 WHERE member_paradigm_id = $2`,
          [today, cur.rows[0].member_paradigm_id]);
        await logAudit(tenantId, req.session.userId, 'member', member.link, 'E', {
          before: { testing_paradigm: oldCode }, after: { testing_paradigm: null } });
        return res.json({ success: true, current: null });
      }

      if (!paradigm_code) return res.status(400).json({ error: 'paradigm_code required (or null to end the current assignment)' });
      const p = await dbClient.query(
        `SELECT paradigm_id, paradigm_code FROM test_paradigm
         WHERE tenant_id = $1 AND paradigm_code = $2 AND is_active = true`,
        [tenantId, String(paradigm_code).trim().toUpperCase()]);
      if (!p.rows.length) return res.status(400).json({ error: `No active paradigm '${paradigm_code}' in this program` });

      let siteId = null;
      if (site_code) {
        const s = await dbClient.query(
          `SELECT collection_site_id FROM collection_site
           WHERE tenant_id = $1 AND site_code = $2 AND is_active = true`,
          [tenantId, String(site_code).trim().toUpperCase()]);
        if (!s.rows.length) return res.status(400).json({ error: `No active collection site '${site_code}' in this program` });
        siteId = s.rows[0].collection_site_id;
      }

      if (cur.rows.length) {
        await dbClient.query(
          `UPDATE member_paradigm SET end_date = $1 WHERE member_paradigm_id = $2`,
          [today, cur.rows[0].member_paradigm_id]);
      }
      await dbClient.query(
        `INSERT INTO member_paradigm (tenant_id, member_link, paradigm_id, collection_site_id, start_date, assigned_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, member.link, p.rows[0].paradigm_id, siteId, today, req.session.userId]);
      // Surface on the chart timeline (the licensing-board precedent).
      if (oldCode !== p.rows[0].paradigm_code) {
        await logAudit(tenantId, req.session.userId, 'member', member.link, 'E', {
          before: { testing_paradigm: oldCode }, after: { testing_paradigm: p.rows[0].paradigm_code } });
      }
      const after = await dbClient.query(
        `${CURRENT_SQL} WHERE mp.member_link = $1 AND mp.tenant_id = $2 AND mp.end_date IS NULL`,
        [member.link, tenantId]);
      res.json({ success: true, current: after.rows.length ? decorateAssignment(after.rows[0]) : null });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });
}

export default { register };
