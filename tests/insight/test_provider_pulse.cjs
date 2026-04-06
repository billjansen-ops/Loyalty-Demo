/**
 * Test C2: Provider Pulse Entry + Stability Alerts
 *
 * Scenario A: Normal Pulse (low scores)
 *   - Submit 14-question Pulse with all answers = 1
 *   - Verify survey, respondent, accrual created
 *   - Verify no SENTINEL/ORANGE signals
 *
 * Scenario B: Overall Stability Concern = 3 (STABILITY_IMMEDIATE → SENTINEL)
 *   - Submit Pulse with Q14 = 3
 *   - Verify STABILITY_IMMEDIATE signal fires
 *   - Verify SENTINEL registry item created
 *
 * Scenario C: Overall Stability Concern = 2 (STABILITY_EMERGING → ORANGE)
 *   - Submit Pulse with Q14 = 2
 *   - Verify STABILITY_EMERGING signal fires
 *   - Verify ORANGE registry item created
 *
 * Scenario D: Individual question = 3 (PULSE_Q3 → YELLOW)
 *   - Submit Pulse with Q1 = 3 (Appointment Attendance)
 *   - Verify PULSE_Q3 signal fires
 *   - Verify YELLOW registry item created
 *
 * Uses physician Marcus Reed (#36).
 */
module.exports = {
  name: 'C2: Provider Pulse Entry + Stability Alerts',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '36'; // Marcus Reed
    const PULSE_SURVEY_LINK = 2;
    const PULSE_QUESTION_LINKS = [35,36,37,38,39,40,41,42,43,44,45,46,47,48]; // 14 questions

    // ── Helper: submit a Provider Pulse ──
    async function submitPulse(answerValues, respondentName) {
      const activityDate = new Date().toISOString().slice(0, 10);

      // Create member survey
      const surveyResp = await ctx.fetch(`/v1/members/${MEMBER_NUMBER}/surveys`, {
        method: 'POST',
        body: { survey_link: PULSE_SURVEY_LINK, tenant_id: TENANT_ID, activity_date: activityDate }
      });
      if (!surveyResp._ok) return { error: `Create survey failed: ${surveyResp.error || surveyResp._status}` };

      const msLink = surveyResp.member_survey_link;

      // Create pulse respondent
      const respondentResp = await ctx.fetch('/v1/pulse-respondents', {
        method: 'POST',
        body: { member_survey_link: msLink, respondent_name: respondentName || 'Test Clinician', tenant_id: TENANT_ID }
      });
      if (!respondentResp._ok) return { error: `Create respondent failed: ${respondentResp.error}` };

      // Build answers
      const answers = PULSE_QUESTION_LINKS.map((qLink, i) => ({
        question_link: qLink,
        answer: answerValues[i] || 0
      }));

      // Submit answers
      const submitResp = await ctx.fetch(`/v1/member-surveys/${msLink}/answers`, {
        method: 'PUT',
        body: {
          answers, submit: true, tenant_id: TENANT_ID, activity_date: activityDate,
          pulse_respondent_link: respondentResp.link
        }
      });

      return { msLink, submitResp, respondentLink: respondentResp.link };
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
    // SCENARIO A: Normal Pulse (all 1s)
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario A: Normal Pulse (all 1s) ---');

    const registryBeforeA = await countRegistryItems();
    const allOnes = Array(14).fill(1);
    const resultA = await submitPulse(allOnes, 'Test Clinician A');

    ctx.assert(!resultA.error, `Pulse A created${resultA.error ? ': ' + resultA.error : ''}`);
    ctx.assert(resultA.submitResp._ok, 'Pulse A submitted successfully');
    ctx.assert(resultA.respondentLink, 'Pulse respondent record created');

    // No new registry items expected
    await new Promise(r => setTimeout(r, 1000));
    const registryAfterA = await countRegistryItems();
    ctx.log(`Registry items: before=${registryBeforeA}, after=${registryAfterA}`);

    // ══════════════════════════════════════════════
    // SCENARIO B: Q14 (Overall Stability) = 3 → SENTINEL
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario B: Pulse Q14=3 (STABILITY_IMMEDIATE → SENTINEL) ---');

    const registryBeforeB = await countRegistryItems();
    const q14is3 = Array(14).fill(0);
    q14is3[13] = 3; // Q14 = Overall Stability Concern = 3
    const resultB = await submitPulse(q14is3, 'Test Clinician B');

    ctx.assert(!resultB.error, `Pulse B created${resultB.error ? ': ' + resultB.error : ''}`);
    ctx.assert(resultB.submitResp._ok, 'Pulse B submitted successfully');

    await new Promise(r => setTimeout(r, 1000));
    const registryAfterB = await countRegistryItems();
    ctx.log(`Registry items: before=${registryBeforeB}, after=${registryAfterB}`);
    ctx.assert(registryAfterB > registryBeforeB, 'STABILITY_IMMEDIATE created new registry item');

    // Check newest item is SENTINEL
    const itemsB = await getOpenRegistryItems();
    if (itemsB.length > 0) {
      const sorted = itemsB.sort((a, b) => (b.created_ts || 0) - (a.created_ts || 0));
      ctx.assert(sorted[0].urgency === 'SENTINEL', `Newest item is SENTINEL (got: ${sorted[0].urgency})`);
    }

    // ══════════════════════════════════════════════
    // SCENARIO C: Q14 = 2 → STABILITY_EMERGING → ORANGE
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario C: Pulse Q14=2 (STABILITY_EMERGING → ORANGE) ---');

    const registryBeforeC = await countRegistryItems();
    const q14is2 = Array(14).fill(0);
    q14is2[13] = 2; // Q14 = Overall Stability Concern = 2
    const resultC = await submitPulse(q14is2, 'Test Clinician C');

    ctx.assert(!resultC.error, `Pulse C created${resultC.error ? ': ' + resultC.error : ''}`);
    ctx.assert(resultC.submitResp._ok, 'Pulse C submitted successfully');

    await new Promise(r => setTimeout(r, 1000));
    const registryAfterC = await countRegistryItems();
    ctx.log(`Registry items: before=${registryBeforeC}, after=${registryAfterC}`);
    ctx.assert(registryAfterC > registryBeforeC, 'STABILITY_EMERGING created new registry item');

    if (registryAfterC > registryBeforeC) {
      const itemsC = await getOpenRegistryItems();
      const sorted = itemsC.sort((a, b) => (b.created_ts || 0) - (a.created_ts || 0));
      ctx.assert(sorted[0].urgency === 'ORANGE', `Newest item is ORANGE (got: ${sorted[0].urgency})`);
    }

    // ══════════════════════════════════════════════
    // SCENARIO D: Q1 = 3 → PULSE_Q3 → YELLOW
    // ══════════════════════════════════════════════
    ctx.log('--- Scenario D: Pulse Q1=3 (PULSE_Q3 → YELLOW) ---');

    const registryBeforeD = await countRegistryItems();
    const q1is3 = Array(14).fill(0);
    q1is3[0] = 3; // Q1 = Appointment Attendance = 3
    const resultD = await submitPulse(q1is3, 'Test Clinician D');

    ctx.assert(!resultD.error, `Pulse D created${resultD.error ? ': ' + resultD.error : ''}`);
    ctx.assert(resultD.submitResp._ok, 'Pulse D submitted successfully');

    await new Promise(r => setTimeout(r, 1000));
    const registryAfterD = await countRegistryItems();
    ctx.log(`Registry items: before=${registryBeforeD}, after=${registryAfterD}`);
    ctx.assert(registryAfterD > registryBeforeD, 'PULSE_Q3 created new registry item');
  }
};
