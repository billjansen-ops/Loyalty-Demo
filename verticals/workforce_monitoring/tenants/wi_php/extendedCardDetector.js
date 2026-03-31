/**
 * extendedCardDetector.js — Extended Protocol Card Detection
 * Wisconsin PHP / Insight Health Solutions
 *
 * Detects extended protocol card patterns by analyzing historical data.
 * Called from POST_ACCRUAL hook after dominant driver analysis.
 * Returns the highest-priority extended card that matches, or null.
 *
 * Cards detected here (POST_ACCRUAL triggered):
 *   M1 — Multi-Stream Convergence (3+ PPSI domains elevated)
 *   M2 — Co-Dominant Streams (top 2 streams within 5%)
 *   M3 — Self-Report/Observer Discordance (Pulse > PPSI by 15+ for 2+ months)
 *   T1 — Slow Burn (6-week cumulative PPSI +15, no single spike >8)
 *   T2 — Acute Spike (single-week PPSI >15 OR 2-week >20)
 *   T3 — Oscillator (same tier boundary crossed 3+ times in 12 weeks)
 *   T4 — Silent Disengagement (PPSI <25 AND external indicators elevated)
 *   D2 — Compound Events (2+ events in 14 days)
 *   D3 — State-Dependent Event (event while at Yellow/Orange tier)
 *
 * F1 and T5 are detected via MEDS batch (time-based, not accrual-triggered).
 *
 * Priority order (highest first): S1, T2, T4, M1, M3, T1, T3, D2, D3, T5
 */

import { normStream, PPII_MAXIMA } from './scorePPII.js';

// Priority order — first match wins
const EXTENDED_PRIORITY = ['T2', 'T4', 'M1', 'M3', 'T1', 'T3', 'D2', 'D3'];

/**
 * Main entry point. Runs all accrual-triggered detectors and returns highest-priority match.
 *
 * @param {object} db - database client
 * @param {string} memberLink - member link
 * @param {number} tenantId
 * @param {object} currentStreams - { ppsiRaw, pulseRaw, compRaw, eventRaw }
 * @param {object} priorStreams - { ppsiRaw, pulseRaw, compRaw, eventRaw }
 * @param {string} accrualType - 'SURVEY', 'PULSE', 'COMP', 'EVENT'
 * @param {object} moleculeIds - { ACCRUAL_TYPE, MEMBER_POINTS, ... } molecule_id map
 * @returns {Promise<string|null>} Extended card code (e.g., 'T1') or null
 */
export async function detectExtendedCard(db, memberLink, tenantId, currentStreams, priorStreams, accrualType, moleculeIds) {
  const results = {};

  try {
    // Run all detectors in parallel where possible
    const [m1, m2, m3, t1, t2, t3, t4, d2, d3] = await Promise.all([
      detectM1(db, memberLink, tenantId),
      detectM2(currentStreams),
      detectM3(db, memberLink, tenantId, moleculeIds),
      detectT1(db, memberLink, tenantId),
      detectT2(db, memberLink, tenantId),
      detectT3(db, memberLink, tenantId),
      detectT4(db, memberLink, tenantId, currentStreams, moleculeIds),
      detectD2(db, memberLink, tenantId, accrualType, moleculeIds),
      detectD3(db, memberLink, tenantId, accrualType),
    ]);

    results.M1 = m1;
    results.M2 = m2;
    results.M3 = m3;
    results.T1 = t1;
    results.T2 = t2;
    results.T3 = t3;
    results.T4 = t4;
    results.D2 = d2;
    results.D3 = d3;
  } catch (err) {
    console.error('Extended card detection error (non-fatal):', err.message);
    return null;
  }

  // Return highest-priority match
  for (const card of EXTENDED_PRIORITY) {
    if (results[card]) return card;
  }
  return null;
}


