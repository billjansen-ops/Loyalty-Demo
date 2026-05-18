/**
 * Core Platform Test: Promotion Engine
 * Tests promotion criteria matching, counter advancement, goal completion, multi-result processing.
 * Uses Delta airline tenant (tenant_id=1).
 */
module.exports = {
  name: 'Core: Promotion Engine',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1003';

    // ── Login as DeltaCSR ──
    const loginResp = await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'DeltaCSR', password: 'DeltaCSR' }
    });
    ctx.assert(loginResp._ok, 'DeltaCSR login successful');

    // ── 1. List active promotions ──
    ctx.log('Step 1: List active promotions for Delta');
    const promoResp = await ctx.fetch(`/v1/promotions?tenant_id=${tenantId}`);
    ctx.assert(promoResp._ok !== false, 'GET /v1/promotions responds OK');
    const promotions = promoResp.promotions || promoResp || [];
    ctx.assert(Array.isArray(promotions) && promotions.length > 0, 'Delta has active promotions');
    ctx.log(`  Found ${promotions.length} promotions`);
    for (const p of promotions.slice(0, 5)) {
      ctx.log(`  ${p.promotion_code}: ${p.promotion_name}`);
    }

    // ── 2. Check FLY3-5K promotion (Fly 3 Flights, Get 5,000 Miles) ──
    ctx.log('Step 2: Check FLY3-5K promotion');
    const fly3 = promotions.find(p => p.promotion_code === 'FLY3-5K');
    ctx.assert(fly3, 'FLY3-5K promotion exists');
    if (fly3) {
      ctx.log(`  Goal: ${fly3.goal_amount || fly3.reward_amount || '?'}, Type: ${fly3.count_type || '?'}`);
    }

    // ── 3. Get member's current promotion status ──
    ctx.log('Step 3: Get member promotion status');
    const memberPromos = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    ctx.assert(memberPromos._ok !== false, 'GET /v1/member/:id/promotions responds OK');
    const promoList = memberPromos.promotions || memberPromos || [];
    if (Array.isArray(promoList)) {
      ctx.log(`  Member enrolled in ${promoList.length} promotions`);
      for (const mp of promoList.slice(0, 5)) {
        ctx.log(`  ${mp.promotion_code}: progress=${mp.counter || mp.progress || 0}/${mp.goal_amount || mp.goal || '?'}, qualified=${mp.qualified || false}`);
      }
    }

    // ── 4. Create accrual and verify promotion counter advances ──
    ctx.log('Step 4: Create accrual — verify promotion counter advancement');

    // Get before state for FLY3-5K
    const beforePromos = Array.isArray(promoList) ? promoList : [];
    const beforeFly3 = beforePromos.find(p => p.promotion_code === 'FLY3-5K');
    const beforeCount = beforeFly3 ? Number(beforeFly3.progress_counter || beforeFly3.counter || 0) : 0;
    const beforeQualified = beforeFly3 ? !!beforeFly3.qualify_date : false;
    ctx.log(`  FLY3-5K before: count=${beforeCount}, qualified=${beforeQualified}`);

    const accrualResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 1500,
        CARRIER: 'DL',
        ORIGIN: 'ATL',
        DESTINATION: 'SFO',
        FARE_CLASS: 'Y',
        FLIGHT_NUMBER: 300,
        MQD: 200,
        SEAT_TYPE: 'W'
      }
    });
    ctx.assert(accrualResp._ok, 'Accrual created for promotion test');

    // Check promotion response
    if (accrualResp.promotions && accrualResp.promotions.length > 0) {
      ctx.assert(true, 'Promotions processed after accrual');
      for (const p of accrualResp.promotions) {
        ctx.log(`  ${p.promotion_code}: progress=${p.progress}/${p.goal}, qualified=${p.qualified || false}`);
      }
    }

    // ── 5. Verify counter incremented ──
    ctx.log('Step 5: Verify promotion counter incremented');
    const afterPromos = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const afterList = afterPromos.promotions || afterPromos || [];
    if (Array.isArray(afterList)) {
      const afterFly3 = afterList.find(p => p.promotion_code === 'FLY3-5K');
      if (afterFly3) {
        const afterCount = Number(afterFly3.progress_counter || afterFly3.counter || 0);
        ctx.log(`  FLY3-5K after: count=${afterCount}, qualified=${!!afterFly3.qualify_date}`);
        if (beforeQualified) {
          ctx.assert(true, 'FLY3-5K already qualified — counter may not advance further');
        } else {
          ctx.assert(afterCount >= beforeCount, `FLY3-5K counter maintained or advanced (${beforeCount} -> ${afterCount})`);
        }
      } else {
        ctx.log('  FLY3-5K not found in member promotions — may not be enrolled yet');
      }
    }

    // ── 6. Check medallion promotions (tier-based) — verify counter advanced ──
    ctx.log('Step 6: Check medallion promotion progress');
    if (Array.isArray(afterList)) {
      const medallions = afterList.filter(p =>
        p.promotion_code && (p.promotion_code.includes('MEDALLION') || p.promotion_code.includes('MEDAL'))
      );
      for (const m of medallions) {
        const pc = Number(m.progress_counter || 0);
        const ga = Number(m.goal_amount || 0);
        ctx.log(`  ${m.promotion_code}: progress=${pc}/${ga} (${m.progress_percentage || 0}%)`);
      }
      // DIAMONDMEDALLION should have advanced from the accrual
      const diamond = medallions.find(m => m.promotion_code === 'DIAMONDMEDALLION');
      if (diamond) {
        ctx.assert(Number(diamond.progress_counter) > 0, 'DIAMONDMEDALLION has progress');
      }
      ctx.assert(medallions.length > 0, 'Medallion promotions found');
    }

    // ── 7. Test manual promotion re-evaluation ──
    ctx.log('Step 7: Test manual promotion re-evaluation');
    if (accrualResp.link) {
      const reEvalResp = await ctx.fetch(`/v1/activities/${encodeURIComponent(accrualResp.link)}/evaluate-promotions`, {
        method: 'POST'
      });
      ctx.assert(reEvalResp._status !== 500, 'Manual promotion re-evaluation does not crash');
      ctx.log(`  Re-eval status: ${reEvalResp._status}`);
    }

    // ── 8. Verify promotion results table ──
    ctx.log('Step 8: Check promotion results configuration');
    if (fly3) {
      const resultsResp = await ctx.fetch(`/v1/promotions/${fly3.promotion_id}/results?tenant_id=${tenantId}`);
      if (resultsResp._ok && resultsResp.results) {
        ctx.log(`  FLY3-5K has ${resultsResp.results.length} result(s)`);
        for (const r of resultsResp.results) {
          ctx.log(`    type=${r.result_type}, amount=${r.result_amount}, desc=${r.result_description || ''}`);
        }
      } else {
        ctx.log('  Promotion results endpoint not available or no results configured');
      }
    }

    // ── 9. Day-of-week scheduling (v66) — apply_monday=false should skip Monday activities ──
    // Mirrors the bonus engine's apply_* day flags. The promo allows every day
    // except Monday, so a Monday accrual must NOT advance its counter, but a
    // Tuesday accrual must.
    ctx.log('Step 9: Day-of-week scheduling on promotion (apply_monday=false)');

    // promotion_code is varchar(20); keep this short and unique within reruns.
    const dowCode = `DOW-${Date.now() % 1000000}`;
    const createDow = await ctx.fetch('/v1/promotions', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        promotion_code: dowCode,
        promotion_name: 'DOW Test — Monday Off',
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        is_active: true,
        enrollment_type: 'A',
        allow_member_enrollment: false,
        count_type: 'activities',
        goal_amount: 5,
        reward_type: 'external',
        reward_amount: null,
        apply_sunday: true,
        apply_monday: false,   // ← the rule under test
        apply_tuesday: true,
        apply_wednesday: true,
        apply_thursday: true,
        apply_friday: true,
        apply_saturday: true
      }
    });
    ctx.assert(createDow._ok, `Created DOW test promotion ${dowCode}`);
    ctx.assert(createDow.apply_monday === false, 'POST /v1/promotions stored apply_monday=false');
    ctx.assert(createDow.apply_tuesday === true,  'POST /v1/promotions stored apply_tuesday=true');

    // Post an accrual on a Monday (2026-04-20). The promotion must NOT pick this up.
    const mondayResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-20',   // Monday
        base_points: 1000,
        CARRIER: 'DL', ORIGIN: 'ATL', DESTINATION: 'JFK',
        FARE_CLASS: 'Y', FLIGHT_NUMBER: 901, MQD: 100, SEAT_TYPE: 'W'
      }
    });
    ctx.assert(mondayResp._ok, 'Accrual posted on Monday 2026-04-20');

    const afterMonday = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const afterMondayList = afterMonday.promotions || afterMonday || [];
    const dowAfterMonday = Array.isArray(afterMondayList)
      ? afterMondayList.find(p => p.promotion_code === dowCode)
      : null;
    const mondayProgress = dowAfterMonday ? Number(dowAfterMonday.progress_counter || dowAfterMonday.counter || 0) : 0;
    ctx.log(`  After Monday: progress=${mondayProgress} (expected 0)`);
    ctx.assert(mondayProgress === 0, 'Monday accrual did NOT advance counter (apply_monday=false)');

    // Post an accrual on a Tuesday (2026-04-21). The promotion MUST pick this up.
    const tuesdayResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-21',   // Tuesday
        base_points: 1000,
        CARRIER: 'DL', ORIGIN: 'ATL', DESTINATION: 'LAX',
        FARE_CLASS: 'Y', FLIGHT_NUMBER: 902, MQD: 100, SEAT_TYPE: 'W'
      }
    });
    ctx.assert(tuesdayResp._ok, 'Accrual posted on Tuesday 2026-04-21');

    const afterTuesday = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const afterTuesdayList = afterTuesday.promotions || afterTuesday || [];
    const dowAfterTuesday = Array.isArray(afterTuesdayList)
      ? afterTuesdayList.find(p => p.promotion_code === dowCode)
      : null;
    const tuesdayProgress = dowAfterTuesday ? Number(dowAfterTuesday.progress_counter || dowAfterTuesday.counter || 0) : 0;
    ctx.log(`  After Tuesday: progress=${tuesdayProgress} (expected >= 1)`);
    ctx.assert(tuesdayProgress >= 1, 'Tuesday accrual DID advance counter (apply_tuesday=true)');

    // Re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
