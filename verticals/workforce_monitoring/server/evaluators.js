/**
 * Workforce Monitoring (Insight) — vetted evaluator directory (WisconsinPATH Stage 3).
 *
 * Erica's requirement: "Where an independent diagnostic evaluation is
 * indicated, the participant chooses from a vetted list with costs
 * disclosed up front." Out-of-state entries are first-class (her
 * operational note: no in-state Wisconsin evaluator currently exists).
 *
 *   - GET    /v1/evaluators             staff list (all rows, tenant-gated)
 *   - POST   /v1/evaluators             create
 *   - PUT    /v1/evaluators/:id         update
 *   - DELETE /v1/evaluators/:id         delete
 *   - GET    /v1/evaluator-directory    PUBLIC participant-facing list —
 *                                       active only, whitelisted fields,
 *                                       tenant resolved from ?t= (tenant_key
 *                                       or tenant_id; never from a session).
 *                                       Allowlisted in pointers.js
 *                                       isPublicRoute, like /p/:code.
 *
 * Backed by the `evaluator` table (db_migrate v99) and the EVALUATOR
 * member molecule (external_list → evaluator, mirroring LICENSING_BOARD).
 * The chart write/read path is the generic member-molecule machinery —
 * EVALUATOR rides the M composite + input template, so the participant
 * profile shows and edits it with no custom endpoints here.
 */

export function register(app, ctx) {

  // GET /v1/evaluators — staff list for the session tenant (admin page)
  app.get('/v1/evaluators', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const result = await dbClient.query(
        `SELECT evaluator_id, evaluator_code, evaluator_name, organization, credentials,
                evaluation_types, city, state, phone, email, website,
                cost_low, cost_high, cost_notes, is_active
         FROM evaluator WHERE tenant_id = $1 ORDER BY evaluator_name`,
        [tenantId]
      );
      res.json(result.rows);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/evaluators — create
  app.post('/v1/evaluators', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.body.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const b = req.body;
    if (!b.evaluator_code || !b.evaluator_name) {
      return res.status(400).json({ error: 'evaluator_code and evaluator_name required' });
    }
    if ((b.cost_low != null && b.cost_high != null) && Number(b.cost_low) > Number(b.cost_high)) {
      return res.status(400).json({ error: 'The low cost cannot be higher than the high cost' });
    }
    try {
      const result = await dbClient.query(
        `INSERT INTO evaluator (tenant_id, evaluator_code, evaluator_name, organization, credentials,
                                evaluation_types, city, state, phone, email, website,
                                cost_low, cost_high, cost_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [tenantId, b.evaluator_code, b.evaluator_name, b.organization || null, b.credentials || null,
         b.evaluation_types || null, b.city || null, b.state || null, b.phone || null,
         b.email || null, b.website || null,
         b.cost_low ?? null, b.cost_high ?? null, b.cost_notes || null]
      );
      res.json(result.rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: `An evaluator with code "${b.evaluator_code}" already exists` });
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });

  // PUT /v1/evaluators/:id — update
  app.put('/v1/evaluators/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.body.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const b = req.body;
    if ((b.cost_low != null && b.cost_high != null) && Number(b.cost_low) > Number(b.cost_high)) {
      return res.status(400).json({ error: 'The low cost cannot be higher than the high cost' });
    }
    try {
      const result = await dbClient.query(
        `UPDATE evaluator SET
           evaluator_code   = COALESCE($2, evaluator_code),
           evaluator_name   = COALESCE($3, evaluator_name),
           organization     = COALESCE($4, organization),
           credentials      = COALESCE($5, credentials),
           evaluation_types = COALESCE($6, evaluation_types),
           city             = COALESCE($7, city),
           state            = COALESCE($8, state),
           phone            = COALESCE($9, phone),
           email            = COALESCE($10, email),
           website          = COALESCE($11, website),
           cost_low         = COALESCE($12, cost_low),
           cost_high        = COALESCE($13, cost_high),
           cost_notes       = COALESCE($14, cost_notes),
           is_active        = COALESCE($15, is_active)
         WHERE evaluator_id = $1 AND tenant_id = $16 RETURNING *`,
        [req.params.id, b.evaluator_code, b.evaluator_name, b.organization, b.credentials,
         b.evaluation_types, b.city, b.state, b.phone, b.email, b.website,
         b.cost_low, b.cost_high, b.cost_notes, b.is_active, tenantId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: `An evaluator with code "${b.evaluator_code}" already exists` });
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });

  // DELETE /v1/evaluators/:id — delete
  app.delete('/v1/evaluators/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const result = await dbClient.query(
        `DELETE FROM evaluator WHERE evaluator_id = $1 AND tenant_id = $2 RETURNING evaluator_id`,
        [req.params.id, tenantId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ deleted: true });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // GET /v1/evaluator-directory — PUBLIC participant-facing list.
  // No session: a participant reached this from a link or QR their program
  // shared. Tenant rides ?t= as tenant_key ('wi_php') or tenant_id. Active
  // entries only; whitelisted fields only (everything here is deliberately
  // public directory content — no PHI, no internal state).
  app.get('/v1/evaluator-directory', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const t = (req.query.t || '').toString().trim();
    if (!t) return res.status(400).json({ error: 'program identifier required' });
    try {
      const tenant = await dbClient.query(
        /^\d+$/.test(t)
          ? `SELECT tenant_id, name FROM tenant WHERE tenant_id = $1`
          : `SELECT tenant_id, name FROM tenant WHERE tenant_key = $1`,
        [t]
      );
      if (!tenant.rows.length) return res.status(404).json({ error: 'Unknown program' });
      const result = await dbClient.query(
        `SELECT evaluator_name, organization, credentials, evaluation_types,
                city, state, phone, email, website, cost_low, cost_high, cost_notes
         FROM evaluator WHERE tenant_id = $1 AND is_active = true
         ORDER BY evaluator_name`,
        [tenant.rows[0].tenant_id]
      );
      res.json({ program: tenant.rows[0].name, evaluators: result.rows });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });
}

export default { register };
