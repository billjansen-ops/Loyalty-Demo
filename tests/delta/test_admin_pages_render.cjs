/**
 * Delta: admin pages render sweep (Session 132 — Delta UI coverage).
 *
 * Loads every core admin list page in a real (headless) browser as
 * DeltaADMIN on tenant 1 and asserts each one (a) renders real content
 * and (b) produces ZERO console errors and ZERO uncaught page errors.
 *
 * Why this matters: these screens have no other automated coverage —
 * "a Delta-surface change ships on manual verification only" has been
 * on the fragility list since Session 119. A broken fetch, a renamed
 * endpoint, a JS typo, or a platform-wide refactor that breaks an
 * admin page now fails the suite instead of waiting for a human to
 * click it.
 *
 * The page list is the core admin surface reachable from the admin
 * hub. Edit pages (admin_*_edit.html) are excluded — they need entity
 * params and several already have dedicated smoke tests (bonus /
 * promotion / molecule edit save-preserves-ids).
 *
 * Read-only — no DB mutation.
 */
const PAGES = [
  'admin.html',
  'admin_molecules.html',
  'admin_molecule_groups.html',
  'admin_composites.html',
  'admin_input_templates.html',
  'admin_activity_display_templates.html',
  'admin_bonuses.html',
  'admin_promotions.html',
  'admin_rules.html',
  'admin_tiers.html',
  'admin_redemptions.html',
  'admin_adjustments.html',
  'admin_partners.html',
  'admin_carriers.html',
  'admin_airports.html',
  'admin_point_types.html',
  'admin_badges.html',
  'admin_external_actions.html',
  'admin_signal_types.html',
  'admin_alias_composites.html',
  'admin_sysparms.html',
  'admin_codes.html',
  'admin_audit_report.html',
  'admin_users.html'
];

module.exports = {
  name: 'Delta: admin pages render without console errors',

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser test — Playwright not available');
      return;
    }

    // One page object for the whole sweep; DeltaADMIN browser session.
    const page = await ctx.openPage('/admin.html');
    page.on('dialog', async (d) => { try { await d.accept(); } catch (_) {} });

    let errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (e) => errors.push(String(e.message || e)));

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

    try {
      for (const target of PAGES) {
        errors = [];
        await page.goto(`${origin}/${target}`, { waitUntil: 'networkidle' });
        await new Promise(r => setTimeout(r, 1200));

        const state = await page.evaluate(() => ({
          textLength: (document.body.innerText || '').trim().length,
          atLogin: window.location.pathname.endsWith('/login.html'),
          atUnauthorized: window.location.pathname.endsWith('/unauthorized.html')
        }));

        const clean = errors.length === 0;
        ctx.assert(!state.atLogin && !state.atUnauthorized && state.textLength > 50 && clean,
          `${target} renders clean` + (clean
            ? ` (${state.textLength} chars)`
            : ` — ${errors.length} console error(s): ${errors[0].substring(0, 120)}`)
          + (state.atLogin ? ' [bounced to login]' : '')
          + (state.atUnauthorized ? ' [bounced to unauthorized]' : ''));
      }
    } finally {
      await page.close();
      // Re-login as Claude for subsequent tests.
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    }
  }
};
