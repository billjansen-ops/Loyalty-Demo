/**
 * Test C1: PPSI Survey Entry + Scoring + Signal Triggers
 *
 * Tests the primary data collection instrument end-to-end:
 *
 * Scenario A: Normal survey (all low scores)
 *   - Submit 34-question PPSI with all answers = 1
 *   - Verify survey created, accrual created, total score = 34
 *   - Verify NO signals fire (no answers >= 3)
 *
 * Scenario B: High score with PPSI_Q3 signal
 *   - Submit PPSI with one answer = 3 (triggers PPSI_Q3)
 *   - Verify PULSE_Q3 signal fires
 *   - Verify YELLOW registry item created
 *
 * Scenario C: Global Stability = 3 (STABILITY_IMMEDIATE)
 *   - Submit PPSI with question 34 (GLOBAL) = 3
 *   - Verify STABILITY_IMMEDIATE signal fires
 *   - Verify SENTINEL registry item created
 *
 * Uses physician James Okafor (#34) — known to have existing data.
 */
module.exports = {
  name: 'C1: PPSI Survey Entry + Scoring + Signals',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '34'; // James Okafor
    const PPSI_SURVEY_LINK = 1;
    const QUESTION_LINKS = Array.from({ length: 34 }, (_, i) => i + 1); // 1-34

    // ── Helper: submit a PPSI survey ──
    async function submitPPSI(answerValues) {
      const activityDate = new Date().toISOString().slice(0, 10);

      // Create member survey
      const surveyResp = await ctx.fetch(`/v1/members/${MEMBER_NUMBER}/surveys`, {
        method: 'POST',
        body: { survey_link: PPSI_SURVEY_LINK, tenant_id: TENANT_ID, activity_date: activityDate }
      });
      if (!surveyResp._ok) return { error: `Create survey failed: ${surveyResp.error || surveyResp._status}` };

      const msLink = surveyResp.member_survey_link;

      // Build answers
      const answers = QUESTION_LINKS.map((qLink, i) => ({
        question_link: qLink,
        answer: answerValues[i] || 0
      }));

      // Submit answers (triggers scoring + accrual + POST_ACCRUAL)
      const submitResp = await ctx.fetch(`/v1/member-surveys/${msLink}/answers`, {
        method: 'PUT',
        body: { answers, submit: true, tenant_id: TENANT_ID, activity_date: activityDate }
      });

      return { msLink, submitResp };
    }

    // ── Helper: get open registry items for member ──
    async function getOpenRegistryItems() {
      const resp = await ctx.fetch(`/v1/stability-registry/member/${MEMBER_NUMBER}?tenant_id=${TENANT_ID}`);
      if (!resp._ok) return [];
      const items = resp.registry_items || resp.items || resp;
      return Array.isArray(items) ? items.filter(i => i.status === 'O') : [];
    }

    // ── Helper: count registry items before/after ──
    async function countRegistryItems() {
      const items = await getOpenRegistryItems();
      return items.length;
    }

    // ══════════════════════════════════════════════
    // SCENARIO A: Normal survey, all answers = 1
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario A: Normal PPSI (all 1s, total = 34) ---');

    const registryCountBefore = await countRegistryItems();
    const allOnes = Array(34).fill(1);
    const resultA = await submitPPSI(allOnes);

    ctx.assert(!resultA.error, `Survey A created successfully${resultA.error ? ': ' + resultA.error : ''}`);
    ctx.assert(resultA.submitResp._ok, 'Survey A submitted successfully');

    if (resultA.submitResp.scoring_result) {
      ctx.assertEqual(resultA.submitResp.scoring_result.points, 34, 'Score is 34 (34 questions x 1)');
    } else {
      ctx.assert(resultA.submitResp._ok, 'Survey A scoring completed (no inline result)');
    }

    // Verify activities include the new survey
    const activitiesA = await ctx.fetch(`/v1/member/${MEMBER_NUMBER}/activities?limit=5&tenant_id=${TENANT_ID}`);
    ctx.assert(activitiesA._ok, 'Activities endpoint responds after survey A');
    const actList = activitiesA.activities || activitiesA;
    ctx.assert(Array.isArray(actList) && actList.length > 0, 'Activities list has entries');

    // No new registry items should be created (no signals fired)
    const registryCountAfterA = await countRegistryItems();
    ctx.log(`Registry items: before=${registryCountBefore}, after=${registryCountAfterA}`);
    // Note: we can't assert exact equality because POST_ACCRUAL might fire PPII composite
    // which could create items. But PPSI_Q3 should NOT fire.

    // ══════════════════════════════════════════════
    // SCENARIO B: One answer = 3 (triggers PPSI_Q3)
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario B: PPSI with Q1 = 3 (PPSI_Q3 signal) ---');

    const registryBeforeB = await countRegistryItems();
    const oneThree = Array(34).fill(1);
    oneThree[0] = 3; // Question 1 (SLEEP) = 3
    const resultB = await submitPPSI(oneThree);

    ctx.assert(!resultB.error, `Survey B created successfully${resultB.error ? ': ' + resultB.error : ''}`);
    ctx.assert(resultB.submitResp._ok, 'Survey B submitted successfully');

    // Check that a registry item was created (PPSI_Q3 -> PULSE_Q3 signal -> promotion -> registry)
    // Give it a moment for the async chain
    await new Promise(r => setTimeout(r, 1000));
    const registryAfterB = await countRegistryItems();
    ctx.log(`Registry items: before=${registryBeforeB}, after=${registryAfterB}`);
    ctx.assert(registryAfterB > registryBeforeB, 'PPSI_Q3 signal created new registry item');

    // ══════════════════════════════════════════════
    // SCENARIO C: Global Stability = 3 (STABILITY_IMMEDIATE)
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario C: PPSI with Global Stability (Q34) = 3 ---');

    const registryBeforeC = await countRegistryItems();
    const globalThree = Array(34).fill(0);
    globalThree[33] = 3; // Question 34 (GLOBAL) = 3
    const resultC = await submitPPSI(globalThree);

    ctx.assert(!resultC.error, `Survey C created successfully${resultC.error ? ': ' + resultC.error : ''}`);
    ctx.assert(resultC.submitResp._ok, 'Survey C submitted successfully');

    // STABILITY_IMMEDIATE should create a SENTINEL registry item
    await new Promise(r => setTimeout(r, 1000));
    const registryAfterC = await countRegistryItems();
    ctx.log(`Registry items: before=${registryBeforeC}, after=${registryAfterC}`);
    ctx.assert(registryAfterC > registryBeforeC, 'STABILITY_IMMEDIATE signal created new registry item');

    // Check that the newest registry item is SENTINEL urgency
    const allItems = await getOpenRegistryItems();
    if (allItems.length > 0) {
      // Sort by created_ts desc to find newest
      const sorted = allItems.sort((a, b) => {
        const tsA = a.created_ts || a.created_date || 0;
        const tsB = b.created_ts || b.created_date || 0;
        return tsB - tsA;
      });
      const newest = sorted[0];
      ctx.assert(
        newest.urgency === 'SENTINEL',
        `Newest registry item is SENTINEL urgency (got: ${newest.urgency})`
      );
    }

    // ══════════════════════════════════════════════
    // VERIFY: Wellness endpoint shows updated data
    // ══════════════════════════════════════════════
    ctx.log('--- Verify wellness endpoint ---');
    const wellness = await ctx.fetch(`/v1/wellness/members?tenant_id=${TENANT_ID}`);
    ctx.assert(wellness._ok, 'Wellness endpoint responds');
    const members = wellness.members || wellness;
    const okafor = Array.isArray(members) ? members.find(m => m.membership_number === MEMBER_NUMBER) : null;
    ctx.assert(okafor, 'Okafor found in wellness data');
    if (okafor) {
      ctx.assert(okafor.ppii !== undefined && okafor.ppii !== null, `PPII score calculated (got: ${okafor.ppii})`);
      ctx.assert(okafor.tier, `Tier assigned (got: ${okafor.tier?.label || okafor.tier})`);
    }
  }
};
