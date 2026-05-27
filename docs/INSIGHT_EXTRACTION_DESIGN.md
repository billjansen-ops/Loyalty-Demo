# Insight Server Extraction — Design

**Goal:** Move all healthcare-specific server code out of `pointers.js` and
into `verticals/workforce_monitoring/server/`. After the extraction,
deleting that directory leaves Delta, United, Marriott, and Ferrari
working; a new vertical (e.g. `airline/`) can be added without editing
`pointers.js`.

Status: **DRAFT — awaiting Bill's go.** Decisions below are recommendations,
not commitments. Push back on anything before we start.

Revision history: v2 (folds in Bill's feedback on tenant targeting,
fail-closed behavior, helper naming, non-route inventory, and the no-lib
rule).

---

## What moves, what stays

**Stays in `pointers.js`:** server bootstrap, DB connection, version
checks, all generic platform routes (auth, member, activity, bonus,
promotion, redemption, tier), shared helpers (date, link, molecule,
audit-via-SQL), the vertical-loader code, the molecule readiness boot
check (which now consumes vertical declarations).

**Moves into `verticals/workforce_monitoring/server/`:** ~28 endpoints
across compliance, MEDS, PPSI scoring, PPII composite/history, registry
queries, clinician assignment, follow-up scheduling. Plus the two
platform-side imports of `scorePPII.js` and `protocolCards.js` — those
become internal to the vertical. Plus any non-route Insight code
surfaced by the Phase 1 inventory (scheduled jobs, file-serving
fallbacks, conditional branches, vertical-only helpers).

---

## Decision 1 — Loading model: static registration at boot

Vertical modules are loaded **statically at server boot**, before
`app.listen()`. Each vertical exports a `registerRoutes(app, ctx)`
function; `pointers.js` calls it for every enabled vertical during the
startup block.

Rejected: lazy-import on first hit (adds complexity, hides errors
until runtime), dynamic discovery (too magical for a small set of
verticals).

---

## Decision 2 — Enabled verticals via env var, with fail-closed routing

`pointers.js` reads `process.env.VERTICALS_ENABLED` (default
`"workforce_monitoring"`) and registers each listed vertical. Empty
string means "platform only."

**Fail-closed rule.** This is the rule that prevents the
disabled-vertical-but-active-tenant footgun:

- Auth middleware reads the user's `vertical_key` (already on the JWT
  / session — see `pointers.js:25032`).
- If `vertical_key` is set and is **not** in the loaded set, the
  response is an explicit refusal (HTTP 503 with body
  `{ error: "Vertical '<key>' not loaded in this environment" }`).
- The check fires **once at auth**, not per-route — so a wi_php user
  attempting any endpoint with workforce_monitoring unloaded gets a
  single clean rejection, not a half-load and 404 later.
- Platform-only tenants (no `vertical_key`, e.g. Delta) are unaffected.

This is how we test "Delta works without WI_PHP" — start the server
with `VERTICALS_ENABLED=`, run Delta smoke tests (they pass), and a
wi_php login attempt returns the explicit 503.

---

## Decision 3 — What a vertical exports

`verticals/workforce_monitoring/server/index.js` exports:

- `verticalKey` — string identifier matching `tenant.vertical_key`
  (e.g. `'workforce_monitoring'`). Used by the platform to match
  tenants to verticals via the existing `tenantVerticals` cache. **Not
  tenant IDs** — IDs are a sequence-divergence risk between local and
  Heroku.
- `registerRoutes(app, ctx)` — adds Express handlers for the vertical's
  endpoints. Required.
- `requiredMolecules` — array of objects in the same shape as
  `FEATURE_CONDITIONAL_MOLECULES` in pointers.js today. The platform's
  boot-check loop unions these with the platform-level entries, scoped
  to tenants whose `tenant.vertical_key` matches this vertical.
- `boot(ctx)` — optional one-time setup (cron schedules, cache warm,
  etc.). Called once after route registration.

