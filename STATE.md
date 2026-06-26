# STATE — where things stand right now

Last updated: 2026-06-25 (Session 121).

**SHIPPED THIS SESSION (Session 121 — deployed to GitHub + Heroku release v89).**
Tenant-isolation hardening, end to end — Bill's question was "are we in a good
place tenant-wise?" A three-agent isolation audit (core data layer / Insight
leakage / auth + session binding) found real cross-tenant access holes; it did
**not** come back clean. This session closed them. Two commits:

- `dd5de91` — **KEYSTONE + IDORs + admin writes.** `POST /v1/auth/tenant` now
  requires role=superuser (was the master key: any authenticated user could
  POST `{tenant_id:N}` and rebind their own session to another tenant). The
  tenant-resolution middleware (~L1804) now only honors a client-supplied
  `tenant_id` for superusers, so **`req.tenantId` is authoritative** platform-
  wide. Raw-link IDORs scoped to `req.tenantId` (`activities/:link/full`,
  DELETE `activities/:link`, `member-surveys/:link` GET — PHI). Admin
  UPDATE/DELETE-by-global-PK given a `tenant_id` predicate (signal_type,
  external_result_action, notification_rule, scheduled_job, bonus/promotion
  criteria, licensing_board, stability_registry, registry_followup,
  survey_note_review). Survey-admin family + notification-delivery (was
  param-first) + scheduled-jobs list switched to `req.tenantId`. SQL injection
  in `exports.js` compliance report (interpolated `member_id`) parameterized.
- `88821b1` — **RESIDUAL SWEEP + AUTH GATES + loose ends.** ~55 more handlers
  that sourced tenant from `req.body`/`req.query` switched to `req.tenantId`
  (config CRUD, member-scoped writes, PHI reads/writes incl. MEDS + PPII/PPSI
  history + physician-annotation create, **member + alias search which leaked
  PII cross-tenant**, notifications, reference reads). Two no-tenant-check
  IDORs scoped (`molecules/:id/column-definitions`, `audit/user-report`).
  **AUTH GATES** (these were UNGATED — any authenticated user, even a CSR,
  could create a superuser / reset passwords / clone tenant config): all
  `/v1/users*` now admin/superuser-only via a prefix middleware, with
  non-superusers confined to their own tenant + blocked from granting
  superuser; `POST /v1/clone` superuser-only. Loose ends: session cookie
  `secure` true on Heroku (`!!process.env.DATABASE_URL`; trust proxy already
  on), false for local/CI http; registry audit-history join pinned to
  `sr.tenant_id` (defense-in-depth — rows already tenant-scoped via the
  per-tenant entity link).

`SERVER_VERSION` **2026.06.25.1557**; **no DB change** (stays v80). Verified
live on Heroku v89: dyno up, version endpoint 200 with the new version, and
`/v1/users` + `/v1/clone` + `/v1/auth/me` all 401 unauthenticated. Full suite
51/51 (955 assertions), lint 0. One test updated: C22 (`test_ppsi_history`)
asserted the old "missing tenant_id → 400" contract; the endpoint now derives
tenant from the session, so the test asserts the new contract instead.

