/**
 * Workforce Monitoring (Insight) — Network Directory Phase 1 (Session 154).
 *
 * Erica's spec is the contract: PI2_Network_Directory_Build_Specification
 * (filed S141). Two sections sharing a data model but not governance:
 *
 *   - Monitoring Program Network — the program's OWN list
 *     (program_network_entry rows pointing at shared entity records).
 *     The program decides what belongs on it, alone. Money never
 *     touches it: no fee, tier, or paid feature can place, position,
 *     or style an entity here (spec §3, the hard firewall).
 *   - IHS Network Directory — the shared pool (network_entity rows at
 *     tenant 0 carrying ihs_status 'L' Listed / 'V' Verified). One
 *     directory, identical for every program — offered whole or not
 *     at all (spec §4). A program cannot subset it; participants apply
 *     their own filters client-side.
 *
 * Display rules built in (spec §5-§6 + Appendix A):
 *   - Neutral ordering ONLY (alphabetical). Verification is a badge and
 *     a participant-applied filter, never a rank. (§10 leaves paid
 *     ordering open — build to neutral until resolved.)
 *   - Listed is not a deficiency state: no warning affordance anywhere.
 *   - Cost never rides the listing card — detail view only.
 *   - One entity, two relationships: a program-list row also shows its
 *     IHS verification state; each marker attributes its own authority.
 *
 * Phase 1 deliberately EXCLUDES: participant selections + release-gated
 * sharing (Phase 2 — the participant-scoped partition), suggestions,
 * suggested lists, applications, paid features, and all §10 open
 * decisions.
 *
 * Endpoints:
 *   PUBLIC (allowlisted in pointers.js isPublicRoute, ?t= tenant
 *   resolution like /v1/evaluator-directory — directory content is
 *   public directory data, no PHI):
 *   - GET  /v1/network-directory            the participant view (both
 *                                           sections per the program's
 *                                           three-way visibility setting)
 *   - GET  /v1/network-directory/entity/:id detail view (adds cost,
 *                                           contact, description; only
 *                                           entities visible in that
 *                                           program's directory)
 *
 *   STAFF (session-gated; tenant from req.tenantId):
 *   - GET    /v1/network-directory/types            active taxonomy
 *   - GET    /v1/network-directory/admin/entities   IHS pool + own program
 *                                                   entities (management view)
 *   - POST   /v1/network-directory/admin/entities   create (scope 'ihs' =
 *                                                   superuser only, tenant 0;
 *                                                   scope 'program' = private)
 *   - PUT    /v1/network-directory/admin/entities/:id  update (tenant-0 rows
 *                                                   superuser only; ihs_status
 *                                                   transitions stamp/clear
 *                                                   verified_date)
 *   - DELETE /v1/network-directory/admin/entities/:id  refuses while any
 *                                                   program's list references
 *                                                   the entity (retire instead)
 *   - GET    /v1/network-directory/program-list     the program's own list
 *   - POST   /v1/network-directory/program-list     add an entity to it
 *   - DELETE /v1/network-directory/program-list/:entryId  remove from it
 *   - GET    /v1/network-directory/settings         { visibility }
 *   - PUT    /v1/network-directory/settings         set ihs/program/both
 *
 * Backed by db_migrate v128: network_entity_type, network_entity,
 * program_network_entry + the per-tenant sysparm 'network_directory'
 * visibility setting.
 */

const VISIBILITY_VALUES = ['ihs', 'program', 'both'];

// Card fields for the public participant view — deliberately NO cost
// (detail view only, spec Appendix A) and no contact detail beyond
// city/state. The badge data (ihs_status) rides every row so "one
// entity, two relationships" renders on program-list rows too.
const CARD_FIELDS = `e.entity_id, e.entity_name, e.organization, e.services,
                     e.city, e.state, e.virtual_available, e.ihs_status,
                     t.type_code, t.type_name`;

