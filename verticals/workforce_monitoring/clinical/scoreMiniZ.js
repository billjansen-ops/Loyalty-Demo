/**
 * scoreMiniZ.js — Score Mini-Z Burnout and Worklife Survey
 *
 * Convergent Validation Anchor Battery — Instrument 3
 * Anchors PPSI Domain 3 (Work Sustainability) + single-item burnout anchor for Domain 8 (Global)
 *
 * 10 items, various scales (all 1-5).
 * Subscale 1: Supportive Work Environment (items 1-5)
 * Subscale 2: Work Pace / EMR Stress (items 6-10)
 * Item 3 alone = validated single-item burnout measure (3-5 = burnout; validated against MBI-EE, r=0.64)
 *
 * Scoring: Sum items 1-10 (range 10-50; ≥40 = joyful workplace)
 */
export default async function scoreMiniZ(surveyData, context) {
  const { answers } = surveyData;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }

  let totalSum = 0;
  let itemCount = 0;
  let burnoutItem = null; // item 3 — single-item burnout
  const subscales = {
    MINIZ_WORK_ENV: { sum: 0, count: 0 },   // items 1-5
    MINIZ_PACE: { sum: 0, count: 0 }         // items 6-10
  };

  for (const a of answers) {
    const value = parseInt(a.answer, 10);
    if (isNaN(value)) continue;
    totalSum += value;
    itemCount++;

    const cat = a.category_code || 'UNKNOWN';
    if (subscales[cat]) {
      subscales[cat].sum += value;
      subscales[cat].count++;
    }

    // Item 3 is the burnout self-classification (identified by display_order via category)
    // We track it by looking for the MINIZ_BURNOUT category
    if (cat === 'MINIZ_BURNOUT') {
      burnoutItem = value;
    }
  }

  const signals = [];
  if (burnoutItem !== null && burnoutItem >= 3) signals.push('MINIZ_BURNOUT_POSITIVE');
  if (totalSum >= 40) signals.push('MINIZ_JOYFUL_WORKPLACE');

  return {
    success: true,
    points: totalSum,
    accrual_type: 'ANCHOR_SURVEY',
    signals,
    details: {
      instrument: 'MINI_Z',
      anchor_domain: 'PPSI Domain 3: Work Sustainability',
      total_score: totalSum,
      max_possible: 50,
      min_possible: 10,
      items_answered: itemCount,
      subscales: {
        supportive_work_env: subscales.MINIZ_WORK_ENV,
        work_pace_stress: subscales.MINIZ_PACE
      },
      burnout_item: burnoutItem,
      burnout_positive: burnoutItem !== null && burnoutItem >= 3,
      joyful_workplace: totalSum >= 40
    }
  };
}
