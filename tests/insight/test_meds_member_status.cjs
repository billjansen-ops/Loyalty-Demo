/**
 * Test C18: MEDS member status reflects completed surveys + compliance.
 *
 * Regression test for the bug Erica caught (Grace Newfield #46): the
 * /v1/meds/member/:memberLink endpoint takes membership_number from the URL
 * but was passing it directly into member_link comparisons, which never
 * matched (member.link is a CHAR(5) internal value, not the public
 * membership_number). Result: every item came back as 'never_completed'
 * even for participants with completed surveys.
 *
 * Test strategy:
 *   1. Pick a wi_php participant who has at least one completed survey
 *      (we know Grace #46 has PPSI + CGIS completions on the seed data).
 *   2. Hit /v1/meds/member/:membershipNumber.
 *   3. Assert at least one survey item shows status != 'never_completed'
 *      and has a non-null last_completed timestamp.
 *
 * Catches the membership_number-vs-link confusion if it regresses.
 */
module.exports = {
  name: 'C18: MEDS member status reflects completed surveys',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '46'; // Grace Newfield — has completed PPSI + CGIS in seed data.

    const resp = await ctx.fetch(`/v1/meds/member/${MEMBER_NUMBER}?tenant_id=${TENANT_ID}`);
    ctx.assert(resp._ok, `MEDS endpoint responds OK for membership_number=${MEMBER_NUMBER}`);
    ctx.assertEqual(resp.member_link, MEMBER_NUMBER, 'response echoes the membership_number passed in');
    ctx.assert(Array.isArray(resp.items), 'response.items is an array');
    ctx.assert(resp.items.length > 0, `at least one MEDS item returned (got ${resp.items.length})`);

    // Find survey items with a completion (the bug made every survey
    // 'never_completed'; this assertion catches regressions to that state).
    const completedSurveys = resp.items.filter(i => i.type === 'survey' && i.status !== 'never_completed');
    ctx.assert(completedSurveys.length > 0,
      `at least one survey item is NOT 'never_completed' (got ${completedSurveys.length}; bug-state would be 0)`);

    // Stronger: each non-never-completed item has a real last_completed timestamp.
    for (const item of completedSurveys) {
      ctx.assert(item.last_completed !== null,
        `${item.code}: last_completed is non-null when status=${item.status}`);
      ctx.assert(item.next_due !== null,
        `${item.code}: next_due is non-null when status=${item.status}`);
    }

    // PPSI specifically — Grace has a known PPSI completion in seed data,
    // so this is a tighter assertion that the join is working through to the
    // expected survey row.
    const ppsi = resp.items.find(i => i.code === 'PPSI');
    ctx.assert(ppsi, 'PPSI item present in MEDS response');
    ctx.assert(ppsi.status !== 'never_completed',
      `PPSI status is not 'never_completed' (got: ${ppsi.status}) — Grace has a completed PPSI in seed data`);

    // ── Sanity: 404 path for an unknown membership_number ────────────────
    const missing = await ctx.fetch(`/v1/meds/member/999999?tenant_id=${TENANT_ID}`);
    ctx.assertEqual(missing._status, 404, 'unknown membership_number returns 404 (not 200 with empty data)');
  }
};
