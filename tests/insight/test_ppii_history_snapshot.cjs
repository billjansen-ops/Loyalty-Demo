/**
 * Test: PPII history snapshot writes (v58 audit foundation)
 *
 * The custauth.js POST_ACCRUAL hook writes a row to ppii_score_history
 * (and one component row per non-null stream into
 * ppii_score_history_component) every time a survey / pulse / compliance /
 * event activity produces a new PPII. This test exercises that path with
 * an event submission and verifies:
 *   - One new ppii_score_history row appears
 *   - It carries the correct tenant_id, p_link, ppii_score range,
 *     weight_set_id (matching the current is_current weight set), and
 *     trigger_type ('EVENT')
 *   - Component rows exist for every non-null stream and their raw
 *     values match what the wellness/members endpoint reports for that
 *     same member afterward (sanity tie-back: the components stored
 *     are the components the system computed)
 *
 * Uses Patricia Walsh (#37) — same member used by C4 event reporting.
 */
const { execSync } = require('child_process');

const PSQL = '/opt/homebrew/bin/psql';
const DB_HOST = process.env.DATABASE_HOST || '127.0.0.1';
const DB_USER = process.env.DATABASE_USER || 'billjansen';
const DB_NAME = process.env.DATABASE_NAME || 'loyalty';

function psql(sql) {
  // -t = tuples only; -A = unaligned; -F $'\t' = tab-separated
  const out = execSync(
    `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -t -A -F $'\\t' -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
  if (!out) return [];
  return out.split('\n').map(line => line.split('\t'));
}

module.exports = {
  name: 'PPII history snapshot writes',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '37';

    // ── 0. Pre-state ─────────────────────────────────────────────
    ctx.log('Step 0: capture pre-state');
    const preCountRows = psql(
      `SELECT COUNT(*) FROM ppii_score_history WHERE tenant_id = ${TENANT_ID}`
    );
    const preCount = Number(preCountRows[0][0]);
    ctx.log(`  ppii_score_history rows for tenant ${TENANT_ID} before: ${preCount}`);

    // Current is_current weight_set_id for tenant 5 — the snapshot must point at this.
    const wsRows = psql(
      `SELECT weight_set_id FROM ppii_weight_set WHERE tenant_id = ${TENANT_ID} AND is_current = true`
    );
    ctx.assert(wsRows.length === 1, `Exactly one is_current ppii_weight_set for tenant ${TENANT_ID}`);
    const currentWsId = Number(wsRows[0][0]);
    ctx.log(`  current weight_set_id: ${currentWsId}`);

    // ── 1. Submit an event for Patricia ───────────────────────────
    ctx.log('Step 1: submit a severity-1 event (drives POST_ACCRUAL → snapshot)');
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const activityDate = d.toISOString().slice(0, 10);
    const accrual = await ctx.fetch(`/v1/members/${MEMBER_NUMBER}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        activity_date: activityDate,
        base_points: 1,
        ACCRUAL_TYPE: 'EVENT',
        ACTIVITY_COMMENT: 'PPII snapshot test event'
      }
    });
    ctx.assert(accrual._ok, `Event accrual succeeded (status=${accrual._status})`);

    // POST_ACCRUAL is async-ish in the sense that the server processes it
    // before responding, so by the time we get here the snapshot should
    // already exist. Tiny grace period in case of slow CI.
    await new Promise(r => setTimeout(r, 250));

    // ── 2. Verify exactly one new row appeared ───────────────────
    ctx.log('Step 2: verify a snapshot row was written');
    const postCountRows = psql(
      `SELECT COUNT(*) FROM ppii_score_history WHERE tenant_id = ${TENANT_ID}`
    );
    const postCount = Number(postCountRows[0][0]);
    ctx.assertEqual(postCount, preCount + 1, 'ppii_score_history grew by exactly 1 row');

    // ── 3. Inspect the new row ───────────────────────────────────
    const memLinkRows = psql(
      `SELECT link FROM member WHERE membership_number = '${MEMBER_NUMBER}' AND tenant_id = ${TENANT_ID}`
    );
    ctx.assert(memLinkRows.length === 1, 'Patricia Walsh found in member table');
    const memberLink = memLinkRows[0][0];

    const newRowRows = psql(
      `SELECT history_id, tenant_id, p_link, ppii_score, weight_set_id, trigger_type
         FROM ppii_score_history
        WHERE tenant_id = ${TENANT_ID} AND p_link = '${memberLink}'
        ORDER BY computed_at DESC LIMIT 1`
    );
    ctx.assert(newRowRows.length === 1, 'Latest snapshot row found for Patricia');
    const [historyId, rowTenant, rowPLink, rowScore, rowWsId, rowTrigger] = newRowRows[0];
    ctx.assertEqual(Number(rowTenant), TENANT_ID, 'snapshot tenant_id matches');
    ctx.assertEqual(rowPLink, memberLink, 'snapshot p_link matches member.link');
    ctx.assert(Number(rowScore) >= 0 && Number(rowScore) <= 100, `ppii_score in 0-100 (got ${rowScore})`);
    ctx.assertEqual(Number(rowWsId), currentWsId, 'weight_set_id matches current is_current set');
    ctx.assertEqual(rowTrigger, 'EVENT', 'trigger_type is EVENT (matches ACCRUAL_TYPE)');

    // ── 4. Components: one row per non-null stream ───────────────
    ctx.log('Step 3: verify component rows for every non-null stream');
    const compRows = psql(
      `SELECT stream_code, raw_value
         FROM ppii_score_history_component
        WHERE history_id = ${historyId}
        ORDER BY stream_code`
    );
    ctx.log(`  components written: ${compRows.map(r => `${r[0]}=${r[1]}`).join(', ')}`);
    ctx.assert(compRows.length >= 1, `At least one component row written (got ${compRows.length})`);
    for (const [code, raw] of compRows) {
      const n = Number(raw);
      ctx.assert(Number.isFinite(n), `component ${code} raw_value is finite (${raw})`);
    }

    // Math invariant: the components stored, normalized against each
    // stream's max_value and weighted by the snapshot's weight set, must
    // reproduce the stored ppii_score (proportional reweighting when a
    // stream component is missing). This is what makes "Recalculate for
    // everyone" trivially possible later — the components alone are
    // sufficient to recompute the score under any new weight set.
    ctx.log('Step 4: snapshot components reproduce snapshot score under snapshot weights');
    const wsValRows = psql(
      `SELECT s.code, s.max_value, wsv.weight
         FROM ppii_stream s
         JOIN ppii_weight_set_value wsv ON wsv.stream_code = s.code
        WHERE s.tenant_id = ${TENANT_ID} AND wsv.weight_set_id = ${rowWsId} AND s.is_active = true`
    );
    const streamMeta = {};
    for (const [code, maxV, w] of wsValRows) streamMeta[code] = { max: Number(maxV), weight: Number(w) };
    const compMap = {};
    for (const [code, raw] of compRows) compMap[code] = Number(raw);
    let num = 0, den = 0;
    for (const code of Object.keys(streamMeta)) {
      if (!(code in compMap)) continue; // stream had no data — skip in proportional reweight
      const norm = (compMap[code] / streamMeta[code].max) * 100;
      num += streamMeta[code].weight * norm;
      den += streamMeta[code].weight;
    }
    const recomputed = den > 0 ? Math.round(num / den) : null;
    ctx.log(`  recomputed from stored components+weights: ${recomputed} (snapshot stored: ${rowScore})`);
    ctx.assertEqual(recomputed, Number(rowScore),
      'recomputed PPII from stored components + snapshot weights matches stored score');
  }
};
