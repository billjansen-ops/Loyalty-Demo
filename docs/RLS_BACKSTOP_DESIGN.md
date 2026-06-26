# RLS Backstop — Design (the database-level tenant lock)

**Status:** DESIGN ONLY. No code or DB change yet. Written Session 122 so a
future session can execute the strong tenant-isolation net safely, against a
vetted plan, instead of improvising it live.

**Why this is its own document and its own session:** the platform holds real
PHI (Insight / Wisconsin PHP, tenant 5). Today tenant isolation lives entirely
in application code — every query must remember its `tenant_id` filter. Session
121 closed the known holes and made `req.tenantId` authoritative; Session 122
added the **cross-tenant regression tests** (`tests/core/test_tenant_auth_gates.cjs`,
`tests/insight/test_cross_tenant_isolation.cjs`) that prove those fixes hold and
freeze them. What neither did is add a **net under the code**: a forgotten filter
in some future query would leak again. Postgres Row-Level Security (RLS) is that
net — done right, a forgotten filter becomes a harmless empty result instead of a
cross-tenant leak. Done wrong, it can *create* the very leak it's meant to stop.
Hence: design first.

---

## 1. Verified current state (Session 122, read live)

RLS today is **decorative** — it enforces nothing:

| Fact | Evidence |
|---|---|
| RLS is enabled on **only** the `member` table, and **not FORCED**. | `schema.sql:1080` `ALTER TABLE public.member ENABLE ROW LEVEL SECURITY;` `:1086` one policy `member_rls_tenant`. No other tenant table has RLS. |
| The policy checks a GUC that **nothing ever sets**. | `app_current_tenant_id()` = `current_setting('app.tenant_id', true)::BIGINT` (`schema.sql:43`). Grep of the codebase: **no** `SET app.tenant_id`, `set_config('app.tenant_id', …)`, or `SET LOCAL` anywhere. The GUC is always NULL at runtime. |
| The app connects as a **superuser that bypasses RLS entirely**. | Local: `PGUSER` → `billjansen` (`rolsuper=t, rolbypassrls=t`, confirmed via `pg_roles`). Heroku: the `DATABASE_URL` role owns the tables. A superuser *and* a table owner both bypass RLS unless the table is `FORCE`d. |
| Isolation is 100% in app code across a large surface. | ~**885** `.query(` call sites in `pointers.js` alone, plus the vertical server modules. Each must remember its own `tenant_id` predicate. |
| `req.tenantId` is the single authoritative caller tenant. | Middleware `pointers.js:1804–1816`: session tenant wins; a client-supplied `tenant_id` is honored **only** for superusers. |

So three things must all change for RLS to actually protect anything: (a) the app
must connect as a **non-superuser** role, (b) the tenant tables must be **FORCE**d
(owner included), and (c) the **GUC must be set per request and reset on release**.

---

## 2. The three footguns (in plain terms, and how the design defends each)

1. **The bypass account.** The app logs in as the owner/superuser, which ignores
   RLS. → Provision a separate **lower-privilege login** (`app_rls`, no
   `BYPASSRLS`, not the table owner) and point the request path at it, on **both**
   the laptop and Heroku. `FORCE ROW LEVEL SECURITY` so even the owner obeys.

2. **The pooled-connection bleed (the dangerous one).** The ~20 pooled
   connections are reused. We tag a connection "this request is tenant X." If we
   ever fail to clear that tag when the connection returns to the pool, the **next**
   request — possibly a different tenant — inherits tenant X. That is a *new* leak,
   the exact thing RLS is meant to prevent. → Set the GUC with **`SET LOCAL` inside
   a transaction** (auto-resets at COMMIT/ROLLBACK), on a **client pinned to the
   request** — never bare `SET` on a pooled connection.

3. **"Works locally, breaks on Heroku."** The two environments have different DB
   roles and ownership; we've been bitten by environment divergence before
   (member-id sequences). → Every step ships to both environments and is verified
   in both; the regression tests run in CI; a **shadow phase** (policies present
   but inert) de-risks the flip.

Plus a fourth, less dangerous but real:

4. **Legitimate cross-tenant work breaks.** Superuser tools, scheduled jobs that
   walk all tenants, the ML pipeline, `db_migrate`, and `link_tank` allocation
   legitimately touch many/all tenants. → Keep a **privileged path** (a separate
   pool/role with `BYPASSRLS`, or a GUC sentinel that the policy treats as
   "all tenants") for exactly those code paths, enumerated and reviewed.

