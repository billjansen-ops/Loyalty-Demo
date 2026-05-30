# STATE — where things stand right now

Last updated: 2026-05-30 after the documentation cleanup pass. Session 131
app/deploy state is unchanged; local `main` may be ahead with unpushed
docs-only commits. Verify with `git log --oneline origin/main..main`.

**Category 1**: the five healthcare-named endpoints Phase 6 missed
(3 survey-note-reviews, 2 physician-annotations) are out of `pointers.js`
and live in `verticals/workforce_monitoring/server/notes.js`, with the two
remaining platform-side table references bridged via verticalCallbacks
(getMemberNotes, recordSurveyNoteReview).

**Category 2 — ML scoring pipeline + exports — SHIPPED.** Architecture (b)
from `docs/history/HANDOFF_FROM_130.md`. What moved out of `pointers.js`:
- `gatherMemberFeatures` (the ~240-line PPSI/Pulse/compliance/MEDS/registry
  feature builder) → `verticals/workforce_monitoring/server/ml_features.js`,
  registered as `verticalCallbacks.getMemberFeatures`. `scoreMemberML` (generic
  ML plumbing — POST to ML service, store ML_RISK_SCORE molecule) STAYS
  platform-side and reads the callback with a null guard.
- Both export endpoints (`GET /v1/export/:report`,
  `GET /v1/export/participant/:membershipNumber`) → new
  `verticals/workforce_monitoring/server/exports.js`. Insight-only (called only
  from physician_detail.html + action_queue.html). `toCsv` moved with them;
  clinician/notes enrichments call the vertical's own getAssignedClinicians /
  getMemberNotes (now named exports) directly.
- Deleted the dead `ppiiStreamFetchers` registry (~115 lines) — nothing called
  `calcPPIIFromMember` at runtime.
- `/v1/ml/retrain` STAYS platform-side (generic SSE retrain plumbing); the
  Insight weight-bundle shape bridged to `verticalCallbacks.prepareRetrainWeights`
  (scoring_admin.js).
- 15 platform-side comments reworded to clear standalone PPII/PPSI/MEDS prose.

`pointers.js` dropped 27735 → ~26975 lines (-759).

**Verified by the agreed Category 2 falsifier, not by lint alone:** Part-B = 0
standalone `ppii/ppsi/meds` tokens in `pointers.js` (case-insensitive,
whole-word, COMMENTS INCLUDED) outside the BUILD_NOTES log; lint 0; full suite
48 tests / 924 assertions / 0 failures (server restarted on the new code with
PG env vars first — same DB-less gotcha as Category 1, handled up front). C14
CSV Export + Participant Chart Export exercise the relocated /v1/export routes;
C12 + C16 ML tests exercise the getMemberFeatures callback.

Lint count is 0 and the script is fail-on-match in the test runner. The lint
regex is case-sensitive — that is exactly what let the 5 Category-1 endpoints
slip (lowercase URLs) and why camelCase cache names (`ppiiStreams`) and
snake_case tables (`ppii_stream`) don't trip it. Don't treat lint = 0 as proof
of clean separation; the falsifier above is the real gate.

**Insight extraction from `pointers.js` is now functionally complete** — no
healthcare-named endpoints, ML feature gathering, or standalone PPII/PPSI/MEDS
tokens remain platform-side. Remaining Insight-coupled bits in `pointers.js`
are intentional, scoped-out: the cache loaders (query `ppii_stream` etc. — a
table/cache-rename migration, not in scope) and the survey-render math-version
branching.

---

## Deploy state

| Thing | Value |
|---|---|
| `origin/main` | `91242e5` — STATE: Session 131 Cat 2 deployed to Heroku (release v84) |
| Local-only commits | Verify with `git log --oneline origin/main..main` before pushing |
| Last deployed app change | `42a8b4c` — Session 131 Cat 2: extract ML scoring pipeline + exports to vertical |
| `SERVER_VERSION` (local) | `2026.05.29.1521` (in sync with Heroku — deployed) |
| `EXPECTED_DB_VERSION` | `78` |
| Local DB version | `78` |
| Heroku DB version | `78` |
| Heroku `SERVER_VERSION` | `2026.05.29.1521` (release v84 — code matches `90f17d1`, CI green before deploy; login probe 401 confirms DB up) |
| Heroku app name | `hdwhf` |
| Heroku URL | https://hdwhf-6e6c604bb3f3.herokuapp.com |
| Heroku release | `v84` |

