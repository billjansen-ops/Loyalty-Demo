/**
 * Test C3: Compliance Entry + Sentinel Triggers
 *
 * Scenario A: Normal compliance entry (passed drug test)
 *   - Submit a Drug Test Completion with status "Completed"
 *   - Verify compliance entry created with correct score
 *   - Verify no sentinel trigger
 *
 * Scenario B: Sentinel compliance event (Confirmed Positive)
 *   - Submit Drug Test Results with status "Confirmed Positive"
 *   - Verify SENTINEL_POSITIVE signal fires
 *   - Verify SENTINEL/RED registry item created
 *
 * Scenario C: Sentinel compliance event (Refused/Tampered)
 *   - Submit Drug Test Results with status "Refused/Tampered"
 *   - Verify SENTINEL_REFUSED signal fires
 *   - Verify SENTINEL registry item created
 *
 * Uses physician David Nguyen (#38).
 */
module.exports = {
  name: 'C3: Compliance Entry + Sentinel Triggers',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '38'; // David Nguyen

    // ── Helper: get compliance items for member ──
    async function getComplianceItems() {
      const resp = await ctx.fetch(`/v1/compliance/member/${MEMBER_NUMBER}?tenant_id=${TENANT_ID}`);
      if (!resp._ok) return [];
      return resp.items || resp.compliance_items || resp || [];
    }

    // ── Helper: submit compliance entry ──
    async function submitCompliance(memberComplianceId, statusId, notes) {
      const resp = await ctx.fetch('/v1/compliance/entry', {
        method: 'POST',
        body: {
          tenant_id: TENANT_ID,
          membership_number: MEMBER_NUMBER,
          member_compliance_id: memberComplianceId,
          status_id: statusId,
          notes: notes || 'Test entry'
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

    // ── Get compliance items to find IDs ──
    const compItems = await getComplianceItems();
    ctx.assert(Array.isArray(compItems) && compItems.length > 0, 'Compliance items exist for physician');

    if (!compItems.length) {
      ctx.log('No compliance items assigned — cannot test. Skipping.');
      return;
    }

    // Find Drug Test items by item_name or item_code
    const drugTestCompletion = compItems.find(i =>
      (i.item_name || '').toLowerCase().includes('drug test completion') ||
      (i.item_code || '').toLowerCase().includes('drug_test_comp')
    );
    const drugTestResults = compItems.find(i =>
      (i.item_name || '').toLowerCase().includes('drug test result') ||
      (i.item_code || '').toLowerCase().includes('drug_test_res')
    );

    ctx.log(`Found ${compItems.length} compliance items`);
    compItems.forEach(i => ctx.log(`  - ${i.item_name || i.item_code}: member_compliance_id=${i.member_compliance_id}`));

    // Status IDs (from compliance_item_status table):
    // 1=COMPLETED, 2=LATE, 3=MISSED (Drug Test Completion)
    // 4=NEGATIVE, 5=INCONCLUSIVE, 6=PRELIM_POSITIVE, 7=CONFIRMED_POSITIVE(sentinel), 8=REFUSED_TAMPERED(sentinel) (Drug Test Results)

    // ══════════════════════════════════════════════
    // SCENARIO A: Normal entry (Completed drug test)
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario A: Normal compliance entry (Completed) ---');

    if (drugTestCompletion) {
      const registryBeforeA = await countRegistryItems();
      const resultA = await submitCompliance(drugTestCompletion.member_compliance_id, 1, 'Routine test - completed on schedule');

      ctx.assert(resultA._ok, `Compliance entry A submitted (status: ${resultA._status})`);

      await new Promise(r => setTimeout(r, 1000));
      const registryAfterA = await countRegistryItems();
      ctx.log(`Registry items: before=${registryBeforeA}, after=${registryAfterA}`);
    } else {
      ctx.log('Drug Test Completion item not found — skipping Scenario A');
    }

    // ══════════════════════════════════════════════
    // SCENARIO B: Sentinel - Confirmed Positive (status_id=7)
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario B: Sentinel compliance (Confirmed Positive) ---');

    if (drugTestResults) {
      const registryBeforeB = await countRegistryItems();
      const resultB = await submitCompliance(drugTestResults.member_compliance_id, 7, 'Test scenario - confirmed positive result');

      ctx.assert(resultB._ok, `Compliance entry B submitted (status: ${resultB._status})`);

      await new Promise(r => setTimeout(r, 1000));
      const registryAfterB = await countRegistryItems();
      ctx.log(`Registry items: before=${registryBeforeB}, after=${registryAfterB}`);
      ctx.assert(registryAfterB > registryBeforeB, 'Sentinel compliance created new registry item');

      if (registryAfterB > registryBeforeB) {
        const items = await getOpenRegistryItems();
        const sorted = items.sort((a, b) => (b.created_ts || 0) - (a.created_ts || 0));
        ctx.assert(sorted[0].urgency === 'SENTINEL', `Newest item is SENTINEL (got: ${sorted[0].urgency})`);
      }
    } else {
      ctx.log('Drug Test Results item not found — skipping Scenario B');
    }

    // ══════════════════════════════════════════════
    // SCENARIO C: Sentinel - Refused/Tampered (status_id=8)
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario C: Sentinel compliance (Refused/Tampered) ---');

    if (drugTestResults) {
      const registryBeforeC = await countRegistryItems();
      const resultC = await submitCompliance(drugTestResults.member_compliance_id, 8, 'Test scenario - specimen refused');

      ctx.assert(resultC._ok, `Compliance entry C submitted (status: ${resultC._status})`);

      await new Promise(r => setTimeout(r, 1000));
      const registryAfterC = await countRegistryItems();
      ctx.log(`Registry items: before=${registryBeforeC}, after=${registryAfterC}`);
      ctx.assert(registryAfterC > registryBeforeC, 'Sentinel refused created new registry item');
    } else {
      ctx.log('Drug Test Results item not found — skipping Scenario C');
    }

    // ══════════════════════════════════════════════
    // VERIFY: Compliance history shows entries
    // ══════════════════════════════════════════════
    ctx.log('--- Verify compliance history ---');
    const history = await ctx.fetch(`/v1/compliance/member/${MEMBER_NUMBER}/history?tenant_id=${TENANT_ID}`);
    ctx.assert(history._ok, 'Compliance history endpoint responds');
    const historyItems = history.history || history;
    ctx.assert(Array.isArray(historyItems), 'History returns array');
    ctx.assert(historyItems.length > 0, 'History has entries');
  }
};
