# STATE — where things stand right now

Last updated: end of Session 126 (2026-05-26).

---

## Deploy state

| Thing | Value |
|---|---|
| Last commit on `main` | `f7db674` (Session 126 hotfix) |
| `SERVER_VERSION` | `2026.05.27.0200` |
| `EXPECTED_DB_VERSION` | `78` |
| Local DB version | `78` |
| Heroku DB version | `78` |
| Heroku app name | `hdwhf` |
| Heroku URL | https://hdwhf-6e6c604bb3f3.herokuapp.com |
| Heroku release | `v78` (the dyno release counter, not our DB version) |

GitHub remote: `git@github.com:billjansen-ops/Loyalty-Demo.git`
Heroku remote: `https://git.heroku.com/hdwhf.git`

There is one branch: `main`. No feature branches, no worktrees.

---

## Test suite

- **41 tests total**, **40 passing**, **1 pre-existing flake** (C12 ML
  Predictive Risk Scoring — intermittently fails on the "Valid risk label
  (got: Minimal)" assertion; not session-126 related, defer).
- 825 assertions total. The flake is one assertion out of 825.
- Run: `node tests/run.cjs` for the full suite, or
  `node tests/run.cjs <path/to/test.cjs>` for a single test.
- Manifest: `tests/manifest.json` lists every test.
- Coverage is **strong on Insight (wi_php) features** and **weak on
  Delta**. That's a known gap (see pending work below).

---

## Anti-pattern lint

`node tests/lint-anti-patterns.cjs` — report-only grep-based detector.

**Baseline: 32 matches.**

- **29** healthcare-specific terms in `pointers.js` — compliance, MEDS,
  PPSI scoring, PPII history, registry queries, clinician assignment,
  follow-up scheduling endpoints living in the platform server.
- **3** platform-shared files importing from a specific vertical path
  (`./verticals/workforce_monitoring/...`) — `scorePPII.js`,
  `protocolCards.js`.

All 32 are real architectural debt. They become zero only when the
Insight-server-extraction refactor lands (see Pending Work). Until then,
**32 is the baseline** — new matches mean a new anti-pattern was added.

The lint is not wired into CI. Flipping it from report-only to
fail-on-match is the third structural item below.

---

## Pending structural work

In order. Each step is mostly wasted without the next.

### 1. Add Delta-side smoke tests (do this first)

The suite has near-zero Delta UI coverage. Session 126 fixed 14 latent
bugs on Delta surfaces only because Bill manually clicked into them.
Without smoke tests, the planned refactor can't be safely verified.

Target: **5–8 tests** covering add-flight, add-adjustment,
add-redemption, edit-bonus, edit-promotion, load-member, save-profile.
Each test: drive the UI via the existing browser harness in `tests/`,
assert backend state matches.

### 2. Extract Insight server code from `pointers.js`

The ~28 healthcare endpoints (compliance, MEDS, PPSI scoring,
PPII history, registry queries, clinician-assignment,
follow-up-scheduling) should be registered from
`verticals/workforce_monitoring/` at server boot, **not hardcoded in
the platform server**.

The 32 lint violations all stem from this. The refactor's success
criteria are concrete (verifiable, not aesthetic):

- Boot with WI_PHP disabled → Delta works end-to-end.
- Boot with WI_PHP enabled → Insight works end-to-end.
- `grep -i "ppii\|ppsi\|meds\|physician\|clinician\|licensing" pointers.js`
  returns zero hits.
- Full test suite passes (including the new Delta smoke tests from
  step 1).

This is **multiple sessions of careful work**. Don't start it without
Bill's explicit direction.

### 3. Flip the lint from report-only to fail-on-match

After (1) and (2) drop the count to zero, wire
`tests/lint-anti-patterns.cjs` into `tests/run.cjs` so any new
anti-pattern fails CI.

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
