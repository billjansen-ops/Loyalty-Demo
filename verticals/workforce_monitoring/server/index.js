/**
 * Workforce Monitoring (Insight) — vertical server module.
 *
 * This is the receiver for healthcare-specific server code that
 * currently lives in pointers.js. The extraction happens across
 * phases 3–6 of the plan in docs/INSIGHT_EXTRACTION_DESIGN.md.
 *
 * Phase 1 (this commit) — scaffolding only. The module exports the
 * shape the loader expects but registers no routes and declares no
 * required molecules. Verifies the load mechanism works end-to-end
 * before any real code moves.
 *
 * Loaded by pointers.js when `process.env.VERTICALS_ENABLED` contains
 * 'workforce_monitoring' (default). See pointers.js → loadVerticals()
 * for the loading mechanism.
 */

export const verticalKey = 'workforce_monitoring';

/**
 * Molecule requirements unioned with PLATFORM_REQUIRED_MOLECULES at
 * the boot readiness check (pointers.js → verifyTenantMolecules).
 *
 * Phase 2 will wire this into the existing check. The Insight code in
 * pointers.js doesn't currently declare any FEATURE_CONDITIONAL_MOLECULES
 * entries — they're all platform-level (bonus/promotion engine
 * requirements). So this stays empty unless we find something
 * Insight-specific worth adding during the endpoint moves.
 */
export const requiredMolecules = [];

/**
 * Called once at server boot, after the routes are registered. Use
 * for one-time setup (scheduled jobs, cache warm, etc.).
 * Phase 1: no-op.
 */
export async function boot(_ctx) {
  // No-op for Phase 1 scaffolding.
}

/**
 * Called once at server boot to register Express routes. Receives the
 * Express app and a context object with shared dependencies (db client
 * getter, helper functions). See pointers.js → buildVerticalCtx().
 *
 * Phase 1: no routes registered. Phases 3–6 add the compliance, MEDS,
 * PPSI/PPII, registry/clinicians/follow-ups endpoints currently in
 * pointers.js.
 */
export function registerRoutes(_app, _ctx) {
  // No routes registered yet. Phases 3–6 wire endpoints in here.
}

export default { verticalKey, requiredMolecules, registerRoutes, boot };
