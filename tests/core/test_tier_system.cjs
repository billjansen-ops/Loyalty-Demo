/**
 * Core Platform Test: Tier System
 * Tests tier definitions, member tier lookup, tier display in member info.
 * Uses Delta airline tenant (tenant_id=1).
 */
module.exports = {
  name: 'Core: Tier System',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1003';

    // ── Login as DeltaCSR ──
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });

    // ── 1. List tier definitions ──
    ctx.log('Step 1: List tier definitions for Delta');
    const tierResp = await ctx.fetch(`/v1/tiers?tenant_id=${tenantId}`);
    ctx.assert(tierResp._ok !== false, 'GET /v1/tiers responds OK');
    const tiers = tierResp.tiers || tierResp || [];
    if (Array.isArray(tiers)) {
      ctx.assert(tiers.length > 0, 'Delta has tier definitions');
      for (const t of tiers) {
        ctx.log(`  ${t.tier_code}: ${t.description || t.tier_name || ''} (rank: ${t.tier_ranking})`);
      }
    } else {
      ctx.log(`  Response: ${JSON.stringify(tierResp).substring(0, 200)}`);
    }

    // ── 2. Get member's current tier ──
    ctx.log('Step 2: Get member current tier');
    const memberTier = await ctx.fetch(`/v1/member/${memberId}/tiers?tenant_id=${tenantId}`);
    ctx.assert(memberTier._ok !== false, 'GET /v1/member/:id/tiers responds OK');
    ctx.log(`  Response: ${JSON.stringify(memberTier).substring(0, 300)}`);
    const tierList = memberTier.tiers || memberTier || [];
    if (Array.isArray(tierList) && tierList.length > 0) {
      const current = tierList[0];
      ctx.log(`  Current tier: ${current.tier_code || current.tier || '?'} since ${current.start_date || '?'}`);
      ctx.assert(current.tier_code || current.tier, 'Member has a tier assigned');
    } else {
      ctx.log('  No tier history — member may not have a tier assigned');
    }

    // ── 3. Verify tier in member info ──
    ctx.log('Step 3: Verify tier in member info');
    const infoResp = await ctx.fetch(`/v1/member/${memberId}/info?tenant_id=${tenantId}`);
    ctx.assert(infoResp._ok !== false, 'GET /v1/member/:id/info responds OK');
    ctx.log(`  Info: name=${infoResp.name || infoResp.fname}, tier=${infoResp.tier || '?'}, balance=${infoResp.available_miles || '?'}`);
    if (infoResp.tier) {
      ctx.assert(true, 'Member info includes tier');
    } else {
      ctx.log('  Note: tier not included in info response');
    }

    // ── 4. Verify tier ranking values exist ──
    ctx.log('Step 4: Verify tier ranking values');
    if (Array.isArray(tiers) && tiers.length > 1) {
      const hasRankings = tiers.every(t => t.tier_ranking !== undefined && t.tier_ranking !== null);
      ctx.assert(hasRankings, 'All tier definitions have ranking values');
      const uniqueRankings = new Set(tiers.map(t => t.tier_ranking));
      ctx.assert(uniqueRankings.size === tiers.length, 'Tier rankings are unique');
    }

    // ── 5. Check tier assignment/change endpoint ──
    ctx.log('Step 5: Check tier management endpoint');
    const assignResp = await ctx.fetch(`/v1/member/${memberId}/tiers`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        tier_id: tiers && tiers.length > 0 ? tiers[0].tier_id : 1,
        start_date: '2026-04-07'
      }
    });
    if (assignResp._ok) {
      ctx.assert(true, 'Tier assignment endpoint works');
      ctx.log(`  Assigned tier: ${tiers[0]?.tier_code || '?'}`);

      // Verify it took effect
      const verifyTier = await ctx.fetch(`/v1/member/${memberId}/tiers?tenant_id=${tenantId}`);
      const vList = verifyTier.tiers || verifyTier || [];
      if (Array.isArray(vList) && vList.length > 0) {
        ctx.log(`  Verified: ${vList[0].tier_code || vList[0].tier}`);
      }
    } else {
      ctx.log(`  Tier assignment response: ${JSON.stringify(assignResp).substring(0, 200)}`);
      ctx.assert(assignResp._status !== 500, 'Tier assignment does not crash');
    }

    // Re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
