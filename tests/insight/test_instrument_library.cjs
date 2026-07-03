/**
 * Insight test: Instrument library part 1 — PHQ-9 + GAD-7 (Session 130, db v96).
 *
 * Covers:
 *   - Catalog metadata: PHQ9 + GAD7 exist with purpose=screening, license=public_domain,
 *     cadence NULL (so MEDS never flags them overdue); the 8 existing instruments
 *     carry purpose=monitoring.
 *   - PHQ-9 scoring: published 0-27 bands; item 9 lives in its own PHQ9_SI category.
 *   - SAFETY CHAIN: a positive item-9 answer raises PHQ9_SI_POSITIVE →
 *     PHQ9_SI_ALERT bonus → RED stability-registry item (24h SLA), regardless of total.
 *   - A PHQ-9 with item 9 = 0 creates NO registry item.
 *   - GAD-7 scoring: published 0-21 bands, no signals.
 *
 * Uses physician James Okafor (#34), same as the PPSI survey test.
 */
module.exports = {
  name: 'Insight: Instrument library — PHQ-9 + GAD-7 (catalog, scoring, self-harm alert)',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '34'; // James Okafor

    // ── Step 1: Catalog metadata ──
    ctx.log('Step 1: Library metadata on /v1/surveys');
    const surveys = await ctx.fetch(`/v1/surveys?tenant_id=${TENANT_ID}`);
    ctx.assert(Array.isArray(surveys), 'GET /v1/surveys returns an array');
    const phq9 = surveys.find(s => s.survey_code === 'PHQ9');
    const gad7 = surveys.find(s => s.survey_code === 'GAD7');
    ctx.assert(!!phq9, 'PHQ9 survey exists');
    ctx.assert(!!gad7, 'GAD7 survey exists');
    ctx.assert(phq9 && phq9.instrument_purpose === 'screening', 'PHQ9 purpose = screening');
    ctx.assert(phq9 && phq9.license_status === 'public_domain', 'PHQ9 license = public_domain');
    ctx.assert(phq9 && phq9.cadence_days == null, 'PHQ9 cadence is NULL (MEDS-exempt)');
    ctx.assert(gad7 && gad7.instrument_purpose === 'screening' && gad7.license_status === 'public_domain',
      'GAD7 purpose/license correct');
    const ppsi = surveys.find(s => s.survey_code === 'PPSI');
    ctx.assert(ppsi && ppsi.instrument_purpose === 'monitoring', 'existing PPSI backfilled as monitoring');

    // ── Step 2: PHQ-9 questions — 9 items, item 9 in its own category ──
    ctx.log('Step 2: PHQ-9 question structure');
    const phq9Qs = await ctx.fetch(`/v1/surveys/${phq9.link}/questions?tenant_id=${TENANT_ID}`);
    ctx.assert(Array.isArray(phq9Qs) && phq9Qs.length === 9, `PHQ-9 has 9 questions (got ${phq9Qs.length})`);
    const siQ = phq9Qs.find(q => q.category_code === 'PHQ9_SI');
    ctx.assert(!!siQ, 'item 9 carries its own PHQ9_SI category');
    ctx.assert(phq9Qs.every(q => (q.answers || []).length === 4), 'every item has the 4-point frequency scale');

    // ── Helpers ──
    const activityDate = new Date().toLocaleDateString('en-CA');
    async function submitSurvey(surveyLink, answers) {
      const created = await ctx.fetch(`/v1/members/${MEMBER_NUMBER}/surveys`, {
        method: 'POST',
        body: { survey_link: surveyLink, tenant_id: TENANT_ID, activity_date: activityDate }
      });
      ctx.assert(created._ok, `member survey created for survey ${surveyLink}`);
      const submitResp = await ctx.fetch(`/v1/member-surveys/${created.member_survey_link}/answers`, {
        method: 'PUT',
        body: { answers, submit: true, tenant_id: TENANT_ID, activity_date: activityDate }
      });
      return submitResp;
    }
    async function openRegistryItems() {
      const resp = await ctx.fetch(`/v1/stability-registry/member/${MEMBER_NUMBER}?tenant_id=${TENANT_ID}`);
      if (!resp._ok) return [];
      const items = resp.registry_items || resp.items || resp;
      return Array.isArray(items) ? items.filter(i => i.status === 'O') : [];
    }

    // ── Step 3: PHQ-9, item 9 = 0 → scored, NO registry item ──
    ctx.log('Step 3: PHQ-9 mild, self-harm item 0 — no alert');
    const beforeCount = (await openRegistryItems()).length;
    const mildAnswers = phq9Qs.map(q => ({
      question_link: q.question_link,
      answer: q.category_code === 'PHQ9_SI' ? 0 : 1
    }));
    const mild = await submitSurvey(phq9.link, mildAnswers);
    ctx.assert(mild._ok, 'mild PHQ-9 submit succeeds');
    ctx.assert(mild.scoring && mild.scoring.points === 8,
      `mild PHQ-9 scores 8/27 (got ${mild.scoring && mild.scoring.points})`);
    const afterMild = (await openRegistryItems()).length;
    ctx.assert(afterMild === beforeCount, `no registry item from a clean item 9 (before ${beforeCount}, after ${afterMild})`);

    // ── Step 4: PHQ-9, item 9 positive → RED registry item ──
    ctx.log('Step 4: PHQ-9 with self-harm item positive — RED alert');
    const siAnswers = phq9Qs.map(q => ({
      question_link: q.question_link,
      answer: q.category_code === 'PHQ9_SI' ? 1 : 2
    }));
    const flagged = await submitSurvey(phq9.link, siAnswers);
    ctx.assert(flagged._ok, 'flagged PHQ-9 submit succeeds');
    ctx.assert(flagged.scoring && flagged.scoring.points === 17,
      `flagged PHQ-9 scores 17/27 (got ${flagged.scoring && flagged.scoring.points})`);
    const afterFlagged = await openRegistryItems();
    ctx.assert(afterFlagged.length === beforeCount + 1,
      `exactly one new registry item (before ${beforeCount}, after ${afterFlagged.length})`);
    const newest = afterFlagged
      .slice()
      .sort((a, b) => (b.link || b.registry_link || 0) - (a.link || a.registry_link || 0))[0];
    ctx.assert(newest && String(newest.urgency).toUpperCase() === 'RED',
      `new registry item is RED urgency (got ${newest && newest.urgency})`);

    // ── Step 5: GAD-7 scores on the published bands ──
    ctx.log('Step 5: GAD-7 moderate');
    const gad7Qs = await ctx.fetch(`/v1/surveys/${gad7.link}/questions?tenant_id=${TENANT_ID}`);
    ctx.assert(Array.isArray(gad7Qs) && gad7Qs.length === 7, `GAD-7 has 7 questions (got ${gad7Qs.length})`);
    const gadAnswers = gad7Qs.map(q => ({ question_link: q.question_link, answer: 2 }));
    const gad = await submitSurvey(gad7.link, gadAnswers);
    ctx.assert(gad._ok, 'GAD-7 submit succeeds');
    ctx.assert(gad.scoring && gad.scoring.points === 14,
      `GAD-7 all-2s scores 14/21 (got ${gad.scoring && gad.scoring.points})`);
    const gadRegistry = (await openRegistryItems()).length;
    ctx.assert(gadRegistry === beforeCount + 1, 'GAD-7 raises no registry item');
  }
};
