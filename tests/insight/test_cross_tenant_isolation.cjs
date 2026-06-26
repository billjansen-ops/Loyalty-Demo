/**
 * Insight Test: Cross-tenant PHI/PII isolation
 *
 * Locks in the Session 121 tenant-isolation fixes with a REAL cross-tenant
 * attack — the thing Session 121 was never verified by (it was code-review +
 * suite-green only, no live attack with non-superuser creds).
 *
 * The box holds real PHI (Insight = Wisconsin PHP, tenant 5). This test proves
 * a user of another tenant cannot read or write that PHI through the endpoints
 * Session 121 scoped to req.tenantId.
 *
 * TWO-SIDED BY DESIGN — every "attacker blocked" (404) assertion is paired with
 * an oracle assertion that the SAME resource IS reachable by its rightful owner.
 * Without that pairing a 404 could mean "resource doesn't exist" rather than
 * "blocked", and the test would pass for the wrong reason. The oracle phase is
 * the falsifier: if a seed change removes the victim, the oracle fails loudly
 * instead of the attack silently passing.
 *
 * Directions covered:
 *   B. tenant 1 (Delta) -> tenant 5 (Insight)  — the real PHI-leak risk
 *   D. tenant 5 (Insight) -> tenant 1 (Delta)  — symmetry, via a throwaway
 *      tenant-5 csr created at runtime (wiped by the harness snapshot restore)
 *
 * Victim (tenant 5): membership_number 34 (James Okafor) — data-rich
 *   (surveys, registry, meds, ppii history).
 * Delta own-tenant control: membership_number 1002 (Eva Longoria).
 */
