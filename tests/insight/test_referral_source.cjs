/**
 * REFERRAL_SOURCE member molecule — Insight / wi_php (WisconsinPATH Stage 1).
 *
 * REFERRAL_SOURCE (molecule_def, tenant 5) classifies how a participant entered the
 * program: internal_list { SELF, EMP, BOARD } hung on the MEMBER (attaches_to='M').
 *
 * The load-bearing assertion here is the round-trip (assign → read back). A member
 * molecule that is missing its molecule_value_lookup row stores rows with
 * attaches_to='A' (getMoleculeStorageInfo silently defaults to activity/'A'), so a
 * member read — which filters attaches_to='M' — comes back null with NO error. This
 * test fails loudly if that regression ever returns. See docs/BEFORE_YOU_WRITE.md.
 *
 * Self-contained: creates its own Insight member; harness snapshot/restore means
 * nothing persists to wi_php.
 */
module.exports = {
  name: 'Insight: REFERRAL_SOURCE member molecule (assign + round-trip, attaches_to=M)',

  async run(ctx) {
    const tenantId = 5;

    // ── Auth: Claude superuser, switched into Insight ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });
    ctx.assert(sw._ok && sw.tenant && sw.tenant.tenant_id === 5, 'Switched session into Insight (tenant 5)');

    // ── Selection list: internal_list values come from /v1/molecules/values/:key
    //    (NOT /v1/lookup-values, which is external_list only). Returns [{value,label}].
    const listResp = await ctx.fetch(`/v1/molecules/values/REFERRAL_SOURCE`);
    const list = Array.isArray(listResp) ? listResp : (listResp.rows || listResp.values || []);
    const codes = list.map(v => v.value || v.text_value || v.code).filter(Boolean);
    ctx.assert(codes.includes('SELF') && codes.includes('EMP') && codes.includes('BOARD'),
      `REFERRAL_SOURCE selection list returns SELF/EMP/BOARD (got: ${codes.join(',')})`);

    // ── Create a fresh Insight member ──
    const num = await ctx.fetch('/v1/member/next-number');
    const mnum = num.membership_number;
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: mnum, fname: 'Test', lname: 'ReferralSrc' }
    });
    ctx.assert(created._ok, `Created Insight member ${mnum}`);

    // ── Assign REFERRAL_SOURCE = Board-mandated (BOARD) ──
    const save = await ctx.fetch(`/v1/member/${mnum}/molecules`, { method: 'PUT', body: { molecules: { REFERRAL_SOURCE: 'BOARD' } } });
    ctx.assert(save._ok, 'REFERRAL_SOURCE (BOARD) saves via PUT /molecules');

    // ── Round-trip: the falsifier for the attaches_to='M' routing trap ──
    const read = await ctx.fetch(`/v1/member/${mnum}/molecules?tenant_id=${tenantId}`);
    const val = read._ok && read.values ? read.values.REFERRAL_SOURCE : null;
    ctx.assert(val != null, 'REFERRAL_SOURCE present after save (round-trip — proves member/M routing, not activity/A)');
    ctx.assert(val === 'BOARD' || val === 'Board-mandated', `REFERRAL_SOURCE round-trips to the assigned value (got: ${val})`);

    // ── Re-assign to a different value — internal_list value can change ──
    const save2 = await ctx.fetch(`/v1/member/${mnum}/molecules`, { method: 'PUT', body: { molecules: { REFERRAL_SOURCE: 'SELF' } } });
    ctx.assert(save2._ok, 'REFERRAL_SOURCE re-assigns to SELF');
    const read2 = await ctx.fetch(`/v1/member/${mnum}/molecules?tenant_id=${tenantId}`);
    const val2 = read2._ok && read2.values ? read2.values.REFERRAL_SOURCE : null;
    ctx.assert(val2 === 'SELF' || val2 === 'Self-referral', `REFERRAL_SOURCE reflects the new value (got: ${val2})`);
  }
};
