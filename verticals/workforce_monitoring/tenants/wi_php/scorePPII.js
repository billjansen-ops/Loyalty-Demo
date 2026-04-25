/**
 * scorePPII.js — PPII Composite Score Calculator
 * Wisconsin PHP / Insight Health Solutions
 *
 * PPII (Predictive Performance Intelligence Infrastructure) is the multi-stream
 * composite that combines all data streams into a single 0-100 risk number.
 *
 * Pilot streams (confirmed by Erica Larson, March 11 2026):
 *   Provider Pulse  35%  (max raw = 42)
 *   PPSI Survey     25%  (max raw = 102)
 *   Compliance      25%  (max raw = 18, sum of last 6 entries at 0-3 each)
 *   Event Reporting 15%  (max raw = 3, most recent event severity)
 *
 * If a stream has no data, its weight is redistributed proportionally
 * among the streams that do have data (carry-forward fallback).
 *
 * Two ways to score:
 *
 * 1. Legacy synchronous form — caller already has the raw numbers in hand.
 *    import { calcPPII } from './scorePPII.js';
 *    const ppii = calcPPII({ ppsiRaw, pulseRaw, compRaw, eventRaw, weights });
 *
 * 2. Config-driven async form (Session 109 / db v58) — caller passes the
 *    member, tenant, db client, ppii_stream rows and ppii_weight_set_value
 *    rows for that tenant, plus the source-function registry. calcPPIIFromMember
 *    invokes each active stream's fetcher to read the raw value, then composes.
 *
 *    import { calcPPIIFromMember } from './scorePPII.js';
 *    const result = await calcPPIIFromMember({
 *      memberLink, tenantId, db,
 *      streams: caches.ppiiStreams.get(tenantId),
 *      weights: caches.ppiiWeights.get(tenantId),
 *      fetchers: ppiiStreamFetchers,
 *    });
 *    // result.composite     → integer 0-100 or null
 *    // result.components    → { stream_code: rawValue or null, ... }
 *    // result.normalized    → { stream_code: 0-100 norm or null, ... }
 *    // result.weight_set_id → from the weights cache entry, for audit snapshots
 */

// Hardcoded fallback used when the cached stream/weight tables have no entry
// for the tenant. In production these come from ppii_stream + ppii_weight_set
// (db v58); the legacy v57 sysparm path is still respected by the cache loader
// during transition. Pilot values confirmed by Erica Larson, March 11 2026.
export const PPII_WEIGHTS_DEFAULT = {
  pulse:      0.35,
  ppsi:       0.25,
  compliance: 0.25,
  events:     0.15,
};
export const PPII_WEIGHTS = PPII_WEIGHTS_DEFAULT;

// Hardcoded max raw values per stream. Mirrors ppii_stream.max_value rows seeded
// in db_migrate v58. Used by the legacy sync calcPPII path and by normStream.
export const PPII_MAXIMA = {
  pulse:      42,
  ppsi:       102,
  compliance: 18,
  events:     3,
};

/**
 * Normalize a raw stream score to 0-100.
 */
export function normStream(raw, max) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((raw / max) * 100));
}

/**
 * Compose a 0-100 composite from a list of stream contributions.
 * Streams whose raw is null/undefined drop out and their weight is redistributed
 * proportionally across the remaining streams (so the composite still rests on
 * a 1.0 weight sum). Returns null when no stream has data.
 *
 * @param {Array<{code:string, raw:number|null, max:number, weight:number}>} items
 * @returns {number|null}
 */
function composeFromContributions(items) {
  const active = items.filter(s => s.raw !== null && s.raw !== undefined);
  if (active.length === 0) return null;

  const totalWeight = active.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) return null;

  const weighted = active.reduce(
    (sum, s) => sum + (normStream(s.raw, s.max) * s.weight),
    0
  );
  return Math.round(weighted / totalWeight);
}

/**
 * Legacy synchronous form. Caller pre-computes the four raw values and (optionally)
 * supplies a per-tenant weights override. Maxima are hardcoded to PPII_MAXIMA.
 * Kept stable so existing callers keep working through the v58 transition.
 */