module.exports = {
  name: 'Insight: Cross-tenant PHI/PII isolation',

  async run(ctx) {
    const VICTIM_T5 = '34';      // Insight (tenant 5) participant — the PHI target
    const DELTA_OWN = '1002';    // Delta (tenant 1) member — legitimate-access control

    // ════════════════════════════════════════════════════════════════════
    // PHASE A — ORACLE. Prove the tenant-5 resources are REAL and reachable
    // by their rightful owner (Claude, superuser, default tenant 5). This is
    // what makes the attacker 404s below mean "blocked", not "absent".
    // ════════════════════════════════════════════════════════════════════
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.log('Oracle: confirming the tenant-5 victim resources actually exist');

    const oProfile = await ctx.fetch(`/v1/member/${VICTIM_T5}/profile`);
    ctx.assert(oProfile._ok && (oProfile.lname || oProfile.membership_number), 'Oracle: tenant-5 member 34 profile is real (200 + data)');

    const oSurveys = await ctx.fetch(`/v1/members/${VICTIM_T5}/surveys`);
    const surveyLink = Array.isArray(oSurveys) && oSurveys.length ? oSurveys[0].member_survey_link : null;
    ctx.assert(surveyLink != null, 'Oracle: tenant-5 member 34 has at least one survey (captured its link)');

    const oSurvey = await ctx.fetch(`/v1/member-surveys/${surveyLink}`);
    ctx.assert(oSurvey._ok && oSurvey.survey_code, 'Oracle: that survey (PHI answers) is readable by its owner (200)');

    const oRegistry = await ctx.fetch(`/v1/stability-registry/member/${VICTIM_T5}`);
    ctx.assert(oRegistry._ok, 'Oracle: tenant-5 member 34 stability-registry is reachable (200)');

    const oMeds = await ctx.fetch(`/v1/meds/member/${VICTIM_T5}`);
    ctx.assert(oMeds._ok, 'Oracle: tenant-5 member 34 MEDS status is reachable (200)');

    const oPpii = await ctx.fetch(`/v1/member/${VICTIM_T5}/ppii-history`);
    ctx.assert(oPpii._ok, 'Oracle: tenant-5 member 34 PPII history is reachable (200)');

    const oSearch = await ctx.fetch('/v1/member/search?q=Okafor');
    ctx.assert(Array.isArray(oSearch) && oSearch.some(r => r.lname === 'Okafor'), 'Oracle: member search for "Okafor" returns the tenant-5 participant (PII present for the owner)');

    // ════════════════════════════════════════════════════════════════════
    // PHASE B — ATTACK (tenant 1 -> tenant 5). DeltaCSR (tenant 1, csr) hits
    // the exact same identifiers. Every one must be blocked.
    // ════════════════════════════════════════════════════════════════════
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });
    ctx.log('Attack (tenant 1 -> tenant 5): DeltaCSR must reach none of the tenant-5 PHI');

    const aProfile = await ctx.fetch(`/v1/member/${VICTIM_T5}/profile`);
    ctx.assertEqual(aProfile._status, 404, 'Blocked: tenant-1 csr cannot read tenant-5 member profile (404)');

    const aSurvey = await ctx.fetch(`/v1/member-surveys/${surveyLink}`);
    ctx.assertEqual(aSurvey._status, 404, 'Blocked: tenant-1 csr cannot read tenant-5 survey answers by link (404, PHI)');

    const aRegistry = await ctx.fetch(`/v1/stability-registry/member/${VICTIM_T5}`);
    ctx.assertEqual(aRegistry._status, 404, 'Blocked: tenant-1 csr cannot read tenant-5 stability registry (404, PHI)');

    const aMeds = await ctx.fetch(`/v1/meds/member/${VICTIM_T5}`);
    ctx.assertEqual(aMeds._status, 404, 'Blocked: tenant-1 csr cannot read tenant-5 MEDS status (404, PHI)');

    const aPpii = await ctx.fetch(`/v1/member/${VICTIM_T5}/ppii-history`);
    ctx.assertEqual(aPpii._status, 404, 'Blocked: tenant-1 csr cannot read tenant-5 PPII history (404, PHI)');

    const aSearch = await ctx.fetch('/v1/member/search?q=Okafor');
    ctx.assert(Array.isArray(aSearch) && !aSearch.some(r => r.lname === 'Okafor'), 'Blocked: member search does not leak the tenant-5 participant to a tenant-1 csr (PII)');

    ctx.log('Attack (write): DeltaCSR must not be able to write a note onto a tenant-5 participant');
    const aWrite = await ctx.fetch('/v1/physician-annotations', { method: 'POST', body: { membership_number: VICTIM_T5, annotation_text: 'cross-tenant write probe' } });
    ctx.assert(aWrite._status >= 400 && aWrite._status < 500, `Blocked: cross-tenant physician-annotation write rejected (${aWrite._status})`);
    // Confirm via the oracle that nothing was actually written.
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    const annAfter = await ctx.fetch(`/v1/physician-annotations/${VICTIM_T5}`);
    const leaked = Array.isArray(annAfter) && annAfter.some(a => (a.annotation_text || '').includes('cross-tenant write probe'));
    ctx.assert(!leaked, 'Confirmed: no cross-tenant annotation was persisted on the tenant-5 participant');

    // ════════════════════════════════════════════════════════════════════
    // PHASE C — LEGITIMATE ACCESS still works. The isolation didn't just break
    // the endpoints: a tenant-1 csr can read its OWN tenant-1 data.
    // ════════════════════════════════════════════════════════════════════
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });
    ctx.log('Control: DeltaCSR can still read its own tenant-1 data');

    const cProfile = await ctx.fetch(`/v1/member/${DELTA_OWN}/profile`);
    ctx.assert(cProfile._ok, 'Legit: tenant-1 csr CAN read its own tenant-1 member profile (200)');

    const cSearch = await ctx.fetch('/v1/member/search?q=Longoria');
    ctx.assert(Array.isArray(cSearch) && cSearch.some(r => r.lname === 'Longoria'), 'Legit: own-tenant member search still returns own-tenant members');

    // ════════════════════════════════════════════════════════════════════
    // PHASE D — REVERSE DIRECTION (tenant 5 -> tenant 1). Create a throwaway
    // tenant-5 csr (as superuser), then prove it cannot reach tenant-1 data.
    // The user is wiped by the harness DB snapshot restore after the suite.
    // ════════════════════════════════════════════════════════════════════
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    const mk = await ctx.fetch('/v1/users', { method: 'POST', body: { username: 'qa_rev_t5_csr', password: 'qa_rev_t5_pw', display_name: 'QA Reverse', role: 'csr', tenant_id: 5 } });
    ctx.assert(mk._status === 201 || mk._status === 409, 'Setup: throwaway tenant-5 csr created (or already present)');

    const revLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'qa_rev_t5_csr', password: 'qa_rev_t5_pw' } });
    ctx.assert(revLogin._ok, 'Throwaway tenant-5 csr logs in');

    ctx.log('Attack (tenant 5 -> tenant 1): a tenant-5 csr must not reach tenant-1 data');
    const revAttack = await ctx.fetch(`/v1/member/${DELTA_OWN}/profile`);
    ctx.assertEqual(revAttack._status, 404, 'Blocked: tenant-5 csr cannot read tenant-1 member profile (404)');

    const revOwn = await ctx.fetch(`/v1/member/${VICTIM_T5}/profile`);
    ctx.assert(revOwn._ok, 'Legit: the tenant-5 csr CAN read its own tenant-5 member (200 — reverse block is tenant-keyed, not blanket)');
  }
};
