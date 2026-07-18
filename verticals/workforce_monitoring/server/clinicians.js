/**
 * Workforce Monitoring — Clinician/Physician assignment endpoints
 * and helpers.
 *
 * Phase 6 moved the endpoint bodies here from pointers.js (formerly
 * L27007–L27099). Session 130 follow-up moves the FIVE helper
 * functions (getClinicians, getAssignedClinicians, isClinician,
 * assignClinician, removeClinician) here too — they were previously
 * stuck in pointers.js because the platform's fireNotificationEvent,
 * /v1/export/:report (registry+roster branches), and scoreMemberML
 * all called them directly. The camelCase identifiers slip the
 * lint's `\b(Clinician|...)\b` regex so the platform-shared rule
 * didn't flag them, but they were structurally in the wrong layer.
 *
 * Fix uses the same callback-bridge pattern as Phase 5's calcPPII:
 * the vertical registers the helpers via ctx.registerCallback at
 * boot, and the platform-side call sites read from
 * `verticalCallbacks.getAssignedClinicians?.(...)` / `.isClinician?.(...)`
 * with safe fallbacks ([] and false respectively) so the platform
 * still works correctly when the vertical isn't loaded.
 */

// Helper implementations — module-private, take `ctx` at the front
// of the signature so they can reach getDbClient + molecule helpers
// without closing over a binding from register(). registerCallbacks()
// hands these to the platform with ctx pre-bound.

export async function getAssignedClinicians(ctx, memberLink, tenantId) {
  const dbClient = ctx.getDbClient();
  // Get clinician links via molecule helper
  const rows = await ctx.molecules.getMoleculeRows(memberLink, 'ASSIGNED_CLINICIAN', tenantId);
  if (!rows.length) return [];

  // Hydrate with member info
  const links = rows.map(r => r.C1);
  const placeholders = links.map((_, i) => `$${i + 1}`).join(', ');
  const result = await dbClient.query(
    `SELECT link as clinician_link, fname, lname, title, email, membership_number
     FROM member WHERE link IN (${placeholders})`,
    links
  );
  return result.rows;
}

