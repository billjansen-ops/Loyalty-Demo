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

    await page.close();
  }
};
