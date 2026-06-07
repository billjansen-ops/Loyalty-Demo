/**
 * Member Composites (M) — browser/UI (required test 6).
 *
 * Verifies that the tenant-specific member field defined by the M composite /
 * member input template actually renders on the CSR member page (csr_member.html).
 * Delta's member form must surface PASSPORT (label "Passport Number"), driven by
 * the M input template that the renderer fetches from /v1/input-templates.
 *
 * Uses Delta tenant (tenant_id=1), DeltaADMIN login in the browser (mirrors the
 * Session-127 Delta smoke tests).
 */
module.exports = {
  name: 'Delta: csr_member.html renders tenant-specific member field (PASSPORT)',

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser test — Playwright not available');
      return;
    }

    // Open the enroll form (renders the member input template fields for a new member).
    const page = await ctx.openPage('/csr_member.html?mode=enroll');
    page.on('dialog', async (d) => { try { await d.accept(); } catch (_) {} });

    // Switch the browser session into Delta.
    await page.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'DeltaADMIN', password: 'DeltaADMIN' })
      });
    });
    await page.evaluate(() => {
      sessionStorage.setItem('tenant_id', '1');
      sessionStorage.setItem('tenant_name', 'Delta');
    });

    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}/csr_member.html?mode=enroll`);
    await new Promise(r => setTimeout(r, 3500));

    // The renderer keys fields as id="tpl_<MOLECULE>" / data-molecule="<MOLECULE>".
    const state = await page.evaluate(() => ({
      url: window.location.href,
      hasPassportField: !!document.querySelector('[data-molecule="PASSPORT"], #tpl_PASSPORT'),
      bodyHasLabel: /passport/i.test(document.body.innerText || '')
    }));
    await page.close();

    ctx.log(`  URL: ${state.url}`);
    ctx.assert(state.hasPassportField, 'Test 6: PASSPORT field rendered on csr_member.html enroll form');
    ctx.assert(state.bodyHasLabel, 'Test 6: "Passport" label visible on the member form');

    // Cleanup: re-login as Claude for subsequent tests.
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
