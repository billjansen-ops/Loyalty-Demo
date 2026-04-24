/**
 * scorePPII.js — PPII Composite Score Calculator
 * Wisconsin PHP / Insight Health Solutions
 *
 * PPII (Predictive Performance Intelligence Infrastructure) is the four-stream
 * composite score combining all data streams into a single 0-100 risk number.
 *
 * Pilot weights (confirmed by Erica Larson, March 11 2026):
 *   Provider Pulse:  35%  (max raw = 42)
 *   PPSI Survey:     25%  (max raw = 102)
 *   Compliance:      25%  (max raw = 18, sum of last 6 entries at 0-3 each)
 *   Event Reporting: 15%  (max raw = 3, most recent event severity)
 *
 * If a stream has no data, its weight is redistributed proportionally
 * among the streams that do have data (carry-forward fallback).
 *
 * Usage:
 *   import { calcPPII, normStream } from './tenants/wi_php/scorePPII.js';
 *
 *   const ppii = calcPPII({
 *     ppsiRaw:  45,   // raw PPSI score 0-102, or null if no data
 *     pulseRaw: 12,   // raw Provider Pulse score 0-42, or null
 *     compRaw:  6,    // sum of recent compliance scores 0-18, or null
 *     eventRaw: 1,    // most recent event severity 0-3, or null
 *   });
 *   // → integer 0-100, or null if all streams are null
 */

// Hardcoded fallback used when the sysparm-backed cache has no entry for the
// tenant. In production these values come from caches.ppiiWeights (loaded from
// sysparm at startup and on cache-refresh) and are editable via the admin UI.
// Pilot values confirmed by Erica Larson, March 11 2026.
export const PPII_WEIGHTS_DEFAULT = {
  pulse:      0.35,
  ppsi:       0.25,
  compliance: 0.25,
  events:     0.15,
};
// Back-compat alias — some older callers imported PPII_WEIGHTS by name.
export const PPII_WEIGHTS = PPII_WEIGHTS_DEFAULT;

// Max raw values per stream
export const PPII_MAXIMA = {
  pulse:      42,
  ppsi:       102,
  compliance: 18,
  events:     3,
};

/**
 * Normalize a raw stream score to 0-100.
 * @param {number} raw
 * @param {number} max
 * @returns {number} integer 0-100
 */
export function normStream(raw, max) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((raw / max) * 100));
}

/**
 * Calculate the PPII composite score.
 * @param {object} streams
 * @param {number|null} streams.ppsiRaw
 * @param {number|null} streams.pulseRaw
 * @param {number|null} streams.compRaw
 * @param {number|null} streams.eventRaw
 * @param {object} [streams.weights] Optional override for the stream weights —
 *   pass caches.ppiiWeights.get(tenantId) here so per-tenant values apply.
 *   Falls back to PPII_WEIGHTS_DEFAULT when absent or incomplete.
 * @returns {number|null} PPII score 0-100, or null if no data at all
 */
export function calcPPII({ ppsiRaw, pulseRaw, compRaw, eventRaw, weights }) {
  const W = {
    pulse:      weights?.pulse      ?? PPII_WEIGHTS_DEFAULT.pulse,
    ppsi:       weights?.ppsi       ?? PPII_WEIGHTS_DEFAULT.ppsi,
    compliance: weights?.compliance ?? PPII_WEIGHTS_DEFAULT.compliance,
    events:     weights?.events     ?? PPII_WEIGHTS_DEFAULT.events,
  };
  const candidates = [
    { key: 'ppsi',       raw: ppsiRaw,  max: PPII_MAXIMA.ppsi,       weight: W.ppsi       },
    { key: 'pulse',      raw: pulseRaw, max: PPII_MAXIMA.pulse,      weight: W.pulse      },
    { key: 'compliance', raw: compRaw,  max: PPII_MAXIMA.compliance, weight: W.compliance },
    { key: 'events',     raw: eventRaw, max: PPII_MAXIMA.events,     weight: W.events     },
  ];

  const active = candidates.filter(s => s.raw !== null && s.raw !== undefined);
  if (!active.length) return null;

  const totalWeight = active.reduce((sum, s) => sum + s.weight, 0);
  const weighted    = active.reduce((sum, s) => sum + (normStream(s.raw, s.max) * s.weight), 0);

  return Math.round(weighted / totalWeight);
}

/**
 * Return a breakdown of each stream's normalized contribution.
 * Useful for the reason narrative and dominant driver routing.
 */
export function ppiiBreakdown({ ppsiRaw, pulseRaw, compRaw, eventRaw }) {
  return {
    ppsi:       ppsiRaw  !== null ? normStream(ppsiRaw,  PPII_MAXIMA.ppsi)       : null,
    pulse:      pulseRaw !== null ? normStream(pulseRaw, PPII_MAXIMA.pulse)      : null,
    compliance: compRaw  !== null ? normStream(compRaw,  PPII_MAXIMA.compliance) : null,
    events:     eventRaw !== null ? normStream(eventRaw, PPII_MAXIMA.events)     : null,
  };
}
