# Insight Touch Points in `pointers.js`

**Generated:** Session 127, Phase 1 of the Insight server extraction
(see `docs/INSIGHT_EXTRACTION_DESIGN.md`).

**Purpose:** Comprehensive inventory of every workforce_monitoring /
wi_php / "Insight" touch point in `pointers.js`, so subsequent
extraction phases work from a list instead of by discovery.

**How to refresh:** `node tests/lint-anti-patterns.cjs` surfaces the
strict-Insight string hits; this doc layers on endpoint URL patterns
+ import edges + soft branches. When you finish a phase, mark the
moved items here and check that the lint count drops accordingly.

---

## 1. Endpoints to move — strict Insight

Endpoints whose URL or implementation is unambiguously
healthcare/workforce-monitoring specific. These all move in phases 3–6.

### Phase 3 — Compliance (9 endpoints)

| Line | Method | URL |
|---|---|---|
| 27395 | GET | `/v1/compliance/member/:membershipNumber` |
| 27449 | GET | `/v1/compliance/member/:membershipNumber/history` |
| 27486 | POST | `/v1/compliance/entry` |
| 27590 | GET | `/v1/compliance/items` |
| 27606 | POST | `/v1/compliance/items` |
| 27622 | PUT | `/v1/compliance/items/:id` |
| 27647 | PUT | `/v1/compliance/member/:membershipNumber/cadence/:memberComplianceId` |
| 27672 | POST | `/v1/compliance/member/:membershipNumber/assign` |
| 27721 | DELETE | `/v1/compliance/member/:membershipNumber/assign/:complianceItemId` |

### Phase 4 — MEDS (4 endpoints)

| Line | Method | URL |
|---|---|---|
| 30450 | POST | `/v1/meds/check/:memberLink` |
| 30493 | GET | `/v1/meds/member/:memberLink` |
| 30595 | POST | `/v1/meds/seed` |
| 30622 | GET | `/v1/meds/summary` |

### Phase 5 — PPSI / PPII (12 endpoints)

PPII weight configuration (5):

| Line | Method | URL |
|---|---|---|
| 4945 | GET | `/v1/tenants/:id/ppii-weights` |
| 5060 | PUT | `/v1/tenants/:id/ppii-weights` |
| 5216 | POST | `/v1/tenants/:id/ppii-weights/recalculate` |
| 5692 | GET | `/v1/member/:id/ppii-history` |
| 22255 | (PPII weights query inside another endpoint) |

PPSI configuration + scoring (7):

| Line | Method | URL |
|---|---|---|
| 5366 | GET | `/v1/tenants/:id/ppsi-section-weights` |
| 5479 | PUT | `/v1/tenants/:id/ppsi-section-weights` |
| 5598 | POST | `/v1/tenants/:id/ppsi-section-weights/restore-defaults` |
| 6966 | GET | `/v1/member/:id/ppsi-history` |
| 26423 | POST | `/v1/pulse-respondents` |
| 27124 | POST | `/v1/members/:id/request-full-ppsi` |
| 27147 | DELETE | `/v1/members/:id/request-full-ppsi` |
| 27165 | GET | `/v1/members/:id/ppsi-mode` |

### Phase 6 — Registry / Clinicians / Follow-ups / Protocol Cards (15 endpoints)

Stability registry (5):

| Line | Method | URL |
|---|---|---|
| 28110 | GET | `/v1/stability-registry` |
| 28192 | GET | `/v1/stability-registry/member/:membershipNumber` |
| 28240 | PUT | `/v1/stability-registry/:link` |
| 25869 | GET | `/v1/stability-registry/audit-history` |

Registry follow-ups (3):

| Line | Method | URL |
|---|---|---|
| 28318 | GET | `/v1/registry-followups` |
| 28358 | GET | `/v1/registry-followups/summary` |
| 28451 | POST | `/v1/registry-followups` |

Clinicians (5):

| Line | Method | URL |
|---|---|---|
| 28677 | GET | `/v1/clinicians` |
| 28689 | GET | `/v1/clinicians/:memberNumber/physicians` |
| 28715 | GET | `/v1/members/:memberNumber/clinicians` |
| 28730 | POST | `/v1/members/:memberNumber/clinicians` |
| 28754 | DELETE | `/v1/members/:memberNumber/clinicians/:clinicianNumber` |

Protocol cards (2):

