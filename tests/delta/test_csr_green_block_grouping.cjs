/**
 * Delta Smoke Test: CSR green-block groups externals under their parent bonus.
 *
 * Last of the five Session-126 Delta smoke tests. This guards the
 * original Session 126 feature work (not a regression fix — a new
 * rendering behavior) so it doesn't silently revert.
 *
 * What this catches: csr_member.html's verbose green-block render
 * used to show bonus results as a flat list — externals dangled at
 * activity level with no visual link to which bonus actually fired
 * them. An activity with a MIDDLESEAT bonus (points result) plus a
 * Free Drink Coupons external would render both lines at the same
 * level, leaving CSRs guessing which external belonged to which
 * bonus when multiple bonuses fired.
 *
 * Session 126 grouped by bonus_id. Points rows render at
 * padding-left: 12px (bonus header). Externals belonging to that
 * same bonus render at padding-left: 40px with font-style: italic,
 * immediately following their parent points row. Multiple bonuses
 * stay separated visually.
 *
 * The test creates a Delta accrual with SEAT_TYPE='M' (which fires
 * the seeded MIDDLESEAT bonus — bonus_id=19, with both a 'points'
 * result and an 'external' result "Free drinks"), opens
 * csr_member.html, ensures the green block is in verbose mode, and
 * asserts the DOM structure: the externals div is indented further
 * than the points div and follows it in order.
 *
 * Uses Delta tenant (tenant_id=1), member 1003 (Ava Longoria).
 */
