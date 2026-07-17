/**
 * scoreCGIS.js — Score Clinical Global Impression — Severity Scale (CGI-S)
 *
 * Convergent Validation Anchor Battery — Instrument 6
 * Anchors Provider Pulse: Overall Stability Concern
 *
 * Single item, clinician-rated. Scored 1-7.
 *   1 = Normal, not at all unstable
 *   2 = Borderline concern
 *   3 = Mildly unstable
 *   4 = Moderately unstable
 *   5 = Markedly unstable
 *   6 = Severely unstable
 *   7 = Among the most extremely unstable
 *
 * Administered once per Provider Pulse assessment (item 15).
 * FDA-accepted outcome measure. Gold standard for clinician-rated global severity.
 */
export default async function scoreCGIS(surveyData, context) {
  const { answers } = surveyData;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }

  const value = parseInt(answers[0].answer, 10);
  if (isNaN(value)) {
    return { success: false, error: 'Invalid answer value' };
  }

  const labels = {
    1: 'Normal, not at all unstable',
    2: 'Borderline concern',
    3: 'Mildly unstable',
    4: 'Moderately unstable',
    5: 'Markedly unstable',
    6: 'Severely unstable',
    7: 'Among the most extremely unstable'
  };

  const signals = [];
  if (value >= 5) signals.push('CGIS_MARKED_INSTABILITY');
  else if (value >= 4) signals.push('CGIS_MODERATE_INSTABILITY');

  return {
    success: true,
    points: value,
    accrual_type: 'ANCHOR_SURVEY',
    signals,
    details: {
      instrument: 'CGI_S',
      anchor_domain: 'Provider Pulse: Overall Stability Concern',
      rating: value,
      label: labels[value] || 'Unknown',
      max_possible: 7,
      min_possible: 1
    }
  };
}
