# STATE — where things stand right now

Last updated: Session 128 (2026-05-27), after Phase 3 of the Insight
server extraction landed on origin/main.

---

## Deploy state

| Thing | Value |
|---|---|
| Last commit on `main` | `093d4c8` (memory-mirror docs, atop `0cffb12` Phase 3) |
| `SERVER_VERSION` (local) | `2026.05.27.1700` |
| `EXPECTED_DB_VERSION` | `78` |
| Local DB version | `78` |
| Heroku DB version | `78` |
| Heroku `SERVER_VERSION` | `2026.05.27.0200` (Session 126 — Heroku intentionally behind; deploy after Phase 6) |
| Heroku app name | `hdwhf` |
| Heroku URL | https://hdwhf-6e6c604bb3f3.herokuapp.com |
| Heroku release | `v78` (the dyno release counter, not our DB version) |

GitHub remote: `git@github.com:billjansen-ops/Loyalty-Demo.git`
Heroku remote: `https://git.heroku.com/hdwhf.git`

There is one branch: `main`. No feature branches, no worktrees.

---

## Test suite

- **46 tests total**, **all 46 passing** as of Session 128 push.
- **904 assertions**, all passing.
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

`node tests/lint-anti-patterns.cjs` — report-only grep-based detector.

**Current count: 28 matches.** (Baseline was 32 in Session 126; dropped
to 28 in Session 126 cleanup after staff/member label defaults moved
off "Clinician"/"Physician". Phase 3 of the Insight extraction did not
change the count — compliance code had no PPII/PPSI/Clinician strings
to lose. See `docs/INSIGHT_TOUCH_POINTS.md` §10 for the per-phase
expected delta — real drops come in Phases 4–6.)

- **25** healthcare-specific terms in `pointers.js` — PPSI scoring,
  PPII history, registry queries, clinician assignment, follow-up
  scheduling endpoints still living in the platform server (Phases
  4–6 targets).
- **3** platform-shared files importing from a specific vertical path
  (`./verticals/workforce_monitoring/...`) — `scorePPII.js`,
  `protocolCards.js` (twice).

All 28 are real architectural debt and become zero only when the
Insight-server-extraction refactor finishes Phase 6. Until then,
**28 is the baseline** — new matches mean a new anti-pattern was added.

The lint is not yet wired into CI. Flipping it from report-only to
fail-on-match is the final structural item, scheduled for end of
Phase 6.

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
| 2 — Molecule readiness contract + fail-closed auth | ✅ Session 127 |
| 2.1 — Scheduled-job framework gap fix | ✅ Session 127 |
| 3 — Compliance (9 endpoints + 2 job handlers) | ✅ Session 128 |
| 4 — MEDS (4 endpoints + 1 job handler) | next |
| 5 — PPSI/PPII (12 endpoints + 1 import) | |
| 6 — Registry/Clinicians/Followups/Cards (15 endpoints + 2 imports + 1 job handler) | |

Success criteria (unchanged):
- Boot with WI_PHP disabled → Delta works end-to-end.
- Boot with WI_PHP enabled → Insight works end-to-end.
- `node tests/lint-anti-patterns.cjs` returns zero matches.
- Full test suite passes (Delta smoke tests + Insight + Core).

### 3. Flip the lint from report-only to fail-on-match

After Phase 6 drops the count to zero, wire
`tests/lint-anti-patterns.cjs` into `tests/run.cjs` so any new
anti-pattern fails CI. This is part of the Phase 6 acceptance.

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
- **Pre-existing C12 flake.** The ML predictive risk test sometimes
  fails on "Valid risk label (got: Minimal)". Not session-blocking,
  but if you see it, that's the flake — not a regression caused by
  whatever you just did.

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
