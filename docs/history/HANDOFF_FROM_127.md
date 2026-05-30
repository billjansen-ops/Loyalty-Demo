# HANDOFF FROM SESSION 127

> Status: historical session handoff only.
>
> Do not use this as the current startup path. Start with `START_HERE.md`,
> then the canonical repo docs.

Read all of this before doing anything.

---

## READ FIRST (in order)

1. **`HANDOFF.md`** (repo root) — entry point.
2. **`STATE.md`** (repo root) — current deploy state + what's pending.
3. **`docs/BEFORE_YOU_WRITE.md`** — anti-patterns to avoid.
4. **`docs/INSIGHT_EXTRACTION_DESIGN.md`** — the refactor design doc.
   Phases 1, 2, 2.1 are now done; Phase 3 is your job.
5. **`docs/INSIGHT_TOUCH_POINTS.md`** — comprehensive inventory of
   what needs to move. **§7 was rewritten mid-session — read the
   current version, not the original Phase 1 claim that "no
   scheduled jobs to extract."**

Then `node tests/lint-anti-patterns.cjs` — baseline is **28 matches**.
Anything above means you added an anti-pattern.

---

## WHAT JUST SHIPPED IN SESSION 127

Six commits on `origin/main`. **None deployed to Heroku** — Heroku
is still at SERVER_VERSION 2026.05.27.0200 from Session 126. We will
deploy after the extraction is complete, not phase by phase.

In commit order:

- `ad92b73`, `0260a8c`, `4519b7e`, `e8be9a7`, `13610a7`, `7e9b800` —
  **5 Delta UI smoke tests** in `tests/delta/`. Catches:
  destructive-save reverts on bonus / promotion / molecule edit, the
  typeahead silent-failure on airport code entry, and the CSR
  green-block grouping regression. The fifth test self-provisions
  its MIDDLESEAT external bonus_result because CI's baseline DB
  doesn't have one — pattern worth knowing if other tests need
  similar data setup.

- `e48e1e7` — Codex's survey-page cleanup (admin_survey_edit.html +
  admin_surveys.html). Removed healthcare-specific defaults; uses
  the existing `/v1/tenants/:id/labels` endpoint for tenant
  overrides. **Not my work; Codex did it during a 1-task evaluation
  Bill ran.** Verified clean; lint dropped 32 → 28 because of this.

- `d9d83c5` — Handoff documentation suite (HANDOFF.md, STATE.md,
  WORKFLOWS.md, docs/BEFORE_YOU_WRITE.md,
  docs/INSIGHT_EXTRACTION_DESIGN.md). Copied BEFORE_YOU_WRITE from
  Bill's user-memory dir into the repo so it survives a tool
  switch.

- `7a50a20` — **Phase 1: scaffolding + inventory.** Created
  `verticals/workforce_monitoring/server/index.js` (empty exports)
  and a vertical-loader block in pointers.js that reads
  `process.env.VERTICALS_ENABLED` and dynamically imports each
  vertical via a computed path (lint scanner can't see the literal
  string). Plus `docs/INSIGHT_TOUCH_POINTS.md` — comprehensive
  inventory.

- `e4aec80` — **Phase 2: framework wiring.** Added Layer 3 to
  `verifyTenantMolecules` for vertical-required molecules (empty
  today, framework in place). Added fail-closed auth middleware
  (Design Decision 2) — if a user's `vertical_key` isn't in the
  loaded set, 503 with `code: VERTICAL_NOT_LOADED`.

- `36ac6a6` — **Phase 2.1: scheduled job handlers gap.** Bill caught
  a Phase 1 miss via his other session: `registerJobHandler()` is
  the actual pattern for scheduled jobs, not `setInterval`/`cron`.
  Four Insight handlers to move (MEDS → Phase 4,
  RANDOM_DRUG_TEST + DRUG_TEST_MISSED → Phase 3, F1_T5 → Phase 6).
  Two stay platform (NOTIFY_DELIVER, NOTIFY_DIGEST). Three fixes:
  (a) inventory doc §7 rewritten with the 4 movers; (b)
  `ctx.registerJobHandler` exposed so verticals can register from
  `boot(ctx)`; (c) `vertical.boot(ctx)` now actually fires —
  moved into the `dbClient.query.then` chain. Also moved the
  scheduler startup (`runDueScheduledJobs` + `startJobScheduler`)
  into the same chain to fix a latent race (scheduler was starting
  in the `app.listen` callback while caches loaded in parallel).

