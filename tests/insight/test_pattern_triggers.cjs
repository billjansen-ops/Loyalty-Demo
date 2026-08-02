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
 *
 * PART 2 (Session 162): PROTECTIVE_COLLAPSE on a COPIED tenant.
 * The detector filtered survey answers by wi_php's raw category numbers
 * (sq.category_link IN (4,6,7)) — on wa_php and the sandbox those links
 * are link_tank-allocated (ISOLATION = -32765 / -32740), so the safety
 * detector silently never fired there. The fix resolves categories by
 * CODE. This part proves the whole chain on the sandbox tenant: a fresh
 * member submits three PPSI sittings with Isolation/Recovery/Purpose
 * strictly worsening while the composite stays flat (no spike, no trend,
 * GREEN band), and a PROTECTIVE_COLLAPSE registry item must appear.
 * Fixtures are BUILT by the test through real doors — nothing local-only.
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
      const activityDate = new Date().toLocaleDateString('en-CA');
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
    // PART 2: PROTECTIVE_COLLAPSE fires on a COPIED tenant (Session 162)
    // ══════════════════════════════════════════════
    ctx.log('--- Part 2: protective collapse on the sandbox (copied) tenant ---');

    // Resolve the sandbox tenant by KEY, never a hardcoded number
    const tenants = await ctx.fetch('/v1/tenants');
    const tenantList = Array.isArray(tenants) ? tenants : (tenants.tenants || []);
    const sandbox = tenantList.find(t => t.tenant_key === 'wphp_sandbox');
    ctx.assert(!!sandbox, 'Sandbox tenant (wphp_sandbox) exists');
    if (!sandbox) return;
    const SB = sandbox.tenant_id;

    // The session tenant is authoritative even for superusers — rebind to the
    // sandbox for this part (and back to wi_php after, in the finally).
    const rebind = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: SB } });
    ctx.assert(rebind._ok, `Session rebound to sandbox tenant ${SB}`);
    try {

    // Resolve PPSI by CODE on the sandbox — its link is link_tank-allocated
    const sbSurveys = await ctx.fetch(`/v1/surveys?tenant_id=${SB}`);
    const sbSurveyList = Array.isArray(sbSurveys) ? sbSurveys : (sbSurveys.surveys || []);
    const sbPPSI = sbSurveyList.find(s => s.survey_code === 'PPSI');
    ctx.assert(!!sbPPSI, 'Sandbox PPSI survey resolves by code');
    if (!sbPPSI) return;
    ctx.log(`Sandbox PPSI link: ${sbPPSI.link} (link_tank region — the old hardcoded filter never matched here)`);

    // Questions with their category codes — the per-tenant mapping
    const sbQuestions = await ctx.fetch(`/v1/surveys/${sbPPSI.link}/questions?tenant_id=${SB}`);
    ctx.assert(Array.isArray(sbQuestions) && sbQuestions.length > 0, `Sandbox PPSI questions load (${(sbQuestions || []).length})`);
    // Two questions per protective section: sums rise 0→1→2→3 across four
    // sittings with NO single answer ever reaching 3 — an answer of 3 rightly
    // fires the separate severe-single-item watchdog and would muddy the count.
    const nthOf = (code, n) => (sbQuestions.filter(q => q.category_code === code)[n] || {}).question_link;
    const qIso = nthOf('ISOLATION', 0), qIso2 = nthOf('ISOLATION', 1);
    const qRec = nthOf('RECOVERY', 0), qRec2 = nthOf('RECOVERY', 1);
    const qPur = nthOf('PURPOSE', 0), qPur2 = nthOf('PURPOSE', 1);
    const qSleep = nthOf('SLEEP', 0);
    ctx.assert(qIso && qIso2 && qRec && qRec2 && qPur && qPur2 && qSleep,
      'Two ISOLATION/RECOVERY/PURPOSE questions + SLEEP all resolve by category code');

    // Fresh member on the sandbox through the real doors
    const sbNum = await ctx.fetch(`/v1/member/next-number?tenant_id=${SB}`);
    const sbMnum = sbNum.membership_number;
    const sbCreated = await ctx.fetch('/v1/member', {
      method: 'POST', body: { tenant_id: SB, membership_number: sbMnum, fname: 'Collapse', lname: 'Guard' }
    });
    ctx.assert(sbCreated._ok, `Sandbox member ${sbMnum} created`);

    // Three sittings: Isolation/Recovery/Purpose sums strictly worsen (0→1→2)
    // while a SLEEP answer steps down (2→1→0) so the composite stays flat —
    // no PPII_SPIKE, no PPII_TREND_UP, GREEN band (no threshold masking).
    // All three sittings backdate to the SAME noon (activity_date pins
    // start_ts) — deliberately the worst case: the detector's ordering must
    // hold on the ms.link DESC tiebreaker alone (the S144 same-day rule).
    async function submitSandboxSitting(k) {
      const activityDate = new Date().toLocaleDateString('en-CA');
      const sResp = await ctx.fetch(`/v1/members/${sbMnum}/surveys`, {
        method: 'POST',
        body: { survey_link: sbPPSI.link, tenant_id: SB, activity_date: activityDate }
      });
      if (!sResp._ok) return { error: `Create sitting failed: ${sResp.error || sResp._status}` };
      const answers = sbQuestions.map(q => {
        let v = 0;
        if (q.question_link === qIso || q.question_link === qRec || q.question_link === qPur) v = Math.min(k, 2);
        if (q.question_link === qIso2 || q.question_link === qRec2 || q.question_link === qPur2) v = Math.max(k - 2, 0);
        if (q.question_link === qSleep) v = Math.max(2 - k, 0);
        return { question_link: q.question_link, answer: v };
      });
      const sub = await ctx.fetch(`/v1/member-surveys/${sResp.member_survey_link}/answers`, {
        method: 'PUT',
        body: { answers, submit: true, tenant_id: SB, activity_date: activityDate }
      });
      return { submitResp: sub };
    }

    for (let k = 0; k <= 2; k++) {
      const r = await submitSandboxSitting(k);
      ctx.assert(!r.error && r.submitResp._ok,
        `Sandbox sitting ${k + 1}/3 submitted${r.error ? ' — ' + r.error : ''}`);
      await new Promise(res => setTimeout(res, 1500)); // POST_ACCRUAL settle

      if (k === 1) {
        // Falsifier: with only 2 sittings (periods+1 = 3 required) nothing may fire
        const midReg = await ctx.fetch(`/v1/stability-registry/member/${sbMnum}?tenant_id=${SB}`);
        const midItems = Array.isArray(midReg.items || midReg) ? (midReg.items || midReg) : [];
        ctx.assert(midItems.length === 0,
          `No registry item after only two sittings (needs periods+1; found: ${midItems.map(i => i.reason_code).join(', ') || 'none'})`);
      }
    }

    // The whole chain must have fired: detector → PROTECTIVE_COLLAPSE signal →
    // PROTECT_ALERT bonus → SR_YELLOW external action → registry item, all on
    // the copied tenant. Items file under the ACTION code with the bonus
    // result's description (v67 semantics) — assert both, and assert EXACTLY
    // ONE item: a second one means the recursion guard failed (the S162
    // pool-exhaustion loop).
    const sbReg = await ctx.fetch(`/v1/stability-registry/member/${sbMnum}?tenant_id=${SB}`);
    ctx.assert(sbReg._ok, 'Sandbox registry endpoint responds');
    const sbItems = Array.isArray(sbReg.items || sbReg) ? (sbReg.items || sbReg) : [];
    const collapse = sbItems.find(i => i.reason_code === 'SR_YELLOW' &&
      /Isolation, Recovery, Purpose/i.test(i.reason_text || ''));
    ctx.assert(!!collapse,
      `Protective-collapse registry item created on the copied tenant (items: ${sbItems.map(i => `${i.reason_code}:${i.reason_text}`).join(' | ') || 'none'})`);
    ctx.assert(sbItems.length === 1,
      `Exactly ONE registry item filed (recursion guard holds; found ${sbItems.length})`);

    // "Never the same news twice while it's open": a FOURTH worsening sitting
    // while the item is still open must NOT file a second one. (The old check
    // compared reason_code to the signal name; post-v67 items file under the
    // action code, so it matched nothing and every submission re-filed.)
    const r4 = await submitSandboxSitting(3);
    ctx.assert(!r4.error && r4.submitResp._ok, `Sandbox sitting 4/4 submitted${r4.error ? ' — ' + r4.error : ''}`);
    await new Promise(res => setTimeout(res, 1500));
    const sbReg2 = await ctx.fetch(`/v1/stability-registry/member/${sbMnum}?tenant_id=${SB}`);
    const sbItems2 = Array.isArray(sbReg2.items || sbReg2) ? (sbReg2.items || sbReg2) : [];
    ctx.assert(sbItems2.length === 1,
      `Still exactly ONE item after a 4th worsening sitting while it's open (found ${sbItems2.length}: ${sbItems2.map(i => `${i.reason_code}:${i.reason_text}`).join(' | ')})`);

    // ══════════════════════════════════════════════
    // PART 3: PPII_SPIKE and PPII_TREND_UP see history again (Session 162)
    // Their history read joined molecule_value_embedded_list — EMPTY since
    // the ~S126 internal-list era — so scores was always [] and neither
    // detector could fire on ANY tenant. Now proven live on the sandbox.
    // Answers stay ≤ 2 (an answer of 3 fires the severe-single-item
    // watchdog) and scores stay under the YELLOW band (35) so nothing else
    // files. Each detector gets its own fresh member.
    // ══════════════════════════════════════════════
    ctx.log('--- Part 3: spike + trend detectors on the sandbox ---');
    const qsOf = code => sbQuestions.filter(q => q.category_code === code).map(q => q.question_link);
    const sleepQs = qsOf('SLEEP'), workQs = qsOf('WORK'), cogQs = qsOf('COGNITIVE');

    async function newSandboxMember(lname) {
      const n = await ctx.fetch(`/v1/member/next-number?tenant_id=${SB}`);
      const c = await ctx.fetch('/v1/member', {
        method: 'POST', body: { tenant_id: SB, membership_number: n.membership_number, fname: 'Pattern', lname }
      });
      ctx.assert(c._ok, `Sandbox member ${n.membership_number} (${lname}) created`);
      return n.membership_number;
    }
    async function submitSitting(mnum, valueByQuestion) {
      const activityDate = new Date().toLocaleDateString('en-CA');
      const sResp = await ctx.fetch(`/v1/members/${mnum}/surveys`, {
        method: 'POST', body: { survey_link: sbPPSI.link, tenant_id: SB, activity_date: activityDate }
      });
      if (!sResp._ok) return { error: `create failed: ${sResp.error || sResp._status}` };
      const answers = sbQuestions.map(q => ({ question_link: q.question_link, answer: valueByQuestion[q.question_link] || 0 }));
      const sub = await ctx.fetch(`/v1/member-surveys/${sResp.member_survey_link}/answers`, {
        method: 'PUT', body: { answers, submit: true, tenant_id: SB, activity_date: activityDate }
      });
      return { ok: sub._ok, error: sub._ok ? null : (sub.error || sub._status) };
    }
    const fill = (qs, v, map) => { for (const q of qs) map[q] = v; return map; };

    // SPIKE: sitting 1 all zeros (score 0) → sitting 2 SLEEP/WORK/COGNITIVE
    // all 2s (score ~20) — a one-period jump ≥ the spike threshold (15).
    const spikeM = await newSandboxMember('Spike');
    let r = await submitSitting(spikeM, {});
    ctx.assert(!r.error && r.ok, `Spike sitting 1/2 submitted${r.error ? ' — ' + r.error : ''}`);
    await new Promise(res => setTimeout(res, 1500));
    r = await submitSitting(spikeM, fill(sleepQs, 2, fill(workQs, 2, fill(cogQs, 2, {}))));
    ctx.assert(!r.error && r.ok, `Spike sitting 2/2 submitted${r.error ? ' — ' + r.error : ''}`);
    await new Promise(res => setTimeout(res, 1500));
    const spikeReg = await ctx.fetch(`/v1/stability-registry/member/${spikeM}?tenant_id=${SB}`);
    const spikeItems = Array.isArray(spikeReg.items || spikeReg) ? (spikeReg.items || spikeReg) : [];
    ctx.assert(spikeItems.length === 1 && /jumped/i.test(spikeItems[0].reason_text || ''),
      `PPII_SPIKE files exactly one item on the copied tenant (found ${spikeItems.length}: ${spikeItems.map(i => `${i.reason_code}:${i.reason_text}`).join(' | ') || 'none'})`);

    // TREND: three sittings rising gently (0 → ~7 → ~14): each step under the
    // spike threshold, three consecutive rises → PPII_TREND_UP at sitting 3.
    const trendM = await newSandboxMember('Trend');
    r = await submitSitting(trendM, {});
    ctx.assert(!r.error && r.ok, `Trend sitting 1/3 submitted${r.error ? ' — ' + r.error : ''}`);
    await new Promise(res => setTimeout(res, 1500));
    r = await submitSitting(trendM, fill(workQs, 2, {}));
    ctx.assert(!r.error && r.ok, `Trend sitting 2/3 submitted${r.error ? ' — ' + r.error : ''}`);
    await new Promise(res => setTimeout(res, 1500));
    r = await submitSitting(trendM, fill(workQs, 2, fill(sleepQs, 2, {})));
    ctx.assert(!r.error && r.ok, `Trend sitting 3/3 submitted${r.error ? ' — ' + r.error : ''}`);
    await new Promise(res => setTimeout(res, 1500));
    const trendReg = await ctx.fetch(`/v1/stability-registry/member/${trendM}?tenant_id=${SB}`);
    const trendItems = Array.isArray(trendReg.items || trendReg) ? (trendReg.items || trendReg) : [];
    ctx.assert(trendItems.length === 1 && /rising/i.test(trendItems[0].reason_text || ''),
      `PPII_TREND_UP files exactly one item on the copied tenant (found ${trendItems.length}: ${trendItems.map(i => `${i.reason_code}:${i.reason_text}`).join(' | ') || 'none'})`);

    } finally {
      // Rebind back to wi_php — the browser part below runs against tenant 5
      const rebindBack = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: TENANT_ID } });
      ctx.assert(rebindBack._ok, 'Session rebound back to wi_php');
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
