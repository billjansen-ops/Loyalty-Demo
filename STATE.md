# STATE — where things stand right now

Last updated: 2026-07-03 (Session 131).

**SESSION 131 — a waiting day (Erica/Tom quiet over the July 4th weekend) spent on
plumbing that does NOT widen the Erica gap, per Bill's direction. Three things landed,
all verified live: SERVER_VERSION 2026.07.03.2200, DB v97, suite 60/1182 green, lint 0.
Sessions 130+131 first-batch commits are ON GITHUB (CI green); the final commit
(`9a84528`, instrument plumbing) + this handoff await the next push. Heroku unchanged
and deliberately BEHIND (2026.07.02.2003 / DB v95) — the Erica bundle still waits for
her feedback and deploys v96+v97 together with an announcement email.**

- **Migration pacing always on (`83e96ea`):** the Session-130 per-version display no
  longer hides behind terminal detection (Bill updated older DBs and saw no pauses);
  CI opts out explicitly via `MIGRATE_NO_PAUSE=1` in ci.yml. Already-applied versions
  never paused and still don't — a current DB finishes in <0.1s.
- **Molecule Tier-1 hardening (`38e5f42`):** ONE creation routine,
  `createMoleculeComplete` (`POST /v1/molecules/complete`) — one transaction creates
  definition + lookup rows + values (explicit per-molecule value_ids) + the storage
  table if missing; validates every MOLECULES.md §5 invariant up front in plain
  English; **proves a real-path round-trip and removes the molecule if the proof
  fails**. Admin create page = one call (five-call sequence gone); migrations call the
  routine directly — CI's from-scratch replay guards routine evolution (agreed: no
  frozen/versioned per-migration SQL; revisit only for uncontrolled environments).
  `core/test_molecule_create.cjs` (35 asserts incl. browser walk). MOLECULES.md §6
  documents it; §1/§11 caught up (parent generalization is BUILT).
- **Instrument assignment plumbing (`9a84528`, db_migrate v97):** `member_instrument`
  — per-participant who-takes-what-when, mirroring member_compliance. No rows =
  today's owes-every-cadenced-survey (deploy-day safe); any rows = owes exactly the
  active assignments; fully paused = owes nothing; `one_time` = screening-at-intake
  (due once from start_date, satisfied forever by a completion on/after it — connects
  PHQ-9/GAD-7 to MEDS). MEDS resolves through `getExpectedInstruments()` at all four
  sites. Endpoints `GET/POST/PATCH/DELETE /v1/members/:id/instruments` (writes recalc
  MEDS next-due). `insight/test_instrument_assignment.cjs` (28 asserts).
  **NEXT SESSION: the assignment screen** on the participant chart + wellness.js/
  exports.js display surfaces adopt the helper (they still show the tenant-global set).
- Design decisions recorded in ACTIVE_WORK: default regime = today's behavior (Bill);
  who-may-assign deferred until role enforcement exists (nothing enforces per-position
  permissions anywhere yet); per-track assignment templates wait on Erica's protocol
  answers (plumbing now, valves later).

---

**SESSION 130 — the REFERRAL LOOP CLOSED (QR referral pre-fills the Performance Profile)
and the INSTRUMENT LIBRARY OPENED (Stage 2 part 1: PHQ-9 + GAD-7, catalog metadata, the
PHQ-9 self-harm alert chain). Both verified live end-to-end and browser-walked from login:
SERVER_VERSION 2026.07.03.1217, DB v96, suite 58/1119 green, lint 0. Both commits
LOCAL-ONLY (not pushed, not deployed) — Bill's decision: wait for Erica/Tom's review-queue
feedback, then bundle referral loop + their refinements + the instrument library into ONE
visible push with a strong announcement email.**

- **Referral-code consumer (`4a38932`, no DB change):** `/p/:code` now forwards carrying
  ONLY the opaque token (`?c=`) — the Session-124 placeholder that put referral details in
  the query string is gone. New public read-only `GET /v1/code-context/:token` returns the
  whitelisted context fields without consuming a use; the Performance Profile pre-selects
  the matching referral chip + shows the affiliation; any failure degrades to the blank
  form. `test_codes.cjs` 20→35 assertions incl. a browser walk.
