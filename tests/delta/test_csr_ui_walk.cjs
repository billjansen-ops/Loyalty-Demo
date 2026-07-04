/**
 * Delta: CSR surfaces browser walk (Session 132 — Delta UI coverage).
 *
 * The "what's fragile" list has said for months: "No Delta UI test
 * coverage — a Delta-surface change ships on manual verification only."
 * This walk covers the daily CSR path end-to-end in a real (headless)
 * browser, the same way a CSR uses it:
 *
 *   1. csr_member.html loads the reference member — profile fields
 *      populated, activity timeline renders rows via the display
 *      templates (magic box), efficient/verbose toggle actually changes
 *      what's shown, the bonus green block is present, points tab shows
 *      real bucket totals.
 *   2. point-summary.html renders the bucket table with totals.
 *   3. add_activity.html posts a REAL flight through the template-driven
 *      form — typeaheads (ORIGIN/DESTINATION/CARRIER), selects, numeric
 *      fields, calculated fields left to the server — and the accrual
 *      lands (POST /accruals 2xx + activity count grows).
 *
 * Uses Delta tenant (tenant_id=1), DeltaADMIN in the browser (mirrors
 * the Session-127 Delta smoke tests). Reference member 2153442807.
 * Mutates the DB (one flight) — harness snapshot/restore wipes it.
 */
