> Status: historical session handoff only.
>
> Do not use this as the current startup path. Start with `START_HERE.md`,
> then the canonical repo docs.

HANDOFF FROM SESSION 128 — read all of it before doing anything.

READ FIRST (in order)

1. `HANDOFF.md` (repo root) — generic entry point.
2. `STATE.md` (repo root) — current deploy state + what's pending.
3. `docs/BEFORE_YOU_WRITE.md` — anti-patterns to avoid.
4. `docs/INSIGHT_EXTRACTION_DESIGN.md` — the refactor design doc. Phases 1, 2, 2.1, 3, 4 are done; Phase 5 is your job.
5. `docs/INSIGHT_TOUCH_POINTS.md` — comprehensive inventory of what needs to move. §1 line numbers refreshed at end of Session 128 — but they shift again as you cut, so re-grep before each move.

Then `node tests/lint-anti-patterns.cjs` — baseline is 28 matches. Anything above means you added an anti-pattern.

WHAT SHIPPED IN SESSION 128

Four commits on `origin/main`. None deployed to Heroku — Heroku is still at SERVER_VERSION `2026.05.27.0200` from Session 126. We deploy after the extraction is complete, not phase by phase.

In commit order:

* `0cffb12` — Phase 3: Compliance. 9 endpoints + 2 job handlers (`RANDOM_DRUG_TEST`, `DRUG_TEST_MISSED`) moved out of `pointers.js` into `verticals/workforce_monitoring/server/compliance.js`. `buildVerticalCtx` grew 6 fields: `resolveMember`, `createAccrualActivity`, `getCustauth`, `fireNotificationEvent`, `caches`, and `formatDateLocal` (under `ctx.dates`). Bonus fix: `DRUG_TEST_MISSED`'s raw `UPDATE link_tank` link allocation swapped to `ctx.getNextLink` (one less anti-pattern).
* `093d4c8` — Memory mirror under `docs/claude-rules/`. The 32 files in `~/.claude/projects/-Users-billjansen-Projects-Loyalty-Demo/memory/` are now committed to the repo so they survive a Mac wipe and are visible to anyone reading on GitHub. Source of truth still lives in `~/.claude/.../memory/`; mirror gets updated alongside any rule changes.
* `963dfd6` — Doc refresh after Phase 3: `STATE.md`, `INSIGHT_TOUCH_POINTS.md` (line numbers), `Insight_Build_Notes.md` (v48 header).
* `baf99e4` — Phase 4: MEDS. 4 endpoints (`POST /v1/meds/check/:memberLink`, `GET /v1/meds/member/:memberLink`, `POST /v1/meds/seed`, `GET /v1/meds/summary`) + the `MEDS` scheduled-job handler + two module-private helpers (`calculateMedsNextDue`, `processMedsForMember`) + the `SENTINEL_MEDS_NEXT_DUE` constant moved out of `pointers.js` into `verticals/workforce_monitoring/server/meds.js`. `buildVerticalCtx` gained `billEpochToDate` (under `ctx.dates`) and `externalActionHandlers` (top-level — `processMedsForMember` calls `externalActionHandlers.createRegistryItem` to spawn `SR_YELLOW` registry items on first-detected missed surveys). Helpers now take a `ctx` parameter at the front of their signature; not exported from `meds.js` — they're module-private.

All four commits CI green.

STATE RIGHT NOW

* HEAD (origin/main): `baf99e4`
* SERVER_VERSION: `2026.05.27.1830`
* EXPECTED_DB_VERSION: 78
* Local DB: v78
* Heroku DB: v78 (per STATE.md, set by Session 126 deploy)
* Heroku SERVER_VERSION: `2026.05.27.0200`
* Tests: 46 passing, 904 assertions
* Lint baseline: 28 matches
* `pointers.js`: 30,189 lines (down from 31,397 at start of session — 1,208 lines extracted across Phase 3 + Phase 4)

YOUR JOB: PHASE 5 — PPSI / PPII

Per `docs/INSIGHT_EXTRACTION_DESIGN.md` and the updated inventory:

Move 13 endpoints + the `scorePPII.js` static import + set up one cross-file callback boundary from `pointers.js` into the vertical module. Verifiable outcome: Insight PPSI/PPII admin works end-to-end, Erica's weights-edit + recalculate-everyone + wellness/members + ppii-history + ppsi-history + request-full-ppsi flows all pass their tests, full suite stays green, lint count drops materially.

Endpoints to move (line numbers as of HEAD `baf99e4` — they will shift as you cut, re-grep before each move):

