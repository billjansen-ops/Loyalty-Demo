/**
 * scoreGAD7.js — Score Generalized Anxiety Disorder Scale (GAD-7)
 *
 * Instrument Library — Screening instrument (WisconsinPATH Stage 2, Session 130)
 * PUBLIC DOMAIN (Spitzer, Kroenke, Williams, Löwe — no license required).
 *
 * 7 items. Response scale: Not at all (0) / Several days (1) /
 * More than half the days (2) / Nearly every day (3).
 * Sum items 1-7. Range 0-21. Published severity bands:
 *   0-4 minimal · 5-9 mild · 10-14 moderate · 15-21 severe.
 *
 * No per-item safety signal (GAD-7 has no self-harm item). Severity-band alert
 * thresholds are a clinical-protocol question for Erica — not wired until she
 * answers; the band rides in details for the chart meanwhile.
 */
export default async function scoreGAD7(surveyData, context) {
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

  const severity = totalSum >= 15 ? 'Severe anxiety' :
                   totalSum >= 10 ? 'Moderate anxiety' :
                   totalSum >= 5  ? 'Mild anxiety' :
                                    'Minimal or no anxiety';

  return {
    success: true,
    points: totalSum,
    accrual_type: 'SCREENING',
    signals: [],
    details: {
      instrument: 'GAD_7',
      purpose: 'Anxiety screening',
      total_score: totalSum,
      max_possible: 21,
      min_possible: 0,
      items_answered: itemCount,
      interpretation: severity
    }
  };
}