export function calcPPII({ ppsiRaw, pulseRaw, compRaw, eventRaw, weights }) {
  const W = {
    pulse:      weights?.pulse      ?? PPII_WEIGHTS_DEFAULT.pulse,
    ppsi:       weights?.ppsi       ?? PPII_WEIGHTS_DEFAULT.ppsi,
    compliance: weights?.compliance ?? PPII_WEIGHTS_DEFAULT.compliance,
    events:     weights?.events     ?? PPII_WEIGHTS_DEFAULT.events,
  };
  return composeFromContributions([
    { code: 'ppsi',       raw: ppsiRaw,  max: PPII_MAXIMA.ppsi,       weight: W.ppsi },
    { code: 'pulse',      raw: pulseRaw, max: PPII_MAXIMA.pulse,      weight: W.pulse },
    { code: 'compliance', raw: compRaw,  max: PPII_MAXIMA.compliance, weight: W.compliance },
    { code: 'events',     raw: eventRaw, max: PPII_MAXIMA.events,     weight: W.events },
  ]);
}

/**
 * Per-stream normalized contribution breakdown. Used by callers that need to
 * show "what each stream contributed" alongside the composite.
 */
export function ppiiBreakdown({ ppsiRaw, pulseRaw, compRaw, eventRaw }) {
  return {
    ppsi:       ppsiRaw  !== null ? normStream(ppsiRaw,  PPII_MAXIMA.ppsi)       : null,
    pulse:      pulseRaw !== null ? normStream(pulseRaw, PPII_MAXIMA.pulse)      : null,
    compliance: compRaw  !== null ? normStream(compRaw,  PPII_MAXIMA.compliance) : null,
    events:     eventRaw !== null ? normStream(eventRaw, PPII_MAXIMA.events)     : null,
  };
}

/**
 * Config-driven async form. The caller hands in:
 *  - memberLink, tenantId, db client (passed through to fetchers)
 *  - streams:  array of ppii_stream rows for the tenant (code/max_value/source_function/is_active)
 *  - weights:  object keyed by stream code → numeric weight (with `weight_set_id` if available)
 *  - fetchers: registry object mapping source_function name → async (memberLink, tenantId, db) ⇒ raw|null
 *
 * Each active stream's fetcher is invoked to obtain its raw value, the values
 * are normalized against each stream's own max_value, and the composite is
 * computed via composeFromContributions. Inactive streams are skipped entirely
 * (they don't reserve weight in the composite).
 *
 * Returns { composite, components, normalized, weight_set_id }:
 *   composite       → integer 0-100 or null when no stream had data
 *   components      → object keyed by stream code with the raw value (or null)
 *   normalized      → object keyed by stream code with the 0-100 norm (or null)
 *   weight_set_id   → echoed from `weights.weight_set_id` if present, else undefined
 *
 * @param {object} args
 * @param {string} args.memberLink
 * @param {number} args.tenantId
 * @param {object} args.db
 * @param {Array} args.streams
 * @param {object} args.weights
 * @param {object} args.fetchers
 * @returns {Promise<{composite:number|null, components:object, normalized:object, weight_set_id?:number}>}
 */
export async function calcPPIIFromMember({ memberLink, tenantId, db, streams, weights, fetchers }) {
  if (!Array.isArray(streams) || streams.length === 0) {
    throw new Error(`calcPPIIFromMember: streams config missing for tenant_id=${tenantId}`);
  }
  if (!weights || typeof weights !== 'object') {
    throw new Error(`calcPPIIFromMember: weights missing for tenant_id=${tenantId}`);
  }
  if (!fetchers || typeof fetchers !== 'object') {
    throw new Error('calcPPIIFromMember: fetchers registry missing');
  }

  const active = streams.filter(s => s.is_active !== false);
  const components = {};
  const normalized = {};
  const items = [];

  for (const s of active) {
    const fetcher = fetchers[s.source_function];
    if (typeof fetcher !== 'function') {
      throw new Error(
        `calcPPIIFromMember: stream '${s.code}' references unknown source_function '${s.source_function}' — registry has [${Object.keys(fetchers).join(', ')}]`
      );
    }
    const raw = await fetcher(memberLink, tenantId, db);
    components[s.code] = raw;
    normalized[s.code] = (raw !== null && raw !== undefined) ? normStream(raw, Number(s.max_value)) : null;
    items.push({ code: s.code, raw, max: Number(s.max_value), weight: Number(weights[s.code] ?? 0) });
  }

  const composite = composeFromContributions(items);
  return {
    composite,
    components,
    normalized,
    weight_set_id: weights.weight_set_id,
  };
}