GitHub remote: `git@github.com:billjansen-ops/Loyalty-Demo.git`
Heroku remote: `https://git.heroku.com/hdwhf.git`

There is one branch: `main`. No feature branches, no worktrees.

---

## Test suite

- **48 tests total**, **all 48 passing** as of Session 131.
- **924 assertions**, all passing.
- The C12 ML Predictive Risk Scoring flake mentioned in earlier STATE
  revisions has not reproduced lately; if it returns, it's an existing
  intermittent (the "Valid risk label" assertion), not a regression
  from current work.
- Run: `node tests/run.cjs` for the full suite, or
  `node tests/run.cjs <manifest-path>` for a single test (e.g.
  `node tests/run.cjs insight/test_compliance.cjs`).
- Manifest: `tests/manifest.json` lists every test.
- Coverage: strong on Insight (wi_php), now decent on Delta after
  Session 127's 5-test smoke addition (bonus edit, promotion edit,
  molecule edit, typeahead, CSR green block grouping).

---

## Anti-pattern lint

`node tests/lint-anti-patterns.cjs` — fail-on-match grep-based detector.

**Current count: 0 matches.** Treat any non-zero count as a regression
to fix before commit.

The lint script is now flipped from report-only to fail-on-match
(exit 1 on any unsuppressed hit) AND wired into `tests/run.cjs` as a
Pre-flight step that runs before Step 1 (Verify Server) — fails fast
on any new anti-pattern before any database snapshot or test setup.

---

## Pending structural work

In order. Each step is mostly wasted without the next.

### 1. Delta-side smoke tests ✅ DONE (Session 127)

Five smoke tests added in `tests/delta/`:
- Bonus edit save preserves `bonus_result_id`
- Promotion edit save preserves `promotion_result_id`
- Molecule edit save preserves `value_id`
- Typeahead auto-selects on exact-code match
- CSR green block groups externals under parent bonus

These catch the destructive-save reverts, typeahead silent failures,
and CSR grouping regressions that Session 126 fixed by hand.

### 2. Extract Insight server code from `pointers.js` — ✅ FUNCTIONALLY COMPLETE

Design doc: `docs/INSIGHT_EXTRACTION_DESIGN.md`. Inventory:
`docs/INSIGHT_TOUCH_POINTS.md`.

| Phase | Status |
|---|---|
| 1 — Scaffolding + inventory | ✅ Session 127 |
| 2 — Molecule readiness contract + fail-closed auth | ⚠️ Session 127 SHIPPED, FAIL-CLOSED CONTRACT VERIFIED Session 130 (the original 127 version was a silent no-op for 4 sessions — see retrospective) |
| 2.1 — Scheduled-job framework gap fix | ✅ Session 127 |
| 3 — Compliance (9 endpoints + 2 job handlers) | ✅ Session 128 |
| 4 — MEDS (4 endpoints + 1 job handler + 2 helpers + 1 constant) | ✅ Session 128 |
| 5 — PPSI/PPII (13 endpoints + 1 platform import + 1 callback boundary) | ✅ Session 129 |
| 6 — Registry/Clinicians/Followups/Cards (15 endpoints + 2 imports + 1 job handler) | ✅ Session 130 core + Session 131 (5 missed endpoints) — see below |
| Post-6 round 1 — clinician helpers + Layer 3 test | ✅ Session 130 |
| Post-6 round 2 — createRegistryItem + scheduleFollowups + action handlers registry | ✅ Session 130 |
| Post-6 round 3 — 5 missed endpoints (physician-annotations + survey-note-reviews) | ✅ Session 131 (Category 1) |
| Post-6 round 4 — ML scoring pipeline + exports | ✅ Session 131 (Category 2) — arch (b): gatherMemberFeatures → ml_features.js (getMemberFeatures callback), both /v1/export endpoints → exports.js, dead ppiiStreamFetchers deleted, /v1/ml/retrain weight-shape bridged. Part-B = 0, suite green |

