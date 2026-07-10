/**
 * Insight: Erica's day-in-the-life browser walk (Session 138).
 *
 * The suite covers her features as separate pieces; this walk covers her
 * MORNING — the real pages in the real order, as her real role (a tenant-5
 * admin login, not the superuser harness user):
 *
 *   login page → program dashboard (stat strip + program view render) →
 *   participant chart (registry, instruments, MEDS card — and the page-load
 *   MEDS check must NOT fail, guarding the Session-138 fix in the real
 *   page) → action queue (worklist + filter chips) → notifications.
 *
 * Zero console errors and zero page errors across the whole walk.
 * Read-only apart from the throwaway login — harness restore wipes that.
 */
module.exports = {
  name: "Insight: Erica's day-in-the-life walk (dashboard → chart → queue → notifications)",

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser test — Playwright not available');
      return;
    }

    const TENANT = 5;
    const STEADMAN_ID = '53';   // Grant Steadman — seeded demo participant
    const PROGRAM_ID = 30;      // Insight Recovery & Wellness Center

    // ── Throwaway admin login (Erica's real role: tenant-5 admin) ──
    const claude = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'Claude', password: 'claude123' }
    });
    ctx.assert(claude._ok, 'Claude API login (setup)');
    const uname = `test_erica_${Math.floor(Math.random() * 1e9)}`;
    const staff = await ctx.fetch('/v1/users', {
      method: 'POST',
      body: { username: uname, password: 'walkpass1', display_name: 'Erica Walk Test', tenant_id: TENANT, role: 'admin' }
    });
    ctx.assert(staff._ok && staff.user_id, 'Created throwaway tenant-5 admin login');

    // ── Browser: log in as HER, through the real login page ──
    const page = await ctx.openPage('/login.html');
    page.on('dialog', async (d) => { try { await d.accept(); } catch (_) {} });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    const origin = new URL(page.url()).origin;
    await page.evaluate(async (u) => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: u, password: 'walkpass1' })
      });
    }, uname);
    await page.evaluate(() => {
      sessionStorage.setItem('tenant_id', '5');
      sessionStorage.setItem('tenant_name', 'Insight Health Solutions');
    });

    try {
      // ═══ 1. The program dashboard — her landing page ═══
      ctx.log("1: dashboard — stat strip + program view render with real data");
      await page.goto(`${origin}/verticals/workforce_monitoring/dashboard.html`);
      await new Promise(r => setTimeout(r, 3500));

      const stats = await page.evaluate(() => ({
        total: document.getElementById('statTotal')?.textContent.trim(),
        green: document.getElementById('statGreen')?.textContent.trim(),
        tabs: !!document.getElementById('programViewTabs'),
        pvContent: (document.getElementById('pvContent')?.innerText || '').length
      }));
      ctx.assert(Number(stats.total) > 0, `stat strip shows participants (total=${stats.total})`);
      ctx.assert(stats.green !== undefined && stats.green !== '', 'stability tiers populated');
      ctx.assert(stats.tabs, 'program view tabs present');
      ctx.assert(stats.pvContent > 50, `program view rendered content (${stats.pvContent} chars)`);

      // ═══ 2. A participant chart — where she spends her day ═══
      ctx.log('2: participant chart — registry, instruments, and the MEDS check must not fail');
      await page.evaluate((c) => sessionStorage.setItem('lp_page_context', JSON.stringify(c)),
        { memberId: STEADMAN_ID, programId: PROGRAM_ID });
      await page.goto(`${origin}/verticals/workforce_monitoring/physician_detail.html`);
      await new Promise(r => setTimeout(r, 4000));

      const chart = await page.evaluate(() => ({
        name: document.body.innerText.includes('Steadman'),
        registryItems: document.querySelectorAll('#registryItems > div').length
      }));
      ctx.assert(chart.name, 'chart shows the participant by name');
      ctx.assert(chart.registryItems > 0, `registry items visible (${chart.registryItems})`);

      // The instruments card starts display:none and reveals when its data
      // loads — wait for the reveal itself, not for text (innerText excludes
      // hidden elements).
      let instrumentsVisible = false;
      for (let i = 0; i < 16 && !instrumentsVisible; i++) {
        instrumentsVisible = await page.evaluate(() =>
          document.getElementById('instrumentCard')?.style.display === 'block');
        if (!instrumentsVisible) await new Promise(r => setTimeout(r, 500));
      }
      ctx.assert(instrumentsVisible, 'Instruments card revealed after its data loaded');
      const medsCheckFailures = consoleErrors.filter(t => t.includes('MEDS check failed'));
      ctx.assert(medsCheckFailures.length === 0,
        `page-load MEDS check succeeded (Session 138 guard — was 404ing forever) (${medsCheckFailures.length} failures)`);

      // ═══ 3. The action queue — her worklist ═══
      ctx.log('3: action queue — items + filter chips render');
      await page.goto(`${origin}/verticals/workforce_monitoring/action_queue.html`);
      await new Promise(r => setTimeout(r, 3000));

      const queue = await page.evaluate(() => ({
        chips: document.querySelectorAll('.stat-chip').length,
        bodyChars: (document.body.innerText || '').length,
        hasAll: document.body.innerText.includes('All')
      }));
      ctx.assert(queue.chips > 0, `filter chips render (${queue.chips})`);
      ctx.assert(queue.hasAll, 'the "All" chip is present');
      ctx.assert(queue.bodyChars > 200, `worklist rendered content (${queue.bodyChars} chars)`);

      // ═══ 4. Notifications — her bell works for her login ═══
      ctx.log('4: notifications endpoint answers for her session');
      const notifs = await page.evaluate(async () => {
        const r = await fetch('/v1/notifications', { credentials: 'include' });
        return { ok: r.ok, status: r.status };
      });
      ctx.assert(notifs.ok, `notifications respond for her login (${notifs.status})`);

      // ═══ 5. The whole walk was error-free ═══
      ctx.assert(pageErrors.length === 0, `no uncaught page errors during the walk (${JSON.stringify(pageErrors.slice(0, 3))})`);
      const realConsoleErrors = consoleErrors.filter(t => {
        if (t.includes('MEDS')) return true;      // MEDS failures are never excused
        if (t.includes('favicon')) return false;  // browser tab-icon noise
        return true;
      });
      ctx.assert(realConsoleErrors.length === 0, `no console errors during the walk (${JSON.stringify(realConsoleErrors.slice(0, 3))})`);

    } finally {
      await page.close();
    }
  }
};