| Line | Method | URL |
|---|---|---|
| 28081 | GET | `/v1/protocol-cards` |
| 28092 | GET | `/v1/protocol-cards/:cardId` |

### Other Insight-specific endpoints (split across phases)

| Line | Method | URL | Move with |
|---|---|---|---|
| 26456 | GET | `/v1/wellness/members` | Phase 5 (PPII/PPSI surfaces tier) |

**Total Insight endpoints to move: 40.** (Initial design said ~28
because it pre-dated the cross-domain count; the categories are the
same but each has more endpoints than the head-count suggested.)

---

## 2. Imports from the vertical

These are platform→vertical imports that violate layering. They must
move so that `pointers.js` doesn't reference `verticals/workforce_monitoring/`.

| Line | Kind | Statement |
|---|---|---|
| 6 | static `import` | `import { calcPPII, normStream } from "./verticals/workforce_monitoring/tenants/wi_php/scorePPII.js";` |
| 28083 | dynamic `await import` | `protocolCards.js` (PROTOCOL_CARDS, CARD_CATEGORIES, RESPONSE_TIMELINE, CARD_PRIORITY, DETECTION_RULES) |
| 28094 | dynamic `await import` | `protocolCards.js` (PROTOCOL_CARDS, RESPONSE_TIMELINE) |

After Phase 6, these all live inside the vertical module — the
platform server doesn't import from the vertical at all.

---

## 3. Endpoints that stay platform-shared

Even though Insight uses these, they're generic enough to belong in
`pointers.js`. Listing them here so subsequent phases don't move
them by accident.

| Line | Method | URL | Why it stays |
|---|---|---|---|
| 8495 | POST | `/v1/test-rule/:bonusCode` | Bonus test rig — Delta and Insight both use it |
| 25351 | GET | `/v1/notification-delivery-config` | Delivery config (cron-window, timezone) — tenant-agnostic |
| 25363 | PUT | `/v1/notification-delivery-config` | Same |
| 27742 | GET | `/v1/signal-types` | Signal types table is per-tenant but mechanism is generic |
| 27757 | POST | `/v1/signal-types` | Same |
| 27773 | PUT | `/v1/signal-types/:id` | Same |
| 27789 | DELETE | `/v1/signal-types/:id` | Same |
| 28006 | GET | `/v1/external-actions` | Delta uses this (Free Drink Coupons) |
| 28021 | POST | `/v1/external-actions` | Same |
| 28040 | PUT | `/v1/external-actions/:id` | Same |
| 28067 | DELETE | `/v1/external-actions/:id` | Same |
| 28776 | GET | `/v1/notification-rules` | Mechanism is generic; rule content can be tenant-specific |
| 28791 | PUT | `/v1/notification-rules/:id` | Same |
| 28818 | POST | `/v1/notification-rules/test` | Same |

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

## 7. Scheduled jobs / cron / setInterval — none found

Searched for `setInterval`, multi-second `setTimeout`, `cron`, `schedule`.
The matches that came up are all legitimate platform code:

- `scheduleFollowups()` (line 15311) — a normal async function called
  from registry resolution endpoints. Not a background job, just
  named "schedule." This is an Insight helper function and moves with
  Phase 6 (its callers are the registry-followups endpoints).
- Various `setTimeout` for debouncing inside handlers (not background
  work).

**No standalone cron/scheduled-job process to extract.** If one is
added later for Insight (e.g. nightly compliance digest), it goes in
the vertical's `boot()` hook (per Design Decision 3).

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

| Phase | Endpoints moved | Imports moved | Expected lint delta |
|---|---|---|---|
| 1 (this) | 0 | 0 | 0 (baseline 28 → 28) |
| 2 | 0 | 0 | 0 (28 → 28) — scaffolding only |
| 3 — Compliance | 9 | 0 | unchanged-ish (compliance has few healthcare strings) |
| 4 — MEDS | 4 | 0 | a few PPSI strings via the MEDS query at line 30821 |
| 5 — PPSI/PPII | 12 + wellness | 1 (scorePPII.js) | ~20 hits cleared |
| 6 — Registry/Clinicians/Followups/Cards | 15 | 2 (protocolCards.js) | remaining hits cleared |

End state target: **lint = 0**, plus the lint script's report-only
mode flips to fail-on-match in `tests/run.cjs` (per design doc
acceptance criteria).
