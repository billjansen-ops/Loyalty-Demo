# ACTIVE WORK

## NEAR-TERM PRIORITY — Performance Profile QR demo (Dr. Stadler, 2026-07-01)

New work landed from Erica (two instruments: Performance Profile + OER); Tom
scoped the immediate ask to a **QR → Performance Profile → scored result** demo
for the Dr. Stadler meeting on **Wed 2026-07-01**. Full plan + build order +
status + the longer roadmap behind it: **`docs/PERFORMANCE_PROFILE_OER_PLAN.md`**.
That doc is the tracker for this effort; the tenant-isolation/RLS item below is
now Phase 0 foundation within it.

---

Status: **Tenant-isolation lock-in tests shipped (Session 122). The remaining
backstop piece — the database-level RLS net — is designed but not executed; it
is the single open item, deliberately separated into its own future session.**

Session 122 built the cross-tenant regression tests (the lighter, reliable
"forgotten-filter" gate) and wrote the RLS execution plan. What's left is the
RLS execution itself.

---

## DONE this session (Session 122)

- **Cross-tenant lock-in regression tests** — the real attack Session 121 was
  never verified by. Two files, 33 assertions, all green; full suite now 53
  tests / 987 assertions / 0 fail; lint 0. No server/DB change.
  - `tests/insight/test_cross_tenant_isolation.cjs` — a tenant-1 (Delta) user is
    blocked from every tenant-5 (Insight) PHI/PII surface Session 121 scoped
    (profile, survey answers by link, stability registry, MEDS, PPII history,
    member search, physician-annotation **write**); plus the reverse direction
    (a throwaway tenant-5 csr blocked from tenant-1). **Two-sided:** every
    attacker-404 is paired with an oracle call proving the resource is really
    there, so a pass means "blocked," not "absent."
  - `tests/core/test_tenant_auth_gates.cjs` — the keystone privilege gates:
    tenant-switch superuser-only (csr **and** admin blocked), `/v1/users*`
    admin-only with own-tenant confinement + forged-`tenant_id` ignored,
    `/v1/clone` superuser-only, plus a superuser positive control.
- **RLS backstop design** — `docs/RLS_BACKSTOP_DESIGN.md`. Verified the current
  DB lock is decorative (RLS only on `member`, not FORCEd, GUC never set, app
  connects as a bypass superuser), enumerated the three footguns, and laid out a
  staged, reversible rollout + both-direction test gate.
- **Decision: the "lighter lint" was dropped, on purpose.** A grep that flags
  "tenant query missing `tenant_id`" can't tell a safe query from a leaky one in
  this codebase (globally-unique link IDs make many tenant-table queries
  legitimately filter-free; SQL is assembled in helpers; ~885 query sites). It
  would be a green check that means nothing. The regression tests are the
  reliable version of that gate, so they replace it.

---

## OPEN — the one remaining piece: execute the RLS net (own session)

**Why deferred.** RLS is the only true backstop (a forgotten filter becomes an
empty result, not a leak), but it's HIGH-RISK: the pooled-connection GUC trap can
*create* a leak, the non-superuser DB-role change can break migrations, and it's
prone to "works locally / breaks on Heroku." It needs the connection-pool
plumbing, a new DB role on both environments, and a both-environments rollout.

**The plan is written** — follow `docs/RLS_BACKSTOP_DESIGN.md`. Stages: provision
`app_rls` (inert) → policies in shadow → wire the GUC (still on bypass role) →
flip the role + FORCE → burn-in. The Session 122 regression tests are the gate at
the flip stage; add the "deliberately-unfiltered query returns zero cross-tenant
rows" test to prove RLS catches a forgotten filter directly.

**Open questions to settle with Bill at execution time** (in the design doc §6):
privileged path as a second role vs a GUC sentinel; how far to push the
pinned-client refactor (full vs wrapper-shim); FORCE all tenant tables at once vs
PHI-first.

**Locked decisions (Session 121, still in force):**
- `req.tenantId` is the single source of truth for the caller's tenant; client
  `tenant_id` is honored only for superusers (middleware ~L1804). New code must
  use `req.tenantId`, never read `tenant_id` from the body/query for scoping.
- `/v1/users*` is admin/superuser-only; `/v1/clone` is superuser-only.

**Paste-ready next-chat prompt:**

> Session 123. Session 122 shipped the cross-tenant lock-in tests (53 tests /
> 987 assertions green) and wrote `docs/RLS_BACKSTOP_DESIGN.md`. The one open
> piece is executing the database-level RLS net per that doc — HIGH-RISK
> (pooled-GUC trap, non-superuser role, both-environments). Read the startup
> docs, then `docs/RLS_BACKSTOP_DESIGN.md` and `ACTIVE_WORK.md`, and let's settle
> the §6 open questions before any code: privileged path (second role vs GUC
> sentinel), pinned-client scope (full vs wrapper-shim), FORCE scope. Don't write
> code until we agree.
