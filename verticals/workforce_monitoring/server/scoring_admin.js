/**
 * Workforce Monitoring — PPII/PPSI weights administration.
 *
 * Phase 5 of the Insight server extraction (Session 129). Moved from
 * pointers.js:
 *   - GET    /v1/tenants/:id/ppii-weights                        (formerly L5037)
 *   - PUT    /v1/tenants/:id/ppii-weights                        (formerly L5152)
 *   - POST   /v1/tenants/:id/ppii-weights/recalculate            (formerly L5308)
 *   - GET    /v1/tenants/:id/ppsi-section-weights                (formerly L5458)
 *   - PUT    /v1/tenants/:id/ppsi-section-weights                (formerly L5571)
 *   - POST   /v1/tenants/:id/ppsi-section-weights/restore-defaults (formerly L5690)
 *
 * Plus the canEditTenantWeights auth helper (was at pointers.js L5026 —
 * used only by these 4 mutating endpoints, so it migrates here as a
 * module-private). req.session is set by platform auth middleware.
 *
 * ml/model_info.json is read for ML drift warnings on the PPII weight
 * endpoints. Path is built from ctx.paths.projectRoot so the file is
 * found regardless of the vertical's own directory depth.
 */

import fs from 'fs';
import path from 'path';

// Module-private auth gate. Superusers can edit any tenant; admins only their own.
function canEditTenantWeights(req, res, urlTenantId) {
  const role = req.session?.role;
  if (role === 'superuser') return true;
  if (role === 'admin' && Number(req.session?.tenantId) === Number(urlTenantId)) return true;
  res.status(403).json({ error: 'Admin (own tenant) or superuser role required' });
  return false;
}

