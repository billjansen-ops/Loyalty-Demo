/**
 * Workforce Monitoring (Insight) — the monitoring + toxicology core,
 * Story 1: configuration doors (Session 166; docs/MONITORING_CORE_DESIGN.md
 * is the contract — Erica's WPHP rank 1, "build as one block").
 *
 *   - GET/POST/PUT/DELETE /v1/collection-sites(/:id)
 *   - GET/POST/PUT/DELETE /v1/test-paradigms(/:id)
 *   - GET/PUT /v1/members/:id/paradigm  (assignment + history)
 *   - GET/POST /v1/tox-results, GET /v1/tox-results/:link,
 *     POST /v1/tox-results/:link/stage, POST /v1/tox-results/:link/void
 *     (Story 4, Session 168 — the toxicology result record + the MRO
 *     state machine; transitions/dispositions are DATA in v159's tables)
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

// ── THE SELECTION ENGINE (Story 2) ──────────────────────────────────────
// The paradigm BRAIN inside the existing BODY (design doc §2b): members
// with an active paradigm assignment are selected by THEIR paradigm's
// math; every selection is logged to test_selection AND stamps the same
// member_compliance pointers the existing DRUG_TEST_MISSED sweep watches,
// so missed-detection and its notification work unchanged from day one.
// The legacy 1-in-7 rules (compliance.js) keep covering ONLY members
// with no paradigm — one brain per member, never two.
//
// The math, per member per day: how many tests remain in the calendar
// period ÷ how many eligible days remain = today's selection probability.
// Eligibility: weekday rules and the minimum gap since the last
// selection. Quota met = quiet until the next period. Uniform spread,
// no pattern — the whole point of random testing.

// Calendar period bounds (month/quarter/year) containing a Bill-epoch day.
function periodBounds(dates, todayInt, period) {
  const d = dates.moleculeIntToDate(todayInt);
  const y = d.getFullYear(), m = d.getMonth();
  let start, end;
  if (period === 'year') {
    start = new Date(y, 0, 1); end = new Date(y, 11, 31);
  } else if (period === 'quarter') {
    const q = Math.floor(m / 3) * 3;
    start = new Date(y, q, 1); end = new Date(y, q + 3, 0);
  } else {
    start = new Date(y, m, 1); end = new Date(y, m + 1, 0);
  }
  return { startInt: dates.dateToMoleculeInt(start), endInt: dates.dateToMoleculeInt(end) };
}

// Count days from fromInt..endInt (inclusive) that satisfy the weekday
// rule. Bill-epoch day arithmetic; weekday read off the decoded date.
function eligibleDaysRemaining(dates, fromInt, endInt, weekdaysOnly) {
  let n = 0;
  for (let day = fromInt; day <= endInt; day++) {
    if (weekdaysOnly) {
      const dow = dates.moleculeIntToDate(day).getDay();
      if (dow === 0 || dow === 6) continue;
    }
    n++;
  }
  return n;
}

// Stamp the legacy compliance pointers on selection so the existing
// missed-sweep (DRUG_TEST_MISSED) and staff surfaces see the selection.
async function stampCompliancePointers(db, tenantId, memberLink, todayInt) {
  await db.query(
    `UPDATE member_compliance SET next_scheduled_date = $1, last_selected_date = $1, days_since_selected = 0
     WHERE tenant_id = $2 AND member_link = $3 AND schedule_mode = 'random' AND status = 'active'`,
    [todayInt, tenantId, memberLink]);
}

// The one run, shared by the daily job and the manual Run button.
// Returns { analyzed, selected, quotaMet }.
export async function runParadigmSelection(ctx, tenantId, db) {
  const dates = ctx.dates;
  const todayInt = dates.platformToday();
  const todayDow = dates.moleculeIntToDate(todayInt).getDay();
  const nowTs = (await db.query('SELECT timestamp_to_audit_ts(NOW()) AS ts')).rows[0].ts;

  const assignments = (await db.query(
    `SELECT mp.member_paradigm_id, mp.member_link,
            p.tests_per_period, p.period, p.min_gap_days, p.weekdays_only
     FROM member_paradigm mp
     JOIN test_paradigm p ON p.paradigm_id = mp.paradigm_id
     JOIN member m ON m.link = mp.member_link
     WHERE mp.tenant_id = $1 AND mp.end_date IS NULL
       AND p.is_active = TRUE AND m.is_active = TRUE`,
    [tenantId])).rows;

  // Clinicians are never selected — same custauth filter the legacy
  // selection uses (rows carry member_link, which is what it reads).
  const custauth = await ctx.getCustauth(tenantId);
  const monitored = await custauth('FILTER_MEMBER_LIST', assignments, { tenantId, db, molecules: ctx.molecules });

  let analyzed = 0, selected = 0, quotaMet = 0;
  for (const a of monitored) {
    analyzed++;
    // Today eligible at all?
    if (a.weekdays_only && (todayDow === 0 || todayDow === 6)) continue;

    const { startInt, endInt } = periodBounds(dates, todayInt, a.period);
    // Excused selections do NOT satisfy the quota (story 3a) — the
    // engine naturally re-rolls the test later in the period. (Erica's
    // pending re-roll-vs-drop answer flips this by counting them in.)
    const inPeriod = parseInt((await db.query(
      `SELECT COUNT(*) FROM test_selection
       WHERE member_link = $1 AND selected_date BETWEEN $2 AND $3 AND excused_ts IS NULL`,
      [a.member_link, startInt, endInt])).rows[0].count);
    const remaining = a.tests_per_period - inPeriod;
    if (remaining <= 0) { quotaMet++; continue; }

    const last = (await db.query(
      `SELECT MAX(selected_date) AS d FROM test_selection WHERE member_link = $1`,
      [a.member_link])).rows[0].d;
    if (last !== null && (todayInt - last) < Math.max(a.min_gap_days, 1)) continue;

    const daysLeft = eligibleDaysRemaining(dates, todayInt, endInt, a.weekdays_only);
    if (daysLeft <= 0) continue;
    if (Math.random() >= remaining / daysLeft) continue;

    const ins = await db.query(
      `INSERT INTO test_selection (tenant_id, member_link, member_paradigm_id, selected_date, source, created_ts)
       VALUES ($1, $2, $3, $4, 'R', $5)
       ON CONFLICT (member_link, selected_date) DO NOTHING RETURNING selection_id`,
      [tenantId, a.member_link, a.member_paradigm_id, todayInt, nowTs]);
    if (!ins.rows.length) continue;   // already selected today (e.g. manual)
    await stampCompliancePointers(db, tenantId, a.member_link, todayInt);
    selected++;
  }
  return { analyzed, selected, quotaMet };
}

// ── STORY 4: which toxicology roles does this session hold? ──────────────
// Reads the SAME role_map the document machinery uses, but WITHOUT the
// document matrix's role filter — sessionDocAccess ignores role codes the
// matrix doesn't name, so the MRO row (v159) would never resolve through
// it. Returns null under mode 'open' (roles don't resolve until the
// program flips — the excuse-door precedent), 'superuser' for a superuser
// under rules (passes, the excuse-door precedent), else the Set of role
// codes (MD/CM/PA from the platform resolver, MRO resolved here through
// the same audience machinery).
async function sessionToxRoles(ctx, db, tenantId, session) {
  const access = await ctx.documents.sessionDocAccess(tenantId, session);
  if (!access) return null;
  if (access.superuser) return 'superuser';
  const roles = new Set(access.roles);
  const r = await db.query(
    `SELECT sd.value FROM sysparm s
     JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
     WHERE s.tenant_id = $1 AND s.sysparm_key = 'document_access'
       AND sd.category = 'role_map' AND sd.code = 'MRO'`, [tenantId]);
  if (r.rows.length) {
    const v = r.rows[0].value;
    if (v === 'admin') {
      if (['admin', 'superuser'].includes(session?.role)) roles.add('MRO');
    } else {
      const m = /^position:([A-Z0-9_]+):([A-Z0-9_]+)$/.exec(v);
      if (m) {
        const holders = await ctx.molecules.findUsersByMoleculeValue(tenantId, m[1], m[2]);
        if (holders.some(h => h.user_id === session?.userId)) roles.add('MRO');
      }
    }
  }
  return roles;
}

// The state machine's one question: may THIS session move a record
// from → to? The stage SEQUENCE is enforced in every mode (a transition
// row must exist — data, never code); WHO may make it is enforced only
// under mode 'rules' (roles === null means 'open', 'superuser' passes).
async function toxTransitionCheck(db, tenantId, from, to, roles) {
  const t = await db.query(
    `SELECT role_key FROM tox_stage_transition
     WHERE tenant_id = $1 AND from_stage = $2 AND to_stage = $3`,
    [tenantId, from, to]);
  if (!t.rows.length) return { ok: false, noPath: true };
  if (roles === null || roles === 'superuser') return { ok: true };
  const allowed = t.rows.map(r => r.role_key);
  return { ok: allowed.some(rk => roles.has(rk)), allowed };
}

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

  // ── Story 2: selections, the calendar, and the manual doors ───────

  const SELECTION_SQL = `
    SELECT ts.selection_id, ts.selected_date, ts.source, ts.reason, ts.member_link,
           ts.excused_ts, ts.excused_reason,
           m.membership_number, m.fname, m.lname,
           p.paradigm_code, p.paradigm_name,
           s.site_name, u.display_name AS created_by_name,
           eu.display_name AS excused_by_name
    FROM test_selection ts
    JOIN member m ON m.link = ts.member_link
    LEFT JOIN member_paradigm mp ON mp.member_paradigm_id = ts.member_paradigm_id
    LEFT JOIN test_paradigm p ON p.paradigm_id = mp.paradigm_id
    LEFT JOIN collection_site s ON s.collection_site_id = mp.collection_site_id
    LEFT JOIN platform_user u ON u.user_id = ts.created_by
    LEFT JOIN platform_user eu ON eu.user_id = ts.excused_by`;

  const decorateSelection = (row) => ({
    selection_id: row.selection_id,
    date: dateOut(row.selected_date),
    member_number: row.membership_number,
    member_name: `${row.fname} ${row.lname}`,
    source: row.source === 'M' ? 'for-cause' : 'random',
    reason: row.reason || null,
    paradigm: row.paradigm_name || null,
    site: row.site_name || null,
    recorded_by: row.created_by_name || null,
    excused: row.excused_ts != null,
    excused_reason: row.excused_reason || null,
    excused_by: row.excused_by_name || null,
  });

  // GET /v1/monitoring/selections?date=YYYY-MM-DD — the named list for one
  // day. THE RULE (Bill): nobody sees the future — a future date refuses.
  app.get('/v1/monitoring/selections', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    try {
      const today = platformToday();
      let dayInt = today;
      if (req.query.date) {
        try { dayInt = ctx.dates.dateToMoleculeInt(String(req.query.date)); }
        catch (e) { return res.status(400).json({ error: 'date must be YYYY-MM-DD' }); }
      }
      if (dayInt > today) {
        return res.status(400).json({ error: 'Future test days are never named — the calendar shows expected volume only' });
      }
      const r = await dbClient.query(
        `${SELECTION_SQL} WHERE ts.tenant_id = $1 AND ts.selected_date = $2
         ORDER BY m.lname, m.fname`, [tenantId, dayInt]);
      res.json({ date: dateOut(dayInt), selections: r.rows.map(decorateSelection) });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // GET /v1/monitoring/calendar?year=&month= — one month of days: past and
  // today carry actual counts; future days carry EXPECTED VOLUME only
  // (each open assignment's remaining tests spread over its remaining
  // eligible days). No names ever leave for a future day.
  app.get('/v1/monitoring/calendar', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    try {
      const today = platformToday();
      const tNow = moleculeIntToDate(today);
      const year = parseInt(req.query.year) || tNow.getFullYear();
      const month = parseInt(req.query.month) || (tNow.getMonth() + 1);   // 1-12
      if (month < 1 || month > 12) return res.status(400).json({ error: 'month must be 1-12' });
      const firstInt = ctx.dates.dateToMoleculeInt(new Date(year, month - 1, 1));
      const lastInt = ctx.dates.dateToMoleculeInt(new Date(year, month, 0));

      // Actual counts for days that have happened.
      const counts = new Map();
      if (firstInt <= today) {
        const r = await dbClient.query(
          `SELECT selected_date, COUNT(*)::int AS n FROM test_selection
           WHERE tenant_id = $1 AND selected_date BETWEEN $2 AND $3 GROUP BY selected_date`,
          [tenantId, firstInt, Math.min(lastInt, today)]);
        for (const row of r.rows) counts.set(row.selected_date, row.n);
      }

      // Expected volume for future days: remaining ÷ remaining eligible
      // days per assignment, added onto each eligible future day.
      const expected = new Map();
      if (lastInt > today) {
        const assignments = (await dbClient.query(
          `SELECT mp.member_link, p.tests_per_period, p.period, p.weekdays_only
           FROM member_paradigm mp
           JOIN test_paradigm p ON p.paradigm_id = mp.paradigm_id
           JOIN member m ON m.link = mp.member_link
           WHERE mp.tenant_id = $1 AND mp.end_date IS NULL
             AND p.is_active = TRUE AND m.is_active = TRUE`, [tenantId])).rows;
        for (const a of assignments) {
          const b = periodBounds(ctx.dates, today, a.period);
          const inPeriod = parseInt((await dbClient.query(
            `SELECT COUNT(*) FROM test_selection
             WHERE member_link = $1 AND selected_date BETWEEN $2 AND $3 AND excused_ts IS NULL`,
            [a.member_link, b.startInt, b.endInt])).rows[0].count);
          const remaining = a.tests_per_period - inPeriod;
          if (remaining <= 0) continue;
          const from = Math.max(today + 1, firstInt);
          const to = Math.min(b.endInt, lastInt);
          const daysLeft = eligibleDaysRemaining(ctx.dates, today + 1, b.endInt, a.weekdays_only);
          if (daysLeft <= 0) continue;
          for (let day = from; day <= to; day++) {
            if (a.weekdays_only) {
              const dow = moleculeIntToDate(day).getDay();
              if (dow === 0 || dow === 6) continue;
            }
            expected.set(day, (expected.get(day) || 0) + remaining / daysLeft);
          }
        }
      }

      const days = [];
      for (let day = firstInt; day <= lastInt; day++) {
        days.push({
          date: dateOut(day),
          is_today: day === today,
          is_future: day > today,
          count: day <= today ? (counts.get(day) || 0) : null,
          expected: day > today ? Math.round((expected.get(day) || 0) * 10) / 10 : null,
        });
      }
      res.json({ year, month, days });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/monitoring/selection-run — the manual Run (admin door; the
  // daily job presses the same function).
  app.post('/v1/monitoring/selection-run', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!['admin', 'superuser'].includes(req.session?.role)) {
      return res.status(403).json({ error: 'Running the selection engine is admin-only' });
    }
    try {
      const out = await runParadigmSelection(ctx, tenantId, dbClient);
      res.json({ success: true, ...out });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/monitoring/selections — a manual FOR-CAUSE selection, today,
  // recorded with who and why. Body: { member_number, reason }.
  app.post('/v1/monitoring/selections', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const { member_number, reason } = req.body || {};
    if (!member_number) return res.status(400).json({ error: 'member_number required' });
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'reason required — a for-cause selection is recorded with why' });
    }
    try {
      const member = await resolveMember(member_number, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });
      const today = platformToday();
      const nowTs = (await dbClient.query('SELECT timestamp_to_audit_ts(NOW()) AS ts')).rows[0].ts;
      const mp = await dbClient.query(
        `SELECT member_paradigm_id FROM member_paradigm
         WHERE member_link = $1 AND tenant_id = $2 AND end_date IS NULL`, [member.link, tenantId]);
      const ins = await dbClient.query(
        `INSERT INTO test_selection (tenant_id, member_link, member_paradigm_id, selected_date, source, reason, created_by, created_ts)
         VALUES ($1, $2, $3, $4, 'M', $5, $6, $7)
         ON CONFLICT (member_link, selected_date) DO NOTHING RETURNING selection_id`,
        [tenantId, member.link, mp.rows[0]?.member_paradigm_id || null, today,
         String(reason).trim().substring(0, 200), req.session.userId, nowTs]);
      if (!ins.rows.length) {
        return res.status(409).json({ error: 'Already selected to test today' });
      }
      await stampCompliancePointers(dbClient, tenantId, member.link, today);
      const r = await dbClient.query(
        `${SELECTION_SQL} WHERE ts.selection_id = $1`, [ins.rows[0].selection_id]);
      res.status(201).json({ success: true, selection: decorateSelection(r.rows[0]) });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/monitoring/selections/:id/excuse — an excused absence
  // (story 3a). A MARK, never a deletion: the selection stands in the
  // record with who excused it and why; it stops counting toward the
  // quota so the engine re-rolls the test later in the period. One-way.
  // Approval belongs to the Medical Director and Case Manager (Bill's
  // ruling) — enforced through the program's role map under rules mode,
  // the release-door pattern; under mode 'open' any staff login records
  // it (roles don't resolve until the program flips).
  app.post('/v1/monitoring/selections/:id/excuse', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'reason required — an excused absence is recorded with why (travel, illness...)' });
    }
    try {
      const access = await ctx.documents.sessionDocAccess(tenantId, req.session);
      if (access && !access.superuser && !access.roles.has('MD') && !access.roles.has('CM')) {
        return res.status(403).json({ error: 'Excusing an absence belongs to the Medical Director and Case Manager' });
      }
      const selId = parseInt(req.params.id);
      if (isNaN(selId)) return res.status(404).json({ error: 'No such selection' });
      const sel = await dbClient.query(
        `SELECT selection_id, member_link, selected_date, excused_ts FROM test_selection
         WHERE selection_id = $1 AND tenant_id = $2`, [selId, tenantId]);
      if (!sel.rows.length) return res.status(404).json({ error: 'No such selection' });
      if (sel.rows[0].excused_ts != null) {
        return res.status(409).json({ error: 'This selection is already excused' });
      }
      const nowTs = (await dbClient.query('SELECT timestamp_to_audit_ts(NOW()) AS ts')).rows[0].ts;
      await dbClient.query(
        `UPDATE test_selection SET excused_ts = $1, excused_by = $2, excused_reason = $3
         WHERE selection_id = $4`,
        [nowTs, req.session.userId, String(reason).trim().substring(0, 200), selId]);
      // If the excused day is TODAY, clear the legacy missed-sweep pointer
      // so 5 PM does not file a MISSED for a test the program excused.
      if (sel.rows[0].selected_date === platformToday()) {
        await dbClient.query(
          `UPDATE member_compliance SET next_scheduled_date = NULL
           WHERE tenant_id = $1 AND member_link = $2 AND schedule_mode = 'random'
             AND next_scheduled_date = $3`,
          [tenantId, sel.rows[0].member_link, sel.rows[0].selected_date]);
      }
      // Chart-timeline surfacing (the paradigm-assignment precedent).
      await logAudit(tenantId, req.session.userId, 'member', sel.rows[0].member_link, 'E', {
        before: { test_absence: null },
        after: { test_absence: `excused ${dateOut(sel.rows[0].selected_date)}: ${String(reason).trim().substring(0, 120)}` } });
      const r = await dbClient.query(`${SELECTION_SQL} WHERE ts.selection_id = $1`, [selId]);
      res.json({ success: true, selection: decorateSelection(r.rows[0]) });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // ── STORY 4: toxicology results + the MRO state machine ───────────────
  // Erica's emailed answers are the contract until her document arrives.
  // The record is a table pair: tox_result (the specimen) + tox_result_stage
  // (APPEND-ONLY stage history — where a record stands is always DERIVED
  // from its newest row, never stored). Transitions and who may make them
  // are DATA (tox_stage_transition); dispositions are DATA
  // (tox_disposition). The disposition door records the stage row ONLY —
  // filing the compliance/scoring event is the dangerous seam (the
  // S162 4.5-month-silence layer) and lands as its own bite, test first.

  const TOX_SQL = `
    SELECT tr.link, tr.member_link, tr.selection_id, tr.collection_date,
           tr.coc_reference, tr.lab_document_link, tr.portal_suppressed,
           tr.created_by, tr.created_ts, tr.voided_ts, tr.voided_by, tr.voided_reason,
           m.membership_number, m.fname, m.lname,
           cs.site_code, cs.site_name, tp.panel_code, tp.panel_name,
           rr.reason_code AS reconcile_reason_code, rr.reason_name AS reconcile_reason_name,
           cur.stage_code AS current_stage,
           curd.disposition_code, curd.disposition_name
    FROM tox_result tr
    JOIN member m ON m.link = tr.member_link
    LEFT JOIN collection_site cs ON cs.collection_site_id = tr.collection_site_id
    LEFT JOIN test_panel tp ON tp.panel_id = tr.panel_id
    LEFT JOIN tox_reason rr ON rr.reason_id = tr.reconcile_reason_id
    LEFT JOIN LATERAL (
      SELECT s.stage_code, s.disposition_id FROM tox_result_stage s
      WHERE s.result_link = tr.link ORDER BY s.stage_row_id DESC LIMIT 1
    ) cur ON true
    LEFT JOIN tox_disposition curd ON curd.disposition_id = cur.disposition_id`;

  const decorateTox = (row) => ({
    link: row.link,
    member_number: row.membership_number,
    member_name: `${row.fname || ''} ${row.lname || ''}`.trim(),
    collection_date: dateOut(row.collection_date),
    selection_id: row.selection_id,
    reconcile_reason_code: row.reconcile_reason_code,
    reconcile_reason_name: row.reconcile_reason_name,
    site_code: row.site_code, site_name: row.site_name,
    panel_code: row.panel_code, panel_name: row.panel_name,
    coc_reference: row.coc_reference,
    lab_document_link: row.lab_document_link,
    portal_suppressed: row.portal_suppressed,
    current_stage: row.current_stage,
    disposition_code: row.disposition_code,
    disposition_name: row.disposition_name,
    voided: row.voided_ts != null,
    voided_reason: row.voided_reason
  });

  const toxHistory = async (dbClient, link) => (await dbClient.query(
    `SELECT s.stage_row_id, s.stage_code, st.stage_name, s.acted_by, s.acted_ts,
            u.display_name AS acted_by_name,
            d.disposition_code, d.disposition_name,
            r.reason_code, r.reason_name
     FROM tox_result_stage s
     JOIN tox_result tr ON tr.link = s.result_link
     LEFT JOIN tox_stage st ON st.tenant_id = tr.tenant_id AND st.stage_code = s.stage_code
     LEFT JOIN platform_user u ON u.user_id = s.acted_by
     LEFT JOIN tox_disposition d ON d.disposition_id = s.disposition_id
     LEFT JOIN tox_reason r ON r.reason_id = s.reason_id
     WHERE s.result_link = $1 ORDER BY s.stage_row_id`, [link])).rows;

  // GET /v1/tox-config — the state machine's vocabularies, so screens
  // offer only DATA (stages, legal transitions, dispositions, reasons,
  // panels). The server re-enforces every rule; this is display truth.
  app.get('/v1/tox-config', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    try {
      const [stages, transitions, dispositions, reasons, panels] = await Promise.all([
        dbClient.query(`SELECT stage_code, stage_name, sort_order, is_terminal FROM tox_stage WHERE tenant_id = $1 ORDER BY sort_order`, [tenantId]),
        dbClient.query(`SELECT from_stage, to_stage, role_key FROM tox_stage_transition WHERE tenant_id = $1 ORDER BY from_stage, to_stage, role_key`, [tenantId]),
        dbClient.query(`SELECT disposition_code, disposition_name FROM tox_disposition WHERE tenant_id = $1 AND is_active = TRUE ORDER BY sort_order`, [tenantId]),
        dbClient.query(`SELECT reason_type, reason_code, reason_name FROM tox_reason WHERE tenant_id = $1 AND is_active = TRUE ORDER BY reason_type, reason_code`, [tenantId]),
        dbClient.query(`SELECT panel_code, panel_name FROM test_panel WHERE tenant_id = $1 AND is_active = TRUE ORDER BY panel_code`, [tenantId]),
      ]);
      res.json({ stages: stages.rows, transitions: transitions.rows,
        dispositions: dispositions.rows, reasons: reasons.rows, panels: panels.rows });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // GET /v1/tox-results — the tenant's results, newest first, with the
  // DERIVED current stage. Voided records excluded unless asked for.
  app.get('/v1/tox-results', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    try {
      const params = [tenantId];
      let where = `tr.tenant_id = $1`;
      if (req.query.member_number) {
        const member = await resolveMember(req.query.member_number, tenantId);
        if (!member) return res.status(404).json({ error: 'Member not found' });
        params.push(member.link); where += ` AND tr.member_link = $${params.length}`;
      }
      if (req.query.stage) { params.push(String(req.query.stage).toUpperCase()); where += ` AND cur.stage_code = $${params.length}`; }
      if (req.query.include_voided !== '1') where += ` AND tr.voided_ts IS NULL`;
      const r = await dbClient.query(
        `${TOX_SQL} WHERE ${where} ORDER BY tr.collection_date DESC, tr.link DESC LIMIT 500`, params); // lint-allow: tr.link is INTEGER (link_tank 4-byte) — numeric ordering is byte-true; the same-day tiebreaker rule needs it
      res.json({ results: r.rows.map(decorateTox) });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // GET /v1/tox-results/:link — the record + its full stage history.
  app.get('/v1/tox-results/:link', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    try {
      const link = parseInt(req.params.link);
      if (isNaN(link)) return res.status(404).json({ error: 'No such result' });
      const r = await dbClient.query(`${TOX_SQL} WHERE tr.link = $1 AND tr.tenant_id = $2`, [link, tenantId]);
      if (!r.rows.length) return res.status(404).json({ error: 'No such result' });
      const history = await toxHistory(dbClient, link);
      res.json({ result: decorateTox(r.rows[0]),
        history: history.map(h => ({ stage_code: h.stage_code, stage_name: h.stage_name,
          acted_by: h.acted_by, acted_by_name: h.acted_by_name,
          disposition_code: h.disposition_code, disposition_name: h.disposition_name,
          reason_code: h.reason_code, reason_name: h.reason_name })) });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/tox-results — a specimen back from a lab enters the record
  // (manual entry — the interim path until lab integration; design doc
  // §4/§8: integration replaces the entry CHANNEL, never the records).
  // Creating the record IS the 'NEW' → 'RECEIVED' transition.
  app.post('/v1/tox-results', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const { member_number, collection_date, selection_id, reconcile_reason_code,
            site_code, panel_code, coc_reference } = req.body || {};
    if (!member_number) return res.status(400).json({ error: 'member_number required' });
    try {
      const roles = await sessionToxRoles(ctx, dbClient, tenantId, req.session);
      const gate = await toxTransitionCheck(dbClient, tenantId, 'NEW', 'RECEIVED', roles);
      if (gate.noPath) return res.status(500).json({ error: "The state machine has no 'NEW' → 'RECEIVED' transition configured — v159 seeds it" });
      if (!gate.ok) return res.status(403).json({ error: `Recording a toxicology result belongs to: ${gate.allowed.join(', ')}` });

      const member = await resolveMember(member_number, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      const today = platformToday();
      let collDate = today;
      if (collection_date) {
        collDate = ctx.dates.dateToMoleculeInt(collection_date);
        if (collDate > today) return res.status(400).json({ error: 'collection_date cannot be in the future' });
      }

      // The anchor rule (schema CHECK, answered here in plain English): a
      // result answers a selection, or it says why it doesn't. When no
      // selection_id is named, the member's selection ON the collection
      // date auto-matches — the natural reconciliation, and the same one
      // the lab-integration path will use.
      let selectionId = null, reconcileReasonId = null;
      if (selection_id != null) {
        const sel = await dbClient.query(
          `SELECT selection_id FROM test_selection
           WHERE selection_id = $1 AND tenant_id = $2 AND member_link = $3`,
          [selection_id, tenantId, member.link]);
        if (!sel.rows.length) return res.status(400).json({ error: 'selection_id does not belong to this member' });
        selectionId = sel.rows[0].selection_id;
      } else {
        const auto = await dbClient.query(
          `SELECT selection_id FROM test_selection
           WHERE tenant_id = $1 AND member_link = $2 AND selected_date = $3 AND excused_ts IS NULL`,
          [tenantId, member.link, collDate]);
        if (auto.rows.length) selectionId = auto.rows[0].selection_id;
      }
      if (selectionId == null) {
        if (!reconcile_reason_code) return res.status(400).json({ error: 'A result must answer a selection (selection_id) or say why it does not (reconcile_reason_code)' });
        const rr = await dbClient.query(
          `SELECT reason_id FROM tox_reason
           WHERE tenant_id = $1 AND reason_type = 'reconcile' AND reason_code = $2 AND is_active = TRUE`,
          [tenantId, String(reconcile_reason_code).toUpperCase()]);
        if (!rr.rows.length) return res.status(400).json({ error: `Unknown reconciliation reason '${reconcile_reason_code}'` });
        reconcileReasonId = rr.rows[0].reason_id;
      }

      let siteId = null;
      if (site_code) {
        const s = await dbClient.query(
          `SELECT collection_site_id FROM collection_site WHERE tenant_id = $1 AND site_code = $2`,
          [tenantId, String(site_code).toUpperCase()]);
        if (!s.rows.length) return res.status(400).json({ error: `Unknown collection site '${site_code}'` });
        siteId = s.rows[0].collection_site_id;
      }
      let panelId = null;
      if (panel_code) {
        const p = await dbClient.query(
          `SELECT panel_id FROM test_panel WHERE tenant_id = $1 AND panel_code = $2`,
          [tenantId, String(panel_code).toUpperCase()]);
        if (!p.rows.length) return res.status(400).json({ error: `Unknown panel '${panel_code}'` });
        panelId = p.rows[0].panel_id;
      }

      const nowTs = (await dbClient.query('SELECT timestamp_to_audit_ts(NOW()) AS ts')).rows[0].ts;
      // link_tank BIGINT arrives as a string (S166 lesson) — normalize at allocation.
      const link = parseInt(await ctx.getNextLink(tenantId, 'tox_result'), 10);
      await dbClient.query('BEGIN');
      try {
        await dbClient.query(
          `INSERT INTO tox_result (link, tenant_id, member_link, selection_id, reconcile_reason_id,
             collection_date, collection_site_id, panel_id, coc_reference, created_by, created_ts)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [link, tenantId, member.link, selectionId, reconcileReasonId, collDate, siteId, panelId,
           coc_reference ? String(coc_reference).trim().substring(0, 50) : null,
           req.session.userId, nowTs]);
        await dbClient.query(
          `INSERT INTO tox_result_stage (result_link, stage_code, acted_by, acted_ts)
           VALUES ($1, 'RECEIVED', $2, $3)`, [link, req.session.userId, nowTs]);
        await dbClient.query('COMMIT');
      } catch (txErr) { await dbClient.query('ROLLBACK'); throw txErr; }
      // Chart-timeline surfacing — process fact only, no result content
      // (Erica's 42 CFR Part 2 content rule reaches every text surface).
      await logAudit(tenantId, req.session.userId, 'member', member.link, 'E', {
        before: { toxicology: null },
        after: { toxicology: `specimen received, collected ${dateOut(collDate)}` } });
      const out = await dbClient.query(`${TOX_SQL} WHERE tr.link = $1 AND tr.tenant_id = $2`, [link, tenantId]);
      res.status(201).json({ success: true, result: decorateTox(out.rows[0]) });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/tox-results/:link/stage — move a record through the machine.
  // Body: { to_stage, disposition_code (required at a terminal stage),
  // reason_code (optional) }. The stage row RECORDS; nothing scores here —
  // the disposition's compliance filing is its own bite, test written first.
  app.post('/v1/tox-results/:link/stage', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const { to_stage, disposition_code, reason_code } = req.body || {};
    if (!to_stage) return res.status(400).json({ error: 'to_stage required' });
    try {
      const link = parseInt(req.params.link);
      if (isNaN(link)) return res.status(404).json({ error: 'No such result' });
      const rec = await dbClient.query(
        `SELECT tr.link, tr.member_link, tr.voided_ts FROM tox_result tr
         WHERE tr.link = $1 AND tr.tenant_id = $2`, [link, tenantId]);
      if (!rec.rows.length) return res.status(404).json({ error: 'No such result' });
      if (rec.rows[0].voided_ts != null) return res.status(409).json({ error: 'This result is voided — a voided record does not move' });

      const cur = await dbClient.query(
        `SELECT stage_code FROM tox_result_stage WHERE result_link = $1
         ORDER BY stage_row_id DESC LIMIT 1`, [link]);
      const from = cur.rows[0].stage_code;
      const to = String(to_stage).toUpperCase();

      const roles = await sessionToxRoles(ctx, dbClient, tenantId, req.session);
      const gate = await toxTransitionCheck(dbClient, tenantId, from, to, roles);
      if (gate.noPath) {
        const nexts = await dbClient.query(
          `SELECT DISTINCT to_stage FROM tox_stage_transition WHERE tenant_id = $1 AND from_stage = $2 ORDER BY to_stage`,
          [tenantId, from]);
        const opts = nexts.rows.map(r => r.to_stage);
        return res.status(409).json({ error: opts.length
          ? `No path from ${from} to ${to} — from ${from} a result can move to: ${opts.join(', ')}`
          : `${from} is a final stage — this record does not move again` });
      }
      if (!gate.ok) return res.status(403).json({ error: `Moving a result from ${from} to ${to} belongs to: ${gate.allowed.join(', ')}` });

      const stageRow = await dbClient.query(
        `SELECT stage_code, is_terminal FROM tox_stage WHERE tenant_id = $1 AND stage_code = $2`,
        [tenantId, to]);
      if (!stageRow.rows.length) return res.status(400).json({ error: `Unknown stage '${to}'` });

      let dispositionId = null;
      if (stageRow.rows[0].is_terminal) {
        if (!disposition_code) return res.status(400).json({ error: 'A final stage requires a disposition_code' });
        const d = await dbClient.query(
          `SELECT disposition_id FROM tox_disposition
           WHERE tenant_id = $1 AND disposition_code = $2 AND is_active = TRUE`,
          [tenantId, String(disposition_code).toUpperCase()]);
        if (!d.rows.length) return res.status(400).json({ error: `Unknown disposition '${disposition_code}'` });
        dispositionId = d.rows[0].disposition_id;
      } else if (disposition_code) {
        return res.status(400).json({ error: 'A disposition belongs only on the final stage' });
      }

      let reasonId = null;
      if (reason_code) {
        const r2 = await dbClient.query(
          `SELECT reason_id FROM tox_reason WHERE tenant_id = $1 AND reason_code = $2 AND is_active = TRUE`,
          [tenantId, String(reason_code).toUpperCase()]);
        if (!r2.rows.length) return res.status(400).json({ error: `Unknown reason '${reason_code}'` });
        reasonId = r2.rows[0].reason_id;
      }

      const nowTs = (await dbClient.query('SELECT timestamp_to_audit_ts(NOW()) AS ts')).rows[0].ts;
      await dbClient.query(
        `INSERT INTO tox_result_stage (result_link, stage_code, disposition_id, reason_id, acted_by, acted_ts)
         VALUES ($1,$2,$3,$4,$5,$6)`, [link, to, dispositionId, reasonId, req.session.userId, nowTs]);
      // NOTE (the scoring seam, deliberately NOT here yet): when the
      // disposition lands, the record's compliance event files via
      // tox_disposition's compliance_item_code/compliance_status_code —
      // disposition-DATED, forward-only. That bite ships with its test
      // written first; until then a disposition records and files nothing.

      // The staged notifications (v160, Erica's answer 3) — CONTENT RULE:
      // the text never names the member, the stage, or the answer; the
      // news is "log in and look" (42 CFR Part 2 reaches staff email/text
      // surfaces, and notifications can deliver as email). Screen
      // non-negative = internal flag to CM + MD/MRO; disposition = the
      // clinical tier. The record's write never depends on delivery —
      // fireNotificationEvent contains its own failure handling. The
      // PARTICIPANT notice at disposition is deliberately absent until
      // the consent architecture opens the messaging gate; it will go
      // through sendMemberMessage, never a second path.
      if (to === 'SCREEN') {
        await ctx.fireNotificationEvent('TOX_RESULT_ATTENTION', tenantId, {
          source: 'toxicology',
          detail: 'A toxicology result requires review. Open the clinic Testing tab.',
          dedupKey: `tox_attn_${link}`,
        });
      } else if (dispositionId != null) {
        await ctx.fireNotificationEvent('TOX_RESULT_DISPOSED', tenantId, {
          source: 'toxicology',
          detail: 'A toxicology result was finalized. Open the clinic Testing tab.',
          dedupKey: `tox_disp_${link}`,
        });
      }
      await logAudit(tenantId, req.session.userId, 'member', rec.rows[0].member_link, 'E', {
        before: { toxicology: from },
        after: { toxicology: `result stage ${from} → ${to}` } });
      const out = await dbClient.query(`${TOX_SQL} WHERE tr.link = $1 AND tr.tenant_id = $2`, [link, tenantId]);
      const history = await toxHistory(dbClient, link);
      res.json({ success: true, result: decorateTox(out.rows[0]),
        history: history.map(h => ({ stage_code: h.stage_code, disposition_code: h.disposition_code })) });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/tox-results/:link/void — mark-in-error. A MARK, never a
  // deletion (the excused-absence shape): the record and its history
  // stand, with who voided it and why. Nothing downstream to unwind yet —
  // when the scoring bite lands, void-after-disposition must handle the
  // filed compliance event (that bite's design, recorded here so it
  // cannot be forgotten).
  app.post('/v1/tox-results/:link/void', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'reason required — a voided result is recorded with why' });
    }
    try {
      const link = parseInt(req.params.link);
      if (isNaN(link)) return res.status(404).json({ error: 'No such result' });
      const roles = await sessionToxRoles(ctx, dbClient, tenantId, req.session);
      if (roles !== null && roles !== 'superuser' && !roles.has('MD') && !roles.has('CM')) {
        return res.status(403).json({ error: 'Voiding a toxicology result belongs to the Medical Director and Case Manager' });
      }
      const rec = await dbClient.query(
        `SELECT link, member_link, voided_ts FROM tox_result WHERE link = $1 AND tenant_id = $2`,
        [link, tenantId]);
      if (!rec.rows.length) return res.status(404).json({ error: 'No such result' });
      if (rec.rows[0].voided_ts != null) return res.status(409).json({ error: 'This result is already voided' });
      const nowTs = (await dbClient.query('SELECT timestamp_to_audit_ts(NOW()) AS ts')).rows[0].ts;
      await dbClient.query(
        `UPDATE tox_result SET voided_ts = $1, voided_by = $2, voided_reason = $3 WHERE link = $4`,
        [nowTs, req.session.userId, String(reason).trim().substring(0, 200), link]);
      await logAudit(tenantId, req.session.userId, 'member', rec.rows[0].member_link, 'E', {
        before: { toxicology: 'result on record' },
        after: { toxicology: `result voided: ${String(reason).trim().substring(0, 120)}` } });
      res.json({ success: true });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });
}

export default { register };
