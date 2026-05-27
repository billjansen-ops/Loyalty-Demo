/**
 * Workforce Monitoring (Insight) — vertical server module.
 *
 * This is the receiver for healthcare-specific server code that
 * formerly lived in pointers.js. The extraction happens across
 * phases 3–6 of the plan in docs/INSIGHT_EXTRACTION_DESIGN.md.
 *
 * Phase 3 (current) — compliance endpoints + scheduled-job handlers
 * moved here. Module breakdown:
 *   - compliance.js — the 9 /v1/compliance/* endpoints + the
 *     RANDOM_DRUG_TEST and DRUG_TEST_MISSED job handlers.
 *
 * Loaded by pointers.js when `process.env.VERTICALS_ENABLED` contains
 * 'workforce_monitoring' (default). See pointers.js → loadVerticals()
 * for the loading mechanism.
 */

import * as compliance from './compliance.js';

export const verticalKey = 'workforce_monitoring';

/**
 * Molecule requirements unioned with PLATFORM_REQUIRED_MOLECULES at
 * the boot readiness check (pointers.js → verifyTenantMolecules).
 *
 * All current FEATURE_CONDITIONAL_MOLECULES entries are platform-level
 * (bonus/promotion engine). Stays empty until something Insight-specific
 * surfaces during a later phase.
 */
export const requiredMolecules = [];

/**
 * Called once at server boot, after the routes are registered. Wires
 * scheduled-job handlers via ctx.registerJobHandler so the scheduler
 * tick sees them. See docs/INSIGHT_TOUCH_POINTS.md §7.
 */
export async function boot(ctx) {
  compliance.registerJobs(ctx);
}

/**
 * Called once at server boot to register Express routes. Receives the
 * Express app and a context object with shared dependencies (db client
 * getter, helper functions). See pointers.js → buildVerticalCtx().
 */
export function registerRoutes(app, ctx) {
  compliance.register(app, ctx);
}

export default { verticalKey, requiredMolecules, registerRoutes, boot };
