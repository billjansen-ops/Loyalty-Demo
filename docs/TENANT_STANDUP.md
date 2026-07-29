# Standing up a new tenant

The one process for creating a new program (state). Session 145; Bill's
requirement: reusable helpers plus a written list of required parts.

## The one door

**`tenant_standup.js`** (project root) — same shared-module pattern as
`get_next_link.js`; imported by migrations.

- **`REQUIRED_PARTS`** — the manifest. Every per-tenant configuration part
  the platform carries, in one list. **Adding a new per-tenant config table
  to the platform? Add it to the manifest** — the copier's final check and
  the verifier both read it, so a stand-up that misses the new part fails
  loudly instead of shipping an incomplete tenant.
- **`copyTenantConfig(client, opts)`** — stands up a new tenant as a full
  configuration copy of a source tenant. No people, no member data, no
  logins. State-specific content is supplied, never copied: branding,
  delivery timezone, licensing boards. Refuses if the target exists.
  Verifies itself against the manifest before returning — an incomplete
  copy throws and rolls back with the migration transaction.
- **`verifyTenantSetup(client, targetKey, sourceKey)`** — the completeness
  report: for every manifest part, source count vs target count. Run it any
  time a tenant's setup is in doubt.

## The process for the next state (e.g. Ohio)

One migration, shaped like this:

```js
import { copyTenantConfig } from './tenant_standup.js';
// inside the migration's run(client):
await copyTenantConfig(client, {
  sourceKey: 'wi_php',            // or wa_php — whichever is the better template
  targetKey: 'oh_php',
  name: 'Ohio PHP',
  branding: [['text','company_name','Ohio PHP',1], ['color','primary','#7f1d1d',2]],
  timezone: 'America/New_York',
  licensingBoards: [['SMB','State Medical Board of Ohio','Physician'], /* … */],
});
```

## What comes across, and what deliberately does not

The manifest is the authority (`REQUIRED_PARTS` in `tenant_standup.js`) — this is the
orientation. **Configuration** copies: molecules, composites, templates, point types,
surveys, compliance items, signals, external actions, active bonuses and promotions *with
their result rows*, notification rules, scheduled jobs, member group **definitions**, and
active **MEDs** with their results.

**People and history never copy** — no members, activities, logins, group memberships
(`member_group_member`), or MED episodes (`med_identification`). A new tenant is a
configured, empty program.

Three things the copier does that are easy to get wrong if you ever hand-roll a stand-up:

- **Every copied rule is a NEW rule.** Bonuses, promotions, MEDs, and group criteria each
  get their own `rule` + `rule_criteria`. Sharing one with the source tenant would mean
  editing the new state's criteria silently changed the old state's.
- **Pointers are remapped, not carried.** Point types, external actions, and group links
  are translated to the new tenant's ids. An unmappable group pointer throws rather than
  writing a cross-tenant reference.
- **Promotion chains refuse.** An `enroll` result (qualify one promotion, enroll in
  another) cannot be auto-remapped and fails loudly; wire chains deliberately after the
  copy. None exist today.

⚠️ **Session 159 note:** `promotion_result` rows were never copied until then, and
`result_group_link` was dropped. A tenant stood up before that inherited promotions whose
results were missing — survivable only because the legacy `promotion.reward_type` fallback
happened to be set too. **wa_php's REG_REVIEW is exactly that artifact** and is on the
Washington kickoff checklist to convert. If you find a promotion running on the legacy
column, this is why.

Then, per-state, outside the migration:
1. **Logins** — created on each environment (never migrated; ids and
   passwords differ per environment). Multi-program grants
   (`platform_user_tenant`) are superuser actions through
   `POST /v1/users/:id/tenants`.
2. **Kickoff configuration** — the copied defaults (weights, thresholds,
   cadences, alert rules) are the starting point; per-state tuning is data
   edits through the admin pages, never code.

## What the platform already enforces

- **Boot gate** (`verifyTenantMolecules`, S135): every tenant's system
  molecules must match the reference shape — the server refuses to start
  on drift. This runs on every boot, every environment, forever.
- **The copier's self-check**: `copyTenantConfig` ends by running
  `verifyTenantSetup` and throws if any manifest part is missing.
- **Proof test**: `tests/core/test_tenant_standup_module.cjs` stands up a
  throwaway tenant through the module inside the test harness and checks
  the report, exact value_id preservation, and that wa_php (stood up by
  v116, the module's inline ancestor) also verifies complete. **It stands up a
  SECOND throwaway tenant from `delta`** (Session 159) because wi_php has no groups
  and no MEDs — a wi_php-only test never executes those paths, which is precisely
  how the missing `promotion_result` copy stayed hidden. If you add a part to the
  manifest, source it from a tenant that actually has one.

## History

wa_php (v116, Session 144) was stood up by this same logic written inline,
before the module existed. v116 stays frozen — migrations are append-only —
and every tenant after it goes through `tenant_standup.js`.
