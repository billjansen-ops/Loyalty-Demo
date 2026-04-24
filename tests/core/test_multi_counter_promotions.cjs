/**
 * Core Platform Test: Multi-Counter Promotions (v56)
 * Creates promotions with >1 counter and verifies AND/OR joiner qualification.
 * Uses Delta airline tenant (tenant_id=1).
 */
module.exports = {
  name: 'Core: Multi-Counter Promotions',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1003'; // same test member as test_promotion_engine

    await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'DeltaCSR', password: 'DeltaCSR' }
    });
    ctx.log('Logged in as DeltaCSR');

    // ── 1. Create an OR-joiner multi-counter promo: 1 activity OR 10000 miles ──
    ctx.log('Step 1: Create multi-counter OR promotion');
    const orPromoCode = `MC-OR-${Date.now()}`;
    const createOrResp = await ctx.fetch('/v1/promotions', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        promotion_code: orPromoCode,
        promotion_name: 'Multi-Counter OR Test',
        promotion_description: 'Complete 1 flight OR earn 3000 miles',
        start_date: '2020-01-01',
        end_date: '2030-12-31',
        is_active: true,
        enrollment_type: 'A',
        allow_member_enrollment: false,
        reward_type: 'external',
        reward_amount: null,
        counter_joiner: 'OR',
        counters: [
          { count_type: 'activities', goal_amount: 1, sort_order: 0 },
          { count_type: 'miles', goal_amount: 3000, sort_order: 1 }
        ],
        // Legacy single-counter mirror fields
        count_type: 'activities',
        goal_amount: 1,
        process_limit_count: 1
      }
    });
    ctx.assert(createOrResp._ok, 'POST /v1/promotions accepts OR multi-counter');
    const orPromoId = createOrResp.promotion_id;
    ctx.log(`  Created OR promotion id=${orPromoId}`);

    // ── 2. Verify GET returns the counters array ──
    const getOrResp = await ctx.fetch(`/v1/promotions/${orPromoId}?tenant_id=${tenantId}`);
    ctx.assert(Array.isArray(getOrResp.counters) && getOrResp.counters.length === 2,
      'GET /v1/promotions/:id returns 2 counters');
    ctx.assert(getOrResp.counter_joiner === 'OR', 'counter_joiner preserved as OR');
    ctx.log(`  counters: ${getOrResp.counters.map(c => `${c.goal_amount} ${c.count_type}`).join(', ')}`);

    // ── 3. Create an AND-joiner promo: 1 activity AND 10000 miles ──
    ctx.log('Step 2: Create multi-counter AND promotion');
    const andPromoCode = `MC-AND-${Date.now()}`;
    const createAndResp = await ctx.fetch('/v1/promotions', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        promotion_code: andPromoCode,
        promotion_name: 'Multi-Counter AND Test',
        promotion_description: 'Complete 1 flight AND earn 3000 miles',
        start_date: '2020-01-01',
        end_date: '2030-12-31',
        is_active: true,
        enrollment_type: 'A',
        allow_member_enrollment: false,
        reward_type: 'external',
        reward_amount: null,
        counter_joiner: 'AND',
        counters: [
          { count_type: 'activities', goal_amount: 1, sort_order: 0 },
          { count_type: 'miles', goal_amount: 3000, sort_order: 1 }
        ],
        count_type: 'activities',
        goal_amount: 1,
        process_limit_count: 1
      }
    });
    ctx.assert(createAndResp._ok, 'POST /v1/promotions accepts AND multi-counter');
    const andPromoId = createAndResp.promotion_id;
    ctx.log(`  Created AND promotion id=${andPromoId}`);

    // ── 4. Post a single short flight for member 1003 (~200 miles MSP→ORD) ──
    ctx.log('Step 3: Post single short-haul accrual');
    const accrualResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 300,
        CARRIER: 'DL',
        ORIGIN: 'MSP',
        DESTINATION: 'ORD',
        FLIGHT_NUMBER: 101,
        FARE_CLASS: 'Y',
        MQD: 50,
        SEAT_TYPE: 'W'
      }
    });
    ctx.assert(accrualResp._ok, 'Short-haul accrual created');

    // ── 5. Check promo states ──
    ctx.log('Step 4: Check OR vs AND qualification after 1 short-haul flight');
    const promosResp = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const promos = Array.isArray(promosResp) ? promosResp : (promosResp.promotions || []);

    const orPromoEnrollment = promos.find(p => p.promotion_id === orPromoId);
    ctx.assert(orPromoEnrollment, 'OR promo enrollment exists after accrual');
    if (orPromoEnrollment) {
      ctx.log(`  OR promo: qualified=${!!orPromoEnrollment.qualify_date}`);
      ctx.log(`    counters: ${orPromoEnrollment.counters.map(c => `${c.progress_counter}/${c.goal_amount} ${c.count_type}`).join(' | ')}`);
      // The activity counter should have hit 1 (goal=1); OR joiner → whole promo qualifies.
      ctx.assert(!!orPromoEnrollment.qualify_date, 'OR promo qualifies when ANY counter hits goal');
    }

    const andPromoEnrollment = promos.find(p => p.promotion_id === andPromoId);
    ctx.assert(andPromoEnrollment, 'AND promo enrollment exists after accrual');
    if (andPromoEnrollment) {
      ctx.log(`  AND promo: qualified=${!!andPromoEnrollment.qualify_date}`);
      ctx.log(`    counters: ${andPromoEnrollment.counters.map(c => `${c.progress_counter}/${c.goal_amount} ${c.count_type}`).join(' | ')}`);
      // Activity counter hits 1, miles counter only ~200 (goal 10000) — AND not yet satisfied.
      ctx.assert(!andPromoEnrollment.qualify_date, 'AND promo does NOT qualify when only one counter hits goal');
      const activityCounter = andPromoEnrollment.counters.find(c => c.count_type === 'activities');
      const milesCounter = andPromoEnrollment.counters.find(c => c.count_type === 'miles');
      ctx.assert(activityCounter && Number(activityCounter.progress_counter) >= 1, 'AND activity counter reached goal');
      ctx.assert(milesCounter && Number(milesCounter.progress_counter) < 3000, 'AND miles counter still below goal');
    }

    // ── 6. Post a long-haul flight (~10000+ miles) to push AND over the line ──
    ctx.log('Step 5: Post a long-haul accrual (LAX→HNL) to cross miles goal');
    await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-08',
        base_points: 5000,
        CARRIER: 'DL',
        ORIGIN: 'JFK',
        DESTINATION: 'LAX',
        FLIGHT_NUMBER: 102,
        FARE_CLASS: 'Y',
        MQD: 600,
        SEAT_TYPE: 'W'
      }
    });
    await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-09',
        base_points: 5500,
        CARRIER: 'DL',
        ORIGIN: 'LAX',
        DESTINATION: 'HNL',
        FLIGHT_NUMBER: 103,
        FARE_CLASS: 'Y',
        MQD: 600,
        SEAT_TYPE: 'W'
      }
    });

    const promosResp2 = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const promos2 = Array.isArray(promosResp2) ? promosResp2 : (promosResp2.promotions || []);
    const andAfter = promos2.find(p => p.promotion_id === andPromoId);
    if (andAfter) {
      ctx.log(`  AND promo after 3 flights: qualified=${!!andAfter.qualify_date}`);
      ctx.log(`    counters: ${andAfter.counters.map(c => `${c.progress_counter}/${c.goal_amount} ${c.count_type}`).join(' | ')}`);
      ctx.assert(!!andAfter.qualify_date, 'AND promo qualifies once ALL counters hit goal');
    }

    // Re-login as Claude for consistency with rest of suite
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
