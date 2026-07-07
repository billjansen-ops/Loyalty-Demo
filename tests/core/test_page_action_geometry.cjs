/**
 * Core: page action-button geometry (Session 135 layout sweep) — every edit /
 * action page's PRIMARY button (Save / Add / Post / Process…) must sit inside
 * a 1280x720 viewport without scrolling. Measured in pixels, the Session 134
 * standard — "looks fine" doesn't count.
 *
 * Why: the app-shell pages sized themselves 100vh under the fixed 48px nav
 * (bottom 48px clipped by body overflow:hidden), and theme.css's
 * .main-content { min-height: 100vh } silently re-inflated them. Session 135
 * fixed the shell on ~45 pages (height: calc(100vh - 48px) + min-height: 0)
 * and moved four pages' action bars out of their scroll regions. This test
 * keeps every page honest.
 *
 * Pages are probed in CREATE mode (no id) plus EDIT mode with a real entity
 * where the form grows with data. Read-only page loads — no writes.
 */
const BTN_RE = /save|add|post|apply|create|submit|update|process|redeem/i;

const DELTA_PAGES = [
  'admin_activity_display_template_edit.html',
  'admin_adjustment_edit.html',
  'admin_airport_edit.html',
  'admin_alias_composite_edit.html',
  'admin_badge_edit.html',
  'admin_bonus_edit.html',
  'admin_carrier_edit.html',
  'admin_composite_edit.html',
  'admin_expiration_edit.html',
  'admin_external_action_edit.html',
  'admin_input_template_edit.html',
  'admin_molecule_edit.html',
  'admin_partner_edit.html',
  'admin_point_type_edit.html',
  'admin_promotion_edit.html',
  'admin_redemption_edit.html',
  'admin_survey_edit.html',
  'admin_survey_question_edit.html',
  'admin_sysparm_edit.html',
  'admin_tier_edit.html',
  'admin_user_edit.html',
  'add_activity.html?memberId=2153442807',
  'add_alias.html?memberId=2153442807',
  'add_redemption.html?memberId=2153442807'
];

// Edit mode for the pages whose forms grow with data (the Session 135
// failures). Entity refs resolved live so the test survives id drift.
async function editModePages(ctx) {
  const pages = [];
  const bonuses = await ctx.fetch('/v1/bonuses');
  const bonusRows = Array.isArray(bonuses) ? bonuses : (bonuses.bonuses || []);
  if (bonusRows.length) pages.push(`admin_bonus_edit.html?code=${encodeURIComponent(bonusRows[0].bonus_code)}`);
  const tiers = await ctx.fetch('/v1/tiers');
  const tierRows = Array.isArray(tiers) ? tiers : (tiers.tiers || []);
  if (tierRows.length) pages.push(`admin_tier_edit.html?tier_code=${encodeURIComponent(tierRows[0].tier_code)}`);
  const mols = await ctx.fetch('/v1/molecules');
  const molRows = Array.isArray(mols) ? mols : (mols.molecules || []);
  if (molRows.length) pages.push(`admin_molecule_edit.html?id=${molRows[0].molecule_id}`);
  const partners = await ctx.fetch('/v1/partners');
  const partnerRows = Array.isArray(partners) ? partners : (partners.partners || []);
  if (partnerRows.length) pages.push(`admin_partner_edit.html?partner_id=${partnerRows[0].partner_id}`);
  return pages;
}

module.exports = {
  name: 'Core: page action buttons above the fold (layout-sweep geometry)',

  async run(ctx) {
    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(login._ok, 'DeltaADMIN login');

    if (!ctx.hasBrowser()) {
      ctx.log('browser not available — geometry sweep skipped');
      return;
    }

    const editPages = await editModePages(ctx);
    const page = await ctx.openPage('/menu.html');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'DeltaADMIN', password: 'DeltaADMIN' })
      });
      sessionStorage.setItem('tenant_id', '1');
      sessionStorage.setItem('tenant_name', 'Delta');
    });
    const base = new URL(page.url()).origin;

    for (const path of [...DELTA_PAGES, ...editPages]) {
      await page.goto(`${base}/${path}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1800);
      if (/login|unauthorized/.test(page.url())) {
        ctx.assert(false, `${path} — bounced to ${page.url().split('/').pop()}`);
        continue;
      }
      const g = await page.evaluate((reSrc) => {
        const re = new RegExp(reSrc, 'i');
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return false;
          let n = el;
          while (n && n !== document.body) {
            const s = getComputedStyle(n);
            if (s.display === 'none' || s.visibility === 'hidden') return false;
            n = n.parentElement;
          }
          return true;
        };
        const btns = [...document.querySelectorAll('button, input[type=submit]')]
          .filter(b => re.test(b.textContent || b.value || '') && visible(b))
          .filter(b => !b.closest('.modal-overlay:not(.active), .ce-dialog-overlay:not(.active), .ce-overlay:not(.active), .modal:not(.active), .dialog-overlay:not(.active)'));
        if (!btns.length) return { status: 'NO-BUTTON' };
        const btn = btns[btns.length - 1];
        const r = btn.getBoundingClientRect();
        return {
          status: (r.top >= 0 && r.bottom <= window.innerHeight) ? 'OK' : 'BELOW-FOLD',
          text: (btn.textContent || btn.value || '').trim().substring(0, 22),
          bottom: Math.round(r.bottom),
          viewport: window.innerHeight
        };
      }, BTN_RE.source);
      ctx.assert(g.status === 'OK',
        `${path} — [${g.text || 'no button found'}] ${g.status === 'OK' ? `on screen (${g.bottom}/${g.viewport})` : g.status + (g.bottom ? ` (${g.bottom}/${g.viewport})` : '')}`);
    }

    await page.close();
  }
};
