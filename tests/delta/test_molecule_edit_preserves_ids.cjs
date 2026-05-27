/**
 * Delta Smoke Test: Molecule edit save preserves value_id.
 *
 * Third in the Session-126-class regression guard series.
 *
 * The bug this catches:
 *   admin_molecule_edit.html's saveInternalListValues() used to do
 *   DELETE-all-then-INSERT-all on the molecule_value rows. Every save
 *   reassigned value_id, breaking any reference to the old IDs
 *   (e.g. molecule storage on member records that pointed at specific
 *   value_id values).
 *
 * Session 126 fixed it to diff-based (DELETE removed → UPDATE existing
 * → INSERT new). This test re-saves a Delta molecule's list values
 * without changing anything and asserts value_id values are
 * byte-identical before and after.
 *
 * Uses Delta tenant (tenant_id=1). DeltaADMIN login.
 */
module.exports = {
  name: 'Delta: Molecule edit save preserves value_id',

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

    // ── Step 2: Find a Delta molecule with editable list values ──
    ctx.log('Step 2: Find a Delta molecule that has at least one value row');
    const moleculesResp = await ctx.fetch(`/v1/molecules?tenant_id=${tenantId}`);
    const molecules = Array.isArray(moleculesResp) ? moleculesResp : (moleculesResp.molecules || []);
    ctx.assert(Array.isArray(molecules) && molecules.length > 0, 'Delta has at least one molecule');

    let testMolecule = null;
    let beforeValues = [];
    // Cap the scan at a sane number; most list molecules surface quickly.
    const SCAN_CAP = 50;
    const scanList = molecules.slice(0, SCAN_CAP);
    for (const m of scanList) {
      const r = await ctx.fetch(`/v1/molecules/${m.molecule_id}/values?tenant_id=${tenantId}`);
      const values = Array.isArray(r) ? r : (r.values || []);
      if (Array.isArray(values) && values.length > 0 && values.every(v => v.value_id)) {
        testMolecule = m;
        beforeValues = values;
        break;
      }
    }
    ctx.assert(
      testMolecule,
      `Found a Delta molecule with at least one value_id row (scanned ${scanList.length}/${molecules.length})`
    );
    if (!testMolecule) return;

    const beforeIds = beforeValues.map(v => v.value_id).sort((a, b) => a - b);
    ctx.log(`  Using molecule ${testMolecule.molecule_key} (id=${testMolecule.molecule_id}) with ${beforeIds.length} value(s)`);
    ctx.log(`  Before IDs: [${beforeIds.join(', ')}]`);

    // ── Step 3: Open the edit page and switch to DeltaADMIN in the browser ──
    ctx.log('Step 3: Open admin_molecule_edit.html and switch browser session to DeltaADMIN');
    const page = await ctx.openPage(`/admin_molecule_edit.html?id=${testMolecule.molecule_id}`);

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

    await page.evaluate(() => {
      sessionStorage.setItem('tenant_id', '1');
      sessionStorage.setItem('tenant_name', 'Delta');
    });

    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}/admin_molecule_edit.html?id=${testMolecule.molecule_id}`);
    await new Promise(r => setTimeout(r, 3000));

    const pageState = await page.evaluate(() => ({
      url: window.location.href,
      moleculeKeyValue: document.querySelector('#moleculeKey')?.value || null,
      hasSaveButton: !!document.querySelector('button[onclick*="saveMolecule"]')
    }));
    ctx.log(`  URL after reload: ${pageState.url}`);
    ctx.log(`  #moleculeKey value: ${JSON.stringify(pageState.moleculeKeyValue)}`);
    ctx.assert(
      pageState.moleculeKeyValue === testMolecule.molecule_key,
      `Edit page #moleculeKey populated with ${testMolecule.molecule_key} (got "${pageState.moleculeKeyValue}")`
    );

    // ── Step 4: Click Save Molecule with no changes ──
    ctx.log('Step 4: Click Save Molecule with no changes');
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('button[onclick*="saveMolecule"]');
      if (!btn) return false;
      btn.click();
      return true;
    });
    ctx.assert(clicked, 'Save Molecule button found and clicked');

    await new Promise(r => setTimeout(r, 2500));
    await page.close();

    // ── Step 5: Re-fetch values and compare IDs ──
    ctx.log('Step 5: Re-fetch molecule values and compare IDs');
    const afterResp = await ctx.fetch(`/v1/molecules/${testMolecule.molecule_id}/values?tenant_id=${tenantId}`);
    const afterValues = Array.isArray(afterResp) ? afterResp : (afterResp.values || []);
    const afterIds = afterValues.map(v => v.value_id).sort((a, b) => a - b);
    ctx.log(`  After IDs:  [${afterIds.join(', ')}]`);

    ctx.assert(
      afterIds.length === beforeIds.length,
      `Same value count before (${beforeIds.length}) and after (${afterIds.length})`
    );
    ctx.assert(
      JSON.stringify(afterIds) === JSON.stringify(beforeIds),
      `value_id values preserved across save (before=[${beforeIds.join(',')}] after=[${afterIds.join(',')}])`
    );

    // Cleanup: re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
