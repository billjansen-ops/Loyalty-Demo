# ACTIVE WORK

Status: **PLANNED — investigation done, NO code written yet.** Next session
implements. This is a **core contract fix**, not optional cleanup (Bill's words).
Discuss the plan + open questions with Bill, get his go, then implement.

Date: 2026-05-30 (Session 117 planning)
Commit baseline: `b667ea6` (origin/main, in sync)

---

## The task — Member Composites (composite_type `M`) as the authoritative contract for member molecule fields

Make `M` composites do for **member tenant-specific molecule fields** exactly
what `A` composites do for **activity fields**: the composite is the authority;
the member input template (`activity_type='M'`) becomes **layout-only** and may
only reference fields that exist in the tenant's `M` composite.

Confirmed facts:
- Delta (tenant 1) active member template includes **PASSPORT**.
- Insight (wi_php, tenant 5) active member template includes **LICENSING_BOARD**.
- No real `M` composite exists for either tenant yet. Delta has A/J/P; Insight has A only.

---

## Investigation findings (grounded — read this before planning)

1. **No schema change needed for the type itself.** `composite.composite_type`
   is `CHAR(1)` with **no CHECK constraint**, and there's already a
   `UNIQUE (tenant_id, composite_type)` — so each tenant gets exactly one `M`
   row, and `'M'` is accepted as-is. The cache + admin endpoints are
   **type-agnostic** (keyed by `${tenant_id}:${composite_type}`), so `M` rides
   the existing rails:
   - cache load: `loadCaches` composite block ~pointers.js:2295-2333
   - `getCachedComposite(tenantId, type)` ~2789; `loadCompositeToCache` ~4504
   - admin endpoints: GET all ~4326, POST ~4350, PUT ~4413 (all generic over type)
2. **The structural hook already exists:** `input_template_field.composite_link`
   is a FK to `composite_detail.link`. So "template field must be in the M
   composite" is meant to be enforced by that FK. **Open question:** do member
   templates currently populate `composite_link`, or just `molecule_id`? Verify
   in the member-template save path (~pointers.js:6780-6920, the
   `activity_type='M'` template) — if they store only `molecule_id`, part of the
   work is wiring them to reference `composite_detail`.
3. **Pattern to mirror (A → M):** `createAccrualActivity` (~pointers.js:15616)
   does `const composite = getCachedComposite(tenantId, 'A')`, throws if missing,
   then iterates `composite.details` (authorized molecules, in sort_order) to
   encode. Member enroll/update should do the same with `'M'`.
4. **Member flows to touch:**
   - Enroll: `POST` create member ~pointers.js:6971 (membership reserve ~6932).
   - Member field template read/save: ~6780-6920 (`activity_type='M'`,
     `attaches_to='M'` molecule rows).
   - Insight licensing-board still has a bespoke `PUT /v1/members/:id/licensing-board`
     ~25813 — verify it routes through the molecule/M path (v75 moved it there).
5. **The 4 tenant-scoping weaknesses (confirmed real):** all fetch/update
   templates by `template_id` alone, **no `tenant_id` filter** — a tenant can
   read or overwrite another tenant's template by id:
   - L16543 `GET /v1/display-templates/:id` — `WHERE template_id = $1`
   - L16722 `PUT /v1/display-templates/:id`
   - L17031 `GET /v1/input-templates/:id` — `WHERE template_id = $1`
   - L17149 `PUT /v1/input-templates/:id` — `WHERE template_id = $3` + deletes
     `input_template_field` by template_id, unscoped
   Fix: add `AND tenant_id = <req tenant>`. **Decide:** superuser cross-tenant
   admin — do these need to allow a superuser to edit any tenant's template?
   Check current admin usage before hard-scoping to `req.tenantId`.
6. **LANDMINE — `'M'` is overloaded.** Some code comments call `activity_type='M'`
   "promotion reward activities" (~5958, ~6040) while the member template uses
   `activity_type='M'` for member fields (~6780). A past session (v62→v63)
   already misread 'M' as "Promotion" and **dropped** the member template; v75
   restored it. Do not repeat. (Note: composite_type `M` and input_template
   activity_type `M` are different columns; the letter alignment is intentional.)

---

## Proposed plan (phased — confirm with Bill first)

1. **Seed the M composites** via a new `db_migrate.js` migration (DATA → must go
   through migrations): INSERT `composite (tenant, 'M', ...)` + `composite_detail`
   for Delta {PASSPORT} and Insight {LICENSING_BOARD}, both `is_required=false`
   (per decision 3), resolving `molecule_id` by `molecule_def` key per tenant
   (NOT hardcoded ids — they differ across envs), idempotent
   (`ON CONFLICT DO NOTHING`). Bump `TARGET_VERSION` 78→79 and
   `EXPECTED_DB_VERSION` to match.
2. **Backend M support:** confirm cache/admin endpoints handle `M` (they should,
   being type-agnostic); add any `M`-specific load path if member composites need
   different columns.
3. **Composite admin UI:** add `M` as a selectable composite type (find the
   composite admin page; the type dropdown likely hardcodes A/J/P).
4. **Template = subset of M:** on member-template save (PUT input-templates),
   reject any field whose molecule is not in the tenant's `M` composite (enforce
   via `composite_link`/`composite_detail`).
