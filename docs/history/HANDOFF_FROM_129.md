> Status: historical session handoff only.
>
> Do not use this as the current startup path. Start with `START_HERE.md`,
> then the canonical repo docs.

HANDOFF FROM SESSION 129 — read all of it before doing anything.

READ FIRST (in order)

1. `HANDOFF.md` (repo root) — generic entry point.
2. `STATE.md` (repo root) — current deploy state + what's pending.
3. `docs/BEFORE_YOU_WRITE.md` — anti-patterns to avoid.
4. `docs/INSIGHT_EXTRACTION_DESIGN.md` — the refactor design doc. Phases 1, 2, 2.1, 3, 4, 5 are done; Phase 6 is your job AND it's the last one.
5. `docs/INSIGHT_TOUCH_POINTS.md` — comprehensive inventory of what needs to move. §1 line numbers refreshed at end of Session 129 — but they shift again as you cut, so re-grep before each move.

Then `node tests/lint-anti-patterns.cjs` — baseline is 16 matches. Anything above means you added an anti-pattern. After Phase 6 lands clean this should be 0, and you flip the script from report-only to fail-on-match.

WHAT SHIPPED IN SESSION 129

One commit on `origin/main` — `6912471`. CI green. NOT deployed to Heroku; Heroku is still at SERVER_VERSION `2026.05.27.0200` from Session 126. We deploy after Phase 6, not phase by phase.

* `6912471` — Phase 5: PPSI/PPII scoring (13 endpoints + the `scorePPII.js` static import + the `calcPPII` callback bridge). Split across three new vertical files:
  - `verticals/workforce_monitoring/server/scoring_admin.js` — 6 weights-config endpoints (PPII GET/PUT/recalculate + PPSI section-weights GET/PUT/restore-defaults) plus the `canEditTenantWeights` auth helper as a module-private.
  - `verticals/workforce_monitoring/server/scoring_history.js` — 5 member-level endpoints (ppii-history, ppsi-history, request-full-ppsi POST + DELETE, ppsi-mode).
  - `verticals/workforce_monitoring/server/wellness.js` — GET `/v1/wellness/members` (the heaviest single endpoint) + POST `/v1/pulse-respondents` + a `registerCallbacks(ctx)` hook that wires `calcPPII` into a new platform-side `verticalCallbacks` registry.

  The handoff's Open Question #2 was resolved with option (a): pointers.js gained a module-level `const verticalCallbacks = {}` plus a top-level `registerCallback(name, fn)` exposed as `ctx.registerCallback` (same shape as Phase 2.1's `registerJobHandler`). The single platform-side caller of `calcPPII` — `gatherMemberFeatures`' `ppii_current` ML feature — now reads `verticalCallbacks.computePpii?.({...}) || ppsiCurrent`. The `?.` + `||` preserves the legacy fallback AND gracefully degrades to ppsiCurrent when the vertical isn't loaded.

  `buildVerticalCtx` gained 5 new fields: `registerCallback`, `encodeValue`, `paths.projectRoot` (= `__dirname` so the vertical can resolve repo-root-relative files like `ml/model_info.json`), `molecules.insertMoleculeRow`, and `molecules.deleteMoleculeRow`.

  `pointers.js` dropped from 30,232 → 28,818 lines (1,414-line cut via 5 sed-deleted ranges in one pass).

STATE RIGHT NOW

* HEAD (origin/main): `6912471`
* SERVER_VERSION: `2026.05.27.1930`
* EXPECTED_DB_VERSION: 78
* Local DB: v78
* Heroku DB: v78
* Heroku SERVER_VERSION: `2026.05.27.0200`
* Tests: 46 passing, 904 assertions
* Lint baseline: 16 matches (down from 28 — 12-match Phase 5 drop, ahead of the ~8 estimate)
* `pointers.js`: 28,818 lines (down from 30,232 at start of session — 1,414 lines extracted)

The 16 remaining lint hits are exactly Phase 6's target — 14 healthcare strings inside the registry/clinician/protocol-card/`gatherMemberFeatures` endpoints + 2 `protocolCards.js` dynamic imports. After Phase 6 the count should reach 0 and the lint script gets flipped from report-only to fail-on-match.

