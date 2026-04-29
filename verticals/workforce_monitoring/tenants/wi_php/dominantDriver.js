/**
 * dominantDriver.js — Dominant Driver Analysis
 * Wisconsin PHP / Insight Health Solutions
 *
 * Identifies WHY a PPII composite score crossed a threshold.
 * Same score, different cause, different response.
 *
 * When a registry item is created, the system compares current vs. prior
 * period stream contributions. The stream with the largest week-over-week
 * increase is the Dominant Driver. If PPSI is dominant, drills into
 * sub-domains. Result stored on registry item + maps to protocol card.
 *
 * PPSI Sub-domain codes (Cards A1-A8):
 *   SLEEP, BURNOUT, WORK, ISOLATION, COGNITIVE, RECOVERY, PURPOSE, GLOBAL
 *
 * Provider Pulse signal codes (Cards P1-P5):
 *   PROVIDER (P1), SLEEP (P2), ENGAGEMENT (P3), MOOD+FUNCTION (P4), SAFETY (P5)
 *
 * Stream-level cards: A (PPSI), B (PULSE), C (COMPLIANCE), D (EVENTS)
 */

import { normStream, PPII_MAXIMA } from './scorePPII.js';

// PPSI sub-domain → protocol card mapping
const PPSI_CARD_MAP = {
  SLEEP:     'A1',
  BURNOUT:   'A2',
  WORK:      'A3',
  ISOLATION: 'A4',
  COGNITIVE: 'A5',
  RECOVERY:  'A6',
  PURPOSE:   'A7',
  GLOBAL:    'A8',
};

// Provider Pulse signal → protocol card mapping
// category_code from survey_question_category
const PULSE_CARD_MAP = {
  PROVIDER:   'P1',   // Provider Stability Concern
  SLEEP:      'P2',   // Sleep Reduction (uses SLEEP category in Pulse survey context)
  ENGAGEMENT: 'P3',   // Treatment Engagement
  MOOD:       'P4',   // Mood + Workload (MOOD + FUNCTION combined)
  FUNCTION:   'P4',   // Combined with MOOD into P4
  SAFETY:     'P5',   // Safety Concern (if present as category)
};

// Stream → pathway card mapping (when no sub-domain drill-down)
const STREAM_CARD_MAP = {
  PPSI:       'A',
  PULSE:      'B',
  COMPLIANCE: 'C',
  EVENTS:     'D',
};

/**
 * Identify the dominant driver by comparing current vs. prior stream scores.
 *
 * @param {object} current - { ppsiRaw, pulseRaw, compRaw, eventRaw } current period raw scores
 * @param {object} prior   - { ppsiRaw, pulseRaw, compRaw, eventRaw } prior period raw scores (nulls OK)
 * @returns {{ driver: string, card: string }} e.g. { driver: 'PPSI', card: 'A' }
 */
export function identifyDominantStream(current, prior) {
  const streams = [
    { key: 'PPSI',       curr: current.ppsiRaw,  prev: prior.ppsiRaw,  max: PPII_MAXIMA.ppsi },
    { key: 'PULSE',      curr: current.pulseRaw, prev: prior.pulseRaw, max: PPII_MAXIMA.pulse },
    { key: 'COMPLIANCE', curr: current.compRaw,  prev: prior.compRaw,  max: PPII_MAXIMA.compliance },
    { key: 'EVENTS',     curr: current.eventRaw, prev: prior.eventRaw, max: PPII_MAXIMA.events },
  ];

  let bestStream = null;
  let bestDelta = -Infinity;

  for (const s of streams) {
    if (s.curr === null || s.curr === undefined) continue;

    const currNorm = normStream(s.curr, s.max);
    const prevNorm = (s.prev !== null && s.prev !== undefined) ? normStream(s.prev, s.max) : 0;
    const delta = currNorm - prevNorm;

    // Largest increase wins. Ties broken by highest absolute current value.
    if (delta > bestDelta || (delta === bestDelta && bestStream && currNorm > normStream(bestStream.curr, bestStream.max))) {
      bestDelta = delta;
      bestStream = s;
    }
  }

  // Fallback: if no stream increased (all flat or declined), use highest current normalized score
  if (!bestStream || bestDelta <= 0) {
    let highest = null;
    let highestNorm = -1;
    for (const s of streams) {
      if (s.curr === null || s.curr === undefined) continue;
      const n = normStream(s.curr, s.max);
      if (n > highestNorm) { highestNorm = n; highest = s; }
    }
    if (highest) bestStream = highest;
  }

  if (!bestStream) return { driver: null, card: null };

  return {
    driver: bestStream.key,
    card: STREAM_CARD_MAP[bestStream.key] || null,
  };
}

