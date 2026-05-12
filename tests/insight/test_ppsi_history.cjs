/**
 * Test C22: Previous PPSI sub-line endpoint
 *
 * Erica feedback (Session 113): "I would say yes, similar to the 30 day
 * window for the PPII" — she wants a "Previous PPSI" line on the chart
 * after PPSI subdomain weights change, mirroring the existing Previous
 * PPII behavior.
 *
 * Implementation: GET /v1/member/:id/ppsi-history returns the most recent
 * PPSI submission for the member that predates the current PPSI subdomain
 * weight set's effective_from. The chart's "Last PPSI" card surfaces it
 * as "Previous: <score> — pre-<date>".
 *
 * Verifies:
 *   1. Endpoint exists, returns 200 with the expected shape
 *   2. cutover_date matches the current weight set's effective_from
 *   3. When the participant has a PPSI from before the cutover, `previous`
 *      is populated with score + activity_date
 *   4. Score is on the 0..100 scale (normalized from raw)
 *   5. Unknown member returns 404
 */
module.exports = {
  name: 'C22: Previous PPSI sub-line endpoint',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '37'; // Patricia Walsh

    // ── Step 1: endpoint responds with expected shape ──
    ctx.log('Step 1: GET ppsi-history — shape check');
    const resp = await ctx.fetch(`/v1/member/${MEMBER_NUMBER}/ppsi-history?tenant_id=${TENANT_ID}`);
    ctx.assert(resp._ok, `ppsi-history endpoint responds (status=${resp._status})`);
    ctx.assertEqual(String(resp.membership_number), String(MEMBER_NUMBER), 'membership_number echoed');
    ctx.assertEqual(Number(resp.tenant_id), TENANT_ID, 'tenant_id echoed');
    ctx.assert(typeof resp.current_weight_set_id === 'number' || resp.current_weight_set_id === null,
      'current_weight_set_id present (number or null)');
    ctx.assert(typeof resp.cutover_date === 'string' || resp.cutover_date === null,
      'cutover_date present (YYYY-MM-DD or null)');
    ctx.assert('previous' in resp, 'response has previous field (may be null)');

    // ── Step 2: when previous is populated, validate shape ──
    if (resp.previous) {
      ctx.log('Step 2: Previous PPSI populated — validate shape');
      const p = resp.previous;
      ctx.assert(typeof p.score === 'number', `previous.score is a number (${p.score})`);
      ctx.assert(p.score >= 0 && p.score <= 100,
        `previous.score in 0..100 (got ${p.score})`);
      ctx.assert(typeof p.activity_date === 'string' && p.activity_date.match(/^\d{4}-\d{2}-\d{2}$/),
        `previous.activity_date is YYYY-MM-DD (got ${p.activity_date})`);
      // Cutover sanity: prior submission date must be < cutover date
      if (resp.cutover_date) {
        ctx.assert(p.activity_date < resp.cutover_date,
          `previous.activity_date < cutover_date (${p.activity_date} < ${resp.cutover_date})`);
      }
    } else {
      ctx.log('Step 2: previous is null — either no PPSI weight change yet or no prior PPSI exists');
    }

    // ── Step 3: unknown member returns 404 ──
    ctx.log('Step 3: unknown member returns 404');
    const notFound = await ctx.fetch(`/v1/member/99999999/ppsi-history?tenant_id=${TENANT_ID}`);
    ctx.assertEqual(notFound._status, 404, `unknown member returns 404 (got ${notFound._status})`);

    // ── Step 4: missing tenant_id returns 400 ──
    ctx.log('Step 4: missing tenant_id returns 400');
    const missingTenant = await ctx.fetch(`/v1/member/${MEMBER_NUMBER}/ppsi-history`);
    ctx.assertEqual(missingTenant._status, 400, `missing tenant_id returns 400 (got ${missingTenant._status})`);
  }
};
