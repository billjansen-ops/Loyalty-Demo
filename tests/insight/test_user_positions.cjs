/**
 * POSITIONCLINIC user molecule — Insight / wi_php (WisconsinPATH Stage 1 foundation).
 *
 * POSITIONCLINIC (tenant 5, parent_bytes=4) hangs "position @ clinic" rows on a STAFF
 * LOGIN (platform_user, 4-byte integer link → storage table 4_data_12). Column 1 is a
 * position code that BORROWS the POSITION molecule's value list
 * (molecule_value_lookup.list_source_molecule_id); column 2 is a partner_program id
 * (numeric pass-through). Managed via the generic user molecule-rows endpoints:
 *
 *   GET/POST/DELETE /v1/users/:id/molecule-rows/:key   (admin-gated, own-tenant only)
 *
 * Load-bearing assertions: the 4-byte-parent round-trip (write → read with labels),
 * multi-row support (one login, many assignments), exact-duplicate rejection, removal
 * by value tuple, the non-user-molecule guard, and cross-tenant confinement.
 *
 * Self-contained: creates its own throwaway staff login; harness snapshot/restore
 * wipes everything.
 */
module.exports = {
  name: 'Insight: POSITIONCLINIC on a staff login (user-parent round-trip + guards)',

  async run(ctx) {
    const tenantId = 5;

    // ── Auth: Claude superuser, switched into Insight ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });
    ctx.assert(sw._ok, 'Switched session into Insight (tenant 5)');

    // ── A throwaway staff login to hang assignments on ──
    const uname = `test_pos_${Math.floor(Date.now() / 1000)}`;
    const created = await ctx.fetch('/v1/users', {
      method: 'POST',
      body: { username: uname, password: 'testpass1', display_name: 'Test Positions', tenant_id: tenantId, role: 'csr' }
    });
    ctx.assert(created._ok && created.user_id, 'Created throwaway Insight staff login');
    const uid = created.user_id;

    // ── A real clinic id to assign (partner_program, tenant 5) ──
    const partners = await ctx.fetch(`/v1/partners?tenant_id=${tenantId}`);
    ctx.assert(Array.isArray(partners) && partners.length > 0, 'Insight has partners (health systems)');
    const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${tenantId}`);
    ctx.assert(Array.isArray(programs) && programs.length > 0, 'First partner has programs (clinics)');
    const clinicA = programs[0].program_id;

    // ── Write two assignments (multi-row: one login, many positions) ──
    const add1 = await ctx.fetch(`/v1/users/${uid}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['CASEMAN', clinicA] }
    });
    ctx.assert(add1._ok, 'Assignment 1 (CASEMAN) writes into 4_data_12');
    const add2 = await ctx.fetch(`/v1/users/${uid}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['MEDDIR', clinicA] }
    });
    ctx.assert(add2._ok, 'Assignment 2 (MEDDIR) — multiple rows per login supported');

    // ── Round-trip: read back decoded, with display labels via the BORROWED list ──
    const rows = await ctx.fetch(`/v1/users/${uid}/molecule-rows/POSITIONCLINIC`);
    ctx.assert(Array.isArray(rows) && rows.length === 2, `Both assignments read back (got ${Array.isArray(rows) ? rows.length : 'non-array'})`);
    const caseman = rows.find(r => r.values[0] === 'CASEMAN');
    ctx.assert(!!caseman, 'CASEMAN row round-trips (stored byte decodes through the borrowed POSITION list)');
    ctx.assert(caseman && caseman.display[0] === 'Case Manager', `Position label resolves via list source (got: ${caseman && caseman.display[0]})`);
    ctx.assert(caseman && Number(caseman.values[1]) === Number(clinicA), 'Clinic id round-trips raw (numeric pass-through)');
    ctx.assert(caseman && typeof caseman.display[1] === 'string' && caseman.display[1].length > 1, 'Clinic label resolves from partner_program');

    // ── Exact duplicate rejected ──
    const dupe = await ctx.fetch(`/v1/users/${uid}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['CASEMAN', clinicA] }
    });
    ctx.assert(!dupe._ok && dupe._status === 409, `Duplicate assignment rejected with 409 (got ${dupe._status})`);

    // ── Unknown position code rejected ──
    const badCode = await ctx.fetch(`/v1/users/${uid}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['NOTAPOS', clinicA] }
    });
    ctx.assert(!badCode._ok && badCode._status === 400, 'Unknown position code rejected with 400');

    // ── Guard: a member molecule cannot be written onto a user ──
    const wrongParent = await ctx.fetch(`/v1/users/${uid}/molecule-rows/REFERRAL_SOURCE`, {
      method: 'POST', body: { values: ['SELF'] }
    });
    ctx.assert(!wrongParent._ok && wrongParent._status === 400, 'Member molecule rejected on a user (parent_bytes guard)');

    // ── Remove one row by its value tuple; the other survives ──
    const rm = await ctx.fetch(`/v1/users/${uid}/molecule-rows/POSITIONCLINIC`, {
      method: 'DELETE', body: { values: ['CASEMAN', clinicA] }
    });
    ctx.assert(rm._ok, 'Assignment removed by exact value tuple');
    const rmAgain = await ctx.fetch(`/v1/users/${uid}/molecule-rows/POSITIONCLINIC`, {
      method: 'DELETE', body: { values: ['CASEMAN', clinicA] }
    });
    ctx.assert(!rmAgain._ok && rmAgain._status === 404, 'Removing the same row again 404s');
    const after = await ctx.fetch(`/v1/users/${uid}/molecule-rows/POSITIONCLINIC`);
    ctx.assert(Array.isArray(after) && after.length === 1 && after[0].values[0] === 'MEDDIR',
      'The other assignment survives the removal');

    // ── Cross-tenant confinement: a Delta-bound session cannot see the Insight login ──
    const swDelta = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 1 } });
    ctx.assert(swDelta._ok, 'Switched session to Delta (tenant 1)');
    const cross = await ctx.fetch(`/v1/users/${uid}/molecule-rows/POSITIONCLINIC`);
    ctx.assert(!cross._ok && cross._status === 404, `Cross-tenant read blocked with 404 (got ${cross._status})`);
    await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });
  }
};
