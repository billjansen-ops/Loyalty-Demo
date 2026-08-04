/**
 * Core Platform Test: Login with no home program (the S167 redirect-loop shape)
 *
 * Session 167: Bill could not log in locally. His account — the original
 * superuser — has NO home program (platform_user.tenant_id NULL). Two
 * separately-correct guards combined into an infinite redirect loop for
 * exactly that shape:
 *   - S164 sweep: every guarded page bounces a tab with no tenant_id in
 *     sessionStorage back to login.html (never guess a tenant).
 *   - S166 fix: login.html auto-forwards a session the server verifies.
 * Valid session + no program bound = login forwards → page bounces →
 * login forwards → … at page-load speed. No test logged in with a
 * no-home-program account, so the gate never saw it.
 *
 * The fix: a logged-in user with no program bound gets the PROGRAM CHOOSER
 * (fed by /v1/auth/my-tenants) instead of being forwarded anywhere guarded.
 *
 * This test puts the account shape in the gate:
 *   1. The fixture user is created through the real /v1/users door
 *      (superuser, NO tenant_id) — proving the door still allows the shape.
 *   2. The server contract: login succeeds carrying NO program keys and NO
 *      chooser list (superusers get none at login); /v1/auth/me confirms the
 *      session; /v1/auth/my-tenants feeds the chooser a non-empty list.
 *   3. The client wiring: login.html must resolve a program via
 *      offerProgramChoice() before forwarding (both the page-load verify
 *      path and the form-submit path), and menu.html must keep its
 *      no-tenant guard (removing it would quietly resurrect tenant
 *      guessing — the loop's other half exists for a reason).
 */
const fs = require('fs');
const path = require('path');

const QA_USER = 'QA_NoHomeProgram';
const QA_PASS = 'qa_nohome_s167';

module.exports = {
  name: 'Core: Login with no home program (S167 loop shape)',

  async run(ctx) {
    // ── Fixture: the no-home-program superuser, through the real door ──
    const superLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(superLogin._ok, 'Claude (superuser) logs in to create the fixture user');

    const create = await ctx.fetch('/v1/users', {
      method: 'POST',
      body: { username: QA_USER, password: QA_PASS, display_name: 'QA No Home Program', role: 'superuser' } // deliberately NO tenant_id
    });
    ctx.assert(create._status === 201 || create._status === 409,
      `/v1/users accepts a superuser with no home program (201 or already exists 409, got ${create._status})`);
    if (create._status === 201) {
      ctx.assertEqual(create.tenant_id, null, 'created fixture user has tenant_id NULL (the shape under test)');
    }

    // ── The server contract for the shape ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: QA_USER, password: QA_PASS } });
    ctx.assert(login._ok, 'no-home-program superuser logs in (200)');
    ctx.assert(!login.tenant_id, 'login response carries NO tenant_id (nothing for the cache to bind)');
    ctx.assert(!login.vertical_key, 'login response carries NO vertical_key (no dashboard to forward to)');
    ctx.assert(!login.authorized_tenants, 'login response carries NO chooser list (superusers get none at login — the page must fetch one)');

    const me = await ctx.fetch('/v1/auth/me');
    ctx.assert(me._ok, '/v1/auth/me confirms the session is valid (the loop needed this half)');

    const myTenants = await ctx.fetch('/v1/auth/my-tenants');
    ctx.assert(myTenants._ok, '/v1/auth/my-tenants answers the no-home-program superuser');
    ctx.assert(Array.isArray(myTenants.tenants) && myTenants.tenants.length >= 1,
      `my-tenants feeds the chooser a non-empty program list (got ${myTenants.tenants ? myTenants.tenants.length : 'none'})`);
    const t0 = myTenants.tenants && myTenants.tenants[0];
    ctx.assert(!!(t0 && t0.tenant_id && t0.name), 'chooser rows carry tenant_id + name (what showProgramChooser renders)');

    // The chooser's pick is a server-side rebind — prove it still works for
    // this shape (the loop fix routes the user here instead of menu.html).
    ctx.assert(!!t0, 'a program row exists to rebind to');
    if (t0) {
      const rebind = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: t0.tenant_id } });
      ctx.assertEqual(rebind._status, 200, `no-home-program superuser rebinds to program ${t0.tenant_id} via /v1/auth/tenant (200)`);
    }

    // ── The client wiring (static tripwires on the two loop halves) ──
    const root = path.join(__dirname, '..', '..');
    const loginHtml = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
    const menuHtml = fs.readFileSync(path.join(root, 'menu.html'), 'utf8');

    const defs = (loginHtml.match(/offerProgramChoice/g) || []).length;
    ctx.assert(defs >= 3,
      `login.html resolves a program via offerProgramChoice — definition + page-load path + submit path (found ${defs} references, need ≥3)`);
    ctx.assert(loginHtml.includes("vk && sessionStorage.getItem('tenant_id')"),
      'login.html auto-forward requires a BOUND PROGRAM, not just a valid session (the S167 guard)');
    ctx.assert(loginHtml.includes('/v1/auth/my-tenants'),
      'login.html feeds the chooser from /v1/auth/my-tenants');
    ctx.assert(menuHtml.includes("sessionStorage.getItem('tenant_id')") && menuHtml.includes('/login.html'),
      "menu.html keeps its no-tenant guard (the S164 rule stands — the fix is on login's side, never by guessing a tenant)");
  }
};
