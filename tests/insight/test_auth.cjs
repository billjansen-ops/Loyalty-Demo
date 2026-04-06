/**
 * Test C15: Login + Auth Middleware
 *
 * 1. Valid login succeeds with session
 * 2. Invalid login fails with error
 * 3. Protected endpoints return 401 without session
 * 4. Logout destroys session
 * 5. After logout, protected endpoints return 401
 */
module.exports = {
  name: 'C15: Login + Auth Middleware',

  async run(ctx) {
    // ══════════════════════════════════════════════
    // Test 1: Valid login
    // ══════════════════════════════════════════════
    ctx.log('--- Test 1: Valid login ---');
    // Already logged in via harness, verify session works
    const versionResp = await ctx.fetch('/v1/version');
    ctx.assert(versionResp._ok, 'Authenticated request succeeds');

    // ══════════════════════════════════════════════
    // Test 2: Invalid login
    // ══════════════════════════════════════════════
    ctx.log('--- Test 2: Invalid login ---');
    const badLogin = await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'nonexistent', password: 'wrong' }
    });
    ctx.assert(!badLogin._ok, 'Invalid login returns error');
    ctx.assert(badLogin.error, 'Error message returned');

    // ══════════════════════════════════════════════
    // Test 3: Protected endpoints need auth
    // ══════════════════════════════════════════════
    ctx.log('--- Test 3: Protected endpoints without auth ---');

    // Make unauthenticated requests (no cookie)
    const noAuthResp = await fetch(`${ctx.apiBase}/v1/notifications?tenant_id=5`);
    const noAuthData = await noAuthResp.json().catch(() => ({}));
    ctx.assertEqual(noAuthResp.status, 401, 'Notifications returns 401 without auth');

    const noAuthResp2 = await fetch(`${ctx.apiBase}/v1/wellness/members?tenant_id=5`);
    ctx.assertEqual(noAuthResp2.status, 401, 'Wellness returns 401 without auth');

    // ══════════════════════════════════════════════
    // Test 4: Logout
    // ══════════════════════════════════════════════
    ctx.log('--- Test 4: Logout ---');
    const logoutResp = await ctx.fetch('/v1/auth/logout', { method: 'POST' });
    ctx.assert(logoutResp._ok || logoutResp.success, 'Logout succeeds');

    // ══════════════════════════════════════════════
    // Test 5: After logout, protected endpoints fail
    // ══════════════════════════════════════════════
    ctx.log('--- Test 5: After logout, auth required ---');
    const afterLogout = await ctx.fetch('/v1/notifications?tenant_id=5');
    ctx.assertEqual(afterLogout._status, 401, 'After logout, notifications returns 401');
  }
};