async function assignClinician(ctx, physicianLink, clinicianLink, tenantId) {
  // Check-then-insert rides one transaction serialized on the physician's
  // row lock: two staff assigning at the same moment used to both pass the
  // check and both insert (the clinician then listed twice on the chart).
  const dbClient = ctx.getDbClient();
  const client = await dbClient.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT link FROM member WHERE link = $1 FOR UPDATE', [physicianLink]);
    const existing = await ctx.molecules.findMoleculeRow(
      physicianLink, 'ASSIGNED_CLINICIAN', { c1: clinicianLink }, tenantId, null, client);
    if (existing) {
      await client.query('ROLLBACK');
      return { alreadyAssigned: true };
    }
    await ctx.molecules.insertMoleculeRow(
      physicianLink, 'ASSIGNED_CLINICIAN', [clinicianLink], tenantId, null, client);
    await client.query('COMMIT');
    return { alreadyAssigned: false };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function removeClinician(ctx, physicianLink, clinicianLink, tenantId) {
  await ctx.molecules.deleteMoleculeRow(physicianLink, 'ASSIGNED_CLINICIAN', { c1: clinicianLink }, tenantId);
}

async function getClinicians(ctx, tenantId) {
  // IS_CLINICIAN is a flag molecule — the platform flag helper builds the
  // presence condition (the one door to flag storage).
  const dbClient = ctx.getDbClient();
  const isClinicianCond = ctx.molecules.flagCondSQL(tenantId, 'IS_CLINICIAN', 'm.link');
  const result = await dbClient.query(`
    SELECT m.link, m.fname, m.lname, m.title, m.email, m.membership_number
    FROM member m
    WHERE m.tenant_id = $1
    AND ${isClinicianCond}
    ORDER BY m.lname, m.fname
  `, [tenantId]);

  return result.rows;
}

async function isClinician(ctx, memberLink, tenantId) {
  return ctx.molecules.isFlagSet(memberLink, 'IS_CLINICIAN', tenantId);
}

export function register(app, ctx) {
  const { resolveMember } = ctx;
  const { getMoleculeStorageInfo } = ctx.molecules;

  // GET /v1/clinicians — list all clinicians for tenant
  app.get('/v1/clinicians', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const clinicians = await getClinicians(ctx, tenantId);
      res.json({ clinicians });
    } catch(e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // GET /v1/clinicians/:memberNumber/physicians — get physicians assigned to a clinician
  app.get('/v1/clinicians/:memberNumber/physicians', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const clinicianRec = await resolveMember(req.params.memberNumber, tenantId);
      if (!clinicianRec) return res.status(404).json({ error: 'Clinician not found' });

      const info = await getMoleculeStorageInfo(tenantId, 'ASSIGNED_CLINICIAN');
      if (!info) return res.json({ physicians: [] });

      // Find all physicians that have this clinician assigned (reverse lookup)
      const result = await dbClient.query(`
        SELECT m.link, m.fname, m.lname, m.title, m.email, m.membership_number
        FROM ${info.tableName} d5
        JOIN member m ON m.link = d5.p_link
        WHERE d5.molecule_id = $1 AND d5.c1 = $2 AND d5.attaches_to = 'M'
        ORDER BY m.lname, m.fname
      `, [info.moleculeId, clinicianRec.link]);

      res.json({ physicians: result.rows });
    } catch(e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // GET /v1/members/:memberNumber/clinicians — get clinicians assigned to a physician
  app.get('/v1/members/:memberNumber/clinicians', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const memberRec = await resolveMember(req.params.memberNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });

      const clinicians = await getAssignedClinicians(ctx, memberRec.link, tenantId);
      res.json({ clinicians });
    } catch(e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/members/:memberNumber/clinicians — assign a clinician to a physician
  app.post('/v1/members/:memberNumber/clinicians', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { clinician_membership_number } = req.body;
    if (!clinician_membership_number) return res.status(400).json({ error: 'clinician_membership_number required' });

    try {
      const memberRec = await resolveMember(req.params.memberNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Physician not found' });

      const clinicianRec = await resolveMember(clinician_membership_number, tenantId);
      if (!clinicianRec) return res.status(404).json({ error: 'Clinician not found' });

      // Verify the target is actually a clinician
      const isClinicianFlag = await isClinician(ctx, clinicianRec.link, tenantId);
      if (!isClinicianFlag) return res.status(400).json({ error: 'Target member is not a clinician' });

      const outcome = await assignClinician(ctx, memberRec.link, clinicianRec.link, tenantId);
      if (outcome.alreadyAssigned) {
        return res.status(409).json({
          error: 'This clinician is already assigned to this participant — possibly added by someone else just now. The chart is current.'
        });
      }
      res.json({ success: true });
    } catch(e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // DELETE /v1/members/:memberNumber/clinicians/:clinicianNumber — remove a clinician assignment
  app.delete('/v1/members/:memberNumber/clinicians/:clinicianNumber', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const memberRec = await resolveMember(req.params.memberNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Physician not found' });

      const clinicianRec = await resolveMember(req.params.clinicianNumber, tenantId);
      if (!clinicianRec) return res.status(404).json({ error: 'Clinician not found' });

      await removeClinician(ctx, memberRec.link, clinicianRec.link, tenantId);
      res.json({ success: true });
    } catch(e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });
}

/**
 * Register vertical→platform callbacks. Called from index.js → boot(ctx).
 *
 * Two helpers are registered: getAssignedClinicians and isClinician.
 * These are the ones with platform-side callers:
 *   - fireNotificationEvent (recipient routing for 'assigned_clinician' rules)
 *   - /v1/export/:report (registry + roster CSV branches add an
 *     'Assigned Clinician' column)
 *   - scoreMemberML (skips scoring for members flagged IS_CLINICIAN)
 *
 * The other three (getClinicians, assignClinician, removeClinician) have
 * no platform-side callers — they're only used by the vertical's own
 * endpoint bodies in this file — so they don't need to be exposed via
 * the callback registry.
 *
 * Fallback behaviors when the vertical isn't loaded:
 *   - getAssignedClinicians → [] (no clinicians assigned)
 *   - isClinician → false (treat as non-clinician)
 * Both are semantically correct for platform-only tenants who don't
 * have IS_CLINICIAN / ASSIGNED_CLINICIAN molecules at all.
 */
export function registerCallbacks(ctx) {
  ctx.registerCallback('getAssignedClinicians',
    (memberLink, tenantId) => getAssignedClinicians(ctx, memberLink, tenantId));
  ctx.registerCallback('isClinician',
    (memberLink, tenantId) => isClinician(ctx, memberLink, tenantId));
}

export default { register, registerCallbacks };