5. **Enroll validation:** member enroll validates tenant-specific molecule fields
   against the M composite — required fields present, no unauthorized fields.
6. **Update validation:** member update saves only M-composite-authorized
   molecule fields.
7. **Keep base profile fields separate** (name/email/phone/etc. on the member
   table) — M governs only tenant-specific MOLECULE fields (PASSPORT,
   LICENSING_BOARD). Bill confirmed: don't unify without strong reason.
8. **Fix the 4 endpoints' tenant scoping** — hard-scope to `req.tenantId` (decision 2).

---

## Decisions (Bill, Session 117 — LOCKED)

1. **Validation is a hard reject** on enroll AND update — not a warning.
2. **Strictly per tenant.** Hard-scope all 4 template endpoints to the session
   tenant (`req.tenantId`). That's the whole point — Delta's M composite has
   PASSPORT, Insight's has LICENSING_BOARD; a tenant must never touch another's.
   A superuser still administers each tenant by **switching into** it (which sets
   `req.tenantId`), NOT by passing arbitrary template ids. Implementer: confirm
   the tenant-switch sets `req.tenantId` so superuser admin still works after the
   scoping is tightened.
3. **PASSPORT / LICENSING_BOARD are NOT required** — seed them `is_required = false`.
   Composites support per-field required/optional via `composite_detail.is_required`;
   enroll/update must honor that flag. Tests 1 & 2 verify the enforcement logic
   (a test can mark any field required to exercise it).

---

## Tests required (Bill's list — all must pass)

1. M composite required-field validation on member **enroll**.
2. M composite required-field validation on member **update**.
3. Template save **rejected** if it references a member field not in M composite.
4. Delta **PASSPORT** path end-to-end.
5. Insight **LICENSING_BOARD** path end-to-end.
6. **Browser/UI** test on the CSR member page (`csr_member.html`) for
   tenant-specific member fields.

## Verification gate (before saying done)

Server boots clean (start with `bash bootstrap/start.sh`), `node
tests/lint-anti-patterns.cjs` = 0, full suite green **plus the 6 new tests**,
Delta + Insight member flows verified end-to-end, browser test passes. Then
update STATE.md / build notes. **No push to GitHub or Heroku without Bill's go.**

## Risks / traps

- Don't conflate composite_type `M` with the historical `'M'`=promotion misread.
- Seed migration resolves molecule_ids by key, not hardcoded id; idempotent.
- Don't unify base profile fields with molecule fields.
- This is a contract change — the A-composite activity path must keep working
  unchanged (regression-check the accrual tests).

---

## Next-Chat Prompt

> Read START_HERE.md (line 1), then implement Member Composites (composite_type
> `M`) per the plan in ACTIVE_WORK.md. M composites become the authoritative
> contract for tenant-specific member molecule fields (the same role A composites
> play for activities); member input templates (`activity_type='M'`) become
> layout-only and may only reference fields in the M composite. Confirm the 3
> open questions in ACTIVE_WORK.md with Bill before coding. Includes the 4
> template tenant-scoping fixes (pointers.js 16543/16722/17031/17149) and the 6
> listed tests. Discuss the plan, get Bill's go, then implement. Do not push to
> GitHub or Heroku without approval.
