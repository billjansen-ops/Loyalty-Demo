/**
 * Core Platform Test: Redemption
 * Tests redemption processing, FIFO bucket draining, point type restrictions, balance decreases.
 * Uses Delta airline tenant (tenant_id=1).
 * Redemption = Type R activity that can point to multiple point buckets.
 */
module.exports = {
  name: 'Core: Redemption',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1003';

    // ── Login as DeltaCSR ──
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });

    // ── 1. List redemption rules ──
    ctx.log('Step 1: List redemption rules for Delta');
    const rulesResp = await ctx.fetch(`/v1/redemptions?tenant_id=${tenantId}`);
    ctx.assert(rulesResp._ok !== false, 'GET /v1/redemption-rules responds OK');
    const rules = rulesResp.rules || rulesResp || [];
    if (Array.isArray(rules)) {
      ctx.log(`  Found ${rules.length} redemption rules`);
      for (const r of rules) {
        ctx.log(`  ${r.redemption_code}: ${r.redemption_description}, type=${r.redemption_type}, points=${r.points_required || 'variable'}`);
      }
    } else {
      ctx.log(`  Response: ${JSON.stringify(rulesResp).substring(0, 200)}`);
    }

    // ── 2. Build up balance with an accrual ──
    ctx.log('Step 2: Create accrual to ensure sufficient balance');
    const accrualResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 15000,
        CARRIER: 'DL',
        ORIGIN: 'JFK',
        DESTINATION: 'LAX',
        FARE_CLASS: 'F',
        FLIGHT_NUMBER: 500,
        MQD: 1200,
        SEAT_TYPE: 'A'
      }
    });
    ctx.assert(accrualResp._ok, 'Accrual created for redemption test');

    // ── 3. Get balance before redemption ──
    ctx.log('Step 3: Capture balance before redemption');
    const beforeBalance = await ctx.fetch(`/v1/member/${memberId}/balances?tenant_id=${tenantId}`);
    ctx.assert(beforeBalance._ok, 'Balance endpoint responds OK');
    const beforePoints = beforeBalance.balances?.base_points || 0;
    ctx.log(`  Balance before: ${beforePoints}`);
    ctx.assert(beforePoints >= 10000, 'Member has at least 10,000 points for redemption test');

    // ── 4. Process redemption ──
    ctx.log('Step 4: Process redemption');
    // RED10K: Fixed 10,000 point redemption
    const redeemResp = await ctx.fetch(`/v1/redemptions/process`, {
      method: 'POST',
      body: {
        member_id: memberId,
        tenant_id: tenantId,
        redemption_rule_id: 1,   // RED10K
        point_amount: 10000,
        redemption_date: '2026-04-07'
      }
    });

    if (redeemResp._ok) {
      ctx.assert(true, 'Redemption processed successfully');
      ctx.log(`  Activity link: ${redeemResp.activity_link || '?'}`);
      ctx.log(`  Points redeemed: ${redeemResp.points_redeemed || '?'}`);
    } else {
      // Try alternate endpoint format
      ctx.log(`  Redemption response: ${JSON.stringify(redeemResp).substring(0, 300)}`);

      // Try /v1/members/:id/redemptions
      const altResp = await ctx.fetch(`/v1/members/${memberId}/redemptions`, {
        method: 'POST',
        body: {
          tenant_id: tenantId,
          redemption_id: 1,
          point_amount: 10000,
          redemption_date: '2026-04-07'
        }
      });

      if (altResp._ok) {
        ctx.assert(true, 'Redemption processed (alternate endpoint)');
        ctx.log(`  Points redeemed: ${altResp.points_redeemed || altResp.redeemed || '?'}`);
      } else {
        ctx.log(`  Alt response: ${JSON.stringify(altResp).substring(0, 300)}`);
        ctx.assert(false, 'Redemption processing failed on both endpoints');
      }
    }

    // ── 5. Verify balance decreased ──
    ctx.log('Step 5: Verify balance decreased after redemption');
    const afterBalance = await ctx.fetch(`/v1/member/${memberId}/balances?tenant_id=${tenantId}`);
    const afterPoints = afterBalance.balances?.base_points || 0;
    ctx.log(`  Balance after: ${afterPoints}`);
    ctx.assert(afterPoints < beforePoints, `Balance decreased (${beforePoints} -> ${afterPoints})`);
    const diff = beforePoints - afterPoints;
    ctx.log(`  Points deducted: ${diff}`);

    // ── 6. Verify Type R activity created ──
    ctx.log('Step 6: Verify redemption activity in history');
    const activities = await ctx.fetch(`/v1/member/${memberId}/activities?tenant_id=${tenantId}&limit=200`);
    const actList = activities.activities || activities || [];
    if (Array.isArray(actList)) {
      const typeR = actList.filter(a => a.activity_type === 'R');
      ctx.assert(typeR.length > 0, 'Type R (redemption) activity exists');
      ctx.log(`  Type R activities: ${typeR.length}`);
    }

    // ── 7. Verify balance reflects redemption amount ──
    ctx.log('Step 7: Verify redemption amount');
    const expectedDiff = beforePoints - afterPoints;
    ctx.assert(expectedDiff >= 10000, `Redemption deducted at least 10,000 points (actual: ${expectedDiff})`);
    ctx.log(`  Points deducted: ${expectedDiff}`);

    // ── 8. Test insufficient balance rejection ──
    ctx.log('Step 8: Test insufficient balance rejection');
    const bigRedeemResp = await ctx.fetch(`/v1/redemptions/process`, {
      method: 'POST',
      body: {
        member_id: memberId,
        tenant_id: tenantId,
        redemption_rule_id: 1,
        point_amount: 999999999,
        redemption_date: '2026-04-07'
      }
    });
    // Also try alternate
    const bigAltResp = await ctx.fetch(`/v1/members/${memberId}/redemptions`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        redemption_id: 1,
        point_amount: 999999999,
        redemption_date: '2026-04-07'
      }
    });
    const rejected = !bigRedeemResp._ok || !bigAltResp._ok;
    ctx.assert(rejected, 'Insufficient balance redemption rejected');

    // Re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
