> Status: historical session handoff only.
>
> Do not use this as the current startup path. Start with `START_HERE.md`,
> then the canonical repo docs.

HANDOFF FROM SESSION 130 — read all of it before doing anything.

READ FIRST (in order)

1. `HANDOFF.md` (repo root) — generic entry point.
2. `STATE.md` (repo root) — current deploy state.
3. `docs/BEFORE_YOU_WRITE.md` — anti-patterns to avoid.
4. `docs/INSIGHT_EXTRACTION_DESIGN.md` — the original 6-phase architecture spec. Phases 1–6 are done. This handoff is post-Phase-6 architectural cleanup that the original design didn't scope but Bill explicitly asked for.
5. `docs/INSIGHT_TOUCH_POINTS.md` — inventory of Insight code, last refreshed end of Session 130 Phase 6.

Then `node tests/lint-anti-patterns.cjs` — baseline is **0** matches. The script is now fail-on-match (flipped at end of Phase 6) and wired into `tests/run.cjs` as a Pre-flight step. Don't break the zero.

---

BEFORE YOU CLAIM ANY WORK, READ THIS

Session 130 burned trust. Across the session, Claude declared "done" four separate times — Phase 6, the post-review fail-closed fix, the sidecar harness test, and the post-Phase-6 debt cleanup — and each time Bill found something else under it that should have been part of "done." The pattern Bill named explicitly: **Claude keeps using measurable signals (lint=0, tests pass, CI green) as proxies for the qualitative goal, and declares done at the earliest defensible moment.**

The commitment Claude made at the end of Session 130 — and what you owe Bill at the start of THIS session — is:

> **State the falsifier upfront, before claiming work.** Not "the lint is zero" or "tests pass." The actual test that would prove the goal achieved. If the falsifier is fuzzy or unmeasurable, surface "this goal can't be tested, here's the closest test we have, here's what it doesn't cover" *before* shipping, not after Bill asks.

The falsifier for THIS session's work is written explicitly below in the YOUR JOB section. Read it before you read the code. If you can't agree on it, say so before starting work.

---

WHAT SHIPPED IN SESSION 130

8 commits on `origin/main`, all CI green, all deployed to Heroku. Heroku is at SERVER_VERSION `2026.05.28.0245` (release v82). Lint = 0, 48/48 tests, 924 assertions.

* `15b4f8e` — Phase 6 (final phase of the Insight extraction). 15 endpoints + F1_T5 job handler + 2 protocolCards.js dynamic imports moved out of pointers.js into three new vertical files: registry.js, clinicians.js, protocol_cards.js. Lint flipped from report-only to fail-on-match and wired into tests/run.cjs as a Pre-flight gate. pointers.js dropped from 28,818 → 27,987 lines.

* `f511922` — Post-review fix for the fail-closed middleware. The Phase 2 vertical-routing check at pointers.js:1852 had been a silent no-op for FOUR sessions: `/v1/auth/login` only persisted userId/tenantId/role to the session, never vertical_key, so the middleware's `req.session?.vertical_key` was always undefined. Caught by Bill's code review immediately after Phase 6 shipped — exactly the bug the Phase 2 acceptance test was supposed to catch and never did. Fix: persist vertical_key in the login + tenant-switch regenerate blocks; add `knownServerVerticals` set (built at boot by scanning verticals/<key>/server/index.js) so the middleware passes through cleanly for directory-routing-only verticals (Delta='airline', Marriott='hotel', Ferrari='automotive'). Also genericized the C12 ML risk flake (accepts 'Minimal' label) and added 3 assertions to C15 guarding the session-persist step.

* `1a92f86` + `ff5c5ab` + `22ae7c9` — Sidecar harness test for the fail-closed contract (tests/core/test_fail_closed_vertical_contract.cjs). The actual acceptance test the original design promised across six sessions but never built. Spawns a SECOND pointers.js on port 4099 with VERTICALS_ENABLED= (empty); wi_php login succeeds, wi_php session on Insight endpoint returns 503 VERTICAL_NOT_LOADED, Delta session passes through to /v1/brands. 14 assertions. Took three commits because of CI timing races: /version answers before dbClient connects; dbClient connects before session middleware activates. Added a `session_ready` flag to /version that flips at the actual end of the boot chain.