---

## 3. Target design

### 3.1 Roles
- **`app_rls`** — `LOGIN`, **no** `BYPASSRLS`, **not** the owner of the tenant
  tables. The request path connects as this role. It is `GRANT`ed the normal
  CRUD it needs on application tables (and `USAGE` on sequences), nothing more.
- **`app_admin`** (or reuse the existing owner) — the privileged role for
  migrations and the enumerated cross-tenant paths. Keeps `BYPASSRLS` (owner
  bypass is enough if not FORCEd for it — but since we FORCE, give it `BYPASSRLS`
  explicitly or a policy carve-out).

### 3.2 Policy shape (per tenant-scoped table)
```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;          -- owner included
CREATE POLICY <t>_tenant ON <t>
  USING      (tenant_id = app_current_tenant_id())  -- rows you may READ
  WITH CHECK (tenant_id = app_current_tenant_id());  -- rows you may WRITE
```
`app_current_tenant_id()` stays as-is (reads the `app.tenant_id` GUC). Consider a
**sentinel** for the privileged path: e.g. GUC value `0`/`-1` ⇒ policy returns
true for all rows, so the all-tenant jobs can run as `app_rls` with the sentinel
instead of needing a second role. (Decide in §6.)

### 3.3 Setting the GUC per request — the safe mechanic
The codebase calls `dbClient.query(...)` on the **pool** in ~885 places, so the
GUC can't simply be set once. Recommended target:

- Introduce **request-scoped DB context** via `AsyncLocalStorage`: the tenant
  middleware (already at `pointers.js:1804`) stores `req.tenantId` in the store.
- The request path acquires a **pinned client** for the request, opens a
  transaction, and runs `SET LOCAL app.tenant_id = <tenantId>` once. All queries
  in that request use the pinned client; `SET LOCAL` auto-resets at txn end, and
  the client is released back to the pool clean.
- This is the **real cost**: routing request queries through the pinned client
  instead of the bare pool. Options, smallest-blast-radius first:
  - **(a) Wrapper shim.** Replace direct `dbClient.query` in the request path
    with a thin accessor that pulls the pinned client from `AsyncLocalStorage`
    and falls back to the pool (privileged) when there's no request context
    (jobs, boot). Lets us migrate call sites incrementally.
  - **(b) Per-request transaction wrapper** in the auth/tenant middleware that
    pins+sets+resets, with handlers opting in.
  - Bare `SET` (session-level) on a pooled connection is **banned** — footgun #2.

### 3.4 Tables in scope
Every table with a `tenant_id` that holds tenant data. At minimum (enumerate
exhaustively at execution time via `information_schema`):
`member`, `activity`, `member_survey`, `member_survey_answer`,
`stability_registry`, `registry_followup`, `physician_annotation`,
`survey_note_review`, `compliance_*`, `notification`, `notification_rule`,
`notification_delivery`, the molecule data tables `5_data_*`, `molecule_def`,
`molecule_value_lookup`, `bonus*`, `promotion*`, config tables, etc.
**Special cases:** `sysparm`/`sysparm_detail` use `tenant_id = 0` for
platform-global rows (e.g. `db_version`) — the policy must allow tenant `0` to be
readable by everyone, or those reads break. `link_tank` is global infrastructure —
likely **exclude** from RLS and keep on the privileged path.

---

## 4. Staged rollout (each stage independently shippable + reversible)

The point of staging is that RLS is never "all on" until every prior stage is
green in **both** environments.

**Stage 0 — Inventory & guardrails.** Enumerate every `tenant_id` table and
classify: tenant-scoped / platform-global (`tenant_id=0`) / global-infra
(exclude). Land the cross-tenant regression tests first (✅ done Session 122 — they
must stay green through every stage, as the canary).

**Stage 1 — Provision `app_rls` (inert).** Create the role on local + Heroku with
the needed GRANTs. Do **not** point the app at it yet. Verify migrations and the
app still run unchanged.

**Stage 2 — Policies in shadow.** `ENABLE` (not yet `FORCE`) RLS + create policies
on the tenant tables, via `db_migrate`. Because the app still connects as the
bypass role, **nothing changes at runtime** — this is the safe way to get the
policy DDL deployed and reviewed. Verify full suite + regression tests green in
both environments.

