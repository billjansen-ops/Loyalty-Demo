/**
 * Core Platform Test: Composite System
 * Tests adding a required molecule to a composite and verifying the accrual
 * pipeline enforces it. Then removes it and verifies accruals work without it.
 * Uses Delta airline tenant (tenant_id=1), Type A (Flight) composite.
 */
module.exports = {
  name: 'Core: Composite System',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1002';

    // ── Login as DeltaCSR ──
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });

    // ── 1. Get current composite state (Type A = Flight) ──
    ctx.log('Step 1: Read current composite (Flight Entry)');
    const cacheResp = await ctx.fetch('/v1/composites/cache');
    ctx.assert(cacheResp._ok, 'Composite cache endpoint responds OK');

    const composites = cacheResp.composites || [];
    const flightComposite = composites.find(c => c.composite_type === 'A');
    ctx.assert(flightComposite, 'Flight composite (Type A) found in cache');
    const moleculeCount = flightComposite.molecules?.length || 0;
    ctx.log(`  Current molecules: ${moleculeCount}`);
    for (const m of (flightComposite.molecules || [])) {
      ctx.log(`    ${m.molecule_key} req=${m.is_required} calc=${m.is_calculated}`);
    }

    // ── 2. Verify baseline: accrual works with current composite ──
    ctx.log('Step 2: Baseline — accrual works with current required fields');
    const baselineResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId, activity_date: '2026-04-07', base_points: 1000,
        CARRIER: 'DL', ORIGIN: 'MSP', DESTINATION: 'LAX',
        FARE_CLASS: 'Y', FLIGHT_NUMBER: 701, MQD: 200, SEAT_TYPE: 'A'
      }
    });
    ctx.assert(baselineResp._ok, 'Baseline accrual succeeds with current composite');

    // ── 3. Get the full composite details (molecule_ids) for the PUT ──
    // We need to read the DB to get molecule_ids since cache doesn't return them
    ctx.log('Step 3: Read composite details for modification');

    // Use the composites list endpoint or DB query via existing test data
    // The PUT endpoint needs the full details array. Let's build it from known data.
    const originalDetails = [
      { molecule_id: 3,  is_required: true,  is_calculated: false, calc_function: null, sort_order: 1 },   // ORIGIN
      { molecule_id: 37, is_required: true,  is_calculated: false, calc_function: null, sort_order: 2 },   // MQD
      { molecule_id: 1,  is_required: true,  is_calculated: false, calc_function: null, sort_order: 3 },   // CARRIER
      { molecule_id: 47, is_required: false, is_calculated: true,  calc_function: 'selectAircraftType', sort_order: 4 },  // AIRCRAFT_TYPE
      { molecule_id: 2,  is_required: true,  is_calculated: false, calc_function: null, sort_order: 5 },   // DESTINATION
      { molecule_id: 5,  is_required: true,  is_calculated: false, calc_function: null, sort_order: 6 },   // FLIGHT_NUMBER
      { molecule_id: 4,  is_required: true,  is_calculated: false, calc_function: null, sort_order: 7 },   // FARE_CLASS
      { molecule_id: 42, is_required: true,  is_calculated: true,  calc_function: 'calculateFlightMiles', sort_order: 8 },  // MEMBER_POINTS
      { molecule_id: 48, is_required: true,  is_calculated: false, calc_function: null, sort_order: 9 },   // SEAT_TYPE
    ];

    // ── 4. Add ACTIVITY_COMMENT (mol_id=50) as REQUIRED to the composite ──
    ctx.log('Step 4: Add ACTIVITY_COMMENT as required molecule to composite');
    const modifiedDetails = [
      ...originalDetails,
      { molecule_id: 50, is_required: true, is_calculated: false, calc_function: null, sort_order: 10 }  // ACTIVITY_COMMENT — new required field
    ];

    const putResp = await ctx.fetch('/v1/composites', {
      method: 'PUT',
      body: {
        tenant_id: tenantId,
        composite_type: 'A',
        description: 'Flight Entry',
        validate_function: null,
        point_type_molecule_id: 1,
        details: modifiedDetails
      }
    });
    ctx.assert(putResp._ok, 'Composite updated — ACTIVITY_COMMENT added as required');

    // Verify cache updated
    const updatedCache = await ctx.fetch('/v1/composites/cache');
    const updatedFlight = (updatedCache.composites || []).find(c => c.composite_type === 'A');
    const newCount = updatedFlight?.molecules?.length || 0;
    ctx.assertEqual(newCount, moleculeCount + 1, `Composite now has ${moleculeCount + 1} molecules (was ${moleculeCount})`);

    // ── 5. Accrual WITHOUT ACTIVITY_COMMENT — should FAIL ──
    ctx.log('Step 5: Accrual WITHOUT new required field — should fail');
    const failResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId, activity_date: '2026-04-07', base_points: 1000,
        CARRIER: 'DL', ORIGIN: 'MSP', DESTINATION: 'ORD',
        FARE_CLASS: 'Y', FLIGHT_NUMBER: 702, MQD: 200, SEAT_TYPE: 'A'
        // No ACTIVITY_COMMENT — should fail
      }
    });
    ctx.assert(!failResp._ok, 'Accrual without ACTIVITY_COMMENT rejected');
    if (failResp.error) {
      ctx.assert(failResp.error.includes('ACTIVITY_COMMENT'), 'Error message mentions ACTIVITY_COMMENT');
      ctx.log(`  Error: ${failResp.error}`);
    }

    // ── 6. Accrual WITH ACTIVITY_COMMENT — should PASS ──
    ctx.log('Step 6: Accrual WITH new required field — should pass');
    const passResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId, activity_date: '2026-04-07', base_points: 1000,
        CARRIER: 'DL', ORIGIN: 'MSP', DESTINATION: 'ORD',
        FARE_CLASS: 'Y', FLIGHT_NUMBER: 703, MQD: 200, SEAT_TYPE: 'A',
        ACTIVITY_COMMENT: 'Test comment for composite validation'
      }
    });
    ctx.assert(passResp._ok, 'Accrual with ACTIVITY_COMMENT succeeds');
    ctx.log(`  Activity link: ${passResp.link || '?'}`);

    // ── 7. Restore original composite (remove ACTIVITY_COMMENT) ──
    ctx.log('Step 7: Restore original composite');
    const restoreResp = await ctx.fetch('/v1/composites', {
      method: 'PUT',
      body: {
        tenant_id: tenantId,
        composite_type: 'A',
        description: 'Flight Entry',
        validate_function: null,
        point_type_molecule_id: 1,
        details: originalDetails
      }
    });
    ctx.assert(restoreResp._ok, 'Composite restored to original state');

    // Verify restoration
    const restoredCache = await ctx.fetch('/v1/composites/cache');
    const restoredFlight = (restoredCache.composites || []).find(c => c.composite_type === 'A');
    ctx.assertEqual(restoredFlight?.molecules?.length || 0, moleculeCount, `Composite restored to ${moleculeCount} molecules`);

    // ── 8. Verify accrual works again without ACTIVITY_COMMENT ──
    ctx.log('Step 8: Verify accrual works without ACTIVITY_COMMENT after restore');
    const afterRestore = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId, activity_date: '2026-04-07', base_points: 1000,
        CARRIER: 'DL', ORIGIN: 'JFK', DESTINATION: 'SFO',
        FARE_CLASS: 'C', FLIGHT_NUMBER: 704, MQD: 300, SEAT_TYPE: 'W'
      }
    });
    ctx.assert(afterRestore._ok, 'Accrual without ACTIVITY_COMMENT succeeds after composite restore');

    // ── 9. Test non-required molecule (optional) ──
    ctx.log('Step 9: Add ACTIVITY_COMMENT as optional — accrual should pass without it');
    const optionalDetails = [
      ...originalDetails,
      { molecule_id: 50, is_required: false, is_calculated: false, calc_function: null, sort_order: 10 }
    ];
    await ctx.fetch('/v1/composites', {
      method: 'PUT',
      body: { tenant_id: tenantId, composite_type: 'A', description: 'Flight Entry', validate_function: null, point_type_molecule_id: 1, details: optionalDetails }
    });

    const optionalResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId, activity_date: '2026-04-07', base_points: 500,
        CARRIER: 'DL', ORIGIN: 'ATL', DESTINATION: 'BOS',
        FARE_CLASS: 'Y', FLIGHT_NUMBER: 705, MQD: 100, SEAT_TYPE: 'M'
        // No ACTIVITY_COMMENT — should still pass because it's optional
      }
    });
    ctx.assert(optionalResp._ok, 'Accrual without optional ACTIVITY_COMMENT succeeds');

    // Restore composite one final time
    await ctx.fetch('/v1/composites', {
      method: 'PUT',
      body: { tenant_id: tenantId, composite_type: 'A', description: 'Flight Entry', validate_function: null, point_type_molecule_id: 1, details: originalDetails }
    });
    ctx.log('  Composite restored to original');

    // Re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
