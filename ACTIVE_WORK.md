# ACTIVE WORK

## No in-progress build. Next up: **Erica's stuff** (Performance Profile / OER).

Session 123 was a detour that got reverted (see below). Nothing is half-built or
fragile right now — the platform is back to its fast, pre-session state. The next
session should go straight to Erica's work.

**Lead items (in priority order):**
1. **Answer Erica's 8 OER questions.** She asked; Tom parked the OER itself for the
   Dr. Stadler demo. **The actual 8 questions are now written down** in
   `docs/PERFORMANCE_PROFILE_OER_PLAN.md` → "ERICA'S 8 OER QUESTIONS" (they were only
   in Bill's email before — Session 123 captured them). Draft answers against the
   REUSE MAP in that same doc (most map to patterns the platform already has).
2. **Performance Profile / OER build** — the real product behind the demo, tracked in
   **`docs/PERFORMANCE_PROFILE_OER_PLAN.md`** (the single living tracker). Open build
   items there include the overview walkthrough (step 6) and the referral-code→context
   table (the QR "real" pattern — design is in that doc).
3. The bigger arc — self-registration, participant portal, PHP linkage, OER instrument —
   per the plan doc.

**The Dr. Stadler demo (Wed 2026-07-01) is shipped + live** on demo.primada.io: a
no-login QR Performance Profile (PPSI weighted + Foundations), discoverable from the
Insight dashboard's "New — Try It" section. Don't re-do it.

---

## ⛔ DO NOT resume the RLS / database tenant-lock work.

Session 123 built a database-level tenant-isolation lock (Postgres RLS) as "Phase 0
of the secure foundation," then **removed it the same session** because it cost real
performance (accruals 1,056/s → ~100/s under enforcement) and guarded against a
failure the platform already covers (code-level isolation + the Session 122
cross-tenant regression tests). Decision (Bill): **not worth it for a demo with no
live PHI.** The platform was restored byte-for-byte.

If real production PHI ever lands and the question comes back, the design is preserved
in **`docs/RLS_BACKSTOP_DESIGN.md`** — but it must be re-done with the performance
design settled FIRST (the killer was per-request connection pinning pulling
`getNextLink`'s counter UPDATE into the request transaction, serializing all writes on
one shared row). Do not reach for it again without Bill explicitly asking.

Note: "RBAC" (role-based access for the product's portal/observer logins) is a separate,
still-potentially-relevant thing — but it is NOT the RLS database lock, and it is not
queued. Start from Erica's items above.
