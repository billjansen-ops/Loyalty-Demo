/**
 * Test: PPII stream weights admin endpoints + UI (v57)
 *
 * Covers:
 *   - GET /v1/tenants/:id/ppii-weights returns the seeded weights
 *   - PUT validation (sum must equal 1.0, each in [0,1], superuser-only)
 *   - PUT persists and the cache reflects the change (via subsequent GET)
 *   - Browser: admin_ppii_weights.html page loads, sliders reflect saved state,
 *     Save button enabled only when sum=1 and values changed, ML drift line updates
 */
module.exports = {
  name: 'Erica PPII weights admin UI',

  async run(ctx) {
    const tenantId = 5; // wi_php (Insight)

    // Log in as Claude (superuser)
    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'Claude', password: 'claude123' }
    });
    ctx.assert(login._ok, 'Claude (superuser) login successful');

    // ── 1. GET returns seeded weights ──
    ctx.log('Step 1: GET /v1/tenants/5/ppii-weights');
    const got = await ctx.fetch(`/v1/tenants/${tenantId}/ppii-weights`);
    ctx.assert(got._ok, 'GET responds 200');
    ctx.assert(got.weights && typeof got.weights.pulse === 'number', 'response has weights object');
    ctx.assert(Math.abs(got.sum - 1.0) < 0.001, `sum is 1.0 (got ${got.sum})`);
    ctx.log(`  weights: ${JSON.stringify(got.weights)}`);

    // ── 2. PUT validation: invalid sum ──
    ctx.log('Step 2: PUT with invalid sum → 400');
    const badSum = await ctx.fetch(`/v1/tenants/${tenantId}/ppii-weights`, {
      method: 'PUT',
      body: { pulse: 0.5, ppsi: 0.5, compliance: 0.25, events: 0.15 }
    });
    ctx.assert(badSum._status === 400, `Invalid sum returns 400 (got ${badSum._status})`);
    ctx.assert((badSum.error || '').toLowerCase().includes('sum'), 'error message mentions sum');

    // ── 3. PUT validation: value out of range ──
    const outOfRange = await ctx.fetch(`/v1/tenants/${tenantId}/ppii-weights`, {
      method: 'PUT',
      body: { pulse: 1.5, ppsi: -0.5, compliance: 0, events: 0 }
    });
    ctx.assert(outOfRange._status === 400, `Out-of-range returns 400 (got ${outOfRange._status})`);

    // ── 4. PUT validation: missing field ──
    const missing = await ctx.fetch(`/v1/tenants/${tenantId}/ppii-weights`, {
      method: 'PUT',
      body: { pulse: 0.5, ppsi: 0.5 }
    });
    ctx.assert(missing._status === 400, `Missing field returns 400 (got ${missing._status})`);

    // ── 5. PUT valid change persists ──
    ctx.log('Step 3: PUT valid change → 200, drift reported');
    const changed = await ctx.fetch(`/v1/tenants/${tenantId}/ppii-weights`, {
      method: 'PUT',
      body: { pulse: 0.30, ppsi: 0.30, compliance: 0.25, events: 0.15 }
    });
    ctx.assert(changed._ok, 'PUT 200 with valid sum');
    ctx.assert(typeof changed.ml_drift_max === 'number', 'response includes ml_drift_max');
    ctx.log(`  ml_drift_max=${changed.ml_drift_max}, drift_warning=${changed.ml_calibration_drift_warning}`);

    // Verify GET returns updated
    const reGot = await ctx.fetch(`/v1/tenants/${tenantId}/ppii-weights`);
    ctx.assert(Math.abs(reGot.weights.pulse - 0.30) < 0.001, `pulse updated to 0.30 (got ${reGot.weights.pulse})`);
    ctx.assert(Math.abs(reGot.weights.ppsi - 0.30) < 0.001, `ppsi updated to 0.30 (got ${reGot.weights.ppsi})`);

    // ── 6. Revert to defaults ──
    const reverted = await ctx.fetch(`/v1/tenants/${tenantId}/ppii-weights`, {
      method: 'PUT',
      body: { pulse: 0.35, ppsi: 0.25, compliance: 0.25, events: 0.15 }
    });
    ctx.assert(reverted._ok, 'Revert to defaults succeeds');

    // ── 7. Non-superuser cannot PUT ──
    ctx.log('Step 4: Non-superuser PUT rejected');
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });
    const forbidden = await ctx.fetch(`/v1/tenants/${tenantId}/ppii-weights`, {
      method: 'PUT',
      body: { pulse: 0.4, ppsi: 0.2, compliance: 0.25, events: 0.15 }
    });
    ctx.assert(forbidden._status === 403, `Non-superuser PUT returns 403 (got ${forbidden._status})`);

    // Log back in as Claude for the browser portion
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });

    // ── 8. Browser: admin_ppii_weights.html loads and renders correctly ──
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser checks — Playwright not available');
      return;
    }

    ctx.log('Step 5: Browser — admin_ppii_weights.html');
    const page = await ctx.openPage('/admin_ppii_weights.html');
    await page.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'Claude', password: 'claude123' })
      });
      sessionStorage.setItem('tenant_id', '5');
    });
    await page.goto(page.url());
    await new Promise(r => setTimeout(r, 2500));

    const uiState = await page.evaluate(() => {
      const rows = {};
      for (const k of ['pulse', 'ppsi', 'compliance', 'events']) {
        const num = document.getElementById('num-' + k);
        const slider = document.getElementById('slider-' + k);
        rows[k] = { num: num?.value, slider: slider?.value };
      }
      return {
        rows,
        sumText: document.getElementById('sumIndicator')?.textContent,
        saveDisabled: document.getElementById('saveBtn')?.disabled,
        retrainDisabled: document.getElementById('retrainBtn')?.disabled,
        modelLine: document.getElementById('mlModelLine')?.textContent
      };
    });
    ctx.log(`  UI state: ${JSON.stringify(uiState)}`);
    // Back link present so user can return to dashboard
    const backLinkInfo = await page.evaluate(() => {
      const a = document.getElementById('backLink');
      return a ? { text: (a.textContent || '').trim(), hasOnclick: !!a.getAttribute('onclick') } : null;
    });
    ctx.assert(!!backLinkInfo, 'Back link present on page');
    if (backLinkInfo) {
      ctx.assert(backLinkInfo.text.includes('Back'), `Back link text contains "Back" (got "${backLinkInfo.text}")`);
    }

    ctx.assert(uiState.rows.pulse.num === '35.0', `Pulse input shows 35.0 (got ${uiState.rows.pulse.num})`);
    ctx.assert(uiState.rows.ppsi.num === '25.0', `PPSI input shows 25.0 (got ${uiState.rows.ppsi.num})`);
    ctx.assert((uiState.sumText || '').includes('✓'), `Sum indicator shows checkmark (got "${uiState.sumText}")`);
    ctx.assert(uiState.saveDisabled === true, 'Save button disabled when no changes');
    ctx.assert(uiState.retrainDisabled === false, 'Retrain button enabled when weights are saved');
    ctx.assert((uiState.modelLine || '').includes('Current ML model'), 'Model info line renders');

    // Simulate changing pulse, verify Save enables + drift updates
    await page.evaluate(() => {
      const num = document.getElementById('num-pulse');
      num.value = '45.0';
      num.dispatchEvent(new Event('input'));
    });
    await new Promise(r => setTimeout(r, 300));

    const afterEdit = await page.evaluate(() => ({
      saveDisabled: document.getElementById('saveBtn')?.disabled,
      retrainDisabled: document.getElementById('retrainBtn')?.disabled,
      sumText: document.getElementById('sumIndicator')?.textContent,
      driftLine: document.getElementById('mlDriftLine')?.textContent
    }));
    ctx.log(`  after edit: ${JSON.stringify(afterEdit)}`);
    ctx.assert((afterEdit.sumText || '').includes('✗'), 'Sum shows ✗ when sum != 1.0');
    ctx.assert(afterEdit.saveDisabled === true, 'Save remains disabled when sum != 1.0');
    ctx.assert(afterEdit.retrainDisabled === true, 'Retrain disabled when there are unsaved edits');
    ctx.assert((afterEdit.driftLine || '').toLowerCase().includes('drift'), 'Drift line renders when weights differ from trained');

    // ── 9. Reset to saved state, then click Retrain and watch SSE modal ──
    ctx.log('Step 6: Click Retrain ML and verify SSE log modal completes');
    await page.evaluate(() => {
      const btn = document.querySelector('[onclick="resetToSaved()"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 300));

    // Click Retrain. The modal opens and a Python child process streams
    // training output as SSE events. ~7s on dev hardware.
    await page.evaluate(() => {
      document.getElementById('retrainBtn').click();
    });

    // Modal should be visible immediately
    await new Promise(r => setTimeout(r, 500));
    const modalOpen = await page.evaluate(() =>
      document.getElementById('retrainModal').classList.contains('active'));
    ctx.assert(modalOpen, 'Retrain modal opens on button click');

    // Wait up to 30s for the "Close" button to appear (signals retrain finished)
    let finished = false;
    try {
      await page.waitForFunction(
        () => {
          const closeBtn = document.getElementById('retrainCloseBtn');
          return closeBtn && closeBtn.style.display !== 'none';
        },
        { timeout: 30000 }
      );
      finished = true;
    } catch (e) {
      ctx.log(`  retrain timeout: ${e.message}`);
    }
    ctx.assert(finished, 'Retrain finished within 30s (Close button revealed)');

    if (finished) {
      const result = await page.evaluate(() => {
        const log = document.getElementById('retrainLog');
        const title = document.getElementById('retrainTitle')?.textContent || '';
        const text = (log?.textContent || '');
        return {
          title,
          hasGenerating: /generating/i.test(text),
          hasComplete: /complete/i.test(text),
          hasModelPath: text.includes('model.pkl'),
          hasDoneOk: !!log?.querySelector('.done-ok'),
          textLen: text.length
        };
      });
      ctx.log(`  modal: title="${result.title}", textLen=${result.textLen}`);
      ctx.assert(result.title.includes('complete'), `Modal title shows complete (got "${result.title}")`);
      ctx.assert(result.hasGenerating, 'Log captured "Generating..." line from Python');
      ctx.assert(result.hasComplete, 'Log captured "Retrain complete" line');
      ctx.assert(result.hasModelPath, 'Log captured model.pkl save path');
      ctx.assert(result.hasDoneOk, 'Log shows green ✓ done indicator');

      // Close modal
      await page.evaluate(() => document.getElementById('retrainCloseBtn').click());
      await new Promise(r => setTimeout(r, 300));
    }

    await page.close();

    // ── 10. Insight dashboard has a link to the PPII Scoring Weights page ──
    ctx.log('Step 7: Insight dashboard nav card');
    const dash = await ctx.openPage('/verticals/workforce_monitoring/dashboard.html');
    await dash.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'Claude', password: 'claude123' })
      });
      sessionStorage.setItem('tenant_id', '5');
    });
    await dash.goto(dash.url());
    await new Promise(r => setTimeout(r, 2500));

    const dashCard = await dash.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.nav-card'));
      const card = cards.find(c => /ppii\s*scoring\s*weights/i.test(c.textContent || ''));
      if (!card) return { found: false };
      return {
        found: true,
        href: card.getAttribute('href'),
        text: (card.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      };
    });
    ctx.assert(dashCard.found, 'Insight dashboard has a "PPII Scoring Weights" nav card');
    if (dashCard.found) {
      ctx.assert(dashCard.href === '/admin_ppii_weights.html',
        `Nav card href points to /admin_ppii_weights.html (got "${dashCard.href}")`);
      ctx.log(`  card text: ${dashCard.text}`);
    }

    await dash.close();
  }
};