YOUR JOB: PHASE 6 — REGISTRY / CLINICIANS / FOLLOW-UPS / PROTOCOL CARDS

Per `docs/INSIGHT_EXTRACTION_DESIGN.md` and the updated inventory:

Move 15 endpoints + 2 dynamic `protocolCards.js` imports + 1 scheduled-job handler (`F1_T5`) out of `pointers.js` into the vertical module. Verifiable outcome: Insight registry / follow-up / clinician / protocol-card flows all work end-to-end, full suite stays green, lint count drops to 0, and `tests/lint-anti-patterns.cjs` gets wired into `tests/run.cjs` as a fail-on-match gate. Then push to Heroku.

Endpoints to move (current line numbers in HEAD `6912471` — re-grep before each cut):

**Stability registry (4):**
* L24980 GET `/v1/stability-registry/audit-history`
* L26440 GET `/v1/stability-registry`
* L26522 GET `/v1/stability-registry/member/:membershipNumber`
* L26570 PUT `/v1/stability-registry/:link`

**Registry follow-ups (3):**
* L26648 GET `/v1/registry-followups`
* L26688 GET `/v1/registry-followups/summary`
* L26781 POST `/v1/registry-followups`

**Clinicians (5):**
* L27007 GET `/v1/clinicians`
* L27019 GET `/v1/clinicians/:memberNumber/physicians`
* L27045 GET `/v1/members/:memberNumber/clinicians`
* L27060 POST `/v1/members/:memberNumber/clinicians`
* L27084 DELETE `/v1/members/:memberNumber/clinicians/:clinicianNumber`

**Protocol cards (2):**
* L26411 GET `/v1/protocol-cards`
* L26422 GET `/v1/protocol-cards/:cardId`

**Scheduled-job handler (1):**
* L27826 `registerJobHandler('F1_T5', ...)` — daily detection sweep that walks open Yellow/Orange registry items for 21+ days, writes `EXTENDED_CARD: 'T6'` registry items, etc. Currently inline at module scope (NOT inside a `register()` body) — it'll need to migrate into a `registerJobs(ctx)` export on the new vertical file the same way MEDS/RANDOM_DRUG_TEST did.

**Two dynamic protocolCards.js imports** (both inside the protocol-card endpoints listed above):
* L26413 `const { PROTOCOL_CARDS, CARD_CATEGORIES, RESPONSE_TIMELINE, CARD_PRIORITY, DETECTION_RULES } = await import('./verticals/workforce_monitoring/tenants/wi_php/protocolCards.js');` (inside GET `/v1/protocol-cards`)
* L26424 `const { PROTOCOL_CARDS, RESPONSE_TIMELINE } = await import('./verticals/workforce_monitoring/tenants/wi_php/protocolCards.js');` (inside GET `/v1/protocol-cards/:cardId`)

These move with the endpoints. Inside the new vertical file, the import becomes a static `import` from `'../tenants/wi_php/protocolCards.js'` — vertical-internal, allowed by Decision 7.

THE ONE LINT HIT THAT NEEDS A SECOND LOOK

`pointers.js:21366` — `return res.status(404).json({ error: \`No PPII weights configured for tenant ${tenantId}\` });`

This is inside `gatherMemberFeatures` — the ML feature gatherer that STAYS platform-side per the design doc. Two options:

* **(a) Genericize the error string.** Change to `'No scoring weights configured for tenant'` or similar. Drops the lint hit, no behavior change. Recommended — clean and minimal.
* **(b) Pass-through.** Leave it; lint script wraps a `// lint-allow` on the line. Less clean — the script knows it's a healthcare term but the file is platform-shared, so the comment is a lie.

Go with (a). One line, zero risk.

OPEN DESIGN QUESTION YOU MUST SETTLE BEFORE CUTTING

**Should `protocolCards.js` become a database table instead of a JS module?**

Background: `protocolCards.js` is a ~660-line constant library — `PROTOCOL_CARDS`, `CARD_CATEGORIES`, `RESPONSE_TIMELINE`, `CARD_PRIORITY`, `DETECTION_RULES`. It's vertical-internal (only the workforce_monitoring vertical uses it), so moving the 2 imports into vertical files clears the lint hit. That's the minimum for Phase 6 acceptance.