- **Instrument library part 1 (`a5a71cf`, db_migrate v96):** PHQ-9 + GAD-7 (public domain)
  seeded as data + `scorePHQ9.js`/`scoreGAD7.js` on published bands. **Safety chain:**
  PHQ-9 item 9 (own PHQ9_SI category) positive → PHQ9_SI_POSITIVE signal → PHQ9_SI_ALERT
  bonus → RED registry item, 24h SLA. Catalog metadata `instrument_purpose`/`license_status`
  on survey + badges on admin_surveys.html (anchor licensing "To confirm" — Erica's call).
  Screening = cadence NULL = MEDS-exempt. New `test_instrument_library.cjs` (25 assertions).
  Migration runner now paces applied versions on a TTY ("Starting Version X" … hold …
  "complete" … hold; `MIGRATE_NO_PAUSE=1` escape).
- **Next Erica asks (send with her feedback exchange):** proprietary instrument picks +
  licensing (MCMI-IV…), anchor-battery license labels, GAD-7 alert thresholds.
- Full session detail: `ACTIVE_WORK.md` + Insight Build Notes.

---

**SESSION 129 — shore-up CLOSED (6 items), POSITION/POSITIONCLINIC PARITY (v92), and the
POSITION/CLINIC ASSIGNMENT SURFACE BUILT + PROVEN (the first user-parent molecule write —
byte-verified round-trip). Erica's Stage-1 routing answer recorded. All verified live:
SERVER_VERSION 2026.07.02.0826, DB v92, suite 56/1038 green, lint 0. Everything LOCAL-ONLY
(not pushed, not deployed). Deploy decision: hold the Erica deploy until the review queue
ships (classification+segmentation alone aren't tangible enough for her).**

- **Assignment surface (later in Session 129):** generic endpoints
  `GET/POST/DELETE /v1/users/:id/molecule-rows/:key` (admin gate, own-tenant, parent_bytes=4
  guard, dup 409) + a data-driven assignments section on `admin_user_edit.html` (position
  dropdown from the shared list; clinic via partner-first→program, Erica's known flow;
  borrowed-list owners excluded). Round-trip proven at byte level on the recreated pair;
  browser-verified end to end before Bill saw it. New test
  `insight/test_user_positions.cjs` (20 assertions). Detail in ACTIVE_WORK.md.

- **v92 — POSITION/POSITIONCLINIC parity (the Session 128 plan, executed on Bill's go).**
  Deleted the UI-created pair (145/147) + dropped `4_data_1`/`4_data_12`, recreated ALL of it
  in the one migration: definitions (new ids 149/150, parent_bytes 4), column defs
  (POSITIONCLINIC col 1 **borrows POSITION's list** via `list_source_molecule_id`), the 3
  POSITION values (explicit value_id 1–3), both storage tables + indexes. Resolved by
  **molecule_key** — this migration is how the pair reaches Heroku at deploy. **Round-trip
  re-proven on the recreated pair:** encode MEDDIR→2, decode 2→MEDDIR, POSITIONCLINIC values
  resolve through the borrow pointer. Tables empty (nothing writes user-parent rows yet).
  **Shape decision (Bill):** stay position+clinic (12); real use decides if the health-system
  level (122) is needed — shape can still change locally before deploy.

- Items 1–5 (code): molecule DELETE cleans its `{n}_data_*` storage rows (proven with a
  planted row); create-flow step-2 failure surfaces instead of a false success; GET
  /v1/molecules/:id + all five groups endpoints tenant-gated (`moleculeGroupTenantGate`,
  proven blocked cross-tenant both directions); Test modal errors on missing session tenant
  (no more silent tenant-1); locked column defs labeled by-design on the edit page.
- Item 6 (migration, Bill's go): **db_migrate v91** deletes orphan molecule definitions
  ML_RISK_LEVEL + ML_CONFIDENCE (wi_php, by molecule_key — they exist on Heroku from v49,
  so the migration cleans both environments). The S128 audit note's "seeded display-template
  line referencing them" was STALE — no such line exists.
- **Erica's Stage-1 routing answer (2026-07-01):** registration reviews are
  **Case-Manager-first, escalate to Medical Director** — default + configurable. Recorded in
  ACTIVE_WORK; unblocks review-queue routing once positions land.
- **Correction to the Session 128 notes:** Sessions 127+128 commits ARE on `origin/main`
  (pushed after session end; verified `git log origin/main..main` empty at 129 start).

---

**SESSION 128 — molecules-on-users foundation BUILT (steps 1–3 + shared lists), first two
4-byte-parent molecules created via the UI, and a hard day of molecule-admin-page repairs.
ALL LOCAL-ONLY — nothing pushed to GitHub or Heroku. Every claim below verified live at
session end: SERVER_VERSION 2026.07.01.2251, DB v90, suite 55/1018 green, lint 0.**

- **v88 — user link widened 2→4 byte.** Exactly 6 columns smallint→integer
  (`platform_user.link` + `audit_log_1..5.user_link`); link tank untouched (allocator just
  increments — verified); no FKs on `link`. Audit who-did-what join re-verified after.
- **v89 — the molecule engine routes by parent key size.** `molecule_def.parent_bytes`
  (1–5, DEFAULT 5) + `getDetailTableName(parentBytes, storageSize)` → `{n}_data_*`. All 92
  pre-existing molecules default to 5 — byte-for-byte unchanged. p_link type follows parent
  bytes (odd→CHAR, even→numeric), stored raw; only value columns encode.
- **v90 — shared internal lists.** `molecule_value_lookup.list_source_molecule_id`: a list
  column can borrow another molecule's value list (one list, no double entry, can't drift).
  `resolveListSourceId()` applied at the chokepoints (encodeMolecule / decodeMolecule /
  GET values); value ADD/EDIT/DELETE **rejected** on a borrower (no shadow copies). Admin
  column type "Internal List — use another molecule's list" + source picker; borrowed values
  render read-only. **Round-trip PROVEN** via throwaway borrower (values read from source;
  encode MEDDIR→2; decode 2→MEDDIR; shadow-write rejected; cleaned up).
- **Two-box fix (rules criteria).** `/v1/molecules/by-source/:source` now decides the side
  from `attaches_to` (was single-valued `context`, so both-ticked molecules never showed on
  the member side). Delta's BT + SEAT_TYPE now appear on BOTH sides; system/tenant molecules
  still excluded. Checkbox label reworded: **"Used in Rules Criteria for:"** (Activity /
  Member, independent; both-off = not a rule field).
- **Molecule admin pages repaired (every page Bill touched today was broken):**
  (1) UI-created molecules never got `value_kind` on the header → reopen couldn't show List
  Values and the values endpoints rejected them ("not a list molecule") — column-def save now
  syncs col-1 kind to the header, and GET falls back to col-1; (2) `saveInternalListValues`
  existed but was NEVER CALLED — "+ Add Value" silently dropped everything — now wired into
  save; (3) the list page hid any molecule with empty attaches_to (non-rule molecules looked
  deleted) — non-rule molecules always show now; (4) legacy molecules (blank `column_type`)
  rendered TYPE "–" with no lookup-config gear — display now derives from value_kind etc.;
  (5) checkboxes load from `attaches_to` only (no more phantom Member tick); context saves
  as `'none'` when neither box ticked; (6) parent-size picker (1–5) on the edit page drives
  `{n}_data_*` + create-table; (7) list page: SIZE/PARENT/DETAILS collapsed into one
  **STORAGE** column (`4_data_12` style).
- **Created via the UI on wi_php (Bill driving):** **POSITION** (mol 145, internal list on
  the 4-byte parent, `4_data_1`, values Case Manager / Medical Director / Clinician —
  saved + verified in DB) and **POSITIONCLINIC** (mol 147, `4_data_12` created: col 1
  borrows POSITION's list, col 2 → `partner_program` ref). **POSITIONCLINIC is NOT
  round-trip-proven** — nothing writes user-parent molecule rows yet (the assignment
  surface is the next build) and **Bill's 12-vs-122 concern is open** (see ACTIVE_WORK) —
  no real data into `4_data_12` until settled.
- **Molecule-admin audit run (agent, findings verified where stated):** real items on the
  shore-up list in ACTIVE_WORK — DELETE molecule orphans storage-table rows (verified in
  code); create-flow step-2 failure swallowed (console.warn + success alert); GET
  /v1/molecules/:id + groups endpoints missing tenant check; Test modal tenant-1 fallback;
  "columns locked on existing molecules" is by design but unlabeled; plus two orphan
  definitions **ML_RISK_LEVEL / ML_CONFIDENCE** (no columns, no data, no code references —
  abandoned design; one seeded display-template line still points at them).
- **Deploy math changed:** Heroku deploy now carries Sessions 126+127+128 —
  `git push heroku main` then `heroku run --app hdwhf "node db_migrate.js"` applies
  **v85→v90**, restart, verify. On Bill's go only.

**SESSION 127 — WisconsinPATH Stage 1 dashboard segmentation by referral source (SHIPPED to
`origin/main`? NO — local commit `4c829d2` only; verify `git log origin/main..main`). CI-clean,
DELIBERATELY NOT on Heroku (rides the post-demo deploy with Session 126).**

- **Dashboard segmentation by referral source (local `4c829d2`).** `GET /v1/wellness/members` now
  attaches each member's `REFERRAL_SOURCE` as `{code,label}` (two-layer molecule read
  `getMoleculeRows` → `decodeMolecule`, wrapped so a bad value can't break the list; `decodeMolecule`
  exposed on `ctx.molecules`). `dashboard.html` has a new **"By Referral Source"** tab in Program View
  (mirrors "By Licensing Board") + search. `SERVER_VERSION` **2026.06.30.2246**. **No DB change** —
  reads the Session-126 molecule (DB stays v87). Verified: live round-trip, tab renders on real data,
  lint 0, `test_referral_source` 9/9.
- **Molecule admin — dropped the "attaches to at least one" requirement (local `e13a4c4`, front-end
  only).** `admin_molecule_edit.html`: removed the validation gate + the required `*` + the "select
  at least one" help text on the Attaches To field. First tiny step toward molecules on other parents.
- **NOTE: `4c829d2`/`e13a4c4` + the design-doc commits are LOCAL-ONLY** — nothing pushed to
  `origin/main` (push on Bill's go). Local is ahead of both origin and Heroku.
- **Design DONE + APPROVED — molecules-on-users (the review-queue foundation). Build NOT started.**
  Source of truth: **`docs/MOLECULE_PARENT_GENERALIZATION.md`** (+ `MOLECULES.md` §11/§1). Direction:
  "a person is a person"; domain roles = `(role, clinic)` molecules **on the user** (`4_data_*`,
  `p_link integer`); login stays a separate keycard; tenant + access-tier stay explicit fields (not
  molecules); rules-engine participation becomes an explicit molecule flag. **NEXT STEP:** the data
  migration — widen the user `link` 2→4 byte via `db_migrate.js`, exactly 6 columns smallint→integer
  (`platform_user.link` + `audit_log_1..5.user_link`), **link tank untouched**, no FKs on `link`.
  Schema change touching audit — **get Bill's go before applying.** Full plan + the remaining moves
  in the design doc / `ACTIVE_WORK.md`.
- **Verified current-state fact (corrects an earlier in-session claim):** a login (`platform_user`)
  is **NOT attached to a member** today — its `link` is the login's own id, not a member pointer;
  the session carries only `userId`/`tenantId`/`role`; and `role` is CHECK-constrained to
  `superuser`/`admin`/`csr`, so clinical titles can't live on a login. Logins and members are
  disconnected (one fragile display_name bridge in notification routing). See `ACTIVE_WORK.md`.

---

**SESSION 126 — WisconsinPATH Stage 1 `REFERRAL_SOURCE` molecule + the real internal-list
bug + molecule-doc overhaul. All on `origin/main`, CI-gated, DELIBERATELY NOT on Heroku
(Dr. Stadler demo is 2026-07-01 — deploy after).**

- **`REFERRAL_SOURCE` member molecule (db_migrate v85+v86)** — the first real piece of
  WisconsinPATH Stage 1: how a participant entered the program (Self-referral / Employer /
  Board-mandated), an internal-list on the member (`attaches_to='M'`). Drives dashboard
  segmentation, safe-haven status, board-reporting eligibility. Registration lifts
  `referral_type` from the referral `code` row's JSONB into this molecule (JSONB carries;
  molecule queries + drives behavior). v85 = molecule_def + the mandatory
  `molecule_value_lookup` row + 3 values + member composite-M; v86 = added to the M input
  template so it shows/edits on the participant profile. Round-trip verified by
  `tests/insight/test_referral_source.cjs` (9/9).
- **The real molecule bug, fixed at the root (db_migrate v87 + pointers.js).** Internal-list
  values store a PER-MOLECULE 1-127 code (the `value_id`) squished into a 1-byte cell, but
  `molecule_value_text.value_id` DEFAULTS to a GLOBAL sequence (now past 127). Any list
  seeded via a raw INSERT (bypassing the first-available allocator) got value_ids >127 that
  silently overflow the byte on save → reads come back empty. Fix: (1) shared
  `allocateListValueId()` — the one place list codes get numbered; `POST /v1/molecules/:id/values`
  routes through it; (2) clone path preserves `value_id`; (3) static-text path pins it;
  (4) v87 renumbers the 3 lists that had already overflowed — `REFERRAL_SOURCE`,
  `EXTENDED_CARD`, `STATE`(t5), all ZERO stored rows so nothing re-mapped — to per-molecule
  1..N, then adds `CHECK (value_id BETWEEN 1 AND 127)` so a bad insert fails loudly.
  Full suite 55/1018 green, lint 0.
- **Molecule documentation made bulletproof + consolidated.** New **`docs/MOLECULES.md`** is
  the single source of truth (mechanism, per-type recipes, silent-failure invariants,
  helpers + never-raw-SQL, verified exemplars — FARE_CLASS/ACCRUAL_TYPE/REFERRAL_SOURCE/
  LICENSING_BOARD/PASSPORT; STATE is NOT an exemplar — and the MANDATORY round-trip
  verification). `master §2` and `essentials §2` gutted to a framing paragraph + pointer
  (no duplicated mechanism to drift). Reachable from the spine: `START_HERE`,
  `BEFORE_YOU_WRITE`, essentials §2, master §2, and the loyalty-platform skill all route to it.
- **Why the deep-dive:** `REFERRAL_SOURCE` failed its round-trip; tracing it to ground
  surfaced the value_id-overflow bug and the fact the docs were descriptive-not-operative.
  The doc overhaul is the durable fix so no future session repeats it.
- **Local is now AHEAD of Heroku and not deployed:** local SERVER_VERSION 2026.06.30.2101,
  DB v87; Heroku still v98 / DB v84 / SERVER 2026.06.29.1120. Deploy (push heroku + `node
  db_migrate.js` to apply v85→v87 + restart) is a post-demo step, on Bill's go.

---

**SESSION 125 (afternoon) — Refer-participant workflow + WisconsinPATH master plan.**
- **Refer-participant feature (`bb200a8`, deployed Heroku v98, DB v84) — LIVE, Bill
  click-tested "looks good."** The first real consumer of the Session-124 `code`
  table. A "👥 Refer participant" button on the program dashboard (Program Overview
  header) + the clinic roster (action row) opens a panel (referral type:
  self/employer/board-mandated · affiliation · optional track · single-use toggle),
  mints a referral code via `POST /v1/codes` (tenant from session), and returns a
  shareable **link + QR** pointing at the Performance Profile front door — the live
  front door of **WisconsinPATH Stage 1**. Shared module
  `verticals/workforce_monitoring/refer_participant.js` (one place, both surfaces);
  reuses the `admin_codes.html` mint+QR pattern + vendored `/qrcode.min.js`. Context
  rides server-side in the code table, never in the QR. **Front-end only — no
  `pointers.js`, no `SERVER_VERSION`, no DB change.** Separate from the demo pages
  (zero risk to the 2026-07-01 demo; demo pages re-verified 200 after deploy).
  - **Still TODO (post-demo):** the *consumer* half — the Performance Profile reading
    the code to pre-fill — was deliberately deferred (it edits the live demo page).
    "Add observer" also deferred (needs the Stage-5 observer flow that doesn't exist).
- **WisconsinPATH master build plan (`docs/WISCONSINPATH_BUILD_PLAN.md`).** Jim's
  anticipated Wisconsin-program workflow → Erica's build requirements
  (`PI2_WisconsinPATH_Build_Requirements.docx`, her working doc) → one master roadmap
  + code-grounded gap analysis (an Explore-agent capability scan). **Key finding: the
  spec is solid but three items Erica marked "Configure"/exists do NOT exist —
  consent/release-of-information architecture (the 42 CFR Part 2 work, gated on her
  Q6), toxicology/lab orders, and OER activation (roadmap only).** Reusable across
  state PHP programs (Erica expects Washington crossover). Consolidated to ONE doc:
  the old `PERFORMANCE_PROFILE_OER_PLAN.md` is now a tombstone redirect;
  `ACTIVE_WORK.md` + `project_erica_tracking` memory point at the master.
- **Two emails drafted, both pending Bill to send:** the welcome/overview "live now"
  note, and the reply acknowledging Erica's WisconsinPATH spec.

---

**SESSION 125 (morning) — Erica overview/welcome updates + demo readiness fix (deployed,
Heroku v97, DB v84).** Front-end-only changes (HTML; no `pointers.js`, no
`SERVER_VERSION` bump), all on `origin/main` (`6ec3004`), CI-green, **live on
demo.primada.io**:
- **Demo readiness pass (`6ec3004`)** before the 2026-07-01 Dr. Stadler Zoom:
  drove the live Performance Profile end-to-end in a browser. Found + fixed a
  pre-existing crash — `showStep()` called `el("actions").scrollIntoView` but no
  `actions` element exists, so it threw a TypeError on **every** step transition,
  skipping `window.scrollTo(0,0)` + `updateNext()` (no scroll-to-top between the
  long PPSI/Foundations sections; Next-button counter not initialized on arrival).
  From the Session 122 build. Fix: drop the dead/broken line. Verified live: full
  run-through (welcome→intro→PPSI→Foundations→results) throws **0** errors and
  scores (PPSI 51/100). Overview + QR pages also checked clean.

The three Erica changes (`9962c8c`):
- Performance Profile **welcome** rewritten to Erica's wording (adds "…professional
  development" + a new "professional strength" paragraph; crisis box kept).
- Overview walkthrough: **OER section removed** + remaining OER mentions scrubbed,
  renumbered to a clean 5 sections (Mike/Jim are focused on PI² + screening for the
  funding approval; OER held for the Chris/Jim talk).
- Overview: new **"What PI² is"** band (Predictive Performance Intelligence
  Infrastructure) after the hero, from `PI2_Performance_Profile.docx`.
- Email to Erica drafted (welcome + overview updates) — confirm with Bill / send.

**⚠️ Side effect of this deploy — the Session 124 code table is now ALSO on Heroku.**
`git push heroku main` deploys *all* unpushed commits, so it carried `81c50f8` (the
code table, EXPECTED_DB_VERSION 84) along with the HTML. Heroku DB was at 83 → the
dyno crashed on the version mismatch at boot. Fixed with the documented step:
`heroku run "node db_migrate.js"` (applied v84 — `code` table created, Heroku-safe),
restart, verified site back up. **Heroku now release v96, DB v84, SERVER_VERSION
2026.06.29.1120.** The code table has no Erica-facing consumer yet — it just sits
there now, live but unused (its real consumer is still the "next work" below).
Lesson for next time: to ship ONLY the current commit, the prior GitHub-only commit
will ride along — expect it and plan the migration.

---

**SESSION 124 — general-purpose code table (now deployed in Session 125; see above).** The session's
last piece: a reusable code/voucher mechanism — the "real QR" pattern behind
referral/access codes. On `origin/main`, **CI-green, deliberately NOT on Heroku**
(no Erica-facing change yet; it's foundation with no live consumer):
- `81c50f8` — **`code` table (db_migrate v84)** — the platform's **first Tier-4
  (4-byte INTEGER link) entity**. First link `-2147483648` via `getNextLink('code')`.
  Public token is a 16-byte base58 random string (`gen_code.js` `generateCode` off
  `crypto.randomBytes`), kept SEPARATE from the link so the enumerable PK is never
  exposed. Columns: link PK, code token (unique), code_type, tenant_id, Bill-epoch
  start/end dates, max_uses/used_count, status, and a **JSONB `context`** for
  carry-only named-value pairs (JSONB not molecules — see `feedback_molecules_vs_jsonb`).
  Engine: `mintCode`/`resolveCode`/`consumeCode` (atomic used_count guard).
  Endpoints `POST/GET/PATCH /v1/codes` (tenant-scoped) + public `GET /p/:code`
  (resolve→validate→consume→302 to target w/ context as query params; generic 404
  otherwise). `admin_codes.html` = **internal maintenance tool** (mint/list/revoke +
  QR), on the main admin hub — NOT an Erica page; her real minting will be workflow
  buttons in the Insight surfaces later. Moved `qrcode.min.js` to project root (shared
  asset; a root page can't reference a `verticals/` path). `SERVER_VERSION`
  **2026.06.29.1120**, `EXPECTED_DB_VERSION` 83→**84**. Test `tests/core/test_codes.cjs`.
- **OER answers emailed to Erica/Tom** (the 8-question reply). Erica's remaining big
  asks (self-registration, participant portal, PHP linkage, observer accounts) are
  unbuilt and largely gated on **her privacy model — Q6, back on her + Chris + legal**.

**EARLIER SESSION 124 — Platform Overview walkthrough + unfroze Heroku deploys.**
Both on `origin/main`, CI-green, and **deployed to Heroku (release v95, DB v83)**:
- `226fde1` — **Platform Overview walkthrough** (`verticals/workforce_monitoring/overview.html`),
  the Dr. Stadler 2026-07-01 fallback/companion. Static public page at clean route
  `GET /overview` (mirrors `/performance-profile`); walks Insight → two instruments →
  OER monitoring → engine → roadmap, with a button to launch the live
  `/performance-profile` demo. Listed in the dashboard "New — Try It" section.
  DEMO-CONTAINED (no login, no PHI). `SERVER_VERSION` **2026.06.28.1754**. Also folded
  in the Erica/Tom answer: Tom thumbs-upped Foundations scoring → now final.
- `e940a2a` — **hotfix: collapsed RLS migrations v81/v82 to no-ops.** Deploying 124
  first surfaced a Session 123 landmine: code expects DB v83 but Heroku was still v80
  (S123 never deployed), and the catch-up migration **failed on Heroku at v81**
  (`must be a member of rds_password to alter passwords` — RDS forbids creating a
  login role with a password). Since v81→v82→v83 nets to zero, v81/v82 are now no-ops
  and v83 (already Heroku-safe, idempotent) is kept. Every environment now converges
  RLS-free at v83. **This permanently unfreezes Heroku deploys.** RLS design still
  preserved in `docs/RLS_BACKSTOP_DESIGN.md` + git (`b27ca88`).
- Incident note: the dyno crashed mid-deploy and was rolled back to v92 to keep the
  site up; after the hotfix it was redeployed (v95) + migrated to v83 + verified live
  on demo.primada.io (`/overview` 200, `/performance-profile` 200, version 2026.06.28.1754).
- **Heroku now matches local:** release v95, DB v83, `SERVER_VERSION` 2026.06.28.1754.

**NEXT WORK: still Erica's stuff.** Email to Erica/Tom (OER answers + the new overview
page) is drafted/pending — Bill said we'd handle it once the deploy was fixed (it is).
Then the referral-code→context table (the real-QR mechanism). See `ACTIVE_WORK.md`.

---

## PRIOR — Session 123

Last updated: 2026-06-28 (Session 123).

**SESSION 123 — built a database tenant-lock (RLS), then REMOVED it the same
session. Net effect on the platform: nothing changed except docs/tests. The
platform is back to its fast, pre-session state.** Two commits, both on
`origin/main`, both CI-green:
- `b27ca88` — built the RLS backstop (app_rls role + tenant_isolation policies on
  56 tables via db_migrate v81/v82; per-request connection pinning + `SET ROLE`
  enforcement in `pointers.js`, gated by `RLS_ENFORCE`).
- `06167e8` — **REMOVED it.** `pointers.js` restored byte-for-byte to its pre-RLS
  state; db_migrate **v83** drops the policies + `app_rls` role and restores
  member's original decorative RLS. Reverted because enforcement cost real write
  performance (accruals **1,056/s baseline → ~100/s enforced**; pinning pulled
  `getNextLink`'s counter UPDATE into the request transaction, serializing writes
  on one shared row) to guard a failure mode the platform already covers
  (code-level isolation + the Session 122 cross-tenant tests). Bill's call: not
  worth it for a demo with no live PHI.
- **Kept (zero cost):** the Session 121 hardening, the Session 122 cross-tenant
  regression tests, and `docs/RLS_BACKSTOP_DESIGN.md` as the record if real PHI
  ever lands. **Do NOT resume RLS** — see `ACTIVE_WORK.md`.
- **Heroku was never touched this session** — no RLS code ever deployed there, so
  zero production exposure throughout. (Heroku later advanced in Session 124 — now
  release v95, DB v83, SERVER_VERSION 2026.06.28.1754.) ⚠️ SUPERSEDED: this session's
  note said a future Heroku migration would "create then drop the RLS objects" — that
  was **wrong for Heroku** (v81 creates a login role with a password, which RDS
  forbids). Session 124 collapsed v81/v82 to no-ops to fix it.
- `SERVER_VERSION` **2026.06.28.1550**; **local DB at v83**; full suite
  **53/988 green** on the restored platform; lint 0.

**NEXT WORK: Erica's stuff** (her 8 OER questions; the Performance Profile / OER
build per `docs/PERFORMANCE_PROFILE_OER_PLAN.md`). Not RLS, not RBAC. See
`ACTIVE_WORK.md`.

---

## PRIOR — Session 122 (the baseline the platform is restored to)

Last updated: 2026-06-26 (Session 122).

**SHIPPED THIS SESSION (Session 122 — tests + docs only, NOT deployed, no
server/DB change).** The lock-in piece of the tenant-isolation backstop: real
cross-tenant regression tests that verify the Session 121 fixes by *attack*
(not just code review), plus the written plan for the database-level RLS net.

- **Cross-tenant lock-in tests** (2 new files, 33 assertions, all green):
  - `tests/insight/test_cross_tenant_isolation.cjs` — a tenant-1 (Delta) user is
    blocked from every tenant-5 (Insight) PHI/PII surface Session 121 scoped
    (member profile, survey answers by link, stability registry, MEDS, PPII
    history, member search, physician-annotation **write**); plus reverse
    direction (a throwaway tenant-5 csr, created at runtime + wiped by the
    snapshot restore, blocked from tenant-1). **Two-sided:** each attacker-404 is
    paired with an oracle call proving the resource is really there, so a pass
    means "blocked," not "absent"; a legit-control phase proves own-tenant access
    still works.
  - `tests/core/test_tenant_auth_gates.cjs` — keystone privilege gates:
    `POST /v1/auth/tenant` superuser-only (csr **and** admin blocked),
    `/v1/users*` admin-only with own-tenant confinement + forged-`tenant_id`
    ignored, `/v1/clone` superuser-only, + a superuser positive control.
- **RLS backstop design** — `docs/RLS_BACKSTOP_DESIGN.md`: verified the current
  DB lock is decorative (RLS only on `member`, not FORCEd, `app.tenant_id` GUC
  never set, app connects as a bypass superuser), the three footguns, and a
  staged reversible rollout + both-direction test gate. **Design only — no DB or
  code change.**
- **The "lighter lint" was deliberately dropped** — a grep for "tenant query
  missing `tenant_id`" can't distinguish safe from leaky here (globally-unique
  link IDs, helper-built SQL, ~885 query sites); it would be a meaningless green
  check. The regression tests are the reliable version of that gate.

`SERVER_VERSION` **unchanged 2026.06.25.1557**; **no DB change** (stays v80) for
the tenant-isolation work. Full suite **53 tests / 987 assertions / 0 fail**; lint 0.

**ALSO SHIPPED + DEPLOYED THIS SESSION (Session 122 — Heroku release v90,
front-end only).** Performance Profile QR demo for the Dr. Stadler meeting
(2026-07-01), the slice Tom scoped. A no-login, QR-reachable assessment
(PPSI + Foundations of Health) that scores on the device:
- `verticals/workforce_monitoring/performance_profile.html` — the assessment +
  scored result (stability tier, dominant lifestyle driver, matched resources).
- `verticals/workforce_monitoring/performance_profile_qr.html` — QR companion;
  target URL **derived from `window.location.origin`** (override `?base=`), never
  hardcoded — a per-environment value belongs to the environment, not sysparm.
- `verticals/workforce_monitoring/qrcode.min.js` — vendored QR generator (MIT).
DEMO-CONTAINED: in-page scoring, **nothing persisted, no account, no wi_php data
touched**. PPSI now scores the **live weighted way** (Option A, real wi_php
weights, `ppii_thresholds` bands → 0-100) per Erica's 2026-06-27 confirmation
("score like we have it built"); Foundations tiers as written (Erica approved).
The bigger build (self-registration, portal, observer/OER, PHP
linkage) sits behind Phase 0 foundation (RBAC + RLS).

**Then made it discoverable (release v91, `SERVER_VERSION` 2026.06.27.2010 —
`pointers.js` edited, no DB change).** The first cut was an orphan page nothing
linked to — which broke Erica's "log into the site and test it" pattern. Fixed
with clean public routes `/performance-profile` + `/performance-profile/qr` and a
data-driven **"New — Try It"** section on the Insight dashboard (`dashboard.html`)
— each item shows name, description, the clean URL, and Open + Copy-link, with the
URL built from `window.location.origin` (so on demo.primada.io it reads
`demo.primada.io/performance-profile`). Future features add one row to
`TRY_IT_ITEMS`. Verified live on demo.primada.io (v91): version 200, both clean
routes 200 no-login. So **Erica tests the normal way**: log in → dashboard →
New — Try It → Performance Profile. Plan/status:
`docs/PERFORMANCE_PROFILE_OER_PLAN.md`.

The one open tenant-isolation follow-up is executing RLS itself (its own
session — see `ACTIVE_WORK.md` + the design doc).

**PRIOR — Session 121 (deployed to GitHub + Heroku release v89).**
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
| `origin/main` | `38e5f42` — Sessions 130 + 131 (through molecule hardening) pushed 2026-07-03, **CI green**. |
| Local-only commits | `9a84528` (instrument plumbing, v97) + the Session 131 handoff commit (verify `git log --oneline origin/main..main`) |
| Last deployed app change (Heroku) | `ae4f4c1` — **Sessions 126–129 DEPLOYED 2026-07-02** (the full WisconsinPATH Stage-1 story). Verified live: version endpoint, public pages 200, DB v95, queue config present. |
| `SERVER_VERSION` (local) | `2026.07.03.2200` (Session 131 — instrument assignment plumbing) |
| `SERVER_VERSION` (Heroku) | `2026.07.02.2003` (**Heroku is BEHIND local** — Sessions 130–131 not deployed; the Erica-bundle deploy carries them + applies v96–v97) |
| `EXPECTED_DB_VERSION` (local code) | `97` (must match db_migrate `TARGET_VERSION`) |
| Local DB version | `97` (v97 member_instrument — per-participant instrument assignment; verified live) |
| Heroku DB version | `95` (the next deploy will apply v96 + v97) |
| Heroku app name | `hdwhf` |
| Heroku URL | https://hdwhf-6e6c604bb3f3.herokuapp.com (custom domain: https://demo.primada.io) |
| Heroku release | `v98` (refer-participant) · v97 (crash fix) · v96 (Erica edits + code table) |

> **The code table now has its first consumer** — the refer-participant workflow (v98).
> The *consumer* half (Performance Profile reading the code to pre-fill) is still TODO
> (post-demo, since it edits the live demo page).

GitHub remote: `git@github.com:billjansen-ops/Loyalty-Demo.git`
Heroku remote: `https://git.heroku.com/hdwhf.git`

There is one branch: `main`. No feature branches, no worktrees.

---

## Test suite

- **60 tests total**, **all 60 passing / 1182 assertions** (last full run: Session 131,
  after the instrument-assignment plumbing). Session 131 added
  `core/test_molecule_create.cjs` (35 asserts — the one-call molecule creation routine
  + round-trip proof + browser walk of the create page) and
  `insight/test_instrument_assignment.cjs` (28 asserts — per-participant assignment +
  MEDS honoring the assigned set). Session 124 added `core/test_codes.cjs`
  (extended Session 130 for the code-context endpoint); Session 126 added
  `insight/test_referral_source.cjs`; Session 129 added
  `insight/test_user_positions.cjs` + `insight/test_registration_review.cjs`;
  Session 130 added `insight/test_instrument_library.cjs`.
- Session 122 added `core/test_tenant_auth_gates.cjs` (12 assertions — the
  privilege-escalation gates) and `insight/test_cross_tenant_isolation.cjs`
  (21 assertions — cross-tenant PHI/PII isolation, both directions, two-sided
  with oracle proofs).
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
