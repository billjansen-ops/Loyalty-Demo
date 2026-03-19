/**
 * scorePPSI.js — Score the Predictive Professional Stability Index
 * 
 * 34 items across 8 sections, each scored 0-3. Maximum: 102.
 * 
 * Sections:
 *   1. Sleep Stability (5 items, max 15)
 *   2. Emotional Exhaustion / Burnout (5 items, max 15)
 *   3. Work Sustainability (5 items, max 15)
 *   4. Isolation + Support (5 items, max 15)
 *   5. Cognitive Load (5 items, max 15)
 *   6. Recovery / Routine Stability (4 items, max 12)
 *   7. Meaning + Purpose (4 items, max 12)
 *   8. Global Stability Check (1 item, max 3)
 * 
 * PPSI score becomes the base_points on the accrual activity.
 * Actual PPII composite weighting happens downstream.
 * 
 * BLOCKING: Final section weights pending from Erica.
 * Current implementation: raw sum of all answer values.
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
export default async function scorePPSI(surveyData, context) {
  const { answers } = surveyData;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }

  // Sum all answer values (each 0-3)
  let totalScore = 0;
  const sectionScores = {};
  const signals = [];
  let globalStabilityValue = null;

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
      if (!signals.includes('PPSI_Q3')) {
        signals.push('PPSI_Q3');
      }
    }

    // Track Global Stability Check (Section 8)
    if (section === 'GLOBAL') {
      globalStabilityValue = value;
    }
  }

  // Global Stability scoring 3 = immediate stabilization
  if (globalStabilityValue >= 3) {
    signals.unshift('STABILITY_IMMEDIATE');
  }

  return {
    success: true,
    points: totalScore,
    accrual_type: 'SURVEY',
    signals,
    details: {
      instrument: 'PPSI',
      total_score: totalScore,
      max_possible: 102,
      items_answered: answers.length,
      section_scores: sectionScores,
      global_stability: globalStabilityValue
    }
  };
}
