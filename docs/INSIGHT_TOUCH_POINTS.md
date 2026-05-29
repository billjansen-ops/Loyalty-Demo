# Insight Touch Points in `pointers.js`

**Generated:** Session 127, Phase 1 of the Insight server extraction
(see `docs/INSIGHT_EXTRACTION_DESIGN.md`).
**Line numbers last refreshed:** Session 130 (after Phase 6 — final phase — cut).
**All six phases complete.** Lint count = 0. Script flipped to fail-on-match
and wired into `tests/run.cjs` as a Pre-flight gate.

**Purpose:** Comprehensive inventory of every workforce_monitoring /
wi_php / "Insight" touch point in `pointers.js`, so subsequent
extraction phases work from a list instead of by discovery.

**How to refresh:** `node tests/lint-anti-patterns.cjs` surfaces the
strict-Insight string hits; this doc layers on endpoint URL patterns
+ import edges + soft branches. When you finish a phase, mark the
moved items here and check that the lint count drops accordingly.

**Phases completed so far:**
- Phase 1 — scaffolding + this inventory ✅
- Phase 2 — molecule readiness contract + fail-closed auth ✅
- Phase 2.1 — scheduled-job framework gap fix ✅
- Phase 3 — Compliance (9 endpoints + 2 job handlers) ✅ — now lives in `verticals/workforce_monitoring/server/compliance.js`
- Phase 4 — MEDS (4 endpoints + 1 job handler + 2 helpers + `SENTINEL_MEDS_NEXT_DUE` constant) ✅ — now lives in `verticals/workforce_monitoring/server/meds.js`
- Phase 5 — PPSI/PPII (13 endpoints + `scorePPII.js` static import removed + `calcPPII` callback bridge) ✅ — split across `verticals/workforce_monitoring/server/scoring_admin.js` (6 weights-config endpoints + `canEditTenantWeights` auth helper), `.../scoring_history.js` (5 member-level endpoints), and `.../wellness.js` (the 2 heaviest endpoints + the `registerCallbacks(ctx)` hook). New platform-side `verticalCallbacks = {}` registry + `ctx.registerCallback` field bridge `calcPPII` back into `gatherMemberFeatures` (option (a) from Open Question #2). `buildVerticalCtx` gained 5 new fields: `registerCallback`, `encodeValue`, `paths.projectRoot`, `molecules.insertMoleculeRow`, `molecules.deleteMoleculeRow`.
- Phase 6 — Registry / Clinicians / Follow-ups / Protocol Cards (15 endpoints + F1_T5 job handler + 2 protocolCards.js imports) ✅ — split across `verticals/workforce_monitoring/server/registry.js` (4 stability-registry endpoints + 4 registry-followups endpoints + F1_T5 handler; PATCH `/v1/registry-followups/:id` was missed by the handoff inventory but folded in here to keep the family coherent — 15 endpoints moved total), `.../clinicians.js` (5 clinician-assignment endpoints; the helper functions `getClinicians`/`getAssignedClinicians`/`isClinician`/`assignClinician`/`removeClinician` stay platform-side because two platform-shared call sites — `fireNotificationEvent` and `/v1/export/:report` — also call them; camelCase identifiers don't trip the lint regex), `.../protocol_cards.js` (2 protocol-card reference-library endpoints with a single static vertical-internal import of `protocolCards.js` replacing the two dynamic await-imports). `buildVerticalCtx` gained 7 new fields: `getOrCreateEntityLink`, `logAudit`, `getClinicians`, `getAssignedClinicians`, `isClinician`, `assignClinician`, `removeClinician`. Plus 4 inline string genericizations and 5 `// lint-allow` comments cleared the 9 hits in platform-shared code that stays in pointers.js. `tests/lint-anti-patterns.cjs` flipped to fail-on-match and wired into `tests/run.cjs` as a Pre-flight gate. `scheduleFollowups` at pointers.js:14422 stays platform-side (the handoff said registry-resolve endpoints called it — actually only `externalActionHandlers.createRegistryItem` does, which is itself platform-side).
- Session 131 Category 1 ✅ — the 5 healthcare-named endpoints Phase 6 missed (GET/POST `/v1/physician-annotations`, GET `/v1/survey-note-reviews`, GET `/v1/survey-note-reviews/:membershipNumber`, PATCH `/v1/survey-note-reviews/:reviewId`) → `verticals/workforce_monitoring/server/notes.js`; 2 platform table-refs bridged via `getMemberNotes` / `recordSurveyNoteReview` callbacks. Their lowercase URLs had slipped the case-sensitive lint.
- Session 131 Category 2 ✅ — the ML scoring pipeline + both export endpoints moved out, finishing the extraction. `gatherMemberFeatures` → `verticals/workforce_monitoring/server/ml_features.js` (registered as `verticalCallbacks.getMemberFeatures`); `scoreMemberML` (generic ML plumbing) stays platform-side and reads the callback (null when vertical unloaded). Both `/v1/export/:report` + `/v1/export/participant/:membershipNumber` → `verticals/workforce_monitoring/server/exports.js` (Insight-only; `toCsv` moved too; clinician/notes enrichments call vertical helpers directly — `getAssignedClinicians`/`getMemberNotes` promoted to named exports). Dead `ppiiStreamFetchers` registry deleted (~115 lines). `/v1/ml/retrain` stays platform-side; its weight-bundle shape bridged to `verticalCallbacks.prepareRetrainWeights` (scoring_admin.js). 15 platform comments reworded to clear standalone PPII/PPSI/MEDS prose (Insight table/cache identifiers stay — renames are a scoped-out migration). **Gate: Part-B = 0 standalone `ppii/ppsi/meds` tokens in pointers.js (comments included) outside BUILD_NOTES; lint 0; suite 48/924/0.** The §9 Open Question #2 note below is now superseded: `gatherMemberFeatures` no longer lives platform-side, so `computePpii` has no platform caller (still registered, harmless).

---

## 1. Endpoints to move — strict Insight

Endpoints whose URL or implementation is unambiguously
healthcare/workforce-monitoring specific. These all move in phases 3–6.
Line numbers reflect the current state of `pointers.js` after the
Phase 3 cut.

### Phase 3 — Compliance (9 endpoints) — ✅ DONE

Moved to `verticals/workforce_monitoring/server/compliance.js` in
Session 128. Original line numbers preserved for historical reference:

| Original line | Method | URL |
|---|---|---|
| 27491 | GET | `/v1/compliance/member/:membershipNumber` |
| 27545 | GET | `/v1/compliance/member/:membershipNumber/history` |
| 27582 | POST | `/v1/compliance/entry` |
| 27686 | GET | `/v1/compliance/items` |
| 27702 | POST | `/v1/compliance/items` |
| 27718 | PUT | `/v1/compliance/items/:id` |
| 27743 | PUT | `/v1/compliance/member/:membershipNumber/cadence/:memberComplianceId` |
| 27768 | POST | `/v1/compliance/member/:membershipNumber/assign` |
| 27817 | DELETE | `/v1/compliance/member/:membershipNumber/assign/:complianceItemId` |

### Phase 4 — MEDS (4 endpoints) — ✅ DONE

Moved to `verticals/workforce_monitoring/server/meds.js` in Session 128.
Original line numbers preserved for historical reference:

| Original line | Method | URL |
|---|---|---|
| 30065 | POST | `/v1/meds/check/:memberLink` |
| 30108 | GET | `/v1/meds/member/:memberLink` |
| 30210 | POST | `/v1/meds/seed` |
| 30237 | GET | `/v1/meds/summary` |

Also moved: `SENTINEL_MEDS_NEXT_DUE` constant (was at pointers.js L215),
plus two module-private helpers `calculateMedsNextDue` and
`processMedsForMember` (now take a `ctx` parameter at the front of
their signature).

### Phase 5 — PPSI / PPII (13 endpoints, including wellness) — ✅ DONE

Moved in Session 129. Original line numbers preserved for historical reference.

PPII weight configuration + history (4) — now in `scoring_admin.js` (first 3) + `scoring_history.js` (history):

| Original line | Method | URL | New home |
|---|---|---|---|
| 5037 | GET | `/v1/tenants/:id/ppii-weights` | `scoring_admin.js` |
| 5152 | PUT | `/v1/tenants/:id/ppii-weights` | `scoring_admin.js` |
| 5308 | POST | `/v1/tenants/:id/ppii-weights/recalculate` | `scoring_admin.js` |
| 5784 | GET | `/v1/member/:id/ppii-history` | `scoring_history.js` |

PPSI configuration + member-level admin (7) — split across `scoring_admin.js` (first 3) + `scoring_history.js` (last 4) + `wellness.js` (pulse-respondents):

| Original line | Method | URL | New home |
|---|---|---|---|
| 5458 | GET | `/v1/tenants/:id/ppsi-section-weights` | `scoring_admin.js` |
| 5571 | PUT | `/v1/tenants/:id/ppsi-section-weights` | `scoring_admin.js` |
| 5690 | POST | `/v1/tenants/:id/ppsi-section-weights/restore-defaults` | `scoring_admin.js` |
| 7058 | GET | `/v1/member/:id/ppsi-history` | `scoring_history.js` |
| 26515 | POST | `/v1/pulse-respondents` | `wellness.js` |
| 27216 | POST | `/v1/members/:id/request-full-ppsi` | `scoring_history.js` |
| 27239 | DELETE | `/v1/members/:id/request-full-ppsi` | `scoring_history.js` |
| 27257 | GET | `/v1/members/:id/ppsi-mode` | `scoring_history.js` |

Wellness (1) — now in `wellness.js`:

| Original line | Method | URL | New home |
|---|---|---|---|
| 26548 | GET | `/v1/wellness/members` | `wellness.js` |

Plus: the static `import { calcPPII, normStream } from './verticals/workforce_monitoring/tenants/wi_php/scorePPII.js'` (was at pointers.js line 6) deleted. The new vertical files import scorePPII.js directly as a vertical-internal import. The one platform-side caller of `calcPPII` (in `gatherMemberFeatures`, formerly L29829) now uses `verticalCallbacks.computePpii?.({...}) || ppsiCurrent` — registered by `wellness.registerCallbacks(ctx)` via the new `ctx.registerCallback` field. The platform's `gatherMemberFeatures` no longer knows the callback computes PPII.

Plus: `canEditTenantWeights` (was a platform helper at pointers.js L5026) relocated to `scoring_admin.js` as a module-private — only the 4 PPII/PPSI mutating endpoints use it.

**The `"No PPII weights configured for tenant ${tenantId}"` lint hit** (now at pointers.js L21366 post-cut) is inside `gatherMemberFeatures` which stays platform-side. Cleared in Phase 6 sweep or by replacing with a generic string.

### Phase 6 — Registry / Clinicians / Follow-ups / Protocol Cards (15 endpoints + F1_T5 job handler) — ✅ DONE

Moved in Session 130. Original line numbers preserved for historical reference.

Stability registry (4) — now in `registry.js`:

| Original line | Method | URL |
|---|---|---|
| 24980 | GET | `/v1/stability-registry/audit-history` |
| 26440 | GET | `/v1/stability-registry` |
| 26522 | GET | `/v1/stability-registry/member/:membershipNumber` |
| 26570 | PUT | `/v1/stability-registry/:link` |

Registry follow-ups (4) — now in `registry.js`. The PATCH endpoint was
missed by the Phase 6 handoff inventory but is clearly the same domain;
folded in here so registry.js owns the entire registry-followups family:

| Original line | Method | URL |
|---|---|---|
| 26648 | GET | `/v1/registry-followups` |
| 26688 | GET | `/v1/registry-followups/summary` |
| 26781 | POST | `/v1/registry-followups` |
| 26825 | PATCH | `/v1/registry-followups/:id` |

Clinicians (5) — now in `clinicians.js`:

| Original line | Method | URL |
|---|---|---|
| 27007 | GET | `/v1/clinicians` |
| 27019 | GET | `/v1/clinicians/:memberNumber/physicians` |
| 27045 | GET | `/v1/members/:memberNumber/clinicians` |
| 27060 | POST | `/v1/members/:memberNumber/clinicians` |
| 27084 | DELETE | `/v1/members/:memberNumber/clinicians/:clinicianNumber` |

Protocol cards (2) — now in `protocol_cards.js`:

| Original line | Method | URL |
|---|---|---|
| 26411 | GET | `/v1/protocol-cards` |
| 26422 | GET | `/v1/protocol-cards/:cardId` |

F1_T5 scheduled-job handler — now in `registry.js` via `registerJobs(ctx)`:

| Original line | Job code |
|---|---|
| 27826 | `F1_T5` |

**Phase 6 also dispositioned 9 lint hits inside platform-shared code
that stays in pointers.js**: 4 inline string genericizations and 5
`// lint-allow` comments (see STATE.md "Anti-pattern lint" section).
The lint script was flipped from report-only to fail-on-match and
wired into `tests/run.cjs` as a Pre-flight gate.

**Total Insight endpoints moved across the refactor: 40.** (28 in
Phases 3–5 + 12 endpoints in Phase 6, plus the 4th registry-followups
PATCH endpoint that was folded in.)

`tests/insight/test_protocol_card_library.cjs`'s detection-code scan
list was extended to include `verticals/workforce_monitoring/server/
registry.js` — the F1_T5 move would otherwise have broken C20 because
the scan looks for `EXTENDED_CARD: 'T5'/'T6'/'F1'` literals which now
live in registry.js, not pointers.js.

### Phase 6 — endpoints Phase 6 MISSED — ✅ MOVED in Session 131 (Category 1)

Phase 6 + the post-Phase-6 cleanups were originally claimed to complete
the endpoint extraction. That was wrong: five healthcare-named endpoints
remained in `pointers.js`; Bill caught them after the retrospective
shipped. They slipped because the lint regex is case-sensitive and their
URLs are lowercase. Session 131 (Category 1) moved all five into
`verticals/workforce_monitoring/server/notes.js`:

| Was @ Line | Method | URL | Now |
|---|---|---|---|
| 26189 | GET | `/v1/physician-annotations/:membershipNumber` | notes.js |
| 26222 | POST | `/v1/physician-annotations` | notes.js |
| 26255 | GET | `/v1/survey-note-reviews` | notes.js |
| 26280 | GET | `/v1/survey-note-reviews/:membershipNumber` | notes.js |
| 26308 | PATCH | `/v1/survey-note-reviews/:reviewId` | notes.js |

Backed by `physician_annotation` and `survey_note_review` tables —
both Insight-specific. Two platform-side references to those tables
remained inside platform-shared endpoints that stay in `pointers.js`;
both were bridged via `verticalCallbacks` (same pattern as the
clinician helpers), each with a safe fallback so platform-only tenants
keep working:

- `survey_note_review` INSERT (was pointers.js:25742) inside the
  `/v1/member-surveys/:link/answers` PUT note-alert branch →
  `verticalCallbacks.recordSurveyNoteReview?.(...)` (no-op fallback).
- `physician_annotation` SELECT (was the `/v1/export/:report` `notes`
  section) → `verticalCallbacks.getMemberNotes?.(...) ?? []`.

After this move, `pointers.js` has **0** references to either table
outside the rolling BUILD_NOTES log.

**Corrected total Insight endpoints across the refactor: 45.** (40
moved across Phases 3–6 + 5 moved in Session 131 Category 1.)

---

## 2. Imports from the vertical

These are platform→vertical imports that violate layering. They must
move so that `pointers.js` doesn't reference `verticals/workforce_monitoring/`.

| Line | Kind | Statement |
|---|---|---|
| ~~6~~ | ~~static `import`~~ | ~~scorePPII.js~~ ✅ removed in Phase 5 |
| 26413 | dynamic `await import` | `protocolCards.js` (PROTOCOL_CARDS, CARD_CATEGORIES, RESPONSE_TIMELINE, CARD_PRIORITY, DETECTION_RULES) (Phase 6) |
| 26424 | dynamic `await import` | `protocolCards.js` (PROTOCOL_CARDS, RESPONSE_TIMELINE) (Phase 6) |

After Phase 6, these all live inside the vertical module — the
platform server doesn't import from the vertical at all.

---

## 3. Endpoints that stay platform-shared

Even though Insight uses these, they're generic enough to belong in
`pointers.js`. Listing them here so subsequent phases don't move
them by accident.

| Line | Method | URL | Why it stays |
|---|---|---|---|
| 8587 | POST | `/v1/test-rule/:bonusCode` | Bonus test rig — Delta and Insight both use it |
| 25443 | GET | `/v1/notification-delivery-config` | Delivery config (cron-window, timezone) — tenant-agnostic |
| 25455 | PUT | `/v1/notification-delivery-config` | Same |
| 27487 | GET | `/v1/signal-types` | Signal types table is per-tenant but mechanism is generic |
| 27502 | POST | `/v1/signal-types` | Same |
| 27518 | PUT | `/v1/signal-types/:id` | Same |
| 27534 | DELETE | `/v1/signal-types/:id` | Same |
| 27751 | GET | `/v1/external-actions` | Delta uses this (Free Drink Coupons) |
| 27766 | POST | `/v1/external-actions` | Same |
| 27785 | PUT | `/v1/external-actions/:id` | Same |
| 27812 | DELETE | `/v1/external-actions/:id` | Same |
| (TBD) | GET | `/v1/notification-rules` | Mechanism is generic; rule content can be tenant-specific |
| (TBD) | PUT | `/v1/notification-rules/:id` | Same |
| (TBD) | POST | `/v1/notification-rules/test` | Same |

If a future phase finds that one of these does carry Insight-only
logic in its handler body, that's surfaced when the handler is read,
and the decision can be revisited.

---

## 4. Soft branches in platform-shared code

Inline conditionals in platform code paths that gracefully handle
whether a tenant uses an Insight feature. These **stay** — they're
the correct platform-level handling.

| Line | What | Pattern |
|---|---|---|
| 6329–6343 | activities query MEMBER_SURVEY_LINK join | `try { ... await getMoleculeId(tenantId, 'MEMBER_SURVEY_LINK') } catch { /* tenant doesn't use surveys */ }` — joins `member_survey` only when the molecule exists |
| 26734 | accrual flow PPII recompute | comment + call into `calcPPII` (from the vertical import). The CALL stays platform-side but the IMPLEMENTATION is in the vertical. After Phase 5, this becomes a `ctx`-mediated call: the vertical registers a callback that the platform invokes after accrual; the platform doesn't know it's PPII |

---

## 5. FEATURE_CONDITIONAL_MOLECULES — none are Insight-specific

Checked all 6 entries (lines 245–276):

- `BONUS_RULE_ID`, `BONUS_ACTIVITY_LINK`, `BONUS_ACTIVITY_ID`,
  `BONUS_RESULT` — required by the bonus engine. Used by Delta too.
- `MEMBER_PROMOTION`, `PROMOTION` — required by the promotion engine.
  Used by Delta too.

This means **Phase 2's "move molecule readiness contract" is a no-op
on the data side** — there are no Insight-specific entries to move.
Phase 2 is reduced to wiring the vertical's `requiredMolecules` export
(initially empty array) into the boot check, plus implementing the
fail-closed routing rule from Design Decision 2. Both still need to
happen; they're scaffolding for future Insight-specific molecule
requirements.

---

## 6. Tenant-id hardcoded branches — none found

Searched for `tenant_id === 5`, `tenantId === 5`,
`tenant_key === 'wi_php'`, `vertical_key === 'workforce_monitoring'`
inside `pointers.js`. **Zero hits.** Branching by tenant identity is
not a pattern in the platform code today, which is good — the
extraction doesn't have to untangle hardcoded tenant logic.

Insight code is identified by URL prefix (`/v1/compliance/...`,
`/v1/meds/...`, etc.) and by the imports above, not by tenant-id
checks scattered through the file.

---

## 7. Scheduled job handlers — 4 to move, 2 stay

**Corrected after Phase 1 → flagged by Bill.** The original inventory
grepped for `setInterval`/`setTimeout`/`cron`/`schedule` and missed the
actual registration pattern, `registerJobHandler()`. There are six
handlers registered in `pointers.js`:

| Line | Job code | Disposition |
|---|---|---|
| — | `MEDS` | ✅ Moved in Phase 4 — now in `verticals/workforce_monitoring/server/meds.js` |
| — | `RANDOM_DRUG_TEST` | ✅ Moved in Phase 3 — now in `verticals/workforce_monitoring/server/compliance.js` |
| — | `DRUG_TEST_MISSED` | ✅ Moved in Phase 3 — now in `verticals/workforce_monitoring/server/compliance.js` |
| 29217 | `F1_T5` | **Insight** — move with Phase 6 (extended-card escalation) |
| 29440 | `NOTIFY_DELIVER` | Platform — stays (drives `notification_delivery` which Delta and Insight both use) |
| 29521 | `NOTIFY_DIGEST` | Platform — stays |

**Framework implication.** Each handler registers via `registerJobHandler(code, fn)`. After Phases 3, 4, and 6, the vertical needs to register its handlers from somewhere. Two integration points are required:

- `ctx.registerJobHandler` must expose the registry function so the vertical can call it.
- `vertical.boot(ctx)` must be invoked at server startup, after the DB setup chain has run (caches loaded) but before `startJobScheduler()` ticks — otherwise the scheduler races against handler registration and the first tick might find no handler for an Insight job code.

This contract is added in Phase 2.1 (the framework amendment that fixes this Phase 1 miss). Phase 1's "no scheduled jobs to extract" claim is rescinded.

Note on `scheduleFollowups()` (line 15311): a normal async function called from registry resolution endpoints, not a background job. Confirmed as a helper function, moves with Phase 6 (registry-followups endpoints) alongside its callers.

---

## 8. Healthcare-string lint hits — full list

The 29 healthcare-string lint matches in `pointers.js` cluster as:

- Lines 4965–5618: PPII/PPSI weight + subdomain endpoint error messages (8 hits) — all inside endpoints already listed in §1, Phase 5.
- Line 7042: `survey_code = 'PPSI'` literal inside a query — part of an endpoint listed in §1.
- Line 22255: PPII weights endpoint error message — already in §1.
- Lines 26467–27368: PPSI/PPII processing + debug logs in handlers — already in §1.
- Lines 28696–28988: Clinician/Physician/PPII error messages inside the clinician + protocol-card + registry handlers — already in §1.
- Lines 30821–30870: PPSI history query — part of MEDS-adjacent endpoints in §1.

All 29 hits **disappear** when the endpoints in §1 move. Plus the 3
import hits go to zero when the vertical owns its own imports
(§2). Net: **lint count drops to 0** after Phase 6.

---

## 9. Open questions surfaced by this inventory

Things that should be settled before Phase 3 begins:

1. **No unified audit helper.** Confirmed — audit writes inside the
   Insight endpoints (e.g. compliance entry, registry resolve,
   clinician assign) use raw SQL each time. Phase 3 (first endpoint
   move) will need to either pass a shared audit helper through
   `ctx`, or accept that each vertical endpoint still does its own
   audit SQL. The latter is simpler; the former is cleaner. Defer
   the decision to Phase 3.

2. ~~**`calcPPII` is called from a platform code path.**~~ ✅ RESOLVED in Phase 5 with option (a) — the callback registry pattern. pointers.js now has a module-level `verticalCallbacks = {}` plus a top-level `registerCallback(name, fn)` exposed as `ctx.registerCallback`. The vertical's `boot(ctx)` → `wellness.registerCallbacks(ctx)` calls `ctx.registerCallback('computePpii', calcPPII)`. The single platform-side caller — `gatherMemberFeatures` — reads `verticalCallbacks.computePpii?.({...}) || ppsiCurrent`. The `?.` + `||` fallback preserves the legacy "use ppsiCurrent when calcPPII returns 0/null" behavior AND gracefully degrades to ppsiCurrent when the vertical isn't loaded at all. The earlier-doc note about line 26734 in the accrual pipeline was incorrect — that call site was inside the `/v1/wellness/members` endpoint body itself, so it moved with the endpoint into `wellness.js` (vertical-internal call to `calcPPII`, no bridge needed). The only platform-side caller post-Phase 5 was the `gatherMemberFeatures` ppii_current ML feature.

3. **MEMBER_SURVEY_LINK try/catch (line 6334–6335).** Currently a
   silent catch with comment "tenant doesn't use surveys." If a
   future tenant defines MEMBER_SURVEY_LINK without member_survey
   data, the join fires and returns empty rows. Probably fine but
   worth noting if anyone later wonders why this is a try/catch
   rather than a feature-flag check.

---

## 10. Phase mapping summary

After this inventory, the phases are:

| Phase | Endpoints moved | Imports moved | Lint delta (actual / expected) |
|---|---|---|---|
| 1 | 0 | 0 | 28 → 28 ✅ |
| 2 | 0 | 0 | 28 → 28 ✅ (scaffolding only) |
| 2.1 | 0 | 0 | 28 → 28 ✅ (job handler framework) |
| 3 — Compliance | 9 + 2 job handlers | 0 | 28 → 28 ✅ (compliance had no PPII/PPSI/Clinician strings) |
| 4 — MEDS | 4 + 1 job handler + 2 helpers + 1 const | 0 | 28 → 28 ✅ (the PPSI strings the inventory expected to drop are inside the ML PREDICTIVE RISK section, separate from MEDS — they move with Phase 5) |
| 5 — PPSI/PPII | 13 (incl. wellness) | 1 (scorePPII.js — with the calcPPII callback bridge, see §9) | 28 → 16 ✅ (12-match drop, ahead of the ~8 estimate — wellness/members, ppsi-history, the 6 weights-config endpoints, and the 4 member-level PPSI endpoints collectively held 11 healthcare strings; the scorePPII.js import was the 12th) |
| 6 — Registry/Clinicians/Followups/Cards | 15 + 1 job handler (F1_T5) | 2 (protocolCards.js) | 16 → 0 ✅ (7 cleared by moves — 5 clinician endpoint bodies + 2 protocolCards.js imports; 4 cleared by inline string genericization in platform-shared code; 5 cleared by `// lint-allow` comments in platform-shared code) |

**End state achieved (Session 130):** lint = 0; script flipped to
fail-on-match and wired into `tests/run.cjs` as a Pre-flight gate
that runs before Step 1 (Verify Server). All 46 tests pass, 904
assertions, 0 failures.