**Stage 3 — Wire the GUC (still on bypass role).** Implement the
`AsyncLocalStorage` + pinned-client + `SET LOCAL` plumbing and the privileged-path
carve-outs. Still connecting as bypass, so RLS stays inert, but now the GUC is
being set correctly. Add a **diagnostic**: assert in dev/test that the GUC matches
`req.tenantId` on the pinned client. Verify both environments.

**Stage 4 — Flip the role.** Point the request path at `app_rls`. RLS now
enforces. `FORCE` the tables. Run the regression tests as the gate **in both
environments** — they must show: cross-tenant blocked, own-tenant works, the
all-tenant jobs still work. This is the only stage that changes runtime behavior;
everything before it was reversible no-ops.

**Stage 5 — Burn-in & remove scaffolding.** Watch Heroku logs for RLS-denied
errors (a forgotten privileged path shows up as an empty result or error in a job,
not a leak). Keep the GUC diagnostic in test permanently.

**Rollback at any stage:** revert the role pointer (Stage 4) or drop the policies
(Stage 2) via a new `db_migrate` step. Because connection-role is one config knob,
Stage 4 rollback is "point back at the bypass role + redeploy."

---

## 5. Test plan (the gate for Stage 4)

Reuse + extend the Session 122 regression tests, and run them **against an
RLS-enforcing connection** (a CI/test profile that connects as `app_rls`):

1. **Blocks cross-tenant** — the existing `test_cross_tenant_isolation.cjs`
   attacker phases must stay red-for-the-attacker (404/empty), now enforced by the
   DB even if a filter were removed. *Add* a deliberately-unfiltered test query
   (raw `SELECT … FROM member WHERE membership_number = $1` with **no** tenant
   predicate) executed on the `app_rls` connection with the GUC set to tenant 1,
   targeting a tenant-5 row → must return **zero rows**. This is the direct proof
   that RLS catches a *forgotten filter* (the whole point of the backstop).
2. **Legitimate access still works** — own-tenant reads/writes succeed; the
   all-tenant jobs (scheduled jobs, ML pipeline, exports) still see every tenant
   via the privileged path.
3. **Pooled-bleed check** — fire interleaved requests for tenant 1 and tenant 5
   across the pool under concurrency; assert no request ever sees the other
   tenant's rows (guards footgun #2).
4. **Both environments** — the gate is green on local **and** Heroku, not just
   local.

---

## 6. Open questions for Bill (decide at execution time)

- **Privileged path: second role vs GUC sentinel?** A `BYPASSRLS` role for jobs is
  simplest to reason about; a GUC sentinel (`app.tenant_id = 0` ⇒ all) avoids a
  second pool but makes the policy cleverer. Recommendation: **second role**
  (explicit > clever for a security boundary).
- **How far to push the pinned-client refactor?** Full (every request query
  pinned) is the clean end state but touches many call sites. The wrapper-shim
  (3.3a) lets us flip with a smaller diff and migrate incrementally. Recommendation:
  **wrapper shim**, because it makes Stage 4 a small, reversible change.
- **Scope of FORCE.** Start with the PHI-bearing tables (member, surveys, registry,
  annotations, meds-related, compliance, molecule data) and widen, or do all
  tenant tables at once? Recommendation: **all tenant-scoped tables at once** (a
  partial net invites "which tables are actually protected?" confusion), with the
  `tenant_id=0` and global-infra exclusions handled explicitly.

---

## 7. What this buys, and the honest cost

**Buys:** a true net. After Stage 4, a future query that forgets its `tenant_id`
filter returns an **empty result** to the wrong tenant instead of leaking — the
failure mode flips from "silent PHI disclosure" to "this feature looks empty,"
which is detectable and harmless.

**Cost:** a new DB role on two environments, a connection-pool/plumbing change
that's the genuine footgun, a `db_migrate` series for the policies, and a careful
both-environments rollout. Estimate: a full dedicated session, possibly two.

**Sequencing note:** Heroku is dev/demo (no 24/7 users), so the blast radius of a
Stage-4 misstep is "a feature 404s → fix → redeploy," not user harm. That is the
argument for doing this on Heroku-as-staging with the regression tests as the gate
— not for skipping the staging discipline.