// ──────────────────────────────────────────────────────────────────
// M1: Multi-Stream Convergence
// Rule: 3+ PPSI domains 2+ points above personal trailing baseline
// ──────────────────────────────────────────────────────────────────
async function detectM1(db, memberLink, tenantId) {
  try {
    // Get current and trailing baseline section scores (average of prior 4 surveys)
    const surveysResult = await db.query(`
      SELECT ms.link AS member_survey_link
      FROM member_survey ms
      JOIN survey s ON s.link = ms.survey_link
      WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.respondent_type = 'S'
      ORDER BY ms.start_ts DESC
      LIMIT 5
    `, [memberLink, tenantId]);

    if (surveysResult.rows.length < 2) return false;

    const currentSurvey = surveysResult.rows[0].member_survey_link;
    const priorSurveys = surveysResult.rows.slice(1).map(r => r.member_survey_link);

    // Get current section scores
    const currentScores = await getSectionScores(db, currentSurvey);

    // Get trailing baseline (average of prior surveys)
    const baselineScores = {};
    const baselineCounts = {};
    for (const surveyLink of priorSurveys) {
      const scores = await getSectionScores(db, surveyLink);
      for (const [cat, score] of Object.entries(scores)) {
        baselineScores[cat] = (baselineScores[cat] || 0) + score;
        baselineCounts[cat] = (baselineCounts[cat] || 0) + 1;
      }
    }
    for (const cat of Object.keys(baselineScores)) {
      baselineScores[cat] = baselineScores[cat] / baselineCounts[cat];
    }

    // Count domains 2+ points above baseline
    const PPSI_DOMAINS = ['SLEEP', 'BURNOUT', 'WORK', 'ISOLATION', 'COGNITIVE', 'RECOVERY', 'PURPOSE', 'GLOBAL'];
    let elevatedCount = 0;
    for (const domain of PPSI_DOMAINS) {
      const current = currentScores[domain] || 0;
      const baseline = baselineScores[domain] || 0;
      if (current >= baseline + 2) elevatedCount++;
    }

    return elevatedCount >= 3;
  } catch (e) {
    console.error('M1 detection error:', e.message);
    return false;
  }
}


// ──────────────────────────────────────────────────────────────────
// M2: Co-Dominant Streams
// Rule: Top two PPII stream contributions within 5 percentage points
// ──────────────────────────────────────────────────────────────────
async function detectM2(currentStreams) {
  try {
    const { ppsiRaw, pulseRaw, compRaw, eventRaw } = currentStreams;

    const streams = [
      { key: 'PPSI', raw: ppsiRaw, max: PPII_MAXIMA.ppsi },
      { key: 'PULSE', raw: pulseRaw, max: PPII_MAXIMA.pulse },
      { key: 'COMPLIANCE', raw: compRaw, max: PPII_MAXIMA.compliance },
      { key: 'EVENTS', raw: eventRaw, max: PPII_MAXIMA.events },
    ].filter(s => s.raw !== null && s.raw !== undefined);

    if (streams.length < 2) return false;

    // Normalize each stream
    const normalized = streams.map(s => ({
      key: s.key,
      norm: normStream(s.raw, s.max),
    }));

    // Sort descending by normalized value
    normalized.sort((a, b) => b.norm - a.norm);

    // Check if top two are within 5 points
    const gap = normalized[0].norm - normalized[1].norm;
    return gap <= 5;
  } catch (e) {
    console.error('M2 detection error:', e.message);
    return false;
  }
}


