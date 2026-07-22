/**
 * scorePHQ9.js — Score Patient Health Questionnaire-9 (PHQ-9)
 *
 * Instrument Library — Screening instrument (WisconsinPATH Stage 2, Session 130)
 * PUBLIC DOMAIN (Kroenke, Spitzer, Williams — no license required).
 *
 * 9 items. Response scale: Not at all (0) / Several days (1) /
 * More than half the days (2) / Nearly every day (3).
 * Sum items 1-9. Range 0-27. Published severity bands:
 *   0-4 minimal · 5-9 mild · 10-14 moderate · 15-19 moderately severe · 20-27 severe.
 *
 * SAFETY: item 9 (thoughts of self-harm) lives in its own question category
 * (PHQ9_SI) so this scorer can detect it. ANY answer above "Not at all" raises
 * the PHQ9_SI_POSITIVE signal, which the PHQ9_SI_ALERT bonus turns into a
 * SENTINEL stability-registry item (immediate, SLA 0) regardless of the total
 * score (v126 — Erica's confirmed word; it fired RED/24h before that).
 */
export default async function scorePHQ9(surveyData, context) {
  const { answers } = surveyData;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }

  let totalSum = 0;
  let itemCount = 0;
  let siValue = 0; // item 9 (PHQ9_SI category) answer value

  for (const a of answers) {
    const value = parseInt(a.answer, 10);
    if (isNaN(value)) continue;
    totalSum += value;
    itemCount++;
    if (a.category_code === 'PHQ9_SI' && value > siValue) siValue = value;
  }

  const signals = [];
  if (siValue > 0) signals.push('PHQ9_SI_POSITIVE');

  const severity = totalSum >= 20 ? 'Severe depression' :
                   totalSum >= 15 ? 'Moderately severe depression' :
                   totalSum >= 10 ? 'Moderate depression' :
                   totalSum >= 5  ? 'Mild depression' :
                                    'Minimal or no depression';

  return {
    success: true,
    points: totalSum,
    accrual_type: 'SCREENING',
    signals,
    details: {
      instrument: 'PHQ_9',
      purpose: 'Depression screening',
      total_score: totalSum,
      max_possible: 27,
      min_possible: 0,
      items_answered: itemCount,
      self_harm_item_value: siValue,
      self_harm_flag: siValue > 0,
      interpretation: severity
    }
  };
}
