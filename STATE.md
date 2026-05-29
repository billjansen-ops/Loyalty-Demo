# STATE — where things stand right now

Last updated: end of Session 131 (2026-05-29). Category 1 of the
post-Phase-6 cleanup shipped: the five healthcare-named endpoints
Phase 6 missed (3 survey-note-reviews, 2 physician-annotations) are
now out of `pointers.js` and live in
`verticals/workforce_monitoring/server/notes.js`, with the two
remaining platform-side table references bridged via verticalCallbacks
(getMemberNotes, recordSurveyNoteReview). Phase 6's endpoint
extraction is now actually complete.

**Verified by the agreed falsifier, not by lint alone:** 0
annotation/note-review endpoints left in `pointers.js`; 0 references
to the physician_annotation / survey_note_review tables outside
BUILD_NOTES; lint 0 matches; full suite 48 tests / 924 assertions /
0 failures (server restarted on the new code first — first suite run
aborted because the restarted server came up DB-less without PGHOST
set; re-ran green once the PG env vars were passed).

**Category 2 — the ML scoring pipeline — is NOT started.**
gatherMemberFeatures / scoreMemberML and the PPII/PPSI feature
literals still live platform-side in `pointers.js`. That is the next
job; architecture (b) from `HANDOFF_FROM_130.md`'s Open Design
Question was chosen but no code written yet.

Lint count is 0 and the script is fail-on-match in the test runner.
The lint regex is case-sensitive — that is exactly what let the 5
endpoints slip (their lowercase URLs don't match). Don't treat
lint = 0 as proof of clean separation; the falsifier above is the
real gate.

---

## Deploy state

| Thing | Value |
|---|---|
| Last commit on `main` | `1493d68` (Session 130 retrospective — incorrect as committed; CORRECTION patches in subsequent commits) |
| `SERVER_VERSION` (local) | `2026.05.29.0845` (ahead of Heroku — not deployed) |
| `EXPECTED_DB_VERSION` | `78` |
| Local DB version | `78` |
| Heroku DB version | `78` |
| Heroku `SERVER_VERSION` | `2026.05.28.0245` (release v82 — code matches `02c35a0`; docs commits after that are doc-only) |
| Heroku app name | `hdwhf` |
| Heroku URL | https://hdwhf-6e6c604bb3f3.herokuapp.com |
| Heroku release | `v82` |

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

**Current count: 0 matches.** Phase 6 cleared the last 16 hits in
Session 130:
- 7 cleared by the endpoint/import moves (5 clinician endpoint bodies
  + the 2 protocolCards.js dynamic imports moved into the vertical).
- 4 cleared by inline string genericization in platform-shared code
  that stays in pointers.js (L21366 `/v1/ml/retrain` "No PPII weights
  configured" → "No scoring weights configured"; the two L26043/26045
  PPSI note-alert debug+error strings in `/v1/member-surveys/:link/
  answers` PUT → "Survey note alert"; L27157 `'Test Physician'` in
  `/v1/notification-rules/test` → `'Test Member'`).
- 5 cleared by `// lint-allow` comments with one-line explanations
  (3 CSV column labels in `/v1/export/:report` — `'Assigned Clinician'`
  ×2 and `'PPII'` ×1 — that are user-visible headers Erica reads;
  2 `survey_code = 'PPSI'` SQL literals in `gatherMemberFeatures` that
  are load-bearing on the ML model's feature shape).

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

### 2. Extract Insight server code from `pointers.js` — IN PROGRESS

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
| Post-6 round 4 — ML scoring pipeline | ❌ Session 131 Category 2 — chosen arch (b), NOT started |

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
suite 48/924 green), not lint alone. Category 2 (the ML scoring
pipeline) is the remaining job.

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

4 remaining survey-page healthcare-isms in `admin_survey_edit.html`
and `admin_surveys.html`. Small contained task — a good "first-day"
task for a new assistant to demonstrate it follows the patterns.

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
