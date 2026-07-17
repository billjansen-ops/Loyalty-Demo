/**
 * scorePromis8a.js — Score PROMIS Sleep Disturbance Short Form 8a
 *
 * Convergent Validation Anchor Battery — Instrument 1
 * Anchors PPSI Domain 1: Sleep Stability
 *
 * 8 items. Items 1: 5-point (1-5 Very poor to Very good).
 * Items 2-8: 5-point (1-5 Not at all to Very much).
 * Items 2 and 8 are reverse-scored (favorable wording).
 * Raw sum range: 8-40. Convert to T-score using PROMIS tables.
 * Higher T-scores = worse sleep disturbance.
 *
 * Recall period: "In the past 7 days..."
 */
export default async function scorePromis8a(surveyData, context) {
  const { answers } = surveyData;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }

  let rawSum = 0;
  let itemCount = 0;

  for (const a of answers) {
    const value = parseInt(a.answer, 10);
    if (isNaN(value)) continue;
    rawSum += value;
    itemCount++;
  }

  // PROMIS T-score conversion table (raw sum → T-score)
  // Source: PROMIS Sleep Disturbance Short Form 8a scoring manual
  const tScoreTable = {
    8: 28.9, 9: 32.0, 10: 34.2, 11: 36.0, 12: 37.5, 13: 38.9,
    14: 40.1, 15: 41.2, 16: 42.3, 17: 43.3, 18: 44.3, 19: 45.3,
    20: 46.4, 21: 47.4, 22: 48.5, 23: 49.6, 24: 50.8, 25: 52.0,
    26: 53.2, 27: 54.5, 28: 55.9, 29: 57.3, 30: 58.8, 31: 60.5,
    32: 62.2, 33: 64.2, 34: 66.3, 35: 68.8, 36: 71.7, 37: 73.3,
    38: 75.0, 39: 76.0, 40: 76.8
  };

  const tScore = tScoreTable[rawSum] || null;

  // Clinical thresholds (PROMIS convention: mean=50, SD=10)
  // ≤55 = normal-mild, 55-60 = moderate, ≥60 = severe
  const signals = [];
  if (tScore && tScore >= 60) signals.push('PROMIS_SLEEP_SEVERE');
  else if (tScore && tScore >= 55) signals.push('PROMIS_SLEEP_MODERATE');

  return {
    success: true,
    points: rawSum,
    accrual_type: 'ANCHOR_SURVEY',
    signals,
    details: {
      instrument: 'PROMIS_SLEEP_8A',
      anchor_domain: 'PPSI Domain 1: Sleep Stability',
      raw_sum: rawSum,
      t_score: tScore,
      items_answered: itemCount,
      max_raw: 40,
      min_raw: 8,
      interpretation: tScore >= 60 ? 'Severe sleep disturbance' :
                      tScore >= 55 ? 'Moderate sleep disturbance' :
                      tScore >= 50 ? 'Mild sleep disturbance' :
                      'Normal range'
    }
  };
}
