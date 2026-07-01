# ACTIVE WORK

## Dashboard segmentation SHIPPED (local). Molecules-on-users design DONE + APPROVED — build not started.

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

**Waiting on Erica (non-blocking):** note SENT asking whether Stage-1 registration reviews route
program-wide vs by referral source / per-clinic. Informs routing config; doesn't block the build.

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