// ──────────────────────────────────────────────────────────────────
// M3: Self-Report / Observer Discordance
// Rule: Provider Pulse equiv exceeds PPSI by >15 points for 2+ consecutive months
// ──────────────────────────────────────────────────────────────────
async function detectM3(db, memberLink, tenantId, moleculeIds) {
  try {
    // Get last 3 months of PPSI and Pulse normalized scores
    // PPSI scores (member surveys, respondent_type S)
    const ppsiHistory = await db.query(`
      SELECT COALESCE(d54.n1, 0) AS score, a.activity_date
      FROM activity a
      JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
      LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
      WHERE a.activity_type = 'A' AND a.p_link = $4
        AND NOT EXISTS (SELECT 1 FROM "5_data_4" d4b WHERE d4b.p_link = a.link AND d4b.molecule_id = $3)
      ORDER BY a.activity_date DESC LIMIT 12
    `, [moleculeIds.MEMBER_SURVEY_LINK, moleculeIds.MEMBER_POINTS, moleculeIds.PULSE_RESPONDENT_LINK, memberLink]);

    const pulseHistory = await db.query(`
      SELECT COALESCE(d54.n1, 0) AS score, a.activity_date
      FROM activity a
      JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
      LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
      WHERE a.activity_type = 'A' AND a.p_link = $3
      ORDER BY a.activity_date DESC LIMIT 12
    `, [moleculeIds.PULSE_RESPONDENT_LINK, moleculeIds.MEMBER_POINTS, memberLink]);

    if (ppsiHistory.rows.length < 2 || pulseHistory.rows.length < 2) return false;

    // Group by month and check gap
    // Simplified: check if the last 2 pulse scores normalized > ppsi normalized by 15+
    let consecutiveMonths = 0;
    const pairCount = Math.min(ppsiHistory.rows.length, pulseHistory.rows.length);

    for (let i = 0; i < Math.min(pairCount, 3); i++) {
      const ppsiNorm = normStream(Number(ppsiHistory.rows[i]?.score || 0), PPII_MAXIMA.ppsi);
      const pulseNorm = normStream(Number(pulseHistory.rows[i]?.score || 0), PPII_MAXIMA.pulse);

      if (pulseNorm > ppsiNorm + 15) {
        consecutiveMonths++;
      } else {
        break;
      }
    }

    return consecutiveMonths >= 2;
  } catch (e) {
    console.error('M3 detection error:', e.message);
    return false;
  }
}


// ──────────────────────────────────────────────────────────────────
// T1: Slow Burn
// Rule: Cumulative 6-week PPSI increase 15+ with no single-week spike >8
// ──────────────────────────────────────────────────────────────────
async function detectT1(db, memberLink, tenantId) {
  try {
    // Get last 7 PPSI survey total scores (6 weeks of deltas)
    const surveys = await db.query(`
      SELECT ms.link, ms.start_ts,
        (SELECT SUM(CAST(msa.answer AS INTEGER))
         FROM member_survey_answer msa
         JOIN survey_question sq ON sq.link = msa.question_link
         WHERE msa.member_survey_link = ms.link) AS total_score
      FROM member_survey ms
      JOIN survey s ON s.link = ms.survey_link
      WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.respondent_type = 'S'
      ORDER BY ms.start_ts DESC
      LIMIT 7
    `, [memberLink, tenantId]);

    if (surveys.rows.length < 7) return false;

    const scores = surveys.rows.map(r => Number(r.total_score || 0));

    // Check cumulative increase: oldest (index 6) to newest (index 0)
    const cumulativeIncrease = scores[0] - scores[6];
    if (cumulativeIncrease < 15) return false;

    // Check no single-week spike > 8
    for (let i = 0; i < 6; i++) {
      const weeklyDelta = scores[i] - scores[i + 1];
      if (weeklyDelta > 8) return false;
    }

    return true;
  } catch (e) {
    console.error('T1 detection error:', e.message);
    return false;
  }
}


