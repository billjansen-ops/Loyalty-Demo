# ACTIVE WORK

Status: **Tenant-isolation hardening shipped (Session 121, Heroku v89). One
follow-up piece intentionally deferred to the next session: the RLS backstop
(fix #1), optionally preceded by the lighter build-time check.**

This session's hardening is done, deployed, and verified — see `STATE.md`. What
remains is a single, deliberately-separated next piece.

---

## NEXT: Fix #1 — a backstop so a forgotten tenant filter can't leak

**Why.** Today, tenant isolation lives entirely in the application code: every
query must remember its `tenant_id` filter. Session 121 closed the holes and
made `req.tenantId` authoritative, but there is **no net** under the code — a
future forgotten filter would leak again. The platform was deliberately built
"isolation in code" (a valid choice), but the box holds real PHI, so a backstop
is worth it.

**Two options (decide first — they're not equal cost):**

1. **Lighter check (lower risk, recommended to do first/instead).** A build-time
   / test-suite gate that fails whenever a tenant-scoped query lacks a
   `tenant_id` predicate (extend `tests/lint-anti-patterns.cjs`, or a dedicated
   test). Catches the "forgotten filter" class at CI time. Cheaper, weaker than
   RLS, no runtime/foundation change.

2. **Postgres RLS (stronger, HIGH-RISK).** Make the database enforce it. Current
   state is decorative: RLS is enabled only on `member`, **not forced**; the app
   connects as a **superuser that bypasses RLS**; and the `app.tenant_id` GUC is
   **never set** anywhere. To make it real:
   - Provision a **non-superuser DB role** (no `BYPASSRLS`) on **both** local and
     Heroku; switch the app connection to it. Confirm migrations / link_tank /
     sequences still work under it.
   - `ENABLE` + **`FORCE`** RLS on the tenant-scoped tables (not just `member`).
   - Set `app.tenant_id` **per request** via `SET LOCAL` inside a transaction,
     wired into the connection-pool checkout — **and reset on release**, or one
     request's tenant bleeds into the next pooled request (this footgun can
     *create* a cross-tenant leak — the thing it's meant to prevent).
   - Handle legitimate cross-tenant paths (superuser tools, scheduled jobs that
     walk all tenants, the ML pipeline) — privileged role or correct GUC.
   - New tests proving **both** "blocks cross-tenant" **and** "legitimate access
     still works." Beware "works locally / breaks on Heroku."

**Also queued (small, do alongside or first):**
- **Lock-in regression tests.** Session 121's fixes were verified by code review
  + full suite green, **not** by a live cross-tenant attack. Add a few "tenant A
  can't read/write tenant B" negative tests (e.g. a tenant-1 session hitting a
  tenant-5 member/registry/survey link → 404/403) so the fixes can't silently
  regress.

**Locked decisions (Session 121):**
- `req.tenantId` is the single source of truth for the caller's tenant; client
  `tenant_id` is honored only for superusers (middleware ~L1804). New code must
  use `req.tenantId`, never read `tenant_id` from the body/query for scoping.
- `/v1/users*` is admin/superuser-only; `/v1/clone` is superuser-only.

**Paste-ready next-chat prompt:**

> Session 122. Last session (121) closed the tenant-isolation holes a 3-agent
> audit found — keystone (tenant-switch locked to superuser, `req.tenantId`
> authoritative), IDORs, ~55 tenant-from-body endpoints, the SQL injection, and
> auth gates on `/v1/users*` + `/v1/clone`. All deployed (Heroku v89,
> `SERVER_VERSION 2026.06.25.1557`, DB still v80) and on GitHub (`88821b1`).
> Now I want to add the backstop (fix #1) so a future forgotten tenant filter
> can't leak. Read the startup docs, then `ACTIVE_WORK.md`, and let's discuss:
> the lighter build-time check vs full Postgres RLS, plus the lock-in
> regression tests. Don't write code until we agree the approach.
