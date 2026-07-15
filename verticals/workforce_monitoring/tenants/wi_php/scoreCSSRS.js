/**
 * scoreCSSRS.js — Score the Columbia Suicide Severity Rating Scale screener
 *
 * Instrument Library — Screening instrument (Intake Phase 2, Session 143).
 * The C-SSRS screener is free for clinical use via the Columbia Lighthouse
 * Project (license label left for Erica to confirm, like the anchors).
 *
 * 6 items, Yes (1) / No (0), in three escalating question categories:
 *   CSSRS_IDEA — items 1-2: wish to be dead; suicidal thoughts.
 *   CSSRS_PLAN — items 3-5: thoughts with method; intent; intent with plan.
 *   CSSRS_ACT  — item 6: suicidal behavior (ever / recent).
 *
 * SAFETY (Erica's spec §3): the WisconsinPATH process performs a Columbia
 * screening AT INTAKE, before enrollment. A positive Columbia is a real
 * clinical signal and fires a SENTINEL into the Stability Registry
 * immediately, whether or not the individual ever becomes a participant —
 * the ONE deliberate intake→registry wire. ANY "Yes" raises CSSRS_POSITIVE
 * (the same maximum-conservative posture as the PHQ-9 item-9 alert); the
 * clinical team reads severity from the highest category endorsed in the
 * details. The threshold is protocol, not code — Erica can narrow it.
 */
export default async function scoreCSSRS(surveyData, context) {
  const { answers } = surveyData;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }

  const LEVELS = { CSSRS_IDEA: 1, CSSRS_PLAN: 2, CSSRS_ACT: 3 };
  let itemCount = 0;
  let yesCount = 0;
  let highestLevel = 0; // the most severe category answered Yes

  for (const a of answers) {
    const value = parseInt(a.answer, 10);
    if (isNaN(value)) continue;
    itemCount++;
    if (value > 0) {
      yesCount++;
      const level = LEVELS[a.category_code] || 0;
      if (level > highestLevel) highestLevel = level;
    }
  }

  const signals = [];
  if (yesCount > 0) signals.push('CSSRS_POSITIVE');

  const interpretation =
    highestLevel >= 3 ? 'Positive — suicidal behavior reported' :
    highestLevel >= 2 ? 'Positive — ideation with method, intent, or plan' :
    highestLevel >= 1 ? 'Positive — suicidal ideation' :
                        'Negative screen';

  return {
    success: true,
    points: yesCount,
    accrual_type: 'SCREENING',
    signals,
    details: {
      instrument: 'C_SSRS',
      purpose: 'Suicide risk screening (Columbia)',
      items_answered: itemCount,
      yes_count: yesCount,
      highest_level_endorsed: highestLevel,
      positive: yesCount > 0,
      interpretation
    }
  };
}