// ──────────────────────────────────────────────────────────────────
// T2: Acute Spike
// Rule: Single-week PPSI increase >15 OR 2-week increase >20
// ──────────────────────────────────────────────────────────────────
async function detectT2(db, memberLink, tenantId) {
  try {
    const surveys = await db.query(`
      SELECT ms.link, ms.start_ts,
        (SELECT SUM(CAST(msa.answer AS INTEGER))
         FROM member_survey_answer msa
         JOIN survey_question sq ON sq.link = msa.question_link
         WHERE msa.member_survey_link = ms.link) AS total_score
      FROM member_survey ms
      JOIN survey s ON s.link = ms.survey_link
      WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.respondent_type = 'S'
      ORDER BY ms.start_ts DESC
      LIMIT 3
    `, [memberLink, tenantId]);

    if (surveys.rows.length < 2) return false;

    const scores = surveys.rows.map(r => Number(r.total_score || 0));

    // Single-week spike > 15
    if (scores[0] - scores[1] > 15) return true;

    // 2-week increase > 20
    if (scores.length >= 3 && scores[0] - scores[2] > 20) return true;

    return false;
  } catch (e) {
    console.error('T2 detection error:', e.message);
    return false;
  }
}


// ──────────────────────────────────────────────────────────────────
// T3: Oscillator
// Rule: PPSI total crosses same tier boundary 3+ times in 12 weeks
// ──────────────────────────────────────────────────────────────────
async function detectT3(db, memberLink, tenantId) {
  try {
    const surveys = await db.query(`
      SELECT ms.link, ms.start_ts,
        (SELECT SUM(CAST(msa.answer AS INTEGER))
         FROM member_survey_answer msa
         JOIN survey_question sq ON sq.link = msa.question_link
         WHERE msa.member_survey_link = ms.link) AS total_score
      FROM member_survey ms
      JOIN survey s ON s.link = ms.survey_link
      WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.respondent_type = 'S'
      ORDER BY ms.start_ts DESC
      LIMIT 12
    `, [memberLink, tenantId]);

    if (surveys.rows.length < 4) return false;

    const scores = surveys.rows.map(r => Number(r.total_score || 0));

    // Tier boundaries (PPSI total score thresholds — map to PPII tiers)
    // Using PPSI-equivalent thresholds: Yellow ~36, Orange ~56, Red ~77
    const boundaries = [36, 56, 77];

    // Count crossings for each boundary
    for (const boundary of boundaries) {
      let crossings = 0;
      for (let i = 0; i < scores.length - 1; i++) {
        const wasAbove = scores[i + 1] >= boundary;
        const isAbove = scores[i] >= boundary;
        if (wasAbove !== isAbove) crossings++;
      }
      if (crossings >= 3) return true;
    }

    return false;
  } catch (e) {
    console.error('T3 detection error:', e.message);
    return false;
  }
}


// ──────────────────────────────────────────────────────────────────
// T4: Silent Disengagement
// Rule: PPSI <25 AND (Provider Pulse equiv >35 for 2+ months
//       OR compliance quality declining 3+ weeks)
// ──────────────────────────────────────────────────────────────────
async function detectT4(db, memberLink, tenantId, currentStreams, moleculeIds) {
  try {
    const ppsiNorm = currentStreams.ppsiRaw !== null
      ? normStream(currentStreams.ppsiRaw, PPII_MAXIMA.ppsi)
      : null;

    // PPSI must be low (<25 normalized)
    if (ppsiNorm === null || ppsiNorm >= 25) return false;

    // Check Provider Pulse > 35 for 2+ consecutive submissions
    const pulseHistory = await db.query(`
      SELECT COALESCE(d54.n1, 0) AS score
      FROM activity a
      JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
      LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
      WHERE a.activity_type = 'A' AND a.p_link = $3
      ORDER BY a.activity_date DESC LIMIT 3
    `, [moleculeIds.PULSE_RESPONDENT_LINK, moleculeIds.MEMBER_POINTS, memberLink]);

    let pulseElevated = 0;
    for (const row of pulseHistory.rows) {
      const pulseNorm = normStream(Number(row.score), PPII_MAXIMA.pulse);
      if (pulseNorm > 35) {
        pulseElevated++;
      } else {
        break;
      }
    }
    if (pulseElevated >= 2) return true;

    // Check compliance quality declining 3+ weeks
    const compHistory = await db.query(`
      SELECT COALESCE(d54.n1, 0) AS score
      FROM activity a
      JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
      LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
      WHERE a.activity_type = 'A' AND a.p_link = $3
      ORDER BY a.activity_date DESC LIMIT 4
    `, [moleculeIds.COMP_RESULT, moleculeIds.MEMBER_POINTS, memberLink]);

    if (compHistory.rows.length >= 4) {
      const compScores = compHistory.rows.map(r => Number(r.score));
      let declining = true;
      for (let i = 0; i < 3; i++) {
        // Compliance: higher score = worse, so declining quality = scores increasing
        if (compScores[i] <= compScores[i + 1]) {
          declining = false;
          break;
        }
      }
      if (declining) return true;
    }

    return false;
  } catch (e) {
    console.error('T4 detection error:', e.message);
    return false;
  }
}