But: Session 124's audit notes flagged `protocolCards.js` as "could move to a `protocol_card` table — clinical reference data, architecturally could move, but is a product decision not a hygiene one." If the answer is "yes, table-ify it," that's a much bigger lift (db_migrate for a `protocol_card` table + seed migration of 29+ cards + admin UI for clinicians to edit cards + rewrite the two endpoints + the F1_T5 handler to read from DB instead of the JS module).

**Recommendation: NO. Keep `protocolCards.js` as a JS module — vertical-internal. Phase 6 ends with the file still in `verticals/workforce_monitoring/tenants/wi_php/`, imported statically by the new Phase 6 vertical file(s) and by the existing vertical-internal consumers (`dominantDriver.js`, `extendedCardDetector.js`, `custauth.js`). Table-ification is a future product decision, not a Phase 6 structural one. Ask Bill to confirm this is the right call before cutting.**

SUGGESTED FILE STRUCTURE

Don't dump all 15 endpoints + the F1_T5 handler into a single file. Split:

```
verticals/workforce_monitoring/server/
  index.js                # imports + registerRoutes + boot
  compliance.js (Phase 3)
  meds.js (Phase 4)
  scoring_admin.js (Phase 5)
  scoring_history.js (Phase 5)
  wellness.js (Phase 5)
  registry.js (NEW)       # the 4 stability-registry endpoints +
                          # the 3 registry-followups endpoints +
                          # the F1_T5 scheduled-job handler (it
                          # walks the registry, so it lives with
                          # the registry endpoints)
  clinicians.js (NEW)     # the 5 clinicians endpoints
  protocol_cards.js (NEW) # the 2 protocol-card endpoints —
                          # short file but the static import of
                          # protocolCards.js naturally lives here
```

3 files, sized roughly: registry.js big (~600 lines incl. F1_T5), clinicians.js medium (~250 lines), protocol_cards.js small (~80 lines). If you'd rather merge protocol_cards into registry.js because it's tiny, that's fine — but don't merge clinicians into either, they're conceptually distinct.

`index.js` imports each module and calls `register(app, ctx)` from `registerRoutes` and `registry.registerJobs(ctx)` from `boot` for the F1_T5 handler.

CTX ADDITIONS YOU'LL LIKELY NEED

Hard to predict precisely — grep each endpoint body before the move and add what's missing. Educated guess based on what registry/clinician/follow-up endpoints typically do:

