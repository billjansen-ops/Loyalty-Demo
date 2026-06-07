/**
 * Member Composites (M) — Delta (PASSPORT).
 *
 * The 'M' composite is the AUTHORITY for a tenant's tenant-specific member
 * molecule fields (the member analog of the 'A' activity composite). The member
 * input template is layout-only and may only reference fields the M composite
 * authorizes; member enroll/update may only write authorized fields and must
 * honor each field's is_required flag.
 *
 * Delta (tenant 1) M composite = { PASSPORT } (is_required=false by default).
 *
 * Covers required tests:
 *   1. Required-field validation on member ENROLL.
 *   2. Required-field validation on member UPDATE.
 *   3. Template save rejected when it references a field not in the M composite.
 *   4. Delta PASSPORT path end-to-end.
 * Plus: unauthorized-field reject, and cross-tenant template scoping.
 *
 * Self-contained: creates its own Delta members (no dependency on seeded ids),
 * and restores PASSPORT to optional at the end (the suite also snapshot-restores).
 */
module.exports = {
  name: 'Delta: Member Composite (M) enforcement — PASSPORT',

  async run(ctx) {
    const tenantId = 1;

    // ── Auth: Claude superuser, switched into Delta ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });
    ctx.assert(sw._ok && sw.tenant && sw.tenant.tenant_id === 1, 'Switched session into Delta (tenant 1)');

    // Resolve PASSPORT molecule_id (for composite edits — ids differ per env).
    const molsResp = await ctx.fetch(`/v1/molecules?tenant_id=${tenantId}`);
    const mols = Array.isArray(molsResp) ? molsResp : (molsResp.molecules || []);
    const passport = mols.find(m => m.molecule_key === 'PASSPORT');
    ctx.assert(passport, 'PASSPORT molecule exists for Delta');

    // Helper: create a fresh Delta member, return its membership_number.
    async function newMember(suffix) {
      const num = await ctx.fetch('/v1/member/next-number');
      const mnum = num.membership_number;
      const created = await ctx.fetch('/v1/member', {
        method: 'POST',
        body: { membership_number: mnum, fname: 'Test', lname: `Composite${suffix}` }
      });
      ctx.assert(created._ok, `Created Delta member ${mnum} (${suffix})`);
      return mnum;
    }

    // ── Test 4: PASSPORT path end-to-end (authorized field saves + round-trips) ──
    const m4 = await newMember('T4');
    const save4 = await ctx.fetch(`/v1/member/${m4}/molecules`, { method: 'PUT', body: { molecules: { PASSPORT: 'AB1234567' } } });
    ctx.assert(save4._ok, 'Test 4: PASSPORT (authorized) saves via PUT /molecules');
    const read4 = await ctx.fetch(`/v1/member/${m4}/molecules?tenant_id=${tenantId}`);
    const hasPassport = read4._ok && read4.values && read4.values.PASSPORT != null;
    ctx.assert(hasPassport, 'Test 4: PASSPORT value present after save (round-trip)');

    // ── Unauthorized field rejected (the core contract) ──
    const bogus = await ctx.fetch(`/v1/member/${m4}/molecules`, { method: 'PUT', body: { molecules: { NOT_A_FIELD: 'x' } } });
    ctx.assert(bogus._status === 400, 'Unauthorized member field rejected (400)');

    // Cross-tenant field (Insight's LICENSING_BOARD) rejected for Delta.
    const cross = await ctx.fetch(`/v1/member/${m4}/molecules`, { method: 'PUT', body: { molecules: { LICENSING_BOARD: '1' } } });
    ctx.assert(cross._status === 400, 'Another tenant\'s field (LICENSING_BOARD) rejected for Delta (400)');

    // ── Test 3: template save rejected if it references a field not in M composite ──
    const listResp = await ctx.fetch(`/v1/input-templates?tenant_id=${tenantId}`);
    const list = Array.isArray(listResp) ? listResp : (listResp.templates || []);
    const mTmpl = list.find(t => t.activity_type === 'M');
    ctx.assert(mTmpl, 'Found Delta member (M) input template');
    if (mTmpl) {
      const full = await ctx.fetch(`/v1/input-templates/${mTmpl.template_id}`);
      ctx.assert(full._ok && full.activity_type === 'M', `Loaded Delta M template (id ${mTmpl.template_id})`);
      const goodFields = (full.fields || []).map(f => ({ ...f }));

      // Adding a field not in the M composite must be rejected.
      const badFields = goodFields.concat([{
        row_number: 1, molecule_key: 'TIER', start_position: 1, display_width: 10,
        field_width: 10, enterable: 'Y', is_required: false, display_label: 'Tier', sort_order: 99
      }]);
      const rej = await ctx.fetch(`/v1/input-templates/${mTmpl.template_id}`, {
        method: 'PUT', body: { template_name: full.template_name, activity_type: 'M', fields: badFields }
      });
      ctx.assert(rej._status === 400, 'Test 3: template save with unauthorized field rejected (400)');

      // The valid layout (authorized fields only) still saves.
      const okT = await ctx.fetch(`/v1/input-templates/${mTmpl.template_id}`, {
        method: 'PUT', body: { template_name: full.template_name, activity_type: 'M', fields: goodFields }
      });
      ctx.assert(okT._ok, 'Test 3: valid M template (authorized fields only) saves');
    }

    // ── Tests 1 & 2: required-field validation (mark PASSPORT required via the composites API) ──
    const setReq = await ctx.fetch('/v1/composites', {
      method: 'PUT',
      body: {
        tenant_id: tenantId, composite_type: 'M', description: 'Member Profile Fields',
        details: [{ molecule_id: passport.molecule_id, is_required: true, is_calculated: false, calc_function: null, sort_order: 1 }]
      }
    });
    ctx.assert(setReq._ok, 'Marked PASSPORT required in Delta M composite');

    // Test 2 (update): existing member, PASSPORT empty → 400; with value → ok.
    const updMissing = await ctx.fetch(`/v1/member/${m4}/molecules`, { method: 'PUT', body: { molecules: { PASSPORT: '' } } });
    ctx.assert(updMissing._status === 400, 'Test 2: update missing required PASSPORT rejected (400)');
    const updOk = await ctx.fetch(`/v1/member/${m4}/molecules`, { method: 'PUT', body: { molecules: { PASSPORT: 'CD7654321' } } });
    ctx.assert(updOk._ok, 'Test 2: update with required PASSPORT present succeeds');

    // Test 1 (enroll): new member, molecule step missing PASSPORT → 400; with value → ok.
    const m1 = await newMember('T1');
    const enrollMissing = await ctx.fetch(`/v1/member/${m1}/molecules`, { method: 'PUT', body: { molecules: { PASSPORT: '' } } });
    ctx.assert(enrollMissing._status === 400, 'Test 1: enroll missing required PASSPORT rejected (400)');
    const enrollOk = await ctx.fetch(`/v1/member/${m1}/molecules`, { method: 'PUT', body: { molecules: { PASSPORT: 'EF1112223' } } });
    ctx.assert(enrollOk._ok, 'Test 1: enroll with required PASSPORT present succeeds');

    // ── Cleanup: restore PASSPORT to optional so it doesn't leak to later tests ──
    const restore = await ctx.fetch('/v1/composites', {
      method: 'PUT',
      body: {
        tenant_id: tenantId, composite_type: 'M', description: 'Member Profile Fields',
        details: [{ molecule_id: passport.molecule_id, is_required: false, is_calculated: false, calc_function: null, sort_order: 1 }]
      }
    });
    ctx.assert(restore._ok, 'Cleanup: PASSPORT restored to optional');
  }
};