// ──────────────────────────────────────────────────────────────────
// D2: Compound Events
// Rule: 2+ events within 14-day window
// ──────────────────────────────────────────────────────────────────
async function detectD2(db, memberLink, tenantId, accrualType, moleculeIds) {
  try {
    // Only check when an event comes in
    if (accrualType !== 'EVENT') return false;

    const eventHistory = await db.query(`
      SELECT a.activity_date
      FROM activity a
      JOIN "5_data_1" d1 ON d1.p_link = a.link AND d1.molecule_id = $1
      JOIN molecule_value_embedded_list mvel ON mvel.molecule_id = d1.molecule_id AND mvel.link = d1.c1 AND mvel.code = 'EVENT'
      WHERE a.activity_type = 'A' AND a.p_link = $2
      ORDER BY a.activity_date DESC LIMIT 5
    `, [moleculeIds.ACCRUAL_TYPE, memberLink]);

    if (eventHistory.rows.length < 2) return false;

    // Check if 2+ events within 14 days of each other
    const dates = eventHistory.rows.map(r => new Date(r.activity_date));
    for (let i = 0; i < dates.length - 1; i++) {
      const daysBetween = (dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
      if (daysBetween <= 14) return true;
    }

    return false;
  } catch (e) {
    console.error('D2 detection error:', e.message);
    return false;
  }
}


// ──────────────────────────────────────────────────────────────────
// D3: State-Dependent Event
// Rule: Event occurs while participant is at Yellow or Orange tier
// ──────────────────────────────────────────────────────────────────
async function detectD3(db, memberLink, tenantId, accrualType) {
  try {
    // Only check when an event comes in
    if (accrualType !== 'EVENT') return false;

    // Check if member has an active registry item at Yellow or Orange
    const activeItem = await db.query(`
      SELECT 1 FROM stability_registry
      WHERE member_link = $1 AND tenant_id = $2 AND status IN ('O', 'A')
        AND urgency IN ('YELLOW', 'ORANGE')
      LIMIT 1
    `, [memberLink, tenantId]);

    return activeItem.rows.length > 0;
  } catch (e) {
    console.error('D3 detection error:', e.message);
    return false;
  }
}


// ──────────────────────────────────────────────────────────────────
// Helper: Get section scores for a member_survey
// ──────────────────────────────────────────────────────────────────
async function getSectionScores(db, memberSurveyLink) {
  const result = await db.query(`
    SELECT sqc.category_code, SUM(CAST(msa.answer AS INTEGER)) AS section_score
    FROM member_survey_answer msa
    JOIN survey_question sq ON sq.link = msa.question_link
    JOIN survey_question_category sqc ON sqc.link = sq.category_link
    WHERE msa.member_survey_link = $1
    GROUP BY sqc.category_code
  `, [memberSurveyLink]);

  const scores = {};
  for (const row of result.rows) {
    scores[row.category_code] = Number(row.section_score);
  }
  return scores;
}