**Phase 6 endpoint extraction is now complete (Session 131,
Category 1)**: the five healthcare-named endpoints originally missed —
three `/v1/survey-note-reviews/...` and two `/v1/physician-
annotations/...` — now live in
`verticals/workforce_monitoring/server/notes.js`, and the two
platform-side references to the physician_annotation /
survey_note_review tables are bridged via verticalCallbacks
(getMemberNotes for the `/v1/export/:report` notes section,
recordSurveyNoteReview for the `/v1/member-surveys/:link/answers`
note-alert branch), each with a safe fallback. Their lowercase URLs
never tripped the case-sensitive lint regex — that is how they slipped
past the original "lint = 0 means clean" check — so this round was
gated on the explicit falsifier (0 endpoints, 0 table refs, lint 0,
suite 48/924 green), not lint alone. Category 2 was the final extraction
step and is now complete.

Success criteria (unchanged):
- Boot with WI_PHP disabled → Delta works end-to-end.
- Boot with WI_PHP enabled → Insight works end-to-end.
- `node tests/lint-anti-patterns.cjs` returns zero matches.
- Full test suite passes (Delta smoke tests + Insight + Core).

### 3. Flip the lint from report-only to fail-on-match ✅ DONE (Session 130)

Wired `tests/lint-anti-patterns.cjs` into `tests/run.cjs` as a
Pre-flight step that runs before Step 1 (Verify Server). The script
itself now exits 1 on any unsuppressed match (final `process.exit(0); //
report only` replaced with `process.exit(1)`; header banner updated).

### 4. Optional cleanup

The current cleanup work is documentation/trust work:
- keep the startup spine (`START_HERE.md`, `HANDOFF.md`, `STATE.md`,
  `WORKFLOWS.md`, `docs/BEFORE_YOU_WRITE.md`) aligned with live code
- continue curating archive duplication under `learnings/` and `20251215/`

---

## What's fragile right now

- **Heroku is dev/demo, not production.** No real users on it 24/7.
  That's why the deploy risk profile is "404 → fix → redeploy," not
  "user harm." Don't change that assumption without Bill's confirmation.
- **No Delta UI test coverage.** A Delta-surface change ships on
  manual verification only.
- **The Insight build notes**
  (`verticals/workforce_monitoring/tenants/wi_php/Insight_Build_Notes.md`)
  is Bill's narrative record across sessions. Append to it each session;
  don't rewrite history.
- **Migrations and Postgres sequences.** Member IDs from `member_id`
  sequence diverge between local and Heroku. Migrations that reference
  members must resolve by **name** (or membership_number), not by
  numeric ID.
- ~~**Pre-existing C12 flake.** The ML predictive risk test sometimes
  fails on "Valid risk label (got: Minimal)". Not session-blocking,
  but if you see it, that's the flake — not a regression caused by
  whatever you just did.~~ **Closed Session 130.** The test was
  rejecting `'Minimal'` even though the ML model legitimately emits
  it when training data is sparse. Fixed by accepting the label in
  `validLabels` rather than papering over with retries.

---

## Files that need careful handling

| File | Why |
|---|---|
| `pointers.js` | The platform server. Every edit needs `SERVER_VERSION` bump + `BUILD_NOTES` update + server restart. |
| `db_migrate.js` | All DB changes go here. Append-only — never edit a previously-applied migration. |
| `verticals/workforce_monitoring/tenants/wi_php/Insight_Build_Notes.md` | Bill's narrative record. Append; don't rewrite. |
| `docs/LOYALTY_PLATFORM_ESSENTIALS.md` | Bill's platform rules. Don't edit without his go. |
| `docs/LOYALTY_PLATFORM_MASTER.md` | Platform architecture doc. Same. |
| `docs/BEFORE_YOU_WRITE.md` | Anti-pattern reference. Update when you find a new pattern worth preserving. |

---

## Tenants — at a glance

| Tenant | Tenant ID | Vertical | Primary surfaces |
|---|---|---|---|
| delta | 1 | airline | `csr_member.html`, `bonus_test.html`, root admin pages |
| united | 2 | airline | Same as delta (shared surfaces) |
| marriott | 3 | hotel | Same root admin pages |
| ferrari | 4 | automotive | Same root admin pages |
| wi_php | 5 | workforce_monitoring | `verticals/workforce_monitoring/*` and tenants subdir |

Delta member used as a reference test member: **2153442807**.
Insight (wi_php) reference test member: see Insight Build Notes for
the engineered participants seeded by v49.