**NOT DONE — deliberately deferred (discussed + agreed with Bill):**
- **RLS backstop (fix #1).** Make the database enforce tenant isolation as a
  net behind the code, so a future forgotten filter is a harmless empty result,
  not a leak. RLS is currently **decorative**: enabled only on `member`, not
  forced; the connection role is a superuser that bypasses RLS; the
  `app.tenant_id` GUC is never set anywhere. High value (box holds real PHI)
  but **HIGH-RISK**: the pooled-connection GUC trap can *create* a leak, the
  non-superuser DB-role change can break migrations, and it's prone to
  "works locally / breaks on Heroku." Needs its own design + tests + a fresh
  session. **Cheaper alternative to weigh first:** a build-time/test check that
  fails the suite when a tenant query lacks its filter — most of the protection
  at a fraction of the risk.
- **Lock-in regression tests.** The fixes are verified by code review + the
  full suite staying green (no regression), **not** by a live cross-tenant
  attack (no non-superuser creds were used). A few "tenant A can't reach
  tenant B" negative tests would prove + freeze the fixes.
- Two tiny audit items already handled this session (cookie `secure`, registry
  audit join). No other tenant items outstanding besides the two above.

**PRIOR — Session 120 (deployed to GitHub + Heroku release v88).**
A whole-codebase "reasonableness audit" (five parallel sweeps: dates, fetches,
DB-access rules, tenant leakage, save flows/silent catches) followed by fixes
for everything it found. Destructive saves, silent catches, molecule SQL, tier
joins, and link allocation all came back **clean**. What wasn't clean:
- **Licensing-board extraction** (commit `3a1dc7c`). The six
  `/v1/licensing-boards` + `/v1/members/:id/licensing-board` endpoints were
  still in `pointers.js` — missed by Phase 6 and the 130/131 sweeps because
  the lowercase URLs never tripped the case-sensitive lint and 'licensing'
  isn't in its healthcare-terms regex. Moved verbatim to
  `verticals/workforce_monitoring/server/licensing.js` (registered in the
  vertical's `index.js`; `encodeMolecule` added to `ctx.molecules`). Pure
  relocation — only vertical pages call them, no callback bridge.
- **Date-shortcut fixes + lint upgrade** (commit `c446d5b`).
  `.toISOString().slice(0,10)` — the UTC-shift twin of the banned
  `.split('T')[0]` form, invisible to the old lint regex — replaced everywhere:
  pointers.js (7 sites), csr_member.html, point-summary.html/.js,
  simulation-modal.js, Insight wellness/scoring_history/exports, bootstrap
  seeds, and **7 Insight test files** (after 6 PM Central they submitted
  tomorrow's activity date — latent flake). Lint Pattern 2 now catches both
  spellings; `uploads/` added to SKIP_DIRS.
- **Fetch hardening** (commit `c446d5b`). 17 load-path fetch sites missing
  `r.ok` checks got them; physician_detail's loadActivities called `.json()`
  before checking `.ok` — reordered.
- **survey-take-modal.js** default tenant 5 → null (platform-shared files
  carry no tenant defaults).
- **Debris**: 10 stale `.claude/worktrees` copies (228MB) + 27 `claude/*`
  branches (every one verified 0 commits ahead of main) deleted; the one
  stale branch on GitHub (`claude/exciting-leakey`) deleted too.
- `ml/model_info.json` trained_at refresh committed (`0524088`) — test-suite
  ML retrains rewrite the timestamp; model itself unchanged.

`SERVER_VERSION` **2026.06.11.1433**; **no DB change** (stays v80). Verified
live on Heroku v88: dyno up, version endpoint 200 with new version.

PRIOR (Session 119, Heroku v87): admin-UI polish on the template/composite
admin pages (reversed Flight/Activity labels fixed, Member/Activity composites
split into two aligned cards). HTML-only.
All three changes are admin-UI only (HTML); no `pointers.js` / `SERVER_VERSION`
/ DB change. `SERVER_VERSION` stays `2026.06.07.1706`, DB stays **v80**. These
were polish on the template/composite admin pages — no automated test coverage
(consistent with the "No Delta UI test coverage" fragility note below).
- **Display-template admin labels — fixed reversed Flight/Activity wording**
  (commit `f36034c`). The Activity Display Templates listing + edit pages
  sourced their type labels backwards relative to the server's own convention.
  The server (`pointers.js` ~5694–5873) labels a type-`A` activity from the
  `activity_type_label` sysparm ("Flight" for Delta, "Stay"/"Accrual" elsewhere)
  and uses the generic word "Activity" as the umbrella. Now: listing **header**
  stays generic ("Activity Display Templates"); the type-`A` **row** reads
  "Flight"; the edit page **header** reflects the template's own type (Edit
  Flight / Edit Redemption…); the edit dropdown's `A` option reads "Flight".
  Shared `labelForType(code)` helper on both pages — nothing tenant-specific
  hardcoded ("Flight" always comes from the sysparm). Files:
  `admin_activity_display_templates.html`, `admin_activity_display_template_edit.html`.
- **Composites admin — member/activity visually separated** (commit `40a4ead`),
  mirroring the Activity Input Templates page. Split the single composites table
  into two cards: **Activity Composites** (all non-`M` types) and **Member
  Composites** (`composite_type 'M'`). Added a `.type-M` badge color (was
  unstyled). Generalized the page title ("🧩 Composites" / subtitle "…each
  activity type and the member profile"). Shared `renderCompositeRow()` helper.
  File: `admin_composites.html`.
- **Composites admin — column alignment** (commit `46a0603`). The two cards'
  columns didn't line up because they're separate `<table>`s under
  `table-layout:auto` (each sized to its own content). Fixed with
  `table-layout:fixed` + an identical `<colgroup>` on both tables (the single
  source of column widths; per-`<th>` widths removed). File: `admin_composites.html`.

Verified live on Heroku v87: `admin_composites.html` serves "Member Composites"
+ `table-layout:fixed` + `<colgroup>`; `admin_activity_display_templates.html`
serves the `labelForType` helper + generic header. Dyno up; version endpoint 200
(`2026.06.07.1706`); DB up.

PRIOR (Session 118, Heroku v86, DB v80 — still the current code/DB baseline):
Member Composites (`composite_type 'M'`) made the authority for tenant-specific
member molecule fields (db **v79** seeds M for Delta {PASSPORT} + Insight
{LICENSING_BOARD}); member enroll/update validate against the M composite at
`PUT /v1/member/:id/molecules`; member-enrollment duplicate-PK bug fixed by
consolidating the `member` link_tank to one global row (db **v80**). Full detail
in git (`9cf67d8`) + the Insight Build Notes.

**NEXT WORK:** none queued — `ACTIVE_WORK.md` at placeholder.

Don't trust this summary blindly — verify live: `git log --oneline origin/main..main`,
the deploy table below, and the chat title for the session number.

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
| `origin/main` | `88821b1` — Session 121 fix #2 + auth gates + loose ends (CI green) |
| Local-only commits | None — in sync with origin (verify `git log --oneline origin/main..main`) |
| Last deployed app change | `88821b1` — Session 121 (Heroku release v89) |
| `SERVER_VERSION` (local + Heroku) | `2026.06.25.1557` |
| `EXPECTED_DB_VERSION` | `80` (must match db_migrate `TARGET_VERSION`) |
| Local DB version | `80` |
| Heroku DB version | `80` |
| Heroku `SERVER_VERSION` | `2026.06.25.1557` (release v89 — code matches `88821b1`, CI green before deploy; dyno up, version endpoint 200, `/v1/users`+`/v1/clone` 401 unauth) |
| Heroku app name | `hdwhf` |
| Heroku URL | https://hdwhf-6e6c604bb3f3.herokuapp.com |
| Heroku release | `v89` |

GitHub remote: `git@github.com:billjansen-ops/Loyalty-Demo.git`
Heroku remote: `https://git.heroku.com/hdwhf.git`

There is one branch: `main`. No feature branches, no worktrees.

---

## Test suite

- **51 tests total**, **all 51 passing** (unchanged through Session 120).
- **954 assertions**, all passing.
- Session 120 added no tests but **fixed date construction in 7 Insight test
  files** — they built activity dates via UTC (`toISOString().slice(0,10)`),
  so runs after 6 PM Central submitted tomorrow's date (latent flake source,
  now local-date via `toLocaleDateString('en-CA')`).
- Session 118 added 3: `delta/test_member_composite_m.cjs` (PASSPORT + enroll/
  update required-field validation + template-reject + scoping),
  `insight/test_member_composite_m.cjs` (LICENSING_BOARD path + cross-tenant
  reject + scoping), `delta/test_member_composite_ui.cjs` (browser: PASSPORT
  renders on csr_member.html).
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

**Eight patterns enforced (Session 120 added 6–8 — the DB-access rules
that used to live only in docs):**
1. DST millisecond date math · 2. `toISOString().split('T')` **or
`.slice(0,10)`** (both spellings) · 3. `new Date('YYYY-MM-DD')` ·
4. healthcare terms in root files · 5. `verticals/` path in root files ·
**6. direct SQL against molecule storage tables** (use the helpers) ·
**7. raw `JOIN/FROM member_tier`** (use `get_member_current_tier()`) ·
**8. raw `link_tank` / `MAX(link)+1`** (use `getNextLink()`).
Patterns 6–8 are server-JS only, exempt the test suite (fixtures read
raw rows), and carry per-rule allowlists (`MOLECULE_SQL_ALLOW` /
`TIER_SQL_ALLOW` / `LINK_ALLOC_ALLOW`) naming the sanctioned data-layer
files — the helper layer (`pointers.js`), migrations, vertical scoring
hooks, and one-time backfill/seed scripts. Adding a file to an allowlist
is the conscious, reviewed act that keeps a *new* raw-access site from
landing silently. Self-tested Session 120: 0 on clean code, fires on a
planted violation of each. Still necessary-not-sufficient — grep can't
see a cleverly disguised bypass, but it catches the obvious ones, which
are what have bitten the platform before.

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
