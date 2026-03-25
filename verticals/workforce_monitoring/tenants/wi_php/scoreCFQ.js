/**
 * scoreCFQ.js — Score Cognitive Failures Questionnaire (Selected Items)
 *
 * Convergent Validation Anchor Battery — Instrument 5
 * Anchors PPSI Domain 5: Cognitive Load
 *
 * 8 items selected from the 25-item CFQ.
 * Response scale: Very often (4) / Quite often (3) / Occasionally (2) / Very rarely (1) / Never (0)
 * Sum items 1-8. Range 0-32. Higher = more frequent cognitive failures.
 *
 * Recall period: "In the past month"
 */
export default async function scoreCFQ(surveyData, context) {
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

  // CFQ norms: mean ~33 on full 25-item (SD ~11).
  // For 8-item subset, proportional mean ~10.6, high concern ~20+
  const signals = [];
  if (totalSum >= 20) signals.push('CFQ_HIGH_COGNITIVE_FAILURES');
  else if (totalSum >= 14) signals.push('CFQ_MODERATE_COGNITIVE_FAILURES');

  return {
    success: true,
    points: totalSum,
    accrual_type: 'ANCHOR_SURVEY',
    signals,
    details: {
      instrument: 'CFQ_SELECTED',
      anchor_domain: 'PPSI Domain 5: Cognitive Load',
      total_score: totalSum,
      max_possible: 32,
      min_possible: 0,
      items_answered: itemCount,
      interpretation: totalSum >= 20 ? 'High cognitive failures' :
                      totalSum >= 14 ? 'Moderate cognitive failures' :
                      totalSum >= 7 ? 'Some cognitive failures' :
                      'Low cognitive failures'
    }
  };
}
