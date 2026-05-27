/**
 * Delta Smoke Test: Promotion edit save preserves promotion_result_id.
 *
 * Session 126 fix regression guard. Sibling to
 * test_bonus_edit_preserves_ids.cjs — same class of bug, different
 * admin page.
 *
 * The bug this catches:
 *   admin_promotion_edit.html's savePromotion() used to do
 *   DELETE-all-then-INSERT-all on the promotion_result rows. Every save
 *   reassigned promotion_result_id values, breaking any downstream
 *   reference to the old IDs (audit history, molecule storage).
 *
 * Session 126 fixed it to diff-based (DELETE removed → UPDATE existing
 * → INSERT new). This test re-saves a Delta promotion without changing
 * anything and asserts promotion_result_id values are byte-identical
 * before and after.
 *
 * Uses Delta tenant (tenant_id=1). DeltaADMIN login.
 */
module.exports = {
  name: 'Delta: Promotion edit save preserves promotion_result_id',

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

    // ── Step 2: Find a Delta promotion with promotion_result rows ──
    ctx.log('Step 2: Find a Delta promotion with promotion_result rows');
    const promoResp = await ctx.fetch(`/v1/promotions?tenant_id=${tenantId}`);
    const promotions = promoResp.promotions || promoResp || [];
    ctx.assert(Array.isArray(promotions) && promotions.length > 0, 'Delta has at least one promotion');

    let testPromo = null;
    let beforeResults = [];
    for (const p of promotions) {
      const r = await ctx.fetch(`/v1/promotions/${p.promotion_id}/results?tenant_id=${tenantId}`);
      const results = Array.isArray(r) ? r : (r.results || []);
      if (Array.isArray(results) && results.length > 0) {
        testPromo = p;
        beforeResults = results;
        break;
      }
    }
    ctx.assert(testPromo, 'Found a Delta promotion with at least one promotion_result row');
    if (!testPromo) return;

    const beforeIds = beforeResults.map(r => r.promotion_result_id).sort((a, b) => a - b);
    ctx.log(`  Using promotion ${testPromo.promotion_code} (id=${testPromo.promotion_id}) with ${beforeIds.length} result(s)`);
    ctx.log(`  Before IDs: [${beforeIds.join(', ')}]`);

    // ── Step 3: Open the edit page and switch to DeltaADMIN in the browser ──
    // Same browser-session pattern as test_bonus_edit_preserves_ids.cjs.
    // See that file's commit message for the gotchas (browser session
    // separate from ctx.fetch, page.url() reflects redirects).
    ctx.log('Step 3: Open admin_promotion_edit.html and switch browser session to DeltaADMIN');
    const page = await ctx.openPage(`/admin_promotion_edit.html?id=${testPromo.promotion_id}`);

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

    // The login sets the session cookie, but admin pages read tenant_id
    // from sessionStorage (normally set by the login.html → menu.html
    // flow, which we bypassed). Populate it explicitly so loadPromotion()
    // queries the right tenant. admin_bonus_edit.html happens to have a
    // `|| '1'` fallback for tenant_id which masked this issue in test 1;
    // admin_promotion_edit.html does not.
    await page.evaluate(() => {
      sessionStorage.setItem('tenant_id', '1');
      sessionStorage.setItem('tenant_name', 'Delta');
    });

    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}/admin_promotion_edit.html?id=${testPromo.promotion_id}`);
    await new Promise(r => setTimeout(r, 3000));

    const pageState = await page.evaluate(() => ({
      url: window.location.href,
      promotionCodeValue: document.querySelector('#promotionCode')?.value || null,
      hasSaveButton: !!document.querySelector('button[onclick*="savePromotion"]')
    }));
    ctx.log(`  URL after reload: ${pageState.url}`);
    ctx.log(`  #promotionCode value: ${JSON.stringify(pageState.promotionCodeValue)}`);
    ctx.assert(
      pageState.promotionCodeValue === testPromo.promotion_code,
      `Edit page #promotionCode populated with ${testPromo.promotion_code} (got "${pageState.promotionCodeValue}")`
    );

    // ── Step 4: Click Save Promotion with no changes ──
    ctx.log('Step 4: Click Save Promotion with no changes');
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('button[onclick*="savePromotion"]');
      if (!btn) return false;
      btn.click();
      return true;
    });
    ctx.assert(clicked, 'Save Promotion button found and clicked');

    // Let the chain (GET existing → DELETE removed → UPDATE/INSERT each
    // → alert → redirect) drain.
    await new Promise(r => setTimeout(r, 2500));

    await page.close();

    // ── Step 5: Re-fetch results and compare IDs ──
    ctx.log('Step 5: Re-fetch promotion_result rows and compare IDs');
    const afterResp = await ctx.fetch(`/v1/promotions/${testPromo.promotion_id}/results?tenant_id=${tenantId}`);
    const afterResults = Array.isArray(afterResp) ? afterResp : (afterResp.results || []);
    const afterIds = afterResults.map(r => r.promotion_result_id).sort((a, b) => a - b);
    ctx.log(`  After IDs:  [${afterIds.join(', ')}]`);

    ctx.assert(
      afterIds.length === beforeIds.length,
      `Same result count before (${beforeIds.length}) and after (${afterIds.length})`
    );
    ctx.assert(
      JSON.stringify(afterIds) === JSON.stringify(beforeIds),
      `promotion_result_id values preserved across save (before=[${beforeIds.join(',')}] after=[${afterIds.join(',')}])`
    );

    // Cleanup: re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
