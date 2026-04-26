/**
 * scorePPSI.js — Score the Predictive Professional Stability Index
 *
 * 34 items across 8 sections, each scored 0-3. Section maxes:
 *   SLEEP, BURNOUT, WORK, ISOLATION, COGNITIVE  (5 items each, max 15)
 *   RECOVERY, PURPOSE                           (4 items each, max 12)
 *   GLOBAL                                      (1 item, max 3)
 *
 * Math: Option A (per Erica, April 2026)
 *   For each section:  section_score / section_max  → fraction in [0,1]
 *   Multiply by section weight (sum of weights = 1.0)
 *   Sum across sections → multiply by 100 → final score in [0,100]
 *
 * Why Option A and not raw sum: the GLOBAL section is a single anchor question
 * intentionally weighted 1/8 by Erica's spec, but a raw 0..102 sum dilutes
 * GLOBAL into ~3% of the total. Option A normalizes per section first so each
 * section contributes its assigned weight regardless of question count.
 *
 * Subdomains + weights are passed in via context so the score is computed
 * against the tenant's CURRENT ppsi_subdomain_weight_set. Existing scored
 * surveys are unaffected — they were stored under the legacy raw-sum method
 * and their member_survey row carries score_math_version=1.
 *
 * Function signature:
 *   async function scoreFn(surveyData, context) → { success, points, accrual_type, signals, details }
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
 *   - subdomains: array of ppsi_subdomain rows (from caches.ppsiSubdomains)
 *   - subdomainWeights: { <code>: weight, ..., weight_set_id } (from caches.ppsiSubdomainWeights)
 */
export default async function scorePPSI(surveyData, context) {
  const { answers } = surveyData;
  const { subdomains, subdomainWeights } = context;

  if (!answers || !answers.length) {
    return { success: false, error: 'No answers provided' };
  }
  if (!subdomains || !subdomains.length) {
    return { success: false, error: 'No PPSI subdomains configured for tenant' };
  }
  if (!subdomainWeights || !subdomainWeights.weight_set_id) {
    return { success: false, error: 'No current PPSI subdomain weight set for tenant' };
  }

  // Per-section sums and per-section maxes from the configured subdomains.
  const subdomainByCode = {};
  for (const s of subdomains) {
    subdomainByCode[s.code] = { max: Number(s.max_value), sum: 0, count: 0 };
  }

  let rawSumLegacy = 0;          // for parity / audit logging only
  const signals = [];
  let globalStabilityValue = null;

  for (const a of answers) {
    const value = parseInt(a.answer, 10);
    if (isNaN(value)) continue;
    rawSumLegacy += value;

    const section = a.category_code || 'UNKNOWN';
    if (subdomainByCode[section]) {
      subdomainByCode[section].sum += value;
      subdomainByCode[section].count += 1;
    }

    if (value >= 3 && !signals.includes('PPSI_Q3')) {
      signals.push('PPSI_Q3');
    }
    if (section === 'GLOBAL') {
      globalStabilityValue = value;
    }
  }
  if (globalStabilityValue >= 3) {
    signals.unshift('STABILITY_IMMEDIATE');
  }

  // Option A: per-section fraction × weight, summed, ×100.
  // Sections that have no answers are skipped (their slot of the weighted sum
  // is 0 — equivalent to "no contribution").
  let weightedSum = 0;
  const sectionDetails = {};
  for (const s of subdomains) {
    const code = s.code;
    const slot = subdomainByCode[code];
    const weight = Number(subdomainWeights[code] ?? 0);
    if (slot && slot.count > 0 && slot.max > 0) {
      const fraction = slot.sum / slot.max;
      weightedSum += fraction * weight;
      sectionDetails[code] = {
        sum: slot.sum,
        max: slot.max,
        fraction: Number(fraction.toFixed(4)),
        weight: Number(weight.toFixed(4)),
        contribution: Number((fraction * weight).toFixed(4))
      };
    } else {
      sectionDetails[code] = { sum: 0, max: slot ? slot.max : Number(s.max_value), fraction: 0, weight, contribution: 0 };
    }
  }
  const optionAScore = Math.round(weightedSum * 100);

  return {
    success: true,
    points: optionAScore,
    accrual_type: 'SURVEY',
    signals,
    score_math_version: 2,
    details: {
      instrument: 'PPSI',
      math: 'option_a_section_weighted',
      score_math_version: 2,
      weight_set_id: subdomainWeights.weight_set_id,
      total_score: optionAScore,
      max_possible: 100,
      raw_sum_legacy: rawSumLegacy,         // audit only — what the v1 method would have produced
      raw_sum_max_legacy: answers.length * 3,
      items_answered: answers.length,
      section_scores: sectionDetails,
      global_stability: globalStabilityValue
    }
  };
}
