/**
 * Test: Login and Member Search
 *
 * Verifies core platform plumbing:
 * 1. Login as Claude test user
 * 2. Server version endpoint responds
 * 3. Member search finds a known physician
 * 4. Member activities endpoint returns data
 * 5. Logout
 *
 * No data modifications — read-only test.
 */
module.exports = {
  name: 'Login and Member Search',

  async run(ctx) {
    // 1. Version endpoint
    const version = await ctx.fetch('/v1/version');
    ctx.assert(version._ok, 'GET /v1/version responds OK');
    ctx.assert(version.version, 'Version string returned');

    // 2. Login (already logged in via harness, but verify session works)
    const tenantId = 5; // Wisconsin PHP

    // 3. Search for a known member — James Okafor #34
    const searchResp = await ctx.fetch(`/v1/member/search?q=Okafor&tenant_id=${tenantId}`);
    ctx.assert(searchResp._ok, 'GET /v1/member/search responds OK');
    const members = searchResp.members || searchResp;
    ctx.assert(Array.isArray(members), 'Search returns array');
    const okafor = Array.isArray(members) ? members.find(m => m.membership_number === '34') : null;
    ctx.assert(okafor, 'James Okafor (#34) found in search results');

    if (okafor) {
      ctx.assert(okafor.fname === 'James', 'First name is James');
      ctx.assert(okafor.lname === 'Okafor', 'Last name is Okafor');
    }

    // 4. Load member activities
    const activitiesResp = await ctx.fetch(`/v1/member/34/activities?limit=10&tenant_id=${tenantId}`);
    ctx.assert(activitiesResp._ok, 'GET /v1/member/34/activities responds OK');
    const activities = activitiesResp.activities || activitiesResp;
    ctx.assert(Array.isArray(activities), 'Activities returns array');
    ctx.assert(activities.length > 0, 'Okafor has at least one activity');

    // 5. Load wellness/members (dashboard data)
    const wellnessResp = await ctx.fetch(`/v1/wellness/members?tenant_id=${tenantId}`);
    ctx.assert(wellnessResp._ok, 'GET /v1/wellness/members responds OK');
    const wellnessMembers = wellnessResp.members || wellnessResp;
    ctx.assert(Array.isArray(wellnessMembers), 'Wellness returns members array');
    ctx.assert(wellnessMembers.length > 0, 'Wellness has members');

    // 6. Check notification deliveries endpoint (new feature)
    const deliveriesResp = await ctx.fetch(`/v1/notification-deliveries?tenant_id=${tenantId}&limit=5`);
    ctx.assert(deliveriesResp._ok, 'GET /v1/notification-deliveries responds OK');
    ctx.assert(deliveriesResp.counts !== undefined, 'Delivery counts returned');

    // 7. Check delivery config endpoint
    const configResp = await ctx.fetch(`/v1/notification-delivery-config?tenant_id=${tenantId}`);
    ctx.assert(configResp._ok, 'GET /v1/notification-delivery-config responds OK');
    ctx.assert(configResp.timezone, 'Delivery config has timezone');

    // 8. Logout
    const logoutResp = await ctx.fetch('/v1/auth/logout', { method: 'POST' });
    ctx.assert(logoutResp._ok || logoutResp.success, 'Logout succeeds');
  }
};
