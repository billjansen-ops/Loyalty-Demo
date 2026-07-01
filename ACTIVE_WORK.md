# ACTIVE WORK

## No in-progress build. Stage 1 classification field is built; molecule docs bulletproofed.

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