// Per-section maximum raw score (question_count × 3). Used to normalize the
// raw section delta into a 0..1 fraction before applying the section weight.
// These are tenant-invariant for wi_php's PPSI design (matches scorePPSI.js
// header). Hardcoded here so the drill-down doesn't need a DB roundtrip per
// call — but if this list ever drifts from ppsi_subdomain.max_value, this is
// where to sync it.
const PPSI_SECTION_MAXIMA = {
  SLEEP: 15, BURNOUT: 15, WORK: 15, ISOLATION: 15, COGNITIVE: 15,
  RECOVERY: 12, PURPOSE: 12,
  GLOBAL: 3
};

/**
 * Drill into PPSI sub-domains to find which section moved most.
 * Compares current vs. prior survey section scores.
 *
 * When `subdomainWeights` is supplied, the routing weights each section's
 * delta by `(delta / section_max) × section_weight` before picking the max
 * — i.e. the same Option A transform the scorer uses, applied at the
 * routing layer too. Without weights we fall back to raw deltas, preserving
 * the legacy behavior used by the backfill script and any caller that
 * doesn't have the cache plumbed in.
 *
 * @param {object} db - database client
 * @param {string} memberLink - member link
 * @param {number} tenantId
 * @param {object} [subdomainWeights] - { <code>: weight, weight_set_id, ... } from caches.ppsiSubdomainWeights
 * @returns {{ subdomain: string, card: string } | null}
 */
export async function identifyPPSISubdomain(db, memberLink, tenantId, subdomainWeights) {
  // Get the two most recent PPSI surveys for this member
  // PPSI surveys are respondent_type 'S' (self-report), not 'T' (third-party/pulse)
  const surveysResult = await db.query(`
    SELECT ms.link AS member_survey_link
    FROM member_survey ms
    JOIN survey s ON s.link = ms.survey_link
    WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.respondent_type = 'S'
    ORDER BY ms.start_ts DESC
    LIMIT 2
  `, [memberLink, tenantId]);

  if (surveysResult.rows.length === 0) return null;

  const currentSurveyLink = surveysResult.rows[0].member_survey_link;
  const priorSurveyLink = surveysResult.rows.length > 1 ? surveysResult.rows[1].member_survey_link : null;

  // Get section scores for current survey
  const currentSections = await getSectionScores(db, currentSurveyLink);

  // Get section scores for prior survey (if exists)
  const priorSections = priorSurveyLink ? await getSectionScores(db, priorSurveyLink) : {};

  // Find section with largest increase (only PPSI sections: categories 1-8).
  // When subdomainWeights is supplied we pick the section whose *weighted
  // contribution* moved most — that's what actually drove the PPSI score
  // change under Option A math. Without weights, fall back to raw delta
  // (legacy behavior — used by the backfill script and any caller that
  // doesn't pass weights through).
  const PPSI_CATEGORIES = ['SLEEP', 'BURNOUT', 'WORK', 'ISOLATION', 'COGNITIVE', 'RECOVERY', 'PURPOSE', 'GLOBAL'];

  let bestCategory = null;
  let bestDelta = -Infinity;
  let bestScore = -1;

  for (const cat of PPSI_CATEGORIES) {
    const curr = currentSections[cat] || 0;
    const prev = priorSections[cat] || 0;
    const rawDelta = curr - prev;
    let scoreForRanking;
    if (subdomainWeights) {
      const max = PPSI_SECTION_MAXIMA[cat] || 1;
      const w = Number(subdomainWeights[cat] ?? 0);
      // Weighted contribution delta: same Option A transform as the scorer.
      scoreForRanking = (rawDelta / max) * w;
    } else {
      scoreForRanking = rawDelta;
    }

    if (scoreForRanking > bestDelta || (scoreForRanking === bestDelta && curr > bestScore)) {
      bestDelta = scoreForRanking;
      bestCategory = cat;
      bestScore = curr;
    }
  }

  // Fallback: if no section increased, use highest absolute section score
  // (raw — fallback path runs identically regardless of weights).
  if (!bestCategory || bestDelta <= 0) {
    for (const cat of PPSI_CATEGORIES) {
      const curr = currentSections[cat] || 0;
      if (curr > bestScore) { bestScore = curr; bestCategory = cat; }
    }
  }

  if (!bestCategory) return null;

  return {
    subdomain: bestCategory,
    card: PPSI_CARD_MAP[bestCategory] || 'A',
  };
}

