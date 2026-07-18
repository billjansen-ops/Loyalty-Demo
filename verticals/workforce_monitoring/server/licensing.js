/**
 * Workforce Monitoring (Insight) — licensing board module.
 *
 * Moves the six licensing-board endpoints out of pointers.js
 * (formerly L25835–L25959). They were missed by Phase 6 AND the
 * Session 130/131 post-Phase-6 sweeps for the same reason as the
 * notes.js endpoints: lowercase URLs ('/v1/licensing-boards') never
 * tripped the case-sensitive lint regex, and "licensing" isn't in the
 * healthcare-terms pattern at all. Found by a whole-codebase
 * reasonableness audit, not by lint.
 *
 *   - GET    /v1/licensing-boards
 *   - POST   /v1/licensing-boards
 *   - PUT    /v1/licensing-boards/:id
 *   - DELETE /v1/licensing-boards/:id
 *   - GET    /v1/members/:id/licensing-board
 *   - PUT    /v1/members/:id/licensing-board
 *
 * Backed by the Insight-specific licensing_board table and the
 * LICENSING_BOARD member molecule (seeded for wi_php by db v79's
 * M-composite migration). No platform-side callers — pages that hit
 * these endpoints all live in the workforce_monitoring vertical — so
 * no callback bridge is needed; the move is pure relocation.
 */

export function register(app, ctx) {
  const { resolveMember, logAudit } = ctx;
  const {
    getMoleculeRows, insertMoleculeRow, deleteMoleculeRow, encodeMolecule
  } = ctx.molecules;

  // GET /v1/licensing-boards — list for tenant
  app.get('/v1/licensing-boards', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const result = await dbClient.query(
        `SELECT licensing_board_id, board_code, board_name, profession, is_active
         FROM licensing_board WHERE tenant_id = $1 ORDER BY board_name`,
        [tenantId]
      );
      res.json(result.rows);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/licensing-boards — create
  app.post('/v1/licensing-boards', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.body.tenant_id;
    const { board_code, board_name, profession } = req.body;
    if (!board_code || !board_name) return res.status(400).json({ error: 'board_code and board_name required' });
    try {
      const result = await dbClient.query(
        `INSERT INTO licensing_board (tenant_id, board_code, board_name, profession)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [tenantId, board_code, board_name, profession || null]
      );
      res.json(result.rows[0]);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // PUT /v1/licensing-boards/:id — update
  app.put('/v1/licensing-boards/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.body.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { board_code, board_name, profession, is_active } = req.body;
    try {
      const result = await dbClient.query(
        `UPDATE licensing_board SET board_code = COALESCE($2, board_code), board_name = COALESCE($3, board_name),
         profession = COALESCE($4, profession), is_active = COALESCE($5, is_active)
         WHERE licensing_board_id = $1 AND tenant_id = $6 RETURNING *`,
        [req.params.id, board_code, board_name, profession, is_active, tenantId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // DELETE /v1/licensing-boards/:id — delete
  app.delete('/v1/licensing-boards/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const result = await dbClient.query(`DELETE FROM licensing_board WHERE licensing_board_id = $1 AND tenant_id = $2 RETURNING licensing_board_id`, [req.params.id, tenantId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ deleted: true });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // GET /v1/members/:id/licensing-board — get licensing board for a member
  app.get('/v1/members/:id/licensing-board', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });
      const rows = await getMoleculeRows(member.link, 'LICENSING_BOARD', tenantId);
      if (!rows.length) return res.json({ licensing_board: null });
      // Decode the board_id from the molecule value
      const boardId = rows[0].N1;
      const board = await dbClient.query('SELECT * FROM licensing_board WHERE licensing_board_id = $1', [boardId]);
      res.json({ licensing_board: board.rows[0] || null });
    } catch (e) {
      // An error is NOT "no board" (2026-07 audit Tier 2) — conflating them
      // made a DB failure read as an unlicensed member. Fail honestly.
      console.error('Licensing board lookup error:', e.message);
      res.status(500).json({ error: 'Licensing board lookup failed: ' + e.message });
    }
  });

  // PUT /v1/members/:id/licensing-board — set licensing board for a member
  app.put('/v1/members/:id/licensing-board', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.body.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { board_code } = req.body;
    if (!board_code) return res.status(400).json({ error: 'board_code required' });
    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });
      // Capture the prior board_code for the audit trail (Session 113 —
      // Erica wanted licensing-board changes to surface on the chart
      // timeline like address/phone changes do).
      let oldBoardCode = null;
      try {
        const oldRows = await getMoleculeRows(member.link, 'LICENSING_BOARD', tenantId);
        if (oldRows.length && oldRows[0].N1 != null) {
          const oldBoardLookup = await dbClient.query(
            'SELECT board_code FROM licensing_board WHERE licensing_board_id = $1',
            [oldRows[0].N1]
          );
          oldBoardCode = oldBoardLookup.rows[0]?.board_code || null;
        }
      } catch (e) { /* no prior row */ }
      // Delete existing licensing board molecule if any
      try { await deleteMoleculeRow(member.link, 'LICENSING_BOARD', {}, tenantId); } catch(e) { /* none to delete */ }
      // Encode and insert new value using the molecule system
      const encoded = await encodeMolecule(tenantId, 'LICENSING_BOARD', board_code);
      await insertMoleculeRow(member.link, 'LICENSING_BOARD', [encoded], tenantId);
      // Audit row so the change surfaces on the activity timeline.
      if (oldBoardCode !== board_code) {
        try {
          await logAudit(tenantId, req.session?.userId || null, 'member', member.link, 'E', {
            before: { licensing_board: oldBoardCode },
            after: { licensing_board: board_code }
          });
        } catch (e) { console.warn(`licensing-board audit failed: ${e.message}`); }
      }
      res.json({ success: true });
    } catch (e) {
      console.error('Set licensing board error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });
}

export default { register };
