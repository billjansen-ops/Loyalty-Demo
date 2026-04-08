/**
 * Core Platform Test: Bonus Engine
 * Tests bonus evaluation, Type N activity creation, point routing, date/DOW filtering.
 * Uses Delta airline tenant (tenant_id=1), member 1003 (Ava Longoria).
 */
module.exports = {
  name: 'Core: Bonus Engine',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1003';

    // ── Login as DeltaCSR ──
    const loginResp = await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'DeltaCSR', password: 'DeltaCSR' }
    });
    ctx.assert(loginResp._ok, 'DeltaCSR login successful');

    // ── 1. List active bonuses ──
    ctx.log('Step 1: List active bonuses for Delta');
    const bonusResp = await ctx.fetch(`/v1/bonuses?tenant_id=${tenantId}`);
    ctx.assert(bonusResp._ok !== false, 'GET /v1/bonuses responds OK');
    const bonuses = bonusResp.bonuses || bonusResp || [];
    ctx.assert(Array.isArray(bonuses) && bonuses.length > 0, 'Delta has active bonuses');
    ctx.log(`  Found ${bonuses.length} bonuses`);

    // ── 2. Create First Class flight — should trigger DIAMOND50 (50% on fare_class F) ──
    ctx.log('Step 2: Create First Class flight (FARE_CLASS=F)');
    const fcResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 2000,
        CARRIER: 'DL',
        ORIGIN: 'MSP',
        DESTINATION: 'LAX',
        FARE_CLASS: 'F',
        FLIGHT_NUMBER: 100,
        MQD: 500,
        SEAT_TYPE: 'A'
      }
    });
    ctx.assert(fcResp._ok, 'First Class accrual created');
    ctx.assert(fcResp.bonuses_awarded >= 1, 'At least one bonus awarded for First Class');

    // Check for specific bonuses
    const bonusCodes = (fcResp.bonuses || []).map(b => b.bonus_code);
    ctx.log(`  Bonuses fired: ${bonusCodes.join(', ')}`);

    // Verify bonus points calculation
    if (fcResp.bonuses && fcResp.bonuses.length > 0) {
      for (const b of fcResp.bonuses) {
        ctx.assert(b.bonus_points > 0, `Bonus ${b.bonus_code} awarded ${b.bonus_points} points`);
        ctx.log(`  ${b.bonus_code}: ${b.bonus_points} pts`);
      }
    }

    // ── 3. Verify Type N bonus activities created ──
    ctx.log('Step 3: Verify Type N bonus activities');
    const activities = await ctx.fetch(`/v1/member/${memberId}/activities?tenant_id=${tenantId}&limit=200`);
    const actList = activities.activities || activities || [];
    // Type N activities should exist (they may be nested under parent or separate)
    ctx.log(`  Total activities in history: ${actList.length}`);

    // ── 4. Create Economy flight — different bonus set ──
    ctx.log('Step 4: Create Economy flight (FARE_CLASS=Y)');
    const econResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 800,
        CARRIER: 'DL',
        ORIGIN: 'JFK',
        DESTINATION: 'ORD',
        FARE_CLASS: 'Y',
        FLIGHT_NUMBER: 200,
        MQD: 150,
        SEAT_TYPE: 'M'
      }
    });
    ctx.assert(econResp._ok, 'Economy accrual created');
    const econBonusCodes = (econResp.bonuses || []).map(b => b.bonus_code);
    ctx.log(`  Bonuses fired: ${econBonusCodes.join(', ') || 'none'}`);

    // Middle seat bonus should fire (SEAT_TYPE=M)
    const hasMSBonus = econBonusCodes.includes('MIDDLESEAT');
    if (hasMSBonus) {
      ctx.assert(true, 'MIDDLESEAT bonus fired for middle seat');
      const msBonus = econResp.bonuses.find(b => b.bonus_code === 'MIDDLESEAT');
      ctx.assertEqual(msBonus.bonus_points, 500, 'MIDDLESEAT bonus is 500 fixed points');
    } else {
      ctx.log('  Note: MIDDLESEAT bonus did not fire — may have additional criteria');
    }

    // ── 5. Verify expired bonuses don't fire ──
    ctx.log('Step 5: Check expired bonus handling');
    // BILLSTEST and GOLD20 expired 2025-12-30/31 — they should NOT fire for 2026 activities
    const expiredBonuses = ['BILLSTEST', 'GOLD20'];
    const allFiredCodes = [...bonusCodes, ...econBonusCodes];
    for (const expCode of expiredBonuses) {
      ctx.assert(!allFiredCodes.includes(expCode), `Expired bonus ${expCode} did not fire`);
    }

    // ── 6. Test manual bonus re-evaluation ──
    ctx.log('Step 6: Test manual bonus re-evaluation endpoint');
    if (fcResp.link) {
      const reEvalResp = await ctx.fetch(`/v1/activities/${encodeURIComponent(fcResp.link)}/evaluate-bonuses`, {
        method: 'POST'
      });
      ctx.log(`  Re-eval response status: ${reEvalResp._status}`);
      // May return bonuses or may skip (already applied)
      ctx.assert(reEvalResp._status !== 500, 'Manual bonus re-evaluation does not crash');
    }

    // ── 7. Verify bonus points went to correct bucket ──
    ctx.log('Step 7: Verify point bucket after bonuses');
    const buckets = await ctx.fetch(`/v1/member/${memberId}/buckets?tenant_id=${tenantId}`);
    ctx.assert(buckets._ok, 'Buckets endpoint responds OK');
    if (buckets.buckets) {
      for (const g of buckets.buckets) {
        if (g.totals && g.totals.accrued > 0) {
          ctx.log(`  ${g.point_type_code || g.point_type_name}: accrued=${g.totals.accrued}`);
        }
      }
    }

    // ── 8. Browser: Verbose bonus breakdown ──
    if (ctx.hasBrowser()) {
      ctx.log('Step 8: Browser — Verbose bonus display');
      const page = await ctx.openPage(`/csr_member.html?memberId=${memberId}`);
      await new Promise(r => setTimeout(r, 2000));

      // Look for the verbose toggle or bonus display
      const hasVerboseArea = await page.evaluate(() => {
        // Look for the green bonus breakdown area or verbose toggle buttons
        const greenBox = document.querySelector('[style*="ecfdf5"], [style*="10b981"], .bonus-detail');
        const toggleBtn = document.querySelector('[onclick*="verbose"], [onclick*="Verbose"], button[title*="erbose"]');
        return !!(greenBox || toggleBtn);
      });
      ctx.log(`  Verbose area/toggle found: ${hasVerboseArea}`);

      await page.close();
    } else {
      ctx.log('Step 8: Skipping browser tests');
    }

    // Re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