All six commits **CI green**.

---

## STATE RIGHT NOW

| Thing | Value |
|---|---|
| HEAD (origin/main) | `36ac6a6` |
| SERVER_VERSION | `2026.05.27.1600` |
| EXPECTED_DB_VERSION | 78 |
| Local DB | v78 |
| Heroku DB | **still v74** — Session 127 has NOT deployed |
| Heroku SERVER_VERSION | **still 2026.05.27.0200** |
| Tests | 46 passing, 904 assertions |
| Lint baseline | **28 matches** (down from 32 in Session 126) |

---

## YOUR JOB: PHASE 3 — COMPLIANCE

Per `docs/INSIGHT_EXTRACTION_DESIGN.md` and the inventory:

**Move 9 compliance endpoints + 2 job handlers** from `pointers.js`
into the vertical module. Verifiable outcome: Insight compliance UI
works end-to-end (the existing `tests/insight/test_compliance.cjs`
must stay green), full suite passes, lint count drops.

### Endpoints to move

(Line numbers as of commit `36ac6a6`. They will shift as you cut —
re-grep before each move.)

| Line | Method | URL |
|---|---|---|
| 27491 | GET | `/v1/compliance/member/:membershipNumber` |
| 27545 | GET | `/v1/compliance/member/:membershipNumber/history` |
| 27582 | POST | `/v1/compliance/entry` |
| 27686 | GET | `/v1/compliance/items` |
| 27702 | POST | `/v1/compliance/items` |
| 27718 | PUT | `/v1/compliance/items/:id` |
| 27743 | PUT | `/v1/compliance/member/:membershipNumber/cadence/:memberComplianceId` |
| 27768 | POST | `/v1/compliance/member/:membershipNumber/assign` |
| 27817 | DELETE | `/v1/compliance/member/:membershipNumber/assign/:complianceItemId` |

### Job handlers to move

| Line | Code |
|---|---|
| 30035 | `RANDOM_DRUG_TEST` |
| 30101 | `DRUG_TEST_MISSED` |

### Suggested file structure

Don't dump everything into `verticals/workforce_monitoring/server/index.js`.
Split:

```
verticals/workforce_monitoring/server/
  index.js          # imports + registerRoutes(app, ctx) + boot(ctx)
  compliance.js     # the 9 endpoints + 2 handlers
```

`index.js` calls `complianceModule.register(app, ctx)` from
`registerRoutes` and `complianceModule.registerJobs(ctx)` from
`boot`.

---

## KNOWN GOTCHAS FOR PHASE 3

### 1. The audit-helper question — decide before you start

I flagged this in inventory §9. The compliance endpoints write to
the audit trail via raw SQL (e.g. `POST /v1/compliance/entry`).
There's no unified `writeAudit` helper in `pointers.js` today.

Two options:
- **(a) Pass-through:** Vertical does its own audit SQL using
  `ctx.getDbClient()`. Simpler, mirrors how `pointers.js` does it
  today. Risk: each vertical reinvents audit shape.
- **(b) Shared helper:** Extract an `audit.write(...)` helper into
  `ctx`. Cleaner, but requires reading every audit SQL site to
  generalize correctly.

**My recommendation: (a)** for Phase 3 specifically. Document the
audit shape compliance uses; revisit (b) if Phase 4 (MEDS) or Phase 6
(registry) writes audit in materially different shapes.

### 2. Helpers the compliance code uses that aren't in `ctx` yet

You'll need at least these added to `buildVerticalCtx()` in
`pointers.js`:

