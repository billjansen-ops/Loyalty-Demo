/**
 * Core Platform Test: Activity Deletion Cascade
 * Tests that deleting a base activity (Type A) correctly:
 * - Reverses base points from bucket
 * - Deletes/reverses child bonus activities (Type N)
 * - Rolls back promotion progress
 * Uses Delta airline tenant (tenant_id=1), member 1002.
 */
module.exports = {
  name: 'Core: Activity Delete Cascade',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1002';

    // ── Login as DeltaCSR ──
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });

    // ── 1. Get baseline state ──
    ctx.log('Step 1: Capture baseline');
    const beforeBalance = await ctx.fetch(`/v1/member/${memberId}/balances?tenant_id=${tenantId}`);
    const beforePoints = beforeBalance.balances?.base_points || 0;
    ctx.log(`  Balance: ${beforePoints}`);

    const beforeActivities = await ctx.fetch(`/v1/member/${memberId}/activities?tenant_id=${tenantId}&limit=200`);
    const beforeCount = (beforeActivities.activities || beforeActivities || []).length;
    ctx.log(`  Activities: ${beforeCount}`);

    // Get promotion state
    const beforePromos = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const beforePromoList = beforePromos.promotions || beforePromos || [];
    const beforeDiamond = Array.isArray(beforePromoList) ? beforePromoList.find(p => p.promotion_code === 'DIAMONDMEDALLION') : null;
    const beforeProgress = beforeDiamond ? Number(beforeDiamond.progress_counter || 0) : 0;
    ctx.log(`  DIAMONDMEDALLION progress: ${beforeProgress}`);

    // ── 2. Create accrual that triggers bonuses + promotion ──
    ctx.log('Step 2: Create accrual with bonuses and promotion');
    const accrualResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 5000,
        CARRIER: 'DL', ORIGIN: 'MSP', DESTINATION: 'HNL',
        FARE_CLASS: 'F', FLIGHT_NUMBER: 888, MQD: 1000, SEAT_TYPE: 'A'
      }
    });
    ctx.assert(accrualResp._ok, 'Accrual created');
    const activityLink = accrualResp.link;
    const bonusCount = accrualResp.bonuses_awarded || 0;
    const bonuses = accrualResp.bonuses || [];
    ctx.log(`  Activity: ${activityLink}`);
    ctx.log(`  Base: 5000, Bonuses: ${bonusCount}`);
    for (const b of bonuses) ctx.log(`    ${b.bonus_code}: ${b.bonus_points}`);

    // Calculate total points from this accrual (base + all bonuses)
    const totalBonusPoints = bonuses.reduce((sum, b) => sum + (b.bonus_points || 0), 0);
    const totalPointsAdded = 5000 + totalBonusPoints;
    ctx.log(`  Total points added: ${totalPointsAdded} (5000 base + ${totalBonusPoints} bonus)`);

    // ── 3. Verify state after accrual ──
    ctx.log('Step 3: Verify state after accrual');
    const midBalance = await ctx.fetch(`/v1/member/${memberId}/balances?tenant_id=${tenantId}`);
    const midPoints = midBalance.balances?.base_points || 0;
    ctx.assertEqual(midPoints - beforePoints, totalPointsAdded, `Balance increased by ${totalPointsAdded}`);

    // Check promotion advanced
    const midPromos = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const midPromoList = midPromos.promotions || midPromos || [];
    const midDiamond = Array.isArray(midPromoList) ? midPromoList.find(p => p.promotion_code === 'DIAMONDMEDALLION') : null;
    const midProgress = midDiamond ? Number(midDiamond.progress_counter || 0) : 0;
    ctx.log(`  DIAMONDMEDALLION progress: ${beforeProgress} -> ${midProgress}`);
    if (midProgress > beforeProgress) {
      ctx.assert(true, 'Promotion progress advanced after accrual');
    } else {
      ctx.log('  Note: Promotion did not advance — may already be qualified or criteria not met');
    }

    // ── 4. DELETE the base activity ──
    ctx.log('Step 4: Delete base activity — should cascade');
    ctx.assert(activityLink, 'Have activity link to delete');

    const deleteResp = await ctx.fetch(`/v1/activities/${encodeURIComponent(activityLink)}`, {
      method: 'DELETE'
    });
    ctx.assert(deleteResp._ok || deleteResp.success, 'Activity deleted successfully');
    ctx.log(`  Delete response: type=${deleteResp.activity_type}, points_adjusted=${deleteResp.points_adjusted}`);

    // ── 5. Verify base points reversed ──
    ctx.log('Step 5: Verify base points reversed');
    const afterBalance = await ctx.fetch(`/v1/member/${memberId}/balances?tenant_id=${tenantId}`);
    const afterPoints = afterBalance.balances?.base_points || 0;
    ctx.assertEqual(afterPoints, beforePoints, `Balance restored to ${beforePoints} (got ${afterPoints})`);
    ctx.log(`  Balance: ${midPoints} -> ${afterPoints} (expected ${beforePoints})`);

    // ── 6. Verify bonus activities deleted/reversed ──
    ctx.log('Step 6: Verify bonus activities reversed');
    // The bonus activities (Type N) should be soft-deleted
    // The total points should reflect both base and bonus reversal
    const pointsDiff = midPoints - afterPoints;
    ctx.assertEqual(pointsDiff, totalPointsAdded, `Total ${totalPointsAdded} points reversed (base + bonuses)`);
    ctx.log(`  Points reversed: ${pointsDiff} (5000 base + ${totalBonusPoints} bonus)`);

    // ── 7. Verify promotion progress rolled back ──
    ctx.log('Step 7: Verify promotion progress rolled back');
    const afterPromos = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const afterPromoList = afterPromos.promotions || afterPromos || [];
    const afterDiamond = Array.isArray(afterPromoList) ? afterPromoList.find(p => p.promotion_code === 'DIAMONDMEDALLION') : null;
    const afterProgress = afterDiamond ? Number(afterDiamond.progress_counter || 0) : 0;
    ctx.log(`  DIAMONDMEDALLION progress: ${midProgress} -> ${afterProgress}`);
    if (midProgress > beforeProgress) {
      ctx.assert(afterProgress <= beforeProgress, `Promotion progress rolled back (${midProgress} -> ${afterProgress})`);
    } else {
      ctx.log('  Skipping rollback check — promotion did not advance');
    }

    // ── 8. Verify activity no longer in visible list ──
    ctx.log('Step 8: Verify activity removed from list');
    const afterActivities = await ctx.fetch(`/v1/member/${memberId}/activities?tenant_id=${tenantId}&limit=200`);
    const afterList = afterActivities.activities || afterActivities || [];
    const deleted = Array.isArray(afterList) ? afterList.find(a => a.link === activityLink || a.activity_link === activityLink) : null;
    ctx.assert(!deleted, 'Deleted activity not visible in activity list');

    // ── 9. Verify deleting nonexistent activity returns 404 ──
    ctx.log('Step 9: Delete nonexistent activity');
    const badDelete = await ctx.fetch('/v1/activities/XXXXX', { method: 'DELETE' });
    ctx.assert(badDelete._status === 404 || badDelete._status === 410, 'Nonexistent activity returns 404/410');

    // ── 10. Verify double-delete returns 410 (already deleted) ──
    ctx.log('Step 10: Double-delete returns 410');
    if (activityLink) {
      const doubleDelete = await ctx.fetch(`/v1/activities/${encodeURIComponent(activityLink)}`, { method: 'DELETE' });
      ctx.assert(doubleDelete._status === 410 || doubleDelete._status === 404, 'Double-delete returns 410/404');
    }

    // Re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
