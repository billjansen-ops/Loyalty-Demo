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
 *   1. Pick a wi_php participant BY THEIR DATA — someone with a completed
 *      PPSI who follows the default regime (so PPSI is in their expected
 *      set). Never by name: this test originally hardcoded Grace Newfield,
 *      which broke on the Session-147 dress rehearsal — on Erica's live
 *      data Grace's state is whatever Erica left it (S147 lesson: a
 *      member's clinical state belongs to the environment, not the test).
 *   2. Hit /v1/meds/member/:membershipNumber.
 *   3. Assert at least one survey item shows status != 'never_completed'
 *      and has a non-null last_completed timestamp.
 *
 * Catches the membership_number-vs-link confusion if it regresses.
 */
const { execSync } = require('child_process');

module.exports = {
  name: 'C18: MEDS member status reflects completed surveys',

  async run(ctx) {
    const TENANT_ID = 5;
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    const sql = (q) => execSync(
      `${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -t -A -c "${q.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }).toString().trim();

    // A participant with a completed PPSI (member_survey end_ts set) on the
    // DEFAULT regime (no individual assignment rows — so PPSI is expected).
    // Link tiebreaker makes the pick deterministic on any database.
    const MEMBER_NUMBER = sql(`
      SELECT m.membership_number FROM member m
      WHERE m.tenant_id = ${TENANT_ID} AND m.is_active = true
        AND EXISTS (SELECT 1 FROM member_survey ms
                    WHERE ms.member_link = m.link AND ms.end_ts IS NOT NULL
                      AND ms.survey_link = (SELECT s.link FROM survey s
                                            WHERE s.tenant_id = ${TENANT_ID} AND s.survey_code = 'PPSI'))
        AND NOT EXISTS (SELECT 1 FROM member_instrument mi WHERE mi.member_link = m.link)
      ORDER BY m.link LIMIT 1`);
    ctx.assert(MEMBER_NUMBER, 'found a default-regime participant with a completed PPSI');

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

    // PPSI specifically — the pick guarantees this member has a completed
    // PPSI in their expected set, so the join must surface it.
    const ppsi = resp.items.find(i => i.code === 'PPSI');
    ctx.assert(ppsi, 'PPSI item present in MEDS response');
    ctx.assert(ppsi && ppsi.status !== 'never_completed',
      `PPSI status is not 'never_completed' (got: ${ppsi && ppsi.status}) — this member has a completed PPSI`);

    // ── Sanity: 404 path for an unknown membership_number ────────────────
    const missing = await ctx.fetch(`/v1/meds/member/999999?tenant_id=${TENANT_ID}`);
    ctx.assertEqual(missing._status, 404, 'unknown membership_number returns 404 (not 200 with empty data)');
  }
};
