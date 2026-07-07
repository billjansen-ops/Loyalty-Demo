# Molecule → Composite Auto-Wiring — Design Note

**Status:** designed, not built. Author: Session 133 (2026-07-05), with Bill.
**Goal:** when a new molecule is created, wire it into the right composite(s) as
part of the *same* creation call — so a stored member/activity field is usable the
moment it exists, instead of relying on a separate, easily-forgotten step.

---

## The problem this fixes

A stored (`type = D`) molecule is only usable once it's in the composite:

- **Member:** `PUT /v1/member/:id/molecules` validates against the tenant's **M
  composite**. A member molecule not in it is rejected on save.
- **Activity:** since the Session 132 composite-closure work, an accrual **rejects
  any field that isn't in that activity type's composite**. A molecule not in the
  type's composite can't even be sent.

Today the composite rows are a **separate manual step** after the molecule is
created — `createMoleculeComplete` builds the definition, lookup rows, values, and
storage table, but does **not** touch the composite. Every migration that adds a
real field hand-writes the composite INSERT (v85 REFERRAL_SOURCE, v99 EVALUATOR).
Forgetting it is the documented silent-failure trap: the molecule exists but is
unusable, with no error.

## What we are NOT doing (Bill's decisions)

- **No input-template auto-add.** Placing a field on a form is an admin's layout
  choice, made later on the maintenance page if desired. Auto-wiring stops at the
  composite. (A field in the composite but not the template is a *coherent*
  state — saveable and rules-usable, just not shown on the profile until an admin
  places it. That is intentional, not the trap.)
- **No auto-wiring for Reference (`R`) or Flag molecules.** They store nothing; the
  composite is about stored record structure. Auto-wiring is `type = D` only.

## The shape

### Member molecule (one composite, unambiguous)
- One **Required** tick (default **off**).
- On create: add one `composite_detail` row to the tenant's **M composite** with
  `is_required` = that tick.

### Activity molecule (per-type — a molecule can apply to some types, not others)
Activity composites are **per activity type** (flight/accrual `A`, partner `P`,
redemption `R`, adjustment `J`, promotion `M`…), each its own composite with its own
`composite_detail.is_required`. So "mandatory on a base accrual, optional on a
partner accrual" is just two rows, each carrying its own flag — the schema already
supports it; nothing new underneath.

Maintenance UI = a small grid, one line per activity type the tenant has a composite
for:

| Activity type | Applies? | Required? |
|---|---|---|
| Accrual (A) | ☑ | ☐ |
| Partner (P) | ☑ | ☑ |
| Redemption (R) | ☐ | — |

- **Applies?** → add a `composite_detail` row to that type's composite (which also
  *permits* the field on that accrual type, per composite-closure).
- **Required?** → `is_required` on that row. Only meaningful when Applies is on.
- Defaults: nothing ticked (creator picks the types); Required off wherever Applies
  is on. Optional is the safe default — an accidentally-required field blocks record
  saves.

## The "one routine, two callers" mechanism

Bill's requirement: the db-migration path and the online maintenance page call the
**same code with the same parameters**. Today that's not possible —
`createMoleculeComplete` is an inner function of `pointers.js` bound to server
internals (`dbClient`, `loadCaches`, `ensureStorageTable`, …), and `db_migrate.js`
imports only `pg` + `getNextLink`.

**We do NOT extract the whole hardened routine** (it's the load-bearing S131
creation path; full extraction is risky surgery with many server-internal deps).
Instead we extract only the composite-wiring, which is self-contained:

**New shared module — `molecule_composites.js`:**

```
wireMoleculeToComposites(client, tenantId, moleculeId, spec) → { added: [...] }
```

- Pure SQL + `getNextLink(client, tenantId, 'composite_detail')` — **no server
  internals**, so it runs identically inside pointers.js's transaction and inside a
  migration's transaction (both already hold a `client`).
- Idempotent: skip a `composite_detail` row that already exists for
  `(composite, molecule_id)` (re-runnable, like every migration).
- Skips silently + returns a warning if a target composite doesn't exist for the
  tenant (mirrors today's `⚠️ composite not found` guard).

**Both callers pass the same spec fields:**

```
spec.member_composite   : { required: bool }              // member molecules
spec.activity_composites : [ { activity_type, required } ] // activity molecules
```

- **Online page** → `POST /v1/molecules/complete` → `createMoleculeComplete` calls
  `wireMoleculeToComposites(client, …)` inside its existing transaction, after the
  storage table + definition are created and before the round-trip proof.
- **Migrations** → `import { wireMoleculeToComposites }` and call it directly with
  the migration's `client`, replacing the hand-written composite INSERT blocks.

The routine only wires when the molecule is `type = D` and the relevant spec field
is present; absent field = no composite change (backward-compatible — existing
callers that don't pass these keep behaving exactly as today).

## Verification (part of the build, not after)

- Extend `core/test_molecule_create.cjs`: create a member `D` molecule with
  `member_composite.required=false` → assert the M `composite_detail` row exists and
  a `PUT /molecules` save succeeds; create an activity molecule applying to two types
  with different `required` → assert two rows with the right per-type flags, and a
  bare accrual on the required-type is rejected while the optional-type is accepted.
- The from-scratch CI migration replay re-proves the shared routine against every
  historical call — the same guard the S131 decision relies on.
- Browser walk the maintenance-page grid (Applies/Required per type) before Bill
  sees it.

## Migration hygiene

- New shared module, no schema change → **no new db_migrate version** required for
  the mechanism itself. (Any future *molecule* a migration adds still bumps the
  version as usual; this just changes *how* that migration writes its composite rows.)
- Do **not** rewrite already-applied migrations (append-only rule). The shared
  routine is adopted by *new* migrations; the historical hand-written composite
  blocks stay as they are.

## Open choice for the build session

- Whether to also **back-fill** the maintenance page's activity grid from a tenant's
  existing activity composites (so the ticks reflect current membership when editing
  an existing molecule). Recommended, but a page-only follow-on — the wiring routine
  and the create path don't depend on it.
