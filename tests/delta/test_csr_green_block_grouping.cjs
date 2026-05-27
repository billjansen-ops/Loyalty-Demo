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

    // ── Step 1: Login as DeltaCSR ──
    ctx.log('Step 1: Login as DeltaCSR');
    const loginResp = await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'DeltaCSR', password: 'DeltaCSR' }
    });
    ctx.assert(loginResp._ok, 'DeltaCSR login successful');

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
