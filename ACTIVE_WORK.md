# ACTIVE WORK

## Session 129: shore-up list DONE (all 6) + POSITION/POSITIONCLINIC parity DONE (v92). Next: the assignment surface.

**Parity DONE (db_migrate v92, Bill's go):** the UI-created POSITION/POSITIONCLINIC + their
`4_data_*` tables were deleted and recreated in ONE migration — definitions (new ids 149/150),
column defs (POSITIONCLINIC col 1 borrows POSITION's list), values (value_id 1–3), tables +
indexes. By molecule_key. This migration is how the pair reaches Heroku. Round-trip re-proven
on the recreated pair (encode/decode + borrowed values). **12-vs-122 resolved by Bill:** build
on position+clinic; real use decides if the health-system level is ever needed (tables empty,
local-only — changing shape before deploy stays cheap).

**ASSIGNMENT SURFACE — ✅ BUILT + PROVEN (Session 129, later same session):**
- **Plumbing:** three generic endpoints under the /v1/users admin gate —
  `GET/POST/DELETE /v1/users/:id/molecule-rows/:key` (molecule key rides the URL, so no
  tenant-specific names in platform code). Guards: own-tenant confinement, parent_bytes=4
  required, unknown list codes 400, exact duplicates 409. Row removal reuses the EXISTING
  `deleteMoleculeRow` helper (a duplicate helper was written then removed — grep first).
- **The user-parent round-trip is PROVEN at the byte level** (the "final proof" from the
  S128 notes): position stored as squished value_id via the BORROWED list, clinic id raw,
  owner = the login's 4-byte link; removal by value tuple; tables left clean.
- **Screen:** `admin_user_edit.html` (edit mode) — a data-driven assignments section, one
  per user-level molecule of the user's tenant (Delta users: nothing shows). Position
  dropdown from the shared list; clinic picked partner-first→program (same flow as the
  physician search Erica knows). Add / duplicate-error / Remove all browser-verified by
  Claude before Bill saw it. Molecules that OWN a borrowed list (POSITION) are excluded
  from the sections — the list home is not an assignment surface.
- **Test:** `tests/insight/test_user_positions.cjs` (20 assertions) in the manifest.
  Suite now **56 tests / 1038 assertions**, all green; lint 0.
- Wording note for Bill: the field labels in the section ("The position", "The partner
  Program") come from the molecule's column descriptions — editable per tenant in the
  molecule admin, not hardcoded.

### ✅ THE REVIEW QUEUE IS BUILT (Session 129, later same session) — next: Bill click-test, then the Erica deploy
All three pieces + gates done (details in STATE.md / build notes):
- **Trigger is pure config (v95):** enroll → REG_REVIEW promotion (enrollment counter)
  qualifies at signup → external result → registry item (YELLOW/48h) → action-scoped event
  `REGISTRY_REG_REVIEW` → notification rule routes **by position** (new recipient_type
  'position', recipient_role 'POSITIONCLINIC:CASEMAN' as data).
- **Queue UI:** Registrations chip on the action queue; triage-note-required dispositions
  on REG_REVIEW items — Advance / Route to Resources / Escalate (assigns to a Medical
  Director holder + notifies with the note; actionable 409 when no one holds the position).
- **Overdue clock:** REG_REVIEW_SLA job (daily + manual-run) — YELLOW→ORANGE, auto-assign
  to MD, escalation notification; rerun-safe.
- **Two REAL pre-existing bugs found by the browser walk and fixed:** (1) clinic-scoped
  registry views hid clinic-less members — registration reviews (program intake) now stay
  visible under any clinic view; (2) **with any filter active, clicking a queue item opened
  the WRONG record** (the caseload patch renders from a temp array; position-based indexes
  went stale) — clicks now resolve items by link, never position.
- Test `insight/test_registration_review.cjs` (28 assertions). Suite **57 tests** green,
  lint 0. Walk done at admin level with a DB snapshot/restore around it (zero residue).

**NEXT: Bill click-tests, then the Erica deploy** (GitHub push → CI → Heroku + v85→v95
migrations + restart + live click-test → THEN the email). Erica's package: referral
classification, dashboard segmentation, Users & Roles + positions, the review queue.

**DEPLOY DECISION (Bill, Session 129): hold the Heroku/Erica deploy until the review queue
is built.** Referral classification + dashboard segmentation alone aren't tangible enough for
Erica ("she doesn't know or care we updated the molecule system") — ship the complete Stage-1
registration story in one visible update: classification + segmentation + the review queue
with her routing. So: assignment surface → review queue → THEN deploy (v85→v92+, on Bill's go).

**Working-style commitment (Session 129, after a rough two days):** Claude click-tests every
new screen end-to-end in the browser BEFORE handing it to Bill — Bill is never again the first
person to click a screen. See memory `feedback_live_words_over_notes` for the rest.

**Shore-up list CLOSED (Session 129, all verified live):**
1. DELETE /v1/molecules/:id now cleans the molecule's `{n}_data_*` storage rows (proven with a
   planted row on a throwaway molecule). 2. Create-flow step-2 failure now surfaces as an error
   instead of a false "saved successfully". 3. GET /v1/molecules/:id + all five groups endpoints
   tenant-gated (cross-tenant proven blocked both directions). 4. Test modal errors on missing
   session tenant instead of silently testing tenant 1. 5. Locked column definitions labeled
   as by-design on the edit page. 6. ML_RISK_LEVEL + ML_CONFIDENCE deleted via **db_migrate v91**
   (Bill's go; by molecule_key; the "seeded display-template line referencing them" in the S128
   audit note was STALE — no such line exists). SERVER_VERSION 2026.07.01.2358, DB **v91**,
   suite 55/1018 green, lint 0. Heroku deploy now applies **v85→v91**.

**Erica ANSWERED the Stage-1 routing question (2026-07-01 email):** registration reviews go
**Case-Manager-first — the case manager triages, then escalates/routes to the Medical Director
when needed.** ("I think your first instinct would be correct.") Build it as the default, as a
setting — not hardcoded. This unblocks the review-queue routing config.

## Session 128: molecules-on-users foundation BUILT (local-only). Next: the assignment surface + the shore-up list.

**Where the foundation stands after Session 128** (all verified live; details in STATE.md):
steps 1–3 of the plan are DONE — user link widened to 4-byte (v88), engine routes storage by
`molecule_def.parent_bytes` (v89), admin page has the parent-size picker + the reworded
**"Used in Rules Criteria for:"** Activity/Member boxes (independent; both-off = not a rule
field; `/v1/molecules/by-source` now honors them via `attaches_to`). PLUS a piece the plan
didn't have: **shared internal lists** (v90 — a list column borrows another molecule's list;
round-trip proven; borrower writes rejected).

**Created via the UI (Bill driving, wi_php):** POSITION (mol 145 → `4_data_1`, values
Case Manager / Medical Director / Clinician, saved + DB-verified) and POSITIONCLINIC
(mol 147 → `4_data_12`: position borrows POSITION's list + clinic → `partner_program`).
**POSITIONCLINIC is NOT round-trip-proven** — nothing writes user-parent rows yet.

### ▶ NEXT BUILD: the position/clinic assignment surface
The screen (likely on user admin) that puts a POSITIONCLINIC row on a staff login —
the first real write into `4_data_12`, and the round-trip proof that finishes the molecule.
Building it **settles Bill's open 12-vs-122 concern below first** — decide before real data.
After that: the WisconsinPATH Stage-1 **review queue** (role routing rides on positions).

**Then the parity step (Bill's plan, agreed Session 128):** once the assignment surface
proves the final shape, DELETE the UI-created POSITION + POSITIONCLINIC locally (and drop
`4_data_1` / `4_data_12`), and recreate all of it in ONE db_migrate version — molecules,
values, list-source pointer, and the `4_data_*` tables — so local and Heroku converge through
the same migration. Migration rules: resolve POSITION by **molecule_key, never molecule_id**
(sequences diverge across environments); the migration creates the storage tables itself
(Heroku must not depend on anything the UI did locally). Remember the DELETE endpoint doesn't
clean storage rows (shore-up item 1) — both tables are empty today, keep them that way.

### ▶ SHORE-UP LIST — ✅ DONE Session 129 (see top of file; kept for reference)
Every page Bill used today was broken (all fixed; see STATE). The audit found what's left:
1. **DELETE /v1/molecules/:id orphans storage rows** (VERIFIED in code — deletes the
   definition + value tables but never the `{n}_data_*` rows; ghost data if a molecule id
   is ever reused).
2. **Create-flow step-2 failure is swallowed** — column-definitions PUT wrapped in a
   catch that only console.warns, then the page alerts "saved successfully" (manufactures
   half-built molecules — today's root failure class).
3. **`GET /v1/molecules/:id` + the groups endpoints have no tenant check** (cross-tenant
   config read; the write side was scoped in S121, these reads were missed).
4. **Molecule Test modal falls back to tenant 1** when no tenant in session.
5. **Column defs on existing molecules are view-only BY DESIGN** (storage lock) — but the
   page doesn't say so; label it.
6. **ML_RISK_LEVEL + ML_CONFIDENCE are orphan definitions** (no columns, no data, zero code
   references — abandoned design; migration comment says level is computed from score).
   Delete them + fix the one seeded display-template line (template 40) that references
   them. wi_php config — Bill's go first.

**Session 127 shipped (local commit `4c829d2`, verified, NOT deployed):** WisconsinPATH Stage 1
**dashboard segmentation by referral source** — the participant list carries each member's
`REFERRAL_SOURCE` as `{code,label}`, and `dashboard.html` has a new **"By Referral Source"** tab
(mirrors "By Licensing Board"). No DB change; reads the Session-126 molecule. Rides the post-demo
Heroku deploy with Session 126.

**Session 127 also shipped (local commit `e13a4c4`, front-end only):** the molecule admin page
(`admin_molecule_edit.html`) no longer **requires** "attaches to member/activity" — dropped the
validation gate, the required `*`, and the "select at least one" help text. First tiny step toward
molecules on other parents.

### ▶ DIRECTION DECIDED — build molecules-on-users (the foundation). Build NOT started.

**Source of truth: `docs/MOLECULE_PARENT_GENERALIZATION.md` (Session 127)** — the full design +
decisions + the exact migration. `docs/MOLECULES.md` §11 summarises it, §1 forward-points. Read the
design doc first. The "foundation-first vs feature-first" fork is **resolved: foundation-first** —
Bill chose to build molecules-on-users, then the review queue rides on it.

**THE NEXT STEP (start here):** the data migration — **widen the user `link` from 2-byte to 4-byte**,
via `db_migrate.js` (never direct SQL). Exactly **6 columns** smallint → integer: `platform_user.link`
+ `audit_log_1..5.user_link`. **Leave the link tank untouched** (the allocator just increments; the
column width was the only limit — verified this session). No FKs on `link`. Bump `TARGET_VERSION` +
`EXPECTED_DB_VERSION`, restart, and prove the audit trail still joins. Do a final sweep for any
differently-named copy of the link first. **This is a schema change touching audit (record of truth)
— get Bill's go before applying.** Then: (2) kill the hardcoded 5-byte assumption in the molecule
machine + admin page; (3) add the parent-type control + the "Available to the rules engine" flag to
the admin page; (4) with Bill driving the maintenance page, create the first user molecule (`(role,
clinic)` → `4_data_12`, `p_link integer`) and prove a round-trip.

**⚠️ Bill's open concern (Session 128 — revisit when building the assignment screen):**
POSITIONCLINIC was built as `4_data_12` (position + clinic only). Bill suspects it may need to be
**`4_data_122`** (position + health system + clinic — mirroring the member PARTNER_PROGRAM's
partner+program pair). The 12 shape rests on: clinic → health system is derivable
(`partner_program.partner_id`); the molecule is not a rule field (the rules-engine
"value-must-be-on-the-row" argument that justifies Delta storing both doesn't apply); and the
member molecule's partner column proved unread. **Decide for real when the position/clinic
assignment surface is built** — if assigning a position at the health-system level (no specific
clinic) turns out to be needed, Bill is right and it becomes 122. Don't store real data in
`4_data_12` until this is settled.

The design context that got us here (keep for the next session):

Scoping the Stage-1 **review queue** (role routing → triage notes → SLA escalation → disposition)
surfaced a foundational identity question. Where the discussion landed:

- **"A person is a person"** — one population, no separate "staff type." Today's member-vs-login
  split is mostly an accident of auth.
- Roles modeled as **(clinic + capacity)** multi-row molecules on the person; **"monitored" is
  just one capacity** (alongside case-manager / director) — one affiliation concept, not two
  enrollments. One person can hold many role@clinic rows *and* be monitored.
- The **login stays a separate dumb keycard** pointing at the person — the one thing that can't
  be a molecule (auth runs before identity is known; needs a value→person lookup that fails loud).
- Molecule overhead is a non-issue at this scale, so molecules are fine for the affiliation model —
  **but** molecule **Tier-1 hardening** (validate-at-creation + auto round-trip; low-risk, only
  touches new-molecule creation) becomes a prerequisite, since the access model would rest on molecules.

**⚠️ Verified current-state correction (Session 127, checked against the DB/code):** today a login
(`platform_user`) is **NOT attached to a member at all** — no member pointer exists. Its `link`
column is the login's *own* id — allocated via `getNextLink('platform_user')` from `link_tank`,
primed at −32768 (the 5 live logins are −32768…−32764), **not** `MAX(link)+1`/`from 100` (I had that
wrong) — not a reference to `member`. The session
carries only `userId`/`tenantId`/`role`. And `platform_user.role` is CHECK-constrained to
**`superuser`/`admin`/`csr`** only — so the clinical titles (case-manager, medical-director) can't
even live on a login today; they exist only as `notification_rule.recipient_role` targets that
currently match zero users. Logins and members are two disconnected worlds, bridged in exactly one
fragile spot (notification routing matches a member's clinician to a login by **display_name**).
Consequence: the "keycard points at the person" wiring is **net-new to build**, not existing — and
**feature-first also has to introduce role-holding from scratch** (clinical roles aren't on logins),
so its "it's already there" advantage is smaller than first stated.

**Fork resolved → foundation-first.** Also settled this session: **tenant + access-tier
(superuser/admin/csr) stay explicit fields, NOT molecules** (resolved before the molecule layer;
a "tenant molecule" is circular); domain roles = molecules on the user. **Rules-engine
participation becomes an explicit molecule flag** (decoupled from A/M), so new parents are fenced
out of bonus/promotion logic by default. **Tier-1 molecule hardening** (validate-at-creation + auto
round-trip) rides along when we extend the fragile layer — Bill to confirm if it's in this pass.

**Reuse map for the review queue is done** (registry =
worklist backbone with status/assigned_to/SLA/notes + chart display; notification engine routes by
role; the one net-new engine piece is an SLA-deadline escalation job). `docs/WISCONSINPATH_BUILD_PLAN.md`
Stage 1 rows have the reuse-vs-new detail.

**Erica's routing answer arrived (Session 129, see top of file):** Case-Manager-first, escalate
to the Medical Director. Default behavior, configurable — not hardcoded.

---

## Prior — Session 126 ended clean

Session 126 ended clean — nothing half-built. `REFERRAL_SOURCE` (the WisconsinPATH Stage 1
classification field) is built + round-trip-verified, the internal-list `value_id` bug is
fixed at the root with a guard, and the molecule documentation is consolidated into one
authority. All on `origin/main`, CI-gated, **NOT deployed to Heroku** (Dr. Stadler demo is
2026-07-01 — deploy after).

**What's done (Session 126):**
- **`REFERRAL_SOURCE` member molecule** (db_migrate v85+v86) — Stage 1 referral classification
  (Self-referral / Employer / Board-mandated) on the participant; verified by
  `tests/insight/test_referral_source.cjs`. Registration lifts `referral_type` from the
  referral `code` row's JSONB into this molecule.
- **Internal-list `value_id` bug fixed at the root** (db_migrate v87 + pointers.js): shared
  `allocateListValueId()`, clone/static-text paths fixed, 3 overflowed lists renumbered to
  per-molecule 1..N, `CHECK (value_id BETWEEN 1 AND 127)` guard added.
- **Molecule docs bulletproofed:** `docs/MOLECULES.md` is the single source of truth; master §2
  and essentials §2 gutted to a pointer; wired into START_HERE + the skill.

**Next up (in rough priority):**
1. **Deploy Session 126 to Heroku — AFTER the 2026-07-01 demo, on Bill's go.** `git push heroku
   main` then `heroku run --app hdwhf "node db_migrate.js"` (applies v85→v87) then restart +
   verify. Local is ahead: SERVER_VERSION 2026.06.30.2101, DB v87; Heroku v98 / DB v84.
2. **Continue WisconsinPATH Stage 1 (unblocked, reuse-heavy):** `REFERRAL_SOURCE` is the
   classification field — next is dashboard **segmentation** by it, then the **review queue +
   role routing (Med Director / Case Manager) + triage notes + SLA escalation + disposition**,
   all riding existing registry / notification / SLA engines. See `docs/WISCONSINPATH_BUILD_PLAN.md`.
3. **The consumer half of the referral loop (post-demo)** — Performance Profile reads its code
   and pre-fills. Design decided: `/p/:code` → clean `/performance-profile?c=CODE` (opaque token
   only), form resolves context via a read-only endpoint (context never in the URL). Edits the
   live demo page, so it waited until after the demo.
4. **"Add observer"** — deferred until the Stage-5 observer actor/onboarding exists.
5. **Resource-library matching** (score → content) — Erica is compiling the content.

**⚠️ Molecule work: read `docs/MOLECULES.md` first.** Session 126 lost hours to a molecule bug
that the (now-fixed) docs would have prevented. It's the single source of truth now.

**⛔ Blocked on Erica/others (the big asks from her June email):**
- **Privacy model (her Q6)** — dual-track / 42 CFR Part 2. Erica is drafting a
  preliminary version; needs Chris + legal. This **gates** real self-registration +
  participant portal + PHP linkage. The ball is largely in her court here.
- Resource-library **content** — hers to compile.

Full plan + statuses: **`docs/WISCONSINPATH_BUILD_PLAN.md`** (the master roadmap +
code-grounded gap analysis — Session 125; supersedes the old OER-plan roadmap). Erica
relationship / waiting-on items: `project_erica_tracking` memory.

**NEW (Session 125): WisconsinPATH master build plan.** Jim's anticipated Wisconsin-program
workflow → Erica's build requirements (`PI2_WisconsinPATH_Build_Requirements.docx`, her
working doc) → reconciled into `docs/WISCONSINPATH_BUILD_PLAN.md` with a capability scan.
Key finding: the spec is solid, but **consent/release-of-information, toxicology/lab orders,
and OER activation do NOT exist yet** (Erica had them as "Configure"/exists) — they're
net-new, and the consent piece is the same 42 CFR Part 2 work gated on her Q6. Erica expects
this to **reuse across Washington** — design net-new pieces tenant-configurable. Not started;
roadmap/planning only.

---

## ⛔ DO NOT resume the RLS / database tenant-lock work.

Session 123 built then removed RLS (perf cost — accruals 1,056/s → ~100/s; insurance
not yet needed). Session 124 collapsed migrations v81/v82 to no-ops to unfreeze Heroku
(the real v81 can't run on Heroku — RDS forbids creating a login role with a password).
Do not reach for RLS again without Bill explicitly asking — design preserved in
**`docs/RLS_BACKSTOP_DESIGN.md`**.

Note: "RBAC" (role enforcement for the product's portal/observer logins) is a separate,
still-relevant thing needed before real self-registration — but it is NOT the RLS lock.