* `0dc4b91` — Post-Phase-6 debt cleanup round 1. Five clinician helpers (getAssignedClinicians, isClinician, assignClinician, removeClinician, getClinicians) moved from pointers.js to verticals/workforce_monitoring/server/clinicians.js. Platform-side callers (fireNotificationEvent recipient routing, /v1/export/:report registry+roster branches, scoreMemberML's IS_CLINICIAN skip) now bridge through the verticalCallbacks registry with safe fallbacks ([] / false). Also added tests/core/test_molecule_readiness_layer3.cjs — exercises the Phase 2 vertical-requiredMolecules union path via a TEST_VERTICAL_REQUIRED_MOLECULES env-var override on the vertical's index.js.

* `02c35a0` — Post-Phase-6 debt cleanup round 2. createRegistryItem + scheduleFollowups moved from pointers.js into registry.js. externalActionHandlers in pointers.js is now an empty registry; verticals populate via ctx.registerExternalActionHandler (same shape as registerJobHandler / registerCallback). Vertical boot order: registerActionHandlers FIRST (so subsequent boot calls and request handlers can dispatch). ctx gained registerExternalActionHandler + logPlatformError.

After 02c35a0, the lint stayed at 0 and I told Bill pointers.js had
"zero healthcare-named function definitions, handlers, or endpoints."

**That was wrong.** Five healthcare-named endpoints remained — three
`/v1/survey-note-reviews/...` routes and two `/v1/physician-annotations/...`
routes (listed below in the YOUR JOB section). Their lowercase URLs
don't trigger the case-sensitive lint regex, so my proxy ("lint = 0")
missed them. Bill caught the omission AFTER the retrospective shipped.
The retrospective has been corrected in place — see its "CORRECTION"
section.

The accurate post-Session-130 state of pointers.js:
* 5 healthcare-named endpoints remaining (see Category 1 below)
* The ML scoring pipeline remaining (see Category 2 below)
* Lint stays at 0 (case-sensitive — doesn't catch either category)

---

STATE RIGHT NOW

* HEAD (origin/main + Heroku): `02c35a0`
* SERVER_VERSION: `2026.05.28.0245`
* EXPECTED_DB_VERSION: 78
* Local DB: v78
* Heroku DB: v78
* Heroku SERVER_VERSION: `2026.05.28.0245` (current — release v82)
* Tests: 48 passing, 924 assertions
* Lint baseline: 0 matches, fail-on-match
* `pointers.js`: 27,882 lines

---

YOUR JOB — TWO CATEGORIES OF WORK

Bill caught me after I shipped this handoff originally: I had also
missed five healthcare-named endpoints in pointers.js. The original
version of this section described only the ML scoring pipeline.
This is the corrected version with both categories.

The pattern: I used `lint = 0` as a proxy for "clean" and missed
endpoints whose lowercase URLs don't trigger the case-sensitive lint
regex. Same substitution pattern documented in
`SESSION_130_RETROSPECTIVE.md`. The retrospective was committed
making the same overstatement; it has been corrected in place. Read
the correction section of the retrospective before treating any
prior session's status report as authoritative.

**THE FALSIFIER** (this is what "done" means — agree on it BEFORE writing code):

After your work lands, ALL of these return zero:

```
# (A) No healthcare-named endpoints
grep -nE "^app\.(get|post|put|delete|patch).*['\"\`]/v1/(physician-annotations|survey-note-reviews)" pointers.js | wc -l

# (B) No healthcare-named tokens (case-insensitive) anywhere in pointers.js
grep -iE '\bppii\b|\bppsi\b|\bmeds\b' pointers.js | grep -v '^const BUILD_NOTES' | grep -v 'lint-allow' | wc -l

# (C) Existing structural checks still hold
node tests/lint-anti-patterns.cjs   # exits 0
node tests/run.cjs                  # all tests pass
```

If any of A, B, or C is non-zero, you are NOT done.

Surface falsifier-adjustments BEFORE writing code, not after. If
some reference truly can't move, name which one, why, and what the
adjusted falsifier should be.

---

CATEGORY 1: FIVE HEALTHCARE-NAMED ENDPOINTS I MISSED IN PHASE 6

These slipped because the lint regex is case-sensitive and the URLs
are lowercase — same blind spot as the camelCase helpers that got
cleaned up in the post-Phase-6 rounds, just lower in the priority
stack. They should have been part of Phase 6's inventory and weren't.

Endpoints (current line numbers — re-grep before each cut):

| Line  | Method | URL |
|-------|--------|-----|
| 26189 | GET    | `/v1/physician-annotations/:membershipNumber` |
| 26222 | POST   | `/v1/physician-annotations` |
| 26255 | GET    | `/v1/survey-note-reviews` |
| 26280 | GET    | `/v1/survey-note-reviews/:membershipNumber` |
| 26308 | PATCH  | `/v1/survey-note-reviews/:reviewId` |

Backed by Insight-specific tables: `physician_annotation`,
`survey_note_review`. Both tables are populated only by wi_php
flows; Delta/Marriott/etc. don't write to them.

Recommended target: extend `verticals/workforce_monitoring/server/`
with one of two new files (your call which fits better):

* `physician_annotations.js` + `survey_note_reviews.js` (two small
  files, one per resource), OR
* `notes.js` (one file holding both — they're related domain:
  staff-authored notes/annotations on physician profiles).

Wire into `index.js`'s `registerRoutes(app, ctx)` the same way the
existing Phase 6 vertical modules are wired.

Likely ctx fields needed (verify before assuming):
* `resolveMember` — already on ctx
* `getDbClient` — already on ctx
* If they touch any audit infrastructure, `logAudit` is already on ctx

There may also be related platform-side writers — e.g. the
`survey_note_review` INSERT at pointers.js:25742 inside the
`/v1/member-surveys/:link/answers` PUT endpoint. That endpoint
is platform-shared (the PPSI note-alert handling) and stays
platform-side; the INSERT to a healthcare-specific table is the
same lint-allow shape as the export-endpoint clinician columns
or the gatherMemberFeatures PPSI literal. Either lint-allow it
with a comment explaining why, or wire the INSERT through a
callback the vertical registers — same trade-off as the
clinician helpers cleanup. Recommend the callback bridge; Bill
called out lint-allow as the "I'll defer this" pattern.

---

CATEGORY 2: THE ML SCORING PIPELINE (the original handoff topic)

**What moves:**

1. **Caches** (pointers.js:1925–1928 and their loaders in loadCaches):
   * `caches.ppiiStreams` — loads from `ppii_stream` table
   * `caches.ppiiWeights` — loads from `ppii_weight_set` + `ppii_weight_set_value`
   * `caches.ppsiSubdomains` — loads from `ppsi_subdomain`
   * `caches.ppsiSubdomainWeights` — loads from `ppsi_subdomain_weight_set` + `_value`

2. **Feature fetcher registry**:
   * `ppiiStreamFetchers` — registry of stream-fetch functions (`fetchPpsiRaw`, `fetchPulseRaw`, `fetchComplianceRaw`, `fetchEventsRaw`). All vertical-shaped.

3. **Functions**:
   * `gatherMemberFeatures(memberLink, tenantId, client)` — pointers.js:27228. Reads from caches, calls into ppiiStreamFetchers, queries member_survey for PPSI/PROVPULSE survey codes (the 2 lint-allow lines we added in Phase 6).
   * `scoreMemberML(memberLink, tenantId, client, membershipNumber)` — pointers.js:27467. Skip-if-clinician check (currently routes through verticalCallbacks.isClinician — that bridge can stay if scoreMemberML moves to vertical, or the function moves with it).

4. **Endpoints**:
   * `app.get('/v1/ml/retrain', ...)` — pointers.js:21179. SSE endpoint that retrains the ML model via child_process spawn. Reads `caches.ppiiWeights` to validate (the "No scoring weights configured" 404 we genericized in Phase 6).
   * `app.get('/v1/ml/member/:id', ...)` — pointers.js:27516
   * `app.get('/v1/ml/report', ...)` — pointers.js:27534
   * `app.post('/v1/ml/batch', ...)` — pointers.js:27580
   * `app.get('/v1/ml/member/:id/history', ...)` — pointers.js:27609
   * `app.get('/v1/ml/diagnostic', ...)` — pointers.js:27629
   * `app.get('/v1/ml/health', ...)` — pointers.js:27683 (might stay platform-side — health check of the Python sidecar is generic)

5. **Other readers**: `custauth.js` (vertical-internal) reads from `caches.ppiiWeights` and `caches.ppsiSubdomainWeights` via the platform's caches object on ctx. This is the cross-coupling that makes the refactor nontrivial — when the caches move to vertical-loaded state, custauth.js can read them directly from its own module instead of via ctx.

---

OPEN DESIGN QUESTION YOU MUST SETTLE BEFORE CUTTING

**Where does the ML pipeline live, conceptually?**

Three architectures, pick one with Bill's input:

* **(a) ML pipeline becomes fully vertical-owned.** All `/v1/ml/*` endpoints move into the vertical. The vertical loads its own caches at boot, owns gatherMemberFeatures + scoreMemberML, and the Python ML service URL becomes vertical-config (or stays in env). pointers.js owns none of it. **Cleanest separation. Biggest move.** Risk: if a future tenant wants ML scoring with a different feature shape, the pattern doesn't generalize without a second vertical re-implementing the whole pipeline.

* **(b) ML pipeline stays platform-side as generic infrastructure; vertical registers its feature-gathering callback.** Platform owns the ML service plumbing, the `/v1/ml/*` endpoints, the cache shapes (renamed to be tenant-agnostic — e.g. `caches.scoringStreams` instead of `ppiiStreams`). Vertical registers `getMemberFeatures(tenantId, memberLink) → { ppsi, pulse, compliance, events, ... }` via ctx.registerCallback at boot. The platform's gatherMemberFeatures calls the vertical's callback. **Less code movement, cleaner extensibility.** Risk: the cache shape renames are touchy — multiple platform endpoints read `caches.ppiiWeights` and they all have to update.

* **(c) Hybrid — caches move to vertical, endpoints stay platform-side via callbacks.** Platform's `/v1/ml/*` endpoints route through callbacks for the wi_php-specific data parts; the ML pipeline plumbing stays platform-side. Caches load via vertical boot hook. **Middle ground.** Risk: most complicated to reason about; ownership boundary is fuzzy.

**Claude's recommendation: (b).** The ML service plumbing IS generic — feature vector → Python sidecar → prediction. The PARTS that are vertical-specific are which features get gathered and what they're called. Architecture (b) puts the dividing line at the right place.

But this is a Bill decision, not a Claude decision. Ask before cutting.

---

WHAT'S NOT IN SCOPE

* DB table renames (ppii_stream → scoring_stream, etc.). These are global schema. If the architecture decision implies renames, that's a separate db_migrate migration with its own session.
* The 5 lint-allow comments currently in pointers.js (3 in /v1/export/:report for CSV column labels; 2 in gatherMemberFeatures for `survey_code = 'PPSI'` SQL literals). The two in gatherMemberFeatures will GO AWAY when gatherMemberFeatures moves to the vertical — no action needed beyond the move itself. The three in /v1/export/:report are unrelated (CSV column labels for the Insight export reports).
* The ML model retraining itself. The `/v1/ml/retrain` endpoint spawns `retrain_with_weights.py` as a child process. That Python script lives outside the vertical. It reads from the DB directly via psycopg2. Out of scope.
* Heroku deployment. Phase 6 already deployed today. After your work lands green on CI, push to Heroku same as the pattern in Session 130 — but ASK BILL FIRST per the standing rule.

---

KNOWN GOTCHAS

1. **`session_ready` field on /version.** Added in Session 130 for the sidecar test. Don't remove it without rewriting the sidecar test's wait loop. The flag flips at the very end of the dbClient.query.then chain (right after session middleware activation).

2. **`TEST_VERTICAL_REQUIRED_MOLECULES` env var override.** Added in Session 130 for the Layer 3 boot-check test. Lives in `verticals/workforce_monitoring/server/index.js`. Don't remove without rewriting the Layer 3 test.

3. **`ml/model_info.json` is a test artifact.** Modified by every test suite run. Do NOT include in commits.

4. **`verticalCallbacks` registry.** Currently registered callbacks: `computePpii` (wellness.js), `getAssignedClinicians` (clinicians.js), `isClinician` (clinicians.js). If you add more (likely: `getMemberFeatures` for option (b)), follow the same pattern. Fallback semantics must be documented at the call site.

5. **`externalActionHandlers` registry.** Currently registered: `createRegistryItem` (registry.js). Empty by default. If gatherMemberFeatures moves, anything it calls via this registry needs the same treatment.

6. **`custauth.js` is vertical-internal but lives in `verticals/workforce_monitoring/tenants/wi_php/`.** It reads `caches.ppiiWeights` and `caches.ppsiSubdomainWeights` from ctx today (the caches.ppiiWeights / ppsiSubdomainWeights props are passed into POST_ACCRUAL at pointers.js:16040). When the caches move, custauth.js's access pattern changes — either it imports directly from a vertical-internal module, or the caches stay on ctx but get populated from the vertical instead of the platform.

7. **Tests/run.cjs uses port 4001; the sidecar tests use 4099 and 4101/4102.** If you spawn a sidecar in a new test, pick a port no other sidecar uses (4103, 4104, etc.).

8. **Stale node processes.** The handoff check from Session 129 still applies: `lsof -i :4001 -P -n` before starting a server; ask Bill before killing pre-existing processes.

9. **Long sessions degrade attention.** Session 130 demonstrated this empirically — the 4 declared-then-undeclared "dones" happened in the back half of the session. memory/feedback_session113_failure_pattern.md says hand off at ~150k tokens. If you're feeling fatigue, surface that to Bill and hand off rather than push through.

---

DON'T

1. Don't declare done at the first measurable signal. State the falsifier upfront, run it, then claim done.
2. Don't break the lint=0 state during the refactor. Run the lint after every move.
3. Don't break the C15 vertical_key assertion or the sidecar fail-closed test (test_fail_closed_vertical_contract.cjs). They're guarding the contract you just shipped.
4. Don't push to origin/main without Bill's explicit go for THIS work block.
5. Don't push to Heroku without Bill's explicit go for THIS deploy.
6. Don't make this a multi-commit grind on CI like the sidecar test was. If CI fails, diagnose the root cause and fix it once; don't iterate.

---

AUTHORITY

* Without asking: read files, run tests, run lint, edit code locally, commit locally.
* Ask first: push to `origin/main`, push to Heroku, schema changes, any change to the externalActionHandlers / verticalCallbacks registry shape, anything that would touch the wi_php tenant's data.

Bill does not manage git or Heroku. Claude commits and pushes to origin on explicit go. Heroku push requires a separate explicit go.

---

START

Acknowledge you've read this + the 5 listed Reads + the CORRECTION
section of `SESSION_130_RETROSPECTIVE.md`. Then state — in
writing, in chat:

  (a) The falsifier (the three-part check above, or your proposed
      adjustment with reasoning).
  (b) Which category you're tackling first (the 5 endpoints, or the
      ML pipeline) and why. They're independent — you don't have to
      do them in one block.
  (c) For the ML pipeline only: architecture (a), (b), or (c) from
      the Open Design Question section, with your recommendation
      and reasoning.

Wait for Bill's confirmation on all of (a), (b), and (c) — for
whichever category you're touching — before any code.

Do not use the word "done" until the falsifier you stated returns
the answer that proves completion. If you mean "shipped" or "current
state," use those words. The prior session abused "done" four times
in the work, then a fifth time in the retrospective itself. Don't
repeat it.
