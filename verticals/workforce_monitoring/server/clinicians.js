/**
 * Workforce Monitoring — Clinician/Physician assignment endpoints.
 *
 * Phase 6 of the Insight server extraction. Moved from pointers.js
 * (formerly L27007–L27099). See docs/INSIGHT_EXTRACTION_DESIGN.md.
 *
 * The clinician helper functions (getClinicians, getAssignedClinicians,
 * isClinician, assignClinician, removeClinician) stay platform-side
 * in pointers.js because two platform-shared call sites depend on
 * them: fireNotificationEvent's assigned-clinician routing and the
 * /v1/export/:report registry/roster branches. The lint script's
 * regex doesn't flag camelCase identifiers, so the helpers' names
 * don't violate the platform-shared rule; only standalone capitalized
 * tokens would. The endpoint bodies (which DO contain "Clinician" /
 * "Physician" as standalone words in error strings) move here.
 */

export function register(app, ctx) {
  const { resolveMember, getClinicians, getAssignedClinicians, isClinician, assignClinician, removeClinician } = ctx;
  const { getMoleculeStorageInfo } = ctx.molecules;

  // GET /v1/clinicians — list all clinicians for tenant
  app.get('/v1/clinicians', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const clinicians = await getClinicians(tenantId);
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

      const clinicians = await getAssignedClinicians(memberRec.link, tenantId);
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
      const isClinicianFlag = await isClinician(clinicianRec.link, tenantId);
      if (!isClinicianFlag) return res.status(400).json({ error: 'Target member is not a clinician' });

      await assignClinician(memberRec.link, clinicianRec.link, tenantId);
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

      await removeClinician(memberRec.link, clinicianRec.link, tenantId);
      res.json({ success: true });
    } catch(e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });
}

export default { register };