module.exports = {
  name: 'Delta: CSR green block groups externals under parent bonus',

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser test — Playwright not available');
      return;
    }

    const tenantId = 1;
    const memberId = '1003';

    // ── Step 1: Login as DeltaADMIN to set up test preconditions ──
    // We need admin to query/create external_result_action and bonus_result
    // rows. We'll switch to DeltaCSR before creating the accrual.
    ctx.log('Step 1: Login as DeltaADMIN to set up preconditions');
    const adminLogin = await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(adminLogin._ok, 'DeltaADMIN login successful');

    // ── Step 1a: Ensure MIDDLESEAT has an external bonus_result row ──
    // This bonus exists in CI's seeded DB but doesn't always carry an
    // 'external' result. The grouping feature we're testing only renders
    // anything visible when externals exist, so guarantee one exists
    // before proceeding. The bonus_result POST endpoint calls
    // loadCaches(true) after insert, so the bonus engine will see the
    // new external during the next accrual. DB is restored after the
    // test, so this insertion does not persist.
    ctx.log('Step 1a: Ensure MIDDLESEAT has an external bonus_result');
    const bonusesResp = await ctx.fetch(`/v1/bonuses?tenant_id=${tenantId}`);
    const bonuses = bonusesResp.bonuses || bonusesResp || [];
    const middleseat = (Array.isArray(bonuses) ? bonuses : []).find(b => b.bonus_code === 'MIDDLESEAT');
    ctx.assert(middleseat, 'MIDDLESEAT bonus exists in DB');
    if (!middleseat) return;

    const existingResults = await ctx.fetch(`/v1/bonuses/${middleseat.bonus_id}/results?tenant_id=${tenantId}`);
    const resultRows = Array.isArray(existingResults) ? existingResults : (existingResults.results || []);
    const hasExternal = resultRows.some(r => r.result_type === 'external');

    if (!hasExternal) {
      ctx.log('  No external result on MIDDLESEAT — creating one');
      // Find or create an external_result_action for tenant 1 to reference.
      const actionsResp = await ctx.fetch('/v1/external-actions');
      let actions = Array.isArray(actionsResp) ? actionsResp : (actionsResp.actions || []);
      let actionId = actions[0] && actions[0].action_id;
      if (!actionId) {
        ctx.log('  No external_result_action — creating one');
        const created = await ctx.fetch('/v1/external-actions', {
          method: 'POST',
          body: {
            action_code: 'TEST_FREE_DRINK',
            action_name: 'Free Drink Coupons',
            function_name: null,
            description: 'Test data for green-block grouping smoke test'
          }
        });
        ctx.assert(created._ok && created.action_id, 'external_result_action created');
        actionId = created.action_id;
      }
      const inserted = await ctx.fetch(`/v1/bonuses/${middleseat.bonus_id}/results`, {
        method: 'POST',
        body: {
          tenant_id: tenantId,
          result_type: 'external',
          result_reference_id: actionId,
          result_description: 'Free Drink Coupons',
          sort_order: 1
        }
      });
      ctx.assert(inserted._ok || inserted.bonus_result_id, 'external bonus_result inserted');
    } else {
      ctx.log('  MIDDLESEAT already has an external result — proceeding');
    }

    // ── Step 1b: Switch to DeltaCSR for the accrual + page session ──
    ctx.log('Step 1b: Switch session to DeltaCSR for accrual');
    const csrLogin = await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'DeltaCSR', password: 'DeltaCSR' }
    });
    ctx.assert(csrLogin._ok, 'DeltaCSR login successful');

    // ── Step 2: Create a Middle-Seat flight that fires MIDDLESEAT ──
    ctx.log('Step 2: Create flight with SEAT_TYPE=M to fire MIDDLESEAT bonus');
    const accrualResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-15',
        base_points: 1500,
        CARRIER: 'DL',
        ORIGIN: 'MSP',
        DESTINATION: 'ORD',
        FARE_CLASS: 'Y',
        FLIGHT_NUMBER: 999,
        MQD: 250,
        SEAT_TYPE: 'M'
      }
    });
    ctx.assert(accrualResp._ok, 'Accrual created');
    ctx.assert(accrualResp.link, `Accrual response includes activity link (got "${accrualResp.link}")`);

    const firedBonusCodes = (accrualResp.bonuses || []).map(b => b.bonus_code);
    ctx.log(`  Bonuses fired: ${firedBonusCodes.join(', ') || '(none)'}`);
    ctx.assert(
      firedBonusCodes.includes('MIDDLESEAT'),
      `MIDDLESEAT bonus fired on Middle-Seat flight (got: ${firedBonusCodes.join(',') || 'none'})`
    );
    // Note: the accrual response's `bonuses` array only includes points
    // result rows; external results fire too but get surfaced later via
    // the BONUS_RESULT molecule on the parent activity (read by the
    // activities endpoint that csr_member.html consumes). The DOM check
    // below is the actual gate — that's where the grouping renders.

    // ── Step 3: Open csr_member.html and switch browser session ──
    ctx.log('Step 3: Open csr_member.html and switch browser session to DeltaCSR');
    const page = await ctx.openPage(`/csr_member.html?memberId=${memberId}`);

    page.on('dialog', async (d) => {
      try { await d.accept(); } catch (_) {}
    });

    await page.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'DeltaCSR', password: 'DeltaCSR' })
      });
    });

    await page.evaluate(() => {
      sessionStorage.setItem('tenant_id', '1');
      sessionStorage.setItem('tenant_name', 'Delta');
    });

    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}/csr_member.html?memberId=${memberId}`);
    await new Promise(r => setTimeout(r, 4000));

    // ── Step 4: Ensure the bonus block on the new activity is in verbose mode ──
    // The verbose view contains the grouped points + externals rows; the
    // summary view does not. The toggle is a button with class
    // btn-bonus-toggle inside each activity's bonus block. Click any
    // toggle that's currently showing summary ("V" label) to expand.
    ctx.log('Step 4: Make sure the green block is in verbose mode');
    await page.evaluate(() => {
      const toggles = document.querySelectorAll('.btn-bonus-toggle');
      for (const t of toggles) {
        // "V" = show verbose, "E" = show efficient/summary. If we see V,
        // click to expand. The handler renders the verbose block in place.
        if ((t.textContent || '').trim() === 'V') t.click();
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // ── Step 5: Find the MIDDLESEAT points row and its externals ──
    ctx.log('Step 5: Verify MIDDLESEAT and "Free drinks" both render with the right indentation');
    const groupingState = await page.evaluate(() => {
      // Find every div in the body. The verbose block uses inline
      // styles that include "padding-left: 12px" (bonus points row) and
      // "padding-left: 40px" (external row). We need to find a sequence
      // where a 12px div containing "Middle Seat" is immediately
      // followed by a 40px italic div containing "drink".
      const allDivs = Array.from(document.querySelectorAll('div'));
      let middleSeatDiv = null;
      let middleSeatIdx = -1;
      for (let i = 0; i < allDivs.length; i++) {
        const d = allDivs[i];
        const style = d.getAttribute('style') || '';
        if (style.includes('padding-left: 12px') && /middle\s*seat/i.test(d.textContent || '')) {
          middleSeatDiv = d;
          middleSeatIdx = i;
          break;
        }
      }
      if (!middleSeatDiv) return { found: false, reason: 'no MIDDLESEAT points row at padding-left: 12px' };

      // Scan forward from the MIDDLESEAT row until we either find a
      // "Free drink" external (success) or hit another points row
      // (failure — the externals aren't grouped under MIDDLESEAT).
      let externalDiv = null;
      for (let i = middleSeatIdx + 1; i < allDivs.length; i++) {
        const d = allDivs[i];
        const style = d.getAttribute('style') || '';
        const text = d.textContent || '';
        if (style.includes('padding-left: 40px') && style.includes('italic') && /drink/i.test(text)) {
          externalDiv = d;
          break;
        }
        // Another bonus points row breaks the group
        if (style.includes('padding-left: 12px') && /^\s*\+/.test(text.trim())) {
          break;
        }
      }

      return {
        found: true,
        externalFollowsMiddleSeat: !!externalDiv,
        middleSeatText: (middleSeatDiv.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
        externalText: externalDiv ? (externalDiv.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100) : null
      };
    });

    if (!groupingState.found) {
      ctx.log(`  ${groupingState.reason}`);
    }
    ctx.assert(groupingState.found, 'MIDDLESEAT points row rendered in verbose green block');
    ctx.log(`  MIDDLESEAT row: ${groupingState.middleSeatText}`);
    if (groupingState.externalText) {
      ctx.log(`  External row: ${groupingState.externalText}`);
    }
    ctx.assert(
      groupingState.externalFollowsMiddleSeat,
      'External "Free drinks" row renders immediately after MIDDLESEAT, indented under it'
    );

    await page.close();

    // Cleanup: re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
