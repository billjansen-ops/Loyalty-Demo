/**
 * Member Composites (M) — Insight / wi_php (LICENSING_BOARD).
 *
 * Insight (tenant 5) M composite = { LICENSING_BOARD } (is_required=false).
 *
 * Covers required test:
 *   5. Insight LICENSING_BOARD path end-to-end.
 * Plus: Delta's PASSPORT field rejected for Insight (the contract is per-tenant),
 * and cross-tenant template scoping (Insight cannot read Delta's template).
 *
 * Self-contained: creates its own Insight member.
 */
module.exports = {
  name: 'Insight: Member Composite (M) enforcement — LICENSING_BOARD',

  async run(ctx) {
    const tenantId = 5;

    // ── Auth: Claude superuser, switched into Insight ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });
    ctx.assert(sw._ok && sw.tenant && sw.tenant.tenant_id === 5, 'Switched session into Insight (tenant 5)');

    // A valid licensing board code (external list value).
    const boardsResp = await ctx.fetch(`/v1/licensing-boards?tenant_id=${tenantId}`);
    const boards = boardsResp.licensing_boards || boardsResp.boards || (Array.isArray(boardsResp) ? boardsResp : []);
    ctx.assert(Array.isArray(boards) && boards.length > 0, 'Insight has at least one licensing board');
    const boardCode = boards[0] && boards[0].board_code;
    ctx.assert(boardCode, `Resolved a licensing board code (${boardCode})`);

    // Create a fresh Insight member.
    const num = await ctx.fetch('/v1/member/next-number');
    const mnum = num.membership_number;
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: mnum, fname: 'Test', lname: 'CompositeIns' }
    });
    ctx.assert(created._ok, `Created Insight member ${mnum}`);

    // ── Test 5: LICENSING_BOARD path end-to-end (authorized field saves + round-trips) ──
    const save = await ctx.fetch(`/v1/member/${mnum}/molecules`, { method: 'PUT', body: { molecules: { LICENSING_BOARD: boardCode } } });
    ctx.assert(save._ok, 'Test 5: LICENSING_BOARD (authorized) saves via PUT /molecules');
    const read = await ctx.fetch(`/v1/member/${mnum}/molecules?tenant_id=${tenantId}`);
    const hasBoard = read._ok && read.values && read.values.LICENSING_BOARD != null;
    ctx.assert(hasBoard, 'Test 5: LICENSING_BOARD value present after save (round-trip)');

    // ── Delta's PASSPORT field is NOT authorized for Insight ──
    const cross = await ctx.fetch(`/v1/member/${mnum}/molecules`, { method: 'PUT', body: { molecules: { PASSPORT: 'AB1234567' } } });
    ctx.assert(cross._status === 400, 'Delta field PASSPORT rejected for Insight (400)');

    // ── Tenant scoping: Insight cannot read Delta's input template ──
    // Resolve a Delta template id by switching to Delta briefly to list it, then test from Insight.
    await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 1 } });
    const deltaList = await ctx.fetch('/v1/input-templates?tenant_id=1');
    const dList = Array.isArray(deltaList) ? deltaList : (deltaList.templates || []);
    const deltaTmpl = dList.find(t => t.activity_type === 'M') || dList[0];
    await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 5 } }); // back to Insight
    if (deltaTmpl) {
      const blocked = await ctx.fetch(`/v1/input-templates/${deltaTmpl.template_id}`);
      ctx.assert(blocked._status === 404, `Insight blocked from reading Delta template id ${deltaTmpl.template_id} (404)`);
    } else {
      ctx.assert(false, 'Could not resolve a Delta template to test scoping');
    }
  }
};