PPII config + history (4):
* L5037 GET `/v1/tenants/:id/ppii-weights`
* L5152 PUT `/v1/tenants/:id/ppii-weights`
* L5308 POST `/v1/tenants/:id/ppii-weights/recalculate`
* L5784 GET `/v1/member/:id/ppii-history`

PPSI config + history (4):
* L5458 GET `/v1/tenants/:id/ppsi-section-weights`
* L5571 PUT `/v1/tenants/:id/ppsi-section-weights`
* L5690 POST `/v1/tenants/:id/ppsi-section-weights/restore-defaults`
* L7058 GET `/v1/member/:id/ppsi-history`

Wellness + pulse + member-level admin (5):
* L26515 POST `/v1/pulse-respondents`
* L26548 GET `/v1/wellness/members` — the heaviest single endpoint; computes PPII inline for every member returned
* L27216 POST `/v1/members/:id/request-full-ppsi`
* L27239 DELETE `/v1/members/:id/request-full-ppsi`
* L27257 GET `/v1/members/:id/ppsi-mode`

Static import to remove (line 6 of pointers.js):
```
import { calcPPII, normStream } from "./verticals/workforce_monitoring/tenants/wi_php/scorePPII.js";
```

After Phase 5, `pointers.js` doesn't import `scorePPII.js` at all. The three other importers (`dominantDriver.js`, `extendedCardDetector.js`, `custauth.js`) all live inside the vertical and stay — vertical-internal imports are fine.

THE ONE DESIGN DECISION YOU MUST MAKE BEFORE CUTTING

Open Question #2 from the inventory: `gatherMemberFeatures` in `pointers.js` (around L29829, function definition around L29760) calls `calcPPII(...)` directly to populate the `ppii_current` ML feature. After Phase 5 removes the top-of-file import, this call needs a new home.

Two options:

**(a) Callback registry pattern.** Add a `verticalCallbacks` module-level object to `pointers.js` (alongside the `jobHandlers` registry from Phase 2.1) and expose `ctx.registerCallback(name, fn)`. The vertical's `boot(ctx)` calls `ctx.registerCallback('computePpii', calcPPII)`. `gatherMemberFeatures` calls `verticalCallbacks.computePpii?.({...}) ?? ppsiCurrent` (preserves the existing `|| ppsiCurrent` fallback). Symmetric with the `registerJobHandler` pattern that already works for scheduled jobs.

