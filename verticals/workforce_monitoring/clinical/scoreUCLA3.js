/**
 * scoreUCLA3.js — Score UCLA Loneliness Scale — 3-Item Version
 *
 * Convergent Validation Anchor Battery — Instrument 4
 * Anchors PPSI Domain 4: Isolation + Support
 *
 * 3 items. Response scale: Hardly ever (1) / Some of the time (2) / Often (3)
 * Sum items 1-3. Range 3-9. Higher = greater loneliness.
 * Score 6+ = moderate-to-high loneliness (corresponds to full 20-item UCLA range).
 */
export default async function scoreUCLA3(surveyData, context) {
  const { answers } = surveyData;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }

  let totalSum = 0;
  let itemCount = 0;

  for (const a of answers) {
    const value = parseInt(a.answer, 10);
    if (isNaN(value)) continue;
    totalSum += value;
    itemCount++;
  }

  const signals = [];
  if (totalSum >= 6) signals.push('UCLA3_HIGH_LONELINESS');

  return {
    success: true,
    points: totalSum,
    accrual_type: 'ANCHOR_SURVEY',
    signals,
    details: {
      instrument: 'UCLA_3',
      anchor_domain: 'PPSI Domain 4: Isolation + Support',
      total_score: totalSum,
      max_possible: 9,
      min_possible: 3,
      items_answered: itemCount,
      high_loneliness: totalSum >= 6,
      interpretation: totalSum >= 6 ? 'Moderate-to-high loneliness' :
                      totalSum >= 4 ? 'Some loneliness' :
                      'Low loneliness'
    }
  };
}
