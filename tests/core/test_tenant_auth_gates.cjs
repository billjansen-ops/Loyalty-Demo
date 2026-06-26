/**
 * Core Platform Test: Tenant auth gates (privilege escalation)
 *
 * Locks in the Session 121 authorization fixes so they can't silently regress:
 *   - KEYSTONE: POST /v1/auth/tenant is superuser-only. A normal user (csr OR
 *     admin) must NOT be able to rebind their session to another tenant.
 *   - /v1/users* is admin/superuser-only, and a non-superuser is confined to
 *     their OWN tenant and may never grant the superuser role.
 *   - POST /v1/clone is superuser-only.
 *
 * Two-sided by design: as well as proving the gates BLOCK, it proves they
 * still ALLOW the legitimate paths (admin creating a user in its own tenant,
 * superuser switching tenant) — so a future "deny everything" regression that
 * happens to make the block-assertions pass would still fail here.
 *
 * Attackers: DeltaCSR (tenant 1, csr) and DeltaADMIN (tenant 1, admin).
 * Superuser oracle: Claude (the harness system user, superuser).
 */
module.exports = {
  name: 'Core: Tenant auth gates (privilege escalation)',

  async run(ctx) {
    // ── Attacker 1: DeltaCSR (tenant 1, csr) ──
    const csrLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });
    ctx.assert(csrLogin._ok, 'DeltaCSR (tenant 1, csr) logs in');

    ctx.log('A csr must not be able to switch tenant, create users, or clone config');
    const csrSwitch = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 5 } });
    ctx.assertEqual(csrSwitch._status, 403, 'KEYSTONE: csr POST /v1/auth/tenant {5} is blocked (403)');

    const csrCreate = await ctx.fetch('/v1/users', { method: 'POST', body: { username: 'qa_should_not_exist', password: 'pw', display_name: 'QA', role: 'csr', tenant_id: 1 } });
    ctx.assertEqual(csrCreate._status, 403, 'csr POST /v1/users is blocked (403 — admin/superuser only)');

    const csrClone = await ctx.fetch('/v1/clone', { method: 'POST', body: {} });
    ctx.assertEqual(csrClone._status, 403, 'csr POST /v1/clone is blocked (403 — superuser only)');

    // ── Attacker 2: DeltaADMIN (tenant 1, admin) ──
    const admLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' } });
    ctx.assert(admLogin._ok, 'DeltaADMIN (tenant 1, admin) logs in');

    ctx.log('An admin is still not a superuser: no tenant-switch, no clone, no granting superuser');
    const admSwitch = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 5 } });
    ctx.assertEqual(admSwitch._status, 403, 'KEYSTONE: admin POST /v1/auth/tenant {5} is blocked (403 — admin is not superuser)');

    const admClone = await ctx.fetch('/v1/clone', { method: 'POST', body: {} });
    ctx.assertEqual(admClone._status, 403, 'admin POST /v1/clone is blocked (403 — superuser only)');

    const admGrantSuper = await ctx.fetch('/v1/users', { method: 'POST', body: { username: 'qa_grant_super', password: 'pw', display_name: 'QA', role: 'superuser', tenant_id: 1 } });
    ctx.assertEqual(admGrantSuper._status, 403, 'admin cannot grant the superuser role (403)');

    ctx.log('But an admin CAN create a normal user — confined to its OWN tenant, ignoring a forged tenant_id');
    const admCreate = await ctx.fetch('/v1/users', { method: 'POST', body: { username: 'qa_gate_confine', password: 'pw', display_name: 'QA Confine', role: 'csr', tenant_id: 5 } });
    ctx.assertEqual(admCreate._status, 201, 'admin POST /v1/users (own tenant) succeeds (201 — gate is not a blanket deny)');
    // The admin forged tenant_id:5, but the server must pin the new user to the admin's own tenant (1).
    ctx.assertEqual(admCreate.tenant_id, 1, 'forged tenant_id ignored — new user pinned to the admin\'s own tenant (1), not 5');

    // ── Positive control: a real superuser IS allowed past the gate ──
    const superLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(superLogin._ok, 'Claude (superuser) logs in');
    const superSwitch = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 1 } });
    ctx.assertEqual(superSwitch._status, 200, 'superuser POST /v1/auth/tenant {1} is allowed (200 — proves the gate is role-based, not blanket-deny)');
  }
};