module.exports = {
  name: 'Delta: CSR browser walk (member page, point summary, post a flight)',

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser test — Playwright not available');
      return;
    }

    const TENANT_ID = 1;
    const MEMBER = '2153442807';

    // ── API session for the assertion side ──
    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(login._ok, 'DeltaADMIN API login');

    const actsBeforeResp = await ctx.fetch(`/v1/member/${MEMBER}/activities?tenant_id=${TENANT_ID}&limit=200`);
    const actsBefore = (actsBeforeResp.activities || actsBeforeResp || []).length;
    ctx.assert(actsBefore > 0, `Reference member has activity history (${actsBefore} rows)`);

    // ── Browser session: DeltaADMIN on the CSR member page ──
    const page = await ctx.openPage(`/csr_member.html?memberId=${MEMBER}`);
    page.on('dialog', async (d) => { try { await d.accept(); } catch (_) {} });

    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));

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
      // ═══ 1. csr_member.html ═══
      ctx.log('1: csr_member.html — profile, timeline, toggle, green block, points');
      await page.goto(`${origin}/csr_member.html?memberId=${MEMBER}`);
      await new Promise(r => setTimeout(r, 3500));

      // Activity timeline (default tab): rows rendered via display templates
      const timeline = await page.evaluate(() => {
        const rows = document.querySelectorAll('#activityBody tr.activity-row');
        const firstEff = document.querySelector('#activityBody .details-efficient');
        return {
          rowCount: rows.length,
          efficientText: firstEff ? firstEff.innerText.trim() : '',
          hasGreenBlock: !!document.querySelector('.bonus-efficient, .bonus-verbose')
        };
      });
      ctx.assert(timeline.rowCount > 0, `activity timeline renders rows (${timeline.rowCount})`);
      ctx.assert(timeline.efficientText.length > 0, `magic-box efficient text renders ("${timeline.efficientText.substring(0, 40)}")`);
      ctx.assert(timeline.hasGreenBlock, 'bonus green block present in the timeline');

      // Efficient/verbose toggle changes what is displayed
      const toggle = await page.evaluate(() => {
        const cell = document.querySelector('#activityBody tr.activity-row td .details-efficient')?.parentElement;
        if (!cell) return { ok: false };
        const effBefore = cell.querySelector('.details-efficient').style.display;
        switchGlobalView('verbose');
        const eff = cell.querySelector('.details-efficient').style.display;
        const verb = cell.querySelector('.details-verbose').style.display;
        const verboseText = cell.querySelector('.details-verbose').innerText.trim();
        switchGlobalView('efficient');
        return { ok: true, effBefore, effAfterToggle: eff, verbAfterToggle: verb, verboseText };
      });
      ctx.assert(toggle.ok && toggle.effAfterToggle === 'none' && toggle.verbAfterToggle !== 'none',
        'efficient/verbose toggle swaps the visible details');
      ctx.assert(toggle.verboseText.length > 0, 'verbose magic-box text renders');

      // Profile tab: member fields populated (lazy-loaded on tab switch)
      await page.evaluate(() => switchTab('profile'));
      await new Promise(r => setTimeout(r, 1800));
      const profile = await page.evaluate(() => ({
        fname: document.getElementById('fname')?.value,
        lname: document.getElementById('lname')?.value,
        membershipNumber: document.getElementById('membership_number')?.value
      }));
      ctx.assert(profile.fname === 'Bill' && profile.lname === 'Jansen',
        `profile tab shows the member (${profile.fname} ${profile.lname})`);
      ctx.assert(profile.membershipNumber === MEMBER, 'membership number field populated');

      // Points tab: bucket totals render
      await page.evaluate(() => switchTab('points'));
      await new Promise(r => setTimeout(r, 1500));
      const points = await page.evaluate(() => ({
        grandAccrued: document.getElementById('grandAccrued')?.innerText || '',
        content: (document.getElementById('pointsContent')?.innerText || '').length
      }));
      ctx.assert(/\d/.test(points.grandAccrued), `points tab shows accrued total (${points.grandAccrued})`);

      // ═══ 2. point-summary.html ═══
      ctx.log('2: point-summary.html — bucket table + totals');
      await page.goto(`${origin}/point-summary.html?memberId=${MEMBER}`);
      await new Promise(r => setTimeout(r, 2500));
      const summary = await page.evaluate(() => ({
        rowCount: document.querySelectorAll('#rows tr').length,
        tAccrued: document.getElementById('tAccrued')?.innerText || '',
        tAvailable: document.getElementById('tAvailable')?.innerText || ''
      }));
      ctx.assert(summary.rowCount > 0, `point summary renders bucket rows (${summary.rowCount})`);
      ctx.assert(/\d/.test(summary.tAccrued) && /\d/.test(summary.tAvailable),
        `point summary totals render (accrued ${summary.tAccrued}, available ${summary.tAvailable})`);

      // ═══ 3. add_activity.html — post a real flight through the form ═══
      ctx.log('3: add_activity.html — fill the template-driven flight form and submit');
      let accrualStatus = null;
      page.on('response', (resp) => {
        if (resp.url().includes('/accruals') && resp.request().method() === 'POST') accrualStatus = resp.status();
      });
      await page.goto(`${origin}/add_activity.html?memberId=${MEMBER}`);
      await new Promise(r => setTimeout(r, 4000));

      // Typeaheads: type the code, let the exact-match auto-select fill the
      // hidden input (the Session-126 behavior the typeahead smoke test guards).
      // CARRIER is a 2-byte lookup — it renders as a plain <select>, so the
      // generic fill below handles it (pinned to DL for realism).
      const TYPEAHEAD_VALUES = { ORIGIN: 'MSP', DESTINATION: 'LAX' };
      for (const [key, code] of Object.entries(TYPEAHEAD_VALUES)) {
        const typed = await page.evaluate(({ key, code }) => {
          const hidden = document.querySelector(`input.typeahead-value[data-molecule="${key}"]`);
          if (!hidden) return false;
          const visible = document.getElementById(hidden.id.replace(/_code$/, ''));
          if (!visible) return false;
          visible.value = code;
          visible.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }, { key, code });
        ctx.assert(typed, `${key} typeahead present on the flight form`);
      }
      await new Promise(r => setTimeout(r, 1800)); // debounce + lookup + auto-select

      const hiddenCodes = await page.evaluate(() => {
        const out = {};
        for (const el of document.querySelectorAll('input.typeahead-value[data-molecule]')) {
          out[el.dataset.molecule] = el.value;
        }
        return out;
      });
      ctx.assert(hiddenCodes.ORIGIN === 'MSP' && hiddenCodes.DESTINATION === 'LAX',
        `typeaheads auto-selected (${JSON.stringify(hiddenCodes)})`);

      // Remaining enterable fields: fill generically by element type so the
      // walk survives composite tweaks (selects → DL if offered else first
      // real option, numbers → 100, empty template texts → 100 whether or not
      // HTML-required — the renderer validates in JS, not via the attribute —
      // empty date → local today).
      const filled = await page.evaluate(() => {
        const report = [];
        const form = document.getElementById('activityForm');
        for (const el of form.querySelectorAll('select, input')) {
          if (!el.id || el.type === 'hidden' || el.readOnly || el.disabled) continue;
          if (el.classList.contains('typeahead-input') || /_code$/.test(el.id)) continue;
          if (el.tagName === 'SELECT' && !el.value) {
            const opt = [...el.options].find(o => o.value === 'DL') || [...el.options].find(o => o.value);
            if (opt) { el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })); report.push(`${el.id}=${opt.value}`); }
          } else if (el.type === 'number' && !el.value) {
            el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); report.push(`${el.id}=100`);
          } else if (el.type === 'date' && !el.value) {
            el.value = new Date().toLocaleDateString('en-CA'); report.push(`${el.id}=today`);
          } else if (el.type === 'text' && !el.value && (el.required || el.dataset.molecule || el.id.startsWith('tpl_'))) {
            el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); report.push(`${el.id}=100`);
          }
        }
        return report;
      });
      ctx.log(`  filled: ${filled.join(', ') || '(nothing needed)'}`);

      await page.evaluate(() => { document.getElementById('submitButton').click(); });
      await new Promise(r => setTimeout(r, 4000));

      const afterSubmit = await page.evaluate(() => ({
        url: window.location.href,
        error: document.getElementById('errorMessage')?.textContent || ''
      }));
      ctx.assert(accrualStatus !== null && accrualStatus >= 200 && accrualStatus < 300,
        `flight accrual POST succeeded (status ${accrualStatus}${afterSubmit.error ? ', page error: ' + afterSubmit.error : ''})`);
      ctx.assert(afterSubmit.url.includes('csr_member.html'),
        `form redirected back to the member page (${afterSubmit.url.split('/').pop()})`);

      const actsAfterResp = await ctx.fetch(`/v1/member/${MEMBER}/activities?tenant_id=${TENANT_ID}&limit=200`);
      const actsAfter = (actsAfterResp.activities || actsAfterResp || []).length;
      ctx.assert(actsAfter > actsBefore, `activity count grew (${actsBefore} → ${actsAfter})`);

      // ═══ No uncaught page errors anywhere in the walk ═══
      ctx.assert(pageErrors.length === 0, `no uncaught page errors during the walk (${JSON.stringify(pageErrors).substring(0, 150)})`);
    } finally {
      await page.close();
      // Re-login as Claude for subsequent tests.
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    }
  }
};