/**
 * Drill into Provider Pulse sections to find which signal moved most.
 *
 * @param {object} db - database client
 * @param {string} memberLink - member link
 * @param {number} tenantId
 * @returns {{ subdomain: string, card: string } | null}
 */
export async function identifyPulseSignal(db, memberLink, tenantId) {
  // Get the two most recent Pulse surveys (respondent_type 'T' = third-party)
  const surveysResult = await db.query(`
    SELECT ms.link AS member_survey_link
    FROM member_survey ms
    JOIN survey s ON s.link = ms.survey_link
    WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.respondent_type = 'T'
    ORDER BY ms.start_ts DESC
    LIMIT 2
  `, [memberLink, tenantId]);

  if (surveysResult.rows.length === 0) return null;

  const currentSurveyLink = surveysResult.rows[0].member_survey_link;
  const priorSurveyLink = surveysResult.rows.length > 1 ? surveysResult.rows[1].member_survey_link : null;

  const currentSections = await getSectionScores(db, currentSurveyLink);
  const priorSections = priorSurveyLink ? await getSectionScores(db, priorSurveyLink) : {};

  const PULSE_CATEGORIES = ['ENGAGEMENT', 'MOOD', 'FUNCTION', 'PROVIDER'];

  let bestCategory = null;
  let bestDelta = -Infinity;
  let bestScore = -1;

  for (const cat of PULSE_CATEGORIES) {
    const curr = currentSections[cat] || 0;
    const prev = priorSections[cat] || 0;
    const delta = curr - prev;

    if (delta > bestDelta || (delta === bestDelta && curr > bestScore)) {
      bestDelta = delta;
      bestCategory = cat;
      bestScore = curr;
    }
  }

  if (!bestCategory || bestDelta <= 0) {
    for (const cat of PULSE_CATEGORIES) {
      const curr = currentSections[cat] || 0;
      if (curr > bestScore) { bestScore = curr; bestCategory = cat; }
    }
  }

  if (!bestCategory) return null;

  return {
    subdomain: bestCategory,
    card: PULSE_CARD_MAP[bestCategory] || 'B',
  };
}

/**
 * Get section scores for a given member_survey — sum of answers grouped by category_code.
 *
 * @param {object} db - database client
 * @param {number} memberSurveyLink
 * @returns {object} e.g. { SLEEP: 5, BURNOUT: 8, ... }
 */
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

/**
 * Full dominant driver analysis. Called when a registry item is about to be created.
 * Returns driver, subdomain, and protocol card.
 *
 * @param {object} db - database client
 * @param {string} memberLink - member link
 * @param {number} tenantId
 * @param {object} currentStreams - { ppsiRaw, pulseRaw, compRaw, eventRaw }
 * @param {object} priorStreams  - { ppsiRaw, pulseRaw, compRaw, eventRaw }
 * @returns {{ dominant_driver: string, dominant_subdomain: string|null, protocol_card: string }}
 */
export async function analyzeDominantDriver(db, memberLink, tenantId, currentStreams, priorStreams, subdomainWeights) {
  // Step 1: Identify which stream is the dominant driver
  const { driver, card } = identifyDominantStream(currentStreams, priorStreams);

  if (!driver) {
    return { dominant_driver: null, dominant_subdomain: null, protocol_card: null };
  }

  // Step 2: If PPSI dominant, drill into sub-domains. subdomainWeights, if
  // present, makes the drill-down weight-aware (matches scorer semantics).
  if (driver === 'PPSI') {
    const sub = await identifyPPSISubdomain(db, memberLink, tenantId, subdomainWeights);
    if (sub) {
      return { dominant_driver: driver, dominant_subdomain: sub.subdomain, protocol_card: sub.card };
    }
    return { dominant_driver: driver, dominant_subdomain: null, protocol_card: card };
  }

  // Step 3: If Provider Pulse dominant, drill into signals
  if (driver === 'PULSE') {
    const sig = await identifyPulseSignal(db, memberLink, tenantId);
    if (sig) {
      return { dominant_driver: driver, dominant_subdomain: sig.subdomain, protocol_card: sig.card };
    }
    return { dominant_driver: driver, dominant_subdomain: null, protocol_card: card };
  }

  // Step 4: Compliance or Events — no sub-domain drill-down
  return { dominant_driver: driver, dominant_subdomain: null, protocol_card: card };
}
