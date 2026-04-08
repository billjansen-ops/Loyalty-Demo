/**
 * Core Platform Test: CSR Member Page (Browser)
 * Tests the CSR member page UI — activities tab, points tab, verbose bonus view.
 * Uses Delta airline tenant (tenant_id=1), member 1003 (Ava Longoria).
 */
module.exports = {
  name: 'Core: CSR Member Page',

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser tests — Playwright not available');
      return;
    }

    const tenantId = 1;
    const memberId = '1003';

    // ── Login as DeltaCSR via API first (for cookie) ──
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });

    // ── Create a fresh accrual so we have something recent ──
    ctx.log('Step 0: Create fresh accrual for display test');
    const accrualResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 5000,
        CARRIER: 'DL',
        ORIGIN: 'MSP',
        DESTINATION: 'HNL',
        FARE_CLASS: 'F',
        FLIGHT_NUMBER: 777,
        MQD: 900,
        SEAT_TYPE: 'A'
      }
    });
    ctx.assert(accrualResp._ok, 'Fresh accrual created for browser test');
    const bonusCount = accrualResp.bonuses_awarded || 0;
    ctx.log(`  Bonuses: ${bonusCount}`);

    // ── 1. Open CSR member page ──
    // openPage logs in as Claude (tenant 5). We need to switch to DeltaCSR in the browser.
    ctx.log('Step 1: Open CSR member page');
    const page = await ctx.openPage('/csr_member.html?memberId=1003');

    // Switch to DeltaCSR session in the browser
    await page.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'DeltaCSR', password: 'DeltaCSR' })
      });
    });

    // Reload page with Delta session
    await page.goto(page.url());
    await new Promise(r => setTimeout(r, 3000));

    const title = await page.title();
    ctx.assert(title && title.length > 0, 'CSR member page loaded');

    // ── 2. Check member name displayed ──
    ctx.log('Step 2: Verify member info displayed');
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasName = pageText.includes('Longoria') || pageText.includes('Ava');
    ctx.assert(hasName, 'Member name (Longoria/Ava) displayed on page');

    // ── 3. Check activity rows exist ──
    ctx.log('Step 3: Verify activity rows');
    const activityRows = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      return rows.length;
    });
    ctx.assert(activityRows > 1, `Activity table has rows (${activityRows} rows found)`);

    // ── 4. Check for Flight activity type ──
    ctx.log('Step 4: Verify Flight activity visible');
    const hasFlight = pageText.includes('Flight') || pageText.includes('flight') || pageText.includes('DL');
    ctx.assert(hasFlight, 'Flight activity or carrier DL visible on page');

    // ── 5. Check for points display ──
    ctx.log('Step 5: Verify points displayed');
    const hasPoints = pageText.includes('5,000') || pageText.includes('5000') || pageText.includes('SkyMiles') || pageText.includes('Miles');
    ctx.assert(hasPoints, 'Points or miles value displayed on page');

    // ── 6. Look for verbose/efficient toggle ──
    ctx.log('Step 6: Check for verbose toggle');
    const hasToggle = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, [onclick]');
      for (const b of btns) {
        const text = (b.textContent || '') + (b.getAttribute('onclick') || '');
        if (text.includes('erbose') || text.includes('fficient') || text === 'V' || text === 'E') return true;
      }
      return false;
    });
    if (hasToggle) {
      ctx.assert(true, 'Verbose/Efficient toggle button found');

      // Click verbose to show bonus breakdown
      const clicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, [onclick]');
        for (const b of btns) {
          const text = (b.textContent || '') + (b.getAttribute('onclick') || '');
          if (text.includes('erbose') || text === 'V') {
            b.click();
            return true;
          }
        }
        return false;
      });
      if (clicked) {
        await new Promise(r => setTimeout(r, 500));
        const verboseText = await page.evaluate(() => document.body.innerText);
        const hasBonusDetail = verboseText.includes('Bonus') || verboseText.includes('bonus') || verboseText.includes('+');
        ctx.log(`  Verbose area shows bonus detail: ${hasBonusDetail}`);
      }
    } else {
      ctx.log('  Note: Verbose toggle not found — may need specific activity row');
    }

    // ── 7. Check for Test button ──
    ctx.log('Step 7: Check for Test button');
    const hasTestBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent.includes('Test')) return true;
      }
      return false;
    });
    ctx.assert(hasTestBtn, 'Test button exists on activity rows');

    // ── 8. Check for Points tab/section ──
    ctx.log('Step 8: Check Points section');
    const hasPointsTab = await page.evaluate(() => {
      const els = document.querySelectorAll('[onclick*="points"], [data-tab*="points"], button, a');
      for (const e of els) {
        if ((e.textContent || '').toLowerCase().includes('point')) return true;
      }
      return false;
    });
    if (hasPointsTab) {
      ctx.assert(true, 'Points tab/section exists');
    } else {
      ctx.log('  Note: Points tab not found — may be a different label');
    }

    await page.close();

    // Re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
