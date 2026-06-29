# ACTIVE WORK

## No in-progress build. The code engine landed (GitHub only); next is its consumer.

Session 124 shipped a lot and ended at a clean point — nothing is half-built or
fragile. The general-purpose **`code` table** (the "real QR" / referral-code
mechanism) is built, tested, and on `origin/main` (`81c50f8`), **CI-green but
deliberately NOT on Heroku** — it's foundation with no Erica-facing consumer yet.

**What's done (Session 124):**
- OER answers emailed to Erica/Tom (the 8-question reply).
- Platform Overview walkthrough (`/overview`) — **live on Heroku** (v95).
- RLS migration hotfix (v81/v82 → no-ops) — **unfroze Heroku deploys** permanently.
- The `code` engine + `admin_codes.html` (internal tool) — GitHub only. See `STATE.md`.

**Next up (in rough priority):**
1. **The code engine's real consumer** — the Insight-side workflow buttons ("Refer
   participant" / "Add observer") that mint a code behind the scenes and hand the
   operator a link/QR. This is the Erica-facing payoff. Lives in
   `verticals/workforce_monitoring/*`. Part of the bigger portal/observer phase.
2. **Smaller, unblocked:** Performance Profile pre-fill (the form reading
   `?ref/track/aff` that `/p/:code` already passes); or standing up the OER as a real
   instrument (Phase 1 — rating form + scoring, demo-contained like the PP).
3. **Resource-library matching** (score → content) — Erica is compiling the content.

**⛔ Blocked on Erica/others (the big asks from her June email):**
- **Privacy model (her Q6)** — dual-track / 42 CFR Part 2. Erica is drafting a
  preliminary version; needs Chris + legal. This **gates** real self-registration +
  participant portal + PHP linkage. The ball is largely in her court here.
- Resource-library **content** — hers to compile.

Full plan + statuses: **`docs/PERFORMANCE_PROFILE_OER_PLAN.md`**. Erica relationship /
waiting-on items: `project_erica_tracking` memory.

---

## ⛔ DO NOT resume the RLS / database tenant-lock work.

Session 123 built then removed RLS (perf cost — accruals 1,056/s → ~100/s; insurance
not yet needed). Session 124 collapsed migrations v81/v82 to no-ops to unfreeze Heroku
(the real v81 can't run on Heroku — RDS forbids creating a login role with a password).
Do not reach for RLS again without Bill explicitly asking — design preserved in
**`docs/RLS_BACKSTOP_DESIGN.md`**.

Note: "RBAC" (role enforcement for the product's portal/observer logins) is a separate,
still-relevant thing needed before real self-registration — but it is NOT the RLS lock.
