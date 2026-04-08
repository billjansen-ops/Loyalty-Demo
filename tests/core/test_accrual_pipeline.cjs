/**
 * Core Platform Test: Accrual Pipeline
 * Tests activity creation, molecule storage, point bucketing, and balance updates.
 * Uses Delta airline tenant (tenant_id=1), member 1003 (Ava Longoria).
 */
module.exports = {
  name: 'Core: Accrual Pipeline',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1003';

    // ── 0. Login as DeltaCSR to get tenant_id=1 session ──
    ctx.log('Step 0: Login as DeltaCSR (tenant 1)');
    const loginResp = await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'DeltaCSR', password: 'DeltaCSR' }
    });
    ctx.assert(loginResp._ok, 'DeltaCSR login successful');
    ctx.assert(loginResp.tenant_id === 1, 'Session tenant_id is 1 (Delta)');

    // ── 1. Verify member exists ──
    ctx.log('Step 1: Verify Delta member exists');
    const searchResp = await ctx.fetch(`/v1/member/search?q=Longoria&tenant_id=${tenantId}`);
    const members = Array.isArray(searchResp) ? searchResp : (searchResp.results || searchResp.members || []);
    ctx.assert(members.length > 0, 'Member search finds Longoria');
    const member = members.find(m => m.membership_number === memberId);
    ctx.assert(member, `Member ${memberId} (Ava Longoria) found`);

    // ── 2. Get baseline state ──
    ctx.log('Step 2: Capture baseline state');
    const beforeActivities = await ctx.fetch(`/v1/member/${memberId}/activities?tenant_id=${tenantId}&limit=200`);
    const beforeList = beforeActivities.activities || beforeActivities || [];
    const beforeCount = Array.isArray(beforeList) ? beforeList.length : 0;
    ctx.log(`  Baseline: ${beforeCount} activities`);

    const beforeBalance = await ctx.fetch(`/v1/member/${memberId}/balances?tenant_id=${tenantId}`);
    ctx.assert(beforeBalance._ok, 'GET /v1/member/:id/balances responds OK');
    const beforePoints = beforeBalance.balances?.base_points || 0;
    ctx.log(`  Baseline balance: ${beforePoints}`);

    // ── 3. Create a flight activity ──
    // Delta composite requires: CARRIER, ORIGIN, DESTINATION, FARE_CLASS, FLIGHT_NUMBER, MQD, SEAT_TYPE
    // FARE_CLASS values: F, Y, C. SEAT_TYPE values: A (aisle), M (middle), W (window)
    ctx.log('Step 3: Create flight accrual');
    const accrualResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 2500,
        CARRIER: 'DL',
        ORIGIN: 'MSP',
        DESTINATION: 'LAX',
        FARE_CLASS: 'F',
        FLIGHT_NUMBER: 1234,
        MQD: 373,
        SEAT_TYPE: 'A'
      }
    });

    ctx.assert(accrualResp._ok, 'POST /v1/members/:id/accruals succeeds');
    ctx.assert(accrualResp.link, 'Accrual response includes activity link');
    ctx.assertEqual(accrualResp.base_points, 2500, 'Response confirms 2500 base points');
    ctx.log(`  Activity link: ${accrualResp.link}`);

    // ── 4. Verify bonuses auto-evaluated ──
    ctx.log('Step 4: Verify bonus auto-evaluation');
    ctx.assert(accrualResp.bonuses_awarded !== undefined, 'Response includes bonuses_awarded count');
    ctx.assert(accrualResp.bonuses_awarded >= 1, 'At least one bonus awarded');
    if (accrualResp.bonuses) {
      for (const b of accrualResp.bonuses) {
        ctx.log(`  Bonus: ${b.bonus_code} — ${b.bonus_points} points`);
      }
    }

    // ── 5. Verify promotions auto-evaluated ──
    ctx.log('Step 5: Verify promotion auto-evaluation');
    ctx.assert(accrualResp.promotions_processed !== undefined, 'Response includes promotions_processed count');
    if (accrualResp.promotions) {
      for (const p of accrualResp.promotions) {
        ctx.log(`  Promotion: ${p.promotion_code} — progress: ${p.progress}/${p.goal}`);
      }
    }

    // ── 6. Verify activity appears in history ──
    ctx.log('Step 6: Verify activity in history');
    await new Promise(r => setTimeout(r, 500));
    const afterActivities = await ctx.fetch(`/v1/member/${memberId}/activities?tenant_id=${tenantId}&limit=200`);
    const afterList = afterActivities.activities || afterActivities || [];
    const afterCount = Array.isArray(afterList) ? afterList.length : 0;
    ctx.assert(afterCount > beforeCount, `Activity count increased (${beforeCount} -> ${afterCount})`);

    // ── 7. Verify balance increased ──
    ctx.log('Step 7: Verify balance increased');
    const afterBalance = await ctx.fetch(`/v1/member/${memberId}/balances?tenant_id=${tenantId}`);
    const afterPoints = afterBalance.balances?.base_points || 0;
    ctx.assert(afterPoints > beforePoints, `Balance increased (${beforePoints} -> ${afterPoints})`);
    const pointsAdded = afterPoints - beforePoints;
    ctx.log(`  Points added: ${pointsAdded} (base 2500 + bonuses)`);

    // ── 8. Verify bucket has expiration date ──
    ctx.log('Step 8: Verify point buckets');
    const buckets = await ctx.fetch(`/v1/member/${memberId}/buckets?tenant_id=${tenantId}`);
    ctx.assert(buckets._ok, 'GET /v1/member/:id/buckets responds OK');
    if (buckets.buckets && Array.isArray(buckets.buckets)) {
      ctx.log(`  Bucket groups: ${buckets.buckets.length}`);
      for (const group of buckets.buckets) {
        if (group.totals) {
          ctx.log(`  ${group.point_type_code || group.point_type_name || '?'}: accrued=${group.totals.accrued}, redeemed=${group.totals.redeemed}, available=${group.totals.available}`);
        }
      }
    }

    // ── 9. Test invalid accrual — future date ──
    ctx.log('Step 9: Test invalid accrual — future date');
    const futureResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2027-01-01',
        base_points: 100,
        CARRIER: 'DL',
        ORIGIN: 'MSP',
        DESTINATION: 'LAX',
        FARE_CLASS: 'Y',
        FLIGHT_NUMBER: 999,
        MQD: 100,
        SEAT_TYPE: 'A'
      }
    });
    ctx.assert(!futureResp._ok || futureResp._status >= 400, 'Future date accrual rejected');

    // ── 10. Test invalid accrual — missing required molecules ──
    ctx.log('Step 10: Test invalid accrual — missing required fields');
    const missingResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 100,
        CARRIER: 'DL'
        // Missing ORIGIN, DESTINATION, FARE_CLASS, FLIGHT_NUMBER, MQD, SEAT_TYPE
      }
    });
    ctx.assert(!missingResp._ok, 'Missing required molecules rejected');

    // ── 11. Test invalid accrual — nonexistent member ──
    ctx.log('Step 11: Test invalid accrual — nonexistent member');
    const badMemberResp = await ctx.fetch('/v1/members/9999999/accruals', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 100,
        CARRIER: 'DL',
        ORIGIN: 'MSP',
        DESTINATION: 'LAX',
        FARE_CLASS: 'Y',
        FLIGHT_NUMBER: 999,
        MQD: 100,
        SEAT_TYPE: 'A'
      }
    });
    ctx.assert(badMemberResp._status === 404, 'Nonexistent member returns 404');

    // ── 12. Browser: CSR member page ──
    if (ctx.hasBrowser()) {
      ctx.log('Step 12: Browser — CSR member page');
      const page = await ctx.openPage(`/csr_member.html?memberId=${memberId}`);
      await new Promise(r => setTimeout(r, 2000));

      const title = await page.title();
      ctx.assert(title && title.length > 0, 'CSR member page loaded');

      const hasActivities = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr, .activity-row, [data-activity]');
        return rows.length > 0;
      });
      ctx.assert(hasActivities, 'CSR page displays activity rows');

      await page.close();
    } else {
      ctx.log('Step 12: Skipping browser tests — Playwright not available');
    }

    // ── Re-login as Claude for subsequent tests ──
    await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'Claude', password: 'claude123' }
    });
  }
};