// The three-way setting (spec §4), read with a fallback so a tenant
// missing the config row behaves sensibly rather than erroring.
async function readVisibility(dbClient, tenantId) {
  try {
    const r = await dbClient.query(
      `SELECT sd.value FROM sysparm s
       JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
       WHERE s.tenant_id = $1 AND s.sysparm_key = 'network_directory'
         AND sd.category = 'config' AND sd.code = 'visibility'`,
      [tenantId]
    );
    const v = r.rows[0]?.value;
    return VISIBILITY_VALUES.includes(v) ? v : 'both';
  } catch (e) {
    console.error('network_directory readVisibility failed, defaulting to both:', e);
    return 'both';
  }
}

async function resolvePublicTenant(dbClient, t) {
  const r = await dbClient.query(
    /^\d+$/.test(t)
      ? `SELECT tenant_id, name FROM tenant WHERE tenant_id = $1`
      : `SELECT tenant_id, name FROM tenant WHERE tenant_key = $1`,
    [t]
  );
  return r.rows[0] || null;
}

export function register(app, ctx) {

  // ---------- PUBLIC: the participant view ----------
  app.get('/v1/network-directory', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const t = (req.query.t || '').toString().trim();
    if (!t) return res.status(400).json({ error: 'program identifier required' });
    try {
      const tenant = await resolvePublicTenant(dbClient, t);
      if (!tenant) return res.status(404).json({ error: 'Unknown program' });
      const visibility = await readVisibility(dbClient, tenant.tenant_id);

      let programSection = [];
      if (visibility === 'program' || visibility === 'both') {
        const r = await dbClient.query(
          `SELECT ${CARD_FIELDS}
           FROM program_network_entry pe
           JOIN network_entity e ON e.entity_id = pe.entity_id
           JOIN network_entity_type t ON t.entity_type_id = e.entity_type_id
           WHERE pe.tenant_id = $1 AND pe.is_active = true AND e.is_active = true
           ORDER BY e.entity_name`,
          [tenant.tenant_id]
        );
        programSection = r.rows;
      }

      let ihsSection = [];
      if (visibility === 'ihs' || visibility === 'both') {
        const r = await dbClient.query(
          `SELECT ${CARD_FIELDS}
           FROM network_entity e
           JOIN network_entity_type t ON t.entity_type_id = e.entity_type_id
           WHERE e.tenant_id = 0 AND e.ihs_status IS NOT NULL AND e.is_active = true
           ORDER BY e.entity_name`
        );
        ihsSection = r.rows;
      }

      res.json({
        program: tenant.name,
        visibility,
        program_section: programSection,
        ihs_section: ihsSection,
      });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // ---------- PUBLIC: the detail view ----------
  // Serves an entity only when it is actually visible in this program's
  // directory (its own list per visibility, or the IHS section per
  // visibility) — no cross-tenant probing of private entities.
  app.get('/v1/network-directory/entity/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const t = (req.query.t || '').toString().trim();
    if (!t) return res.status(400).json({ error: 'program identifier required' });
    const entityId = parseInt(req.params.id);
    if (!entityId) return res.status(400).json({ error: 'entity id required' });
    try {
      const tenant = await resolvePublicTenant(dbClient, t);
      if (!tenant) return res.status(404).json({ error: 'Unknown program' });
      const visibility = await readVisibility(dbClient, tenant.tenant_id);
      const showProgram = visibility === 'program' || visibility === 'both';
      const showIhs = visibility === 'ihs' || visibility === 'both';
      const r = await dbClient.query(
        `SELECT e.entity_id, e.entity_name, e.organization, e.description, e.services,
                e.city, e.state, e.phone, e.email, e.website, e.virtual_available,
                e.cost_low, e.cost_high, e.cost_notes, e.ihs_status,
                t.type_code, t.type_name,
                EXISTS (SELECT 1 FROM program_network_entry pe
                        WHERE pe.entity_id = e.entity_id AND pe.tenant_id = $2
                          AND pe.is_active = true) AS on_program_list
         FROM network_entity e
         JOIN network_entity_type t ON t.entity_type_id = e.entity_type_id
         WHERE e.entity_id = $1 AND e.is_active = true`,
        [entityId, tenant.tenant_id]
      );
      const row = r.rows[0];
      // A private entity never carries ihs_status (v128 CHECK), so a non-null
      // status alone proves membership in the shared IHS section.
      const visibleHere = row && (
        (showProgram && row.on_program_list) ||
        (showIhs && row.ihs_status !== null)
      );
      if (!visibleHere) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // ---------- STAFF: taxonomy ----------
  app.get('/v1/network-directory/types', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    try {
      const r = await dbClient.query(
        `SELECT entity_type_id, type_code, type_name, sort_order
         FROM network_entity_type WHERE is_active = true ORDER BY sort_order`
      );
      res.json(r.rows);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // ---------- STAFF: entity management view ----------
  // The tenant-0 IHS pool plus this program's own private entities, with
  // an on_list flag so the admin page can offer add/remove in place.
  app.get('/v1/network-directory/admin/entities', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const r = await dbClient.query(
        `SELECT e.entity_id, e.tenant_id, e.entity_code, e.entity_name, e.organization,
                e.description, e.services, e.city, e.state, e.phone, e.email, e.website,
                e.virtual_available, e.cost_low, e.cost_high, e.cost_notes,
                e.ihs_status, e.verified_date, e.is_active,
                t.type_code, t.type_name, e.entity_type_id,
                pe.entry_id AS on_list_entry_id
         FROM network_entity e
         JOIN network_entity_type t ON t.entity_type_id = e.entity_type_id
         LEFT JOIN program_network_entry pe
           ON pe.entity_id = e.entity_id AND pe.tenant_id = $1 AND pe.is_active = true
         WHERE e.tenant_id = 0 OR e.tenant_id = $1
         ORDER BY e.entity_name`,
        [tenantId]
      );
      res.json(r.rows);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // ---------- STAFF: create entity ----------
  // scope 'program' (default): a private entity on this program's shelf.
  // scope 'ihs' (superuser only): a shared IHS-pool entity, born Listed.
  app.post('/v1/network-directory/admin/entities', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const b = req.body;
    const scope = b.scope === 'ihs' ? 'ihs' : 'program';
    if (scope === 'ihs' && req.session?.role !== 'superuser') {
      return res.status(403).json({ error: 'Only a platform administrator can add entities to the IHS network' });
    }
    if (!b.entity_code || !b.entity_name || !b.entity_type_id) {
      return res.status(400).json({ error: 'entity_code, entity_name, and entity_type_id are required' });
    }
    if ((b.cost_low != null && b.cost_high != null) && Number(b.cost_low) > Number(b.cost_high)) {
      return res.status(400).json({ error: 'The low cost cannot be higher than the high cost' });
    }
    const ownerTenant = scope === 'ihs' ? 0 : tenantId;
    const ihsStatus = scope === 'ihs' ? 'L' : null;
    try {
      const r = await dbClient.query(
        `INSERT INTO network_entity (tenant_id, entity_code, entity_name, entity_type_id,
                                     organization, description, services, city, state,
                                     phone, email, website, virtual_available,
                                     cost_low, cost_high, cost_notes, ihs_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [ownerTenant, b.entity_code, b.entity_name, b.entity_type_id,
         b.organization || null, b.description || null, b.services || null,
         b.city || null, b.state || null, b.phone || null, b.email || null,
         b.website || null, b.virtual_available === true,
         b.cost_low ?? null, b.cost_high ?? null, b.cost_notes || null, ihsStatus]
      );
      res.json(r.rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: `An entity with code "${b.entity_code}" already exists` });
      if (e.code === '23503') return res.status(400).json({ error: 'Unknown entity type' });
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });

  // ---------- STAFF: update entity ----------
  app.put('/v1/network-directory/admin/entities/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const entityId = parseInt(req.params.id);
    if (!entityId) return res.status(400).json({ error: 'entity id required' });
    const b = req.body;
    if ((b.cost_low != null && b.cost_high != null) && Number(b.cost_low) > Number(b.cost_high)) {
      return res.status(400).json({ error: 'The low cost cannot be higher than the high cost' });
    }
    try {
      const existing = await dbClient.query(
        `SELECT entity_id, tenant_id, ihs_status FROM network_entity WHERE entity_id = $1`,
        [entityId]
      );
      const row = existing.rows[0];
      // Same not-found answer whether the entity is missing or belongs to
      // another program — no cross-tenant existence oracle.
      if (!row || (row.tenant_id !== 0 && row.tenant_id !== tenantId)) {
        return res.status(404).json({ error: 'Not found' });
      }
      const isIhsRow = row.tenant_id === 0;
      if (isIhsRow && req.session?.role !== 'superuser') {
        return res.status(403).json({ error: 'Only a platform administrator can edit IHS network entities' });
      }

      // ihs_status transitions (IHS rows + superuser only). Moving to
      // Verified stamps today; leaving Verified clears the stamp.
      let statusSql = '';
      const params = [entityId, b.entity_code, b.entity_name, b.entity_type_id,
        b.organization, b.description, b.services, b.city, b.state,
        b.phone, b.email, b.website, b.virtual_available,
        b.cost_low, b.cost_high, b.cost_notes, b.is_active];
      if (isIhsRow && b.ihs_status !== undefined) {
        if (!['L', 'V'].includes(b.ihs_status)) {
          return res.status(400).json({ error: 'ihs_status must be L (Listed) or V (Verified)' });
        }
        statusSql = `, ihs_status = $18::text,
           verified_date = CASE WHEN $18::text = 'V'
             THEN COALESCE(verified_date, date_to_molecule_int(CURRENT_DATE))
             ELSE NULL END`;
        params.push(b.ihs_status);
      }
      const r = await dbClient.query(
        `UPDATE network_entity SET
           entity_code       = COALESCE($2, entity_code),
           entity_name       = COALESCE($3, entity_name),
           entity_type_id    = COALESCE($4, entity_type_id),
           organization      = COALESCE($5, organization),
           description       = COALESCE($6, description),
           services          = COALESCE($7, services),
           city              = COALESCE($8, city),
           state             = COALESCE($9, state),
           phone             = COALESCE($10, phone),
           email             = COALESCE($11, email),
           website           = COALESCE($12, website),
           virtual_available = COALESCE($13, virtual_available),
           cost_low          = COALESCE($14, cost_low),
           cost_high         = COALESCE($15, cost_high),
           cost_notes        = COALESCE($16, cost_notes),
           is_active         = COALESCE($17, is_active)
           ${statusSql}
         WHERE entity_id = $1 RETURNING *`,
        params
      );
      res.json(r.rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: `An entity with code "${b.entity_code}" already exists` });
      if (e.code === '23503') return res.status(400).json({ error: 'Unknown entity type' });
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });

  // ---------- STAFF: delete entity (refuses while referenced) ----------
  app.delete('/v1/network-directory/admin/entities/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const entityId = parseInt(req.params.id);
    if (!entityId) return res.status(400).json({ error: 'entity id required' });
    try {
      const existing = await dbClient.query(
        `SELECT entity_id, tenant_id FROM network_entity WHERE entity_id = $1`,
        [entityId]
      );
      const row = existing.rows[0];
      if (!row || (row.tenant_id !== 0 && row.tenant_id !== tenantId)) {
        return res.status(404).json({ error: 'Not found' });
      }
      if (row.tenant_id === 0 && req.session?.role !== 'superuser') {
        return res.status(403).json({ error: 'Only a platform administrator can delete IHS network entities' });
      }
      const refs = await dbClient.query(
        `SELECT COUNT(*)::int AS n FROM program_network_entry WHERE entity_id = $1`,
        [entityId]
      );
      if (refs.rows[0].n > 0) {
        return res.status(409).json({
          error: `This entity is on ${refs.rows[0].n} program list(s). Remove it from those lists first, or deactivate it instead of deleting.`
        });
      }
      await dbClient.query(`DELETE FROM network_entity WHERE entity_id = $1`, [entityId]);
      res.json({ deleted: true });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // ---------- STAFF: the program's own list ----------
  app.get('/v1/network-directory/program-list', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const r = await dbClient.query(
        `SELECT pe.entry_id, pe.entity_id, pe.added_date,
                e.entity_name, e.organization, e.city, e.state,
                e.virtual_available, e.ihs_status, e.is_active AS entity_active,
                t.type_code, t.type_name
         FROM program_network_entry pe
         JOIN network_entity e ON e.entity_id = pe.entity_id
         JOIN network_entity_type t ON t.entity_type_id = e.entity_type_id
         WHERE pe.tenant_id = $1 AND pe.is_active = true
         ORDER BY e.entity_name`,
        [tenantId]
      );
      res.json(r.rows);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  app.post('/v1/network-directory/program-list', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const entityId = parseInt(req.body?.entity_id);
    if (!entityId) return res.status(400).json({ error: 'entity_id required' });
    try {
      // The entity must be addable by this program: the shared IHS pool or
      // the program's own private shelf. Same 404 either way — no oracle.
      const ent = await dbClient.query(
        `SELECT entity_id FROM network_entity
         WHERE entity_id = $1 AND is_active = true AND (tenant_id = 0 OR tenant_id = $2)`,
        [entityId, tenantId]
      );
      if (!ent.rows.length) return res.status(404).json({ error: 'Not found' });
      // A previously-removed entry reactivates rather than duplicating.
      const revived = await dbClient.query(
        `UPDATE program_network_entry
         SET is_active = true, added_date = date_to_molecule_int(CURRENT_DATE)
         WHERE tenant_id = $1 AND entity_id = $2 AND is_active = false
         RETURNING entry_id`,
        [tenantId, entityId]
      );
      if (revived.rows.length) return res.json({ entry_id: revived.rows[0].entry_id, added: true });
      const r = await dbClient.query(
        `INSERT INTO program_network_entry (tenant_id, entity_id, added_date)
         VALUES ($1, $2, date_to_molecule_int(CURRENT_DATE)) RETURNING entry_id`,
        [tenantId, entityId]
      );
      res.json({ entry_id: r.rows[0].entry_id, added: true });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'That entity is already on your program list' });
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });

  app.delete('/v1/network-directory/program-list/:entryId', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const r = await dbClient.query(
        `DELETE FROM program_network_entry WHERE entry_id = $1 AND tenant_id = $2 RETURNING entry_id`,
        [parseInt(req.params.entryId) || 0, tenantId]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ removed: true });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // ---------- STAFF: the three-way visibility setting ----------
  app.get('/v1/network-directory/settings', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      res.json({ visibility: await readVisibility(dbClient, tenantId) });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  app.put('/v1/network-directory/settings', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const v = req.body?.visibility;
    if (!VISIBILITY_VALUES.includes(v)) {
      return res.status(400).json({ error: 'visibility must be one of: ihs, program, both' });
    }
    try {
      await dbClient.query(
        `INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
         VALUES ($1, 'network_directory', 'text', 'Network Directory: which sections participants see (visibility: ihs / program / both)')
         ON CONFLICT (tenant_id, sysparm_key) DO NOTHING`,
        [tenantId]
      );
      const sp = await dbClient.query(
        `SELECT sysparm_id FROM sysparm WHERE tenant_id = $1 AND sysparm_key = 'network_directory'`,
        [tenantId]
      );
      const sysparmId = sp.rows[0].sysparm_id;
      const upd = await dbClient.query(
        `UPDATE sysparm_detail SET value = $2
         WHERE sysparm_id = $1 AND category = 'config' AND code = 'visibility'
         RETURNING detail_id`,
        [sysparmId, v]
      );
      if (!upd.rows.length) {
        await dbClient.query(
          `INSERT INTO sysparm_detail (sysparm_id, category, code, value)
           VALUES ($1, 'config', 'visibility', $2)`,
          [sysparmId, v]
        );
      }
      res.json({ visibility: v });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });
}

export default { register };
