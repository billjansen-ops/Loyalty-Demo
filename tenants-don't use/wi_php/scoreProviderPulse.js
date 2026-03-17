/**
 * scoreProviderPulse.js — Score the Provider Pulse Survey
 * 
 * 14 items across 7 sections, each scored 0-3. Maximum: 42.
 * Completed by treating clinician (psychiatrist, therapist, PHP physician)
 * about a member (physician). Monthly or after clinical encounters.
 * 
 * Sections:
 *   1. Provider Stability Concern (2 items, max 6)
 *   2. Sleep / Fatigue Indicators (2 items, max 6)
 *   3. Treatment Engagement (2 items, max 6)
 *   4. Mood / Affect Stability (2 items, max 6)
 *   5. Workload / Sustainability (2 items, max 6)
 *   6. Safety Concerns (2 items, max 6)
 *   7. Provider Stability Alert (2 items, max 6)
 * 
 * Escalation rules:
 *   - Any individual item scoring 3 triggers escalation
 *   - "Immediate stabilization recommended" = hard override to Red (Trigger 6)
 *   - "Emerging instability concern" = bump up one tier (Trigger 7)
 * 
 * Provider Pulse score becomes the base_points on the accrual activity.
 * Actual PPII composite weighting happens downstream.
 * 
 * Function signature:
 *   async function scoreFn(surveyData, context) → { success, points, accrual_type, details }
 * 
 * surveyData:
 *   - member_link: CHAR(5) member link
 *   - member_survey_link: INTEGER member_survey.link
 *   - survey_link: SMALLINT survey.link  
 *   - answers: [{ question_link, answer, category_code, category_name }]
 *   - tenant_id: SMALLINT
 * 
 * context:
 *   - db: database client (within transaction)
 *   - tenantId: SMALLINT
 */
export default async function scoreProviderPulse(surveyData, context) {
  const { answers } = surveyData;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }

  // Sum all answer values (each 0-3)
  let totalScore = 0;
  const sectionScores = {};
  let hasEscalation = false;
  const escalationItems = [];
  const signals = [];
  let stabilityAlertValue = null;

  for (const a of answers) {
    const value = parseInt(a.answer, 10);
    if (isNaN(value)) continue;
    totalScore += value;

    // Track per-section scores for details
    const section = a.category_code || 'UNKNOWN';
    if (!sectionScores[section]) sectionScores[section] = 0;
    sectionScores[section] += value;

    // Any individual item scoring 3 triggers escalation
    if (value >= 3) {
      hasEscalation = true;
      escalationItems.push({
        section,
        question_link: a.question_link,
        value
      });
      // PULSE_Q3 signal — any question scored 3
      if (!signals.includes('PULSE_Q3')) {
        signals.push('PULSE_Q3');
      }
    }

    // Provider Stability Alert (category PROVIDER, question 48)
    if (section === 'PROVIDER') {
      stabilityAlertValue = value;
    }
  }

  // Provider Stability Alert signals (most severe — put first)
  if (stabilityAlertValue >= 3) {
    signals.unshift('STABILITY_IMMEDIATE');
  } else if (stabilityAlertValue >= 2) {
    signals.unshift('STABILITY_EMERGING');
  }

  return {
    success: true,
    points: totalScore,
    accrual_type: 'PULSE',
    signals,
    details: {
      instrument: 'PROVPULSE',
      total_score: totalScore,
      max_possible: 42,
      items_answered: answers.length,
      section_scores: sectionScores,
      has_escalation: hasEscalation,
      escalation_items: escalationItems,
      stability_alert: stabilityAlertValue
    }
  };
}
