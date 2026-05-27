/**
 * Delta Smoke Test: Typeahead auto-selects on exact-code match.
 *
 * Session 126 fix regression guard.
 *
 * The bug this catches:
 *   The typeahead-input fields (ORIGIN, DESTINATION, etc. on flight
 *   forms) used to require the user to click a dropdown item to
 *   populate the hidden code input. If the user typed "MSP" and tabbed
 *   away (or hit Enter, or pressed the submit button) without clicking
 *   the dropdown, the hidden input that holds the actual code stayed
 *   empty. Downstream calculations (miles, aircraft type) silently got
 *   empty inputs. The user saw "Saved successfully!" with a flight
 *   stored as ORIGIN='' — silent calc failure.
 *
 * Session 126 added auto-select-on-exact-match in
 * template-form-renderer.js (~line 681): if the typed query exactly
 * matches a result code (case-insensitive), the hidden input is
 * populated automatically, no click required. The dropdown stays
 * visible so the user can still pick a different option.
 *
 * This test loads bonus_test.html, simulates typing "MSP" into the
 * ORIGIN typeahead, waits for the debounced lookup-search + dropdown
 * + auto-select to run, and asserts the hidden #ORIGIN_code input is
 * set to "MSP" — without ever clicking the dropdown.
 *
 * Uses Delta tenant (tenant_id=1). DeltaADMIN login.
 */
module.exports = {
  name: 'Delta: Typeahead auto-selects on exact-code match',

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

    // ── Step 2: Verify the lookup-search endpoint returns MSP ──
    // If this endpoint doesn't return MSP for query "MSP", the test
    // can't possibly pass even if the auto-select logic works — so
    // fail clearly here instead of confusingly later.
    ctx.log('Step 2: Verify /v1/lookup-search/ORIGIN returns MSP for query "MSP"');
    const lookupResp = await ctx.fetch(`/v1/lookup-search/ORIGIN?tenant_id=${tenantId}&q=MSP`);
    ctx.assert(lookupResp._ok, 'lookup-search endpoint responds');
    const lookupResults = Array.isArray(lookupResp) ? lookupResp : (lookupResp.results || []);
    const mspMatch = lookupResults.find(r => (r.code || '').toUpperCase() === 'MSP');
    ctx.assert(mspMatch, `MSP found in /v1/lookup-search/ORIGIN results for query "MSP" (${lookupResults.length} result(s))`);

    // ── Step 3: Pick a Delta bonus to load bonus_test.html for ──
    ctx.log('Step 3: Pick a Delta bonus');
    const bonusesResp = await ctx.fetch(`/v1/bonuses?tenant_id=${tenantId}`);
    const bonuses = bonusesResp.bonuses || bonusesResp || [];
    ctx.assert(Array.isArray(bonuses) && bonuses.length > 0, 'Delta has at least one bonus');
    const testBonus = bonuses[0]; // bonus_test.html renders activity fields based on activity_type, which Delta bonuses share (mostly 'A' for flight)
    ctx.log(`  Using ${testBonus.bonus_code}`);

    // ── Step 4: Open bonus_test.html and set up the browser session ──
    ctx.log('Step 4: Open bonus_test.html and switch browser session to DeltaADMIN');
    const page = await ctx.openPage(`/bonus_test.html?code=${testBonus.bonus_code}`);

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
    await page.goto(`${origin}/bonus_test.html?code=${testBonus.bonus_code}`);
    // bonus_test.html renders the activity field template via template-form-renderer.js
    // which fetches the template + sets up the typeaheads. Give it time.
    await new Promise(r => setTimeout(r, 4000));

    // ── Step 5: Locate the ORIGIN typeahead and verify hidden input starts empty ──
    ctx.log('Step 5: Find the ORIGIN typeahead input');
    const inputState = await page.evaluate(() => {
      // The typeahead is rendered with id=fieldId (the data-molecule key)
      // and hidden as id=`${fieldId}_code`. Names vary per template; find
      // by data-molecule attribute on the hidden input.
      const hidden = document.querySelector('input.typeahead-value[data-molecule="ORIGIN"]');
      if (!hidden) {
        return { found: false, allMolecules: Array.from(document.querySelectorAll('input.typeahead-value')).map(el => el.dataset.molecule) };
      }
      // The visible input shares the id prefix
      const visibleId = hidden.id.replace(/_code$/, '');
      const visible = document.getElementById(visibleId);
      return {
        found: true,
        visibleId,
        hiddenId: hidden.id,
        hiddenStartValue: hidden.value,
        visibleStartValue: visible ? visible.value : null
      };
    });
    if (!inputState.found) {
      ctx.log(`  No ORIGIN typeahead in form. Available typeaheads: ${JSON.stringify(inputState.allMolecules)}`);
    }
    ctx.assert(inputState.found, `ORIGIN typeahead input present on bonus_test.html for ${testBonus.bonus_code}`);
    if (!inputState.found) {
      await page.close();
      return;
    }
    ctx.log(`  Visible #${inputState.visibleId}, hidden #${inputState.hiddenId}`);
    ctx.assert(!inputState.hiddenStartValue, `Hidden ORIGIN code starts empty (got "${inputState.hiddenStartValue}")`);

    // ── Step 6: Simulate typing "MSP" into the visible input ──
    // Set value + dispatch input event. The typeahead listens for 'input',
    // not 'change', and immediately clears hiddenInput.value on each keystroke
    // before kicking off the 200ms debounce → fetch → render → auto-select chain.
    ctx.log('Step 6: Type "MSP" into ORIGIN visible input');
    await page.evaluate((visibleId) => {
      const visible = document.getElementById(visibleId);
      visible.value = 'MSP';
      visible.dispatchEvent(new Event('input', { bubbles: true }));
    }, inputState.visibleId);

    // Wait for: debounce (200ms) + fetch round trip + dropdown render +
    // auto-select. 1500ms is comfortable.
    await new Promise(r => setTimeout(r, 1500));

    // ── Step 7: Without clicking, check the hidden input is now MSP ──
    ctx.log('Step 7: Verify hidden input was auto-populated WITHOUT a click');
    const afterState = await page.evaluate((hiddenId) => {
      const hidden = document.getElementById(hiddenId);
      const dropdown = document.getElementById(hiddenId.replace(/_code$/, '_dropdown'));
      return {
        hiddenValue: hidden ? hidden.value : null,
        dropdownVisible: dropdown ? (dropdown.style.display !== 'none') : false,
        dropdownItemCount: dropdown ? dropdown.querySelectorAll('.typeahead-item').length : 0
      };
    }, inputState.hiddenId);
    ctx.log(`  Hidden ORIGIN value: ${JSON.stringify(afterState.hiddenValue)}`);
    ctx.log(`  Dropdown visible: ${afterState.dropdownVisible}, items: ${afterState.dropdownItemCount}`);

    ctx.assert(
      afterState.dropdownItemCount > 0,
      `Dropdown populated with ≥1 item (got ${afterState.dropdownItemCount})`
    );
    ctx.assert(
      afterState.hiddenValue === 'MSP',
      `Hidden ORIGIN code auto-populated to "MSP" without click (got "${afterState.hiddenValue}")`
    );

    await page.close();

    // Cleanup: re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
