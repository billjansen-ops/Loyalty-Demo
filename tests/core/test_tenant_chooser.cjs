/**
 * Core: the tenant chooser (v117) — multi-program logins, and the wall.
 *
 * A login authorized for MORE than one program (platform_user_tenant grants)
 * chooses at sign-in and switches from the header. Built REAL: the
 * authorization list lives in the database, every switch re-checks it
 * server-side, and the future real login process stands on the same table.
 *
 * The S121 isolation wall must NOT soften. This test attacks it:
 *   - a granted login enters ONLY its granted programs; a third → 403
 *   - a single-program login gets no chooser and still cannot switch
 *   - grant management is superuser-only (a tenant ADMIN is refused —
 *     cross-program granting would be privilege escalation)
 *   - revoking a grant closes the door on the next switch attempt
 *
 * Browser walk (the chooser is a new screen — walked before Bill sees it):
 * real login form → "Choose a program" panel → click Washington PHP →
 * land on the workforce dashboard → header program switcher present.
 *
 * Self-contained: throwaway logins; harness snapshot/restore wipes all.
 */
const { execSync } = require('child_process');

module.exports = {
  name: 'Core: tenant chooser (v117 grants, the switch wall, login chooser walk)',

  async run(ctx) {
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    const sql = (q) => execSync(
      `${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -t -A -c "${q.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }).toString().trim();

    // Tenants resolved by KEY — never hand-entered ids
    const WI = Number(sql(`SELECT tenant_id FROM tenant WHERE tenant_key = 'wi_php'`));
    const WA = Number(sql(`SELECT tenant_id FROM tenant WHERE tenant_key = 'wa_php'`));
    const DELTA = Number(sql(`SELECT tenant_id FROM tenant WHERE tenant_key = 'delta'`));
    ctx.assert(WI && WA && DELTA, 'wi_php, wa_php, delta all resolved by key');

    // ── Setup (superuser): two throwaway wi_php logins ──
    const su = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(su._ok, 'Claude superuser login (setup)');
    const stamp = Math.floor(Date.now() / 1000);
    const multi = await ctx.fetch('/v1/users', {
      method: 'POST',
      body: { username: `test_multi_${stamp}`, password: 'chooserpass1', display_name: 'Multi Program', tenant_id: WI, role: 'admin' }
    });
    ctx.assert(multi._ok && multi.user_id, 'Throwaway multi-program login created (wi_php admin)');
    const single = await ctx.fetch('/v1/users', {
      method: 'POST',
      body: { username: `test_single_${stamp}`, password: 'chooserpass1', display_name: 'Single Program', tenant_id: WI, role: 'admin' }
    });
    ctx.assert(single._ok && single.user_id, 'Throwaway single-program login created (wi_php admin)');

    // ── Grant management (superuser) ──
    const grant = await ctx.fetch(`/v1/users/${multi.user_id}/tenants`, { method: 'POST', body: { tenant_id: WA } });
    ctx.assert(grant._ok, 'Superuser grants wa_php to the multi login');
    const dup = await ctx.fetch(`/v1/users/${multi.user_id}/tenants`, { method: 'POST', body: { tenant_id: WA } });
    ctx.assert(dup._status === 409, `Duplicate grant refused with 409 (got ${dup._status})`);
    const home = await ctx.fetch(`/v1/users/${multi.user_id}/tenants`, { method: 'POST', body: { tenant_id: WI } });
    ctx.assert(home._status === 400, `Granting the home program refused with 400 (got ${home._status})`);
    const ghost = await ctx.fetch(`/v1/users/${multi.user_id}/tenants`, { method: 'POST', body: { tenant_id: 9999 } });
    ctx.assert(ghost._status === 404, `Unknown program refused with 404 (got ${ghost._status})`);
    const list = await ctx.fetch(`/v1/users/${multi.user_id}/tenants`);
    ctx.assert(list._ok && list.grants.length === 1 && list.grants[0].tenant_id === WA,
      'Grant list shows exactly the wa_php grant');

    // ── The multi login: chooser offered, switches work, the wall holds ──
    const mLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `test_multi_${stamp}`, password: 'chooserpass1' } });
    ctx.assert(mLogin._ok && Array.isArray(mLogin.authorized_tenants) && mLogin.authorized_tenants.length === 2,
      'Multi-program login receives the two-program chooser list');
    ctx.assert(mLogin.tenant_id === WI, 'Session starts safely bound to the HOME program');
    const toWA = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WA } });
    ctx.assert(toWA._ok, 'Granted login switches to wa_php');
    const meWA = await ctx.fetch('/v1/auth/me');
    ctx.assert(meWA.session_vertical_key === 'workforce_monitoring', 'Session vertical follows the switch');
    const toDelta = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: DELTA } });
    ctx.assert(toDelta._status === 403, `A program OFF the list is refused with 403 (got ${toDelta._status})`);
    ctx.assert(/not authorized/i.test(toDelta.error || ''), 'Refusal is plain English');
    const backHome = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WI } });
    ctx.assert(backHome._ok, 'Switching back to the home program always allowed');

    // ── Grant management is SUPERUSER-only — a tenant ADMIN is refused ──
    const escal = await ctx.fetch(`/v1/users/${multi.user_id}/tenants`, { method: 'POST', body: { tenant_id: DELTA } });
    ctx.assert(escal._status === 403, `Tenant admin cannot grant program access (got ${escal._status})`);
    const peek = await ctx.fetch(`/v1/users/${multi.user_id}/tenants`);
    ctx.assert(peek._status === 403, `Tenant admin cannot read the grant list (got ${peek._status})`);

    // ── The single login: no chooser, no switching — S121 unchanged ──
    const sLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `test_single_${stamp}`, password: 'chooserpass1' } });
    ctx.assert(sLogin._ok && !sLogin.authorized_tenants, 'Single-program login gets NO chooser list');
    const sSwitch = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WA } });
    ctx.assert(sSwitch._status === 403, `Single-program login cannot switch anywhere (got ${sSwitch._status})`);

    // ── Revocation closes the door ──
    const su2 = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(su2._ok, 'Claude re-login (revocation)');
    const revoke = await ctx.fetch(`/v1/users/${multi.user_id}/tenants/${WA}`, { method: 'DELETE' });
    ctx.assert(revoke._ok, 'Superuser revokes the wa_php grant');
    const mLogin2 = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `test_multi_${stamp}`, password: 'chooserpass1' } });
    ctx.assert(mLogin2._ok && !mLogin2.authorized_tenants, 'After revocation: no chooser list at login');
    const toWA2 = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WA } });
    ctx.assert(toWA2._status === 403, `After revocation: the switch is refused (got ${toWA2._status})`);

    // ── Re-grant for the browser walk ──
    const su3 = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(su3._ok, 'Claude re-login (walk setup)');
    const regrant = await ctx.fetch(`/v1/users/${multi.user_id}/tenants`, { method: 'POST', body: { tenant_id: WA } });
    ctx.assert(regrant._ok, 'wa_php re-granted for the browser walk');

    // ── Browser walk: the chooser screen + the header switcher ──
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser walk — Playwright not available');
      return;
    }
    // openPage auto-logs-in as the harness user — log that session out (in
    // the page, so cookies + display cache both clear) and return to the
    // real login form.
    const page = await ctx.openPage('/login.html');
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
    await page.evaluate(async () => {
      sessionStorage.clear();
      await fetch('/v1/auth/logout', { method: 'POST', credentials: 'include' });
    });
    await page.goto(new URL('/login.html', page.url()).href, { waitUntil: 'networkidle' });
    await page.waitForSelector('#username', { timeout: 10000 });

    await page.fill('#username', `test_multi_${stamp}`);
    await page.fill('#password', 'chooserpass1');
    await page.click('#submitBtn');
    await page.waitForSelector('#programChooser button', { timeout: 10000 });
    const choices = await page.$$eval('#programChooser button', els => els.map(e => e.textContent));
    ctx.assert(choices.length === 2, `Chooser offers two programs (got: ${choices.join(', ')})`);
    ctx.assert(choices.includes('Washington PHP') && choices.includes('Wisconsin PHP'),
      'Chooser names both programs');

    // Pick Washington → workforce dashboard
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }),
      page.click(`#programChooser button:has-text("Washington PHP")`)
    ]);
    ctx.assert(page.url().includes('/verticals/workforce_monitoring/dashboard.html'),
      `Washington choice lands on the workforce dashboard (at: ${page.url()})`);
    const storedTenant = await page.evaluate(() => sessionStorage.getItem('tenant_id'));
    ctx.assert(Number(storedTenant) === WA, 'Display cache carries the chosen program');

    // Header switcher: a button naming the current program; clicking opens
    // the panel listing both programs with the active one checked
    await page.waitForSelector('#lpProgramBtn', { timeout: 10000 });
    const btnLabel = await page.$eval('#lpProgramBtn', el => el.textContent);
    ctx.assert(btnLabel.includes('Washington PHP'), `Switcher button names the active program (got: ${btnLabel.trim()})`);
    await page.click('#lpProgramBtn');
    await page.waitForSelector('#lpProgramList', { timeout: 5000 });
    const rows = await page.$$eval('#lpProgramList > div', els => els.map(e => e.textContent.trim()));
    ctx.assert(rows.length === 2, `Switcher panel lists two programs (got: ${rows.join(' | ')})`);
    ctx.assert(rows.some(r => r.includes('✓') && r.includes('Washington PHP')), 'Active program is checked in the panel');
    ctx.assert(rows.some(r => r.includes('Wisconsin PHP')), 'The other program is offered');

    ctx.assert(pageErrors.length === 0, `No page errors across the walk (got: ${pageErrors.join(' | ')})`);
  }
};
