/**
 * Test C17: PPSI sub-domain routing respects current section weights.
 *
 * Regression test for the Option A integration: when section weights are
 * non-equal, the dominant-driver drill-down must rank sections by their
 * *weighted contribution* delta, not their raw section delta. Otherwise the
 * routing can send a participant to the wrong protocol card — exactly the
 * mismatch Erica flagged.
 *
 * The two ranking modes diverge most cleanly with this scenario:
 *   Section deltas: SLEEP +10 (raw biggest), GLOBAL +3
 *   Weights:        SLEEP=0.05, GLOBAL=0.50
 *   Raw winner:     SLEEP    (delta = +10)
 *   Weighted winner: GLOBAL  ((3/3) × 0.50 = 0.500 vs (10/15) × 0.05 = 0.033)
 *
 * Tests pickPPSIDriverSection directly (the pure function extracted from
 * identifyPPSISubdomain) so the assertion doesn't depend on threshold
 * crossing or registry-item creation.
 */
module.exports = {
  name: 'C17: PPSI sub-domain routing respects section weights',

  async run(ctx) {
    // Dynamic-import the ESM scorer module from CJS test runner.
    const mod = await import('../../verticals/workforce_monitoring/tenants/wi_php/dominantDriver.js');
    const pick = mod.pickPPSIDriverSection;
    ctx.assert(typeof pick === 'function', 'pickPPSIDriverSection is exported as a function');

    // ── Scenario 1: raw delta winner ≠ weighted winner ────────────────────
    // SLEEP +10 raw (biggest delta) vs GLOBAL +3 raw (anchor section).
    // Under SLEEP-emphasis weights both modes pick SLEEP (no divergence test).
    // Under GLOBAL-emphasis weights, only the weighted path picks GLOBAL.
    const current = { SLEEP: 15, BURNOUT: 5, WORK: 5, ISOLATION: 5, COGNITIVE: 5, RECOVERY: 4, PURPOSE: 4, GLOBAL: 3 };
    const prior   = { SLEEP:  5, BURNOUT: 5, WORK: 5, ISOLATION: 5, COGNITIVE: 5, RECOVERY: 4, PURPOSE: 4, GLOBAL: 0 };

    // No-weights call: legacy raw-delta behavior. Should pick SLEEP.
    const rawPick = pick(current, prior);
    ctx.assertEqual(rawPick, 'SLEEP',
      'no-weights path picks SLEEP (raw delta +10 > GLOBAL raw delta +3)');

    // GLOBAL-emphasis weights: weighted contributions diverge from raw.
    //   SLEEP:  (10/15) × 0.05 = 0.0333
    //   GLOBAL:  (3/3)  × 0.50 = 0.5000
    // Other sections all delta=0 so they contribute 0.
    const globalEmphasis = {
      SLEEP: 0.05, BURNOUT: 0.05, WORK: 0.05, ISOLATION: 0.05,
      COGNITIVE: 0.10, RECOVERY: 0.10, PURPOSE: 0.10, GLOBAL: 0.50
    };
    const weightedPick = pick(current, prior, globalEmphasis);
    ctx.assertEqual(weightedPick, 'GLOBAL',
      'GLOBAL-emphasis weights change the winner from SLEEP (raw) to GLOBAL (weighted)');

    // ── Scenario 2: even equal weights diverge from raw on this scenario ──
    // Because GLOBAL's max is small (3), maxing it out contributes more of
    // the score than partially filling SLEEP (max 15) — even with identical
    // weights. (3/3) × 0.125 = 0.125 vs (10/15) × 0.125 ≈ 0.083. This is
    // exactly the "GLOBAL is an anchor and can't be diluted" property
    // Option A is designed to preserve.
    const equalWeights = {
      SLEEP: 0.125, BURNOUT: 0.125, WORK: 0.125, ISOLATION: 0.125,
      COGNITIVE: 0.125, RECOVERY: 0.125, PURPOSE: 0.125, GLOBAL: 0.125
    };
    const equalPick = pick(current, prior, equalWeights);
    ctx.assertEqual(equalPick, 'GLOBAL',
      'even equal weights pick GLOBAL — (3/3)×0.125 > (10/15)×0.125 because GLOBAL maxes out');

    // ── Scenario 3: when one section is dialed to zero weight ─────────────
    // RECOVERY weight = 0 means that section's delta cannot win even if it's
    // the largest raw delta. Verifies the multiplier short-circuits correctly.
    const zeroRecovery = {
      SLEEP: 0.10, BURNOUT: 0.10, WORK: 0.10, ISOLATION: 0.10,
      COGNITIVE: 0.10, RECOVERY: 0.00, PURPOSE: 0.10, GLOBAL: 0.40
    };
    const recCurrent = { SLEEP: 5, BURNOUT: 5, WORK: 5, ISOLATION: 5, COGNITIVE: 5, RECOVERY: 12, PURPOSE: 4, GLOBAL: 1 };
    const recPrior   = { SLEEP: 5, BURNOUT: 5, WORK: 5, ISOLATION: 5, COGNITIVE: 5, RECOVERY:  0, PURPOSE: 4, GLOBAL: 0 };
    // Raw deltas: RECOVERY +12 (winner), GLOBAL +1.
    // Weighted: RECOVERY 12/12 × 0 = 0, GLOBAL 1/3 × 0.40 = 0.133. GLOBAL wins.
    const zeroPick = pick(recCurrent, recPrior, zeroRecovery);
    ctx.assertEqual(zeroPick, 'GLOBAL',
      'zero-weight section cannot drive routing even with biggest raw delta');

    // ── Scenario 4: legacy fallback when no section increased ─────────────
    // All deltas zero or negative — fallback path uses highest absolute
    // current score, ignores weights entirely.
    const flatCurrent = { SLEEP: 8, BURNOUT: 5, WORK: 5, ISOLATION: 5, COGNITIVE: 5, RECOVERY: 4, PURPOSE: 4, GLOBAL: 3 };
    const flatPrior   = { SLEEP: 8, BURNOUT: 5, WORK: 5, ISOLATION: 5, COGNITIVE: 5, RECOVERY: 4, PURPOSE: 4, GLOBAL: 3 };
    const flatPick = pick(flatCurrent, flatPrior, globalEmphasis);
    ctx.assertEqual(flatPick, 'SLEEP',
      'flat-delta fallback uses highest absolute current score (SLEEP=8, weights ignored)');
  }
};
