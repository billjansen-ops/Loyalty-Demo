/**
 * Workforce Monitoring (Insight) — ML feature gatherer.
 *
 * Session 131 (Category 2): moved out of pointers.js. The platform's
 * scoreMemberML (generic ML plumbing — POST to the ML service, store the
 * ML_RISK_SCORE molecule) stays platform-side; the *feature shape* it sends
 * is 100% Insight (PPSI/Pulse/compliance/MEDS/registry signals), so it lives
 * here and bridges back via the verticalCallbacks registry.
 *
 * Platform call site: scoreMemberML reads
 *   verticalCallbacks.getMemberFeatures?.(memberLink, tenantId, client)
 * and returns null when that's undefined (vertical not loaded) — so a
 * platform-only tenant simply gets no ML scoring, which is correct (it has
 * no PPSI/Pulse/compliance pipeline to gather features from).
 *
 * See docs/INSIGHT_TOUCH_POINTS.md §9.
 */

import { calcPPII } from '../tenants/wi_php/scorePPII.js';

/**
 * Gather all feature data for a member to send to the ML service.
 * Mirrors the pre-extraction pointers.js gatherMemberFeatures byte-for-byte;
 * only the dependency access changed (ctx.* instead of closed-over bindings).
 */
async function gatherMemberFeatures(ctx, memberLink, tenantId, client) {
  const db = client || ctx.getDbClient();
  const { getMoleculeStorageInfo } = ctx.molecules;
  const { platformToday, billEpochToDate } = ctx.dates;

  // Wellness score + trend — read from activity-attached molecules (same pattern as roster)
  const surveyLinkInfo = await getMoleculeStorageInfo(tenantId, 'MEMBER_SURVEY_LINK');
  const pointsInfo = await getMoleculeStorageInfo(tenantId, 'MEMBER_POINTS');
  let ppsiCurrent = null, ppsiTrend = 0, ppsiVolatility = 0, totalSurveys = 0;

  if (surveyLinkInfo && pointsInfo) {
    // Normalize each row to 0..100 using member_survey.score_math_version so
    // trend/volatility/concordance math is consistent across the v=1 → v=2
    // cutover. v=1 (raw sum, max 102) is scaled, v=2 (Option A) is pass-through.
    const ppsiScores = await db.query(
      `SELECT COALESCE(d54.n1, 0) AS score,
              COALESCE(ms.score_math_version, 1) AS math_version
       FROM activity a
       JOIN ${surveyLinkInfo.tableName} d4 ON d4.p_link = a.link AND d4.molecule_id = $1
       LEFT JOIN ${pointsInfo.tableName} d54 ON d54.p_link = a.link AND d54.molecule_id = $2
       LEFT JOIN member_survey ms ON ms.link = d4.n1
       WHERE a.p_link = $3 AND a.activity_type = 'A'
       ORDER BY a.activity_date DESC LIMIT 5`,
      [surveyLinkInfo.moleculeId, pointsInfo.moleculeId, memberLink]
    );
    const vals = ppsiScores.rows.map(r => {
      const v = Number(r.math_version);
      const s = Number(r.score);
      return v === 2 ? Math.min(100, Math.round(s)) : Math.round((s / 102) * 100);
    });
    if (vals.length > 0) {
      ppsiCurrent = vals[0];
      if (vals.length >= 2) ppsiTrend = vals[0] - vals[vals.length - 1];
      if (vals.length >= 3) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        ppsiVolatility = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
      }
    }
  }

  // Survey completion count
  const surveyCount = await db.query(
    `SELECT COUNT(*) as cnt FROM member_survey ms
     JOIN survey s ON ms.survey_link = s.link
     WHERE ms.member_link = $1 AND s.tenant_id = $2 AND ms.end_ts IS NOT NULL`,
    [memberLink, tenantId]
  );
  totalSurveys = parseInt(surveyCount.rows[0].cnt);

  // Compliance rate (all time) and misses in last 30 days
  // A "miss" = assigned compliance item with no result AND started more than cadence_days ago
  const compTotal = await db.query(
    `SELECT COUNT(*) as total,
            COUNT(CASE WHEN cr.link IS NOT NULL THEN 1 END) as completed,
            COUNT(CASE WHEN cr.link IS NULL
              AND mc.start_date + COALESCE(mc.cadence_days, 30) * INTERVAL '1 day' < CURRENT_DATE
              AND mc.start_date >= CURRENT_DATE - INTERVAL '30 days'
              THEN 1 END) as misses_30d
     FROM member_compliance mc
     LEFT JOIN compliance_result cr ON cr.member_compliance_id = mc.member_compliance_id
     WHERE mc.member_link = $1 AND mc.tenant_id = $2`,
    [memberLink, tenantId]
  );
  const compRate = compTotal.rows[0].total > 0
    ? parseInt(compTotal.rows[0].completed) / parseInt(compTotal.rows[0].total)
    : 1.0;

  // Missed-event detection flags — per member
  const medsFlags = await db.query(
    `SELECT COUNT(*) as cnt FROM notification n
     WHERE n.tenant_id = $1 AND n.member_link = $2 AND n.title LIKE '%MEDS%'
     AND n.created_at > NOW() - INTERVAL '30 days'`,
    [tenantId, memberLink]
  );
  const consecutiveMisses = await db.query(
    `SELECT COUNT(*) as cnt FROM notification n
     WHERE n.tenant_id = $1 AND n.member_link = $2 AND n.title LIKE '%consecutive%'
     AND n.created_at > NOW() - INTERVAL '30 days'`,
    [tenantId, memberLink]
  );

  // Registry items
  const registry = await db.query(
    `SELECT COUNT(*) as total,
            COUNT(CASE WHEN urgency = 'RED' THEN 1 END) as red_count
     FROM stability_registry
     WHERE member_link = $1 AND tenant_id = $2 AND status = 'O'`,
    [memberLink, tenantId]
  );

  // Days enrolled
  const member = await db.query(
    `SELECT enroll_date FROM member WHERE link = $1`,
    [memberLink]
  );
  const enrollDate = member.rows[0]?.enroll_date;
  const daysEnrolled = enrollDate ? platformToday() - enrollDate : 0;

  // Days since last wellness survey — null means no data, not "999 days missing"
  let daysSinceLastPpsi = null;
  const lastPpsi = await db.query(
    `SELECT MAX(ms.end_ts) as last_ts FROM member_survey ms
     JOIN survey s ON ms.survey_link = s.link
     WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.survey_code = 'PPSI' AND ms.end_ts IS NOT NULL`,
    [memberLink, tenantId]
  );
  if (lastPpsi.rows[0]?.last_ts) {
    const lastDate = billEpochToDate(lastPpsi.rows[0].last_ts);
    daysSinceLastPpsi = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
  }

  // Days since last Pulse — null means no data
  let daysSinceLastPulse = null;
  const lastPulse = await db.query(
    `SELECT MAX(ms.end_ts) as last_ts FROM member_survey ms
     JOIN survey s ON ms.survey_link = s.link
     WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.survey_code = 'PROVPULSE' AND ms.end_ts IS NOT NULL`,
    [memberLink, tenantId]
  );
  if (lastPulse.rows[0]?.last_ts) {
    const lastDate = billEpochToDate(lastPulse.rows[0].last_ts);
    daysSinceLastPulse = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
  }

  // Provider Pulse score + trend — activities WITH PULSE_RESPONDENT_LINK
  const pulseInfo = await getMoleculeStorageInfo(tenantId, 'PULSE_RESPONDENT_LINK');
  let pulseCurrent = null, pulseTrend = 0;
  if (pulseInfo && pointsInfo) {
    const pulseScores = await db.query(
      `SELECT COALESCE(d54.n1, 0) AS score
       FROM activity a
       JOIN ${pulseInfo.tableName} d4 ON d4.p_link = a.link AND d4.molecule_id = $1
       LEFT JOIN ${pointsInfo.tableName} d54 ON d54.p_link = a.link AND d54.molecule_id = $2
       WHERE a.p_link = $3 AND a.activity_type = 'A'
       ORDER BY a.activity_date DESC LIMIT 5`,
      [pulseInfo.moleculeId, pointsInfo.moleculeId, memberLink]
    );
    const pVals = pulseScores.rows.map(r => r.score);
    if (pVals.length > 0) {
      pulseCurrent = pVals[0];
      if (pVals.length >= 2) pulseTrend = pVals[0] - pVals[pVals.length - 1];
    }
  }

  // ── NEW v0.3.0 features ──

  // Domain breadth: count of wellness domains exceeding personal baseline by >1.5 SD
  // Requires at least 3 prior surveys to compute baseline + SD
  let domainBreadth = 0;
  const ppsiSurveys = await db.query(
    `SELECT ms.link FROM member_survey ms
     JOIN survey s ON ms.survey_link = s.link
     WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.survey_code = 'PPSI' AND ms.end_ts IS NOT NULL
     ORDER BY ms.end_ts DESC LIMIT 5`,
    [memberLink, tenantId]
  );
  if (ppsiSurveys.rows.length >= 4) {
    // Get section scores for all surveys (most recent first)
    const allSectionScores = [];
    for (const row of ppsiSurveys.rows) {
      const secResult = await db.query(`
        SELECT sqc.category_code, SUM(CAST(msa.answer AS INTEGER)) AS section_score
        FROM member_survey_answer msa
        JOIN survey_question sq ON sq.link = msa.question_link
        JOIN survey_question_category sqc ON sqc.link = sq.category_link
        WHERE msa.member_survey_link = $1
        GROUP BY sqc.category_code
      `, [row.link]);
      const scores = {};
      for (const r of secResult.rows) scores[r.category_code] = Number(r.section_score);
      allSectionScores.push(scores);
    }
    // Current = index 0, baseline = indices 1..N
    const current = allSectionScores[0];
    const prior = allSectionScores.slice(1);
    const domains = Object.keys(current);
    for (const domain of domains) {
      const priorVals = prior.map(s => s[domain] || 0);
      if (priorVals.length < 2) continue;
      const mean = priorVals.reduce((a, b) => a + b, 0) / priorVals.length;
      const sd = Math.sqrt(priorVals.reduce((a, v) => a + (v - mean) ** 2, 0) / priorVals.length);
      if (sd > 0 && current[domain] > mean + 1.5 * sd) domainBreadth++;
    }
  }

  // Concordance gap: signed difference (Pulse normalized - wellness normalized) on 0-100 scale.
  // ppsiCurrent is already 0..100 (math-version-aware normalization above), so
  // no further scaling. Pulse stays raw 0..42 here.
  // Positive = clinician sees more risk than self-report (Silent Slide signal)
  let concordanceGap = null;
  if (ppsiCurrent !== null && pulseCurrent !== null) {
    const pulseNorm = (pulseCurrent / 42) * 100;
    concordanceGap = Math.round((pulseNorm - ppsiCurrent) * 10) / 10;
  }

  // Chronicity: days since oldest open YELLOW-urgency stability_registry item
  // Captures duration of sustained Yellow-tier status (Chronic Borderline detector)
  let chronicity = 0;
  const yellowReg = await db.query(
    `SELECT MIN(created_date) as oldest_date
     FROM stability_registry
     WHERE member_link = $1 AND tenant_id = $2 AND urgency = 'YELLOW' AND status = 'O'`,
    [memberLink, tenantId]
  );
  if (yellowReg.rows[0]?.oldest_date) {
    const today = platformToday();
    chronicity = today - yellowReg.rows[0].oldest_date;
  }

  return {
    ppsi_current: ppsiCurrent,
    ppsi_trend: ppsiTrend,
    ppsi_volatility: ppsiVolatility,
    pulse_current: pulseCurrent,
    pulse_trend: pulseTrend,
    compliance_rate: compRate,
    compliance_misses_30d: parseInt(compTotal.rows[0].misses_30d),
    survey_completion_rate: totalSurveys > 0 ? 1.0 : 0,
    consecutive_misses: parseInt(consecutiveMisses.rows[0].cnt),
    days_since_last_ppsi: daysSinceLastPpsi,
    days_since_last_pulse: daysSinceLastPulse,
    meds_flags_30d: parseInt(medsFlags.rows[0].cnt),
    registry_open_count: parseInt(registry.rows[0].total),
    registry_red_count: parseInt(registry.rows[0].red_count),
    days_enrolled: daysEnrolled,
    // PPII composite — calcPPII is the vertical's own scoring fn. When the
    // member has no streams the `|| ppsiCurrent` fallback preserves the
    // legacy behavior that existed when this lived platform-side behind the
    // verticalCallbacks.computePpii bridge.
    ppii_current: Math.round(calcPPII({ ppsiRaw: ppsiCurrent, pulseRaw: pulseCurrent, compRaw: compRate !== null ? compRate * 100 : null, eventRaw: null, weights: ctx.caches.ppiiWeights.get(tenantId) }) || ppsiCurrent),
    domain_breadth: domainBreadth,
    concordance_gap: concordanceGap,
    chronicity: chronicity,
  };
}

/**
 * Register the vertical→platform callback. scoreMemberML (platform) calls
 * verticalCallbacks.getMemberFeatures?.(memberLink, tenantId, client) and
 * returns null when it's undefined (vertical not loaded).
 */
export function registerCallbacks(ctx) {
  ctx.registerCallback('getMemberFeatures',
    (memberLink, tenantId, client) => gatherMemberFeatures(ctx, memberLink, tenantId, client));
}

export default { registerCallbacks };
