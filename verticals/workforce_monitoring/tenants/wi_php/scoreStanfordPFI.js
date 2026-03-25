/**
 * scoreStanfordPFI.js — Score Stanford Professional Fulfillment Index
 *
 * Convergent Validation Anchor Battery — Instrument 2
 * Anchors PPSI Domains 2 (Burnout), 6 (Recovery), and 7 (Meaning + Purpose)
 *
 * 16 items, 3 subscales:
 *   Professional Fulfillment (items 1-6): 0-4 (Not at all true → Completely true)
 *   Work Exhaustion (items 7-10): 0-4 (Not at all → Extremely)
 *   Interpersonal Disengagement (items 11-16): 0-4 (Not at all → Extremely)
 *
 * Scoring: Average item scores within each subscale (0-4), multiply by 25 for 0-100.
 * Burnout cut-point: average burnout item score ≥ 1.33
 * Professional fulfillment cut-point: average item score > 3.0
 *
 * Recall period: "During the past two weeks..."
 */
export default async function scoreStanfordPFI(surveyData, context) {
  const { answers } = surveyData;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }

  // Track subscale scores by category
  const subscales = {
    PFI_FULFILL: { sum: 0, count: 0 },   // items 1-6
    PFI_EXHAUST: { sum: 0, count: 0 },   // items 7-10
    PFI_DISENGAGE: { sum: 0, count: 0 }  // items 11-16
  };

  let totalSum = 0;
  let itemCount = 0;

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
  }

  // Calculate subscale averages (0-4 scale)
  const fulfillAvg = subscales.PFI_FULFILL.count > 0
    ? subscales.PFI_FULFILL.sum / subscales.PFI_FULFILL.count : null;
  const exhaustAvg = subscales.PFI_EXHAUST.count > 0
    ? subscales.PFI_EXHAUST.sum / subscales.PFI_EXHAUST.count : null;
  const disengageAvg = subscales.PFI_DISENGAGE.count > 0
    ? subscales.PFI_DISENGAGE.sum / subscales.PFI_DISENGAGE.count : null;

  // Burnout = average of Work Exhaustion + Interpersonal Disengagement
  const burnoutItems = subscales.PFI_EXHAUST.sum + subscales.PFI_DISENGAGE.sum;
  const burnoutCount = subscales.PFI_EXHAUST.count + subscales.PFI_DISENGAGE.count;
  const burnoutAvg = burnoutCount > 0 ? burnoutItems / burnoutCount : null;

  // Convert to 0-100 scale
  const fulfillScore = fulfillAvg !== null ? Math.round(fulfillAvg * 25) : null;
  const exhaustScore = exhaustAvg !== null ? Math.round(exhaustAvg * 25) : null;
  const disengageScore = disengageAvg !== null ? Math.round(disengageAvg * 25) : null;

  const signals = [];
  if (burnoutAvg !== null && burnoutAvg >= 1.33) signals.push('PFI_BURNOUT_POSITIVE');
  if (fulfillAvg !== null && fulfillAvg > 3.0) signals.push('PFI_HIGH_FULFILLMENT');

  return {
    success: true,
    points: totalSum,
    accrual_type: 'ANCHOR_SURVEY',
    signals,
    details: {
      instrument: 'STANFORD_PFI',
      anchor_domains: 'PPSI Domains 2 (Burnout), 6 (Recovery), 7 (Meaning + Purpose)',
      items_answered: itemCount,
      subscales: {
        professional_fulfillment: { avg: fulfillAvg !== null ? +fulfillAvg.toFixed(2) : null, score_100: fulfillScore },
        work_exhaustion: { avg: exhaustAvg !== null ? +exhaustAvg.toFixed(2) : null, score_100: exhaustScore },
        interpersonal_disengagement: { avg: disengageAvg !== null ? +disengageAvg.toFixed(2) : null, score_100: disengageScore }
      },
      burnout_avg: burnoutAvg !== null ? +burnoutAvg.toFixed(2) : null,
      burnout_positive: burnoutAvg !== null && burnoutAvg >= 1.33,
      fulfillment_positive: fulfillAvg !== null && fulfillAvg > 3.0
    }
  };
}