Vertical applicability at runtime: the platform does **not** need the
vertical to declare its tenants. It already knows from
`caches.tenantVerticals` (`pointers.js:1868`) which tenants map to
which vertical. The vertical only declares its own `verticalKey`; the
platform handles the lookup.

---

## Decision 4 — Shared dependencies via a passed `ctx` object

Verticals do **not** import from `pointers.js` (circular). They receive
a `ctx` object at registration time. Real helper names below — grepped
from the current pointers.js, not invented:

```
ctx = {
  dbClient,                                // pg pool
  caches,                                  // platform caches (tenantKeys, tenantVerticals, molecule defs, etc.)

  // Link allocator
  getNextLink,                             // (tenantId, tableKey, client) → link string

  // Date helpers (top-level functions in pointers.js)
  dates: {
    dateToMoleculeInt,
    moleculeIntToDate,
    platformToday,
    platformTodayStr,
  },

  // Molecule helpers — grouped for clarity
  molecules: {
    getMolecule,                           // (key, tenantId, category)
    getMoleculeId,                         // (tenantId, key)
    getMoleculeValue,                      // (tenantId, key, context, date, params)
    getMoleculeStorageInfo,                // (tenantId, key, columnOrder)
    getMoleculeRows,                       // (pLink, key, tenantId)
    getMoleculeGroups,
    getMoleculeGroup,
    getMoleculeGroupsByTenant,
    setMoleculeGroupMembers,
  },

  log: { debugLog },
}
```

**Honest gap:** there is no unified `writeAudit` helper in pointers.js
today. Audit writes happen via raw SQL in different places. Phase 3
(first endpoint move) will surface what audit shapes Insight endpoints
actually write and decide whether to introduce a shared helper.
Until then, verticals do their own audit SQL — same as pointers.js
does today.

---

## Decision 5 — URL space stays the same

Vertical routes register at their **current paths** (`/v1/compliance/...`,
`/v1/ppsi-history`, etc.). No prefix change. Renaming URLs is a separate
question and would break existing UI clients — out of scope for the
extraction.

---

## Decision 6 — Boot check unions platform + vertical declarations

The Session 125 hard-stop check already validates molecules per tenant.
After the extraction, the check loops over `PLATFORM_REQUIRED_MOLECULES`
plus the `requiredMolecules` arrays from each loaded vertical, with
each vertical's checks scoped to tenants whose `vertical_key` matches.
If a tenant has wi_php data but the workforce_monitoring vertical isn't
loaded, the check **does not run** for that tenant — the fail-closed
auth rejection (Decision 2) handles that case instead.

---

## Decision 7 — No `lib/` extraction during phases 1–6

If during a phase the `ctx` approach feels awkward, document the
friction in the phase commit and **continue with `ctx`**. Helper
extraction to a `lib/` directory is a separate refactor for after
phase 6. Promoted from a risk warning to a rule because risks get
rationalized; rules don't.

---

## Phasing — six phases, in this order

Each phase ends green: lint count drops by N, all tests pass, server
boots clean, committed and pushed. **Do not start the next phase if
the previous one isn't green.**

