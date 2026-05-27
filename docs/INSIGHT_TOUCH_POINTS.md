# Insight Touch Points in `pointers.js`

**Generated:** Session 127, Phase 1 of the Insight server extraction
(see `docs/INSIGHT_EXTRACTION_DESIGN.md`).
**Line numbers last refreshed:** Session 128 (after Phase 4 cut).

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

### Phase 5 — PPSI / PPII (13 endpoints, including wellness)

PPII weight configuration + history (4):

| Line | Method | URL |
|---|---|---|
| 5037 | GET | `/v1/tenants/:id/ppii-weights` |
| 5152 | PUT | `/v1/tenants/:id/ppii-weights` |
| 5308 | POST | `/v1/tenants/:id/ppii-weights/recalculate` |
| 5784 | GET | `/v1/member/:id/ppii-history` |

PPSI configuration + scoring (8):

| Line | Method | URL |
|---|---|---|
| 5458 | GET | `/v1/tenants/:id/ppsi-section-weights` |
| 5571 | PUT | `/v1/tenants/:id/ppsi-section-weights` |
| 5690 | POST | `/v1/tenants/:id/ppsi-section-weights/restore-defaults` |
| 7058 | GET | `/v1/member/:id/ppsi-history` |
| 26515 | POST | `/v1/pulse-respondents` |
| 27216 | POST | `/v1/members/:id/request-full-ppsi` |
| 27239 | DELETE | `/v1/members/:id/request-full-ppsi` |
| 27257 | GET | `/v1/members/:id/ppsi-mode` |

Wellness (1):

| Line | Method | URL |
|---|---|---|
| 26548 | GET | `/v1/wellness/members` |

**Inline lint hit at L22347** (`"No PPII weights configured for tenant ${tenantId}"`)
is an error string inside `gatherMemberFeatures` which stays platform-side. Clears
in Phase 6 sweep or by replacing with a generic string — NOT Phase 5's concern.

### Phase 6 — Registry / Clinicians / Follow-ups / Protocol Cards (15 endpoints + F1_T5 job handler)

Stability registry (4):

| Line | Method | URL |
|---|---|---|
| 25961 | GET | `/v1/stability-registry/audit-history` |
| 27855 | GET | `/v1/stability-registry` |
| 27937 | GET | `/v1/stability-registry/member/:membershipNumber` |
| 27985 | PUT | `/v1/stability-registry/:link` |

Registry follow-ups (3):

| Line | Method | URL |
|---|---|---|
| 28063 | GET | `/v1/registry-followups` |
| 28103 | GET | `/v1/registry-followups/summary` |
| 28196 | POST | `/v1/registry-followups` |

Clinicians (5):

| Line | Method | URL |
|---|---|---|
| 28422 | GET | `/v1/clinicians` |
| 28434 | GET | `/v1/clinicians/:memberNumber/physicians` |
| 28460 | GET | `/v1/members/:memberNumber/clinicians` |
| 28475 | POST | `/v1/members/:memberNumber/clinicians` |
| 28499 | DELETE | `/v1/members/:memberNumber/clinicians/:clinicianNumber` |

Protocol cards (2):

| Line | Method | URL |
|---|---|---|
| 27826 | GET | `/v1/protocol-cards` |
| 27837 | GET | `/v1/protocol-cards/:cardId` |

F1_T5 scheduled-job handler:

| Line | Job code |
|---|---|
| 29217 | `F1_T5` |

**Total Insight endpoints remaining to move: 28.** (40 originally;
9 compliance + 4 MEDS landed in Phases 3 + 4.)

---

## 2. Imports from the vertical

These are platform→vertical imports that violate layering. They must
move so that `pointers.js` doesn't reference `verticals/workforce_monitoring/`.

| Line | Kind | Statement |
|---|---|---|
| 6 | static `import` | `import { calcPPII, normStream } from "./verticals/workforce_monitoring/tenants/wi_php/scorePPII.js";` (Phase 5 — but requires the calcPPII callback boundary, see Open Question #2 in §9) |
| 27828 | dynamic `await import` | `protocolCards.js` (PROTOCOL_CARDS, CARD_CATEGORIES, RESPONSE_TIMELINE, CARD_PRIORITY, DETECTION_RULES) (Phase 6) |
| 27839 | dynamic `await import` | `protocolCards.js` (PROTOCOL_CARDS, RESPONSE_TIMELINE) (Phase 6) |

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

2. **`calcPPII` is called from a platform code path.** Line 26734 in
   the accrual pipeline invokes the vertical's PPII calculator
   inline. After Phase 5 the vertical can't be imported from
   `pointers.js`. Options: (a) the vertical registers a
   post-accrual hook via `ctx` that the platform invokes; (b) the
   vertical's accrual endpoint becomes a wrapper that calls the
   platform's accrual then runs PPII. Decide before Phase 5.

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
| 5 — PPSI/PPII | 13 (incl. wellness) | 1 (scorePPII.js — needs the calcPPII callback bridge, see §9) | expected: ~20 hits cleared |
| 6 — Registry/Clinicians/Followups/Cards | 15 + 1 job handler (F1_T5) | 2 (protocolCards.js) | expected: remaining hits cleared |

End state target: **lint = 0**, plus the lint script's report-only
mode flips to fail-on-match in `tests/run.cjs` (per design doc
acceptance criteria).
