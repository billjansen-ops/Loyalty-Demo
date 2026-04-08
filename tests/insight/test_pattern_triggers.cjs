/**
 * Test C8: Pattern-Based Triggers
 *
 * Verifies that the POST_ACCRUAL hook detects patterns and creates
 * registry items with correct reason codes.
 *
 * Tests by submitting a PPSI survey with a high score (all 3s = 102)
 * which should trigger PPII threshold signals and registry creation.
 *
 * Uses physician James Okafor (#34).
 */
module.exports = {
  name: 'C8: Pattern-Based Triggers',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '34';
    const PPSI_SURVEY_LINK = 1;
    const QUESTION_LINKS = Array.from({ length: 34 }, (_, i) => i + 1);

    // ── Helper: submit PPSI ──
    async function submitPPSI(answerValues) {
      const activityDate = new Date().toISOString().slice(0, 10);
      const surveyResp = await ctx.fetch(`/v1/members/${MEMBER_NUMBER}/surveys`, {
        method: 'POST',
        body: { survey_link: PPSI_SURVEY_LINK, tenant_id: TENANT_ID, activity_date: activityDate }
      });
      if (!surveyResp._ok) return { error: `Create survey failed: ${surveyResp.error || surveyResp._status}` };

      const msLink = surveyResp.member_survey_link;
      const answers = QUESTION_LINKS.map((qLink, i) => ({
        question_link: qLink,
        answer: answerValues[i] || 0
      }));
      const submitResp = await ctx.fetch(`/v1/member-surveys/${msLink}/answers`, {
        method: 'PUT',
        body: { answers, submit: true, tenant_id: TENANT_ID, activity_date: activityDate }
      });
      return { msLink, submitResp };
    }

    // ── Count registry items before ──
    const regBefore = await ctx.fetch(`/v1/stability-registry/member/${MEMBER_NUMBER}?tenant_id=${TENANT_ID}`);
    const itemsBefore = Array.isArray(regBefore.items || regBefore) ? (regBefore.items || regBefore) : [];
    const openBefore = itemsBefore.filter(i => i.status !== 'R').length;
    ctx.log(`Registry items before: ${itemsBefore.length} total, ${openBefore} open`);

    // ── Submit high-score PPSI (all 3s = 102, max severity) ──
    ctx.log('--- Submit max-score PPSI survey ---');
    const allThrees = Array(34).fill(3);
    const result = await submitPPSI(allThrees);
    ctx.assert(!result.error, `High-score survey created${result.error ? ': ' + result.error : ''}`);
    ctx.assert(result.submitResp._ok, 'High-score survey submitted successfully');

    // Wait for POST_ACCRUAL processing
    await new Promise(r => setTimeout(r, 1500));

    // ── Check registry items after ──
    ctx.log('--- Check registry after high-score PPSI ---');
    const regAfter = await ctx.fetch(`/v1/stability-registry/member/${MEMBER_NUMBER}?tenant_id=${TENANT_ID}`);
    ctx.assert(regAfter._ok, 'Registry endpoint responds after submission');

    const itemsAfter = Array.isArray(regAfter.items || regAfter) ? (regAfter.items || regAfter) : [];
    const openAfter = itemsAfter.filter(i => i.status !== 'R').length;
    ctx.log(`Registry items after: ${itemsAfter.length} total, ${openAfter} open`);

    // A max-score PPSI should trigger at least one registry item
    ctx.assert(itemsAfter.length > itemsBefore.length || openAfter > 0,
      'High-score PPSI created or has registry items');

    // ── Verify reason codes on recent items ──
    ctx.log('--- Verify reason codes ---');
    const validReasons = [
      'PPII_RED', 'PPII_ORANGE', 'PPII_YELLOW',
      'PPII_SPIKE', 'PPII_TREND_UP', 'PROTECTIVE_COLLAPSE',
      'PPSI_Q3', 'STABILITY_IMMEDIATE',
      'PULSE_Q3', 'SENTINEL_POSITIVE', 'SENTINEL_REFUSED',
      'EVENT_SEVERITY_3', 'EXTENDED_CARD_DETECTED',
      'SR_SENTINEL', 'SR_RED', 'SR_ORANGE', 'SR_YELLOW',
      'STABILITY_EMERGING',
      'REPEATED_MODERATE', 'MISSED_SURVEY'
    ];

    for (const item of itemsAfter) {
      if (item.reason_code) {
        ctx.assert(validReasons.includes(item.reason_code),
          `Valid reason code: ${item.reason_code}`);
      }
    }

    // ── Verify urgency levels ──
    ctx.log('--- Verify urgency levels ---');
    const validUrgency = ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'SENTINEL'];
    for (const item of itemsAfter) {
      ctx.assert(validUrgency.includes(item.urgency),
        `Valid urgency: ${item.urgency} (reason: ${item.reason_code})`);
    }

    // ── Check that high-score PPSI created SENTINEL-level items ──
    // The signal pipeline may use reason codes like SR_SENTINEL, SR_YELLOW, PPSI_Q3, etc.
    const sentinelItems = itemsAfter.filter(i => i.urgency === 'SENTINEL');
    ctx.assert(sentinelItems.length > 0, `SENTINEL urgency items exist (found: ${sentinelItems.length})`);

    // ── Check that new items were created from this submission ──
    const newItems = itemsAfter.filter(i => !itemsBefore.some(b => b.link === i.link));
    ctx.assert(newItems.length > 0, `New registry items created by high-score PPSI (found: ${newItems.length})`);
    if (newItems.length > 0) {
      ctx.log(`New item reason codes: ${newItems.map(i => i.reason_code).join(', ')}`);
    }

    // ══════════════════════════════════════════════
    // BROWSER: Verify registry shows new items
    // ══════════════════════════════════════════════
    if (!ctx.hasBrowser()) { ctx.log('Skipping browser tests — playwright not available'); return; }

    ctx.log('--- Browser: Action queue shows triggered items ---');
    try {
      const page = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/action_queue.html',
        { programId: 13, partnerId: 1 }
      );
      await page.waitForTimeout(3000);
      const pageText = await page.evaluate(() => document.body.innerText);
      const hasSentinel = pageText.includes('SENTINEL');
      ctx.assert(hasSentinel, 'Browser: Action queue shows SENTINEL items after high-score PPSI');
      await page.close();
    } catch(e) {
      ctx.assert(false, `Browser: Pattern trigger display failed — ${e.message.substring(0, 100)}`);
    }
  }
};
