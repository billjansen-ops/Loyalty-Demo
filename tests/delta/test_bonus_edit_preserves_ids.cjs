/**
 * Delta Smoke Test: Bonus edit save preserves bonus_result_id.
 *
 * Session 126 fix regression guard.
 *
 * The bug this catches:
 *   admin_bonus_edit.html's saveBonus() used to do DELETE-all-then-INSERT-all
 *   on the bonus_result rows. Every save reassigned bonus_result_id values.
 *   Past N-type activities store the firing bonus_result_id in the
 *   BONUS_RESULT molecule for audit display, so a re-save silently broke
 *   the green-block render on historical flights.
 *
 * Session 126 fixed it to be diff-based (DELETE removed → UPDATE existing →
 * INSERT new). This test re-saves a Delta bonus without changing anything
 * and asserts the bonus_result_id values are byte-identical before and
 * after.
 *
 * Uses Delta tenant (tenant_id=1). DeltaADMIN login.
 */
module.exports = {
  name: 'Delta: Bonus edit save preserves bonus_result_id',

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser test — Playwright not available');
      return;
    }

    const tenantId = 1;

    // ── Step 1: Login as DeltaADMIN ──
    ctx.log('Step 1: Login as DeltaADMIN');
    const loginResp = await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(loginResp._ok, 'DeltaADMIN login successful');

    // ── Step 2: Find a Delta bonus that has at least one bonus_result row ──
    ctx.log('Step 2: Find a Delta bonus with bonus_result rows');
    const bonusesResp = await ctx.fetch(`/v1/bonuses?tenant_id=${tenantId}`);
    const bonuses = bonusesResp.bonuses || bonusesResp || [];
    ctx.assert(Array.isArray(bonuses) && bonuses.length > 0, 'Delta has at least one bonus');

    let testBonus = null;
    let beforeResults = [];
    for (const b of bonuses) {
      const r = await ctx.fetch(`/v1/bonuses/${b.bonus_id}/results?tenant_id=${tenantId}`);
      const results = Array.isArray(r) ? r : (r.results || []);
      if (Array.isArray(results) && results.length > 0) {
        testBonus = b;
        beforeResults = results;
        break;
      }
    }
    ctx.assert(testBonus, 'Found a Delta bonus with at least one bonus_result row');
    if (!testBonus) return;

    const beforeIds = beforeResults.map(r => r.bonus_result_id).sort((a, b) => a - b);
    ctx.log(`  Using bonus ${testBonus.bonus_code} (id=${testBonus.bonus_id}) with ${beforeIds.length} result(s)`);
    ctx.log(`  Before IDs: [${beforeIds.join(', ')}]`);

    // ── Step 3: Open the edit page and switch to DeltaADMIN in the browser ──
    // openPage logs into the browser as Claude (tenant 5). The ctx.fetch
    // DeltaADMIN login from Step 1 doesn't transfer — the browser keeps
    // its own session. Switch via fetch inside the page, then reload.
    // Same pattern as tests/core/test_csr_member_page.cjs.
    ctx.log('Step 3: Open admin_bonus_edit.html and switch browser session to DeltaADMIN');
    const page = await ctx.openPage(`/admin_bonus_edit.html?code=${testBonus.bonus_code}`);

    page.on('dialog', async (d) => {
      try { await d.accept(); } catch (_) {}
    });

    await page.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'DeltaADMIN', password: 'DeltaADMIN' })
      });
    });

    // Admin pages read tenant_id from sessionStorage, set by the normal
    // login.html → menu.html flow that we bypassed. admin_bonus_edit.html
    // happens to have a `|| '1'` fallback for tenant_id which would
    // otherwise mask the issue here, but we set it explicitly to match
    // the pattern in tests 2-5 and not depend on the fallback surviving
    // future refactors.
    await page.evaluate(() => {
      sessionStorage.setItem('tenant_id', '1');
      sessionStorage.setItem('tenant_name', 'Delta');
    });

    // Navigate back to the edit URL explicitly. If the initial openPage()
    // got bounced to admin_bonuses.html by the Claude/tenant-5 session,
    // page.url() now points there — reloading it would reload the list
    // page instead of the edit page.
    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}/admin_bonus_edit.html?code=${testBonus.bonus_code}`);
    await new Promise(r => setTimeout(r, 3000));

    // Sanity: edit page populated the bonus code input. Note that the
    // bonus code lives in <input id="bonusCode" value="...">, not in
    // body innerText — input values are not rendered as text.
    const pageState = await page.evaluate(() => ({
      url: window.location.href,
      bonusCodeValue: document.querySelector('#bonusCode')?.value || null,
      hasSaveButton: !!document.querySelector('button[onclick*="saveBonus"]')
    }));
    ctx.log(`  URL after reload: ${pageState.url}`);
    ctx.log(`  #bonusCode value: ${JSON.stringify(pageState.bonusCodeValue)}`);
    ctx.assert(
      pageState.bonusCodeValue === testBonus.bonus_code,
      `Edit page #bonusCode populated with ${testBonus.bonus_code} (got "${pageState.bonusCodeValue}")`
    );

    // ── Step 4: Trigger save by clicking the Save Bonus button ──
    // Click the DOM button so the inline onclick handler runs in script
    // scope. This is robust to saveBonus not being window-attached.
    ctx.log('Step 4: Click Save Bonus with no changes');
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('button[onclick*="saveBonus"]');
      if (!btn) return false;
      btn.click();
      return true;
    });
    ctx.assert(clicked, 'Save Bonus button found and clicked');

    // The save does sequential awaited fetches (GET existing → DELETE
    // removed → UPDATE/INSERT each → alert → redirect). Wait for that
    // chain to finish. 2s is generous for a 1-result bonus.
    await new Promise(r => setTimeout(r, 2500));

    await page.close();

    // ── Step 5: Re-fetch results and compare IDs ──
    ctx.log('Step 5: Re-fetch bonus_result rows and compare IDs');
    const afterResp = await ctx.fetch(`/v1/bonuses/${testBonus.bonus_id}/results?tenant_id=${tenantId}`);
    const afterResults = Array.isArray(afterResp) ? afterResp : (afterResp.results || []);
    const afterIds = afterResults.map(r => r.bonus_result_id).sort((a, b) => a - b);
    ctx.log(`  After IDs:  [${afterIds.join(', ')}]`);

    ctx.assert(
      afterIds.length === beforeIds.length,
      `Same result count before (${beforeIds.length}) and after (${afterIds.length})`
    );
    ctx.assert(
      JSON.stringify(afterIds) === JSON.stringify(beforeIds),
      `bonus_result_id values preserved across save (before=[${beforeIds.join(',')}] after=[${afterIds.join(',')}])`
    );

    // ── Cleanup: re-login as Claude (matches the pattern in test_admin_pages.cjs) ──
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
