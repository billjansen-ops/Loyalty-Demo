# Access Control (Role Enforcement) — Design

**Status: DESIGNED, NOT BUILT.** Recorded Session 132 (2026-07-04) from the design
conversation with Bill. Build waits until something needs it (see "When to build").
This is NOT the RLS database lock — that was built and deliberately removed in
Session 123 and stays dead (`docs/RLS_BACKSTOP_DESIGN.md`, the do-not-resume note
in `ACTIVE_WORK.md`).

---

## The model (Bill's formulation — this is the spec)

> There are users, and user groups. Permissions can be assigned to users, or user
> groups. A user can be in 0-n user groups. And on secure things — there is a
> yes/no: can this user access this.

That's the whole model. The classic one. Everything below is just mapping it onto
what the platform already has.

## Mapping onto the platform

| Model piece | Platform reality |
|---|---|
| User | `platform_user` login |
| User group | A user-molecule value — positions are the first kind. A login holding `POSITIONCLINIC:CASEMAN` at a clinic IS membership in the "case managers" group. Already 0-n per user (multi-row molecule), already built (Sessions 128–129). |
| Group naming | `'MOLECULEKEY:CODE'` — the notation notification routing already uses (`recipient_role = 'POSITIONCLINIC:CASEMAN'`). One notation, two consumers. |
| Permission | A row: tenant + action code + grantee (a user, or a group name). Rows, not code. |
| The yes/no | One helper: `can(userId, actionCode)` → boolean. Every secured thing asks this one question. |

**Access tiers stay.** superuser/admin/csr remain the platform floor (they gate the
admin machinery, Session 121). This layer sits on top for *domain* actions —
clinical/workflow permissions. Superusers (system accounts) always pass.

## Rules that keep it simple

1. **Additive-only.** Permissions only grant. Absence denies. NO deny rows, no
   precedence, no inheritance. The answer is: union of the user's direct grants and
   all their groups' grants — is the action in the set?
2. **One checker.** A single server-side helper answers `can()`. No hand-rolled
   per-endpoint role checks — scattered ad-hoc checks are how the pre-S121
   tenant-isolation holes happened. Endpoints call the helper; that's the truth.
3. **Doors AND deeds.** `bouncer.js` (every clinical page already calls it; today
   "everyone gets in") flips to its existing Phase-2 hook — `/v1/access/check` —
   for friendly page-level denial. The server-side helper on endpoints is the
   actual security. The bouncer is UX; the endpoint check is the lock.
4. **Optional scope, later.** A grant may eventually carry a clinic scope ("case
   managers may X *at their own clinic*"). The core stays a plain yes/no; scope is
   an enrichment added when a real case needs it, not before.
5. **Per-tenant switch, default OFF.** Enforcement is a sysparm knob per tenant.
   Off = today's behavior exactly (everyone gets in). Nobody on the live site holds
   a position yet, so ON is impossible until a tenant's staff are positioned.
   Delta/hotel/etc. feel nothing unless they opt in.
6. **Ungated = open.** An action nobody has secured behaves like today. Security
   accretes one gate at a time (see below), forever, as data.

## Sketch (not final DDL — the build session decides details through db_migrate)

```
permission_grant (
  grant_id      SERIAL PK,
  tenant_id     SMALLINT,
  action_code   VARCHAR(40),     -- e.g. 'INSTRUMENT_ASSIGN', 'REGISTRY_RESOLVE_SENTINEL'
  grantee_type  CHAR(1),         -- 'U' user | 'G' group
  grantee       VARCHAR(60),     -- user link, or 'MOLECULEKEY:CODE'
  scope         VARCHAR(40) NULL -- future: clinic scope; NULL = anywhere
)
```

`can(userId, actionCode)`:
1. superuser → yes. 2. tenant enforcement switch off → yes. 3. any 'U' grant for
this user + action → yes. 4. resolve the user's groups (their user-molecule values,
borrow-aware — same resolution `findUsersByMoleculeValue` does in reverse) → any
'G' grant matching → yes. 5. otherwise no.

Cache like everything else (invalidate on grant writes); the check must be
cheap enough to run on every request.

## How it evolves (the agreed sequencing)

**Kernel first (~one session):** the table, the helper, the bouncer wiring, the
tenant switch, an admin surface for grants, tests. No actions gated yet — zero
behavior change anywhere.

**Then one gate at a time, as needed** — each is one helper call in the endpoint
plus grant rows:
1. `INSTRUMENT_ASSIGN` — the parked "who may assign instruments" decision (S131).
2. Sentinel/registry resolution — the medical-director distinction.
3. Chart export — PHI leaves the system; gate it before real PHI lands.
4. Portal/observer actions — when the WisconsinPATH consent model unblocks them.

## Open questions (carried, not blocking the kernel)

- **The permission map itself** — which positions may do what is PROGRAM POLICY:
  Erica's call, shipped as default config rows she can change (same
  plumbing-vs-valves pattern as routing and follow-up schedules).
- **Clinic scoping semantics** — enforce position-at-clinic boundaries? Real
  workflow consequences; decide with Erica when the first scoped case appears.
- **Unpositioned users when enforcement is ON** — deny (strict) is the default
  assumption; revisit at kernel build.
- **Denial UX** — hide controls vs explain "this needs a Medical Director." Lean:
  show + explain (staff learn the rules), hide only where clutter hurts.

## When to build

Not now (decided Session 132): nothing burns without it, enforcement can't turn on
until Erica assigns positions, and the map wants her protocol answers. Build the
kernel when the first real gate is needed — likely alongside her instrument-protocol
answers or the portal work.
