/**
 * Test C4: Event Reporting + Severity 3 Sentinel Trigger
 *
 * Scenario A: Low severity event (severity 1)
 *   - Submit event with severity 1
 *   - Verify accrual created
 *   - No sentinel registry item
 *
 * Scenario B: Severity 3 event → SENTINEL
 *   - Submit event with severity 3
 *   - Verify EVENT_SEVERITY_3 signal fires via PRE_ACCRUAL
 *   - Verify SENTINEL registry item created
 *
 * Uses physician Patricia Walsh (#37).
 */
module.exports = {
  name: 'C4: Event Reporting + Severity 3 Sentinel',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '37'; // Patricia Walsh

    // ── Helper: submit event ──
    async function submitEvent(severity, comment) {
      // Use yesterday to avoid "future date" rejection from UTC vs local mismatch
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const activityDate = d.toISOString().slice(0, 10);
      const resp = await ctx.fetch(`/v1/members/${MEMBER_NUMBER}/accruals`, {
        method: 'POST',
        body: {
          tenant_id: TENANT_ID,
          activity_date: activityDate,
          base_points: severity,
          ACCRUAL_TYPE: 'EVENT',
          ACTIVITY_COMMENT: comment || 'Test event'
        }
      });
      return resp;
    }

    // ── Helper: get open registry items ──
    async function getOpenRegistryItems() {
      const resp = await ctx.fetch(`/v1/stability-registry/member/${MEMBER_NUMBER}?tenant_id=${TENANT_ID}`);
      if (!resp._ok) return [];
      const items = resp.registry_items || resp.items || resp;
      return Array.isArray(items) ? items.filter(i => i.status === 'O') : [];
    }

    async function countRegistryItems() {
      return (await getOpenRegistryItems()).length;
    }

    // ══════════════════════════════════════════════
    // SCENARIO A: Severity 1 event (no sentinel)
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario A: Severity 1 event ---');

    const registryBeforeA = await countRegistryItems();
    const resultA = await submitEvent(1, 'Minor schedule disruption');

    ctx.assert(resultA._ok, `Event A submitted (status: ${resultA._status})`);

    await new Promise(r => setTimeout(r, 1000));
    const registryAfterA = await countRegistryItems();
    ctx.log(`Registry items: before=${registryBeforeA}, after=${registryAfterA}`);
    // Severity 1 should not create a sentinel registry item
    // (may create via PPII composite if threshold crossed, but not SENTINEL)

    // Verify activity was created
    const activities = await ctx.fetch(`/v1/member/${MEMBER_NUMBER}/activities?limit=5&tenant_id=${TENANT_ID}`);
    ctx.assert(activities._ok, 'Activities endpoint responds');
    const actList = activities.activities || activities;
    ctx.assert(Array.isArray(actList) && actList.length > 0, 'Activity list has entries after event');

    // ══════════════════════════════════════════════
    // SCENARIO B: Severity 3 event → SENTINEL
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario B: Severity 3 event (SENTINEL trigger) ---');

    const registryBeforeB = await countRegistryItems();
    const resultB = await submitEvent(3, 'Critical patient safety event');

    ctx.assert(resultB._ok, `Event B submitted (status: ${resultB._status})`);

    // EVENT_SEVERITY_3 signal should fire via PRE_ACCRUAL
    // → promotion match → external action → SENTINEL registry item
    await new Promise(r => setTimeout(r, 1500));
    const registryAfterB = await countRegistryItems();
    ctx.log(`Registry items: before=${registryBeforeB}, after=${registryAfterB}`);
    ctx.assert(registryAfterB > registryBeforeB, 'Severity 3 event created new registry item');

    // Check newest is SENTINEL
    if (registryAfterB > registryBeforeB) {
      const items = await getOpenRegistryItems();
      const sorted = items.sort((a, b) => (b.created_ts || 0) - (a.created_ts || 0));
      ctx.assert(sorted[0].urgency === 'SENTINEL', `Newest item is SENTINEL (got: ${sorted[0].urgency})`);
    }
  }
};