**(b) Move ML scoring into the vertical too.** Bigger restructure — `gatherMemberFeatures` and `scoreMemberML` would need to migrate to the vertical, but ML scoring is genuinely platform-level (any future vertical might want predictive risk scoring; it's not Insight-specific). Don't do this.

**Recommendation: (a).** Same shape as Phase 2.1's scheduled-job framework. Minimal disruption, clean layering. Decide and state your pick in the Phase 5 plan paragraph.

SUGGESTED FILE STRUCTURE

Don't dump all 13 endpoints into a single `scoring.js` — it would be 2,000+ lines. Split:

```
verticals/workforce_monitoring/server/
  index.js                # imports + registerRoutes + boot
  compliance.js (Phase 3)
  meds.js (Phase 4)
  scoring_admin.js (NEW)  # the 6 weights-config endpoints
                          # (PPII weights GET/PUT/recalculate,
                          #  PPSI section-weights GET/PUT/restore-defaults)
  scoring_history.js (NEW) # the 2 history endpoints + request-full-ppsi
                          # GET+POST+DELETE + ppsi-mode GET
                          # (ppii-history, ppsi-history,
                          #  request-full-ppsi POST/DELETE, ppsi-mode GET)
  wellness.js (NEW)       # wellness/members (the big one) +
                          # pulse-respondents POST
                          # Also exposes the calcPPII callback
                          # registration in registerJobs(ctx) or
                          # an exported registerCallbacks(ctx).
```

`index.js` imports each module and calls `register(app, ctx)` from `registerRoutes` and any `registerJobs(ctx)` / `registerCallbacks(ctx)` from `boot`.

If you'd rather merge two of these (e.g. wellness + pulse-respondents into scoring_history), that's fine — but a single 2,000-line file is not.

KNOWN GOTCHAS

1. **The L22347 lint hit stays.** There's a `"No PPII weights configured for tenant ${tenantId}"` error string inside an endpoint at pointers.js:22347 that is NOT in the Phase 5 move list. Verify that's right by checking what endpoint surrounds it (it's inside the `gatherMemberFeatures` ML feature gatherer, which stays platform-side). The lint hit clears in Phase 6 (or by replacing the error string with something generic — but don't scope-creep). Phase 5 doesn't need to address it.

2. **`recordPpiiSnapshot`** is exported from `scorePPII.js` and used by `verticals/workforce_monitoring/tenants/wi_php/custauth.js` line 5. That's vertical-internal — fine. Not your problem.

3. **`normStream`** is called inside the moving endpoints (wellness/members has ~5 calls). The moving file (`wellness.js`) imports `normStream` directly from `../tenants/wi_php/scorePPII.js` — vertical-internal, allowed.

4. **Helpers `scoring_admin.js` needs from ctx that aren't there yet** — probably few. The weights endpoints mostly talk to PPII/PPSI tables directly via `ctx.getDbClient()`. Grep each endpoint body before the move and add any missing helpers in one batch to `buildVerticalCtx()`.

5. **`/v1/wellness/members` is the biggest single endpoint.** It computes PPII per member returned. Inside the vertical it can call `calcPPII` directly (vertical-internal import). No callback bridge needed for that path; the bridge is only for `gatherMemberFeatures` which stays platform-side.

6. **`POST /v1/tenants/:id/ppii-weights/recalculate`** is the heaviest admin endpoint — iterates every member with PPII history and rewrites their composite. Likely needs `recordPpiiSnapshot` access from inside the vertical; that's already accessible via direct import from `scorePPII.js`.

7. **Don't trust line numbers from this doc.** They shift as code is cut. Re-grep before each move:
   ```
   grep -nE "^app\.(get|post|put|delete).*/v1/(tenants/:id/ppii|tenants/:id/ppsi|member/:id/(ppii|ppsi)|pulse-respondents|members/:id/request-full-ppsi|members/:id/ppsi-mode|wellness)" pointers.js
   ```

8. **`BUILD_NOTES` bloat** — when grepping `pointers.js` for things like `registerJobHandler`, the giant `BUILD_NOTES` string at L351 dominates output. Use `awk 'NR < 350 || NR > 352' pointers.js | grep -n '...'` to exclude it.

9. **Stale server processes hang around.** Session 128 found a leftover `node pointers.js` (PID 1101) from Session 127 still holding port 4001. Before starting your own server, check `lsof -i :4001 -P -n` — if you see a node process from an older session, kill it cleanly before `bash bootstrap/start.sh`.

10. **The placeholder-edit dance is wrong for big cuts.** Session 128 tried it once for the compliance cut and made a mess (reverted immediately). For large multi-hundred-line cuts, use `sed -i '' -e 'A,Bd' -e 'X,Yd' pointers.js` with original line numbers — sed processes ranges in one pass.

DON'T

1. Don't scope-creep beyond Phase 5. Registry/clinicians/protocol-cards/F1_T5-handler is Phase 6.
2. Don't extract helpers to a new `lib/` directory. Design Decision 7 is a hard rule.
3. Don't amend committed work. New commits, not `--amend`.
4. Don't push to Heroku. Origin only. Heroku deploys after Phase 6.
5. Don't claim something works without running it. After your changes:
   * `bash bootstrap/start.sh` — server boots clean
   * `node tests/lint-anti-patterns.cjs` — count drops (Phase 5 target per inventory §10: roughly 8, but real number depends on what strings cluster inside the moving endpoints — don't sweat the exact target)
   * `node tests/run.cjs` — all 46 tests still pass, especially the PPII/PPSI tests:
     * `insight/test_ppii_history_snapshot.cjs`
     * `insight/test_ppii_weights_admin.cjs`
     * `insight/test_ppsi_subdomain_weighting.cjs`
     * `insight/test_ppsi_previous_subline.cjs`
   * Then commit, push, watch CI green BEFORE marking Phase 5 done.
6. Don't trust line numbers from this doc. They shift as code is cut. Re-grep before each move.

AUTHORITY

* Without asking: read files, run tests, run lint, edit code locally, commit locally.
* Ask first: push to `origin/main`, push to Heroku, any destructive git command, schema changes.

Bill does not manage git or Heroku. You commit and push to origin. Heroku waits.

START

Acknowledge you've read this + the 5 listed Reads. Then either state your Phase 5 plan in one paragraph (which files you'll create, which ctx additions you'll need, which option you picked for the calcPPII callback — (a) recommended) and wait for Bill's go, or ask one specific question if the plan needs clarification.

Do not dive into code without that confirmation step. Phase 5 is the biggest endpoint move — get the plan right before cutting.
