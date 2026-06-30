# ACTIVE WORK

## No in-progress build. Refer-participant (producer) shipped; next is the consumer half.

Session 125 ended at a clean point — nothing half-built. The code engine is live on
Heroku (v98) and now has its **first consumer**: the "Refer participant" workflow
(`bb200a8`, dashboard + clinic), Bill click-tested "looks good." The Dr. Stadler demo
(2026-07-01) is set and verified.

**What's done (Session 125):**
- Erica's welcome/overview edits — live (v96). Crash fix on the Performance Profile — live (v97).
- **Refer-participant workflow** (the code engine's first consumer) — live (v98), Bill-confirmed.
- **WisconsinPATH master build plan** + gap analysis — `docs/WISCONSINPATH_BUILD_PLAN.md`.
- Two emails drafted, pending Bill to send (welcome/overview note; WisconsinPATH reply).

**Next up (in rough priority):**
1. **The consumer half of the referral loop (post-demo)** — make the Performance Profile
   read its code and pre-fill. Design decided: `/p/:code` should redirect to a clean
   `/performance-profile?c=CODE` (opaque token only, **not** `?ref/track/aff`), and the
   form resolves the context via a small read-only endpoint — context never rides the URL.
   This edits the live demo page, so it waited until after Wednesday's demo.
2. **WisconsinPATH Stage 1 (unblocked, reuse-heavy):** referral-source classification +
   dashboard segmentation; review queue + role routing + triage notes + SLA escalation +
   disposition — all ride existing registry / notification / SLA engines. See the master plan.
3. **"Add observer"** — deferred until the Stage-5 observer actor/onboarding exists.
4. **Resource-library matching** (score → content) — Erica is compiling the content.

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