* `caches.tenantKeys` or `caches.tenantVerticals` if any endpoint resolves tenant_key from tenant_id (likely none — these are member-level endpoints)
* Probably nothing new — `resolveMember`, `caches`, `getMoleculeRows`/`insertMoleculeRow`/`deleteMoleculeRow` should cover most of it (all already on ctx)
* `scheduleFollowups()` (currently at pointers.js around L13900) — used by registry-resolve endpoints. If the registry endpoints stay calling it, it needs to move with them OR be exposed via ctx. Check whether `scheduleFollowups` itself is called from anywhere platform-side (probably not — it's Insight-specific follow-up scheduling against `followup_schedule` table). If only registry endpoints call it, MOVE it (module-private inside registry.js, takes ctx parameter at front of signature). Re-grep to confirm.

KNOWN GOTCHAS (LEARNED IN SESSION 129)

1. **BUILD_NOTES at L346 bloats every grep.** It's a single 50KB string that matches almost any keyword search. Use `grep ... | grep -v "^346:"` to filter it out. DO NOT use the `awk 'NR<345 || NR>360'` trick from the Session 128 handoff — `grep -n` on awk-filtered output gives PRINT-ORDER line numbers, not source line numbers, which will mislead you about where things are.

2. **Multi-line BUILD_NOTES gets bigger every session.** The Phase 5 prepend made it longer. If it's becoming unwieldy, that's a separate cleanup task — don't scope-creep in Phase 6.

3. **The calcPPII bridge uses `||` not `??`.** `verticalCallbacks.computePpii?.({...}) || ppsiCurrent`. The `||` preserves the legacy "if calcPPII returns 0, use ppsiCurrent" behavior. Phase 5 confirmed this by inspecting the original `Math.round(calcPPII({...}) || ppsiCurrent)` semantics. If you add another callback bridge in Phase 6, think carefully about `||` vs `??` based on what the original code did.

4. **`ml/model_info.json` is a test-suite artifact.** Running `node tests/run.cjs` retrains the ML model and updates the file's `trained_at` timestamp. This shows up as `modified:` in `git status` — DO NOT include it in your commit. It's noise from a successful test run, not Phase 6 work.

5. **Don't trust line numbers from this doc.** They shift as code is cut. Re-grep before each move:
   ```
   grep -nE "^app\.(get|post|put|delete).*/v1/(stability-registry|registry-followups|clinicians|protocol-cards)" pointers.js
   grep -n "registerJobHandler('F1_T5'\|protocolCards.js" pointers.js | grep -v "^346:"
   ```

6. **Stale server processes hang around.** Session 129 found a leftover from Session 128 still holding port 4001. Before starting your own server, check `lsof -i :4001 -P -n` — if you see a node process from an older session, ASK BILL before killing it (it might be one he's actively using), then `kill <PID>` and confirm port free with another `lsof`.

7. **Sed multi-range cuts work in one pass.** sed uses ORIGINAL line numbers for all ranges in a single command — they don't shift as earlier cuts process. The Phase 5 cut used `sed -i '' -e '5015,5852d' -e '7038,7179d' -e '26513,26534d' -e '26541,26894d' -e '27214,27271d' pointers.js` — single pass, 5 ranges, all referencing source-file line numbers. Same pattern works for Phase 6 — verify each range's start AND end with `Read` before cutting (don't trust the next-`app.` grep alone; check what surrounds each boundary).

8. **The wait-for-boot pattern.** After `bash bootstrap/start.sh` in background, use `until grep -qE "listening|Server ready|Error|EADDRINUSE|process.exit|failed|ECONNREFUSED" <log-path>; do sleep 1; done` — exits the moment the server says it's ready OR errored. Don't sleep blindly.

9. **Lint script's flip is part of Phase 6 acceptance.** After lint count = 0, edit `tests/run.cjs` to call `node tests/lint-anti-patterns.cjs` and fail the run on any matches. Per the design doc this is the "structural" final acceptance gate. Don't skip it.

10. **Heroku deploy is part of Phase 6.** Per the design doc and Bill's no-deploy-until-Phase-6 rule, after Phase 6 lands green on CI you push to Heroku: `git push heroku main`, then `node db_migrate.js` against Heroku if any DB changes (Phase 6 likely has none, but verify), then watch the Heroku release logs. Ask Bill first — he'll want to coordinate the deploy.

DON'T

1. Don't scope-creep beyond Phase 6. Don't table-ify protocolCards.js unless Bill explicitly says yes.
2. Don't extract helpers to a new `lib/` directory. Design Decision 7 is a hard rule.
3. Don't amend committed work. New commits, not `--amend`.
4. Don't push to Heroku without Bill's explicit go for THIS deploy. Phase 6 is the deploy gate but the actual push is a separate ask.
5. Don't claim something works without running it. After your changes:
   * `bash bootstrap/start.sh` — server boots clean
   * `node tests/lint-anti-patterns.cjs` — count is 0
   * `node tests/run.cjs` — all 46 tests still pass, plus the lint-anti-patterns step now runs as part of the suite and fails on any matches
   * Commit, push to origin, watch CI green BEFORE asking about Heroku.
6. Don't trust line numbers from this doc. They shift as code is cut. Re-grep before each move.

AUTHORITY

* Without asking: read files, run tests, run lint, edit code locally, commit locally.
* Ask first: push to `origin/main`, push to Heroku, any destructive git command, schema changes, table-ifying `protocolCards.js`, anything that would touch the wi_php (Insight) tenant's data.

Bill does not manage git or Heroku. You commit and push to origin. Heroku push requires an explicit go.

START

Acknowledge you've read this + the 5 listed Reads. Then either state your Phase 6 plan in one paragraph (which files you'll create, which ctx additions you'll need, whether you're keeping protocolCards.js as a JS module or asking Bill about table-ification, what you'll do about the L21366 lint hit) and wait for Bill's go, or ask one specific question if the plan needs clarification.

Do not dive into code without that confirmation step. Phase 6 is the last cut AND it includes the final structural change (lint flip) AND the Heroku deploy gate. Three things to get right; one chance.
