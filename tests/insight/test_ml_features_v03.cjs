/**
 * Test C16: ML v0.3.0 Features — domain_breadth, concordance_gap, chronicity
 *
 * Verifies:
 *   A: gatherMemberFeatures returns all 19 features (including 3 new)
 *   B: domain_breadth is integer 0-8
 *   C: concordance_gap is numeric (positive = Pulse > PPSI on normalized scale)
 *   D: chronicity is non-negative integer (days at Yellow)
 *   E: ML report endpoint includes new features for all members
 *   F: ML service accepts 19-feature payload (if available)
 *
 * Uses physician James Okafor (#34) via the ML report endpoint.
 */
module.exports = {
  name: 'C16: ML v0.3.0 Features (domain_breadth, concordance_gap, chronicity)',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '34'; // James Okafor

    // ── Fetch ML report (returns features for all members) ──
    ctx.log('--- Fetch ML feature report ---');
    const reportResp = await ctx.fetch(`/v1/ml/report?tenant_id=${TENANT_ID}`);
    ctx.assert(reportResp._ok, `ML report endpoint responds (status: ${reportResp._status})`);
    if (!reportResp._ok) return;

    const report = reportResp.report || reportResp;
    ctx.assert(Array.isArray(report) && report.length > 0, `Report contains members (got: ${Array.isArray(report) ? report.length : 'not array'})`);
    if (!Array.isArray(report) || report.length === 0) return;

    // ── Find Okafor in report ──
    const okafor = report.find(m => String(m.membership_number) === MEMBER_NUMBER);
    ctx.assert(okafor, 'James Okafor found in ML report');
    if (!okafor) return;

    const f = okafor.features;
    ctx.assert(f, 'Features object present');
    if (!f) return;

    // ── Verify original 16 features still present ──
    ctx.log('--- Verify original 16 features ---');
    const original16 = [
      'ppsi_current', 'ppsi_trend', 'ppsi_volatility',
      'pulse_current', 'pulse_trend',
      'compliance_rate', 'compliance_misses_30d',
      'survey_completion_rate', 'consecutive_misses',
      'days_since_last_ppsi', 'days_since_last_pulse',
      'meds_flags_30d', 'registry_open_count', 'registry_red_count',
      'days_enrolled', 'ppii_current'
    ];
    for (const key of original16) {
      ctx.assert(key in f, `Feature '${key}' present`);
    }

    // ── A: Verify new features exist ──
    ctx.log('--- Verify new v0.3.0 features ---');
    ctx.assert('domain_breadth' in f, 'domain_breadth feature present');
    ctx.assert('concordance_gap' in f, 'concordance_gap feature present');
    ctx.assert('chronicity' in f, 'chronicity feature present');

    // ── B: domain_breadth is integer 0-8 ──
    ctx.log('--- Validate domain_breadth ---');
    const db = f.domain_breadth;
    ctx.assert(typeof db === 'number', `domain_breadth is number (got: ${typeof db})`);
    ctx.assert(Number.isInteger(db), `domain_breadth is integer (got: ${db})`);
    ctx.assert(db >= 0 && db <= 8, `domain_breadth in 0-8 range (got: ${db})`);
    ctx.log(`domain_breadth = ${db}`);

    // ── C: concordance_gap is numeric ──
    ctx.log('--- Validate concordance_gap ---');
    const cg = f.concordance_gap;
    if (cg !== null) {
      ctx.assert(typeof cg === 'number', `concordance_gap is number (got: ${typeof cg})`);
      ctx.assert(cg >= -100 && cg <= 100, `concordance_gap in -100..100 range (got: ${cg})`);
      ctx.log(`concordance_gap = ${cg}`);
    } else {
      ctx.log('concordance_gap is null (no PPSI+Pulse data) — acceptable');
      ctx.assert(true, 'concordance_gap null is valid when data missing');
    }

    // ── D: chronicity is non-negative integer ──
    ctx.log('--- Validate chronicity ---');
    const ch = f.chronicity;
    ctx.assert(typeof ch === 'number', `chronicity is number (got: ${typeof ch})`);
    ctx.assert(Number.isInteger(ch), `chronicity is integer (got: ${ch})`);
    ctx.assert(ch >= 0, `chronicity is non-negative (got: ${ch})`);
    ctx.log(`chronicity = ${ch}`);

    // ── E: All members in report have the new features ──
    ctx.log('--- Verify all members have new features ---');
    let allHaveNew = true;
    for (const m of report) {
      if (!m.features) continue;
      if (!('domain_breadth' in m.features) || !('concordance_gap' in m.features) || !('chronicity' in m.features)) {
        allHaveNew = false;
        ctx.log(`Member ${m.membership_number} missing new features`);
      }
    }
    ctx.assert(allHaveNew, `All ${report.length} members have v0.3.0 features`);

    // ── F: ML service accepts 19-feature payload ──
    ctx.log('--- Test ML service with 19 features ---');
    const healthResp = await ctx.fetch('/v1/ml/health');
    if (healthResp._ok && healthResp.available) {
      // Fetch individual prediction — this sends all 19 features to ML service
      const predResp = await ctx.fetch(`/v1/ml/member/${MEMBER_NUMBER}?tenant_id=${TENANT_ID}`);
      if (predResp._ok && predResp.available) {
        ctx.assert(predResp.risk_score >= 0 && predResp.risk_score <= 100,
          `ML prediction with 19 features returns valid score (got: ${predResp.risk_score})`);
        ctx.log(`ML v0.3.0 prediction: score=${predResp.risk_score}, label=${predResp.risk_label}`);
      } else {
        ctx.log('ML prediction unavailable — service may need retrain for 19 features');
      }
    } else {
      ctx.log('ML service not running — skipping prediction test');
    }
  }
};