| # | Phase | Verifiable outcome |
|---|---|---|
| 1 | **Scaffolding + inventory.** Create the vertical module with empty `registerRoutes` and `verticalKey: 'workforce_monitoring'`. Modify `pointers.js` to load verticals from env. **Plus: produce `docs/INSIGHT_TOUCH_POINTS.md`** — a comprehensive list of every Insight-specific touch point in pointers.js (not just routes): scheduled jobs, cron handlers, file-serving fallbacks, conditional branches on `tenant_id` / `tenant_key` / `vertical_key`, imports of vertical files, FEATURE_CONDITIONAL_MOLECULES entries, helper functions used only by Insight code. Subsequent phases work from this inventory. | Server boots; all tests pass; lint count unchanged at 28; inventory doc exists and is reviewed by Bill. |
| 2 | **Move molecule readiness contract.** Insight-specific `FEATURE_CONDITIONAL_MOLECULES` entries move to the vertical's `requiredMolecules`. Wire the fail-closed auth check from Decision 2. | Boot check still fires correctly when a tenant is short a molecule. Disabling workforce_monitoring → wi_php login returns the 503 from Decision 2. |
| 3 | **Move compliance endpoints** (~6). First real endpoint move. Surfaces the audit-helper question from Decision 4. | Insight compliance UI works; tests pass; lint drops by ~6. |
| 4 | **Move MEDS endpoints** (~4). | Tests pass; lint drops by ~4. |
| 5 | **Move PPSI / PPII endpoints** (~8). Plus the `scorePPII.js` import — it moves out of pointers.js, becomes internal to the vertical. | Tests pass; lint drops by ~8. |
| 6 | **Move registry / clinician / follow-up endpoints** (~10). Plus the `protocolCards.js` import. Final cleanup. | Lint count = 0; Delta smoke tests pass with `VERTICALS_ENABLED=`; wi_php auth correctly fails-closed; flip lint from report-only to fail-on-match in `tests/run.cjs`. |

Total: 6 sessions if each phase goes smoothly. Realistic: 8 if a phase
splits or a hidden coupling appears.

---

## Risks — where I'm most likely to go sideways

These are the patterns past sessions have failed on, applied to this
work. If you see me doing any of these, stop me.

1. **"While I'm in there" scope creep.** Each phase moves ONE domain.
   Compliance phase does not also touch MEDS. Even if it'd be "easier
   to do both at once," it isn't — it's how silent breakage gets
   bundled.
2. **Hidden couplings.** A "compliance" endpoint might quietly call a
   PPSI helper. Phase 1's inventory should catch most of these; the
   rest will surface mid-phase. Mitigation: grep for cross-domain
   calls at the start of each phase and surface them in the phase
   commit message.
3. **Faking the success criterion.** The acceptance test is "boot with
   `VERTICALS_ENABLED=` and Delta smoke tests pass + wi_php login is
   refused with the 503 from Decision 2." If I'm tempted to say "well,
   it boots and the homepage renders" instead of running the tests —
   that's the failure pattern.

(The fourth risk in the prior draft — inventing a new shared-helpers
path mid-extraction — is now Decision 7, a rule rather than a warning.)

---

## What this design does NOT solve

- It doesn't move the Insight UI pages (already in
  `verticals/workforce_monitoring/`).
- It doesn't extract Delta-specific code from `pointers.js` (because
  none of it is Delta-specific the way Insight code is — Delta uses the
  generic platform). If we later add Delta-specific behavior, the same
  vertical-loader pattern is available.
- It doesn't address Insight scheduled jobs in isolation; if any
  exist they're surfaced by Phase 1's inventory and moved with the
  appropriate domain phase.
- It doesn't change the URL space, the database schema, or any
  client-facing behavior. Pure server-side reorganization.
- It doesn't introduce a `lib/` directory or extract shared helpers
  (Decision 7).

---

## Acceptance — done when

The lint is the gate; the grep is a heuristic.

- **Gate:** `node tests/lint-anti-patterns.cjs` reports **zero
  matches**.
- **Heuristic:** `grep -iE "ppii|ppsi|meds|physician|clinician|licensing"
  pointers.js` returns hits only on lines that are genuinely about
  something else (a comment, a generic auth path that names a vertical
  key). Each remaining hit has a `// lint-allow` comment if needed.
- Server boots with `VERTICALS_ENABLED=workforce_monitoring` and
  Insight works end-to-end (existing Insight tests pass).
- Server boots with `VERTICALS_ENABLED=` and Delta smoke tests pass
  (Delta tests are a prerequisite — built in the prior work block,
  before phase 1 of this design starts).
- A wi_php user attempting to log in with workforce_monitoring
  unloaded is rejected cleanly with the 503 from Decision 2 —
  not a 404, not a crash, not a half-render.
- Lint is flipped from report-only to fail-on-match in `tests/run.cjs`.
- Full test suite passes (Delta + Insight + Core).
