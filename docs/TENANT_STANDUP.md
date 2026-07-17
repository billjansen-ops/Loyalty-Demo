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
  v116, the module's inline ancestor) also verifies complete.

## History

wa_php (v116, Session 144) was stood up by this same logic written inline,
before the module existed. v116 stays frozen — migrations are append-only —
and every tenant after it goes through `tenant_standup.js`.
