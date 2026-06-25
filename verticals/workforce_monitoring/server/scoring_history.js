/**
 * Workforce Monitoring — PPII/PPSI member-level history + full-PPSI flag.
 *
 * Phase 5 of the Insight server extraction (Session 129). Moved from
 * pointers.js:
 *   - GET    /v1/member/:id/ppii-history          (formerly L5784)
 *   - GET    /v1/member/:id/ppsi-history          (formerly L7058)
 *   - POST   /v1/members/:id/request-full-ppsi    (formerly L27216)
 *   - DELETE /v1/members/:id/request-full-ppsi    (formerly L27239)
 *   - GET    /v1/members/:id/ppsi-mode            (formerly L27257)
 *
 * No new helpers, no callbacks — each endpoint is a thin DB-touching
 * route that reads ctx for the shared platform pieces.
 */

export function register(app, ctx) {
  const { getDbClient, resolveMember } = ctx;
  const {
    getMoleculeId, getMoleculeRows, insertMoleculeRow, deleteMoleculeRow
  } = ctx.molecules;
  const { dateToMoleculeInt, moleculeIntToDate, formatDateLocal } = ctx.dates;

  // GET /v1/member/:id/ppii-history — recent PPII score snapshots for one
  // member, with per-stream raw components inline. Drives the participant
  // chart's "Previous PPII" affordance: when the most recent snapshot under
  // a non-current weight_set_id exists, the chart shows it as the audit
  // trail anchor for staff decisions made under prior weights.
  //
  // :id is the membership_number (matches the /v1/member/:id/activities
  // pattern used elsewhere in the app); tenant_id required as query param.
  // Returns up to ?limit=N (default 10) snapshots, newest first. Each snapshot
  // carries the components map { <stream_code>: rawValue } for the streams
  // that had data at calc time — missing keys mean "no data," not "zero."
  app.get('/v1/member/:id/ppii-history', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    try {
      const membershipNumber = req.params.id;
      const tenantId = req.tenantId;
      if (isNaN(tenantId)) return res.status(400).json({ error: 'tenant_id query param required' });
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));

      // Resolve member link from membership_number + tenant_id.
      const memRes = await dbClient.query(
        `SELECT link FROM member WHERE membership_number = $1 AND tenant_id = $2`,
        [String(membershipNumber), tenantId]
      );
      if (memRes.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
      const memberLink = memRes.rows[0].link;

      const wsRes = await dbClient.query(
        `SELECT weight_set_id FROM ppii_weight_set WHERE tenant_id = $1 AND is_current = true`,
        [tenantId]
      );
      const currentWeightSetId = wsRes.rows.length ? Number(wsRes.rows[0].weight_set_id) : null;

      // Pull snapshots + components in two queries (cheaper than a wide JOIN
      // when components-per-snapshot can vary). Index on (p_link, computed_at
      // DESC) makes the snapshot read O(limit).
      const snapRes = await dbClient.query(
        `SELECT history_id, computed_at, ppii_score, weight_set_id, trigger_type
           FROM ppii_score_history
          WHERE tenant_id = $1 AND p_link = $2
          ORDER BY computed_at DESC, history_id DESC
          LIMIT $3`,
        [tenantId, memberLink, limit]
      );
      const snapshots = snapRes.rows.map(r => ({
        history_id: Number(r.history_id),
        computed_at: r.computed_at,
        ppii_score: r.ppii_score,
        weight_set_id: Number(r.weight_set_id),
        trigger_type: r.trigger_type,
        components: {}
      }));

      if (snapshots.length > 0) {
        const ids = snapshots.map(s => s.history_id);
        const compRes = await dbClient.query(
          `SELECT history_id, stream_code, raw_value
             FROM ppii_score_history_component
            WHERE history_id = ANY($1::bigint[])`,
          [ids]
        );
        const byId = new Map(snapshots.map(s => [s.history_id, s]));
        for (const row of compRes.rows) {
          const s = byId.get(Number(row.history_id));
          if (s) s.components[row.stream_code] = Number(row.raw_value);
        }
      }

      res.json({
        membership_number: String(membershipNumber),
        member_link: memberLink,
        tenant_id: tenantId,
        current_weight_set_id: currentWeightSetId,
        snapshots
      });
    } catch (error) {
      console.error('GET /v1/member/:id/ppii-history error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/member/:id/ppsi-history — most-recent PPSI score under the prior
  // weight set, if any. Drives the chart's "Previous PPSI" line when the
  // tenant has cut over to a new weight set and the member had a scored PPSI
  // before the cutover.
  app.get('/v1/member/:id/ppsi-history', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    try {
      const membershipNumber = req.params.id;
      const tenantId = req.tenantId;
      if (isNaN(tenantId)) return res.status(400).json({ error: 'tenant_id query param required' });

      const memRes = await dbClient.query(
        `SELECT link FROM member WHERE membership_number = $1 AND tenant_id = $2`,
        [String(membershipNumber), tenantId]
      );
      if (memRes.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
      const memberLink = memRes.rows[0].link;

      // Current PPSI subdomain weight set + when it became effective.
      const wsRes = await dbClient.query(
        `SELECT weight_set_id, effective_from
           FROM ppsi_subdomain_weight_set
          WHERE tenant_id = $1 AND is_current = true
          ORDER BY effective_from DESC
          LIMIT 1`,
        [tenantId]
      );
      if (wsRes.rows.length === 0) {
        return res.json({
          membership_number: String(membershipNumber),
          member_link: memberLink,
          tenant_id: tenantId,
          current_weight_set_id: null,
          cutover_date: null,
          previous: null
        });
      }
      const currentWsId = Number(wsRes.rows[0].weight_set_id);
      const cutoverTs = wsRes.rows[0].effective_from;
      const cutoverDate = cutoverTs ? formatDateLocal(new Date(cutoverTs)) : null;

      // Was the current weight set the FIRST one for this tenant? If yes,
      // there was no "weight change" — no prior PPSI to show.
      const priorWsRes = await dbClient.query(
        `SELECT COUNT(*) AS n FROM ppsi_subdomain_weight_set
          WHERE tenant_id = $1 AND weight_set_id <> $2 AND is_factory_default = false`,
        [tenantId, currentWsId]
      );
      const hasPriorWs = Number(priorWsRes.rows[0].n) > 0;
      if (!hasPriorWs || !cutoverDate) {
        return res.json({
          membership_number: String(membershipNumber),
          member_link: memberLink,
          tenant_id: tenantId,
          current_weight_set_id: currentWsId,
          cutover_date: cutoverDate,
          previous: null
        });
      }

      // Convert cutoverDate (YYYY-MM-DD) to the offset-encoded Bill epoch
      // SMALLINT that's stored in activity.activity_date. Use the platform
      // helper — both ends of the comparison live on the same scale.
      const cutoverBillDay = dateToMoleculeInt(cutoverDate);

      // Latest PPSI activity for this member BEFORE the cutover. PPSI lives
      // as activity_type='A' joined via MEMBER_SURVEY_LINK to a 'PPSI' survey.
      // Score is MEMBER_POINTS (mol_id resolved via cache).
      const mpId = await getMoleculeId(tenantId, 'MEMBER_POINTS');
      const mslId = await getMoleculeId(tenantId, 'MEMBER_SURVEY_LINK');
      const priorRes = await dbClient.query(
        `SELECT a.link, a.activity_date, COALESCE(d54.n1, 0) AS raw_score,
                COALESCE(ms.score_math_version, 1) AS math_version
           FROM activity a
           JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
           JOIN member_survey ms ON ms.link = d4.n1
           JOIN survey s ON s.link = ms.survey_link
           LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.p_link = $3
            AND a.activity_type = 'A'
            AND s.survey_code = 'PPSI'
            AND a.activity_date < $4
            AND ms.voided_ts IS NULL
          ORDER BY a.activity_date DESC, a.link DESC
          LIMIT 1`,
        [mslId, mpId, memberLink, cutoverBillDay]
      );

      if (priorRes.rows.length === 0) {
        return res.json({
          membership_number: String(membershipNumber),
          member_link: memberLink,
          tenant_id: tenantId,
          current_weight_set_id: currentWsId,
          cutover_date: cutoverDate,
          previous: null
        });
      }

      // Normalize PPSI score to 0..100. v=2 (Option A) is already on the
      // 0..100 scale; v=1 (legacy raw sum) caps at 102 and gets rescaled.
      const priorRow = priorRes.rows[0];
      const rawScore = Number(priorRow.raw_score);
      const mathVersion = Number(priorRow.math_version);
      const score = mathVersion === 2 ? Math.round(rawScore) : Math.round(rawScore * 100 / 102);

      // activity_date is offset-encoded SMALLINT (Bill epoch − 32768);
      // moleculeIntToDate handles the offset and returns a JS Date.
      const activityYmd = formatDateLocal(moleculeIntToDate(Number(priorRow.activity_date)));

      res.json({
        membership_number: String(membershipNumber),
        member_link: memberLink,
        tenant_id: tenantId,
        current_weight_set_id: currentWsId,
        cutover_date: cutoverDate,
        previous: {
          score,
          activity_date: activityYmd,
          score_math_version: mathVersion
        }
      });
    } catch (error) {
      console.error('GET /v1/member/:id/ppsi-history error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/members/:id/request-full-ppsi — set the FULL_PPSI_REQUESTED flag
  // on a member, telling the surveying flow to deliver the full PPSI on the
  // next survey rather than the short form.
  app.post('/v1/members/:id/request-full-ppsi', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const tenantId = req.tenantId || req.body.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      // Check if flag already set
      const existing = await getMoleculeRows(member.link, 'FULL_PPSI_REQUESTED', tenantId);
      if (existing.length > 0) return res.json({ success: true, already_set: true });

      await insertMoleculeRow(member.link, 'FULL_PPSI_REQUESTED', [], tenantId);
      res.json({ success: true });
    } catch (e) {
      console.error('Error setting FULL_PPSI_REQUESTED:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /v1/members/:id/request-full-ppsi — clear the full PPSI request flag
  app.delete('/v1/members/:id/request-full-ppsi', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      await deleteMoleculeRow(member.link, 'FULL_PPSI_REQUESTED', {}, tenantId);
      res.json({ success: true });
    } catch (e) {
      console.error('Error clearing FULL_PPSI_REQUESTED:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /v1/members/:id/ppsi-mode — check if full PPSI is requested for a participant
  app.get('/v1/members/:id/ppsi-mode', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      const rows = await getMoleculeRows(member.link, 'FULL_PPSI_REQUESTED', tenantId);
      res.json({ full_ppsi_requested: rows.length > 0 });
    } catch (e) {
      console.error('Error checking PPSI mode:', e.message);
      res.status(500).json({ error: e.message });
    }
  });
}

export default { register };