export function register(app, ctx) {
  const { getDbClient, caches, paths } = ctx;

  // GET /v1/tenants/:id/ppii-weights — current stream weights for a tenant.
  // Joins ppii_stream so the response carries label + max_value alongside weights,
  // letting the admin UI render rows dynamically without a hardcoded stream list.
  app.get('/v1/tenants/:id/ppii-weights', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    try {
      const tenantId = parseInt(req.params.id);
      if (isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });

      const r = await dbClient.query(`
        SELECT s.code, s.label, s.max_value, s.sort_order,
               ws.weight_set_id, wsv.weight
          FROM ppii_stream s
          LEFT JOIN ppii_weight_set ws
            ON ws.tenant_id = s.tenant_id AND ws.is_current = true
          LEFT JOIN ppii_weight_set_value wsv
            ON wsv.weight_set_id = ws.weight_set_id AND wsv.stream_code = s.code
         WHERE s.tenant_id = $1
           AND s.is_active = true
         ORDER BY s.sort_order, s.code`,
        [tenantId]
      );
      if (r.rows.length === 0) {
        return res.status(404).json({ error: 'No PPII streams configured for this tenant' });
      }
      const weightSetId = r.rows[0].weight_set_id;
      if (weightSetId === null) {
        return res.status(404).json({ error: 'No current PPII weight set for this tenant' });
      }

      const streams = r.rows.map(row => ({
        code: row.code,
        label: row.label,
        max_value: Number(row.max_value),
        sort_order: row.sort_order,
        weight: row.weight === null ? null : Number(row.weight)
      }));
      const weights = {};
      for (const s of streams) if (s.weight !== null) weights[s.code] = s.weight;
      const sum = Object.values(weights).reduce((acc, v) => acc + v, 0);

      // Current ML model metadata (so the UI can show drift warnings)
      let modelInfo = null;
      try {
        const infoPath = path.join(paths.projectRoot, 'ml', 'model_info.json');
        if (fs.existsSync(infoPath)) modelInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      } catch (e) { /* non-fatal; UI handles null */ }

      // Recent change history — the audit trail that drives the
      // "Recent Changes" panel on the admin weights page. Last 10 weight
      // set rows for this tenant, newest first, with the per-stream weights
      // collapsed into a single object per row so the UI can show
      // "v3 — Apr 25 — Claude — pulse 0.30 → 0.35" style entries.
      const histRes = await dbClient.query(`
        SELECT ws.weight_set_id, ws.effective_from, ws.is_current, ws.change_note,
               ws.changed_by_user,
               pu.display_name AS changed_by_display_name,
               pu.username     AS changed_by_username,
               wsv.stream_code, wsv.weight
          FROM ppii_weight_set ws
          LEFT JOIN platform_user pu ON pu.user_id = ws.changed_by_user
          LEFT JOIN ppii_weight_set_value wsv ON wsv.weight_set_id = ws.weight_set_id
         WHERE ws.tenant_id = $1
           AND ws.weight_set_id IN (
             SELECT weight_set_id FROM ppii_weight_set
              WHERE tenant_id = $1
              ORDER BY effective_from DESC, weight_set_id DESC
              LIMIT 10
           )
         ORDER BY ws.effective_from DESC, ws.weight_set_id DESC, wsv.stream_code`,
        [tenantId]
      );
      const changesById = new Map();
      for (const row of histRes.rows) {
        let entry = changesById.get(row.weight_set_id);
        if (!entry) {
          entry = {
            weight_set_id: Number(row.weight_set_id),
            effective_from: row.effective_from,
            is_current: row.is_current,
            change_note: row.change_note,
            changed_by_user_id: row.changed_by_user,
            changed_by: row.changed_by_display_name || row.changed_by_username || null,
            weights: {}
          };
          changesById.set(row.weight_set_id, entry);
        }
        if (row.stream_code !== null) entry.weights[row.stream_code] = Number(row.weight);
      }
      const recentChanges = [...changesById.values()]
        .sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from) || b.weight_set_id - a.weight_set_id);

      res.json({
        tenant_id: tenantId,
        weight_set_id: weightSetId,
        streams,
        weights,
        sum,
        model_info: modelInfo,
        recent_changes: recentChanges
      });
    } catch (error) {
      console.error('GET /v1/tenants/:id/ppii-weights error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /v1/tenants/:id/ppii-weights — update stream weights. Superuser only.
  // Body: { <stream_code>: weight, ..., change_note?: string }
  //   - Numeric fields are treated as stream weights (each in [0,1], sum ≈ 1.0).
  //   - Body must cover exactly the tenant's active stream codes — missing or
  //     unknown codes return 400.
  //   - Optional `change_note` is stored on the new ppii_weight_set row.
  // Persistence: insert a new ppii_weight_set row marked is_current=true and
  // flip the prior row to is_current=false (transactional, so the partial unique
  // index ppii_weight_set_current_per_tenant never sees two currents).
  app.put('/v1/tenants/:id/ppii-weights', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });

    const tenantId = parseInt(req.params.id);
    if (isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });
    if (!canEditTenantWeights(req, res, tenantId)) return;

    const body = req.body || {};
    const changeNote = (typeof body.change_note === 'string' && body.change_note.trim()) ? body.change_note.trim() : null;

    // Look up active streams for this tenant — these are the codes we'll require
    // and accept. Anything in the body outside this set is rejected; anything
    // missing from the body is rejected. This keeps the cache and DB consistent.
    const streamRes = await dbClient.query(
      `SELECT code FROM ppii_stream WHERE tenant_id = $1 AND is_active = true ORDER BY sort_order, code`,
      [tenantId]
    );
    if (streamRes.rows.length === 0) {
      return res.status(404).json({ error: 'No PPII streams configured for this tenant' });
    }
    const activeCodes = streamRes.rows.map(r => r.code);
    const activeSet = new Set(activeCodes);

    // Pull weight values from the body. Anything that isn't a number (e.g.
    // change_note) is ignored; any non-numeric stream value is a 400.
    const values = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === 'change_note') continue;
      if (typeof v !== 'number' || !isFinite(v)) {
        return res.status(400).json({ error: `Invalid value for ${k}: must be a number in [0, 1]` });
      }
      if (v < 0 || v > 1) {
        return res.status(400).json({ error: `Invalid value for ${k}: must be a number in [0, 1]` });
      }
      if (!activeSet.has(k)) {
        return res.status(400).json({ error: `Unknown stream code '${k}' for this tenant` });
      }
      values[k] = v;
    }
    for (const code of activeCodes) {
      if (!(code in values)) {
        return res.status(400).json({ error: `Missing weight for stream '${code}'` });
      }
    }
    const sum = Object.values(values).reduce((acc, v) => acc + v, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      return res.status(400).json({ error: `Weights must sum to 1.0 (got ${sum.toFixed(4)})` });
    }

    const client = await dbClient.connect();
    try {
      await client.query('BEGIN');

      // Capture old current weight set for audit. Lock the row to keep concurrent
      // PUTs from racing the is_current flip below.
      const oldRes = await client.query(
        `SELECT ws.weight_set_id, wsv.stream_code, wsv.weight
           FROM ppii_weight_set ws
           LEFT JOIN ppii_weight_set_value wsv USING (weight_set_id)
          WHERE ws.tenant_id = $1 AND ws.is_current = true
          FOR UPDATE OF ws`,
        [tenantId]
      );
      const oldWeights = {};
      let oldWeightSetId = null;
      for (const row of oldRes.rows) {
        oldWeightSetId = row.weight_set_id;
        if (row.stream_code !== null) oldWeights[row.stream_code] = Number(row.weight);
      }

      // Flip the prior current row first so the partial unique index never sees
      // two currents at once.
      if (oldWeightSetId !== null) {
        await client.query(
          `UPDATE ppii_weight_set SET is_current = false WHERE weight_set_id = $1`,
          [oldWeightSetId]
        );
      }

      const userId = req.session?.userId || null;
      const insertWs = await client.query(
        `INSERT INTO ppii_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current)
         VALUES ($1, NOW(), $2, $3, true)
         RETURNING weight_set_id`,
        [tenantId, userId, changeNote]
      );
      const newWeightSetId = insertWs.rows[0].weight_set_id;

      for (const [code, value] of Object.entries(values)) {
        await client.query(
          `INSERT INTO ppii_weight_set_value (weight_set_id, stream_code, weight)
           VALUES ($1, $2, $3)`,
          [newWeightSetId, code, value]
        );
      }

      await client.query('COMMIT');

      // Reload cache so the next scoring call sees new weights + new weight_set_id.
      caches.ppiiWeights.set(tenantId, { ...values, weight_set_id: newWeightSetId });

      // Audit log
      console.log(`[ppii_weights] tenant=${tenantId} user=${userId || '?'} old_set=${oldWeightSetId} new_set=${newWeightSetId} old=${JSON.stringify(oldWeights)} new=${JSON.stringify(values)}${changeNote ? ` note="${changeNote}"` : ''}`);

      // Compute max drift vs ML model's trained-against weights (for retrain recommendation).
      // Drift is computed across the union of stream codes so adding/removing a
      // stream relative to the trained model surfaces as drift.
      let mlDriftMax = 0;
      try {
        const infoPath = path.join(paths.projectRoot, 'ml', 'model_info.json');
        if (fs.existsSync(infoPath)) {
          const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
          const trained = info.trained_against_ppii_weights;
          if (trained) {
            const allCodes = new Set([...Object.keys(values), ...Object.keys(trained)]);
            for (const k of allCodes) {
              const drift = Math.abs((values[k] || 0) - (trained[k] || 0));
              if (drift > mlDriftMax) mlDriftMax = drift;
            }
          }
        }
      } catch (e) { /* non-fatal */ }

      res.json({
        tenant_id: tenantId,
        weight_set_id: newWeightSetId,
        weights: values,
        sum,
        ml_calibration_drift_warning: mlDriftMax >= 0.10,
        ml_drift_max: Number(mlDriftMax.toFixed(4))
      });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('PUT /v1/tenants/:id/ppii-weights rollback failed:', rbErr.message); }
      console.error('PUT /v1/tenants/:id/ppii-weights error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // POST /v1/tenants/:id/ppii-weights/recalculate — recompute PPII for every
  // member who has at least one prior snapshot, applying the *current* weight
  // set to each member's most-recent stored components. Writes a new
  // ppii_score_history row (trigger_type='WEIGHT_CHANGE_RECOMPUTE') per member
  // so the audit trail captures the recompute as its own event. The chart's
  // "Previous PPII" line keeps reading the prior-weight-set snapshot — this
  // endpoint just advances "current" everywhere a member already had history.
  //
  // Members with no prior snapshot are left alone — they'll get one organically
  // the next time POST_ACCRUAL fires for them. This keeps the recompute side-
  // effect bounded to members the system has already scored.
  //
  // Superuser only. Returns { tenant_id, members_recomputed, snapshots_written,
  // weight_set_id }.
  app.post('/v1/tenants/:id/ppii-weights/recalculate', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = parseInt(req.params.id);
    if (isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });
    if (!canEditTenantWeights(req, res, tenantId)) return;

    try {
      // Resolve current weight set + per-stream max_value (for normalization).
      const tenantWeights = caches.ppiiWeights.get(tenantId);
      const tenantStreams = caches.ppiiStreams.get(tenantId) || [];
      if (!tenantWeights || !tenantWeights.weight_set_id) {
        return res.status(404).json({ error: 'No current weight set for this tenant' });
      }
      if (tenantStreams.length === 0) {
        return res.status(404).json({ error: 'No active streams for this tenant' });
      }
      const currentWeightSetId = tenantWeights.weight_set_id;
      const streamMax = {};
      for (const s of tenantStreams) streamMax[s.code] = Number(s.max_value);

      // Pull the latest snapshot per member, then its components. One pass
      // per table — the (p_link, computed_at DESC) index keeps this fast.
      // Erica feedback (Session 113): also pull the prior ppii_score and join
      // member info so the response can include a per-member drill-down with
      // old → new scores. The admin UI renders this in a "View details" modal.
      const latestRes = await dbClient.query(
        `SELECT DISTINCT ON (h.p_link)
                h.history_id, h.p_link, h.weight_set_id, h.ppii_score AS prior_score,
                m.membership_number, m.fname, m.lname
           FROM ppii_score_history h
           LEFT JOIN member m ON m.link = h.p_link
          WHERE h.tenant_id = $1
          ORDER BY h.p_link, h.computed_at DESC, h.history_id DESC`,
        [tenantId]
      );
      if (latestRes.rows.length === 0) {
        return res.json({
          tenant_id: tenantId,
          weight_set_id: currentWeightSetId,
          members_recomputed: 0,
          snapshots_written: 0,
          members: [],
          note: 'No prior snapshots — nothing to recompute. Members will be snapshotted on their next activity.'
        });
      }
      const historyIds = latestRes.rows.map(r => Number(r.history_id));
      const compRes = await dbClient.query(
        `SELECT history_id, stream_code, raw_value
           FROM ppii_score_history_component
          WHERE history_id = ANY($1::bigint[])`,
        [historyIds]
      );
      const compsByHistoryId = new Map();
      for (const row of compRes.rows) {
        const id = Number(row.history_id);
        if (!compsByHistoryId.has(id)) compsByHistoryId.set(id, {});
        compsByHistoryId.get(id)[row.stream_code] = Number(row.raw_value);
      }

      // Walk each member, recompute under current weights, write a new
      // history row. One transaction so a partial failure rolls back cleanly.
      // Capture per-member (old, new) for the drill-down (Erica feedback —
      // "I wish I could navigate to the one's who were recalculated").
      const client = await dbClient.connect();
      let snapshotsWritten = 0;
      const memberDetail = [];
      try {
        await client.query('BEGIN');
        for (const row of latestRes.rows) {
          const components = compsByHistoryId.get(Number(row.history_id)) || {};
          // Recompute composite from stored components × current weights.
          // Proportional reweighting when a stream had no data at the prior
          // snapshot's calc time (mirrors composeFromContributions).
          let num = 0, den = 0;
          for (const code of Object.keys(streamMax)) {
            if (!(code in components)) continue;
            const norm = (components[code] / streamMax[code]) * 100;
            const w = Number(tenantWeights[code] || 0);
            num += w * norm;
            den += w;
          }
          if (den <= 0) continue; // member's stored components don't overlap any active stream
          const score = Math.max(0, Math.min(100, Math.round(num / den)));

          const ins = await client.query(
            `INSERT INTO ppii_score_history (tenant_id, p_link, computed_at, ppii_score, weight_set_id, trigger_type)
             VALUES ($1, $2, NOW(), $3, $4, 'WEIGHT_CHANGE_RECOMPUTE')
             RETURNING history_id`,
            [tenantId, row.p_link, score, currentWeightSetId]
          );
          const newHistoryId = ins.rows[0].history_id;
          // Carry the same components forward — recompute uses the same raws.
          for (const [code, raw] of Object.entries(components)) {
            await client.query(
              `INSERT INTO ppii_score_history_component (history_id, stream_code, raw_value)
               VALUES ($1, $2, $3)`,
              [newHistoryId, code, raw]
            );
          }
          snapshotsWritten++;
          const priorScore = row.prior_score == null ? null : Number(row.prior_score);
          memberDetail.push({
            membership_number: row.membership_number,
            fname: row.fname,
            lname: row.lname,
            prior_score: priorScore,
            new_score: score,
            delta: priorScore == null ? null : score - priorScore,
            prior_weight_set_id: Number(row.weight_set_id)
          });
        }
        await client.query('COMMIT');
      } catch (innerErr) {
        try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('recalculate rollback failed:', rbErr.message); }
        throw innerErr;
      } finally {
        client.release();
      }

      // Sort drill-down by largest absolute delta first — what an admin
      // doing post-change spot-checks is most interested in.
      memberDetail.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));

      console.log(`[ppii_weights] recalculate tenant=${tenantId} user=${req.session?.userId || '?'} weight_set=${currentWeightSetId} snapshots=${snapshotsWritten}`);

      res.json({
        tenant_id: tenantId,
        weight_set_id: currentWeightSetId,
        members_recomputed: snapshotsWritten,
        snapshots_written: snapshotsWritten,
        members: memberDetail
      });
    } catch (error) {
      console.error('POST /v1/tenants/:id/ppii-weights/recalculate error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // PPSI SUBDOMAIN WEIGHTS (v59) — per-tenant editable Section weights for PPSI
  // scoring (Erica's Option A math). Mirrors the v58 PPII weights pattern, with
  // an extra is_factory_default flag on the weight set so a Restore Defaults
  // button can re-seed the current row from the factory baseline.
  // ============================================================

  // GET /v1/tenants/:id/ppsi-section-weights — current section weights for a
  // tenant. Returns the eight section rows joined with the current weight set
  // AND the factory-default weights (so the UI can show "factory: 0.125" hints
  // next to each slider and gate the Restore Defaults button on whether current
  // already matches factory).
  app.get('/v1/tenants/:id/ppsi-section-weights', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    try {
      const tenantId = parseInt(req.params.id);
      if (isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });

      const r = await dbClient.query(`
        SELECT s.code, s.label, s.question_count, s.max_value, s.sort_order,
               cur_ws.weight_set_id        AS current_weight_set_id,
               cur_wsv.weight              AS current_weight,
               fac_ws.weight_set_id        AS factory_weight_set_id,
               fac_wsv.weight              AS factory_weight
          FROM ppsi_subdomain s
          LEFT JOIN ppsi_subdomain_weight_set cur_ws
            ON cur_ws.tenant_id = s.tenant_id AND cur_ws.is_current = true
          LEFT JOIN ppsi_subdomain_weight_set_value cur_wsv
            ON cur_wsv.weight_set_id = cur_ws.weight_set_id AND cur_wsv.subdomain_code = s.code
          LEFT JOIN ppsi_subdomain_weight_set fac_ws
            ON fac_ws.tenant_id = s.tenant_id AND fac_ws.is_factory_default = true
          LEFT JOIN ppsi_subdomain_weight_set_value fac_wsv
            ON fac_wsv.weight_set_id = fac_ws.weight_set_id AND fac_wsv.subdomain_code = s.code
         WHERE s.tenant_id = $1
           AND s.is_active = true
         ORDER BY s.sort_order, s.code`,
        [tenantId]
      );
      if (r.rows.length === 0) {
        return res.status(404).json({ error: 'No PPSI subdomains configured for this tenant' });
      }
      const weightSetId = r.rows[0].current_weight_set_id;
      const factoryWeightSetId = r.rows[0].factory_weight_set_id;
      if (weightSetId === null) {
        return res.status(404).json({ error: 'No current PPSI weight set for this tenant' });
      }

      const sections = r.rows.map(row => ({
        code: row.code,
        label: row.label,
        question_count: Number(row.question_count),
        max_value: Number(row.max_value),
        sort_order: row.sort_order,
        weight: row.current_weight === null ? null : Number(row.current_weight),
        factory_weight: row.factory_weight === null ? null : Number(row.factory_weight)
      }));
      const weights = {};
      for (const s of sections) if (s.weight !== null) weights[s.code] = s.weight;
      const sum = Object.values(weights).reduce((acc, v) => acc + v, 0);

      // Recent change history — last 10 weight-set rows for the tenant. Mirror
      // the PPII recent_changes shape so the admin UI can render it with the
      // same component.
      const histRes = await dbClient.query(`
        SELECT ws.weight_set_id, ws.effective_from, ws.is_current, ws.is_factory_default,
               ws.change_note, ws.changed_by_user,
               pu.display_name AS changed_by_display_name,
               pu.username     AS changed_by_username,
               wsv.subdomain_code, wsv.weight
          FROM ppsi_subdomain_weight_set ws
          LEFT JOIN platform_user pu ON pu.user_id = ws.changed_by_user
          LEFT JOIN ppsi_subdomain_weight_set_value wsv ON wsv.weight_set_id = ws.weight_set_id
         WHERE ws.tenant_id = $1
           AND ws.weight_set_id IN (
             SELECT weight_set_id FROM ppsi_subdomain_weight_set
              WHERE tenant_id = $1
              ORDER BY effective_from DESC, weight_set_id DESC
              LIMIT 10
           )
         ORDER BY ws.effective_from DESC, ws.weight_set_id DESC, wsv.subdomain_code`,
        [tenantId]
      );
      const changesById = new Map();
      for (const row of histRes.rows) {
        let entry = changesById.get(row.weight_set_id);
        if (!entry) {
          entry = {
            weight_set_id: Number(row.weight_set_id),
            effective_from: row.effective_from,
            is_current: row.is_current,
            is_factory_default: row.is_factory_default,
            change_note: row.change_note,
            changed_by_user_id: row.changed_by_user,
            changed_by: row.changed_by_display_name || row.changed_by_username || null,
            weights: {}
          };
          changesById.set(row.weight_set_id, entry);
        }
        if (row.subdomain_code !== null) entry.weights[row.subdomain_code] = Number(row.weight);
      }
      const recentChanges = [...changesById.values()]
        .sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from) || b.weight_set_id - a.weight_set_id);

      res.json({
        tenant_id: tenantId,
        weight_set_id: weightSetId,
        factory_weight_set_id: factoryWeightSetId,
        sections,
        weights,
        sum,
        recent_changes: recentChanges
      });
    } catch (error) {
      console.error('GET /v1/tenants/:id/ppsi-section-weights error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /v1/tenants/:id/ppsi-section-weights — superuser only.
  // Body: { <subdomain_code>: weight, ..., change_note?: string }
  //   - Numeric fields are treated as section weights (each in [0,1], sum ≈ 1.0).
  //   - Body must cover exactly the tenant's active subdomain codes.
  //   - Optional `change_note` is stored on the new weight set row.
  // Persistence: same flip-and-insert pattern as PPII weights, guarded by the
  // partial unique index ppsi_weight_set_current_per_tenant.
  app.put('/v1/tenants/:id/ppsi-section-weights', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });

    const tenantId = parseInt(req.params.id);
    if (isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });
    if (!canEditTenantWeights(req, res, tenantId)) return;

    const body = req.body || {};
    const changeNote = (typeof body.change_note === 'string' && body.change_note.trim()) ? body.change_note.trim() : null;

    const subdomainRes = await dbClient.query(
      `SELECT code FROM ppsi_subdomain WHERE tenant_id = $1 AND is_active = true ORDER BY sort_order, code`,
      [tenantId]
    );
    if (subdomainRes.rows.length === 0) {
      return res.status(404).json({ error: 'No PPSI subdomains configured for this tenant' });
    }
    const activeCodes = subdomainRes.rows.map(r => r.code);
    const activeSet = new Set(activeCodes);

    const values = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === 'change_note') continue;
      if (typeof v !== 'number' || !isFinite(v)) {
        return res.status(400).json({ error: `Invalid value for ${k}: must be a number in [0, 1]` });
      }
      if (v < 0 || v > 1) {
        return res.status(400).json({ error: `Invalid value for ${k}: must be a number in [0, 1]` });
      }
      if (!activeSet.has(k)) {
        return res.status(400).json({ error: `Unknown subdomain code '${k}' for this tenant` });
      }
      values[k] = v;
    }
    for (const code of activeCodes) {
      if (!(code in values)) {
        return res.status(400).json({ error: `Missing weight for subdomain '${code}'` });
      }
    }
    const sum = Object.values(values).reduce((acc, v) => acc + v, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      return res.status(400).json({ error: `Weights must sum to 1.0 (got ${sum.toFixed(4)})` });
    }

    const client = await dbClient.connect();
    try {
      await client.query('BEGIN');

      const oldRes = await client.query(
        `SELECT ws.weight_set_id, wsv.subdomain_code, wsv.weight
           FROM ppsi_subdomain_weight_set ws
           LEFT JOIN ppsi_subdomain_weight_set_value wsv USING (weight_set_id)
          WHERE ws.tenant_id = $1 AND ws.is_current = true
          FOR UPDATE OF ws`,
        [tenantId]
      );
      const oldWeights = {};
      let oldWeightSetId = null;
      for (const row of oldRes.rows) {
        oldWeightSetId = row.weight_set_id;
        if (row.subdomain_code !== null) oldWeights[row.subdomain_code] = Number(row.weight);
      }

      if (oldWeightSetId !== null) {
        await client.query(
          `UPDATE ppsi_subdomain_weight_set SET is_current = false WHERE weight_set_id = $1`,
          [oldWeightSetId]
        );
      }

      const userId = req.session?.userId || null;
      const insertWs = await client.query(
        `INSERT INTO ppsi_subdomain_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current, is_factory_default)
         VALUES ($1, NOW(), $2, $3, true, false)
         RETURNING weight_set_id`,
        [tenantId, userId, changeNote]
      );
      const newWeightSetId = insertWs.rows[0].weight_set_id;

      for (const [code, value] of Object.entries(values)) {
        await client.query(
          `INSERT INTO ppsi_subdomain_weight_set_value (weight_set_id, subdomain_code, weight)
           VALUES ($1, $2, $3)`,
          [newWeightSetId, code, value]
        );
      }

      await client.query('COMMIT');

      // Reload cache so the next survey-scoring call sees the new weights.
      // Preserve factory_weight_set_id (unchanged by a regular PUT).
      const prevCache = caches.ppsiSubdomainWeights.get(tenantId) || {};
      caches.ppsiSubdomainWeights.set(tenantId, {
        ...values,
        weight_set_id: newWeightSetId,
        factory_weight_set_id: prevCache.factory_weight_set_id
      });

      console.log(`[ppsi_section_weights] tenant=${tenantId} user=${userId || '?'} old_set=${oldWeightSetId} new_set=${newWeightSetId} old=${JSON.stringify(oldWeights)} new=${JSON.stringify(values)}${changeNote ? ` note="${changeNote}"` : ''}`);

      res.json({
        tenant_id: tenantId,
        weight_set_id: newWeightSetId,
        weights: values,
        sum
      });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('PUT /v1/tenants/:id/ppsi-section-weights rollback failed:', rbErr.message); }
      console.error('PUT /v1/tenants/:id/ppsi-section-weights error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // POST /v1/tenants/:id/ppsi-section-weights/restore-defaults — superuser only.
  // Creates a new weight set seeded from the factory_default row, marks it
  // is_current=true, flips the prior current row off. The factory row itself
  // is never modified — Restore Defaults always re-seeds *from* it.
  app.post('/v1/tenants/:id/ppsi-section-weights/restore-defaults', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = parseInt(req.params.id);
    if (isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });
    if (!canEditTenantWeights(req, res, tenantId)) return;

    const client = await dbClient.connect();
    try {
      await client.query('BEGIN');

      // Read factory weights — the Restore Defaults source of truth.
      const factoryRes = await client.query(
        `SELECT ws.weight_set_id, wsv.subdomain_code, wsv.weight
           FROM ppsi_subdomain_weight_set ws
           JOIN ppsi_subdomain_weight_set_value wsv USING (weight_set_id)
          WHERE ws.tenant_id = $1 AND ws.is_factory_default = true`,
        [tenantId]
      );
      if (factoryRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No factory-default PPSI weight set for this tenant' });
      }
      const factoryWeightSetId = factoryRes.rows[0].weight_set_id;
      const factoryValues = {};
      for (const row of factoryRes.rows) factoryValues[row.subdomain_code] = Number(row.weight);

      // Flip prior current off (lock first to keep concurrent edits from racing).
      const oldRes = await client.query(
        `SELECT weight_set_id FROM ppsi_subdomain_weight_set
          WHERE tenant_id = $1 AND is_current = true
          FOR UPDATE`,
        [tenantId]
      );
      const oldWeightSetId = oldRes.rows.length ? oldRes.rows[0].weight_set_id : null;
      if (oldWeightSetId !== null) {
        await client.query(
          `UPDATE ppsi_subdomain_weight_set SET is_current = false WHERE weight_set_id = $1`,
          [oldWeightSetId]
        );
      }

      const userId = req.session?.userId || null;
      const insertWs = await client.query(
        `INSERT INTO ppsi_subdomain_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current, is_factory_default)
         VALUES ($1, NOW(), $2, $3, true, false)
         RETURNING weight_set_id`,
        [tenantId, userId, `Restore Defaults — re-seeded from factory weight set #${factoryWeightSetId}`]
      );
      const newWeightSetId = insertWs.rows[0].weight_set_id;

      for (const [code, value] of Object.entries(factoryValues)) {
        await client.query(
          `INSERT INTO ppsi_subdomain_weight_set_value (weight_set_id, subdomain_code, weight)
           VALUES ($1, $2, $3)`,
          [newWeightSetId, code, value]
        );
      }

      await client.query('COMMIT');

      caches.ppsiSubdomainWeights.set(tenantId, {
        ...factoryValues,
        weight_set_id: newWeightSetId,
        factory_weight_set_id: factoryWeightSetId
      });

      console.log(`[ppsi_section_weights] restore-defaults tenant=${tenantId} user=${userId || '?'} old_set=${oldWeightSetId} new_set=${newWeightSetId} factory_set=${factoryWeightSetId}`);

      res.json({
        tenant_id: tenantId,
        weight_set_id: newWeightSetId,
        factory_weight_set_id: factoryWeightSetId,
        weights: factoryValues
      });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('restore-defaults rollback failed:', rbErr.message); }
      console.error('POST /v1/tenants/:id/ppsi-section-weights/restore-defaults error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });
}

/**
 * Register vertical→platform callbacks. Called from index.js → boot(ctx).
 *
 * prepareRetrainWeights(weights): the /v1/ml/retrain SSE endpoint stays
 * platform-side (generic ML infra — spawns the Python retrain script and
 * streams progress), but the weight bundle it sends is Insight-shaped
 * (pulse / ppsi / compliance / events, summing to 1.0). This callback
 * validates that shape and returns either the JSON payload the retrain
 * script expects, or an { error } the platform surfaces to the caller.
 * When the vertical isn't loaded the platform gets undefined and refuses
 * the retrain — correct, since a platform-only tenant has no model.
 */
export function registerCallbacks(ctx) {
  ctx.registerCallback('prepareRetrainWeights', (weights) => {
    if (!weights || typeof weights.pulse !== 'number') {
      return { error: 'No scoring weights configured' };
    }
    const sum = (weights.pulse || 0) + (weights.ppsi || 0) + (weights.compliance || 0) + (weights.events || 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      return { error: `Tenant weights invalid (sum=${sum.toFixed(4)})` };
    }
    return {
      payload: {
        pulse:      weights.pulse,
        ppsi:       weights.ppsi,
        compliance: weights.compliance,
        events:     weights.events
      }
    };
  });
}

export default { register, registerCallbacks };
