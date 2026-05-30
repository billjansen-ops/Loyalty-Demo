# Landmine Audit

As of 2026-05-30, this is the current "fix sooner vs later" risk map for the platform.

This is not a rewrite memo. It is a ranked list of hotspots that are likely to cause
wrong behavior, false confidence, or expensive future cleanup if we ignore them.

## Critical

### 1. ML day-difference math bypasses platform date discipline

Files:
- `/Users/billjansen/Projects/Loyalty-Demo/verticals/workforce_monitoring/server/ml_features.js:134`
- `/Users/billjansen/Projects/Loyalty-Demo/verticals/workforce_monitoring/server/ml_features.js:147`
- `/Users/billjansen/Projects/Loyalty-Demo/verticals/workforce_monitoring/ml_report.js:120`
- `/Users/billjansen/Projects/Loyalty-Demo/verticals/workforce_monitoring/ml_report.js:132`

Current pattern:
- converts timestamps to JavaScript dates
- computes `Date.now() - lastDate.getTime()`
- divides by `86400000`
- floors the result to get "days since"

Why this is a landmine:
- it bypasses the platform's "day" handling discipline
- it is vulnerable to DST and boundary drift
- the same logical feature is implemented twice, once in the runtime path and once in the report path
- if either path drifts, ML scoring and exported analysis can disagree

What to do:
- replace the raw millisecond division with one shared helper or one shared "days since" rule
- keep the runtime and report code on the same implementation
- add a focused regression test around date-boundary behavior

## Should Fix Soon

### 2. Green tests do not prove some important paths

Files:
- `/Users/billjansen/Projects/Loyalty-Demo/tests/core/test_admin_pages.cjs:76`
- `/Users/billjansen/Projects/Loyalty-Demo/tests/core/test_admin_pages.cjs:98`
- `/Users/billjansen/Projects/Loyalty-Demo/tests/insight/test_ml_features_v03.cjs:115`

Current pattern:
- admin page edit-path checks are skipped if there are no bonus or promotion rows
- ML prediction coverage is skipped if the ML service is not running

Why this is a landmine:
- the suite can stay green while important paths are not exercised
- this creates exactly the kind of "proxy passed, reality unproven" risk that already caused trouble in the extraction work

What to do:
- seed or guarantee at least one bonus and promotion record for the admin edit tests
- decide whether the ML prediction test is required for local verification or explicitly optional
- make skipped coverage visible in the test summary or test output expectations

### 3. `pointers.js` is still a large, high-risk edit surface

Files:
- `/Users/billjansen/Projects/Loyalty-Demo/pointers.js:346`

Current state:
- `pointers.js` is still roughly 27k lines
- it contains an enormous `BUILD_NOTES` string with embedded historical narrative

Why this is a landmine:
- safe edits are harder than they should be
- searches return historical narrative mixed with live logic
- the file still acts as a choke point even after vertical extraction progress

What to do:
- continue extracting vertical-only and admin-only behavior out of `pointers.js`
- move long historical narrative out of the live server file when practical
- treat new additions to `pointers.js` as something to justify, not the default

### 4. Search pollution from old server copies increases wrong-pattern risk

Files:
- `/Users/billjansen/Projects/Loyalty-Demo/old_server_db_api.js:1`
- `/Users/billjansen/Projects/Loyalty-Demo/20251215/server_db_api.js:1`
- `/Users/billjansen/Projects/Loyalty-Demo/20251215/xserver_db_api.js:1`
- `/Users/billjansen/Projects/Loyalty-Demo/20251215/xxserver_db_api.js:1`
- `/Users/billjansen/Projects/Loyalty-Demo/20251215/xxxserver_db_api.js:1`

Current state:
- the repo still contains multiple giant legacy server files and dated snapshots

Why this is a landmine:
- grep/search results can easily surface obsolete patterns first
- future agents or engineers can copy old approaches by mistake
- archive clutter makes the codebase feel larger and less trustworthy than it really is

What to do:
- keep historical copies archived, but make them clearly non-live
- consider moving the loudest legacy server files deeper into archive storage
- prefer search patterns that exclude archive/snapshot areas when doing implementation work

## Can Wait, But Should Stay Visible

### 5. Untracked local research and scratch files add operational noise

Examples:
- `.claude/`
- `ml/__pycache__/`
- research PDFs and DOCX files under `verticals/workforce_monitoring/tenants/wi_php/`

Why this matters:
- not a platform correctness issue
- but it adds noise to `git status`
- that makes it easier to miss real worktree changes

What to do:
- decide what belongs in version control
- ignore or archive the rest deliberately

### 6. Historical duplication still exists even after the docs cleanup

Areas:
- `/Users/billjansen/Projects/Loyalty-Demo/learnings/`
- `/Users/billjansen/Projects/Loyalty-Demo/20251215/`

Why this matters:
- we already improved the structure a lot
- but there is still duplicate history and mirror content
- that is mostly a maintainability and search-noise problem, not a correctness emergency

What to do:
- keep one primary historical archive
- keep the dated snapshot clearly labeled as a snapshot
- trim duplicate material over time instead of maintaining two knowledge forests

## Recommended Order

1. Fix the ML day-difference math and add a regression test.
2. Strengthen the skipped-path tests so green means more than "best effort."
3. Keep shrinking `pointers.js` and avoid adding new vertical-specific logic there.
4. Continue taming archive/search pollution so implementation searches hit live code first.

## Not On This List

These did not currently rise to "fix sooner than later" based on this pass:
- a rewrite requirement
- an immediate database scaling emergency
- a sign that one more tenant or one more member will break the platform

This platform has real landmines, but they are fixable through disciplined cleanup and
verification, not a panic rewrite.
