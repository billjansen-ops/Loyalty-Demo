/**
 * Workforce Monitoring (Insight) — vertical server module.
 *
 * This is the receiver for healthcare-specific server code that
 * formerly lived in pointers.js. The extraction happens across
 * phases 3–6 of the plan in docs/INSIGHT_EXTRACTION_DESIGN.md.
 *
 * Modules:
 *   - compliance.js (Phase 3) — the 9 /v1/compliance/* endpoints + the
 *     RANDOM_DRUG_TEST and DRUG_TEST_MISSED job handlers.
 *   - meds.js (Phase 4) — the 4 /v1/meds/* endpoints + the MEDS job
 *     handler + the calculateMedsNextDue / processMedsForMember
 *     helpers + the SENTINEL_MEDS_NEXT_DUE constant.
 *   - scoring_admin.js (Phase 5) — the 6 PPII/PPSI weights-config
 *     endpoints + the canEditTenantWeights auth helper.
 *   - scoring_history.js (Phase 5) — the 5 member-level scoring endpoints
 *     (ppii-history, ppsi-history, request-full-ppsi POST + DELETE,
 *     ppsi-mode).
 *   - wellness.js (Phase 5) — GET /v1/wellness/members (the heaviest
 *     single endpoint) + POST /v1/pulse-respondents + the calcPPII
 *     callback registration that bridges into pointers.js's
 *     gatherMemberFeatures.
 *   - registry.js (Phase 6) — the 8 stability-registry + registry-
 *     followup endpoints (audit-history, registry GET/member/PUT,
 *     followups GET/summary/POST/PATCH) + the F1_T5 scheduled-job
 *     handler.
 *   - clinicians.js (Phase 6) — the 5 clinician assignment endpoints.
 *   - protocol_cards.js (Phase 6) — the 2 protocol-card reference
 *     library endpoints (with a static vertical-internal import of
 *     protocolCards.js, replacing the two dynamic await-imports the
 *     platform endpoints used to do).
 *   - notes.js (Session 131) — the 5 physician-annotation +
 *     survey-note-review endpoints Phase 6 missed (lowercase URLs
 *     slipped the case-sensitive lint), plus the getMemberNotes /
 *     recordSurveyNoteReview callbacks bridging the two platform-shared
 *     endpoints (/v1/export/:report notes section, /v1/member-surveys/
 *     :link/answers note-alert branch) off the healthcare tables.
 *   - ml_features.js (Session 131 Cat 2) — gatherMemberFeatures (the
 *     Insight PPSI/Pulse/compliance/MEDS/registry ML feature builder),
 *     registered as the getMemberFeatures callback. The platform's
 *     scoreMemberML (generic ML plumbing) reads it; null when unloaded.
 *   - evaluators.js (Session 133) — the vetted evaluator directory
 *     (WisconsinPATH Stage 3): staff CRUD /v1/evaluators + the PUBLIC
 *     participant-facing /v1/evaluator-directory (allowlisted in
 *     pointers.js isPublicRoute).
 *   - exports.js (Session 131 Cat 2) — both CSV/PDF export endpoints
 *     (GET /v1/export/:report and GET /v1/export/participant/:id). They
 *     are Insight-only (registry/followups/roster/compliance + per-
 *     participant chart) so the routes live here, not in pointers.js.
 *
 * Loaded by pointers.js when `process.env.VERTICALS_ENABLED` contains
 * 'workforce_monitoring' (default). See pointers.js → loadVerticals()
 * for the loading mechanism.
 */

import * as compliance from './compliance.js';
import * as meds from './meds.js';
import * as instruments from './instruments.js';
import * as scoringAdmin from './scoring_admin.js';
import * as scoringHistory from './scoring_history.js';
import * as wellness from './wellness.js';
import * as registry from './registry.js';
import * as clinicians from './clinicians.js';
import * as protocolCards from './protocol_cards.js';
import * as notes from './notes.js';
import * as mlFeatures from './ml_features.js';
import * as chartExports from './exports.js';
import * as licensing from './licensing.js';
import * as evaluators from './evaluators.js';
import * as intake from './intake.js';

export const verticalKey = 'workforce_monitoring';

/**
 * Molecule requirements unioned with PLATFORM_REQUIRED_MOLECULES at
 * the boot readiness check (pointers.js → verifyTenantMolecules).
 *
 * Empty in production — all current FEATURE_CONDITIONAL_MOLECULES
 * entries are platform-level (bonus/promotion engine). When Insight-
 * specific molecules surface as load-bearing, add them here.
 *
 * The TEST_VERTICAL_REQUIRED_MOLECULES env var override lets the
 * Layer 3 boot-check test (tests/core/test_molecule_readiness_layer3.cjs)
 * exercise the verifyTenantMolecules Layer 3 path against a synthetic
 * requirement that doesn't depend on production data. Closes the
 * Session 130 audit gap (the Layer 3 path existed but was never
 * actually exercised because the array was empty in production AND
 * untested).
 */
export const requiredMolecules = process.env.TEST_VERTICAL_REQUIRED_MOLECULES
  ? JSON.parse(process.env.TEST_VERTICAL_REQUIRED_MOLECULES)
  : [];

/**
 * Called once at server boot, after the routes are registered. Wires
 * scheduled-job handlers via ctx.registerJobHandler and vertical→
 * platform callbacks via ctx.registerCallback so the scheduler tick +
 * platform feature gatherers see them.
 * See docs/INSIGHT_TOUCH_POINTS.md §7 (jobs) + §9 Open Question #2
 * (callbacks).
 */
export async function boot(ctx) {
  // Order matters: registerActionHandlers must run BEFORE any code
  // that calls externalActionHandlers.createRegistryItem can fire.
  // The scheduled-job handlers (registerJobs) don't fire until the
  // scheduler ticks, which happens after boot, so the order between
  // those calls doesn't matter — only that all of them finish
  // before app.listen accepts requests.
  registry.registerActionHandlers(ctx);
  intake.registerActionHandlers(ctx);   // createIntakeItem — the REG_REVIEW dispatch target since v111
  compliance.registerJobs(ctx);
  meds.registerJobs(ctx);
  wellness.registerCallbacks(ctx);
  registry.registerJobs(ctx);
  intake.registerJobs(ctx);             // INTAKE_SLA (replaces registry's REG_REVIEW_SLA)
  clinicians.registerCallbacks(ctx);
  notes.registerCallbacks(ctx);
  scoringAdmin.registerCallbacks(ctx);   // prepareRetrainWeights (Session 131 Cat 2)
  mlFeatures.registerCallbacks(ctx);     // getMemberFeatures (Session 131 Cat 2)
}

/**
 * Called once at server boot to register Express routes. Receives the
 * Express app and a context object with shared dependencies (db client
 * getter, helper functions). See pointers.js → buildVerticalCtx().
 */
export function registerRoutes(app, ctx) {
  compliance.register(app, ctx);
  meds.register(app, ctx);
  instruments.register(app, ctx);
  scoringAdmin.register(app, ctx);
  scoringHistory.register(app, ctx);
  wellness.register(app, ctx);
  registry.register(app, ctx);
  clinicians.register(app, ctx);
  protocolCards.register(app, ctx);
  notes.register(app, ctx);
  chartExports.register(app, ctx);
  licensing.register(app, ctx);
  evaluators.register(app, ctx);
  intake.register(app, ctx);
}

export default { verticalKey, requiredMolecules, registerRoutes, boot };