- `resolveMember(membershipNumber, tenantId)` — used by 5 of the 9
  endpoints
- `formatDateLocal` — used for date display

Grep each endpoint body **before** the move and add every
non-ctx helper it uses. Don't get halfway through and discover
missing deps.

### 3. `POST /v1/compliance/entry` is the most complex endpoint

~100 lines. Creates a `compliance_result` row, then internally
posts an accrual activity carrying a `COMP_RESULT` molecule. The
accrual path is platform-side and STAYS — you're only moving the
compliance-result write + the internal HTTP fetch that fires the
accrual. Don't try to extract the accrual machinery; that's not
this phase.

### 4. The 2 job handlers depend on caches + helpers

`RANDOM_DRUG_TEST` and `DRUG_TEST_MISSED` use `dbClient` (now via
`ctx.getDbClient()`) and probably `caches.bonuses` or similar.
Read the bodies before the move and surface every dep through
`ctx`.

### 5. Register handlers from `boot(ctx)`, not `registerRoutes`

Routes register synchronously at module load via top-level await;
job handlers must register before the first scheduler tick. The
right place is the `boot(ctx)` hook, which fires after `loadCaches`
in the `dbClient.query.then` chain (Phase 2.1 wired this).

In the vertical's `index.js`:

```js
export async function boot(ctx) {
  ctx.registerJobHandler('RANDOM_DRUG_TEST', randomDrugTestHandler.bind(null, ctx));
  ctx.registerJobHandler('DRUG_TEST_MISSED', drugTestMissedHandler.bind(null, ctx));
  // Phase 4 will add MEDS; Phase 6 will add F1_T5.
}
```

---

## WHAT NOT TO DO

These are the failure patterns Session 113, 126, and the start of
127 burned hours on. Do not repeat them.

1. **DON'T scope-creep beyond compliance.** Phase 3 is *only* the
   9 compliance endpoints + 2 handlers + ctx helpers they need.
   Don't move MEDS endpoints "while you're in there." MEDS is Phase
   4. The phasing is the discipline.

2. **DON'T extract helpers to a new `lib/` directory.** Design
   Decision 7 is a hard rule. If `ctx` feels awkward, write down
   why and continue with `ctx`. Helper extraction is post-Phase 6.

3. **DON'T amend committed work.** New commits, not `--amend`.
   That's `feedback_no_git.md` enforced by HANDOFF.md.

4. **DON'T push to Heroku.** Origin/main only. Heroku push happens
   after Phase 6 completes, by Bill's authorization.

5. **DON'T claim something works without running it.** The Session
   126 lesson is brutal: every "verified" claim needs an actual
   run. After your changes:
   - `bash bootstrap/start.sh` — server boots clean
   - `node tests/lint-anti-patterns.cjs` — count drops (target
     after Phase 3: roughly 22, since compliance contributes ~6
     lint hits, mostly absent because compliance endpoints aren't
     heavily PPSI/PPII-flavored)
   - `node tests/run.cjs` — all 46 tests still pass, especially
     `tests/insight/test_compliance.cjs`
   - Then commit, push, watch CI green BEFORE marking Phase 3 done.

6. **DON'T trust line numbers from this doc.** They shift as code
   is cut. Re-grep before each move.

---

## AUTHORITY

- **Without asking:** read files, run tests, run lint, edit code
  locally, commit to local branch.
- **Ask first:** push to `origin/main`, push to Heroku, any
  destructive git command, schema changes (those go through
  `db_migrate.js` anyway).

Bill does not manage git or Heroku. You commit and push to origin.
Heroku waits.

---

## START

Acknowledge you've read this doc + the 5 listed Reads. Then either
state your Phase 3 plan in one paragraph (which file you'll create,
which ctx additions you'll need, which audit-helper option you're
picking) and wait for Bill's go, or ask one specific question if
the plan needs clarification.

Don't dive into code without that confirmation step. Phase 3 is the
first real endpoint move — get the plan right before cutting.
