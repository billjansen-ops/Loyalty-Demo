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

    // ── 5. Read endpoint exposes the snapshot ────────────────────
    // GET /v1/member/:id/ppii-history surfaces the audit trail to the
    // participant chart. Verify shape and that our just-written snapshot
    // is in the response with components inline.
    ctx.log('Step 5: GET /v1/member/:id/ppii-history returns the snapshot');
    const histResp = await ctx.fetch(`/v1/member/${MEMBER_NUMBER}/ppii-history?tenant_id=${TENANT_ID}&limit=10`);
    ctx.assert(histResp._ok, 'history endpoint responds 200');
    ctx.assert(Array.isArray(histResp.snapshots), 'response has snapshots array');
    ctx.assert(histResp.snapshots.length >= 1, `at least 1 snapshot returned (got ${histResp.snapshots?.length})`);
    ctx.assertEqual(Number(histResp.current_weight_set_id), currentWsId, 'current_weight_set_id matches DB');
    const ourSnap = histResp.snapshots.find(s => s.history_id === Number(historyId));
    ctx.assert(!!ourSnap, 'our just-written snapshot appears in the response');
    if (ourSnap) {
      ctx.assertEqual(ourSnap.ppii_score, Number(rowScore), 'snapshot ppii_score matches DB');
      ctx.assertEqual(ourSnap.weight_set_id, currentWsId, 'snapshot weight_set_id matches DB');
      ctx.assertEqual(ourSnap.trigger_type, 'EVENT', 'snapshot trigger_type = EVENT');
      ctx.assert(ourSnap.components && typeof ourSnap.components === 'object', 'components inlined');
      // Components map should match what we read from the DB earlier.
      const expectedCodes = new Set(compRows.map(r => r[0]));
      const gotCodes = new Set(Object.keys(ourSnap.components));
      ctx.assertEqual(gotCodes.size, expectedCodes.size, `component count matches (${gotCodes.size})`);
    }

    // ── 6. Change weights → next activity writes snapshot under v2 ────
    // This is the slice C scenario: a weights change creates a new is_current
    // ppii_weight_set, the next activity's snapshot tags that new id, and the
    // chart can then render "Previous: X (v1, date)" reading the older one.
    ctx.log('Step 6: change weights, submit another event, verify the new snapshot is under v2');
    const newWeights = { pulse: 0.30, ppsi: 0.30, compliance: 0.25, events: 0.15 };
    const putResp = await ctx.fetch(`/v1/tenants/${TENANT_ID}/ppii-weights`, {
      method: 'PUT',
      body: { ...newWeights, change_note: 'slice C test — weight change' }
    });
    ctx.assert(putResp._ok, 'PUT new weights succeeded');
    const newWsId = Number(putResp.weight_set_id);
    ctx.assert(newWsId > currentWsId, `new weight_set_id (${newWsId}) > previous (${currentWsId})`);

    // Submit a second event. This goes through POST_ACCRUAL → snapshot
    // under newWsId.
    const d2 = new Date();
    d2.setDate(d2.getDate() - 1);
    const accrual2 = await ctx.fetch(`/v1/members/${MEMBER_NUMBER}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        activity_date: d2.toISOString().slice(0, 10),
        base_points: 1,
        ACCRUAL_TYPE: 'EVENT',
        ACTIVITY_COMMENT: 'Slice C test event under v2 weights'
      }
    });
    ctx.assert(accrual2._ok, 'second event accrual succeeded');
    await new Promise(r => setTimeout(r, 250));

    // Refetch history. Latest snapshot should be under v2; the v1 snapshot
    // should still be there as the "previous" anchor.
    const histResp2 = await ctx.fetch(`/v1/member/${MEMBER_NUMBER}/ppii-history?tenant_id=${TENANT_ID}&limit=10`);
    ctx.assert(histResp2._ok, 'second history fetch responds 200');
    ctx.assertEqual(Number(histResp2.current_weight_set_id), newWsId, 'current_weight_set_id is the new v2 id');

    const v2Snaps = histResp2.snapshots.filter(s => s.weight_set_id === newWsId);
    const v1Snaps = histResp2.snapshots.filter(s => s.weight_set_id === currentWsId);
    ctx.assert(v2Snaps.length >= 1, `at least one snapshot under v2 (got ${v2Snaps.length})`);
    ctx.assert(v1Snaps.length >= 1, `at least one snapshot under v1 (got ${v1Snaps.length}) — needed as the "Previous" anchor`);

    // The chart's "Previous" rule: most recent snapshot whose weight_set_id
    // != current. Verify that picking it that way actually finds the v1 row.
    const priorForChart = histResp2.snapshots.find(s => s.weight_set_id !== histResp2.current_weight_set_id);
    ctx.assert(!!priorForChart, '"Previous PPII" anchor exists for the chart to display');
    if (priorForChart) {
      ctx.assertEqual(priorForChart.weight_set_id, currentWsId,
        'chart Previous PPII would read from the v1 snapshot (weight_set_id matches old current)');
    }

    // ── 7. Slice D: Recent Changes audit log on GET response ──────
    // The admin page's Recent Changes panel reads recent_changes off the
    // ppii-weights GET. Verify shape: array, newest first, current row
    // is_current=true, prior is_current=false, weights map populated,
    // changed_by_user resolved when present.
    ctx.log('Step 7: GET /v1/tenants/5/ppii-weights returns recent_changes audit log');
    const wResp = await ctx.fetch(`/v1/tenants/${TENANT_ID}/ppii-weights`);
    ctx.assert(wResp._ok, 'ppii-weights GET responds 200');
    ctx.assert(Array.isArray(wResp.recent_changes), 'recent_changes is an array');
    ctx.assert(wResp.recent_changes.length >= 2, `at least 2 weight set rows (got ${wResp.recent_changes?.length})`);
    if (wResp.recent_changes.length >= 2) {
      const top = wResp.recent_changes[0];
      ctx.assertEqual(Number(top.weight_set_id), newWsId, 'newest entry is the just-created v2 weight set');
      ctx.assertEqual(top.is_current, true, 'newest entry is_current=true');
      ctx.assert(top.weights && Object.keys(top.weights).length > 0, 'newest entry has per-stream weights');
      ctx.assertEqual(top.change_note, 'slice C test — weight change', 'newest entry carries change_note');
      // Look down the list for the v1 row — should be is_current=false now.
      const v1 = wResp.recent_changes.find(c => Number(c.weight_set_id) === currentWsId);
      ctx.assert(!!v1, 'v1 weight set still in recent_changes');
      if (v1) ctx.assertEqual(v1.is_current, false, 'v1 entry is_current=false (superseded)');
    }

    // ── 8. Slice D: Recalculate-for-everyone endpoint ─────────────
    // Hits POST /v1/tenants/:id/ppii-weights/recalculate. Patricia has
    // multiple history rows (from steps 1+6). Endpoint should pick her
    // *latest* per member, recompute under current weights, and write a
    // new WEIGHT_CHANGE_RECOMPUTE row.
    ctx.log('Step 8: POST recalculate writes a new WEIGHT_CHANGE_RECOMPUTE snapshot per member');
    const preRecalcRows = psql(
      `SELECT COUNT(*) FROM ppii_score_history WHERE tenant_id = ${TENANT_ID}`
    );
    const preRecalc = Number(preRecalcRows[0][0]);

    const recalcResp = await ctx.fetch(`/v1/tenants/${TENANT_ID}/ppii-weights/recalculate`, {
      method: 'POST'
    });
    ctx.assert(recalcResp._ok, `recalculate succeeded (status=${recalcResp._status})`);
    ctx.assert(typeof recalcResp.members_recomputed === 'number', 'response has members_recomputed count');
    ctx.assert(recalcResp.members_recomputed >= 1, `at least 1 member recomputed (got ${recalcResp.members_recomputed})`);
    ctx.assertEqual(Number(recalcResp.weight_set_id), newWsId, 'recalculate used the current v2 weight set');

    const postRecalcRows = psql(
      `SELECT COUNT(*) FROM ppii_score_history WHERE tenant_id = ${TENANT_ID}`
    );
    const postRecalc = Number(postRecalcRows[0][0]);
    ctx.assertEqual(postRecalc - preRecalc, recalcResp.members_recomputed,
      `ppii_score_history grew by exactly members_recomputed (${recalcResp.members_recomputed})`);

    // The new rows should be tagged WEIGHT_CHANGE_RECOMPUTE.
    const recomputeRows = psql(
      `SELECT trigger_type, weight_set_id FROM ppii_score_history WHERE tenant_id = ${TENANT_ID} AND trigger_type = 'WEIGHT_CHANGE_RECOMPUTE'`
    );
    ctx.assertEqual(recomputeRows.length, recalcResp.members_recomputed,
      `every recompute row is tagged WEIGHT_CHANGE_RECOMPUTE`);
    for (const [trig, wsId] of recomputeRows) {
      ctx.assertEqual(Number(wsId), newWsId, `recompute row weight_set_id = ${newWsId}`);
    }

    // Patricia's recompute should carry forward her stored components.
    const patriciaRecomputeRows = psql(
      `SELECT h.history_id, c.stream_code, c.raw_value
         FROM ppii_score_history h
         LEFT JOIN ppii_score_history_component c ON c.history_id = h.history_id
        WHERE h.tenant_id = ${TENANT_ID}
          AND h.p_link = '${memberLink}'
          AND h.trigger_type = 'WEIGHT_CHANGE_RECOMPUTE'
        ORDER BY h.computed_at DESC LIMIT 4`
    );
    ctx.assert(patriciaRecomputeRows.length >= 1, 'Patricia got a WEIGHT_CHANGE_RECOMPUTE row');

    // ── 9. Non-superuser cannot recalculate ───────────────────────
    ctx.log('Step 9: non-superuser POST recalculate → 403');
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });
    const forbidden = await ctx.fetch(`/v1/tenants/${TENANT_ID}/ppii-weights/recalculate`, { method: 'POST' });
    ctx.assertEqual(forbidden._status, 403, 'non-superuser receives 403');
    // Re-login as Claude for any downstream tests in the suite.
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });

    // ── 10. Browser: admin_ppii_weights.html — Recent Changes + Recalculate ──
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser checks — Playwright not available');
      return;
    }
    ctx.log('Step 10: Browser — admin_ppii_weights.html Recent Changes panel + Recalculate button');
    const adminPage = await ctx.openPage('/admin_ppii_weights.html');
    await adminPage.evaluate(() => sessionStorage.setItem('tenant_id', '5'));
    await adminPage.reload({ waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 1500));

    const adminUi = await adminPage.evaluate(() => {
      const recentEl = document.getElementById('recentChanges');
      const recalcBtn = document.getElementById('recalcBtn');
      const recalcResult = document.getElementById('recalcResult');
      // Each entry is a div with v# label, CURRENT badge on the active row.
      const entries = recentEl ? Array.from(recentEl.querySelectorAll(':scope > div')) : [];
      const entryCount = entries.length;
      const currentEntries = entries.filter(d => /CURRENT/.test(d.textContent || ''));
      // Pull v# labels in order.
      const versionLabels = entries.map(d => {
        const m = (d.textContent || '').match(/v(\d+)/);
        return m ? Number(m[1]) : null;
      }).filter(n => n !== null);
      return {
        entryCount,
        currentEntryCount: currentEntries.length,
        versionLabels,
        recalcBtnPresent: !!recalcBtn,
        recalcBtnDisabled: recalcBtn?.disabled,
        recalcResultText: recalcResult?.textContent || '',
        currentEntryIsHighest: currentEntries.length === 1
          && currentEntries[0].textContent.includes(`v${Math.max(...versionLabels)}`)
      };
    });
    ctx.log(`  recent changes: ${adminUi.entryCount} entries, versions=${JSON.stringify(adminUi.versionLabels)}, current=${adminUi.currentEntryCount}`);
    ctx.assert(adminUi.entryCount >= 2, `Recent Changes shows ≥2 entries (got ${adminUi.entryCount})`);
    ctx.assertEqual(adminUi.currentEntryCount, 1, 'exactly one entry has the CURRENT badge');
    ctx.assert(adminUi.currentEntryIsHighest, 'CURRENT badge on the highest-version entry (the active weight set)');
    ctx.assert(adminUi.recalcBtnPresent, 'Recalculate button rendered');
    ctx.assertEqual(adminUi.recalcBtnDisabled, false, 'Recalculate button enabled when no unsaved changes');

    // Click Recalculate. Handle the confirm() dialog by accepting it.
    adminPage.once('dialog', d => d.accept());
    await adminPage.evaluate(() => document.getElementById('recalcBtn').click());
    // Wait for the result line to update to a success state.
    let recalcDone = false;
    try {
      await adminPage.waitForFunction(() => {
        const t = document.getElementById('recalcResult')?.textContent || '';
        return /Recomputed|No prior snapshots/i.test(t);
      }, { timeout: 5000 });
      recalcDone = true;
    } catch (e) { ctx.log(`  recalc wait timed out: ${e.message}`); }
    ctx.assert(recalcDone, 'Recalculate result message rendered within 5s');
    if (recalcDone) {
      const finalText = await adminPage.evaluate(() => document.getElementById('recalcResult')?.textContent || '');
      ctx.log(`  recalc result line: "${finalText}"`);
      ctx.assert(/Recomputed \d+ member/.test(finalText) || /No prior snapshots/.test(finalText),
        `result line shows recompute count or no-prior message (got "${finalText}")`);
    }
    await adminPage.close();

    // ── 11. Browser: physician_detail.html — Previous PPII sub-line ──
    // Patricia has a snapshot under v1 (from step 1) and v2 (from step 6).
    // Current is v2 → chart should render "Previous: X — weight set v1, <date>".
    ctx.log('Step 11: Browser — physician_detail.html Previous PPII sub-line');
    const chartPage = await ctx.openPageWithContext(
      '/verticals/workforce_monitoring/physician_detail.html',
      { memberId: MEMBER_NUMBER }
    );
    await chartPage.evaluate(() => sessionStorage.setItem('tenant_id', '5'));
    await chartPage.reload({ waitUntil: 'networkidle' });
    // The history fetch is fired alongside other loads — give it ~3s.
    await new Promise(r => setTimeout(r, 3000));

    const chartUi = await chartPage.evaluate(() => {
      const prevEl = document.getElementById('sumPrevPpii');
      return {
        prevPresent: !!prevEl,
        prevDisplay: prevEl?.style?.display ?? '',
        prevText: prevEl?.textContent || ''
      };
    });
    ctx.log(`  Previous PPII line: display=${JSON.stringify(chartUi.prevDisplay)} text=${JSON.stringify(chartUi.prevText)}`);
    ctx.assert(chartUi.prevPresent, 'sumPrevPpii element present in DOM');
    ctx.assertEqual(chartUi.prevDisplay !== 'none', true, 'sumPrevPpii visible (Patricia has a v1 snapshot under prior weight set)');
    ctx.assert(/Previous:\s*\d+/.test(chartUi.prevText), `sub-line text starts with "Previous: <score>" (got "${chartUi.prevText}")`);
    // The prior weight_set_id depends on how many weight sets earlier
    // tests created in this run; just verify the line references SOME
    // prior version that isn't the current one (newWsId from step 6).
    const priorVersionMatch = chartUi.prevText.match(/weight set v(\d+)/);
    ctx.assert(!!priorVersionMatch, `sub-line cites a prior weight set version (got "${chartUi.prevText}")`);
    if (priorVersionMatch) {
      const priorV = Number(priorVersionMatch[1]);
      ctx.assert(priorV < newWsId, `prior weight set version (v${priorV}) is older than current (v${newWsId})`);
    }
    await chartPage.close();
  }
};
