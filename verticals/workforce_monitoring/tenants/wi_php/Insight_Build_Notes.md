**INSIGHT HEALTH SOLUTIONS**

Build Notes & Working Document

*Predictive Performance Intelligence Infrastructure (PI^2)*

**LIVING DOCUMENT --- Updated as design evolves**

**Session 127 (2026-06-30) — WisconsinPATH Stage 1 dashboard segmentation by referral source (SHIPPED, local) + a foundational design conversation about the person/role model (DECISION PENDING — Bill sleeping on it).**

*Shipped (local commit `4c829d2`, verified, CI-clean, NOT deployed — rides the post-demo Heroku deploy with Session 126):* the participant list (`GET /v1/wellness/members`) now attaches each member's `REFERRAL_SOURCE` as `{ code, label }`, read via the two-layer molecule path `getMoleculeRows` → `decodeMolecule` (wrapped so a bad value can't break the list). `decodeMolecule` exposed on `ctx.molecules` for the vertical. `dashboard.html` gains a **"By Referral Source"** tab in Program View (mirrors "By Licensing Board" — groups + tier summary; "Not Classified" sorts last) and the field joins the search box. `SERVER_VERSION` 2026.06.30.2246. No DB change (reads the Session-126 molecule). Verified: live round-trip (a member assigned "Employer" comes back `{code:'EMP',label:'Employer'}`), the tab renders correctly against real data, lint 0, `test_referral_source` 9/9.

*Design conversation (no code — captured in `ACTIVE_WORK.md`):* scoping the Stage-1 **review queue** (role routing → triage notes → SLA escalation → disposition) opened a deeper question about identity. Where it landed, pending Bill's decision: (1) **"a person is a person"** — one population, no separate "staff type"; today's split (member vs login) is mostly an accident of auth. (2) Model roles as **(clinic + capacity)** multi-row molecules on the person; **"monitored" is just one capacity** alongside "case manager"/"director" — one affiliation concept, not two enrollments. (3) The **login credential stays a separate dumb keycard** that points at the person — the one thing that can't be a molecule, because auth runs *before* identity is known and needs a value→person lookup that fails loud (molecules are keyed by person + fail silently). (4) At this scale (thousands, never SkyMiles-level) molecule overhead is noise, so molecules are fine for the affiliation model — **but** molecule **Tier-1 hardening** (validate-at-creation + auto round-trip self-test; only touches new-molecule creation, so low-risk) moves to the front, since the access model would rest on molecules. **Open fork Bill is sleeping on: foundation-first** (build the person/affiliation model, then the review queue on it) **vs feature-first** (build the review queue with a minimal role mechanism now, evolve into the person model later). Erica note SENT asking whether Stage-1 reviews route program-wide vs by-referral-source/per-clinic (informs routing, doesn't block). **⚠️ Verified correction (this session):** a login (`platform_user`) is NOT attached to a member today — `link` is the login's own id, not a member pointer; session carries only `userId`/`tenantId`/`role`; `role` is CHECK-constrained to `superuser`/`admin`/`csr`, so clinical titles (case-manager/medical-director) can't live on a login and currently match zero users in role-based notification routing. Logins and members are disconnected worlds (one fragile display_name bridge). So "login points at the person" is net-new, and feature-first must also add role-holding from scratch. **Converged (end of Session 127): fork resolved → foundation-first; full design captured in `docs/MOLECULE_PARENT_GENERALIZATION.md`.** Molecules generalise beyond member/activity: storage table naming is `{parent_key_bytes}_data_{col_widths}` (the leading `5` is currently hardcoded); a user is a 4-byte parent → `4_data_*` with `p_link integer`; domain roles = `(role, clinic)` molecule on the user; **no A/M for new parents** (their own table separates them); tenant + access-tier stay explicit fields (not molecules); **rules-engine participation becomes an explicit molecule flag** (decoupled from A/M, fences new parents out of bonus/promotion logic). Shipped two tiny front-end steps (`e13a4c4`): the molecule admin page no longer requires attaches-to member/activity. **Verified the link-tank behaviour: widening the columns is enough — the allocator just increments, the column width was the only ceiling, so the link tank is NOT touched.** NEXT: the data migration (widen `platform_user.link` + `audit_log_1..5.user_link` smallint→integer via db_migrate — 6 columns, get Bill's go, it touches audit).

**Session 126 (2026-06-30) — WisconsinPATH Stage 1 `REFERRAL_SOURCE` molecule + the real internal-list `value_id` bug + molecule-doc overhaul.** Built `REFERRAL_SOURCE`, the Stage 1 referral-classification field on the participant (Self-referral / Employer / Board-mandated) — an internal-list **member** molecule (db_migrate v85 = molecule_def + the mandatory `molecule_value_lookup` row + 3 values + member composite-M; v86 = added to the M input template so it shows/edits on the participant profile). Registration lifts `referral_type` from the referral `code` row's JSONB into this molecule (JSONB carries; the molecule queries + drives behavior — dashboard segmentation, safe-haven status, board-reporting eligibility). It failed its round-trip, which surfaced a real platform bug: **internal-list values store a per-molecule 1–127 code (the `value_id`) squished into a 1-byte cell, but `molecule_value_text.value_id` defaults to a GLOBAL sequence (now past 127)**, so any list seeded by a raw INSERT (bypassing the first-available allocator) overflows the byte and reads back empty. Fixed at the root (db_migrate v87 + pointers.js): shared `allocateListValueId()` (first-available 1–127; the one place list codes get numbered), clone + static-text insert paths fixed to keep `value_id` valid, the 3 already-overflowed lists (`REFERRAL_SOURCE`, `EXTENDED_CARD`, `STATE`-t5 — all zero stored rows, nothing re-mapped) renumbered to per-molecule 1..N, and `CHECK (value_id BETWEEN 1 AND 127)` added so a bad insert fails loudly. Then rewrote the molecule documentation into a single bulletproof authority (`docs/MOLECULES.md` — mechanism, per-type recipes, silent-failure invariants, helpers + never-raw-SQL, verified exemplars, mandatory round-trip verification), gutted the duplicate molecule sections in `master §2` / `essentials §2` down to a pointer, and wired it into `START_HERE` + the loyalty-platform skill so a fresh session can't miss it. Test: `tests/insight/test_referral_source.cjs` (9/9). Full suite 55/1018 green, lint 0. SERVER_VERSION 2026.06.30.2101, EXPECTED_DB_VERSION 87. All on `origin/main`, CI-gated, **NOT deployed to Heroku** (Dr. Stadler demo 2026-07-01 — deploy after).

CONFIDENTIAL --- PRIMADA INTERNAL \| Last Updated: June 11, 2026 (v56 — Session 120: Whole-codebase reasonableness audit + fixes. Five parallel sweeps (date handling, fetch checks, DB-access rules, tenant leakage, save flows/silent catches) over the full repo; the destructive-save, silent-catch, molecule-SQL, tier-join, and link-allocation categories all came back clean. What wasn't clean got fixed the same session: (1) the six /v1/licensing-boards + /v1/members/:id/licensing-board endpoints were still in pointers.js — missed by Phase 6 and the 130/131 sweeps because the lowercase URLs never tripped the case-sensitive lint and 'licensing' isn't in its healthcare-terms regex — now moved to verticals/workforce_monitoring/server/licensing.js (pure relocation; only vertical pages call them; encodeMolecule added to ctx.molecules for the member PUT); (2) every toISOString().slice(0,10) — the UTC-shift twin of the banned split('T') form, invisible to the old lint regex — replaced with formatDateLocal()/platformTodayStr() server-side and toLocaleDateString('en-CA') client-side, across pointers.js (7 sites), csr_member.html, point-summary, simulation-modal, Insight wellness/scoring_history/exports, bootstrap seeds, and 7 Insight test files (after 6 PM Central the tests submitted tomorrow's activity date — latent flake); lint Pattern 2 now catches both spellings; (3) 17 load-path fetch sites got the missing r.ok checks (Insight dashboard/physician_detail/registry_history dropdowns, signal-type edit, ml_report, stress tools); physician_detail's loadActivities called .json() before checking .ok — reordered; (4) survey-take-modal.js default tenant 5 → null (no tenant defaults in platform-shared files); (5) 10 stale Claude worktrees + 27 claude/* branches (all 0-ahead of main) deleted. SERVER_VERSION 2026.06.11.1433; no DB change (stays v80). Full suite 51 tests / 954 assertions green, lint 0. Follow-on (same session, tooling-only — no app/DB change): hardened the anti-pattern checker itself to enforce the three database-access rules that previously lived only in docs/skill (i.e. were guarded by Claude's discipline, not by the machine) — Pattern 6 = direct SQL against molecule storage tables (must use the helpers), Pattern 7 = raw JOIN/FROM member_tier (must use get_member_current_tier()), Pattern 8 = raw link_tank / MAX(link)+1 (must use getNextLink()). Server-JS only, tests exempt, each with an explicit allowlist of sanctioned data-layer files (helper layer + migrations + vertical scoring hooks + one-time backfills). Self-tested: 0 on the clean tree, fires on a planted violation of each. tier_endpoints.js (dead stub) added to lint SKIP_FILES. This directly closes the soft spot behind the recurring 'Claude read molecule data without the helpers' class of bug. Prior — v55 — Session 119: Admin-UI polish on the shared template/composite admin pages — (1) fixed reversed Flight/Activity wording on the Activity Display Templates pages: the listing header is now the generic "Activity Display Templates" while the type-'A' row reads the tenant word "Flight" (Insight: "Accrual") from the activity_type_label sysparm, the edit-page header reflects the template's own type, and the edit dropdown's 'A' option reads the tenant word — all via a shared labelForType() that mirrors the server's own convention (type-'A' → activity_type_label; "Activity" = generic umbrella); (2) visually separated Member from Activity composites on admin_composites.html into two cards ("Activity Composites" / "Member Composites" for composite_type 'M'), matching the Activity Input Templates page pattern, added a .type-M badge color, and generalized the page title to "Composites / …each activity type and the member profile"; (3) aligned the two composite cards' columns (separate tables → table-layout:fixed + an identical colgroup). HTML-only — no pointers.js / SERVER_VERSION / DB change; SERVER_VERSION stays 2026.06.07.1706, DB stays v80. Deployed to Heroku release v87. These are platform-shared admin pages Insight also uses. Prior — v54 — Session 118: Member Composites (composite_type 'M') — made 'M' the authority for tenant-specific member molecule fields, the member analog of the 'A' activity composite. db v79 seeds the M composite for Delta {PASSPORT} and Insight {LICENSING_BOARD}, both is_required=false, resolving molecule_id by key (not hardcoded) and idempotently; it also consolidates the 'composite' link_tank to one global tenant_id=0 row (a stale per-tenant row pointed at an already-used link, so the next composite created via getNextLink could collide). Member input templates are now layout-only: POST + PUT /v1/input-templates reject any field whose molecule_key is not in the tenant's M composite (validateMemberTemplateFieldsAgainstComposite). Member enroll + update validate submitted molecule fields against the M composite at the single chokepoint PUT /v1/member/:id/molecules (validateMemberMoleculesAgainstComposite, enforceRequired) — unauthorized field → 400, missing required field → 400; honors composite_detail.is_required. A tenant with no M composite is ungoverned (backward-compatible) — only Delta + Insight have one, and they exactly match the only two tenants with M input templates. The 4 display/input-template :id endpoints (GET+PUT each) are hard-scoped to req.tenantId so a tenant (incl. a switched-in superuser via POST /v1/auth/tenant) can never read/overwrite another tenant's template by id. Composite admin UI (admin_composite_edit.html / admin_composites.html) exposes 'M' as a type and filters the molecule picker to member molecules (attaches_to includes 'M'). Fixed a silent failure on the enroll page: csr_member.html saveProfile() now checks r.ok on the enroll-time molecules PUT (was swallowing failures behind "enrolled successfully!"). SEPARATE BUG FOUND + FIXED (db v80): member enrollment was broken — the 'member' link_tank had stale per-tenant rows and the global getNextLink('member') handed out an already-used link, so POST /v1/member failed with a duplicate-PK 500. v80 consolidates it to one global row, next_link recomputed from the decoded max member link (with a fallback to the furthest existing counter) — recomputes from data, so a no-op on a clean env and a repair on a drifted one. 6 new tests (Delta PASSPORT enroll/update/template-reject/scoping, Insight LICENSING_BOARD + cross-tenant reject + scoping, browser PASSPORT-renders); full suite 51 tests / 954 assertions / 0 fail; lint 0; db at v80. SERVER_VERSION 2026.06.07.1706, EXPECTED_DB_VERSION 80. NOT yet pushed to GitHub or Heroku at time of writing.) (v53 — Session 131: Category 2 of the post-Phase-6 cleanup — the ML scoring pipeline + both export endpoints moved out of pointers.js, which finishes the Insight server extraction. gatherMemberFeatures (the PPSI/Pulse/compliance/MEDS/registry ML feature builder, ~240 lines) → verticals/workforce_monitoring/server/ml_features.js, registered as verticalCallbacks.getMemberFeatures. scoreMemberML — the generic ML plumbing (call the ML service, store the ML_RISK_SCORE molecule) — stays platform-side and reads that callback, returning null when the vertical isn't loaded so platform-only tenants simply get no ML scoring. Both CSV/PDF export endpoints (GET /v1/export/:report — registry/followups/roster/compliance — and GET /v1/export/participant/:membershipNumber — the per-participant chart, CSV+PDF) → verticals/workforce_monitoring/server/exports.js; they were Insight-only (only physician_detail.html + action_queue.html call them, and they query stability_registry/registry_followup/member_survey/compliance_result) so the routes belong in the vertical. toCsv moved with them; the assigned-clinician and member-notes enrichments now call the vertical's own getAssignedClinicians (clinicians.js) / getMemberNotes (notes.js) directly (both promoted to named exports) instead of bouncing through verticalCallbacks. Deleted the dead ppiiStreamFetchers registry (~115 lines) — nothing called calcPPIIFromMember at runtime anymore; wellness.js and the moved feature gatherer both compute their own raw stream values and call calcPPII directly. /v1/ml/retrain stays platform-side as generic SSE retrain plumbing (spawns ml/retrain_with_weights.py) but its Insight weight-bundle shape (pulse/ppsi/compliance/events summing to 1.0) is validated + built by verticalCallbacks.prepareRetrainWeights (scoring_admin.js). Reworded 15 platform-side comments that still spelled out standalone PPII/PPSI/MEDS — honest, NOT comment-laundering: the Insight table names (ppii_stream, ppsi_subdomain, …) and cache property names (caches.ppiiStreams/ppiiWeights/ppsiSubdomains/ppsiSubdomainWeights) stay exactly as they were and are plainly visible in the code right below each comment, because renaming those tables/caches is a separate, scoped-out migration; the comments just stop repeating the acronym. Gate ran green BEFORE shipping: Part-B = 0 standalone ppii/ppsi/meds tokens in pointers.js (case-insensitive, whole-word, COMMENTS INCLUDED) outside the BUILD_NOTES log; lint 0; full suite 48 tests / 924 assertions / 0 failures — server restarted on the new code with PG env vars first (the same DB-less gotcha as Category 1, handled up front). C12 + C16 ML tests exercise the getMemberFeatures callback; C14 CSV Export + the Participant Chart Export test exercise the relocated /v1/export routes. pointers.js dropped 27735 → ~26975 lines (-759, one multi-range sed cut). SERVER_VERSION 2026.05.29.1521, DB version 78 (no schema change). Insight server extraction from pointers.js is now functionally complete. v52 — Session 131: Category 1 of the post-Phase-6 cleanup. Moved the five healthcare-named endpoints Phase 6 missed — physician-annotations (GET, POST) and survey-note-reviews (GET, GET-by-member, PATCH) — out of pointers.js into verticals/workforce_monitoring/server/notes.js, and bridged the two remaining platform-side references to the physician_annotation + survey_note_review tables via verticalCallbacks: getMemberNotes (the /v1/export/:report notes section) and recordSurveyNoteReview (the /v1/member-surveys/:link/answers note-alert branch), each with a safe fallback ([] / no-op) so platform-only tenants keep working. They slipped Phase 6 because their lowercase URLs don't match the case-sensitive anti-pattern lint regex. Falsifier ran green: 0 annotation/note-review endpoints left in pointers.js, 0 references to those two tables outside BUILD_NOTES, lint 0 matches, full suite 48 tests / 924 assertions / 0 failures. SERVER_VERSION 2026.05.29.0845, DB version 78 (no schema change). Category 2 — the ML scoring pipeline (gatherMemberFeatures / scoreMemberML / the PPII-PPSI feature literals) — stays platform-side and is NOT yet started. v51 — Session 130: Phase 6 (final) of the Insight server extraction landed. Registry / clinicians / follow-ups / protocol cards + the F1_T5 scheduled-job handler + the 2 protocolCards.js dynamic imports moved out of pointers.js into three new vertical files under verticals/workforce_monitoring/server/: registry.js (the 4 stability-registry endpoints — audit-history GET, registry GET, member-detail GET, PUT — plus the 4 registry-followups endpoints — GET, summary GET, POST, PATCH /:id — plus the F1_T5 scheduled-job handler that walks open Yellow/Orange registry items for T5/T6/F1 destabilization detection); clinicians.js (the 5 clinician-assignment endpoints — GET /v1/clinicians, GET /v1/clinicians/:m/physicians, GET/POST/DELETE /v1/members/:m/clinicians); protocol_cards.js (the 2 protocol-card reference-library endpoints, with a single static vertical-internal `import { PROTOCOL_CARDS, CARD_CATEGORIES, RESPONSE_TIMELINE, CARD_PRIORITY, DETECTION_RULES } from '../tenants/wi_php/protocolCards.js'` replacing the two dynamic `await import('./verticals/workforce_monitoring/...')` calls the platform endpoints used to do). The Phase 6 handoff listed 14 endpoints; PATCH /v1/registry-followups/:id (formerly L26825) was missed by the handoff inventory and folded into registry.js to keep the registry-followups family coherent (15 endpoints moved total, matching the handoff's stated count). The clinician HELPER functions (getClinicians / getAssignedClinicians / isClinician / assignClinician / removeClinician) stay platform-side in pointers.js because two platform-shared call sites depend on them — fireNotificationEvent's assigned-clinician routing (notification recipient resolution) and /v1/export/:report's registry+roster branches — and are exposed to the vertical via ctx; the lint regex doesn't flag camelCase identifiers so `getAssignedClinicians` etc. don't trip the platform-shared rule. scheduleFollowups (pointers.js:14422) also stays platform-side: the handoff said it was called from registry-resolve endpoints, but it's only called from externalActionHandlers.createRegistryItem (L14822), which is itself platform-side as part of the external-action engine. buildVerticalCtx grew 7 new fields: getOrCreateEntityLink + logAudit (used by the audit-history endpoint and PUT /v1/stability-registry); getClinicians + getAssignedClinicians + isClinician + assignClinician + removeClinician (used by clinicians.js endpoint bodies). Plus 4 inline string genericizations to clear lint hits in platform-shared code that stays in pointers.js: the /v1/ml/retrain "No PPII weights configured for tenant" 404 error → "No scoring weights configured for tenant" (the handoff's option (a)); the two "PPSI note alert" debug+error strings inside /v1/member-surveys/:link/answers PUT → "Survey note alert" (the notification event_type 'PPSI_NOTE_ENTERED' itself is unchanged — that's a notification_rule key, behavior-preserved); memberName: 'Test Physician' in /v1/notification-rules/test → 'Test Member'. Plus 5 `// lint-allow` comments on platform-shared lines where the healthcare term is load-bearing and a one-line fix would either regress Erica's downloads or require an out-of-scope refactor: the 3 CSV column labels in /v1/export/:report ("Assigned Clinician" ×2 in the registry+roster reports, "PPII" ×1 in the registry report — user-visible headers Erica reads), and 2 `survey_code = 'PPSI'` SQL string literals inside gatherMemberFeatures (the ML feature gatherer that stays platform-side per the design — these literals are load-bearing on the ML model's feature shape; genericizing requires a tenant-config indirection layer + ML model retrain). tests/lint-anti-patterns.cjs flipped from report-only to fail-on-match (the final `process.exit(0); // report only` replaced with `process.exit(1)`; header banner updated to "FAILING THE BUILD" wording) and wired into tests/run.cjs as a Pre-flight step that runs before Step 1 (Verify Server) — fails fast on any new anti-pattern before any database snapshot or test setup. tests/insight/test_protocol_card_library.cjs's source-scan list was extended to include verticals/workforce_monitoring/server/registry.js (the F1_T5 move would otherwise have broken C20 because the scan looks for `EXTENDED_CARD: 'T5'/'T6'/'F1'` literals which now live in registry.js, not pointers.js — 4 assertion failures on first run; fixed by adding the new file to the scan source list). pointers.js dropped from 28,818 → 27,987 lines (-831 lines via a single sed multi-range cut: 7 ranges in one pass, source-line-numbered so they don't shift as earlier cuts process, covering the audit-history endpoint, the protocol-cards section, the stability-registry section, the registry-followups GET+summary block, the registry-followups POST+PATCH block, the clinicians section, and the F1_T5 handler). Lint count dropped 16 → 0; full test suite 46/46, 904 assertions, 0 failures. Phase 6 verifiable: server boots clean on SERVER_VERSION 2026.05.27.2125, vertical loads ("Loaded vertical: workforce_monitoring"), C12 ML Predictive Risk's 'Valid risk label' flake passed on the clean run (it's a documented pre-existing intermittent per STATE.md "What's fragile right now" — passes solo, has been intermittent for sessions). NOT pushed to Heroku yet — Phase 6 IS the Heroku gate per the design, but the actual push requires Bill's explicit go. EXPECTED_DB_VERSION 78 unchanged. v50 header preserved below. v50 — Session 129: Phase 5 of the Insight server extraction landed. PPSI/PPII scoring — 13 endpoints + 1 platform import + 1 callback boundary — moved out of pointers.js into three new vertical files under verticals/workforce_monitoring/server/: wellness.js (POST /v1/pulse-respondents + GET /v1/wellness/members — the heaviest single endpoint, computes PPII inline per member returned — plus a registerCallbacks(ctx) hook that wires calcPPII into a new platform-side verticalCallbacks registry); scoring_admin.js (6 weights-config endpoints: PPII GET/PUT/recalculate + PPSI section-weights GET/PUT/restore-defaults; plus the canEditTenantWeights auth helper relocated as a module-private since it's only used by these mutating routes); scoring_history.js (5 member-level endpoints: GET /v1/member/:id/ppii-history, GET /v1/member/:id/ppsi-history, POST + DELETE /v1/members/:id/request-full-ppsi, GET /v1/members/:id/ppsi-mode). The static `import { calcPPII, normStream } from './verticals/workforce_monitoring/tenants/wi_php/scorePPII.js'` at pointers.js line 6 is now deleted — the new vertical files import it directly as a vertical-internal import, which is allowed by Design Decision 7. The single platform-side caller of calcPPII (gatherMemberFeatures' ppii_current ML feature, formerly at L29829) is now bridged via the callback registry: pointers.js gained a module-level `const verticalCallbacks = {}` plus a top-level `registerCallback(name, fn)` exposed as ctx.registerCallback (same shape as Phase 2.1's registerJobHandler); the vertical's boot(ctx) calls wellness.registerCallbacks(ctx) which does ctx.registerCallback('computePpii', calcPPII); the gatherMemberFeatures call site is now `verticalCallbacks.computePpii?.({...}) || ppsiCurrent` so the fallback preserves the legacy `|| ppsiCurrent` semantics and gracefully degrades when the vertical isn't loaded. buildVerticalCtx grew 5 new fields: registerCallback (the new bridge), encodeValue (top-level — wellness/members uses it for the PARTNER_PROGRAM clinic filter), paths.projectRoot = __dirname (scoring_admin reads ml/model_info.json from repo root for ML drift warnings), molecules.insertMoleculeRow + molecules.deleteMoleculeRow (request-full-ppsi POST + DELETE). All 13 endpoint bodies are byte-identical in behavior — only the dbClient access pattern changed (ctx.getDbClient() instead of closing over a top-level binding). pointers.js dropped from 30,232 → 28,818 lines (1,414 lines extracted across 5 sed-deleted ranges in one pass). Phase 5 verifiable: server boots clean on SERVER_VERSION 2026.05.27.1930, vertical loads ("Loaded vertical: workforce_monitoring"), full suite 46/46 (904 assertions all passing — especially the four PPII/PPSI tests the handoff called out: tests/insight/test_ppii_history_snapshot.cjs, tests/insight/test_ppii_weights_admin.cjs (C16/Erica PPII weights admin UI), tests/insight/test_ppsi_subdomain_weighting.cjs (C17), tests/insight/test_ppsi_previous_subline.cjs (C22)). Anti-pattern lint dropped from 28 → 16 matches — a 12-match drop (ahead of the ~8 the inventory estimated). Remaining 16 are all Phase 6 work: 14 healthcare strings inside the registry/clinician/protocol-card/gatherMemberFeatures endpoints still living in pointers.js, plus 2 protocolCards.js dynamic imports at pointers.js:26413 + 26424. NOT pushed to Heroku — Heroku waits until Phase 6 finishes, per the handoff. EXPECTED_DB_VERSION 78 unchanged. v49 header preserved below. v49 — Session 128 (cont'd): Phase 4 of the Insight server extraction landed. MEDS (Missing Event Detection System) moved out of pointers.js into verticals/workforce_monitoring/server/meds.js. Four endpoints relocated: POST /v1/meds/check/:memberLink, GET /v1/meds/member/:memberLink, POST /v1/meds/seed, GET /v1/meds/summary. One scheduled-job handler relocated: the MEDS daily-2am sweep that finds members with meds_next_due <= today and runs processMedsForMember per member. Two helpers moved as module-private inside meds.js: calculateMedsNextDue (scans surveys + cadenced compliance + random-scheduled compliance, finds the earliest next-due date, upserts member_meds) and processMedsForMember (locks member, walks surveys/cadenced-compliance/random-scheduled-compliance, fires MEDS_SURVEY_OVERDUE + MEDS_COMPLIANCE_OVERDUE + MEDS_CONSECUTIVE_MISS notifications, spawns MISSED_SURVEY registry items via externalActionHandlers.createRegistryItem on first detection per member, recalculates next-due date in the same transaction). Both helpers grew a ctx parameter at the front of their signature so they can read getDbClient + dates + log + externalActionHandlers via ctx instead of closing over pointers.js bindings. SENTINEL_MEDS_NEXT_DUE constant (= 31910, the 01/01/2137 Bill-epoch sentinel for 'no MEDS scheduled') moved with them. buildVerticalCtx in pointers.js gained two new fields: billEpochToDate (under ctx.dates — Bill-epoch datetime → JS Date, used by both helpers and the /v1/meds/member + /v1/meds/summary endpoints to render last-completed dates) and externalActionHandlers (top of ctx — the platform dispatcher for external actions like SR_YELLOW registry-item creation; processMedsForMember needs this to spawn MISSED_SURVEY registry items). Endpoint logic byte-identical to the original; the only structural change is the dbClient access pattern through ctx.getDbClient(). Phase 4 verifiable: server boots clean on SERVER_VERSION 2026.05.27.1830, C18 test_meds_member_status passes 12/12 (the membership-number-vs-member-link resolveMember fix Erica reported in Session 112 still works post-move), full suite 46/46 (904 assertions), lint count unchanged at 28 (the PPSI strings the inventory expected to drop from Phase 4 turned out to be inside the ML PREDICTIVE RISK section's gatherMemberFeatures, not MEDS itself — they'll move with Phase 5). pointers.js dropped from 30,918 → 30,189 lines (729 lines extracted). Commit baf99e4 on origin/main; CI green. NOT pushed to Heroku — Heroku waits until Phase 6 finishes. Phase 5 next session: PPSI/PPII (13 endpoints + the scorePPII.js platform import removal + one cross-file callback boundary for gatherMemberFeatures's calcPPII call — see HANDOFF_FROM_128.md and Open Question #2 in docs/INSIGHT_TOUCH_POINTS.md §9). EXPECTED_DB_VERSION 78. v48 header preserved below. v48 — Sessions 127 + 128: Insight server extraction begins. Goal: move every healthcare/workforce-monitoring server endpoint out of pointers.js into verticals/workforce_monitoring/server/ so deleting that directory leaves Delta/United/Marriott/Ferrari working untouched. Six-phase refactor mapped in docs/INSIGHT_EXTRACTION_DESIGN.md. After Phase 6 the lint count drops to zero and lint-anti-patterns flips from report-only to fail-on-match. Phase 1 (Session 127, commit 7a50a20) — scaffolding only. Created verticals/workforce_monitoring/server/index.js exporting verticalKey/registerRoutes/requiredMolecules/boot. Added a vertical-loader block in pointers.js that reads process.env.VERTICALS_ENABLED (default 'workforce_monitoring'), dynamically imports each listed vertical via computed path (lint scanner can't see the literal string), builds a ctx object containing getDbClient + getNextLink + date helpers + molecule helpers + log helpers, and calls vertical.registerRoutes(app, ctx). Empty routes registered today — load mechanism exercised at boot, failed vertical import hard-exits with a clear message. Also produced docs/INSIGHT_TOUCH_POINTS.md — comprehensive inventory of every Insight touch point in pointers.js: 40 endpoints (compliance 9, MEDS 4, PPSI/PPII/wellness 13, registry/clinicians/followups/protocol-cards 15); 3 platform→vertical imports (scorePPII static at line 6, protocolCards dynamic twice); endpoints that look Insight-flavored but stay platform (test-rule, signal-types, external-actions, notification-rules, notification-delivery-config); 2 soft branches in platform code that gracefully handle MEMBER_SURVEY_LINK presence/absence (stay); zero hardcoded tenant_id===5 or vertical_key checks. Phase 2 (Session 127, commit e4aec80) — framework wiring. (1) verifyTenantMolecules grew a Layer 3 — for each tenant whose vertical_key matches a loaded vertical's verticalKey, union the vertical's requiredMolecules export into the readiness check. All current FEATURE_CONDITIONAL_MOLECULES entries are platform-level so the new layer is a no-op today; shape is ready for future Insight-specific requirements. (2) Fail-closed auth middleware added after requireAuth (Design Decision 2): if req.session.vertical_key is set and not in the loaded-verticals list, return 503 with {error, code:VERTICAL_NOT_LOADED}. Platform-only tenants (Delta etc., vertical_key NULL) pass through. A wi_php user attempting any endpoint with workforce_monitoring unloaded gets one clean rejection at auth instead of 404s deeper in. Phase 2.1 (Session 127, commit 36ac6a6) — scheduled job handlers gap. Bill (via another session) caught a Phase 1 inventory miss: 6 registerJobHandler() calls in pointers.js were missed by the setInterval/setTimeout/cron grep. Four are Insight-specific (MEDS, RANDOM_DRUG_TEST, DRUG_TEST_MISSED, F1_T5); two stay platform (NOTIFY_DELIVER, NOTIFY_DIGEST — drive notification_delivery used by Delta and Insight). Three fixes: (a) inventory §7 rewritten with the corrected phase mapping (MEDS → Phase 4, RDT/DTM → Phase 3, F1_T5 → Phase 6); (b) ctx exposed registerJobHandler so verticals can call ctx.registerJobHandler('MEDS', fn) from their boot() hook; (c) vertical.boot(ctx) now actually fires — moved into the dbClient.query.then chain right after loadScoringFunctions, same chain also gets the scheduled-jobs startup block (runDueScheduledJobs + startJobScheduler), moved out of the app.listen callback. Previous location had a latent race: scheduler started in app.listen while loadCaches ran in the .then chain in parallel. Now sequential: caches → vertical boot (registers handlers) → startup jobs (sees handlers) → scheduler tick. Phase 3 (Session 128, commit 0cffb12) — Compliance endpoints + scheduled jobs moved. Nine endpoints relocated into verticals/workforce_monitoring/server/compliance.js: GET /v1/compliance/member/:membershipNumber, GET .../history, POST /v1/compliance/entry, GET/POST/PUT /v1/compliance/items[/:id], PUT .../cadence/:mcid, POST/DELETE .../assign[/:cid]. Plus two scheduled-job handlers: RANDOM_DRUG_TEST (daily-7am 1-in-7 selection with 2-day minimum spacing + 10-day max-gap force), DRUG_TEST_MISSED (daily-5pm sweep, auto-MISSED on no specimen). vertical/workforce_monitoring/server/index.js now imports compliance.js and calls compliance.register from registerRoutes + compliance.registerJobs from boot(ctx). buildVerticalCtx grew six fields the compliance code needs: resolveMember, createAccrualActivity, getCustauth, fireNotificationEvent, caches (for ppiiWeights + ppsiSubdomainWeights consumed by POST_ACCRUAL custauth), and formatDateLocal (under ctx.dates). Audit-helper decision per Design Decision 4: pass-through (a) — compliance does its own audit SQL via ctx.getDbClient(), same shape pointers.js used; revisit a shared writeAudit helper after Phase 4/6 reveal whether audit shapes diverge. Bonus fix during the move: DRUG_TEST_MISSED's link allocation in the original code did raw 'UPDATE link_tank SET next_link = next_link + 1 ... RETURNING next_link - 1' which violates feedback_use_getnextlink.md. Swapped to ctx.getNextLink(tenantId, 'compliance_result') during the move — identical semantics, one anti-pattern killed. Phase 3 verifiable: server boots clean on SERVER_VERSION 2026.05.27.1700, tests/insight/test_compliance.cjs passes 9/9, full suite 46/46 (904 assertions), lint count unchanged at 28 (compliance had no PPII/PPSI/Clinician strings to lose — real drops come in Phases 4–6 per inventory §10). Not deployed to Heroku — Heroku waits until Phase 6 finishes. Also in Session 127 (commits ad92b73 through 7e9b800) — 5 Delta UI smoke tests added in tests/delta/ catching the destructive-save reverts on bonus/promotion/molecule edit, the typeahead silent-failure on airport code entry, and the CSR green-block grouping regression. Delta UI coverage was near-zero before; now decent. Also Session 128 (commit 093d4c8) — mirrored Claude's auto-memory files into docs/claude-rules/ so 90+ sessions of rules/feedback/project notes survive a Mac wipe and are visible to GitHub readers. Source of truth still lives in ~/.claude/projects/-Users-billjansen-Projects-Loyalty-Demo/memory/; mirror gets pushed alongside other docs commits. EXPECTED_DB_VERSION 78. Heroku still at SERVER_VERSION 2026.05.27.0200 / DB v78 from Session 126 — extraction work has not deployed yet, by design. v47 header preserved below. v47 — Session 126: Licensing Board moved off bolt-on UI onto the molecule template path on csr_member.html. The base loyalty CSR page had a hardcoded Licensing Board form-row + load function + two PUT save fetches, surfacing for every tenant under display:none gating — a tenant-specific field bolted into platform-generic code. The right pattern was already in place: LICENSING_BOARD molecule (molecule_id=139 for tenant 5, value_kind=external_list, attaches_to=M, context=member) with a molecule_value_lookup row (id=94) pointing at the licensing_board catalog table (id_column=licensing_board_id, code_column=board_code, label_column=board_name), the storage helpers (getMoleculeRows / insertMoleculeRow / encodeMolecule), and the TemplateFormRenderer that drives the "Additional Information" section on csr_member.html via input_template activity_type='M'. Same plumbing Delta's Passport (template_id=4, "Member Profile Attributes", molecule PASSPORT id=49) uses. The only missing piece was the wi_php input_template for activity_type='M' — v62 originally created one (Physician Member Template with LICENSING_BOARD / ASSIGNED_CLINICIAN / IS_CLINICIAN), v63 dropped all wi_php non-A templates under the misread that 'M' meant "promotion" (the author thought wi_php was A-only and the M-type was inapplicable). 'M' is the activity_type used by input_template for member-attached field forms — same semantic Delta uses. db_migrate v75 re-creates the wi_php Member Profile Attributes (M) input template with a single LICENSING_BOARD field (row 10, start 1, width 50, sort 1); guards against double-insert by checking for any existing wi_php M template before creating. Removed from csr_member.html: the licensingBoardRow form-row (was ~line 1243), the loadLicensingBoardDropdown call + function definition (~line 3313), the two licensing-board PUT fetches in the enroll-mode and edit-mode save paths (~lines 3520 + 3588). Left intact: the /v1/licensing-boards catalog CRUD endpoints (admin_licensing_boards.html still uses them as the catalog admin page) and the /v1/members/:id/licensing-board GET+PUT endpoints (verticals/workforce_monitoring/physician_detail.html still uses them — they are thin wrappers around the molecule helpers, so leaving them costs nothing). NO data migration — licensing board values were always stored in the molecule layer; the dedicated endpoints were always thin wrappers around encodeMolecule / insertMoleculeRow / getMoleculeRows. Verified end-to-end in browser preview: wi_php participant 102 (David Chen) shows "Additional Information → Licensing Board" with 5 options (DEB/MEB/PACB/PEB/SBN) populated from the catalog; Delta member 2153442807 (Bill Jansen) shows "Additional Information → Passport Number" with stored value "P1234" and ZERO references to "Licensing Board" anywhere on the page. EXPECTED_DB_VERSION 75. Process note: this session took longer than the change merited because Claude kept treating csr_member.html as "Delta's page" rather than "the base platform CSR page that tenants are skinned onto"; Bill had to correct the framing three times before code edits started. Memory updates queued: feedback_platform_first_framing.md (the platform is the product, tenants are skins; don't lecture about "Delta vs wi_php" as if they were separate apps). v46 header preserved below. v46 — Sessions 115–120: alert conversion + four-step expansion-prep refactor series + PPII math correction. Big-picture story: the platform is being prepped for state #2 (Washington/Tennessee/Minnesota first responders). The cost of onboarding a new state should be SQL INSERTs into config tables, not code edits to per-tenant JS files. Four hardcoded items moved from code to data; one real math bug found and fixed along the way. Session 115 — Alert promotions → bonuses cutover. The 25 wi_php "alert" promotions (sentinels positive/refused/suspended, PPII Red/Orange/Yellow, Pulse Q3, PPSI Q3, Stability immediate/emerging, Event Severity 3, PPII trend up / spike / Protective Collapse, 12 Extended Cards M1-M3 / T1-T5 / F1 / D2 / D3) were never really promotions — they fire on a single qualifying activity and dispatch an external action, which is the bonus pattern. Promotions are accumulators (multi-activity progress over time). v67 migration widens bonus.bonus_code 10→20 and bonus_description 30→100 to match promotion's widths, creates one bonus + bonus_result row per alert reusing the same rule_id and same external_result_action mapping (SR_SENTINEL/SR_RED/SR_ORANGE/SR_YELLOW → createRegistryItem), and marks the 25 old promotions is_active=false (historical member_promotion rows preserved as audit history). v68 adds the BONUS_RESULT molecule_def + molecule_value_lookup for tenant 5 — the Bonus Result Engine was rolled out for Delta originally so only tenant 1 had this molecule, and the bonus engine silently skipped external dispatch (`if (!bonusResultMoleculeId) continue;`) until we added it for wi_php. Also fixed createRegistryItem to accept activityDate as either a Date object (bonus engine path — comes pre-hydrated via hydrateActivityDates) or a YYYY-MM-DD string (promotion engine / direct custauth call path); previously the handler did `new Date(activityDate + 'T00:00:00')` which silently coerced Date objects to NaN, crashing stability_registry INSERT with "smallint NaN". Promotion path always passed strings so the bug never showed pre-cutover; bonus path passes Date objects and exposed it. Signal-based trigger flow in custauth.js POST_ACCRUAL is engine-agnostic by design: it creates a second activity via internal HTTP carrying the SIGNAL/EXTENDED_CARD molecule, the standard accrual flow then calls evaluateBonuses on that second activity and the bonus engine catches it the same way evaluatePromotions used to. No custauth changes, no external_result_action changes, no createRegistryItem changes (other than the date-format tolerance). Equivalence proved by the existing 41-test suite staying green: 870/870 assertions before, 870/870 after. Session 116 — Refactor #1: urgency + sla_hours columns added to external_result_action; hardcoded urgencyMap deleted from createRegistryItem. v69 backfills the existing 4 rows (SR_SENTINEL=SENTINEL/0, SR_RED=RED/24, SR_ORANGE=ORANGE/48, SR_YELLOW=YELLOW/72). Three engine SELECT sites (promotion engine ~line 9032, bonus engine ~line 14238, processPromotionResult ~line 15678) now pull urgency + sla_hours alongside action_code/action_name/function_name and pass them through actionContext. createRegistryItem reads them from ctx when present, else looks them up from external_result_action by action_code (direct internal callers like MEDS / T5 / T6 / F1 escalations still pass actionCode only — those continue to work via the per-call lookup). A new state that wants e.g. SR_RED with a 12-hour SLA now changes one DB row, no code. Session 117 — PPII composite math correction (real bug, clinically significant). scorePPII.js composeFromContributions was calling normStream() per stream which rounds each normalized 0–100 value to an integer BEFORE the weighted sum, then rounds the weighted average AGAIN at the end. Across most input values this agreed with the unrounded formula; at boundary inputs it shifted the composite by 1 point — sometimes crossing a band threshold (Yellow 35 / Orange 55 / Red 75) and changing clinical classification. Fix is contained to composeFromContributions: compute each stream's normalized value as an unrounded float inline, weighted-sum, round ONCE at the end. normStream() is unchanged — still used by ppiiBreakdown() for displayable per-stream integers, which is the right behavior for per-stream rendering. Discovered when the PPII history snapshot test's recompute-from-components math (single round at end) disagreed with the platform's stored composite — the test was correctly flagging the inconsistency. After the math fix, triggered the existing "Recalculate Member Scores" admin endpoint against the local DB to write a new ppii_score_history row per member under the corrected math; manually re-tagged the 13 rows from trigger_type='WEIGHT_CHANGE_RECOMPUTE' to 'MATH_CORRECTION' for an honest audit trail. Zero members actually shifted (no boundary cases in current seeded data) — but Patricia would have hit a 1-point shift on her next severity-1 event, which is what surfaced the bug. Will need the same recalculate click on Heroku after deploy. Session 118 — Refactor #2: follow-up schedule library out of pointers.js scheduleFollowups (hardcoded JS if/else ladder per urgency/extended-card) into a new followup_schedule table. v70 creates the table with partial unique indexes (one for tenant+urgency rows where extended_card IS NULL, one for tenant+extended_card rows where urgency IS NULL) and a CHECK that exactly one of urgency/extended_card is set per row. Seeded wi_php verbatim from the prior hardcoded JS: SENTINEL 4 steps, RED 6 steps, ORANGE 3 steps, YELLOW 3 steps, T1 override 4 steps, T5 override 3 steps — 23 rows. scheduleFollowups() rewritten as a thin SELECT-and-INSERT loop: extended_card lookup wins if present, urgency lookup is the fallback, one registry_followup row per matched step. Adding a state that wants e.g. SENTINEL at 12h + weekly×3 = INSERT. Session 119 — Refactor #3: PPII threshold bands out of custauth.js PPII_THRESHOLDS const into admin_settings. v71 creates the admin_settings table (key/value per tenant, UNIQUE on tenant_id+setting_key, description column, updated_at timestamp, tenant_id index) and seeds 6 rows: ppii_red_threshold=75, ppii_orange_threshold=55, ppii_yellow_threshold=35 (the three bands for this refactor) plus pattern_trend_periods=3, pattern_spike_delta=15, pattern_protective_periods=2 (the pre-existing pattern_* keys that custauth.js was already querying with a try/catch fallback because the table didn't exist before). Pattern triggers now run on explicit DB values instead of the fallback path. custauth.js renamed the PPII_THRESHOLDS const to PPII_THRESHOLDS_DEFAULT (module-level fallback) and added a per-POST_ACCRUAL lookup that overrides defaults with admin_settings values; same try/catch shape as the pattern_* lookup. Session 120 — Refactor #4: event severity threshold + signal name out of custauth.js PRE_ACCRUAL hardcoded literals (`>= 3` and 'EVENT_SEVERITY_3') into admin_settings. v72 seeds event_severity_threshold=3 and event_severity_signal_name='EVENT_SEVERITY_3' for tenant 5. PRE_ACCRUAL keeps the cheap ACCRUAL_TYPE='EVENT' branch check first so the DB lookup only runs for EVENT activities, with the same try/catch fallback pattern. Completes the four-step expansion-prep series: v69 external_result_action.urgency/sla, v70 followup_schedule table, v71 PPII thresholds → admin_settings (and pattern_* table now exists), v72 event severity → admin_settings. Across all four refactors: behavior unchanged day one (seeded values match prior constants exactly), full test suite stayed 41/870 green throughout, no admin UI built (deferred — Bill writes the SQL INSERTs per new tenant; UI gets built if/when non-developer tuning becomes a felt need). Process honesty: this two-day stretch also surfaced the "stop spawning tasks the user said to defer" lesson — the day-of-week-on-promotions task ran out of band as a chip that auto-fired, landed clean code on main (Session 114, commit d7355f3), and Claude burned ~30 minutes panicking about it before realizing the work was actually good and just needed db_migrate locally. Also surfaced the "manual spot-checks pollute test state" lesson — a single live curl during refactor #1 verification perturbed Patricia's PPII enough that the snapshot test landed at a boundary case and exposed the composeFromContributions rounding bug. That was actually a net positive in retrospect (the bug was real and clinically significant), but the path to finding it took longer than it should have because Claude initially blamed refactor #2. SERVER_VERSION 2026.05.18.1903, EXPECTED_DB_VERSION 72. Heroku still at v72 / DB v65 — none of today's work has shipped to production yet. When deploying: push code, run `node db_migrate.js` against Heroku, then click "Recalculate Member Scores" once on admin_ppii_weights.html for the math correction audit trail. v45 header preserved below. v45 — Session 113: Erica's round-2 feedback shipped + Member Demo Site routing restored. Erica reviewed Session 112's fixes and approved 3 of 3 design picks (text inputs / profile-edits-on-timeline / recalculate drill-down), plus the PPSI_Q3 label rename. She clarified one item: profile edits should live on the participant's profile page (csr_member.html), NOT inline on the activity timeline — too noisy. Reverted the Session 112 timeline merge; built the profile-page version instead. Round-2 work shipped to Heroku v71 / DB v65: (a) admin_ppii_weights.html + admin_ppsi_section_weights.html — removed `<input type="range">` sliders entirely; kept the visual bar (read-only) + the existing typeable number input as the only interactive control. (b) `GET /v1/member/:id/profile-log` returns audit_log_5 'E' events for the member, grouped by audit event with per-field old → new diff + timestamp + user; new "Profile Update Log" section on csr_member.html renders this; new "Edit Profile" button on the participant chart's action bar (next to Compliance / Event / Pulse / Export / Full PPSI) opens csr_member.html. PUT /v1/members/:id/licensing-board now writes a logAudit row so licensing-board changes surface in the profile-log. Timeline merge in /v1/member/:id/activities BACKED OUT (the CLINICAL_FIELDS whitelist that synthesized ACCRUAL_TYPE='PROFILE' pseudo-activities was removed). (c) `POST /v1/tenants/:id/ppii-weights/recalculate` now returns `members[]` — each entry `{membership_number, fname, lname, prior_score, new_score, delta, prior_weight_set_id}`, sorted by largest absolute delta first. admin_ppii_weights.html shows a "View details →" link on the result indicator; click opens a modal table with old → new → Δ columns. (d) `GET /v1/member/:id/ppsi-history` mirrors the PPII history pattern but uses ppsi_subdomain_weight_set.effective_from as the cutover anchor — reads the latest non-voided PPSI activity that predates the cutover, normalizes via score_math_version, returns null when no weight change has happened or no prior PPSI exists. physician_detail.html: new "Previous: <score> — pre-<date>" sub-line under the Last PPSI card; renderTrend() draws a vertical dashed purple "weights changed" marker on the trend canvas at the cutover date when it falls inside the visible range. Stashes the cutover date on window.PPSI_CUTOVER_DATE for the renderer. (e) Notes filter on physician_detail.html relabeled "💬 Notes" → "💬 With Notes" with a tooltip clarifying it shows Surveys/Pulses/Events that have a comment attached (not freeform staff/participant notes). (f) PPSI_Q3 user-facing labels renamed via db_migrate v65: rule_criteria.label "PPSI Question Score 3" → "PPSI Severe Item Response", promotion_name "PPSI Q3 — Registry Alert" → "PPSI Severe Item — Registry Alert", promotion_result.result_description rewritten to "Severe response on a single PPSI item (any item scored 3 of 3)". Internal signal code 'PPSI_Q3' stays — only human-readable labels change. Tests: C21 rewritten (35 assertions) — now verifies profile-log endpoint shape + that profile pseudo-activities no longer appear on /activities (timeline merge backout). C22 new (12 assertions) — Previous PPSI endpoint shape, score range, date format, cutover sanity, 404 on unknown member, 400 on missing tenant_id. Full suite: 41 tests, 863 assertions, all passing. SERVER_VERSION 2026.05.12.1000, EXPECTED_DB_VERSION 65. Email reply to Erica drafted at docs/ERICA_FEEDBACK_REPLY_SESSION_113_ROUND2.md, awaiting send. Member Demo Site routing — separate bug discovered late-session, NOT yet pushed/deployed. Design (verified in current code): three-tier static-file middleware at pointers.js:7205 walks tenant-specific override → vertical shared → project root for the selected tenant. Bug was all three tiers missing the index.html file → "Cannot GET /index.html" 404 when superuser clicked "Open Member Demo Site" from menu.html. Fix landed LOCALLY: (1) new `verticals/workforce_monitoring/tenants/wi_php/index.html` — Wisconsin's Tier 1 override, a meta-refresh + JS redirect to verticals/workforce_monitoring/dashboard.html (same destination Erica's login routes to). (2) new project-root `/index.html` — generic "🚧 Under Construction" page with Back-to-Menu link for tenants without their own. (3) `app.use(express.static(__dirname, { index: false }))` so express.static does NOT auto-serve index.html for `/` directory requests — preserves `app.get('/')` → `/login.html` redirect for the root URL. Verified locally via curl: Wisconsin session → redirect to dashboard; Delta session → Under Construction; root `/` → login redirect. Three files uncommitted/unpushed/undeployed; queued for next session. Process note: this 2-file restore took ~2 hours due to Claude over-engineering (proposed building new routing logic, repeatedly conflated Erica's CSR dashboard with the Member Demo Site, dug git history despite being told not to, claimed understanding before tracing the full chain, broke the `/` → `/login.html` redirect on the way to the fix). Lessons → memory: feedback_context_degradation.md + feedback_answer_easier_question.md. Heroku at v71 (Session 113 round-2 deployed) / DB v65. v44 header preserved below. v44 — Session 112: Erica's post-rollout feedback batch. Six bug fixes against the v43 PPSI editor cut, three new regression tests (C17/C18/C19), one demo-data migration (db_migrate v64). MEDS member status: GET /v1/meds/member/:memberLink was passing membership_number directly into member_link comparisons in subqueries (CHAR(5) vs string) so every cadenced item read as never_completed regardless of whether the participant had completed the survey. Fix: resolveMember(membership_number, tenantId) at the top of the endpoint, then memberRec.link in subqueries — completed items now advance correctly (Grace Newfield #46 was Erica's reproducer). C18 test (12 assertions) covers the membership_number → member.link resolution + 404 for unknown numbers + status-reflects-completed-surveys invariant. Insight Recovery PPSI history seeded — Erica reported Recovery participants had no trend graph; root cause was zero engineered PPSI activity for the Recovery clinic personas (only Insight Health Solutions had history). db_migrate v64 seeded 10 Recovery participants × 4 surveys each = 40 PPSI surveys + 1360 answers + 40 PPSI scoring activities + 40 ppii_score_history snapshots, spaced across the prior 90 days, with answer distributions tuned to match each persona's registry urgency tier (RED/ORANGE/YELLOW/SENTINEL drivers). All 4 surveys per participant get score_math_version=2 (Option A) so they consume the new editor's weights. First v64 attempt failed with 'value 209390400000 out of range for type integer' (wrong scale on member_survey.start_ts — used billDay*100 instead of /10) and a second attempt failed 'link_tank has no row for activity' (custom inline nextLink didn't auto-create the link_tank row). Fix: switched to 10-second-block timestamps via (billDay + 32768) * 8640, and replaced the inline link allocator with the imported getNextLink helper which auto-discovers schema and creates link_tank rows on first use. Follow-up sort order fix — completed follow-ups were sorted oldest-first inside the completed slice, pushing the most recent completion to the bottom of the list. /v1/registry-followups ORDER BY rewritten to put pending items first (scheduled_date ASC) then completed items (completed_ts DESC). C10 test extended with two new sort-order assertions. Edit Participant scroll + Back-nav fix — the Save button was rendering below the fold at <600px viewport with no scroll affordance, and Back from Edit Participant was always returning to /csr_member.html instead of the originating clinic roster. Tried multiple flex-chain repairs (min-height:0 plumbing, force flex on app-layout, fix tab-container display override) — all blocked on different downstream constraints. Settled on the pragmatic fix: revert csr_member.html to natural body scroll (lp-header is position:fixed so stays pinned anyway) and remove the inner-flex-scroll machinery. New goBackFromMember() reads enroll_context and routes back to clinic.html (with program_id/partner_id) when the user came in via the roster, dashboard otherwise. Old physician_management.html replaced with a meta-refresh + JS redirect to dashboard.html — page is deprecated, only reachable via stale URLs/bookmarks, redirect avoids the 'no clinic context' error. Pulse return-to-chart fix — Erica reported that completing a pulse on a participant chart bounced the user back to the roster, losing their place; same complaint applied to the staff-search and roster-row-click entry paths. Three entry paths into clinic.html's pulse flow now share one mechanism: a let pulseReturnToChart variable populated by (a) the auto-launch IIFE when ?action=pulse&memberId=… is on the URL (admin path from physician_detail.html → launchPulse), (b) startPhysicianSearch's MemberSearchModal callback, and (c) rowPulse on the roster row. offerCGIS's afterAll() callback branches on the flag and calls PageContext.navigate('physician_detail.html', { memberId, programId }) when set, else falls back to loadDashboard(). Flag is cleared after consumption so a subsequent pulse-from-roster doesn't inherit stale state. C19 test (11 assertions) covers the static wiring (declaration + all three set sites + offerCGIS routing branch + flag-cleared-after-use) and a browser end-to-end check (navigates to clinic.html with action=pulse, asserts the flag was populated, intercepts PageContext.navigate, calls offerCGIS, asserts the recorded navigation target is physician_detail.html with the right memberId). PPSI sub-domain weighting routing test (C17 — Session 111 backfill) — earlier session shipped pickPPSIDriverSection that ranks declines by (rawDelta/sectionMax) × weight when subdomainWeights are supplied, but no test covered the weight-vs-raw divergence cases. C17 (6 assertions) verifies fallback to raw delta when no weights, GLOBAL emphasis flips ranking, equal weights ties broken by raw delta, zero-weight sections get suppressed even when they have the largest decline, and a flat-baseline returns null. T6 protocol card library entry — Erica found that clicking the T6 badge on Yellow/Orange registry items open 3+ weeks went to a dead end. Root cause: the F1_T5 detection sweep in pointers.js had been writing registry rows tagged EXTENDED_CARD: 'T6' / PROTOCOL_CARD: 'T6' since Session 100, but T6 was never added to protocolCards.js. The inline modal lookup failed, fell back to opening protocol_cards.html#T6 in a new tab — which also had no T6 entry — so the click did nothing visible. Fix: added T6 ('Repeated Moderate — Early Warning') to PROTOCOL_CARDS modeled on T5's structure (trajectory category, 5 protocol steps, the same modal-required fields), with timelines tuned for the 3-week early-warning window between T5's 12-week chronic threshold. Added T6 to CARD_CATEGORIES.trajectory.cards, CARD_PRIORITY (positioned above T5 since T6 fires first chronologically and T5 supersedes at week 12), and DETECTION_RULES (rule text mirrors the actual SQL: open Yellow/Orange registry item for 21+ consecutive days with no open T5/T6 already on the participant). New test C20 (23 assertions) is the first library-completeness invariant on the platform: scans pointers.js + dominantDriver.js + custauth.js for every literal EXTENDED_CARD/PROTOCOL_CARD card code the detection engine writes and asserts each has a PROTOCOL_CARDS entry; verifies internal consistency (every code in CARD_CATEGORIES, CARD_PRIORITY, DETECTION_RULES resolves to a library entry); modal-field quality gate (every library card has id/name/category/categoryLabel/color/summary/steps/assignment/successMetric/escalationTrigger non-empty); browser end-to-end check on action_queue.html that clicking T6 opens the inline modal AND does NOT fall through to window.open (the user-visible symptom Erica reported). The literal-string scan only covers the F1_T5 sweep family (T1-T6, F1) — S1, A1-A8, P1-P5, M1-M3, D-series flow through dominantDriver.js variable lookups and are caught by the internal-consistency invariant instead. A future T7 added to the detection sweep without a library entry now fails C20 immediately. Full suite: 39 tests, 795 assertions, all passing on local v64. Heroku still at db v63 / SERVER_VERSION 2026.04.28.0900 — auth dropped before push, deferred until Bill re-runs heroku login. SERVER_VERSION 2026.05.08.1430, EXPECTED_DB_VERSION 64. v43 header preserved below. v43 — Session 111: PPSI subdomain section weights editor (Erica's Option A math). New v59 schema (ppsi_subdomain + ppsi_subdomain_weight_set + ppsi_subdomain_weight_set_value) mirrors the v58 streams pattern with an extra is_factory_default flag on the weight set. Seeded the 8 wi_php sections (SLEEP/BURNOUT/WORK/ISOLATION/COGNITIVE/RECOVERY/PURPOSE/GLOBAL — codes match survey_question_category.category_code) with TWO equal-weight bundles: a factory-default anchor (is_current=false, is_factory_default=true) that the Restore Defaults button reads from, and an editable current row (is_current=true). Both seeded at 0.125 each and diverge once Erica edits. v60 added member_survey.score_math_version (1=legacy raw sum, 2=Option A) so the cutover is per-survey identifiable; existing 113 rows backfilled to 1, ppii_stream.max_value for 'ppsi' lowered 102→100 to match the new normalization scale. v61 rescaled any pre-existing ppsi components in ppii_score_history_component from 0..102 → 0..100 (zero rows in practice). scorePPSI.js rewritten — Option A: per-section sum/section_max → fraction × section weight → sum across sections × 100, returns 0..100 plus score_math_version: 2 in the result envelope. Subdomains and weights flow into the scorer via context (caller passes from caches.ppsiSubdomains and caches.ppsiSubdomainWeights). Survey-submit restructured so end_ts and score_math_version are written together in ONE UPDATE (rather than the prior end_ts UPDATE plus a later score_math_version UPDATE) — two separate UPDATEs on the same member_survey row in one transaction caused PG to take FOR KEY SHARE on the parent member tuple, deadlocking with createAccrualActivity's FOR UPDATE on the same row. The single combined UPDATE skips the FK re-validation entirely. Discovered + fixed mid-session via pg_locks inspection during a hung curl reproduction. Read-side branching: fetchPpsiRaw, /v1/wellness/members's ppsi query, gatherMemberFeatures's ppsiScores query, custauth.js POST_ACCRUAL ppsiResult+ppsiPrior queries all LEFT JOIN member_survey via d4.n1 (MEMBER_SURVEY_LINK is a size-4 numeric stored as offset-encoded int identical to ms.link, so direct integer JOIN works) and normalize per math_version (`v === 2 ? round(score) : score * 100/102`). PPII_MAXIMA.ppsi changed 102→100 in scorePPII.js so calcPPII consumes the post-normalization value as identity. New endpoints (mirror v58 PPII triplet): GET /v1/tenants/:id/ppsi-section-weights returns sections joined to BOTH the current and factory weight sets so the UI can render factory hints + gate Restore Defaults; PUT validates body covers active subdomain codes + sum=1.0, transactional flip-and-insert on the partial unique index; POST .../restore-defaults reads the factory row and seeds a new is_current row from those values, leaves factory untouched. All three reload caches in-place preserving factory_weight_set_id. New admin page admin_ppsi_section_weights.html — 8 sliders driven by the GET response's sections array (no hardcoded list), per-section factory hints (highlighted when current diverges), sum indicator, save gating, Restore Defaults button gated on (no-unsaved AND not-already-at-factory), Recent Changes panel with FACTORY + CURRENT badges, no ML retrain panel. Equivalence verification: ppsi_norm BYTE-IDENTICAL pre/post for all 9 wi_php members with PPSI scores (5→5, 19→19, 1→1, 35→35, 33→33, 83→83 …); PPII composite drifts 0–2 points on 5 of 9 because PPII_MAXIMA.ppsi shifted 102→100 — expected and within tolerance. Existing PPSI scores explicitly NOT recomputed — pre-cutover member_survey rows carry score_math_version=1 and their MEMBER_POINTS molecule values stay at 0..102 raw sum, normalized to 0..100 only at read time. Erica's reply (April 26) confirmed Option A + equal-weights default + Restore Defaults; design unblocked. SERVER_VERSION 2026.04.26.1500, EXPECTED_DB_VERSION 61. v42 header preserved below. v42 — Session 110 (cont'd): PPII history audit, slice D — Recent Changes panel + Recalculate-for-everyone on the admin weights page. GET /v1/tenants/:id/ppii-weights now also returns recent_changes (last 10 ppii_weight_set rows joined to platform_user for changed_by, with per-stream weights collapsed into one entry per row). New POST /v1/tenants/:id/ppii-weights/recalculate (superuser only) iterates every member with at least one ppii_score_history row, recomputes their composite from stored components × current weights inside one transaction, and writes a new row tagged trigger_type='WEIGHT_CHANGE_RECOMPUTE'. Members with no prior snapshot are left alone — they'll get one organically on next survey/pulse/event activity, which keeps the recompute side-effect bounded. Admin UI on admin_ppii_weights.html: new Recalculate Member Scores section with confirmation dialog and result indicator + new Recent Changes section with v# label, CURRENT badge on the active row, weights breakdown, change_note italic, who/when. Both buttons gated on no-unsaved-changes (saving must precede). saveWeights() reloads the GET response after a successful PUT so the new entry shows in Recent Changes immediately. Test extended to 52 assertions: snapshot under v1, weight change to v2, second snapshot under v2, recent_changes shape verification, recalculate writes one WEIGHT_CHANGE_RECOMPUTE row per member with prior history, non-superuser POST recalculate → 403. Slice closes the streams audit story end-to-end (B writes snapshots, C displays Previous PPII on chart, D recomputes everyone after a weights change + shows the audit trail). Full suite: 35/35 tests, 690/690 assertions. PPSI subdomain editor unblocked by Erica's reply (Option A normalize-first-then-weight, equal-weights default, Restore Defaults factory-reset button) — slice queued for next session. Erica explicitly delighted with audit/history design as proposed. v41 header preserved below. v41 — Session 110 (cont'd): event-detection bug fixed across three call sites. ACCRUAL_TYPE is a Dynamic-text molecule whose values live in molecule_value_text (rows: SURVEY/COMP/EVENT/OPS/WEAR/PULSE/ANCHOR_SURVEY); 5_data_1.c1 is a 1-byte squish-encoded value_id (decode: ASCII(c1) - 1). Custauth.js's events query had been joining molecule_value_embedded_list — empty for this molecule — so the events stream was silently null for every PPII snapshot ever written. Wellness/members's loose NOT-EXISTS filter was effectively masking the bug by treating any-untagged-as-event. Fix: all three sites (wellness/members, custauth POST_ACCRUAL, ppiiStreamFetchers.fetchEventsRaw) now join molecule_value_text with mvt.value_id = (ASCII(d1.c1) - 1) AND mvt.text_value = 'EVENT'. All 169 demo activities are properly tagged (65 SURVEY, 43 COMP, 33 EVENT, 27 PULSE, 1 ANCHOR_SURVEY) — the strict filter now works correctly. Tiebreaker on a.link DESC kept for stable selection across same-date events. 4 of 5 baseline members now match exact pre-refactor PPII (James 18, Michelle 20, Elena 26, David 36); Patricia 62 vs baseline 46 — the difference is the new deterministic tiebreaker picking the higher-link severity-3 event vs the prior nondeterministic pick of the severity-1 event among same-date ties (the new pick is correct: same-day data, deterministic order). Snapshot test now also captures the events component (assertions 33 → 34) since the join works. Note: pg_restore-based test snapshots can leave the in-memory ppiiWeights cache stale (cache holds a higher weight_set_id than the restored DB) — restart the server when running individual tests after a full-suite run; full-suite runs are unaffected because tests advance the cache and DB together. v40 header preserved below. v40 — Session 110 (cont'd): PPII history audit, slice C — Previous PPII visible on participant chart. New endpoint GET /v1/member/:id/ppii-history?tenant_id=N&limit=N (matches the existing /v1/member/:id/activities pattern) returns recent ppii_score_history rows with components inlined and the tenant's current_weight_set_id for the chart's 'Previous' rule. physician_detail.html: new sub-line under the PPII Score card reads from the endpoint and renders 'Previous: <score> — weight set v<id>, <date>' only when the most recent snapshot under a non-current weight set exists; hidden cleanly otherwise. Test extended to 33 assertions: submits an event under v1 weights, verifies the snapshot via the new endpoint, PUTs new weights to create v2, submits a second event, verifies one snapshot under v2 (current) and one under v1 (the chart's Previous anchor), confirms picking 'most recent snapshot where weight_set_id != current' yields the v1 row. Slice C surfaces a known cross-path inconsistency: wellness/members's live PPII calc and custauth's snapshot calc pick different 'latest events' when data has same-date ties (NOT-EXISTS-survey-molecules vs JOIN ACCRUAL_TYPE='EVENT'). The chart can show Current and Previous numbers that look inconsistent. Fix proposed for the next slice — converge wellness onto the per-member fetcher registry (calcPPIIFromMember) so both paths read identical inputs. Slices D (Recalculate-for-everyone button) and E (wellness-converge) still ahead. Full suite: 35/35 tests, 671/671 assertions. v39 header preserved below. v39 — Session 110 (cont'd): PPII history snapshots wired (slice B of Erica's audit/history feature). New scorePPII.recordPpiiSnapshot helper writes one ppii_score_history row + one ppii_score_history_component row per non-null stream; called from custauth.js POST_ACCRUAL right after calcPPII so every survey/pulse/compliance/event activity that produces a new PPII captures a defensible snapshot — composite + raw stream values + weight_set_id in effect + trigger_type (data.ACCRUAL_TYPE). Component rows skip null streams so 'no data' is distinguishable from 'raw value = 0' on read-back. weight_set_id sourced from caches.ppiiWeights.get(tenantId).weight_set_id (the v58 cache shape change). Snapshot failure is caught and logged so audit-write regressions don't break the accrual pipeline. Read-side endpoints (/v1/wellness/members) intentionally do NOT snapshot — those would write thousands of rows per dashboard load. New regression test tests/insight/test_ppii_history_snapshot.cjs (14 assertions): submits an event for Patricia Walsh, verifies one row appears in ppii_score_history with the correct tenant_id / p_link / weight_set_id / trigger_type='EVENT' / score-in-range, verifies component rows for every non-null stream, and verifies the math invariant — components + snapshot weights reproduce the stored score under proportional reweighting. That invariant is what makes the upcoming "Recalculate for everyone" button trivial: every member's score under any new weight set can be derived from stored components without re-querying activity. Sets up slice C (chart shows Previous PPII when weights change) and slice D (Recalculate button on admin weights page). PPSI subdomain editor still blocked on Erica's three answers (section names, math A vs B, defaults). Full suite: 35/35 tests, 652/652 assertions. v38 header preserved below. v38 — Sessions 109 + 110: PPII streams config-driven refactor. Replaces the v57 sysparm-based ppii_weights with five purpose-built tables (db_migrate v58): ppii_stream (per-tenant dictionary of streams — code, label, max_value, source_function, is_active, sort_order, added_in_phase), ppii_weight_set (versioned weight bundles with effective_from / changed_by_user / change_note / is_current and a partial unique index enforcing at-most-one-current per tenant), ppii_weight_set_value (one row per set+stream), and audit-snapshot tables ppii_score_history + ppii_score_history_component (built but not yet wired — pending Erica's reply on history/audit scope). Migration seeded the four wi_php streams (pulse/ppsi/compliance/events with their max values + source_function names) and migrated the prior sysparm 'ppii_weights' row into ppii_weight_set #1 inside one transaction with sum-to-1.0 + orphan-code verification before dropping the sysparm row. New ppiiStreamFetchers registry in pointers.js with four async per-member fetchers (fetchPulseRaw, fetchPpsiRaw, fetchComplianceRaw, fetchEventsRaw) — same activity-type/molecule filters as the existing wellness batch queries, scoped to a single member. scorePPII.js now exports calcPPIIFromMember alongside the legacy calcPPII; both share an internal composeFromContributions that applies proportional reweighting when a stream is null. ml_service.py composite formula uses W.get(code, 0) so unknown stream codes don't throw KeyError; retrain_with_weights.py no longer hardcodes the four pilot streams and replaces (not just updates) ml_service.PPII_WEIGHTS. pointers.js cache layer adds caches.ppiiStreams (tenant_id → active ppii_stream rows) and rewrites caches.ppiiWeights to load from ppii_weight_set + ppii_weight_set_value (is_current=true) with new shape { <stream_code>: weight, …, weight_set_id }. Legacy named-key access (weights.pulse, weights.ppsi, …) preserved so custauth.js, ML retrain endpoint, and inline /v1/wellness/members scoring read identical numbers. GET/PUT /v1/tenants/:id/ppii-weights endpoints rewritten against v58 — GET joins ppii_stream + ppii_weight_set + ppii_weight_set_value and returns { tenant_id, weight_set_id, streams[{code,label,max_value,sort_order,weight}], weights{}, sum, model_info } with the legacy 'weights' map kept for backward compat; PUT validates the body covers exactly the tenant's active stream codes (extras → 400, missing → 400), accepts an optional change_note, and in one transaction flips the prior is_current row to false then inserts a new ppii_weight_set with changed_by_user=session.userId and one ppii_weight_set_value per stream (UNSET-old before INSERT-new with FOR UPDATE on the prior row to handle the partial-unique-index race). admin_ppii_weights.html drops its hardcoded ['pulse','ppsi','compliance','events'] list and LABELS map and renders slider rows dynamically from the GET response's streams array — adding/removing a stream now requires only a ppii_stream row, no UI edit. Equivalence verification: full test suite passes 34/34 tests, 638/638 assertions identically. Three-way spot-check (Session 109 baseline / Heroku v55 / Local v58) showed the scoring chain produces identical output given identical inputs (Elena Vasquez matched all three exactly); the 3 members with input drift were traced to non-deterministic ORDER BY a.activity_date DESC ties in the existing wellness/members query — pre-existing behavior, unrelated to the refactor. EXPECTED_DB_VERSION 57 → 58. Heroku still at v55, intentionally behind. v37 header preserved below. v37 — Session 107: Multi-counter promotions (core platform capability). Every promotion can now track multiple "what to count" counters joined by AND or OR, e.g. "fly 20,000 miles OR take 20 flights" or "enroll AND complete 5 surveys." db_migrate v56 adds promo_wt_count + member_promo_wt_count tables and counter_joiner column on promotion + member_promotion; drops legacy count_type / goal_amount / counter_molecule_id / counter_token_adjustment_id from promotion and progress_counter / goal_amount from member_promotion; member_promotion_detail repointed from member_promotion_id to member_wt_count_id. 1-to-1 data migration — every pre-existing promotion becomes a single-counter promotion with joiner='AND'; pre/post row counts + sums verified inside the transaction. pointers.js: caches.promoWtCounts loaded at startup; createMemberPromotionEnrollment refactored to new signature (memberLink, promotionId, tenantId, enrolledDate, opts) — opts.startQualified / opts.startingProgressByWtCountId / opts.client; per-counter member_promo_wt_count rows created at enrollment snapshotting goal_amount. New helpers evaluatePromoQualifiedByJoiner(joiner, mpwcRows) and getMemberPromoWtCounts(mpId, {lockForUpdate, client}). New helper computeIncrementForCounter(counter, activityId, activityLink, activityData, tenantId) dispatches the count_type → amount branch per counter. evaluatePromotions rewritten as outer loop over promos, inner loop over member_promo_wt_count rows, joiner-based qualification at promo level. evaluateTokenActivity rewritten to walk promo_wt_count rows matching adjustment_id; per-counter increment. evaluateEnrollmentPromotions rewritten — seeds only enrollment counters to goal (not all counters), then checks joiner before firing results (mixed "enroll AND fly 5 times" promos behave correctly). Activity-delete cascade rewritten to reverse progress per counter via member_promotion_detail.member_wt_count_id. Admin /v1/promotions list + single + describe endpoints return legacy single-counter convenience fields plus a new `counters[]` array with per-counter detail. POST/PUT /v1/promotions accept a `counters[]` array (multi-counter authoring) and fall back to the legacy single-counter fields. /v1/members/:memberId/promotions returns aggregate progress + per-counter `counters[]` array. admin_promotion_edit.html: new accented "What to Count" section with add/edit/remove counter dialog and joiner dropdown (shows when ≥2 counters). csr_member.html: multi-counter promotions render as a stacked list of progress bars labeled with "Joined by AND/OR"; single-counter promotions keep existing compact display. EXPECTED_DB_VERSION bumped 55→56. New test tests/core/test_multi_counter_promotions.cjs — 12 assertions covering OR-qualifies-when-any-counter-hits-goal and AND-qualifies-only-when-all-counters-hit-goal end-to-end through the accrual pipeline. Full suite: 33 tests, 542 assertions, all passing (against real loyalty DB at v56). Retro-credit simulation (runPromotionSimulation) gated to single-counter promos for now — multi-counter simulation modeling is a future enhancement. Heroku not deployed this session (Heroku remains v54 / DB v55). v36 header preserved below. v36 — Session 106 (small, presentation-prep): Database Utilities admin page gets per-row DB version badge (green = current, yellow = behind, gray = unknown) and an Update button per row that runs db_migrate.js against that specific database via a live SSE log-streaming modal. Target DB version shown in the current-DB banner. EXPECTED_DB_VERSION lifted to a module-level constant in pointers.js (single source of truth; must stay in sync with db_migrate.js TARGET_VERSION). /v1/admin/databases now includes db_version per DB and expected_db_version at top level. New endpoint GET /v1/admin/database/:name/migrate spawns a child node db_migrate.js process with DATABASE_NAME env override (zero change for CLI callers), line-buffers stdout/stderr to SSE, and kills the child if the client disconnects. No DB changes. Heroku not deployed. Secure document management still next-up (deferred from Session 106 start per big-presentation timing). v35 — Session 105 complete: Bonus Result Engine (Delta), Erica April 11 feedback batch (Insight), Erica April 15 fix-up. Survey timestamps migrated from Unix seconds to Bill epoch datetime (db_migrate v55). platformToday() / platformTodayStr() / platformNow() / dateToBillEpochDateTime() consolidation — 42 scattered "today" computations replaced with single helpers. dateToBillEpoch merged into dateToMoleculeInt. Registry click-through fixed (type coercion). Mark in Error UI on survey + compliance detail modals (supervisor-only). Schedule Mode selector (cadence/random/undetermined) on compliance cadence edit. Export Chart button on participant chart (CSV + PDF with section selection). View Participant button on follow-up modals. PPSI/Pulse/validation-battery submission timestamp bug fixed. New browser test suite: tests/insight/test_participant_chart_ui.cjs — 17 assertions covering all the UI gaps Erica found. Full suite: 32 tests, 528 assertions. Heroku v54, DB v55. v34 header preserved below. v34 — Session 105: Bonus Result Engine (Delta) + Erica feedback batch (Insight). Bonus Result Engine: multi-result bonuses via new bonus_result table + BONUS_RESULT molecule (db_migrate v46); applyBonusToActivity loops over rows (points create Type N child activities, external results hang BONUS_RESULT molecule + fire action handler); 11 Delta legacy bonuses seeded as one-points-row each; CRUD endpoints; admin_bonus_edit Results dialog; csr_member verbose view shows ⚡ labels for non-point results. Erica feedback batch: removed Mobile tab from staff participant chart; clicking an open registry item in the chart jumps to Stability Registry with that item pre-opened (PageContext.openItemLink); follow-up detail now shows Next Follow-up link in Done section; participant chart open-items panel merges registry items + upcoming follow-ups + pending drug tests inline; registry item detail shows auto-generated follow-up chain with status badges; manual follow-up creation via POST /v1/registry-followups and "+ New Follow-up" dialog on action_queue. Soft-delete plumbing (db_migrate v47): voided_ts/voided_by/voided_reason on member_survey + compliance_result, partial indexes on non-voided rows, PATCH /v1/member-surveys/:link/void and /v1/compliance-results/:link/void endpoints. MEDS random-scheduled drug tests (db_migrate v47): schedule_mode + next_scheduled_date on member_compliance, parallel detection branch in processMedsForMember + calculateMedsNextDue that flags random items when next_scheduled_date passes with no satisfying non-voided result; cadenced branch now also honors voided_ts filter. Session 105 test fixes: updated 5 core tests to honor Delta's calculated flight miles (Session 104 calc_function fix), added MEDS to test_dominant_driver valid list. Session 105 final: 31/31 tests, 527/527 assertions. db_migrate v48 (stray test row cleanup). Heroku still at v48/DB v45 — not deployed. Session 104: ML v0.3.0 (3 new features), all 13 triggers complete, molecule single source of truth, bonus/promo UI redesign, Heroku v48/DB v45. Session 103: Bug fixes (5), test suite (16 tests/286 assertions/Playwright), terminology (Participant/Health Support Staff), feature requests (#9-18), licensing board system. Session 101: Notification Delivery System (core platform) — notification_delivery + notification_delivery_config tables, NOTIFY_DELIVER (5-min) + NOTIFY_DIGEST (daily) scheduled jobs, sendDelivery() stub for vendor swap, delivery window enforcement (7am-9pm, critical bypasses), per-tenant config, queue visibility page (notification_queue.html), dashboard nav card. db_migrate v35. Session 101: ML model retrained v0.2.0, molecule refactor, F1/T5 batch detection, db_migrate v34. Session 100: Protocol Card Reference Library (29 cards), Extended Card Detection Engine (9 detectors, 11 promotion rules), PPSI Safety Alerts, getNextLink shared module + link_tank fix. db_migrate v30-v33.)

# 1. What We Are Building

A predictive workforce stabilization platform for healthcare professionals. The system monitors physicians, nurses, and first responders through continuous data collection, calculates a composite risk score from multiple input streams, assigns a risk tier (Green/Yellow/Orange/Red), and triggers targeted interventions based on what is driving the destabilization --- before it becomes a crisis, a liability event, or a resignation.

Wisconsin Physician Health Program (PHP) is the pilot. 48 states need this. If validated, it scales nationally.

# 2. The People

## Insight Health Solutions

**Damian Novak:** Business lead. Seasoned entrepreneur, 200+ companies started/purchased/merged, successful NYSE IPO. 15 years transforming healthcare delivery — built a vertically integrated musculoskeletal care system acquired by HCA Healthcare. ECE degree from UW-Madison.

**Dr. Erica Larson, DO:** Clinical architect. Double board-certified in general psychiatry and child/adolescent psychiatry. Michigan State University COM. Founder of CORE Choice. Former medical director for a national telehealth organization and a major Wisconsin healthcare system. Led initiatives in physician wellness, trauma assessment, disaster mental health response. Leadership roles with Wisconsin Psychiatric Association, Wisconsin Council of Child and Adolescent Psychiatry, Wisconsin Medical Society, La Crosse County Medical Society, and AMA. Designed PPSI, Provider Pulse Survey, governance framework, scoring algorithm, and dominant driver routing.

**Dr. Thomas Joles, MD:** Family physician, U.S. Army veteran, health entrepreneur. Based in Chippewa Valley, Western Wisconsin. Practices outpatient family medicine with Cardinal Healthy. Battalion Surgeon in the Wisconsin National Guard. Medical Director and Owner of Everest Men's Health (multi-site). President of the Western Wisconsin Medical Society. Vice Chair of the Board of Directors of the Wisconsin Medical Society, Executive Committee member.

## Primada

**Bill Jansen:** Majority owner. Architect. 40+ years loyalty industry. Pointer platform creator.

**Joe Doran:** Primada partner. SVP at Kobie. Won Optum for Capillary with Bill. Direct Optum relationship.

**Mark Weninger:** Primada partner. Former CEO of Merkle and Razr. Enterprise data analytics. Designed the State of Wisconsin presentation.

**Brett Sanford:** Designated to run Primada Health.

**Edward:** Primada advisor. Damian's neighbor. His endorsement opened the door.

## Development Partner

**Caldera (John O'Neil):** Prime contractor for mobile/digital/UX. DoD and enterprise certs. Pointer provides engine via API.

# 3. Corporate Structure

Columbo Holdings owns all Pointer IP → licenses to Primada Health (healthcare vertical) → sublicenses to Insight Health Solutions. Primada Health holds 25% equity in Insight Health Solutions. Three-layer IP protection.

# 4. Key Terminology

**PPSI (Predictive Professional Stability Index):** The weekly self-report survey. 34 items across 8 sections, scored 0--3 each. Maximum: 102. One input into PPII.

**PPII (Predictive Performance Intelligence Infrastructure / PI^2):** The composite 0--100 number combining ALL data streams. Drives Green/Yellow/Orange/Red tier assignment.

**Provider Pulse Survey:** Clinician-completed instrument. 14 items, 7 sections, scored 0--3. Maximum: 42. Monthly or after encounters. Includes independent Provider Stability Alert.

# 5. Architecture --- The Core Insight

The Pointer platform was built to track members, process events, calculate status, detect behavioral patterns, and trigger actions. Healthcare professional monitoring is structurally identical to loyalty member engagement tracking. This is not an analogy --- it is the same data pattern.

| Concept | Loyalty | Healthcare |
|---------|---------|------------|
| Member | Frequent flyer | Physician in monitoring |
| Event | Flight, purchase, partner txn | Survey, drug test, therapy session |
| Tier | Silver / Gold / Platinum | Green / Yellow / Orange / Red |
| Triggered Action | Promotion, bonus, upgrade | Outreach, clinical review, escalation |
| Missing Event | Lapsed member detection | Missed drug test, skipped survey |
| Temporal History | Full txn history, retro-credit | Full stability trajectory |

# 6. PPSI --- Weekly Self-Report Survey

34 items across 8 sections. All scored 0--3. Maximum total: 102. Member completes on phone weekly, under 2 minutes.

| Section | Items | Max | Focus |
|---------|-------|-----|-------|
| 1 — Sleep Stability | 5 | 15 | Restorative sleep, exhaustion |
| 2 — Emotional Exhaustion / Burnout | 5 | 15 | Burnout, detachment, fatigue |
| 3 — Work Sustainability | 5 | 15 | Workload, schedule, support |
| 4 — Isolation + Support | 5 | 15 | Connection, peer contact |
| 5 — Cognitive Load | 5 | 15 | Concentration, overload |
| 6 — Recovery / Routine Stability | 4 | 12 | Self-care, treatment adherence |
| 7 — Meaning + Purpose | 4 | 12 | Effectiveness, future outlook |
| 8 — Global Stability Check | 1 | 3 | Overall self-assessment |

### PPSI Score Interpretation

| Score Range | Interpretation | Response |
|-------------|---------------|----------|
| 0--19 | Strong stability | Routine monitoring |
| 20--39 | Early strain | Preventive outreach |
| 40--68 | Moderate instability | Clinical review |
| 69--102 | High destabilization risk | Immediate stabilization |

### Layered Monitoring Design (Survey Fatigue)

**Full Monthly PPSI:** Complete 34-item instrument administered monthly.

**Weekly Mini PPSI with Triggered Expansion:** 8-question core set — one sentinel question from each domain, rotating on a 3-week cycle. Global Stability asked every week. Any Mini PPSI answer ≥ 2 triggers expansion to the full domain questions for that section.

**Event-Triggered Survey Modules:** Context-triggered surveys using PPSI domain modules when specific stressors occur (e.g., adverse patient event → Sleep + Cognitive modules, call schedule surge → Work Sustainability + Recovery modules).

# 7. Provider Pulse Survey

Completed by treating clinician. 14 items, 7 sections, 0--3 scale, max 42. Monthly or after clinical encounters. 30--60 seconds.

| Section | Items | Max | Focus |
|---------|-------|-----|-------|
| 1 — Treatment Engagement | 3 | 9 | Attendance, adherence, participation |
| 2 — Sleep Stability | 2 | 6 | Sleep hours, routine disruption |
| 3 — Mood and Safety Signals | 2 | 6 | Mood presentation, safety concerns |
| 4 — Cognitive Function | 2 | 6 | Concentration, decision fatigue |
| 5 — Functional Work Stability | 2 | 6 | Workload management, distress |
| 6 — Recovery & Protective Factors | 2 | 6 | Stabilizing routines, support |
| 7 — Provider Stability Concern | 1 | 3 | Overall clinical judgment |

### Provider Stability Alert

Independent of numeric score. The treating clinician flags: No immediate concern / Emerging instability concern / Immediate stabilization recommended.

"Immediate stabilization recommended" = sentinel trigger, hard override to Red. "Emerging instability concern" = bumps physician up one tier.

Any individual question scoring 3 (Significant concern) triggers escalation regardless of section aggregate.

### Provider Pulse Score Interpretation

| Score Range | Interpretation | Action |
|-------------|---------------|--------|
| 0--7 | Strong stability | Routine monitoring |
| 8--15 | Early concern | Preventive outreach |
| 16--28 | Moderate instability | Structured clinical review |
| 29--42 | High destabilization risk | Immediate stabilization |

### Dominant Driver Routing from Provider Pulse

| Dominant Driver | Intervention |
|----------------|-------------|
| Work instability | Schedule review and protected time |
| Treatment engagement | Engagement outreach and monitoring support |
| Sleep / mood / cognitive | Sleep reset and recovery interventions |
| Provider stability concerns | Clinical stability check-in |
| Recovery / protective factor collapse | Peer or mentorship activation |

# 8. PPII Data Inputs --- The Seven Streams

## Stream A: Weekly PPSI Survey (Self-Report) — BUILT
34 items, 8 sections, 0--3 scale, max 102. Weekly on phone, under 2 minutes.

## Stream B: Compliance Signals (Staff Entry) — BUILT
Approach B (positive confirmation). Staff enters completions; absence triggers MEDS. Per-member configurability. Calendar-based cadence. Per-state with common national core. 6 items, each scored 0-3, max 18.

## Stream C: Provider Pulse (Clinician-Completed) — BUILT
14 items, 7 sections, 0--3 scale, max 42. At least monthly or on clinical change. Multiple clinicians per physician expected.

## Stream D: Operational Strain (EHR/Scheduling) — POST-PILOT
5 items, max 15. Trend-based vs. personal baseline. Requires integrations.

## Stream E: Wearable Physiologic Signals (Opt-In) — POST-PILOT
4 items, max 12. Trend deltas vs. 2--4 week trailing median.

## Stream F: Monthly Stability Pulse — MID-PILOT
7 items, 0--4 scale, max 28. Carried forward weekly until next pulse.

## Stream G: Rapid Event Reporting — BUILT
Severity slider 0--3. 15-second input. Both members and staff can enter. Category dropdown tied to dominant driver routing.

# 9. Compliance Items Detail

### Items (6 items, each scored 0-3, max 18)

1. **Drug Test Completion (25%):** Completed=0, Late=2, Missed=3
2. **Drug Test Results (35%):** Negative=0, Inconclusive=1, Preliminary Positive=2, Confirmed Positive=3, Refused/Tampered=3
3. **Check-In Attendance (10%):** On-time=0, Delayed=1, Missed=2, Repeated missed=3
4. **Appointment Attendance (10%):** Attended=0, Late cancel=1, Missed=2, Repeated missed=3
5. **Program Status Change (10%):** Stable=0, Administrative review=1, Monitoring escalation=2, Probation/suspension=3
6. **Monitoring System Engagement (10%):** On-time=0, Delayed=1, Missed=2, Repeated missed=3

### Per-Member Compliance Normalization
Normalize against each member's actual ceiling, not fixed 18. Fewer items should not artificially lower risk contribution.

### Automatic Red Triggers (override score)
Confirmed positive drug test, specimen tampering/refusal, program suspension, major compliance violation.

### Architecture
Queue-based model. Four resolution paths (clinic staff direct, clinic staff from physician account, physician self-report, automated feed). Every event creates an accrual — pass or fail. Calendar-based cadence. MEDS integration for missed events (post-demo).

# 10. PPII Composite Formula

### Pilot Formula (Four Streams)

Pilot PPII = (0.35 × Provider Pulse Normalized) + (0.25 × PPSI Normalized) + (0.25 × Compliance Normalized) + (0.15 × Events Normalized)

Final PPII = (Raw Weighted Sum / Max Weighted Sum) × 100. Maps to 0--100.

**Rationale (Erica):** Provider Pulse and Compliance are more objective than the purely subjective PPSI. Weights may be adjusted based on pilot observations.

### Full Formula (Seven Streams) — TBD
Updated seven-stream weights needed from Erica when Streams D, E, F are integrated.

# 11. Triage Thresholds

| Tier | PPII | Status | Response | SLA |
|------|------|--------|----------|-----|
| GREEN | 0--34 | Stable | Routine monitoring | Standard |
| YELLOW | 35--54 | Rising stress | Coordinator outreach | 72 hrs |
| ORANGE | 55--74 | Destabilizing | Clinical review | 48 hrs |
| RED | 75--100 | Acute risk | Clinical escalation | Same day |

# 12. Automatic Escalation Triggers

| # | Trigger | Detection | Signal | Status |
|---|---------|-----------|--------|--------|
| 1 | Three-Week Upward Trend | PPII slope > +5 over 3 weeks | PPII_TREND_UP | **BUILT (Session 95)** |
| 2 | Sudden Spike | PPII increase ≥ +12 week-over-week | PPII_SPIKE | **BUILT (Session 95)** |
| 3 | Protective Factor Collapse | Protection Score drops ≥ 6 w-o-w | PROTECTIVE_COLLAPSE | **BUILT (Session 95)** |
| 4 | Repeated Moderate | Yellow/Orange 3 consecutive weeks | Via MEDS aging | Not built |
| 5 | Sentinel Compliance | Failed drug test, refusal, suspension | SENTINEL_REFUSED, SENTINEL_SUSPENDED | **BUILT & TESTED** |
| 6 | Provider Stability Alert: Immediate | Pulse "Overall stability concern" = 3 | STABILITY_IMMEDIATE | **BUILT & TESTED** |
| 7 | Provider Emerging Concern | Pulse "Overall stability concern" = 2 | STABILITY_EMERGING | **BUILT & TESTED** |
| 8 | Event Severity 3 | Any event with severity 3 | EVENT_SEVERITY_3 | **BUILT & TESTED** |
| 9 | Provider Pulse Question ≥ 3 | Any Pulse question scored 3 | PULSE_Q3 | **BUILT & TESTED** |
| 9b | PPSI Question ≥ 3 | Any PPSI question scored 3 | PULSE_Q3 (reused) | **BUILT (Session 94)** |
| 9c | PPSI Global Stability = 3 | Section 8 scored 3 | STABILITY_IMMEDIATE (reused) | **BUILT (Session 94)** |
| 10 | PPII Composite Red | Composite ≥ 75 | PPII_RED | Wired, untested |
| 11 | PPII Composite Orange | Composite ≥ 55 | PPII_ORANGE | Wired, untested |
| 12 | PPII Composite Yellow | Composite ≥ 35 | PPII_YELLOW | Wired, untested |
| 13 | Missed Survey | MEDS cron detects missed survey | MISSED_SURVEY | Not built |

### Open Questions on Triggers
- Trigger stacking: one level or two when multiple fire?
- Trigger expiration: persist or auto-reverse when condition clears?
- Tier duration for escalated members: minimum hold time?

# 13. Dominant Driver Analysis — BUILT (Session 95)

System identifies WHY a score increased and routes intervention accordingly. Same score, different cause, different response. This is the bridge between detection (Stability Registry) and intervention (Protocol Cards).

### How It Works

When a registry item is created, the system compares the current period's stream contributions against the previous period's. The stream with the largest week-over-week increase is the Dominant Driver. If PPSI is dominant, it drills one level deeper to identify which of the 8 sub-domains moved most. The result is stored on the registry item as a driver code.

### Driver Codes

| Code | Meaning | Routes To |
|------|---------|-----------|
| PPSI:SLEEP | PPSI Sleep Stability dominant | Protocol A + A1 |
| PPSI:BURNOUT | PPSI Emotional Exhaustion dominant | Protocol A + A2 |
| PPSI:WORK | PPSI Work Sustainability dominant | Protocol A + A3 |
| PPSI:ISOLATION | PPSI Isolation + Support dominant | Protocol A + A4 |
| PPSI:COGNITIVE | PPSI Cognitive Load dominant | Protocol A + A5 |
| PPSI:RECOVERY | PPSI Recovery / Routine dominant | Protocol A + A6 |
| PPSI:MEANING | PPSI Meaning + Purpose dominant | Protocol A + A7 |
| PPSI:GLOBAL | PPSI Global Stability Check dominant | Protocol A + A8 |
| PULSE:STABILITY | Provider Pulse stability concern ≥ 2 | Protocol B + P1 |
| PULSE:SLEEP | Provider Pulse consecutive sleep ≥ 2 | Protocol B + P2 |
| PULSE:ENGAGEMENT | Provider Pulse treatment engagement ≥ 2 | Protocol B + P3 |
| PULSE:MOOD_WORK | Provider Pulse mood + workload combined | Protocol B + P4 |
| PULSE:SAFETY | Provider Pulse safety concern ≥ 2 | Protocol B + P5 |
| COMPLIANCE | Compliance stream dominant | Protocol C |
| EVENT | Event stream dominant | Protocol D |

### Platform Build Requirements

1. **Delta calculation function** — query current and previous period stream scores, compute deltas, identify winner. If PPSI wins, query sub-domain scores and identify highest sub-domain delta.
2. **`dominant_driver` column on stability_registry** — stores the driver code (e.g., "PPSI:ISOLATION").
3. **`driver_override` column** — coordinator can reclassify with documented reason. Stores original driver, override driver, reason text.
4. **Stream score history** — may need a `stream_score_history` table or derive from activity/molecule data at comparison time.

### Estimated Build: 2–3 sessions

### Intervention Routing Table (from Erica)

| Dominant Driver | Intervention |
|----------------|-------------|
| Operational Strain | Schedule review, coverage reassessment |
| Compliance Friction | Friction audit first (logistics before assumptions), engagement outreach |
| Physiologic Deterioration | Sleep reset protocol, recovery routines |
| Protective Factor Collapse | Peer contact, mentorship, therapy re-engagement |
| PPSI Instability | Clinical check-in, workload assessment, therapy referral |
| Treatment Engagement | Engagement outreach and monitoring support |
| Sleep/Mood/Cognitive | Sleep reset and recovery interventions |
| Provider Stability | Clinical stability check-in |

# 14. Core Platform Enhancements

## 14.1 Survey System — BUILT
Survey builder, mobile delivery, scoring functions, orchestration. Supports third-party respondents (Provider Pulse completed by clinician about member).

## 14.2 MEDS — Missing Event Detection System — BUILT (Session 96)
Automated gap detection across all cadenced surveys and compliance items. Daily scheduled scan with configurable frequency and start time. Real-time check on physician page load. Consecutive miss escalation (3+ triggers critical notification). MEDS flags visible on clinic roster.

## 14.3 Multi-Stream Composite Scoring — BUILT (scorePPII.js)
Four-stream weighted calculation. Called by custauth POST_ACCRUAL hook.

## 14.4 Custauth Framework — BUILT (Core Pointer Enhancement)

Per-tenant hook functions that fire at defined points during accrual processing. Core engine calls hooks; tenant-specific logic lives in tenant folders.

**Files:**
- `custauth.js` (project root) — default no-op passthrough
- `tenants/{tenant_key}/custauth.js` — tenant override
- `getCustauth(tenantId)` in pointers.js — loader

**CRITICAL IMPLEMENTATION NOTES:**
- Loader uses `caches.tenantKeys` (NOT `caches.tenants`)
- Tenant custauth is async — ALL calls MUST use `await`
- Module is cached after first load — full server restart required for changes

**Hook Points:**
- **PRE_ACCRUAL:** After activityData built, before createAccrualActivity. Can add/modify molecules. Wisconsin PHP: adds SIGNAL=EVENT_SEVERITY_3 when event severity ≥ 3.
- **POST_ACCRUAL:** After COMMIT. Used for follow-up actions. Wisconsin PHP: recalculates PPII composite from 4 streams, creates follow-up accrual with PPII signal if threshold crossed. Uses internal HTTP POST to avoid circular dependency.

## 14.5 Stability Registry — BUILT

Central table driving physician status. Every condition needing clinical attention creates a registry item. Physician's current color = most severe open registry item. No stored status field — the registry IS the state.

**Color Derivation:** Any open SENTINEL → Red. Any open RED → Red. Any open ORANGE → Orange. Any open YELLOW → Yellow. No open items → Green.

**Lifecycle:** Detected → Open → Assigned → Resolved. Every item has an SLA. Staff works the registry, resolves items, physician's color updates in real time.

**How Items Get Created:** All items flow through: molecule on accrual → promotion engine detects → external reward fires → registry item created.

### Signal Molecule (Core Pointer Enhancement)
Single general-purpose SIGNAL molecule backed by `signal_type` lookup table. Scoring functions hang one SIGNAL molecule with a value like "PULSE_Q3" or "SENTINEL_POSITIVE". Promotions evaluate against SIGNAL values. New signals are a row in a table, not a new molecule definition.

### External Promotion Results (Core Pointer Enhancement)
When a promotion qualifies with reward_type='external', the engine looks up the result code in `external_result_action` table. Maps codes to functions. For Insight: `createRegistryItem`. Pure configuration, no hardcoded hooks.

### Trigger → Promotion → Registry Mapping

| Signal | Promotion Code | External Action | Registry Urgency |
|--------|---------------|----------------|-----------------|
| SENTINEL_POSITIVE | SENT_POS_ALERT | SR_SENTINEL (1) | SENTINEL |
| SENTINEL_REFUSED | SENT_REF_ALERT | SR_SENTINEL (1) | SENTINEL |
| SENTINEL_SUSPENDED | SENT_SUS_ALERT | SR_SENTINEL (1) | SENTINEL |
| EVENT_SEVERITY_3 | EVT_SEV3_ALERT | SR_SENTINEL (1) | SENTINEL |
| PPII_RED | PPII_RED_ALERT | SR_RED (2) | RED |
| PPII_ORANGE | PPII_ONG_ALERT | SR_ORANGE (3) | ORANGE |
| PPII_YELLOW | PPII_YLW_ALERT | SR_YELLOW (4) | YELLOW |
| PULSE_Q3 | PULSE_Q3_ALERT | SR_YELLOW (4) | YELLOW |
| STABILITY_IMMEDIATE | STAB_IMM_ALERT | SR_SENTINEL (1) | SENTINEL |
| STABILITY_EMERGING | STAB_EMG_ALERT | SR_ORANGE (3) | ORANGE |

## 14.6 Clinician-to-Member Relationship Tracking — BUILT (Sessions 95-96)
Clinicians enrolled as members with IS_CLINICIAN molecule. ASSIGNED_CLINICIAN molecule on physicians (1-to-many). Full UI: Clinicians tab on clinic page, caseload filters on roster/action queue/follow-ups, clinician display on physician detail, dashboard caseload table, physician portal caseload entry, notification routing, CSV export column.

## 14.7 Stabilization Protocol Cards — REFERENCE LIBRARY BUILT (Session 99, March 30 2026)

29 standardized intervention playbooks that attach to Stability Registry items. When a registry item is created and the Dominant Driver is identified, the corresponding protocol card is assigned automatically. The coordinator sees exactly what to do, in what order, by when, and what success looks like.

**Session 99 deliverables:**
- `protocolCards.js` — 29 cards with full clinical content (structured data: steps, timelines, assignment, success metrics, escalation triggers, registry display format)
- `protocol_cards.html` — Reference library page with search, category grouping, and card detail modals
- API: `GET /v1/protocol-cards` (all cards) and `GET /v1/protocol-cards/:cardId` (single card)
- Clickable badges in action_queue.html and physician_detail.html — click any protocol card badge to view full clinical protocol
- Dashboard nav card added for Protocol Cards reference library
- Extended cards (M1-M3, T1-T5, F1, D2-D3) added to CARD_LABELS and CARD_COLORS in action_queue.html and physician_detail.html

**Session 100 deliverables — Extended Card Detection Engine:**
- `extendedCardDetector.js` — 9 accrual-triggered detection functions (M1-M3, T1-T4, D2-D3) with rolling window historical analysis
- EXTENDED_CARD molecule (internal_list, storage_size 1, attaches to activity) — embedded list values for all 11 extended card codes
- EXTENDED_CARD added to accrual composite so accrual process encodes and stores it
- 11 promotion rules (EXT_M1 through EXT_D3) — criteria match on EXTENDED_CARD molecule, result type external → createRegistryItem
- T2 (Acute Spike) auto-elevates to ORANGE urgency; T4 (Silent Disengagement) also ORANGE; all others YELLOW
- `extended_card` column added to stability_registry table
- `createRegistryItem` external action handler updated to read and store extended_card
- UI: action_queue.html and physician_detail.html show extended card badges alongside primary card badges
- All registry SELECT queries updated to include extended_card
- Detection integrated into POST_ACCRUAL hook in custauth.js — runs after dominant driver analysis, sets EXTENDED_CARD on accrual data
- Highest-priority card wins when multiple patterns match (priority: T2 > T4 > M1 > M3 > T1 > T3 > D2 > D3)
- ~~F1 (Intervention Failure) and T5 (Chronic Low-Grade) deferred to MEDS batch — they are time-based, not accrual-triggered~~ **BUILT — Session 101.** F1_T5 daily scheduled job handler. See Section 24e below.
- db_migrate v30
- **Design decision (for Erica):** Only highest-priority extended card assigned per accrual. Release notes will flag this for Erica to override if she wants all matching patterns listed.

**Session 100 deliverables — PPSI Safety Alerts:**
- `note_alert` BOOLEAN column on `survey` table — configurable per survey, enabled for PPSI
- When a physician adds a note on their PPSI check-in, `PPSI_NOTE_ENTERED` notification fires to all clinical staff (critical severity)
- `survey_note_review` table tracks staff review lifecycle: pending → reviewed (no action) or escalated (create registry item)
- Comment field added to mobile check-in (poser_mobile.html) — "Anything else you want to share this week?" on last question
- Urgent bell animation on clinic-scoped pages — yellow bell swing + red pulsing badge when unread critical notifications exist
- Bell only shows on clinic pages (clinic.html, physician_detail.html, action_queue.html, compliance_member.html) — not dashboard
- Notification click navigates to physician detail page via PageContext
- "PPSI Notes for Review" section on physician_detail.html — pending notes with "Reviewed — No Action" and "Create Registry Item" buttons
- Notification API returns `has_critical` flag for bell urgency styling
- `superuser` role added to `all_clinical` notification recipient list
- Notification polling removed — bell checks on page load only
- API: `GET /v1/survey-note-reviews/:membershipNumber`, `PATCH /v1/survey-note-reviews/:reviewId`
- db_migrate v32 (note_alert, notification rule, survey_note_review table), v33 (fix activity_link type to CHAR(5))

**Session 99 fixes:**
- Extracted `getNextLink` from pointers.js into shared module `get_next_link.js` — both pointers.js and db_migrate.js now import the same function
- Fixed link_tank corruption: v30 had used MAX(link)+1 hack for composite_detail instead of getNextLink, creating 3 bad link_tank rows (tenant_id 1, 3, 5). v31 migration deletes all bad rows, creates single correct row (tenant_id=0), re-inserts EXTENDED_CARD composite_detail with proper link
- db_migrate v31
- Server verified clean start with shared module import

**Source documents:**
- PI2_Stabilization_Protocol_Cards_and_Annual_Review_Guide.pdf (original A1-A8, P1-P5, A/B/C/D, S1)
- PI2_Extended_Protocol_Cards.docx (Erica Larson, March 29 2026 — M1-M3, T1-T5, F1, D2-D3, registry integration addendum)

### Card Structure (all 17 follow the same format)

Each card contains: what it is, what it is NOT (critical — prevents overreaction), step-by-step actions with timelines adjusted by tier (Yellow/Orange/Red/Sentinel), responsible role, success metric, escalation trigger, and registry display text.

### Card Index

**Part I — 4 PPII Pathway Cards (stream-level):**

| Card | Stream | Key Concept |
|------|--------|-------------|
| Protocol A | PPSI Self-Report Dominant | Routes to Sub-Domain cards A1–A8 |
| Protocol B | Provider Pulse Dominant | Routes to Signal cards P1–P5. Clinician observed changes physician may not recognize. |
| Protocol C | Compliance Dominant | Friction audit FIRST — logistics before assuming non-compliance. SENTINEL events bypass this card. |
| Protocol D | Event Dominant | Events are situational stressors. Reporting is engagement, not impairment. Watch for secondary cascade. |

**Part II — 8 PPSI Sub-Domain Cards:**

| Card | Domain | Key Intervention |
|------|--------|-----------------|
| A1 | Sleep Stability | Sleep reset protocol, schedule review, protected recovery time |
| A2 | Emotional Exhaustion / Burnout | Workload assessment, administrative relief, micro-recovery |
| A3 | Work Sustainability | Structural/institutional intervention — employer liaison, schedule stabilization |
| A4 | Isolation + Support | Peer mentor match, connection facilitation, group re-engagement |
| A5 | Cognitive Load | Differentiate situational vs persistent. Cognitive protection. Patient safety consideration if persistent. |
| A6 | Recovery / Routine | Routine reconstruction — easiest wins first. Accountability structure. |
| A7 | Meaning + Purpose | Nuanced conversation. Professional re-engagement. Moves slower than other domains (4-week check). |
| A8 | Global Stability | Open-ended holistic assessment. May capture factors beyond the 7 specific domains. |

**Part III — 5 Provider Pulse Signal Route Cards:**

| Card | Signal | Key Concept |
|------|--------|-------------|
| P1 | Stability Concern ≥ 2 | Broadest clinical signal. Contact submitting clinician first. Check PPSI divergence. |
| P2 | Sleep Reduction (consecutive) | Clinician-observed sleep deterioration. Cross-reference with PPSI self-report. |
| P3 | Treatment Engagement ≥ 2 | One of strongest early warning signals. Non-confrontational framing. Barrier assessment. |
| P4 | Mood + Workload Combined | System-clinician interface problem. Schedule review + protected time + clinical support. |
| P5 | Safety Concern ≥ 2 | MAXIMUM ESCALATION. Immediate — same hour. PHP clinician and medical director activated. All steps immediate. |

### Response Timeline Reference

| Tier | Initial Contact | Structured Follow-up | Success Check |
|------|----------------|---------------------|---------------|
| Yellow | 72 hours | 5 business days | 2 weeks |
| Orange | 48 hours | 3 business days | 2 weeks |
| Red | Same day | 24 hours | 1 week |
| SENTINEL | Immediate | Same day | 48 hours, then weekly |

**Part VI — 3 Multi-Stream & Co-Dominant Cards (Session 99):**

| Card | Pattern | Key Concept |
|------|---------|-------------|
| M1 | Multi-Domain PPSI Deterioration | 3+ domains elevated simultaneously. Root cause is often the earliest-activating domain, not the highest. |
| M2 | Cross-Stream Co-Dominant | Two streams within 5 percentage points. PPSI + Compliance co-dominance = 2-3x more predictive. |
| M3 | Self-Report / Clinician Discordance | Provider Pulse exceeds PPSI by >15% for 2+ months. Silent Slide precursor. Approach with curiosity, not accusation. |

**Part VII — 5 Destabilization Archetype Cards (Session 99):**

| Card | Archetype | Key Concept |
|------|-----------|-------------|
| T1 | Slow Burn | Gradual 15+ point rise over 6+ weeks. Most common (~30-35%). Threshold-based detection misses 30-40%. |
| T2 | Acute Break | 20+ point spike in 1-2 weeks. Auto-elevates to minimum Orange. Almost always event-triggered. |
| T3 | Oscillator | Rise and partial recovery cycling 3+ times in 12 weeks. Distinguish escalating vs stabilizing. Intervene on upswing. |
| T4 | Silent Slide | Low PPSI but rising Provider Pulse/declining compliance. Least common (~8-12%) but most dangerous. Requires secondary signals. |
| T5 | Chronic Borderline | Yellow for 12+ weeks despite intervention. May represent stable recovery "new normal" for that individual. |

**Part VIII — 1 Intervention Failure Card (Session 99):**

| Card | Pattern | Key Concept |
|------|---------|-------------|
| F1 | Structured Reassessment | Classify failure pattern: no response, brief dip, domain shift, partial plateau. Each has different modification strategy. |

**Part IX — 2 Enhanced Event Cards (Session 99):**

| Card | Pattern | Key Concept |
|------|---------|-------------|
| D2 | Compound Event Cascade | 2+ events in 14-day window. Super-additive effect. Compound severity = sum + 1. Extended 6-week monitoring. |
| D3 | State-Dependent Event Response | Event in Yellow/Orange participant. 1.5-2.0x amplified impact. Adjusted severity = actual + tier modifier. |

**Card Co-Activation Priority (highest first):** S1 > T2 > T4 > M1 > M3 > T1 > T3 > D2 > D3 > T5

### Cross-Domain Escalation Patterns (from Erica)

Certain multi-signal combinations bypass standard routing:
- **Isolation + Compliance misses** in same period → immediate clinical escalation
- **Sleep + Cognitive Load** co-elevation → functional impairment concern, clinical review
- **Burnout + Meaning decline** together → comprehensive career sustainability crisis
- **Recovery decline + Isolation decline** → withdrawal from all stabilizers, immediate escalation
- **Multiple PPSI domains deteriorating simultaneously** → bypass sub-domain routing, multi-domain clinical assessment

### Platform Build Requirements

1. **`protocol_card` definition table** — card_id, card_code, card_name, stream, sub_domain, steps JSON, success_metric, escalation_trigger. Alternatively, derive from driver code since mapping is deterministic.
2. **Registry item enhanced fields** — `protocol_card_id`, `recommended_response` (step 1 text adjusted for tier), `assigned_role`, `success_metric`, `escalation_trigger`.
3. **Registry detail modal UI** — display protocol card steps alongside item details. Coordinator sees the playbook in context.
4. **Driver Override field** — on registry item. Original driver, override driver, reason. Feeds annual accuracy analysis.

### Estimated Build: 2–3 sessions (depends on whether dominant driver calculation is done first)

### Annual Protocol Review Guide

Erica designed a continuous improvement cycle for the protocol cards:
- **Monthly:** QA reviews SLA compliance, flags overdue patterns
- **Quarterly:** Operational metrics checkpoint — completion rates, adherence
- **Annually:** Full effectiveness review with outcome data, card revisions, staff retraining
- **Ad hoc:** Any Tier 1/2 adverse event triggers immediate post-event review

Annual review evaluates each card on 4 criteria: Effectiveness (return-to-Green rate), Timeliness (SLA compliance), Accuracy (driver override rate), Relevance (physician feedback). Each card gets a documented outcome: Confirmed, Revised, Threshold Adjusted, Retired, or New Card Created.

This review data also feeds the ML training dataset — which interventions work, for which patterns, in what timeframes.

## 14.8 Outcome Tracking & Follow-up System — BUILT (Session 95)

When a Stability Registry item is resolved, the system automatically schedules follow-up checks at 2, 4, and 8 weeks. At each check, the physician's current scores are captured and compared to resolution-time scores to measure whether stability held.

### Purpose

Answers the question: "Did the intervention actually work?" Over time, produces population-level data: "X% of physicians returned to stable status within Y weeks for protocol card Z."

### Platform Build Requirements

1. **`registry_followup` table** — parent registry item link, scheduled date, check number (1/2/3 for 2/4/8 weeks), status (pending/completed/escalated), PPII score at check, relevant stream/domain score at check, notes, completed_by, completed_at.
2. **Auto-scheduling** — when registry item status changes to Resolved, create 3 follow-up rows at +14, +28, +56 days.
3. **Follow-up queue display** — show pending follow-ups in action_queue.html, either as a separate tab/filter or inline with other registry items.
4. **Outcome capture** — at each check, record current PPII and relevant stream score. If physician has re-elevated, option to create new registry item.
5. **Population-level reporting** — aggregate return-to-Green rates per protocol card, per driver, per time period.

### Estimated Build: 1–2 sessions

### What This Enables

- Erica's annual protocol review (effectiveness rates per card)
- ML training data (outcome patterns tied to temporal score trajectories)
- State program reporting ("85% of at-risk physicians returned to stable within 8 weeks")
- Ohio pitch data (quantified intervention effectiveness)

## 14.9 Convergent Validation Anchor Battery — BUILT (Session 96)

A 46-item research survey battery administered alongside the PPSI at 4 timepoints during the pilot (enrollment, month 1, month 3, month 6). Correlates PPSI domain scores against established, gold-standard validated instruments to prove the PPSI measures real, scientifically recognized constructs.

**Source documents:** PI2_Convergent_Validation_Anchor_Battery_Complete_Item_Reference.pdf, PI2_Psychometric_Validation_Protocol_Anchor_Accelerated.pdf

### The Strategy

Instead of 18+ months of standalone psychometric validation, anchor each PPSI domain to an already-validated instrument. If PPSI Sleep correlates at r ≥ 0.60 with PROMIS Sleep Disturbance (NIH gold standard), the PPSI domain has borrowed decades of psychometric credibility. Publishable convergent validity data at month 6–9 instead of month 12–18. A 9–12 month acceleration.

### Anchor Instruments

| PPSI Domain | Anchor Instrument | Items | License |
|-------------|------------------|-------|---------|
| 1. Sleep Stability | PROMIS Sleep Disturbance 8a (NIH) | 8 | Free, public domain |
| 2. Burnout | Stanford PFI — Work Exhaustion | 4 | Free non-profit; commercial needs Stanford permission |
| 3. Work Sustainability | Mini-Z Stress Subscale | 4 | Free, public |
| 4. Isolation + Support | UCLA Loneliness Scale-3 | 3 | Free, public domain |
| 5. Cognitive Load | Cognitive Failures Questionnaire (selected) | 8 | Free, public domain |
| 6. Recovery / Routine | PFI Professional Fulfillment (partial) | 3–4 | Free non-profit |
| 7. Meaning + Purpose | Stanford PFI — Professional Fulfillment | 6 | Free non-profit |
| 8. Global Stability | Mini-Z Single-Item Burnout + PROMIS Global-10 | 2 | Free, public |
| Provider Pulse (overall) | CGI-S (Clinical Global Impression — Severity) | 1 | Free, public domain, FDA-accepted |

**Total:** ~46 items, ~9 minutes, administered at 4 timepoints only. Does NOT affect PPII score or physician color. Stored separately with de-identified research IDs.

### Administration

- Anchor battery presented as "Additional Wellness Assessment — Research Module" after monthly full PPSI
- CGI-S added as final item in Provider Pulse workflow after Provider Stability Alert
- Physicians who declined research consent (per Consent Framework) are not shown the anchor battery
- Weekly 90-second Mini PPSI check-in is UNAFFECTED

### Platform Build Requirements

1. **New survey instrument** in survey system — same architecture as PPSI and Provider Pulse. Configuration, not new engineering.
2. **Research consent flag** on member record — boolean. Controls whether anchor battery is presented.
3. **Research data table** — anchor responses stored separately, linked to de-identified research ID, not clinical ID.
4. **Conditional survey flow** — after monthly PPSI, check research consent flag, present anchor battery if true.
5. **CGI-S item** — one additional question appended to Provider Pulse workflow.
6. **Data export capability** — for psychometrician analysis at each timepoint.

### Licensing Note

The Stanford Professional Fulfillment Index (PFI) is free for non-profit research/program evaluation. If Primada Health or Insight Health Solutions is the administering entity and is structured as for-profit, Stanford Risk Authority must be contacted. **Damian needs to clarify pilot entity structure.** All other instruments are public domain or free.

### Estimated Build: 1 session

### Validation Timeline (Integrated)

| Months | Phase | Deliverable |
|--------|-------|-------------|
| 1–2 | Setup | IRB approved, psychometrician engaged, battery integrated |
| 3–6 | Anchor + Phase 1 | Battery administered at 4 timepoints, internal consistency calculated |
| 6–9 | **CONVERGENT VALIDITY REPORT** | Domain-by-domain correlations published. **Paper 1 drafted.** |
| 6–12 | Phase 2–3 | Test-retest reliability, factor analysis |
| 12–18 | Phase 4 | Criterion validity, ROC analysis, threshold calibration, survival analysis |
| 18–24 | Publication | Paper 1 submitted, Paper 2 drafted, Paper 3 outlined |

## 14.10 Participant Rights, Transparency & Consent Framework — DOCUMENT COMPLETE, PLATFORM FEATURES MOSTLY BUILT

An 8-section, signature-ready document provided to every physician at enrollment. Defines data collection, scoring transparency, access rights, information boundaries, and consent.

**Source document:** PI2_Participant_Rights_Transparency_and_Consent_Framework.pdf

### Key Design Decisions (Erica)

**Scoring transparency:** Full PPII formula (35/25/25/15 weights) included in participant document. **GROUP DECISION NEEDED:** Erica flagged uncertainty about whether to reveal this level of detail. Transparency builds trust but enables gaming. Middle ground possible (explain streams and philosophy without exact weights/thresholds).

**Information boundary policy — who sees what:**

| Recipient | What They See |
|-----------|--------------|
| Treating clinician(s) | Full PPII, all streams, registry items, activity timeline |
| PHP coordinator | Full PPII, compliance, events, registry with SLA timers |
| PHP medical director | Everything — when Orange/Red/SENTINEL or scheduled review |
| Employer / health system | Compliance standing ONLY (compliant/non-compliant). General program status. NO scores, NO survey data. |
| State licensing board | Compliance status only. SENTINEL events and resolution. NO PPII, NO self-report. |
| Credentialing committees | Program participation status and compliance standing only. |
| Malpractice carriers | De-identified aggregate only. Individual data requires written authorization. |
| Researchers | De-identified only, under IRB, with separate written consent. |

**NEVER shared externally:** Individual PPII scores, PPSI responses, Provider Pulse scores, event details, Dominant Driver identification, Score Feedback annotations, notes content.

**Clinical authority stays human:** Platform generates scores and recommends interventions. It does not diagnose, determine licensure, or make fitness-for-duty decisions. Algorithms inform, clinicians decide.

**Exceptions to confidentiality:** Imminent patient safety risk (clinician-determined, not algorithm), monitoring agreement violation, court order, physician's own written authorization. Physician is notified in every case.

### Platform Features Needed

1. **Score Feedback feature** — physicians annotate their own scores with context notes in Physician Portal. Example: "Sleep elevated due to new call rotation, expect normalization in 2 weeks." Stored in record, visible to care team. **BUILT (Session 95, as Physician Annotations).**
2. **Role-based access enforcement** — different data visibility per role (coordinator vs. clinician vs. medical director vs. external). Partially exists via tenant isolation and portal separation. Needs formalization.
3. **Data access request workflow** — "on request" items fulfilled within 5 business days. Could be a simple request form in Physician Portal. **NOT BUILT.**
4. **Research consent flag** — boolean on member record. Controls anchor battery display and research data inclusion. (Same as 14.9 requirement.)
5. **Consent document storage** — signed consent acknowledgment linked to member record.

### Estimated Build: Score Feedback = 0.5 session. Role-based access formalization = 1 session. Data access workflow = 0.5 session.

## 14.11 ML / Predictive Modeling Integration Path — BUILT (Session 97, Pre-Alpha v0.1)

An ML service that learns temporal patterns preceding destabilization and predicts physician risk trajectory at 30, 60, and 90 days.

### Architecture

The ML model runs as a separate Python service alongside the Pointer platform. It connects to the same PostgreSQL database. No third-party ML vendor, no data leaving the infrastructure, no licensing fees. The model is owned by Primada/Insight.

### How It Works

1. **Feature extraction** — queries pull temporal patterns from Postgres: score trajectories, compliance patterns, event frequency, stream deltas, time between surveys, registry item history.
2. **Training** — model learns which patterns precede destabilization events. Libraries: scikit-learn, lifelines (survival analysis), TensorFlow if needed. All open source, free.
3. **Prediction** — model outputs risk probability per physician at 30/60/90 day horizons. Written back to database (e.g., `ml_prediction` table: member_link, prediction_date, probability, horizon_days).
4. **Platform ingestion** — Pointer treats prediction scores like any other data. Display on dashboard, trigger on thresholds via promotion engine, route interventions.

### What the Platform Captures Today (ML training data)

Every score, every signal, every compliance entry, every survey response, every registry item, every event — all timestamped with full temporal history. The pilot is the data collection phase for prediction. Erica's protocol card review system generates the outcome data (which interventions worked, for which patterns, in what timeframes) that completes the training dataset.

### Timeline

- **Now:** Platform captures all temporal data needed for ML training.
- **Months 1–6 of pilot:** Data accumulates. Rule-based triggers (existing) provide detection.
- **Months 6–12:** Sufficient longitudinal data for initial survival analysis models.
- **Post-pilot:** Trained models predict time-to-destabilization. Prediction outputs appear in Registry as "Projected Risk" alongside current color.

### Erica's Specific Questions (from March 2026 email)

1. Can we create longitudinal trend algorithms? **Yes — rule-based now, ML-based after pilot data.**
2. Can we document the Early Warning Score algorithm? **Yes — formalize existing trigger rules into a single documented composite.**
3. Can we build survival analysis models? **Yes — after 6–12 months of pilot data. Python lifelines library.**
4. Can we integrate prediction outputs into Registry? **Yes — another column/display element, triggers via promotion engine.**

### Estimated Build: 3–5 sessions (after pilot data exists). Feature extraction queries and model architecture can be designed earlier.

## 14.12 Score Feedback Feature — BUILT (Session 95, as Physician Annotations)

Physicians annotate their own PPII scores with context. Visible to care team. Improves system accuracy over time.

**Examples from Erica's consent framework:**
- "Sleep score elevated because of new call schedule rotation, not destabilization. Expect normalization in 2 weeks."
- "Event report was for a personal family matter that has since been resolved."
- "Missed check-in due to technology issue, not disengagement."

### Platform Build Requirements

1. Notes field on Physician Portal tied to a specific PPII score period.
2. Stored in database, linked to member and score date.
3. Visible to coordinator and clinician in physician detail view.
4. Aggregated feedback feeds annual protocol review (physician-reported relevance of interventions).

### Estimated Build: 0.5 session
# 15. Tenant Structure

**Operator level:** Insight Health Solutions (manages all tenants)

**Tenant level:** State program (Wisconsin PHP = tenant 5)

**Member level:** Individual physician / nurse / first responder

Complete data isolation between states. Per-state configuration. De-identified aggregation for national benchmarking.

# 16. Pilot Phasing Strategy

| Phase | Streams | Weights | Status |
|-------|---------|---------|--------|
| Day 1 | PPSI + Compliance + Provider Pulse + Events | PP 35%, PPSI 25%, Comp 25%, Events 15% | BUILT |
| Mid-Pilot | + Monthly Stability Pulse | Reweight to 5 streams | After cadence established |
| Post-Pilot | + Ops Strain + Wearables | Full 7-stream formula | Requires integrations |

Missing survey handling uses MEDS reweighting. The missing survey itself becomes a signal, remaining streams absorb proportionally more weight. If a prior score exists, carry it forward at reduced weight.

# 17. Build Status — Wisconsin PHP Pilot (as of March 30, 2026)

### Stream A — PPSI (physician self-report): BUILT
34-question survey in database. Mini PPSI running in physician mobile app. Backdated survey seeding complete. Dashboard displays PPII scores, trend arrows, sparklines for 8 demo physicians.

### Stream B — Compliance (staff entry): BUILT
Six compliance items with scoring weights. 24 statuses. 42 member assignments. Full compliance entry UI, history view, sentinel detection. Three API endpoints. Demo data seeded. **Cadence system added (Session 98):** each compliance item has a default cadence (weekly/monthly/quarterly/yearly/custom days). Cadence copies to physician on assignment. Per-physician override via edit pencil on compliance cards. New compliance_rules.html admin page for CRUD on item definitions + default cadence.

### Stream C — Provider Pulse (clinician-completed): BUILT
Full multi-step flow: select physician → select respondent → confirmation → 14-question survey → scoring → accrual. Respondent tracking via `pulse_respondent` table and PULSE_RESPONDENT_LINK molecule. Member search filtered to clinic roster.

### Stream G — Event Reporting: BUILT
Staff enters from dashboard, clinic page, physician detail. Physicians report from mobile app and physician portal. Category dropdown and severity slider. Severity 3 auto-triggers SENTINEL registry item via custauth PRE_ACCRUAL.

### PPII Composite: PARTIALLY BUILT
`scorePPII.js` calculates 4-stream weighted composite. Custauth POST_ACCRUAL calls it after every stream accrual. Stream score queries rewritten (Session 92) to use molecule joins (5_data_54). Threshold crossing creates follow-up accrual with PPII signal. Untested end-to-end — needs physician with enough stream data to cross thresholds.

### Stability Registry: BUILT
Table, endpoints, UI (action_queue.html), demo data. Real-time color derivation from open registry items. SLA tracking. Resolve workflow with notes. Clinic-scoped filtering. **Audit trail added (Session 96):** logAudit wired into registry create/resolve/assign/reopen. Audit history endpoint with user/clinic/global views. registry_history.html page with filter chips. Reopen button on resolved items (most recent resolve only).

### Trigger Paths: 7 of 10 direct triggers TESTED AND WORKING
See Section 12 trigger table for full status. Sentinel compliance, Provider Pulse signals, and Event Severity 3 all confirmed end-to-end. PPII composite triggers wired but untested.

### Pages Built (verticals/workforce_monitoring/)
- `dashboard.html` — main entry, navigation cards, Program Management section with Compliance Rules link
- `clinic.html` — physician roster with color badges, compliance entry, event entry, Provider Pulse, search
- `action_queue.html` — stability registry worklist, urgency-sorted, SLA badges, filter chips
- `physician_detail.html` — full activity timeline, drill-down modals, registry items, summary strip
- `physician_portal.html` — physician lookup flow, Weekly Check-In, Report Event, Open Mobile App
- `physician_management.html` — clinic roster management, compliance button links to detail page **(Session 98)**
- `poser_mobile.html` — physician mobile app for PPSI self-report
- `compliance_member.html` — compliance history and entry per physician, cadence edit with pencil icon **(Session 98)**
- `compliance_rules.html` — admin CRUD for compliance item definitions + default cadence **(Session 98)**
- `registry_history.html` — audit trail for registry actions, user/clinic/global filter chips **(Session 96)**

### Core Enhancements Built
- Signal molecule + signal_type lookup table
- External promotion results + external_result_action table + handler registry
- Custauth framework (PRE_ACCRUAL, POST_ACCRUAL hooks)
- Third-party survey completion (pulse_respondent)
- Composite scoring function (scorePPII.js)
- Verticals folder architecture — three-level file serving (tenant → vertical → root) **(Session 94)**
- Database migration system (db_migrate.js) with startup version check **(Session 94)**
- Bulk molecule helpers (bulkGetMoleculeValues, bulkGetCompositeValues, bulkCheckFlag) **(Session 94)**
- Role-filtered app switcher menu **(Session 94)**
- Erica user account + login routing via vertical_key **(Session 94)**
- Session-based authentication with tenant isolation
- Global auth middleware — requireAuth on all endpoints, public whitelist, requireRole(admin) on /v1/admin/* and /v1/system/* **(Session 97)**
- DB migration v5 — compliance cadence_type + cadence_days on compliance_item and member_compliance **(Session 98)**
- User deactivate/reactivate — is_active toggle on platform_user, wired in admin_users.html **(Session 98)**
- PageContext shared utility — sessionStorage-based navigation, no PII in URLs **(Session 99)**
- Login audit trail — usage_log table, admin_usage_log.html **(Session 97)**
- Release notes system — markdown source + Primada-branded PDF generation **(Session 98)**
- Shared event-report-modal.js — extracted from 3 pages, eliminates ~210 lines of duplication **(Session 94)**
- Shared compliance-entry-modal.js — extracted from 2 pages, eliminates ~300 lines of duplication **(Session 94)**
- Shared compliance-items-modal.js — extracted from 2 pages **(Session 94)**
- Code audit completed — 4-part audit of pointers.js (24K lines), frontend HTML/JS, tenant/vertical pages, SQL/DB patterns. Full findings documented. 5 bugs fixed. **(Session 94)**
- Core notification system — `notification` table, GET/POST/PATCH endpoints in pointers.js, bell icon with unread badge in mobile UI. Platform-level feature, not vertical-specific. **(Session 95)**
- Dominant Driver Analysis — stream delta comparison on PPII threshold crossing. Stores `dominant_driver`, `dominant_subdomain`, `protocol_card` on `stability_registry`. Backfilled all 26 existing items. **(Session 95)**
- Stabilization Protocol Cards — 17 cards (A1-A8, P1-P5, C, D, S1) mapped and auto-assigned based on dominant driver routing. Color-coded badge displayed in registry detail modal. **(Session 95)**
- Trust proxy enabled for real client IP logging on Heroku (req.ip now reads X-Forwarded-For). **(Session 95)**
- Outcome Tracking & Follow-up — `registry_followup` table, auto-scheduled follow-ups on registry creation, follow-up queue tab on Stability Registry with overdue badge, outcome capture (improving/stable/declining/escalated). `dateToBillEpoch()` helper. **(Session 95)**
- Pattern-Based Triggers — PPII_TREND_UP (3 consecutive rising periods), PPII_SPIKE (15+ point jump), PROTECTIVE_COLLAPSE (Isolation+Recovery+Purpose all worsening). Configurable thresholds via admin_settings. Signal/promotion/rule chain. Creates Yellow-urgency registry items automatically. **(Session 95)**
- Physician Annotations — `physician_annotation` table, GET/POST endpoints, "Add a Note" on Physician Portal, "Physician Notes" section on physician detail page. Physicians add context (travel, life events, schedule changes); care team sees annotations alongside scores. **(Session 95)**
- CSV Export — `/v1/export/:report` endpoint supporting registry, followups, roster, compliance. Export buttons on Stability Registry, Roster, and Compliance pages. Column selection and preview modal on registry export. **(Session 95)**
- Notification Rules Engine — `notification_rule` table, `fireNotificationEvent()` helper, 12 rules seeded per Erica's March 22 specs. Event-to-recipient routing with role fan-out, member notifications, all-clinical broadcast. Timing offsets for delayed notifications (missed survey 24h/48h). Wired into createRegistryItem. Admin endpoints for rule management and test-firing. **(Session 95)**
- Clinician-to-Member Relationships — clinicians enrolled as members with `IS_CLINICIAN` molecule. Physicians receive `ASSIGNED_CLINICIAN` molecule (1-to-many). Helper functions abstract the assignment CRUD. Designed for seamless SSO transition — when external system of record arrives, only the data source changes, not the platform structure. **(Session 95)**
- Configurable Member Terminology — tenant-level sysparm for singular/plural member label (Physician/Physicians, First Responder/First Responders). All UI pages reference the dynamic label instead of hardcoded text. **(Session 95)**
- Clinician-to-Member UI — Clinicians tab on clinic page (view/assign/unassign physicians). Clinician caseload filters on roster, action queue, and follow-ups. Physician detail shows assigned clinicians. Dashboard "Clinician Caseloads" summary table. Physician portal "Clinician Caseload" entry path. Notification routing to assigned clinician via new `assigned_clinician` recipient type. CSV exports (roster, registry) include "Assigned Clinician" column. **(Session 96)**

# 18. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 6 | Compliance entry: cadence changes | Erica | **RESOLVED — Session 98: cadence_type (weekly/monthly/quarterly/yearly/custom) + cadence_days. Default on rule, override per physician.** |
| 8 | Trigger stacking: one level or two | Erica | Open |
| 9 | Trigger expiration: persist or auto-reverse | Erica | Open |
| 10 | Clinician override expiration | Erica | Open |
| 11 | Tier thresholds: single event override? | Erica | Open |
| 13 | Notification recipients per urgency | Erica/Damian | **RESOLVED — Erica responded March 22, 2026. See Section 19D below.** |
| 14 | Enrollment workflow | Erica | Open |
| 15 | Role-based access | Erica/Damian | Open |
| 16 | Intervention catalog | Erica | **RESOLVED — 17 protocol cards delivered March 2026** |
| 17 | State funding and timeline | Damian | Open |
| 18 | Mandatory vs. voluntary | Damian | Open |
| 21 | Seven-stream weights with Provider Pulse | Erica | Open |
| 26 | Additional Provider Survey instrument? | Erica | Open |
| 35 | Tier duration for trigger escalations | Erica | Open |
| 38 | Provider Stability Alert storage | Bill/Erica | RESOLVED — stored as SIGNAL molecule on accrual |
| 42 | Care team dashboard | Erica/Damian | Deferred |
| 44 | Auto-return to Green when items resolve | Erica | Open |
| 45 | Notification system: who, how, role-based | Erica/Damian | **RESOLVED — Erica responded March 22, 2026. All 5 questions answered. See Section 19D.** |
| 46 | PPII formula transparency to participants | Group | **NEW — Erica included full formula in consent doc but flagged uncertainty. Transparency vs. gaming risk. Group decision needed.** |
| 47 | Stanford PFI licensing for anchor battery | Damian | **NEW — Free for non-profit. If pilot entity is for-profit, need Stanford Risk Authority permission.** |
| 48 | Build sequencing: validation battery vs. protocol cards vs. outcome tracking | Group | **RESOLVED — Erica provided prioritized list March 20, 2026. See Section 19 roadmap.** |

# 19. Remaining TODO

### Technical Debt (from Session 94 code audit)

1. **PPII composite end-to-end test** — need physician with enough stream data to push composite above 35
2. **POST_ACCRUAL wiring verification** — confirm hook fires after survey COMMIT and compliance COMMIT, not just accruals endpoint
3. **Distribute physicians across clinics** — all 8 still on program_id=13 (Lakeview/HealthPartners)
4. **toISOString() audit** — many files still use UTC dates instead of local
5. **PPSI sentinel end-to-end test** — scoring function wired (Session 94), needs live test through full chain
6. **Survey portal return bug** — may be fixed by auth.js absolute path changes, needs testing
7. **Demo reset script** — restore data to known state for repeatable demos
8. **Convert 35 direct molecule SQL references** to use bulk helpers — systematic refactor
9. ~~**Auto-refresh after data entry**~~ — RESOLVED Session 94
10. ~~**Remove URL param dependency from clinic.html**~~ — RESOLVED Session 99
11. ~~**Compliance item management UI**~~ — RESOLVED Session 98
12. ~~**Server version bump**~~ — RESOLVED
13. ~~**Heroku deployment**~~ — RESOLVED Session 98
14. ~~**Server-side auth on 282 endpoints**~~ — RESOLVED Session 97
15. ~~**Registry audit/history views**~~ — RESOLVED Session 96
16. ~~**Compliance cadence override per physician**~~ — RESOLVED Session 98

### Session 94 Bug Fixes (RESOLVED)

- `poser_mobile.html` — undefined `params` variable (line 693) + hardcoded `tenant_id === 5` (line 721)
- `scorePPSI.js` — wrong signal name `PULSE_Q3` → corrected to `PPSI_Q3`
- `pointers.js` line 1357 — `molecule_int_to_date(a.audit_ts)` → corrected to `audit_ts_to_timestamp(a.audit_ts)`
- `compliance_member.html` — missing `credentials: 'include'` on fetch calls
- `dashboard.html` — modal HTML after `</body>` tag → moved inside `<body>`

### Session 94 Code Cleanup (RESOLVED)

- Extracted shared `event-report-modal.js` — used by clinic.html, physician_detail.html, physician_portal.html (~210 lines of duplication eliminated)
- Extracted shared `compliance-entry-modal.js` — used by clinic.html, compliance_member.html (~300 lines of duplication eliminated)
- Extracted shared `compliance-items-modal.js` — used by clinic.html, compliance_member.html

### Erica's Prioritized Feature Roadmap (March 20, 2026)

| Priority | Feature | Status | Est Sessions | Notes |
|----------|---------|--------|--------------|-------|
| 1 | **Physician Affiliations** | ~~COMPLETE — Session 98~~ | — | Affiliations page, add/edit/remove, badge display on physician detail. |
| 2 | **Mobile Notification System** | DELIVERY INFRASTRUCTURE COMPLETE. | Vendor swap only | Rules engine (Session 95) + delivery queue, digest batching, delivery window, per-tenant config, queue UI (Session 101). `sendDelivery()` stub — one function swap when Twilio/SendGrid selected. Remaining: actual vendor integration, HIPAA-safe message templates. |
| 3 | **Dominant Driver Analysis** | ~~COMPLETE — Session 95~~ | — | Stream delta comparison identifies dominant driver + sub-domain. Stored on registry items. Backfilled all 26 existing items. Runs automatically on new registry item creation via POST_ACCRUAL hook. |
| 4 | **Stabilization Protocol Cards** | ~~COMPLETE — Session 95~~ | — | Protocol card assigned automatically based on dominant driver routing (A1-A8, P1-P5, C, D, S1). Displayed as color badge in registry detail modal. |
| 5 | **Outcome Tracking & Follow-up** | ~~COMPLETE — Session 95~~ | — | `registry_followup` table, auto-scheduled follow-ups on registry creation (Yellow/Orange: 2/4/8wk, Red: weekly×4 then 4/8wk, Sentinel: 48h then weekly×3). Follow-up queue tab on Stability Registry with overdue badge. Outcome capture (improving/stable/declining/escalated). Pathway-specific answers via JSONB column. |
| 6 | **MEDS — Missing Event Detection** | ~~COMPLETE — Session 96~~ | — | Daily scheduled scan, real-time check on page load, consecutive miss escalation, MEDS flags on roster. |
| 7 | **Pattern-Based Triggers** | ~~COMPLETE — Session 95~~ | — | Three pattern detections in POST_ACCRUAL: PPII_TREND_UP (3 consecutive rising periods), PPII_SPIKE (15+ point jump), PROTECTIVE_COLLAPSE (Isolation+Recovery+Purpose all worsening). Configurable thresholds via admin_settings. Signal/promotion/rule chain wired through engine. Creates Yellow-urgency registry items with dominant driver + protocol card + auto-scheduled follow-ups. |
| 8 | **Score Feedback / Physician Annotations** | ~~COMPLETE — Session 95~~ | — | `physician_annotation` table, "Add a Note" on Physician Portal, "Physician Notes" section on physician detail. Physicians provide context (travel, life events, schedule changes) visible to care team. |
| 9 | **Compliance Cadence Overrides** | ~~RESOLVED Session 98~~ | — | cadence_type + cadence_days on both tables, CRUD admin page, per-physician edit. |
| 10 | **Clinician-to-Member Relationships** | ~~COMPLETE — Session 96~~ | — | Clinicians enrolled as members with `IS_CLINICIAN` molecule. `ASSIGNED_CLINICIAN` molecule on physicians (1-to-many). Helper functions for CRUD. Full UI: Clinicians tab on clinic page, caseload filters on roster/action queue/follow-ups, clinician display on physician detail, dashboard caseload table, physician portal caseload entry, notification routing, CSV export column. Built for seamless SSO transition. Erica confirmed model March 23. |
| 11 | **Convergent Validation Battery** | ~~COMPLETE — Session 96~~ | — | 6 anchor instruments built and scoring (PROMIS, PFI, Mini-Z, UCLA-3, CFQ, CGI-S). Research consent flag and conditional flow deferred to pilot launch. |
| 12 | **Role-Based Access Controls** | NOT STARTED | 1 | Different data visibility per role per consent framework information boundary policy. |
| 13 | **ML Predictive Modeling Foundation** | ~~COMPLETE — Session 97, RETRAINED Session 101~~ | — | Calibrated Gradient Boosting, 16 features, ML_RISK_SCORE molecule, Physician Detail card, auto-start via custauth STARTUP hook. v0.2.0 evidence-based (Erica's elicitation document, 7 archetypes, signal-streams-first). Step 2 (new features: domain breadth, concordance gap, chronicity) deferred. |

### Remaining from this roadmap: ~~Mobile notification delivery~~ DELIVERY INFRASTRUCTURE COMPLETE — vendor swap only. Role-Based Access Controls (1 session). ~~F1/T5 batch detection~~ BUILT — Session 101. 13 of 13 items complete (RBAC is the only remaining work).

## 19A. Dominant Driver Analysis — Full Specification

Source: Erica's "Dominant Drivers Protocol" and "Follow up Build" documents (March 2026).

### How the Dominant Driver Is Identified

Each week, the system compares the contribution of each active PPII stream to the overall score movement. The dominant driver is the stream with the largest week-over-week increase or the highest relative contribution to the current PPII score.

- When PPSI is dominant: system further identifies which of the 8 PPSI domains contributed most (sub-domain routing to Cards A1-A8).
- When Provider Pulse is dominant: system identifies which of the 7 Provider Pulse sections triggered the escalation (signal routing to Cards P1-P5).

### Four Primary Routing Pathways

All pathways use capability-based assignment: the item owner is the user assigned to the Registry item by the program's routing configuration, and escalation routes to the next capability level.

**Pathway A: PPSI Instability Dominant**
- Clinical interpretation: Functional destabilization at the psychological or work-sustainability interface.
- What this is NOT: Not automatically a mental health crisis. Not relapse. Not fitness-for-duty.
- Sub-domain routing: Sleep→sleep reset, Burnout→burnout mitigation, Work Sustainability→schedule review, Isolation→peer activation, Cognitive Load→cognitive protection, Recovery→routine reconstruction, Meaning+Purpose→professional re-engagement.
- Assignment: Outreach-level user (primary). Clinical-authority user informed if persistent or Red tier.
- Response SLA: Yellow 72h, Orange 48h, Red same-day.
- Success criteria: Dominant domain score reduced ≥1 point. Physician confirms intervention relevant. PPII trend stable/improving. Evaluated at 2/4/8 week checks.
- Escalation: No improvement after 2 consecutive weeks → next capability level. Multiple domains deteriorating simultaneously → bypass sub-domain routing, trigger multi-domain clinical assessment.

**Pathway B: Provider Pulse Dominant**
- Clinical interpretation: Treating clinician observed clinical deterioration. 35% weight — most reliable external indicator.
- What this is NOT: Not a self-report signal. Physician may not yet be aware.
- Provider Pulse signal triggers: (1) Stability Concern ≥2 → clinical check-in. (2) Sleep Reduction ≥2 consecutive → sleep reset. (3) Treatment Engagement ≥2 → engagement outreach. (4) Mood ≥2 + Work Stability ≥2 → schedule review + protected time. (5) Safety Concern ≥2 → recommend C-SSRS screening (Card S1) to clinical-authority user (does NOT auto-activate).
- Provider Stability Alert override: "Immediate stabilization recommended" bypasses all routing → clinical escalation directly.
- Assignment: Clinical-authority user (primary) for stability concern and safety signals. Outreach-level user for engagement, sleep, work-function signals.
- Response SLA: Safety signal same-day. Stability concern ≥2 within 48h. Engagement/sleep within 72h.
- Success criteria: Next Provider Pulse shows improvement in flagged domains. Treating clinician confirms stabilization trajectory.
- Escalation: Scores remain ≥2 in same domain across 2 consecutive assessments → escalation-authority user.

**Pathway C: Compliance Dominant**
- Clinical interpretation: Monitoring engagement declining. System's FIRST interpretation is logistical friction or scheduling barriers, NOT behavioral non-compliance.
- What this is NOT: NOT relapse. NOT non-adherence. NOT willful disengagement. First response is always a friction audit.
- Intervention sequence: (1) Friction audit. (2) Engagement outreach (non-punitive). (3) Support needs assessment. (4) Re-education if unclear on requirements. (5) SENTINEL override: confirmed positive, refused/tampered test, or missed test + missed check-in in same period → immediate Red workflow.
- Assignment: Compliance-level user (primary). Outreach-level user engaged if pattern persists beyond 2 periods.
- Response SLA: Yellow 72h, Orange 48h, SENTINEL same-day Red workflow.
- Success criteria: Next compliance period shows full engagement. Friction barrier identified and resolved.
- Escalation: Misses persist 2+ consecutive periods after barrier resolution → clinical review. SENTINEL at any point → immediate Red.
- Note: Success is evaluated at next compliance period, not fixed calendar interval. System must know physician's compliance period schedule.

**Pathway D: Event Accrual Dominant**
- Clinical interpretation: Destabilizing events reported. Events are situational stressors. Reporting is a sign of engagement, not impairment.
- What this is NOT: NOT evidence of impairment. NOT fitness-for-duty trigger (unless severity 3 with concurrent clinical signals).
- Event-type routing: Adverse Patient Event → clinical debriefing + peer support. Call Schedule Surge → schedule review + employer liaison. Personal Life Disruption → supportive outreach + stabilization plan adjustment. Treatment Change → enhanced monitoring + clinician coordination. Compliance/Investigation → documentation support + emotional support.
- Assignment: Outreach-level user (primary). Clinical-authority user for severity 3. Employer liaison for schedule-related events.
- Response SLA: Severity 1 within 72h, Severity 2 within 48h, Severity 3 same-day + clinical review.
- Success criteria: PPII stabilizes/improves within 2-4 weeks. No secondary destabilization cascade. Physician confirms adequate support.
- Escalation: Multiple events within 2-week window. PPII continues rising post-intervention.

### Dashboard Implementation Requirements

When a dominant driver is identified, the registry item displays: Urgency, Dominant Driver (stream + sub-domain), Date/time stamp, Recommended Response (assigned protocol card), Response SLA (tier-adjusted timeline), Success Check (2/4/8 week target), Status, Resolution notes, Driver Override fields (Override Requested By, Original Driver, Overridden To, Override Reason — preserved for audit). All resolved items logged and timestamped with resolving user.

## 19B. Stabilization Protocol Cards — Full Specification

Source: Erica's "Stabilization Protocol Cards & Annual Review Guide" document (March 2026).

Each protocol card appears in the Stability Registry Item Detail modal when a Dominant Driver is identified. The item owner sees exactly what to do, in what order, by when, and what success looks like.

### Response Timeline Reference

| Tier | Initial Contact + Intervention | Success Checks |
|------|-------------------------------|----------------|
| Yellow | Within 72 hours (intervention delivered at initial contact) | 2-week, 4-week, 8-week |
| Orange | Within 48 hours (intervention delivered at initial contact) | 2-week, 4-week, 8-week |
| Red | Same day (intervention delivered at initial contact) | Weekly until Yellow/Orange, then 2/4/8-week |
| SENTINEL | Immediate | 48 hours, then weekly |

For all tiers, the initial contact includes the intervention itself. For Yellow/Orange, the 2/4/8-week follow-ups are success checks. For Red, weekly checks until tier improves to Yellow/Orange, then transitions to 2/4/8.

### Card Inventory

**Pathway Cards (A-D):** Protocol A (PPSI Dominant), Protocol B (Provider Pulse Dominant), Protocol C (Compliance Dominant), Protocol D (Event Accrual Dominant). Each card defines step-by-step actions, assignment, success metric, escalation trigger.

**PPSI Sub-Domain Cards (A1-A8):**
- A1: Sleep Stability — sleep reset protocol. Escalation: sleep ≥2 after 2 weeks, or sleep + cognitive co-elevation.
- A2: Emotional Exhaustion/Burnout — burnout mitigation. Escalation: burnout ≥2 after 2 weeks AND Meaning+Purpose decline.
- A3: Work Sustainability — schedule/workload review. Escalation: domain ≥2 after 2 weeks AND employer unable to implement changes.
- A4: Isolation+Support — peer activation, connection facilitation. Escalation: isolation ≥2 after 2 weeks AND co-occurs with Recovery decline or Compliance disengagement.
- A5: Cognitive Load — cognitive protection, differentiate situational vs persistent. Escalation: domain ≥2 after 2 weeks AND not situational → clinical review. Patient safety consideration.
- A6: Recovery/Routine Stability — routine reconstruction. Escalation: recovery ≥2 after 2 weeks AND treatment inconsistency. Combined with Isolation → escalate immediately.
- A7: Meaning+Purpose — professional re-engagement. NOTE: this domain moves more slowly. Success metric at 4-week check (not 2-week). Escalation: meaning ≥2 after 4 weeks AND co-occurs with Burnout.
- A8: Global Stability Check — holistic assessment. Escalation: global ≥2 for 2 consecutive weeks AND unexplained by domain scores.

**Provider Pulse Signal Cards (P1-P5):**
- P1: Provider Stability Concern ≥2 — contact submitting clinician, structured clinical contact. Escalation: remains ≥2 across 2 consecutive assessments.
- P2: Sleep Reduction ≥2 consecutive — coordinate with clinician, execute Card A1 steps. Escalation: sleep ≥2 on 3rd consecutive Pulse, or sleep + cognitive decline.
- P3: Treatment Engagement ≥2 — non-confrontational outreach, barrier assessment. Escalation: remains ≥2 across 2 consecutive assessments, or co-occurs with compliance signals.
- P4: Mood Instability ≥2 + Workload Spike — schedule review, protected time. Escalation: mood persists ≥2 after workload relief.
- P5: Safety Concern ≥2 — HIGHEST URGENCY. Immediate notification of clinical-authority and escalation-authority users. System recommends C-SSRS screening (Card S1). Already at maximum escalation — if unresolved, fitness-for-duty determination activated.

**Special Card S1: Suicide Risk Screening Activation**
- SUPERSEDES ALL OTHER ACTIVE CARDS when triggered. Standard Dominant Driver routing paused. C-SSRS responses do NOT flow into PPII scoring.
- System-initiated: When Provider Pulse Safety Concern ≥2, system recommends C-SSRS to clinical-authority user. System does NOT auto-create S1 item — clinician decides.
- Clinical triggers: Any user concern about participant safety, self-disclosure of suicidal thoughts, treating clinician reports safety concern.
- Risk classification: Low (Q1/Q2 only) → document, enhanced check-in 48h, activate A4/A7. Moderate (Q3 or lifetime Q6a) → immediate clinical-authority notification, safety planning required, Orange minimum, weekly full PPSI. High (Q4/Q5/recent Q6b) → immediate Red-Level clinical escalation, same-day contact, practice cessation consideration, clinical emergency.
- Success metric: Safety plan documented, risk level reassessed at next contact, treating clinician aware, no adverse event within 30 days.

### Annual Protocol Effectiveness Review

Quarterly: Operational metrics only (SLA compliance, protocol adherence, completion rates). Annual: Full review including outcome data, success rates, escalation patterns, card revisions. Ad hoc: Any Tier 1 adverse event triggers immediate post-event review.

Data collection per card: activation count, SLA compliance rate, average time to resolution, success metric achievement rate. Per driver: identification frequency, accuracy rate (confirmed vs overridden). Outcome tracking: Return-to-Green rate within 8 weeks, sustained stability at 12 weeks, adverse event rates. False positive/negative analysis. Bias review by demographics/specialties.

## 19C. Outcome Tracking & Follow-up System — Full Specification

Source: Erica's "Follow up Build" document (March 2026).

### Core Concept

When a registry item is created with a dominant driver, the system auto-schedules success checks at 2, 4, and 8 weeks. These checks evaluate whether the intervention produced the desired outcome. The schedule adjusts by tier:

- **Yellow/Orange:** 2-week, 4-week, 8-week success checks.
- **Red:** Weekly checks until tier improves to Yellow/Orange, then transitions to 2/4/8-week schedule.
- **SENTINEL:** Check at 48 hours, then weekly per clinical determination.
- **Compliance pathway exception:** Success evaluated at next compliance period (not fixed calendar interval). System must know physician's compliance period schedule (testing windows, check-in cadence) to compute follow-up date.

### What Each Success Check Evaluates (per pathway)

- **Pathway A (PPSI):** Dominant domain score reduced by ≥1 point. Physician confirms intervention relevant. PPII trend stable/improving.
- **Pathway B (Provider Pulse):** Flagged section shows improvement. Treating clinician confirms positive trajectory.
- **Pathway C (Compliance):** Next compliance period shows full engagement. Friction barriers resolved. No repeated misses.
- **Pathway D (Event):** PPII stabilizes/improves within 2-4 weeks. No secondary cascade. Physician confirms support received.

### At Each Success Check, Determine

1. Is the intervention working? (Score/engagement improving)
2. Should the current approach continue?
3. Is escalation needed? (Escalation triggers per pathway)
4. Can the registry item be resolved?

### Database Requirements

- `registry_followup` table: registry_item_id, followup_type (2wk/4wk/8wk/weekly/48h/compliance_period), scheduled_date, completed_date, outcome (improving/stable/declining/escalated), notes, completed_by.
- Auto-schedule follow-ups when registry item is created with a dominant driver.
- Follow-up queue display: upcoming checks sorted by date, overdue checks highlighted.
- Outcome capture: structured outcome per check, resolution notes.

## 19D. Notification System — Erica's Responses (March 22, 2026)

### Delivery Channels
- **All channels wanted:** Email, SMS/text, and push notifications
- **HIPAA compliance required** for email — must not include PHI in email body; use generic "You have a new notification" with link to platform
- **Randomized drug test notifications** — high priority; Ohio lacks this and wants it. Selling point for Washington State evaluation

### Role Routing Rules

| Event | Who Gets Notified |
|-------|-------------------|
| Drug test results (positive/concerning) | Clinical-authority AND case manager |
| Missed survey reminder | Physician only (until it triggers MEDS alert) |
| P5 Safety Concern | ALL clinical staff + alert on stability registry |
| Compliance deadline approaching | Physician only |
| MEDS alert (escalated missed survey) | Clinical staff (escalation from physician-only) |

### Timing Rules

| Event | When to Fire |
|-------|-------------|
| Survey missed | At deadline, then 24 hours after, then 48 hours after (3 notifications) |
| Drug test result | Only on positive or concerning result |
| Compliance deadline | 3 days before AND day-of |

### Severity Levels
- **Critical** — P5 Safety, positive drug test, MEDS escalation
- **Warning** — missed survey, compliance deadline approaching
- **Info** — routine reminders, system messages

### Batching
- **Routine notifications:** batch into daily digest
- **Critical alerts:** bypass batching, deliver immediately
- Critical = real-time push + email + SMS; Warning/Info = daily digest or in-app only

### Implementation Notes
- Randomized drug test assignment + notification is a differentiator vs. Ohio's current system
- Email must use HIPAA-safe templates: no names, no scores, no clinical details in email body
- SMS similarly — generic "Action required in PI²" with link
- Push notifications can contain slightly more detail since they're on the authenticated device

# 20. Strategic Notes

**First healthcare client:** Credential for Primada Health worth multiples. Working platform + Joe's Optum relationship = door opener.

**Survey system and MEDS strengthen core:** Both benefit loyalty vertical immediately.

**Multi-stream composite scoring:** New core capability. Loyalty clients could use engagement composites.

**Biggest risk — MITIGATED:** PPSI is unvalidated. Erica's anchor-accelerated convergent validation strategy produces publishable evidence at month 6–9. Pilot must be validation study, not just product launch. Anchor battery buildable now.

**Second biggest risk — ADDRESSED:** Intervention gap. Detection without intervention is incomplete. Erica's 17 protocol cards + outcome tracking system close this gap. Requires dominant driver analysis and registry extension to implement.

**State of Wisconsin presentation:** 81-slide deck delivered March 14, 2026 — "Before the Breaking Point." Erica, Tom, and Damian loved it. Slide 77 transitions to live PI^2 demo. Presentation positions Wisconsin as the national standard-setter.

**Ohio opportunity (March 2026):** Tom Joles met with Jim (Wisconsin PHP contact) who just returned from Ohio's PHP program — one of the premier programs nationally. Ohio is unhappy with their current system: can't modify interfaces, can't produce data by specialty. Both are native capabilities of Pointer (multi-tenant configurable UI, specialty is a molecule query). Jim is setting up a meeting with Ohio next week. Jim's only reservation: "not tested or proven." The anchor validation strategy and protocol card outcome data directly address this objection. Ohio would be tenant 6 — own branding, compliance items, signal thresholds, protocol cards. No code changes, just configuration.

**Multi-state expansion model:** Each state is a tenant. Per-physician-per-month SaaS revenue. Near-zero incremental engineering cost per state. 48 states need this. Revenue sources: physician licensing fees, state appropriations, grants. Tom wants to explain "all the various streams of potential revenue that other states draw."

**ML as differentiator:** No other physician wellness platform captures temporal data with the depth and structure needed for true predictive modeling. The pilot data collection phase IS the ML training phase. By month 12, survival analysis models can predict time-to-destabilization. Published outcome data + validated instruments + predictive models = moat nobody else has.

# 21. ML Predictive Risk Engine (Session 97 — March 26, 2026)

## Overview

Standalone ML service (`ml/ml_service.py`) runs alongside Pointers. Auto-started via wi_php custauth STARTUP hook. Receives 16 features per physician, returns a 0-100 risk score with clinical label.

**Algorithm:** Calibrated Gradient Boosting (300 estimators, depth 4). Calibrated so probabilities are accurate — when the model says 70%, it means 70%.

**Model version:** v0.2.0 — Evidence-based clinician-elicited model. Model files: `ml/model.pkl`, `ml/scaler.pkl`, `ml/model_info.json`.

**v0.2.0 (Session 101):** Retrained using parameters from PI2_Clinician_Elicited_Prior_Model_Final.docx (Dr. Erica Larson). Literature synthesis from 16 PHP outcome studies (1995-2025). Signal-streams-first training — registry status is a consequence, not a training input. 7 evidence-based archetypes replace 5 synthetic patterns: Stable Green (58%), Slow Burn (13%), Acute Break (7%), Oscillator (10%), Silent Slide (4%), Recovery Arc (10%), Chronic Borderline (6%). Temporal trajectory simulation generates week-by-week domain progression with evidence-based rates of change, activation sequences, noise parameters, and event impact multipliers. Before/after snapshots saved in `ml/` directory. Step 2 (add domain breadth, concordance gap, chronicity features) deferred.

**v0.1.0 (Session 97):** Pre-Alpha trained on synthetic clinical patterns. 5 archetypes with guessed parameters. Replaced by v0.2.0.

## The 16 Input Features

| # | Feature | Source | Calculation |
|---|---------|--------|-------------|
| 1 | ppsi_current | PPSI survey | Most recent PPSI total score (0-102). From activity molecules (MEMBER_SURVEY_LINK + MEMBER_POINTS). |
| 2 | ppsi_trend | PPSI survey | Current score minus oldest of last 5 scores. Negative = improving. |
| 3 | ppsi_volatility | PPSI survey | Standard deviation of last 5 PPSI scores. Higher = more erratic. |
| 4 | pulse_current | Provider Pulse | Most recent Pulse total score (0-42). From activity molecules (PULSE_RESPONDENT_LINK + MEMBER_POINTS). |
| 5 | pulse_trend | Provider Pulse | Current minus oldest of last 5 Pulse scores. |
| 6 | compliance_rate | member_compliance | Completed items / total assigned items. 1.0 = fully compliant. |
| 7 | compliance_misses_30d | member_compliance | Assigned minus completed. |
| 8 | survey_completion_rate | member_survey | 1.0 if any completed surveys exist, 0 if none. |
| 9 | consecutive_misses | notification | Count of notifications containing "consecutive" for this member in last 30 days. |
| 10 | days_since_last_ppsi | member_survey.end_ts | Days between now and last completed PPSI survey. |
| 11 | days_since_last_pulse | member_survey.end_ts | Days between now and last completed Pulse survey. Null if no Pulse data. |
| 12 | meds_flags_30d | notification | Count of MEDS-related notifications for this member in last 30 days. |
| 13 | registry_open_count | stability_registry | Open registry items (status='O') for this member. |
| 14 | registry_red_count | stability_registry | Open items with urgency RED or SENTINEL. |
| 15 | days_enrolled | member.enroll_date | Today minus enroll_date (Bill epoch). |
| 16 | ppii_current | (currently = ppsi_current) | Should be composite PPII score — not yet implemented. |

## Synthetic Training Data (5 patterns)

- **Stable (50%)** — low PPSI, low registry, good compliance
- **Gradual decline (15%)** — rising PPSI, accumulating registry items
- **Spike-recover (10%)** — sudden PPSI spike then recovery
- **Sudden crash (10%)** — rapid destabilization across all signals
- **Registry-driven (10%)** — moderate PPSI but RED/SENTINEL items. Per Erica's design: SENTINEL = immediate action, RED = same day. These override PPSI.

## Score Storage

ML_RISK_SCORE molecule: `5_data_22` (N1 = risk score 0-100, N2 = date in Bill epoch). Attaches to member ('M'). New row only written when score changes — gaps between dates mean stable score. The sequence of molecules IS the trajectory.

## UI

Yellow "Predictive Risk" card on Physician Detail page. Shows score, risk label, confidence phase. When ML service is down, card shows "Predictive Risk service unavailable" — never silently disappears.

## Feature Importance (current model)

registry_red_count (78%), registry_open_count (14%), ppii_current (3%), ppsi_trend (2%), compliance_rate (1%). The model heavily weights RED/SENTINEL registry items — aligned with Erica's clinical escalation design.

## Known Issues / Next Steps

- ppii_current copies ppsi_current — should be the actual PPII composite
- survey_completion_rate is binary (0 or 1), not a true rate
- Null pulse values sent to ML as neutral defaults
- Model needs validation against real outcomes once pilot data accumulates
- Feature report: `node ml_report.js` (command line tool for tuning/clinical review)

# 22. Session 98 Bug Fix — CGI-S and Anchor Battery Submit (March 28, 2026)

CGI-S rating and anchor battery instruments were failing on submit with "Submit failed." Root cause: the survey submit endpoint in pointers.js validated accrual_type against a whitelist that did not include ANCHOR_SURVEY. The accrual_type was added to the database in db_migrate v29 and the submit handler whitelist in pointers.js was updated. Both instruments now submit successfully. DB version: 29. Deployed to Heroku.

# 23. Erica's ML Elicitation Document (March 28, 2026)

Erica delivered `PI2_Clinician_Elicited_Prior_Model_Final.docx` — an evidence synthesis from 16 PHP outcome studies (1995-2025), peer-reviewed addiction medicine literature, and clinical practice guidelines from FSPHP, AASM, and AMA.

## Key Proposal: Signal Streams First

Train the ML model on raw signal streams (PPSI domain scores, compliance behavior, Provider Pulse observations) rather than using registry status as a primary input. Registry status is a coordinator judgment call — training on it creates circular learning. Instead, validate model predictions against registry status after the fact to check correlation.

## Evidence-Based Parameters Provided

The document provides specific, literature-backed parameters to replace the synthetic estimates used in Session 97:

- **Population distributions:** 55-65% stable Green, 13% Slow Burn, 7% Acute Break, 10% Oscillator, 4% Silent Slide
- **Domain activation orders:** Sleep leads workload-driven destabilization; Recovery/Routine leads relapse-related destabilization
- **Rates of change:** Sleep +1 to +1.5 points/week in Slow Burn; Burnout +0.5 to +1.5/week
- **Clinical thresholds:** Burnout 9-10/15 rarely reverses without intervention; Cognitive load 8-10 = patient safety concern; Isolation >8 = 65-75% destabilization within 60 days
- **Noise parameters:** Stable physicians fluctuate ±0-1 per domain/week; 5-10% of weeks have transient bad-day spike (+3-5 points, resolves in one week)
- **Event impact multipliers:** Moderate life event adds 5-10 PPSI points in Green; 1.5-2x in Yellow; 2-3x in Orange
- **Concordance signal:** Sustained PPSI/Provider Pulse discordance >15% for 3+ months is an independent predictive signal

## Next Steps

Retrain ML model using these evidence-based parameters instead of synthetic estimates. Erica will create protocol cards tied to specific destabilization signatures. PHP medical directors and clinical staff invited to contribute additional expertise.

# 24. New Feature Requests (March 28, 2026)

## 24a. Automated Random Toxicology Test Selection and Notification

Fits directly into the existing cadence system. The cadence rule defines testing frequency (e.g., 2x/month), the member gets their own instance — the randomization algorithm reads from that existing data.

**Platform-side (buildable within Pointers):**
- Randomization algorithm with configurable parameters (frequency, distribution, blackout dates, geographic constraints)
- Per-physician testing frequency tied to monitoring agreement (cadence instances)
- Complete audit trail of every randomization decision
- Escalation workflow — no acknowledgment within configurable timeframe → missed-test compliance entry in existing compliance stream
- Collection site assignment based on location or pre-assigned site

**External integrations required:**
- Notifications (SMS, phone, push) — Twilio or similar
- Electronic test ordering to collection sites — HL7/LIMS integration
- Electronic lab result delivery back into platform — HL7/LIMS integration
- Chain-of-custody documentation support

Assessment: The platform-side work is straightforward — easier than most of what has been built. The external integrations are standard but each is its own project.

## 24b. Secure Document Management System

Designed as core platform functionality — not PHP-specific, usable by all verticals.

**Architecture:** Black box storage function (like molecules). `member_document` table holds all metadata (document type, category, upload date, expiration date, notes, uploader, version, status). Actual files stored separately. For initial development, files stored in database table. For production, swap internals to Amazon S3 (encryption at rest by default, HTTPS in transit) — one function change, nothing else changes.

**Capabilities:**
- Support for PDF, DOCX, XLSX, JPG/PNG, TIFF
- Document categorization/tagging, configurable per program
- Folder/category organization within each physician's case file
- Version control for amended documents
- Role-based access controls (requires RBAC — item #12, prerequisite)
- Full-text search via text extraction on upload; OCR for scanned documents
- Inline document preview (PDF viewer, image viewer)
- Audit trail on every upload, view, download, deletion
- HIPAA-compliant storage (encryption at rest and in transit)
- Integration with Physician Detail page
- Attach documents to compliance entries, registry items, events
- Document expiration alerts for monitoring agreements and board stipulations
- Bulk export for complete case files
- Intake workflow — prompt for required documents on enrollment, track outstanding
- E-signature integration (DocuSign or Adobe Sign, ~$0.50-2.00 per signature at volume)

## 24c. Additional Platform Items

- **Protocol card reference library:** Clickable protocol card recommendations accessible from physician page
- **PPSI safety alerts:** ~~Alert mechanism when notes are entered on PPSI, flag for designated staff review. Trigger logic TBD (all notes vs. keyword-based).~~ **BUILT — see Section 24d below.**
- **Affiliations "+" button:** Exists but too subtle (dashed gray circle). Make more prominent.

## 24d. PPSI Safety Alerts — BUILT (March 30, 2026)

When a physician adds a note on their weekly PPSI check-in, the system immediately alerts all clinical staff. This connects to the S1 (Safety Sentinel) protocol card — if a physician discloses safety concerns in free-text notes, staff sees it immediately rather than discovering it days later in the activity timeline.

**Design decisions:**
- **All notes trigger an alert** (not keyword-based). Volume will be low — most physicians completing a 90-second Mini PPSI won't type notes. The ones who do are already signaling something worth reading. No false negatives on safety.
- **Configurable per survey** via `note_alert` boolean on the survey table. Currently enabled for PPSI only. Provider Pulse notes don't trigger (clinicians completing Pulse are already clinical staff). Can be enabled for any survey with a data change.

**Implementation:**
1. `note_alert` column added to `survey` table (BOOLEAN, default FALSE). Set TRUE for PPSI.
2. When a survey with `note_alert=TRUE` is submitted with a comment, `PPSI_NOTE_ENTERED` notification event fires.
3. Notification rule: `all_clinical` recipients, `critical` severity, immediate delivery.
4. Bell icon goes urgent (yellow bell with swing animation, pulsing red badge with glow) when any unread critical notifications exist. Returns to normal when cleared.
5. Clicking the notification navigates directly to the physician's detail page via PageContext.
6. `survey_note_review` table tracks review lifecycle: `pending` → `reviewed` (no action needed) or `escalated` (create registry item).
7. Physician Detail page shows "PPSI Notes for Review" section with pending notes (red border, action buttons) and completed reviews (faded, with reviewer name and date).

**Database:** `survey_note_review` table (review_id, activity_link, member_link, tenant_id, review_status, reviewed_by, reviewed_at, review_notes). db_migrate v32.

**API endpoints:**
- `GET /v1/survey-note-reviews/:membershipNumber` — list reviews for a member
- `PATCH /v1/survey-note-reviews/:reviewId` — update status (reviewed/escalated)

**Staff workflow:** Notification fires → bell pulses → staff clicks → lands on physician detail → reads note in red "PPSI Notes for Review" section → clicks "Reviewed — No Action" or "Create Registry Item." If escalated, staff creates a registry item from the Stability Registry page (S1 card activates through existing machinery for safety concerns).

## 24e. F1/T5 Batch Detection — BUILT (March 31, 2026)

Daily scheduled job (`F1_T5`) that detects two time-based destabilization archetypes that can't be detected at accrual time:

**T5 — Chronic Borderline Management:**
- Detects physicians with open YELLOW registry items created 12+ weeks ago that have at least one completed follow-up cycle
- Represents the "slow plateau" — Yellow tier maintained but no improvement despite intervention
- Creates a new registry item with extended_card='T5', stays at YELLOW urgency (transitions to sustained monitoring cadence)
- One T5 per member — won't create duplicates if an open T5 already exists

**F1 — Intervention Failure (Structured Reassessment):**
- Detects completed follow-ups where the outcome is 'declining' or 'escalated' and the parent registry item is still open
- Represents a failed intervention cycle — the success check revealed the protocol isn't working
- Creates a new registry item with extended_card='F1', escalates urgency (Yellow→Orange, Orange/Red→Red)
- One F1 per member per run — deduplicated across multiple failing follow-ups

**Implementation:**
- `registerJobHandler('F1_T5', ...)` in pointers.js — follows MEDS handler pattern
- Queries stability_registry + registry_followup for detection criteria
- Calls `externalActionHandlers.createRegistryItem()` to create registry items with extended card assignments
- Fires `EXTENDED_CARD_DETECTED` notifications (critical severity, all clinical staff)
- Job registered in db_migrate v34 (daily, tenant 5)
- EXTENDED_CARD_DETECTED notification rule added in db_migrate v34

# 25. Documents Produced

- Primada_Insight_Phased_Engagement.docx — 4-phase engagement proposal
- Pointer_Healthcare_Internal.docx — Internal strategy doc
- Insight_Platform_Technical_Overview.docx — External technical overview
- Three_Stories_Personas.docx — Three fictional personas for state presentations
- Primada_Health_Overview.docx — One-pager capability document
- **Insight_Build_Notes.docx — This document (living document)**
- 26_0314_Insight_Health_Solutions.pdf — State of Wisconsin presentation (81 slides)
- PI2_Platform_Screenshots.docx — Annotated screen prints of live platform (sent to Erica, Session 85)

### Source Documents from Erica (March 2026)

- PPSI_Updated_with_Scoring.pdf — Revised 34-item instrument, 0--3 scale, max 102
- Provider_Pulse_Survey_Final_with_Scoring.pdf — 14-item clinician instrument, max 42
- Provider_Pulse_Escalation_and_Dominant_Driver_Routing.pdf — 5 escalation signals, 5 routing paths
- Mini_PPSI.pdf — Layered monitoring design: 8-question weekly Mini PPSI with 3-week rotation
- Erica_Q&A_Response_March_2026 — Detailed responses to 12 design questions
- **PI2_Stabilization_Protocol_Cards_and_Annual_Review_Guide.pdf — 17 protocol cards (4 pathway + 8 PPSI sub-domain + 5 Provider Pulse signal), response timelines, registry integration spec, annual review guide**
- **PI2_Convergent_Validation_Anchor_Battery_Complete_Item_Reference.pdf — 46 anchor items from 6 validated instruments, deployment integration guide, data export spec**
- **PI2_Psychometric_Validation_Protocol_Anchor_Accelerated.pdf — Anchor-accelerated convergent validation strategy, domain-by-domain anchor profiles, analysis plan, integrated 24-month timeline**
- **Dominant Drivers Protocol.pdf — Governance & audit framework defining PPII composite, dominant driver identification, 4 routing pathways (A-D), sub-domain routing, dashboard implementation requirements (March 2026)**
- **Stabilization Protocol Cards.pdf — 17 protocol cards (A-D pathway cards, A1-A8 PPSI sub-domain cards, P1-P5 Provider Pulse signal cards, S1 suicide risk screening), response timeline reference, annual review guide (March 2026)**
- **Follow up Build.pdf — Implementation spec for outcome tracking and follow-up system: 2/4/8-week success check schedule, tier-based timelines, pathway-specific success criteria, dashboard field requirements (March 2026)**
- **PI2_Participant_Rights_Transparency_and_Consent_Framework.pdf — 8-section signature-ready consent document, information boundary matrix, data access rights, score feedback spec, future expansion opt-in rights**
- **PI2_Clinician_Elicited_Prior_Model_Final.docx — Evidence-based ML elicitation document. Literature synthesis from 16 PHP outcome studies (1995-2025), peer-reviewed addiction medicine research, clinical practice guidelines (FSPHP, AASM, AMA). Provides population distributions, domain activation orders, rates of change, clinical thresholds, noise parameters, event impact multipliers for ML training data generation (March 2026)**
- **PHP_Infrastructure_Structures_Funding_by_State.docx — Comprehensive state-by-state reference of all 50 states + DC PHP programs. Covers organizational structure (medical society, independent nonprofit, state board-administered, third-party contractor, academic), primary funding sources (license fee surcharges, participant fees, medical society funding, donations/grants), relationship to medical board, populations served, core services. Key finding: only 3 states lack full FSPHP programs — Nebraska, Wisconsin (in development via WisMed Assure), and California MD. Prepared for fee structure discussions and Dr. Bundy meeting (March 2026)**
- **US_Physician_Health_Programs_Complete_Guide.xlsx — Three-sheet Excel workbook: (1) State PHP Directory — 53 programs with phone, structure, website; (2) PHP Infrastructure & Services — detailed breakdown of how PHPs are structured and funded nationally; (3) Monitoring Components — specific monitoring services (random tox testing, blood/hair/oral fluid, breathalyzer/PEth/EtG) with typical parameters. Competitive intelligence for national expansion and pricing discussions (March 2026)**

# 26. Meeting Prep — Week of March 31, 2026

Erica's preparation for Dr. Bundy / Washington State meeting:

- **Synthesia video updated** with platform screenshots as backdrop for slides. Link: https://share.synthesia.io/75692221-7231-4cdc-bbf1-4b107379b4d8
- **PROMIS permissions requested** — commercial use requires permission even for research. Screenshots of our implementation sent for validity review.
- **Mini-Z question ordering** — Question 1 may need exact original wording and may need to move to position 3 to match standard instrument arrangement. Our implementation has burnout self-classification at position 3 which matches. Need to verify exact wording of question 1 against original.
- **Cognitive questions** — Using validated subset (fewer than 25 questions). Precedent exists in literature for subsets of 15 or fewer with proven validity. Sufficient for initial validation work.
- **Provider Pulse validation** — Using only the validation question at end of survey. Stability registry serves as validation itself. Could add two additional validation items but decided against due to clinician burden.
- **Stanford PFI** — Not yet reviewed against ours or permissions requested. Erica working on this.
- **Monitoring programs list** — All programs nationally with funding sources, structure, and offerings. Prepared for Damian's fee structure discussion. Dr. Bundy (FSPHP) represents monitoring programs nationally and may ask about broader plan and RIS integration.

# 27. Notification Delivery System — BUILT (April 3, 2026)

Core platform feature — notification delivery queue with external channel tracking (email, SMS, push). Built as infrastructure that any vertical can use. The actual send is a stub (`sendDelivery()`) — one function swap when the vendor is selected (Twilio, SendGrid, etc.).

## Architecture

When `fireNotificationEvent()` creates an in_app notification, it now also creates `notification_delivery` records for each enabled external channel (email, SMS, push). Each delivery is tracked independently with status, retry count, and timestamps.

**Delivery window:** Warning/info notifications respect a per-tenant delivery window (default 7am-9pm local time). Outside the window, deliveries are held and released when the window opens. Critical notifications (P5 Safety, positive drug test, MEDS escalation) bypass the window — delivered immediately 24/7.

**Digest batching:** A daily scheduled job groups warning/info deliveries from the last 24 hours into a single digest per recipient per channel. Reduces notification fatigue.

## New Tables

**`notification_delivery`** — One notification can produce multiple deliveries (email to physician, SMS to physician, email to case manager). Each tracked with: status (pending/sent/held/failed/digested), channel, severity, attempt count, error message, sent timestamp.

**`notification_delivery_config`** — Per-tenant settings: timezone, delivery window (start/end), digest hour, channel enable/disable flags (email, SMS, push), max retries. Seeded for tenant 5 (Wisconsin PHP, Central time, 7am-9pm).

## Scheduled Jobs

**`NOTIFY_DELIVER`** (every 5 minutes) — Processes pending deliveries via `sendDelivery()`. Releases held items when delivery window opens. Retries failed deliveries up to max_retries. Critical items processed first.

**`NOTIFY_DIGEST`** (daily) — Bundles sent warning/info deliveries from last 24 hours into one digest per recipient per channel. Marks originals as 'digested'.

## API Endpoints

- `GET /v1/notification-deliveries` — Queue list with status/severity/channel filters, counts by status
- `GET /v1/notification-delivery-config` — Tenant delivery config
- `PUT /v1/notification-delivery-config` — Update tenant delivery config (upsert)

## UI

**`notification_queue.html`** — Notification Queue page in Administration section of dashboard. Shows all delivery records with filter chips (status, channel, severity). Config bar displays current tenant delivery settings with green/red dots for channel status. "SIMULATED MODE" badge while stub is active. Erica can see exactly what the system would send, to whom, on what channel, at what time.

## Vendor Swap Path

When a provider is selected:
1. Replace `sendDelivery()` function body with actual Twilio/SendGrid/push calls
2. Add HIPAA-safe message templates (no PHI in email/SMS body — generic "Action required in PI²" with link)
3. Remove "SIMULATED MODE" badge from queue page

Everything else — queue, routing, timing, retry, digest, tracking — is already running.

## db_migrate v35

---

## Session 102 (April 6-7, 2026)

### Bug Fixes (Erica April 5 feedback)
1. Mini PPSI auto-expand when answer >= 2 (poser_mobile.html)
2. Mini PPSI scoring uses dynamic max_possible (answers.length × 3) instead of hardcoded 102
3. Compliance back button navigates directly to clinic.html (no document.referrer loop)
4. Event button on roster calls EventReportModal.open() (was calling undefined showEventModal)
5. Notification badge decrements client-side immediately on mark-read

### Test Suite
- Playwright browser test framework added to test harness (tests/run.cjs)
- 16 tests, 286 assertions, all API + browser verification
- New tests: C5 PPII composite, C6/C7 dominant driver + protocol cards, C8 pattern triggers, C10 follow-ups, C11 clinician assignment, C12 ML risk, C14 CSV export
- Tests found 2 server bugs: roster CSV export (wrong table name `tier` → `tier_definition`), compliance CSV export (wrong column `item_id` → `compliance_item_id`)

### Demo Gaps Built
- Mobile app Trends tab (chart + check-in history list)
- Roster CSV export with column selection + preview modal
- Compliance CSV export with column selection + preview modal

### Terminology System
- member_label updated: Physician → Participant (sysparm, db_migrate v38)
- staff_label created: Clinician → Health Support Staff (db_migrate v38-39, staff-label.js module)
- Both configurable per tenant via sysparm editor
- 6 HTML pages updated with StaffLabel.init()

### Feature Requests
- #9: Add/remove staff button on participant chart (edit mode with dropdown)
- #10: Outreach notes ("Notes & Outreach" section with type dropdown: phone call, meeting, email, outreach attempt)
- #13: Push full PPSI (FULL_PPSI_REQUESTED flag molecule, db_migrate v40, auto-clears after 34-question completion)
- #14: Safety notes banner on action queue (built, parked per Erica)
- #15: Note sharing notice on portal + mobile check-in
- #16: Activity timeline filter by type (All, PPSI, Pulse, Compliance, Events, Notes)
- #17: Risk explanation on predictive risk card (contextual text by risk level + confidence note)
- #18: F1/T5 follow-up schedules updated (T5 → monthly sustained monitoring, T1 → 12-week extended check)

### Licensing Board System
- `licensing_board` table with SERIAL PK (db_migrate v41)
- 5 Wisconsin boards seeded: MEB, PACB, DEB, PEB, SBN
- `LICENSING_BOARD` molecule (storage_size 2, value_type key, external_list)
- CRUD API: GET/POST/PUT/DELETE /v1/licensing-boards
- Per-member API: GET/PUT /v1/members/:id/licensing-board
- Admin UI: admin_licensing_boards.html (inline edit)
- Enrollment form: licensing board dropdown on csr_member.html
- Participant detail: licensing board card with Change button

### db_migrate v36-v41
- v36: error_log table
- v37: PPSI_Q3_ALERT promotion
- v38: clinician_label sysparm + member_label → Participant
- v39: Rename clinician_label → staff_label
- v40: FULL_PPSI_REQUESTED flag molecule
- v41: licensing_board table + LICENSING_BOARD molecule

### Remaining
- Dashboard #11: grouping views (by participant, clinic, staff caseload, licensing board) — next session
- #12: Participant status tracking — parked per Erica
- ASSIGNED_CLINICIAN molecule column definition — known issue

---

## Session 103 (April 7, 2026)

### Dashboard Redesign (#11)
- Replaced static Clinics table + Clinician Caseloads section with **tabbed Program View**
- 4 tabs: **By Clinic** (default), **By Staff**, **By Licensing Board**, **All Participants**
- Search bar above tabs filters within active view (by name, ID, clinic, or board)
- By Clinic: groups by program_name with tier breakdown, click-through to clinic select
- By Staff: groups by assigned clinician with tier breakdown, shows unassigned separately
- By Licensing Board: groups by board_name with profession, "Not Assigned" at bottom
- All Participants: flat searchable roster with name, clinic, board, tier, PPII, trend — click-through to detail
- Dynamic labels: member_label and staff_label applied throughout (stats row, tab headers, tables, MEDS section, nav cards)
- Hardcoded "Physician"/"Clinician" text replaced across dashboard

### Wellness Endpoint Enhancement
- `/v1/wellness/members` now returns `licensing_board` object per member (board_code, board_name, profession)
- Batch lookup via LICENSING_BOARD molecule + licensing_board table join

### Bug Fix: ASSIGNED_CLINICIAN Molecule
- Root cause: missing `molecule_value_lookup` row — `getMoleculeStorageInfo()` defaulted to `attaches_to = 'A'` instead of `'M'`
- Fix: db_migrate v42 adds lookup row with `value_type = 'link'`, `attaches_to = 'M'`, `context = 'member'`
- Clinician assignment via API no longer returns 500

### db_migrate v42
- ASSIGNED_CLINICIAN molecule_value_lookup row

### Core Platform Test Suite
- 8 new test files in `tests/core/` covering the core Pointers engine (Delta airline tenant)
- **test_accrual_pipeline** (19 assertions): Activity creation, molecule storage, point bucketing, balance updates, invalid input rejection
- **test_bonus_engine** (14 assertions): Bonus evaluation, Type N activities, MIDDLESEAT/REGIONAL/DIAMOND50 bonuses, expired bonus filtering, manual re-evaluation
- **test_promotion_engine** (11 assertions): Promotion listing, counter advancement, DIAMONDMEDALLION progress, FLY3-5K qualification, manual re-evaluation
- **test_point_types_buckets** (11 assertions): Point type listing, bucket creation, expiration rule assignment (2-year Delta rule), balance verification
- **test_redemption** (9 assertions): RED10K redemption processing, balance decrease, Type R activity, insufficient balance rejection
- **test_tier_system** (7 assertions): Tier definitions, member tier lookup, ranking uniqueness, tier assignment
- **test_csr_member_page** (9 assertions): Browser — CSR page load, activity display, verbose bonus breakdown, Test button, Points section
- **test_admin_pages** (8 assertions): Browser — bonus admin, promotion admin list/edit pages load with correct data
- Full suite: 24 tests, 374 assertions, all passing

### Bonus Result Engine Design Doc
- `Bill/Bonus_Result_Engine_Design.md` — architectural proposal for multi-result bonuses with external actions
- Deferred until second tenant or when promotion-as-middleman pattern becomes friction

### Remaining
- Deploy everything to Heroku — when Bill says go
- #12: Participant status tracking — parked per Erica

## Session 104 (April 9, 2026)

### ML v0.3.0 — 3 New Features (Erica's Elicitation Doc)
- **domain_breadth**: Count of PPSI domains exceeding personal baseline by >1.5 SD (0-8). Queries last 5 PPSI surveys, computes per-domain rolling mean + SD from prior 4, counts elevated domains in current survey.
- **concordance_gap**: Signed Provider Pulse - PPSI divergence on normalized 0-100 scale. Positive = clinician sees more risk than self-report (Silent Slide detector).
- **chronicity**: Days since oldest open YELLOW-urgency stability_registry item (Chronic Borderline detector).
- gatherMemberFeatures() in pointers.js returns all 19 features
- ml_service.py: FEATURE_NAMES 16→19, simulate_trajectory generates derived features per archetype, extract_features neutral defaults, model retrained on 3,239 samples
- Python tests: 7 tests (feature names, all archetypes, ranges, concordance consistency, training, defaults, predictions)
- Node test C16: 33 assertions (all 19 features present, correct types/ranges, all members, ML service accepts payload)

### Trigger Signals #4 + #13 — ALL 13 COMPLETE
- **T6 Repeated Moderate** (#4): Added to F1_T5 daily batch job. Detects members at Yellow/Orange tier for 3+ consecutive weeks (21+ days). Escalates to ORANGE urgency with extended_card='T6'. Excludes members with open T5 (supersedes at 12 weeks). Fires EXTENDED_CARD_DETECTED notification.
- **MISSED_SURVEY** (#13): Added to MEDS processMedsForMember(). Creates YELLOW registry item on first overdue survey detection. Deduplicates: skips if open MISSED_SURVEY item already exists for member.
- db_migrate v44: REPEATED_MODERATE + MISSED_SURVEY signal types

### Molecule Single Source of Truth
- Eliminated legacy field sync hack — `molecule_def` parent row no longer gets `value_kind`, `scalar_type`, `lookup_table_key` copied from detail table on save
- Cache loading now overlays column 1 metadata from `molecule_value_lookup` onto `molecule_def` entries at startup (62 molecules merged)
- Removed write-time sync UPDATE from PUT /v1/molecules/:id/column-definitions
- Fixed molecule_encode_decode.js: encodeMolecule + decodeMolecule use LEFT JOIN molecule_value_lookup WHERE column_order=1 with COALESCE
- Updated LOYALTY_PLATFORM_MASTER.md to reflect new architecture
- Legacy columns remain on table (not removed) — just no longer synced or read from

### Bonus / Promotion Edit Page Redesign
- Both pages reorganized: **Definition → Criteria → Results** (top to bottom)
- Blue left accent border + light background (#f8fafc) + uppercase section labels (DEFINITION, CRITERIA, RESULT/RESULTS) on all three sections
- Bonus page: result fields (Type, Amount, Point Type) moved below criteria into own card
- Matches promotion page visual pattern — ready for multi-result Bonus Result Engine

### Infrastructure
- Claude system user on Heroku (db_migrate v43) — enables Playwright browser testing against demo.primada.io
- Delta sysparm fix: points_mode=calculated, calc_function=calculateFlightMiles (db_migrate v45)
- Heroku v48, DB v45
- Full suite: 31 tests, 500 assertions, all passing

### Next: Bonus Result Engine
- Design doc ready: Bill/Bonus_Result_Engine_Design.md
- bonus_result table, BONUS_RESULT molecule, multi-result processing
- Build on Delta first, test with core suite, then decide on Insight migration

---

## Session 121 — Tenant-isolation hardening (Heroku v89)

Bill asked: "are we in a good place tenant-wise — no more plumbing to fix?" Ran
a three-agent isolation audit (core data layer / Insight code leakage / auth +
session binding). It did **not** come back clean — there were real cross-tenant
holes. Closed them across two commits (`dd5de91`, `88821b1`), deployed to
Heroku v89. `SERVER_VERSION 2026.06.25.1557`, no DB change (v80).

What was wrong and what changed (Insight-relevant highlights):
- **Master key:** `POST /v1/auth/tenant` ("switch tenant") had no superuser
  check — any logged-in user could rebind their session to another tenant.
  Now superuser-only; the tenant middleware only honors a client `tenant_id`
  for superusers, so `req.tenantId` is authoritative everywhere.
- **PHI IDORs:** `member-surveys/:link` (survey answers), MEDS
  check/member/seed/summary, PPII/PPSI history, physician-annotation create,
  and stability_registry / registry_followup / survey_note_review writes all
  either keyed on a raw link with the tenant taken from the row, or took the
  tenant from the request body. All now scoped to `req.tenantId`.
- **PII search leak:** member search and alias search took `tenant_id` from the
  query → a user could search another tenant's people. Now `req.tenantId`.
- **Ungated admin:** `/v1/users*` (create/edit/password) and `/v1/clone` had
  **no role gate at all** — any user, even a CSR, could mint a superuser or
  clone tenant config. Now `/v1/users*` is admin/superuser-only (non-superusers
  confined to their own tenant, can't grant superuser); `/v1/clone` superuser-
  only.
- **SQL injection** in the compliance CSV export (`exports.js`, interpolated
  `member_id`) — parameterized.
- Loose ends: session cookie `secure` now true on Heroku; registry
  audit-history join pinned to `sr.tenant_id` (was already tenant-safe via the
  per-tenant entity link — belt-and-suspenders).

Verified: full suite 51/51 (955 assertions), lint 0, dyno up, live security
spot-checks 401 unauthenticated.

**Deferred to a future session (agreed with Bill):** the RLS database backstop
(fix #1) — currently decorative (enabled only on `member`, not forced, superuser
connection bypasses it, GUC never set). High value, high risk; needs its own
design + tests. A lighter build-time "every tenant query has its filter" check
is the cheaper alternative to weigh first. Plus lock-in cross-tenant regression
tests. See `ACTIVE_WORK.md`.

---

## Session 122 — Cross-tenant lock-in tests + RLS design (no deploy)

Followed up on the Session 121 deferral. Bill chose: build the safety-net
(regression) tests now, write up the strong database lock as a plan for later,
and skip the lint.

**Lock-in regression tests (the reliable "forgotten-filter" gate).** Session
121's fixes were verified by code review + suite-green only — never by a live
cross-tenant attack with non-superuser creds. Now they are:
- `tests/insight/test_cross_tenant_isolation.cjs` (21 assertions). A tenant-1
  (Delta) `DeltaCSR` session is blocked from every tenant-5 (Insight) PHI/PII
  surface Session 121 scoped: member profile, **survey answers by link**,
  stability registry, MEDS status, PPII history, member search, and a
  physician-annotation **write**. Reverse direction too: a throwaway tenant-5
  csr (created at runtime as the superuser, wiped by the snapshot restore) is
  blocked from tenant-1 data. **Two-sided by design** — every attacker-404 is
  paired with an oracle call (Claude superuser) that makes the identical request
  as the rightful owner and gets 200, so a pass proves "blocked," not "the row
  doesn't exist"; a legit-control phase proves own-tenant access still works.
- `tests/core/test_tenant_auth_gates.cjs` (12 assertions). The keystone
  privilege gates: `POST /v1/auth/tenant` superuser-only (csr **and** admin
  blocked from rebinding tenant), `/v1/users*` admin-only with own-tenant
  confinement (a forged `tenant_id:5` is ignored — the new user is pinned to the
  admin's own tenant) and no granting superuser, `/v1/clone` superuser-only, plus
  a superuser positive control so the gate is proven role-based, not blanket-deny.

**RLS backstop — designed, not executed.** `docs/RLS_BACKSTOP_DESIGN.md`.
Confirmed live that the current database lock is decorative (RLS only on
`member`, not FORCEd; the `app.tenant_id` GUC is never set; the app connects as a
superuser that bypasses RLS). The doc enumerates the three footguns — the
pooled-connection GUC bleed is the dangerous one (it can *create* a leak) — and
lays out a staged, reversible rollout (provision `app_rls` inert → policies in
shadow → wire the GUC → flip the role + FORCE → burn-in) with a both-direction,
both-environments test gate. Execution is its own future session.

**The "lighter lint" was dropped on purpose.** A grep for "tenant query missing
`tenant_id`" can't tell a safe query from a leaky one in this codebase
(globally-unique link IDs make many tenant-table queries legitimately
filter-free; SQL is assembled in helpers; ~885 query sites). It would be a green
check that means nothing — the regression tests are the reliable version of it.

No `pointers.js` / `SERVER_VERSION` / DB change — tests + docs only, nothing to
deploy. Verified: full suite **53/53 (987 assertions)**, lint 0.

---

## Session 122 (cont.) — Performance Profile self-service demo (Dr. Stadler)

Erica sent two new instruments (Performance Profile + OER) and asked for help
conceptualizing the build; Tom scoped the immediate ask to a **QR Performance
Profile demo** for the Dr. Stadler Zoom on 2026-07-01 (workforce monitoring +
optimization are the sellers; OER lower priority). Built and shipped that slice.

**What it is.** A no-login, public Performance Profile assessment that scores on
the device: PPSI (34 items, 8 sections) + **Foundations of Health** (16 items, 3
pillars — physical activity / nutrition / substance use, public-domain items),
with a scored result (PPSI stability tier + section bars, dominant lifestyle
driver + pillar bars, matched-resource teasers) and a short intro (referral type,
the stability/performance dual-track, a licensure gate). Files:
`verticals/workforce_monitoring/performance_profile.html` (+ `_qr.html`,
`qrcode.min.js`). DEMO-CONTAINED: in-page scoring, nothing persisted, no account,
no wi_php data touched.

**Access / QR.** Clean public routes `/performance-profile` and
`/performance-profile/qr` (in `pointers.js`, added to `PUBLIC_ROUTES`). The QR's
target URL is **derived from `window.location.origin`** (never hardcoded), so it
self-describes per environment — on demo.primada.io it resolves to
`demo.primada.io/performance-profile`. QR rendered offline via vendored
`qrcode-generator` (MIT). **Design decision (build later):** QR content should be
just base URL + one big opaque code resolved by a code→context table (affiliation,
single-use, expiry) — not URL params. See `docs/PERFORMANCE_PROFILE_OER_PLAN.md`.

**Discoverable entry — the key lesson.** The first cut was an orphan page nothing
linked to, reachable only by a long hand-typed URL — that broke Erica's
"log into the site and the feature is there to test" pattern (hours of friction
before this was understood). Fixed with a data-driven **"New — Try It"** section
on the Insight dashboard (`dashboard.html`): each item shows name, description, the
clean URL, and Open + Copy-link, URL built from `window.location.origin`. Every
future feature adds one row to `TRY_IT_ITEMS`.

**PPSI scoring — RESOLVED with Erica (2026-06-27): use the live weighted
scoring**, not the doc's flat 0-102 tiers ("score and run like we have it already
built"). The demo now uses Option A weighted: per-section fraction × the real
wi_php subdomain weights (snapshot of weight set 10 — GLOBAL 0.50, SLEEP 0.105,
BURNOUT 0.095, WORK/ISOLATION/COGNITIVE 0.10, RECOVERY & PURPOSE 0.00) → 0-100,
banded by the live `ppii_thresholds` (yellow 35 / orange 55 / red 75). Foundations
tiers kept as written (Erica approved). Verified the displayed score equals an
independent recomputation; lint 0.

**Deployed** to demo.primada.io across releases v90 (QR demo) → v91 (entry point +
clean routes, `SERVER_VERSION` 2026.06.27.2010) → v92 (weighted scoring, front-end
only). Email to Erica & Tom sent with the Wednesday plan + answers + a "what's
next" (self-registration → participant portal → PHP linkage on a clinical-grade
foundation; OER + medication/UDS cross-check after).

The real build (self-registration, portal, observer/OER, PHP linkage, dual-track
privacy) sits behind **Phase 0 foundation: RBAC + the database tenant lock (RLS)**
— see `docs/RLS_BACKSTOP_DESIGN.md` and `docs/PERFORMANCE_PROFILE_OER_PLAN.md`.

---

## Session 123 (2026-06-28) — RLS tenant-lock built, then removed (net zero)

Tried to build the "Phase 0" database tenant lock (Postgres RLS) and **removed it
the same session.** Net effect on the platform: nothing, except docs/tests.

What was built (commit `b27ca88`, db_migrate v81/v82): an `app_rls` login + a
`tenant_isolation` policy on all 56 tenant-scoped tables, enforced via per-request
connection pinning + `SET ROLE app_rls` in `pointers.js` (gated by `RLS_ENFORCE`,
off by default). It worked — cross-tenant reads were blocked at the DB, it followed
DB + tenant switches, full suite green under enforcement. Along the way it exposed
several real bugs we fixed (login pinned to a stale tenant; cache reloads trimmed
to one tenant; a DB-switch pool race; a write deadlock).

Why it was removed (commit `06167e8`, db_migrate v83): **performance.** Documented
baseline (Performance Whitepaper) is **1,056 accruals/sec**; under enforcement it
fell to **~100/sec**. Root cause: per-request connection pinning pulled
`getNextLink`'s `link_tank` counter UPDATE *into* the request transaction, so a
shared-row lock was held for the whole ~7ms accrual instead of microseconds —
serializing all concurrent writes (`Lock|transactionid` waits dominated). Even
with the lock off, the always-on query instrumentation left residual drag
(accruals ~601/sec vs 1,056).

Bill's decision: **not worth it for a demo with no live PHI.** The platform already
isolates tenants in code (Session 121) and has cross-tenant regression tests
(Session 122) that catch a forgotten filter the moment it's written. The lock was
insurance against a low-probability event at a high, ongoing cost. So `pointers.js`
was restored byte-for-byte to pre-RLS; v83 drops the policies + role and restores
member's original decorative RLS. The cross-tenant tests +
`docs/RLS_BACKSTOP_DESIGN.md` stay as the record if real production PHI ever lands —
at which point RLS gets re-done with the performance design settled FIRST.

**Lesson:** don't bolt on a heavyweight safety net before it's needed, and price
the performance cost *before* committing to the approach, not after.

**Next:** back to Erica's work — her 8 OER questions and the Performance Profile /
OER build (`docs/PERFORMANCE_PROFILE_OER_PLAN.md`). Not RLS.

---

## Session 124 (2026-06-29) — Erica's work: OER answers, Overview walkthrough, code engine

Three things, in order:

**1. Answered Erica's 8 OER questions and emailed Erica + Tom.** Six of the eight ride
on machinery we already have (cadence/reminders, automatic escalation, the
reportable-event pathway, the integrated participant view, observer transitions, COI
flagging). The two genuinely new pieces are the observer account type and the
clinical-grade dual-track privacy model — and the privacy model (her Q6) is back on
Erica + Chris + legal, so it's the bottleneck for the real self-registration/portal
work. Tom also thumbs-upped the Foundations scoring → now final.

**2. Platform Overview walkthrough — shipped to Heroku (v95).** `verticals/
workforce_monitoring/overview.html` at the public clean route `GET /overview` (mirrors
`/performance-profile`); the Dr. Stadler 2026-07-01 fallback/companion. Walks Insight →
the two instruments → OER monitoring → the engine → roadmap, with a button to launch the
live Performance Profile. Listed in the dashboard "New — Try It" section.
- **Heroku-deploy landmine fixed along the way:** the first deploy crashed because
  Session 123 bumped `EXPECTED_DB_VERSION` to 83 but never deployed (Heroku DB was still
  80), and the catch-up migration **failed on Heroku at v81** — the real v81 creates a
  login role *with a password*, which Amazon RDS forbids. Since v81→v82→v83 nets to zero,
  collapsed v81/v82 to no-ops (v83 kept — already Heroku-safe). This **permanently
  unfroze Heroku deploys.** Site was rolled back to keep it up during the incident, then
  redeployed clean (v95). `SERVER_VERSION 2026.06.28.1754`.

**3. General-purpose `code` table — built, tested, GitHub only (NOT on Heroku).** The
"real QR" mechanism behind referral/access codes — the foundation for Erica's
self-registration link and PHP referral-in asks (and OER observer onboarding).
- Platform's **first Tier-4 (4-byte INTEGER link) entity** (db_migrate v84). First link
  `-2147483648` via `getNextLink('code')`. The public token is a **16-byte base58 random
  string** (`gen_code.js`, off `crypto.randomBytes`), kept separate from the link so the
  enumerable PK is never exposed. Columns: link PK, code token (unique), code_type,
  tenant_id, Bill-epoch start/end dates, max_uses/used_count, status, **JSONB `context`**.
- **JSONB, not molecules**, for the context — molecules are for core loyalty storage +
  bonus/promotion rule evaluation; this is per-record carry-only context. (New memory:
  `feedback_molecules_vs_jsonb`.)
- Engine `mintCode`/`resolveCode`/`consumeCode` (atomic used_count guard); endpoints
  `POST/GET/PATCH /v1/codes` + public `GET /p/:code` (resolve → validate window/uses/
  status → consume → 302 with context as query params; generic 404 page otherwise).
- `admin_codes.html` is an **internal maintenance tool** (mint/list/revoke + QR) on the
  main admin hub — NOT an Erica page. Her real minting will be workflow buttons in the
  Insight surfaces, built later. `qrcode.min.js` moved to project root (shared asset).
- `SERVER_VERSION 2026.06.29.1120`, `EXPECTED_DB_VERSION 83→84`. Test
  `tests/core/test_codes.cjs`. Suite 54/~1009 green, lint 0.
- **Deliberately not deployed:** no Erica-facing change yet, so it sits on GitHub
  (`81c50f8`) until a real consumer (the Insight referral/observer workflow) needs it.

**Next:** the code engine's real consumer — Insight-side "Refer participant" / "Add
observer" buttons that mint a code and hand back a link/QR; or the smaller unblocked
items (Performance Profile pre-fill, OER as a real instrument). The big interactive
features (portal, self-registration, PHP linkage) wait on Erica's privacy model (Q6).

---

## Session 125 (2026-06-30) — Erica overview/welcome edits, demo readiness fix, refer-participant workflow, WisconsinPATH master plan

The day before the Dr. Stadler Zoom (2026-07-01). Four threads, all front-end /
docs (no `pointers.js`, no `SERVER_VERSION` bump, no DB change):

**1. Erica's overview/welcome edits (deployed, Heroku v96).** Per her feedback after
testing the demo + overview:
- Performance Profile **welcome** rewritten to her exact wording — para 1 gains
  "…peak performance and professional development," plus a new middle paragraph
  ("Your commitment… is a sign of professional strength"). Crisis box kept.
- Overview walkthrough: **OER section removed** and the remaining OER mentions scrubbed
  (intro comment, the participant-view tile, the roadmap item), renumbered to 5
  sections. Mike + Jim are focused on **PI² + the screening** for the funding approval;
  the OER is held for the Chris/Jim conversation later.
- Overview: new **"What PI² is"** band after the hero — PI² = Predictive Performance
  Intelligence Infrastructure (from `PI2_Performance_Profile.docx`), framing the
  IHS + PI² + screening bundle Jim is putting in front of Mike for funding.
- ⚠️ This Heroku push **carried the Session-124 code table along** (`git push heroku
  main` deploys all unpushed commits) — Heroku DB was v83, code wanted v84, dyno
  crashed at boot. Fixed with the documented step (`heroku run node db_migrate.js` →
  v84, the `code` table created, Heroku-safe), restart, verified. Lesson logged.

**2. Demo readiness pass (deployed, Heroku v97).** Drove the live Performance Profile
end-to-end in a browser before the demo. Found + fixed a **pre-existing crash**:
`showStep()` called `el("actions").scrollIntoView` but there is no `actions` element,
so it threw a TypeError on **every** step transition (from the Session 122 build),
skipping `window.scrollTo(0,0)` + `updateNext()` — no scroll-to-top between the long
PPSI/Foundations sections, Next-button counter not initialized on arrival. Fix: drop
the dead/broken line. Verified live: a full run-through throws **0** errors and scores
(PPSI 51/100); overview + QR pages clean.

**3. Refer-participant workflow (deployed, Heroku v98) — the code engine's first
consumer.** A "👥 Refer participant" button on the **program dashboard** (Program
Overview header) and the **clinic roster** (action row) opens a panel — referral type
(self / employer / board-mandated), affiliation, optional track, single-use toggle —
mints a referral code via `POST /v1/codes` (tenant from session), and hands the
operator a shareable **link + QR** pointing at the Performance Profile front door.
This is the live front door of **WisconsinPATH Stage 1 registration**. Shared module
`refer_participant.js` (one place, both surfaces); reuses the `admin_codes.html`
mint+QR pattern + the vendored `/qrcode.min.js`. Context (referral_type/affiliation/
track) rides server-side in the `code` table, never in the QR. Bill click-tested on
the live site — "looks good." **Deferred:** the *consumer* half (Performance Profile
reading the code to pre-fill — it edits the live demo page, so post-demo) and "Add
observer" (needs the Stage-5 observer flow that doesn't exist yet).

**4. WisconsinPATH master build plan (`docs/WISCONSINPATH_BUILD_PLAN.md`).** Jim's
anticipated Wisconsin-program workflow → Erica's build requirements
(`PI2_WisconsinPATH_Build_Requirements.docx`) → one master roadmap + a code-grounded
gap analysis (capability scan of the actual platform). **Key honest finding: three
items Erica classified "Configure"/exists do NOT exist —** consent / release-of-
information architecture (the 42 CFR Part 2 work, gated on her Q6 privacy model),
toxicology / lab orders, and OER activation (roadmap only). Everything else she
classified holds up (registry, SENTINEL protocol cards, risk tiering, MEDS/compliance,
notifications + SLA, Provider Pulse, scoring engine). Reusable across state PHP
programs — Erica expects **Washington crossover**, so net-new pieces are to be
tenant-configurable. Consolidated to ONE doc: the old `PERFORMANCE_PROFILE_OER_PLAN.md`
is now a tombstone redirect; `ACTIVE_WORK.md` + the `project_erica_tracking` memory
point at the master.

**Pending Bill (not blocking):** two drafted emails to send (the welcome/overview
"live now" note; the reply acknowledging the WisconsinPATH spec).

**Next:** the consumer half of the referral loop (Performance Profile pre-fill from
the code, server-side) — post-demo; then the unblocked WisconsinPATH Stage 1 items
(referral classification + dashboard segmentation, review queue + triage + disposition
— all ride existing registry/notification/SLA engines). The expensive/gated pieces
(consent architecture, tox/lab, OER + observer, board reporting) wait on Erica's Q6 +
counsel.

---

## Session 128 (2026-07-01) — Molecules-on-users foundation built; POSITION + POSITIONCLINIC created; molecule admin repaired (local-only)

The foundation for **roles on staff** (the review queue's prerequisite) went from design to
built. Three migrations, all local: **v88** widened the staff-login id to 4 bytes (6 columns;
audit attribution verified after), **v89** taught the molecule engine to route storage by the
parent's key size (`molecule_def.parent_bytes` → `{n}_data_*`; all existing molecules
unchanged at 5), **v90** added **shared internal lists** — a list column can borrow another
molecule's value list, so a list like "positions" is entered once and can never drift
(borrower writes rejected; round-trip proven: values read from source, encode/decode correct).

**Bill drove the maintenance page and created the first two 4-byte-parent molecules on
wi_php:** `POSITION` (internal list: Case Manager / Medical Director / Clinician — values
verified stored) and `POSITIONCLINIC` (`4_data_12`: position borrowed from POSITION +
clinic → `partner_program`). POSITIONCLINIC awaits its round-trip proof — nothing writes
user-parent rows yet; that's the next build (the assignment surface). **Open concern (Bill):**
it may need to be `4_data_122` (position + health system + clinic) — decide when the
assignment surface is built; no real data until then.

**The day was dominated by molecule-admin breakage** — every page Bill used was broken, all
fixed and test-covered by session end: values silently dropped on save (the save function was
never called), UI-created list molecules rejected as "not a list" (header never got
`value_kind`), non-rule molecules hidden from the list page, legacy molecules rendering blank
types. Plus the **two-box fix**: the Activity/Member checkboxes now mean exactly "usable in
rules criteria for activity / member / both / neither," honored independently by the criteria
editor (label reworded to match). An agent audit of the remaining molecule surfaces produced
a shore-up list (ACTIVE_WORK) — including two orphan ML molecule definitions
(ML_RISK_LEVEL / ML_CONFIDENCE: no columns, no data, no code references).

Suite 55/1018 green on final code, lint 0. Nothing deployed — the eventual Heroku push now
carries Sessions 126–128 (migrations v85→v90).

---

## Session 129 (2026-07-01/02) — Shore-up list closed + Erica's routing answer

**All six shore-up items from the Session 128 audit are done and verified.** The two that
mattered most: deleting a molecule now also removes its stored data rows (before, they were
orphaned — ghost data waiting for a reused id; proven with a planted row), and the molecule
create screen can no longer report "saved successfully" when the second half of the save
failed (the failure now surfaces with instructions instead of manufacturing half-built
molecules — Session 128's root failure class). Also closed: cross-tenant reads/writes on the
molecule detail + groups endpoints (blocked both directions, proven live), the Test modal's
silent fall-back to Delta when no tenant was selected (now an error), and the unlabeled
view-only column definitions (now carry a "locked by design" note).

**Item 6 went through the migration path on Bill's call:** db_migrate **v91** deletes the two
abandoned molecule definitions `ML_RISK_LEVEL` and `ML_CONFIDENCE` (seeded v49, never got
columns/data/code; the ML pipeline computes the level from `ML_RISK_SCORE`). Resolved by
molecule_key so the same migration cleans Heroku, where they also exist. One audit-note
correction: the "seeded display-template line referencing them" turned out stale — no such
line exists in the database.

**Erica answered the Stage-1 routing question:** new-participant registration reviews go
**Case-Manager-first** — the case manager triages, then escalates/routes to the Medical
Director when needed. Built as the default and configurable, not hardcoded. This unblocks
the review-queue routing design (which still waits on the position/clinic assignment surface
and Bill's 12-vs-122 decision).

**POSITION/POSITIONCLINIC parity executed (v92, Bill's go)** — the Session 128 plan: the
UI-created pair and their `4_data_*` tables were deleted and recreated in one migration
(definitions, the shared position list, the three values, both tables), found by name so the
same change builds them on Heroku at deploy. Round-trip re-proven on the recreated pair.
Bill resolved the 12-vs-122 question: build on position+clinic; real use will tell us if the
health-system level is ever needed.

**The position/clinic assignment surface — built, proven, and browser-tested (later the
same session).** The Edit User page now carries an assignments section: pick a position
(from the one shared list), pick the clinic the way the physician search already works
(health system first, then clinic — Bill's catch, keeping the flow Erica knows), Add.
A person can hold several assignments; exact duplicates are refused with a clear message;
Remove takes one entry away. Underneath, this was the milestone the foundation was waiting
for: **the first real write of a molecule onto a staff login**, proven down to the stored
bytes and locked in by a new 20-assertion test. Nothing tenant-specific is hardcoded —
the section builds itself from molecule configuration, so Delta users simply show nothing,
and the field wording comes from the molecule's column descriptions (editable per tenant).
Claude click-tested the whole screen in a browser before Bill saw it (the new working rule).

**Deploy decision (Bill):** hold the Erica deploy until the Stage-1 review queue ships —
classification + dashboard segmentation alone aren't tangible enough. Next build: the
review queue (Case-Manager-first routing per Erica), riding the registry + notification
engines. Then deploy v85→v92+ in one visible update.

SERVER_VERSION 2026.07.02.0826, DB **v92**, suite **56/1038** green, lint 0. Local-only —
the eventual Heroku push now carries Sessions 126–129 (migrations **v85→v92**).

**Same session, later: system accounts out of staff lists + THE REVIEW QUEUE.** The Claude
system account no longer appears in (or can be touched from) a tenant admin's Users & Roles —
server-enforced; an admin-resets-a-superuser-password hole closed with it. Then the
WisconsinPATH Stage-1 **registration review queue** went in end to end: enrolling a
participant creates a review in the priority worklist (Yellow, 48-hour clock) and notifies
everyone holding the **Case Manager** position — the first real payoff of positions. The case
manager opens it under the new **Registrations** chip, writes a required triage note, and
picks a disposition: **Advance**, **Route to Resources**, or **Escalate** — which hands it to
a **Medical Director** position holder with the note attached (Erica's routing answer,
config-not-code). Reviews still open past their window escalate on their own (the
REG_REVIEW_SLA job, manually runnable from Scheduled Jobs for same-day testing). The whole
trigger is configuration riding the promotion engine — a new state gets this with database
rows, not code.

The browser walk-through caught **two real pre-existing bugs**, both fixed: clinic-scoped
registry views silently hid members with no clinic (new registrants!), and — the serious one —
**with any filter active, clicking a worklist item opened the wrong record** (stale
position-based indexes from the caseload filter patch); item clicks now resolve by id.

New test `test_registration_review.cjs` (28 assertions — trigger, routing, escalation both
ways, dispositions, overdue job + rerun-safety). Suite **57 tests** green, lint 0.
SERVER_VERSION **2026.07.02.2003**, DB **v95**. The Heroku deploy now carries **v85→v95** —
the complete "how a participant enters WisconsinPATH" story, ready for Bill's click-test and
then Erica.

## Session 130 (2026-07-03) — the referral loop closes: QR referrals pre-fill the Performance Profile

The receiving half of the Session-125 refer-participant feature, deferred until after the
Dr. Stadler demo, is now built. When a participant scans a staff-minted referral QR (or
follows the link), the Performance Profile now **knows how they got there**: the
"How are you connecting with us?" chip arrives pre-selected to match what the staff member
chose at mint time (Employer → "Referred by Employer", Board-mandated → "Referred by
Licensing Board", Self-referral → "Self-Referral"), and the affiliation shows as a quiet
"Referred through: Wisconsin PHP" note. The participant can still change anything.

Privacy design as decided in Session 125: the link and QR carry **only the opaque token**
(`?c=...`) — the Session-124 placeholder that put referral details in the address bar is
gone. The form resolves the referral context server-side through a new public read-only
endpoint (`GET /v1/code-context/:token`) that returns just the whitelisted fields
(referral type, track, affiliation), never counts a use (a single-use code must still
resolve after its one consume at the front door), and answers a generic not-found for
anything invalid. If the lookup fails for any reason, the form simply loads blank —
pre-fill never blocks the assessment.

No DB change. `test_codes.cjs` extended 20→35 assertions (context endpoint whitelist +
no-consume proof + 404s, plus a browser walk asserting the landing URL carries no readable
details and the chip/note render). Claude walked it end to end in a real browser first —
login → dashboard → Refer participant → mint (Employer / Wisconsin PHP) → follow the link →
pre-filled form; also verified a plain visit and a bogus token both give the blank form.

SERVER_VERSION **2026.07.03.1039**, DB stays **v95**, suite **57/1094** green, lint 0.
Local-only — deploy on Bill's go (no migration needed; code-only ride).

**Same session, later: the instrument library opens (Stage 2, part 1) + a paced migration display.**
With Erica's queue feedback still pending, Bill chose to keep building. The survey system
turned out to be closer to a library than the build plan assumed — all 8 instruments already
live as database rows with admin screens. What was missing is now in (db_migrate **v96**):

- **PHQ-9 and GAD-7** — the two public-domain screeners (no license needed, published
  scoring) — seeded as pure data, with scoring functions following the anchor-battery
  pattern. **Safety chain:** PHQ-9's item 9 (self-harm) sits in its own question category;
  ANY answer above "Not at all" raises PHQ9_SI_POSITIVE → PHQ9_SI_ALERT bonus → **RED
  registry item (24-hour clock)** regardless of the total score — all riding the existing
  signal→bonus→registry rails. GAD-7 severity-band alerts deliberately wait on Erica's
  protocol answer.
- **Catalog metadata:** the survey table now carries purpose (screening vs monitoring) and
  license status; the Survey Management page shows both as badges — PHQ-9/GAD-7 "Public
  domain", PPSI/Pulse "Owned", the six anchors "To confirm" (their licensing labels are
  Erica's to confirm, not ours to guess). Screening instruments carry no cadence, so MEDS
  never nags about them.
- **Migration runner now paces for Bill:** each applied version announces "Starting
  Version X", holds two seconds, runs, then "Version X complete" and holds again — only on
  a real terminal; automated runs skip the pauses. Proven live applying v96.
- Drive-by fix: the survey admin page's tenant chip rendered "null" for logins routed
  straight to a vertical — now falls back to the tenant key.

New test `insight/test_instrument_library.cjs` (25 assertions — catalog metadata, both
scorers' exact bands, the RED alert on a positive item 9, no alert on a clean one).
Suite **58/1119** green, lint 0. SERVER_VERSION **2026.07.03.1217**, DB **v96**, local-only.
Next when Erica answers: her proprietary picks become rows, and per-participant assignment
(who takes what, when) gets its own design pass.

---

## Session 131 (2026-07-03) — molecule creation hardened: one routine, proven or gone

A waiting day (Erica/Tom quiet over the July 4th weekend), spent — at Bill's direction — on
work that doesn't widen the gap between what's deployed to Erica and what's local: the
molecule Tier-1 hardening parked since Session 128. Molecules underpin everything Insight is
about to lean on harder (positions, the review queue routing, referral classification), and
they fail *silently* — a badly created one just reads back empty, weeks later.

**There is now ONE way a molecule gets created: `createMoleculeComplete`**
(`POST /v1/molecules/complete`). One call, one transaction: the definition, a lookup row per
column, list values with explicit per-molecule value_ids, and the storage table itself if
missing. Before writing anything it checks every silent-failure trap the platform has been
bitten by — missing value_kind, an internal list wider than one byte, the key-vs-numeric
encoding choice on lookups, lookup tables/columns that don't exist, a borrowed list whose
source isn't a real list owner — and rejects in plain English. After creating, it **proves the
molecule with a real round-trip** (encode a test value, store it, read the bytes back, decode,
compare) and **deletes the whole molecule if the proof fails**. A half-built molecule — the
Session 128 failure class where every page Bill touched was broken — is now structurally
impossible through this path. The admin create page makes one call instead of five; future
migrations call the routine directly (CI's from-scratch migration replay re-proves every old
call against current code on every run — the safety Bill and Claude agreed replaces frozen
per-migration SQL).

Also this session: **migration pacing is now always on** (the Session-130 "watching it run"
holds no longer hide behind terminal detection — Bill updated older databases and saw nothing;
CI opts out explicitly), and MOLECULES.md caught up with reality (§11 parent generalization
marked BUILT, the new routine documented as the creation path).

New test `core/test_molecule_create.cjs` (35 assertions — happy paths for internal list /
external lookup / 4-byte user parent / borrowed list / reference, table creation inside the
transaction, proof-row cleanup, eight plain-English rejections proven to write nothing, and a
browser walk of the rewired create page). The test caught two real bugs before Bill ever saw
the feature: multi-column proofs mis-encoded columns 2+ (header-kind vs column-kind), and a
wild borrowed-list id crashed validation instead of rejecting. Both fixed same session.
Suite **59/1154** green, lint 0. SERVER_VERSION **2026.07.03.1738**, DB stays **v96**,
local-only (nothing pushed — the Erica bundle still waits on her feedback).

---

## Session 131 (2026-07-03, later) — instrument assignment plumbing: who takes what, when (v97)

The Stage 2 part 2 design pass turned into its first build the same day. The design
conversation with Bill settled the shape in one sitting: **we build the plumbing, Erica
turns the valves.** Until today, every participant owed every cadenced instrument —
PPSI weekly plus all six anchors and Provider Pulse monthly, identically, with no way
to say "this participant takes these." The compliance system solved per-participant
expectations long ago; instruments now mirror that proven pattern.

**db_migrate v97 — `member_instrument`:** who takes which instrument, on what schedule.
A participant with no rows keeps today's owes-everything behavior (deploy day changes
nothing); any rows mean they owe exactly their active assignments; pausing everything
means owing nothing. The **one-time mode** is the piece that finally connects screening
to MEDS: "take PHQ-9 once, starting now" — due until completed, satisfied forever after,
no recurring nag. MEDS answers "what does this participant owe?" through one new
resolver used at all four of its decision points. New endpoints assign / pause /
override-cadence / remove, and every write recalculates the participant's next-due
date immediately.

Decisions recorded: default = today's behavior (Bill); who-may-assign deferred until
role enforcement exists (nothing enforces per-position permissions yet — it becomes one
more valve when that lands); per-track templates ("board-mandated gets PHQ-9 + GAD-7")
wait for Erica's protocol answers and become configuration rows, not code.

New test `insight/test_instrument_assignment.cjs` (28 assertions) covering the regime
flip, the exact assigned set in MEDS, one-time satisfied-vs-due, paused-owes-nothing,
cadence override, and cross-tenant confinement. Suite **60/1182** green, lint 0.
SERVER_VERSION **2026.07.03.2200**, DB **v97**. **Next session: the assignment screen**
on the participant chart, plus the two display surfaces (wellness, chart export) that
still show the tenant-global set.

---

## Session 132 (2026-07-04) — the instrument assignment screen + the last two tenant-global surfaces

The second half of Stage 2 part 2: the Session-131 plumbing got its screen, and the two
display surfaces that still showed the tenant-global instrument set now honor the
per-participant assignment.

**The Instruments card on the participant chart** (physician_detail.html, between
Assigned Staff and the summary strip). Collapsed, it's one line: a regime badge —
**"Program default"** (takes every recurring instrument) or **"Individual schedule"** —
plus a count ("Takes 8 of 10 in the program catalog"). **Manage** expands the full
catalog: every instrument with its code, Monitoring/Screening purpose, schedule
("Weekly · program default", "Every 2 weeks · custom", "One-time screening",
"Not assigned"), a Takes-It column (✓ Yes / Paused / —), and per-row actions —
Assign, Pause/Resume, Edit (mode + cadence), Remove. The guardrails from the design
are visible in the flow: assigning the **first** instrument warns that the participant
switches to an individual schedule; removing the **last** one warns they return to the
program default; assigning a screener as recurring without a cadence is rejected in
plain English (the server's words, surfaced as-is). Every change refreshes the MEDS
card below, so the effect of an assignment is visible the moment it's made.

**The two display surfaces:** the wellness dashboard's missed-survey flag now asks
"does this participant owe PPSI, and on what cadence?" through the same resolver MEDS
uses — a participant who doesn't owe PPSI (unassigned or paused) is never flagged, a
cadence override changes the window, and a one-time PPSI is missed only until a
completion on or after its start date. The chart export's MEDS section now exports the
participant's expected set (with mode) instead of the tenant catalog.

Test extended 28→42 assertions (`insight/test_instrument_assignment.cjs`): the export
shows exactly the assigned set with the override, wellness honors the member's own
window and never flags an unowed PPSI, plus a headless-browser walk of the card itself
(assign → regime flips → remove → default restored, zero error alerts). Claude also
click-walked the live screen end-to-end before writing this — assign, the plain-English
rejection, pause, resume, cadence edit, remove, MEDS refresh — zero console errors, zero
residue rows. Suite **60/1196** green, lint 0. SERVER_VERSION **2026.07.04.1137**, DB
stays **v97** (no schema change). Local-only — the Erica bundle still waits on her
feedback.

---

## Session 132 (2026-07-04, later) — Delta UI coverage; a shared-page bug fixed that Insight inherits

Platform work while Erica stays quiet (Bill's go): the long-standing "no Delta UI test
coverage" fragility closed with two browser tests — a full CSR walk (member page,
point summary, posting a real flight through the template form) and a render sweep of
24 admin pages that fails on any console error. The sweep caught a real pre-existing
bug on its first run: three admin pages (`admin_users`, `admin_user_edit`,
`admin_clone`) loaded the header and auth scripts twice, throwing "already been
declared" errors on every load. Fixed by removing the duplicate includes. **Insight
note:** `admin_user_edit.html` is the Users & Roles page where staff positions and
clinics are assigned — so the staff-assignment surface Erica uses loads clean now too.
Suite **62/1239** green, lint 0. No server or DB change beyond HTML.

---

## Session 132 (2026-07-04, evening) — composite closure: the accrual contract enforced both ways (v98)

Bill brought a design check to the table: the add-activity process should validate
against the tenant's composite in **both directions** — every required molecule present
or error, and any data *outside* the composite an error too. The audit found direction
one was built long ago and works; direction two was missing — unknown fields were
silently discarded. They never reached storage (storage only walks the composite), but
the caller was told "success" while their data evaporated. That's the silent-loss
failure mode, now closed: strays are rejected with a plain-English error naming them.

The Insight-specific wrinkle: the PPII composite-recalc pipeline legitimately sends
three fields that aren't composite molecules — the dominant-driver analysis
(DOMINANT_DRIVER, DOMINANT_SUBDOMAIN, PROTOCOL_CARD) rides the accrual payload and is
read in flight by the registry-item creator, never stored as molecules. Rather than
hardcode exceptions, these are now **declared per tenant** in sysparm
(`accrual_context_keys`, seeded for wi_php by db_migrate **v98**) — a new tenant's
context keys are config rows, not code, per the platform's data-drives-behavior rule.

Also closed in the same pass: a failed calculation can no longer be silent (a required
calculated molecule that fails now rejects the whole accrual; an optional one logs
loudly), and sending MEMBER_POINTS directly is rejected with guidance to use
base_points. The no-spoof rule got its proof: a client-sent aircraft type of 'ZZZZZZ'
stored as the server's own 'B738'. New `core/test_accrual_composite_contract.cjs`
(15 assertions); the full suite — **63/1254** green — doubles as proof that every
existing surface, seeder, and the PPII pipeline was already composite-clean.
SERVER_VERSION **2026.07.04.2042**, DB **v98**. Local-only; the Erica deploy now
applies v96–v98.

---

## Session 132 (2026-07-04, wrap) — docs truth pass + access control designed

Closing the day's plumbing list: the two big platform docs (ESSENTIALS + MASTER) got a
truth pass against live code — 14 stale claims corrected, the biggest being a security
section that still described the pre-hardening platform ("no authentication") and a
migration section frozen at v78. And the role-enforcement question got its design doc
(`docs/ACCESS_CONTROL_DESIGN.md`): Bill's model — users, user groups, permissions to
either, a yes/no at every secure thing — mapped onto the existing position molecules,
with kernel-first-then-gates sequencing and the permission map explicitly Erica's
policy call. Deliberately NOT built yet: enforcement can't even turn on until positions
are assigned on the live site, and the map wants her protocol answers. Also: the
Database Utilities clone form now accepts mixed-case names by lowercasing them ("Bill"
→ "bill") instead of rejecting capitals. Everything pushed to GitHub, CI green. Heroku
untouched — the Erica bundle (now v96–v98) still waits on her feedback.

---

## Session 133 (2026-07-05) — WisconsinPATH Stage 3: the vetted evaluator directory (v99)

Erica/Tom still quiet over the holiday weekend, so — per the agreed filler order — the
**evaluator directory** (Stage 3, unblocked, headlines the release AFTER the current
Erica bundle) got built end to end. Her requirement: "Where an independent diagnostic
evaluation is indicated, the participant chooses from a vetted list with costs
disclosed up front," with out-of-state entries first-class (her operational note: no
in-state Wisconsin evaluator currently exists).

**What shipped (all local-only, on Bill's go):**
- **db_migrate v99** — the `evaluator` table (mirrors `licensing_board` + directory
  fields: credentials, evaluation types, city/state, phone/email/website, and the
  cost disclosure as cost_low/cost_high dollars + a free-text cost note), 3 clearly
  labeled SAMPLE entries (MN/CO/IL — Erica replaces them through the maintenance
  page; real vetted names + costs are hers), and the **EVALUATOR member molecule**
  (external_list → evaluator, the LICENSING_BOARD pattern) added to the M composite
  and M input template, so the participant chart shows and records the chosen
  evaluator through the generic profile machinery — no custom chart code.
- **Vertical module `evaluators.js`** — staff CRUD `/v1/evaluators` (tenant-gated,
  duplicate-code 409, backwards-cost-range 400) + **PUBLIC `GET
  /v1/evaluator-directory?t=`** (a participant follows a shared link, no login;
  active entries only, whitelisted fields only).
- **`admin_evaluators.html`** — the staff maintenance page (Program Settings →
  Evaluators card): full CRUD with a delete confirmation that steers toward
  Inactive when the evaluator may be on past records.
- **`evaluator_directory.html`** at clean public route **`/evaluator-directory`** —
  the participant-facing list: cost range front and center on every card,
  location + contact, search + state filter, program-vetted badge. On the
  dashboard's "New — Try It" section with the tenant baked into the copyable link.

**A real pre-existing bug found and fixed on the way:** `GET /v1/code-context/:token`
(the Session 130 referral pre-fill) was never added to the public-route whitelist, so
an anonymous participant arriving from a referral QR got a 401 — and the Performance
Profile silently degraded to the blank form, meaning **the referral pre-fill never
worked for a real participant**. Still local-only (never deployed), now fixed: the
endpoint is public as Session 130 intended, with a regression assert so it stays that
way.

Verified: new `insight/test_evaluator_directory.cjs` (35 asserts — CRUD + guards,
anonymous public list + whitelist, EVALUATOR assign→read-back round-trip, the
code-context regression lock, and browser walks of both pages incl. a
cookies-cleared anonymous walk). A separate deep walk drove the full form lifecycle
(add → edit → deactivate → public exclusion → delete) with zero console errors and
zero residue. Full suite **64/1289 green**, lint 0. SERVER_VERSION
**2026.07.05.1454**, DB **v99**. The Erica deploy now applies **v96–v99**.

**Next Erica asks (ride along with her feedback exchange):** the real vetted
evaluator list — names, credentials, evaluation types, and the costs she wants
disclosed; whether the sample cost presentation (range + note) matches how programs
actually quote.

---

## Session 133 (2026-07-06) — molecule tooling: composite auto-wiring + text molecules made column-aware

Platform-level improvements to the molecule-creation machinery (not Insight-specific,
but recorded here for continuity). Prompted by Bill working through how a new molecule
gets wired into the record structure.

**Composite auto-wiring — one routine, two callers.** New shared `molecule_composites.js`
(`wireMoleculeToComposites`, pure SQL + getNextLink, no server internals) is the single
place a molecule gets added to a composite. Called by BOTH `createMoleculeComplete` (the
online create page, inside its transaction before the round-trip proof, so composite rows
roll back if the proof fails) AND directly by migrations — same parameters. `member_composite
{required}` adds the molecule to the tenant's M composite; `activity_composites [{activity_type,
required}]` adds a per-type row to each named activity composite (so a field can be mandatory on
a base accrual and optional on a partner accrual — each is its own composite_detail.is_required).
Only stored (D) molecules; reference molecules rejected if given composite fields; validated up
front. The create page gained a member Required tick + an activity per-type Applies/Required grid
(built from the tenant's composites). Does NOT touch the input template — form placement stays an
admin choice. **DELETE path fix:** deleting a molecule now also removes its composite_detail rows
(a FK gap the auto-wiring would otherwise have exposed). Create sequence is now molecule → table →
lookup/values → composite → COMMIT → prove-or-remove.

**Text molecules made column-aware.** A text field is just an internal-table lookup — the cell
holds a text_id, the string lives in `molecule_text` (unindexed/text_direct) or
`molecule_text_pool` (indexed/text, deduped) — exactly like a lookup resolves against its table
(the only difference: text is find-or-insert since it's free-form, vs select for a predefined
list). `encodeMolecule` now dispatches on the SPECIFIC column's kind for multi-column molecules
(columnOrder>1 reads the column's own value_kind/scalar_type from the lookup cache), so a text
field works in ANY column, not just column 1. columnOrder 1 is never overridden (== the header),
so every single-column molecule is byte-for-byte unchanged. The round-trip prover no longer bails
on "text in a multi-column molecule" — it proves it. Also fixed the create page's Numeric Value
width dropdown (was offering 1/3/5 bytes, which the server correctly rejects — a number is a
native 2-byte SMALLINT or 4-byte INTEGER only).

**⛔ Known gap, PARKED for its own session — showing a BUNDLED molecule on the activity timeline.**
Traced to root: the activity-display FETCH query only reads the single-cell tables (5_data_1..5),
so a multi-column molecule's values are never loaded for the timeline (text or not). The SAVE side
is done + proven; the DISPLAY side is a change to the core timeline query every tenant uses — do it
rested, whole query in view. Nothing uses a bundled molecule today. Detail: `docs/MOLECULE_COMPOSITE_AUTOWIRE_DESIGN.md`.

Verified: `core/test_molecule_create.cjs` extended to 46 asserts (composite auto-wire member +
per-type activity, reference-with-composite rejected, multi-column text PROVES). Full suite
**64/1300 green**, lint 0. SERVER_VERSION **2026.07.06.1338**, DB stays **v99**. Local-only.

## Session 133 (2026-07-06) — Erica's feedback arrived

Erica ran the WisconsinPATH Stage-1 flow end-to-end herself (assigned Case Manager + Medical
Director roles, created a participant, got a registry item, escalated one, routed one to
resources, advanced+"accepted" one) and loves it ("I like the way this works; it is fantastic").
Two questions, both answered as working-as-designed (not bugs), verified against the code:

1. **"After acceptance, should the participant show in the registry? I didn't see them."** —
   No, by design. **Advance** sets the registry item status='R' (resolved, code ADVANCED), so it
   correctly leaves the OPEN action queue — it did its job. There is **no separate "accept into
   program" activation**; Advance just closes the review — it does not assign a clinic or start
   monitoring. An unassigned participant appears in the all-participants view but not under a
   clinic filter (why she saw nothing). The real gap her question surfaces: turning an accepted
   participant into an actively-monitored one is the **"entering the monitoring program" stage
   (Stage 5), not built.**
2. **"Does the screening tool create a registry item like a new participant does?"** — Not today;
   the Performance Profile creates no participant/record (it only fetches code-context for the
   referral pre-fill). Wiring screening→intake→registry reuses the exact review flow — future
   (Stage 2 screening).

**Requested:** dashboard button **"Refer a participant" → "Invite a participant"** (easy; queued
for the next deploy). **She's sending a second email** with more items — so hold and batch the
deploy. A reply is drafted for Bill to send; a forward note to Joe + Mark drafted too.

## Session 134 (2026-07-07) — column contract platform work; two Insight fixes ride along

Platform session (the molecule column contract: templates + rules engine reference
bundled molecules by column). Two Insight files changed as part of the rule-1 cleanup:

- **wellness.js (Stream G, events)** and **custauth.js (POST_ACCRUAL events)**: the
  `ASCII(c1)-1` SQL-side squish decode is GONE from both. The stored byte for
  ACCRUAL_TYPE='EVENT' is now computed through the molecule helpers in JS
  (encodeMolecule → value_id, encodeValue → stored CHAR) and compared as an opaque
  value — proven to select the identical 52 rows, and it drops the molecule_value_text
  join (slightly faster). custauth's POST_ACCRUAL context now carries
  molecules.encodeMolecule + encodeValue from all three call sites (accruals, survey
  scoring, compliance.js).
- No Insight behavior change; full suite green (67/1350).
- Co-owner input recorded in ACTIVE_WORK: Damian's red-alert escalate-until-
  acknowledged ladder + participant-friction automation (consent-gated), Mark's note.
- Known Insight-relevant drift found (queued, ACTIVE_WORK): wi_php's MEMBER_POINTS
  molecule def has NO column metadata (like United/Ferrari) — works today because the
  points save doesn't consult it; the system-molecule true-up migration will seed it.

## Session 135 (2026-07-07) — FLAG molecules become a first-class third type; Insight's flags ride the new door

Platform session (flags: create like any molecule, one access door, "is set"/"is not
set" in rules — acceptance test is the FOB double-points scenario, 32 assertions,
`tests/core/test_flag_molecules.cjs`). Suite 68/1382 green, lint 0, DB **v102**,
all local — the held deploy now carries **v96–v102**. What touches Insight:

- **Insight's three flags now go through the shared flag helpers** instead of
  hand-rolled SQL: IS_CLINICIAN (clinicians.js `isClinician`/`getClinicians`,
  custauth `FILTER_MEMBER_LIST`, the ML-report exclusion) and FULL_PPSI_REQUESTED
  (scoring_history set/clear/check + the post-survey clear in pointers.js).
  Behavior identical; the raw `5_data_0` SQL is gone from the vertical.
- **v102 data fix:** FULL_PPSI_REQUESTED is a MEMBER flag but the old generic write
  path stored its rows on the ACTIVITY side (missing lookup row → silent 'A' default;
  reads didn't filter the side, so the feature worked by accident). The new helpers
  take the side from the definition, so v102 moves any old rows to 'M'. Local had
  zero such rows; Heroku may have some — the migration is idempotent either way.
- **Latent 500 fixed:** `/v1/ml/report`'s clinician exclusion assumed a missing
  IS_CLINICIAN molecule returned null — it actually throws, so any tenant without
  the flag got an error, never an unfiltered list. Now it degrades cleanly.
- New capability Insight can use going forward: coordinator-facing member flags
  (e.g. a watch-list mark) are now a create-page action + two rule operators away —
  no code needed to add one.

*Later same session (v103, the system-molecule true-up):* wi_php gained the PROMOTION
molecule it was missing (needed the moment a points-reward promotion fires) and
MEMBER_POINTS' column metadata (it had none — the queued drift item). The server now
refuses to boot if any tenant's system molecules drift from the reference shape.

---

## Session 136 (2026-07-08) — the points save goes through the one molecule door

The platform's hottest write — the MEMBER_POINTS row created on every accrual,
bonus, adjustment, and redemption (Insight's survey/compliance accruals included) —
no longer writes its own raw INSERT. `saveActivityPoints` now routes through
`insertMoleculeRow`, the same door every other molecule uses. This was queued
behind the v103 true-up on purpose: the column metadata the door consults is now
boot-verified identical on every tenant, so the swap became safe.

- **Proven byte-identical**, not assumed: the new standing test
  `core/test_points_write_path.cjs` (18 asserts) keeps the OLD code's INSERT
  statement frozen inside it and hex-compares a real accrual's stored row against
  it — same bucket bytes, same amount, same side. Redemptions store raw signed
  negatives (a 3-bucket redemption wrote one correct row per bucket, summing to
  exactly the redeemed amount); bonus child activities checked too.
- **Dead-and-broken fallback removed:** the function could in theory look an
  activity up by `activity_id` — a column retired long ago, so that path would
  have crashed if ever reached. It now raises a plain error instead.
- No DB change, no behavior change. Full suite 71 tests / 1,478 asserts green.
  SERVER_VERSION 2026.07.08.1050.

*Later same session — bulk molecule reads (the one door goes set-based):*

- **`bulkGetMoleculeValues`** reads a molecule for a whole list of members in ONE
  query (same decoded shape as the per-link door). The wellness dashboard's
  clinic / licensing-board / referral-source lookups and the staff-position
  lookup behind notification routing all dropped their one-query-per-member
  loops — the dashboard roster now costs 3 queries instead of 3 per participant.
- **`moleculeJoinSQL` / `moleculeCondSQL`** — flagCondSQL's counterparts for value
  molecules. Every hand-written `5_data_*` join in the platform now comes from
  the one door: the member timeline, all 8 of custauth POST_ACCRUAL's stream
  reads (current + prior), scoring history, ML features, the extended-card
  detectors. The scoring hook also stops querying molecule_def per accrual —
  ids come from cache. MOLECULES.md §10 now documents the real helpers (it had
  promised two that never existed).
- **REAL S135 regression caught + fixed by the new parity test:** the clinician-
  exclusion hook was refactored yesterday to need ctx-passed flag helpers, but
  5 of its 8 call sites weren't updated — clinician filtering was silently OFF
  on the wellness roster, chart exports, both MEDS batches, and compliance
  sampling (4 clinicians showed as participants). All five sites fixed. Local
  only — never deployed.
- New standing test `core/test_bulk_molecule_reads.cjs` (10 asserts): endpoint
  outputs vs frozen pre-change SQL, exact-match on counts and totals. No DB
  change. Full suite 72 tests / 1,488 asserts green. SERVER_VERSION
  2026.07.08.1132.

*Later same session (afternoon/evening):*

- **Retro-sim preloads through the door:** the four bonus/promotion simulation
  preload queries dropped their hardcoded `5_data_` table names (which assumed
  5-byte parents) for `moleculeJoinSQL`. With that, the only raw molecule-table
  access left anywhere in the server is the two parked activity-timeline reads.
- **db_migrate v104:** dropped 7 provably-redundant indexes (the standalone
  p_link indexes on the base storage tables + a duplicate of the activity
  primary key). Measured on a 17 GB scale copy first: indexes were 57% of each
  activity's disk footprint, and these were pure dead weight. The scale copy
  (loyaltybig) was then deleted on Bill's call. DB v103 → **v104**.
- **Terminology (Bill's call): "multi-column molecule"** is the canonical name
  for a molecule storing several values in one row (MEMBER_POINTS = bucket +
  amount). Defined in the master doc; the session-coined "bundled" and the
  colliding "Composite" label retired everywhere.
- **🚨 Link-collision time bomb found + measured, registry designed:** member
  links will start colliding with existing activity links in ~32 more member
  enrollments, and the generic molecule reads don't check which side a link
  belongs to — an 'AM' molecule on a colliding pair would return both sides'
  values (random wrong data, no error). **Next session's urgent opener is the
  small defusal fix.** The permanent fix — molecules attach to ANYTHING via a
  link_tank entity registry, zero-rewrite migration — is fully designed and
  Bill-approved: `docs/MOLECULE_ATTACH_ANYTHING_DESIGN.md`. For Insight this
  eventually means molecules on clinics, codes, evaluators — not just
  members/activities/users.
- Wrap state: SERVER_VERSION 2026.07.08.2219, DB v104, suite 72/1,488 green,
  lint 0, everything pushed to GitHub CI-green. Heroku still deliberately held
  (the Erica bundle now carries v96–v104).

---

## Session 137 (2026-07-09) — the link-collision time bomb DEFUSED (Step 0); the same disease found and cured inside Insight's ML score history

- **The defusal (the Session-136 urgent opener, landed with ~32 enrollments of
  fuse left):** every generic molecule value read now checks the 1-byte
  "who do I belong to" marker (`attaches_to`) that the save path has always
  stamped — so when member link numbers start landing on values existing
  activity links already hold, a member and an activity can never see each
  other's data. One new resolver (`resolveRowSide`) is the single place reads
  and writes agree on the side; the four row helpers, the two SQL fragment
  builders, both activity-timeline detail queries, the single-value activity
  readers, and the badge read/deletes all carry the filter now. No schema
  change. Proven by `core/test_side_filter_collision.cjs` (21 asserts):
  deliberate cross-side collision rows planted through real data, then the
  timeline, wellness roster, member profile, and clinician assign/unassign all
  shown to return only their own side.
- **Insight-specific: the ML risk-score history was already sick with exactly
  this disease — no collision needed.** `ML_RISK_SCORE` was created without
  its `molecule_value_lookup` row (the §5.2 trap), so the live scoring path
  stamped every new score with the *activity* marker even though scores sit on
  member links — 63 rows — while 11 seeded rows carried the correct *member*
  marker. Every read mixed the two piles. **db_migrate v105** adds the missing
  lookup rows and restamps the 63 member-link rows to 'M'; the resolver now
  falls back to the definition's side when the lookup row is missing, so this
  class of molecule can't silently split again. The history endpoint returns
  all 74 scores as one coherent pile (verified for member 34: all 30 of his
  stored scores readable).
- **Real pre-existing bug caught by the new test's first run:** the clinician
  assign/unassign endpoints had been failing with a 500 — `findMoleculeRow` /
  `deleteMoleculeRow` matched key-column names case-sensitively ('C1' internal
  vs the `{ c1: ... }` the clinician code passes). Column matching is
  case-insensitive now; assign/unassign work again (proven in the test:
  unassign → re-assign round-trip on member 34).
- **Also fixed riding along:** the member profile save previously deleted the
  member side then re-inserted on the *activity* side for a both-sided
  molecule (duplicate accumulation on every save) — the profile form now reads
  and writes the member side explicitly.
- Targeted tests all green (collision 21, bulk reads 10, points write path 18,
  molecule create 46, flags 38, user positions 20, referral source 9, CSR walk
  22, instrument assignment 42); lint 0. SERVER_VERSION 2026.07.09.2020, DB
  **v105** (held Erica bundle now carries v96–v105). Full suite awaits Bill's
  cue. The permanent fix (the link_tank entity registry,
  `docs/MOLECULE_ATTACH_ANYTHING_DESIGN.md`) remains its own future session on
  Bill's go.

---

## Session 137 (2026-07-09, same day, Bill's go) — the entity-type registry BUILT: molecules can attach to anything

- **The registry (db_migrate v106):** link tank — used purely as the existing
  directory of table names, with link allocation completely untouched (Bill's
  in-session refinement of the design) — now keeps a 1-byte entity code per
  attachable table. The three legacy parents got the codes their stored
  letters already encode (activity 64 'A', alias 75 'L', member 76 'M' — zero
  data rows rewritten), staff logins minted the first new code (77, byte 'N'),
  and the one dishonest placeholder row in the login-molecule table was
  restamped to the truth. Codes are unique, 1–127, never null or blank (31 is
  banned outright — it encodes as the space character), minted above the
  highest assigned, never reused.
- **Self-registering:** the first time a molecule attaches to a new kind of
  parent, the helper registers the table automatically — after proving the
  table really exists (a typo fails loud in plain English, never mints a
  phantom). Proven live: the first molecule ever attached to a **clinic**
  (partner_program) self-registered code 78 and round-tripped through the
  real doors.
- **Every row's byte tells the truth now:** molecule definitions on own-table
  parents name their parent table; reads and writes stamp/filter the true
  code; a guard rejects any null/blank side anywhere. For Insight this is the
  foundation for molecules on clinics, codes, and evaluators — not just
  members, activities, and logins.
- New `core/test_entity_registry.cjs` (24 asserts: seed + byte identity,
  positions surface through the true code with planted legacy residue
  invisible, clinic self-registration + round-trip, typo rejection). All
  molecule regression tests green (collision 21, user positions 20, flags 38,
  molecule create 46, bulk reads 10, points write path 18); lint 0.
  SERVER_VERSION 2026.07.09.2205, DB **v106** (held Erica bundle now carries
  v96–v106). MOLECULES.md gains §5.0 (the three-part row identity — the
  invariant that was never written down) and §12 (the registry). Full suite
  awaits Bill's cue; nothing pushed.

## Session 137 (2026-07-10, continued) — pushed to GitHub + the five-lens platform audit

- All Session-137 work pushed (CI green after one test hotfix — the new
  collision test had assumed hand-entered local data that CI's from-scratch
  database doesn't have; it now creates its own state).
- **The platform audit (Bill's ask, after the collision discovery):** five
  parallel read-only passes — growth horizons, row identity, silent defaults,
  cleanup completeness, concurrency perimeter. **Verdict: nothing
  fundamental.** For Insight specifically: redemption/compliance double-spend
  paths are safe; the MEDS pipeline has swallowed-failure spots (a failed
  member check can report success — Tier 2); the accrual path's member lock
  turned out not to hold (pool-issued — Tier 1, next session); ~50
  "no tenant → assume Delta" defaults get the fail-closed treatment Insight's
  own modules already use. Full ranked report:
  **docs/PLATFORM_AUDIT_2026_07.md**. Bill approved Tier-1 fixes as the next
  session's opener.

---

*This is a living document. Updated as design decisions are made and questions are resolved.*

## Session 138 (2026-07-10) — audit Tier-1 fixes: the guards + the accrual lock

- **db_migrate v107 — three uniqueness guards** the code already trusted:
  one point bucket per member+rule, one OPEN enrollment per member+promotion
  (partial — repeatable promos keep a row per completion), one membership
  number per tenant. Zero violations existed; a database with duplicates
  fails the migration loudly with offenders named.
- **The accrual member lock actually holds (audit 1.1).** createAccrualActivity
  takes the caller's transaction client; the FOR UPDATE is held to COMMIT and
  every accrual write — bucket, activity, molecules, points, BOTH engines —
  rides the same transaction. For Insight this covers the survey-submit and
  compliance-entry accruals (both now single-transaction with their parent
  writes; the survey path's cross-connection deadlock workaround class is
  retired). Link allocation deliberately stays on the pool so different
  members' accruals never queue behind each other.
- **Transaction discipline for swallowed errors:** stats writers moved to the
  pool on purpose (never-harm-the-accrual contract); external-action dispatch
  (registry items, alert chains) is savepoint-protected — one failing handler
  can no longer poison the whole accrual; broken molecule defs (Delta's orphan
  BT) are skipped before they can abort anything.
- **Notification hardening (audit 1.4):** fireNotificationEvent's
  display-name lookups are tenant-scoped and refuse ambiguous matches loudly.
  A real login→member bridge is a data-model decision for Bill (ties into the
  person-model direction from Session 127).
- New `core/test_concurrent_accruals.cjs` (7 asserts): 6 simultaneous
  accruals at one member — all succeed, exact activity/bonus/point deltas,
  zero duplicate buckets or open enrollments. Targeted tests green: composite
  contract 15, flags 38, points write path 18, CSR walk 22, PPSI survey,
  compliance. Lint 0. SERVER_VERSION 2026.07.10.0957, DB **v107** (held Erica
  bundle now carries v96–v107). Tier-1 item 2 (the ~50 fail-closed tenant
  defaults) is next, its own pass. Full suite awaits Bill's cue.
- **Part 3 (same session): the ~50 "no tenant? assume Delta" defaults are
  gone (audit 1.2).** Every `req.tenantId || 1` variant in pointers.js — 52
  scripted sites plus the display-template insert, the audit-report render,
  and the two dev-tool job starters — now answers a plain-English 400
  ("tenant_id is required") instead of silently reading or writing Delta's
  data. Insight was the main beneficiary of this class of fix: a session
  hiccup can no longer misfile a participant write into the airline demo.
  The accrual route's guard rolls back its open transaction first; the other
  transaction-holding routes were verified to guard before BEGIN. Battery
  green: 24 admin pages render, CSR walk, accrual contract, concurrent
  accruals, cross-tenant isolation, tenant auth gates. Lint 0.
  SERVER_VERSION 2026.07.10.1012.
- **Part 4: BT deleted (v108, Bill's call).** The half-built "bills test"
  molecule on Delta (definition + 3 column rows, storage table never
  created) is removed by migration — resolved by molecule_key + tenant, so
  Heroku cleans its own copy or skips if it never had one. Accrual test
  re-run green; the skip warning is gone from the log. DB **v108**,
  SERVER_VERSION 2026.07.10.1026 (held Erica bundle now carries v96–v108).

## Session 138 (continued) — MEDS was silently dead; now fixed and honest

- **Both doors into MEDS overdue processing were broken.** (1) The daily
  scan crashed on a variable the v97 refactor renamed everywhere but the
  recalc block (`surveys` → `instruments`) — every overdue member's run
  rolled back its own alerts and registry items, then reported success
  counts. (2) The participant chart's page-load trigger sent the public
  membership number to an endpoint comparing it against the internal link —
  404 on every chart load, response ignored. Net effect: missed-survey
  detection had effectively never fired.
- Fixes: recalc block rewritten against the real instrument set (now also
  covers random-scheduled compliance, which the old recalc omitted); the
  check endpoint resolves the public number via resolveMember (same fix the
  GET route got long ago); the chart logs a failed check loudly.
- Honesty: processMedsForMember THROWS on failure after rollback (no more
  success-shaped returns); calculateMedsNextDue propagates (instrument
  endpoints surface an honest 500); the daily scan isolates a failing
  member, keeps scanning, and reports a `failed` count instead of folding
  failures into success; the missed-survey registry creation no longer
  swallows (the registry item IS the clinical outcome).
- New `insight/test_meds_processing.cjs` (15 asserts): fresh participant
  made overdue → check called with the PUBLIC number → registry item and
  schedule bump PERSIST in the database (assertions that fail under the old
  code even though its responses looked fine) → dedup across second check
  and manual scan run → scan result carries failed=0. Adjacent tests green
  (meds_member_status, instrument_assignment); lint 0. The run also proved
  the harness cache-refresh fix live ("Server caches refreshed" after
  restore).
- **Erica day-in-the-life walk (`insight/test_erica_walk.cjs`, 16 asserts).**
  Bill asked whether our testing emulates what Erica actually does — the
  features were covered as pieces, her stitched morning wasn't. Now it is:
  a throwaway tenant-5 ADMIN login (her real role, not the superuser
  harness user) walks login → program dashboard (stat strip + program view
  with real data) → Grant Steadman's chart (registry items, instruments
  card reveal, and the page-load MEDS check must NOT fail — guarding
  today's fix in the real page) → action queue (worklist + chips) →
  notifications — with zero console/page errors across the whole walk.

---

## Session 139 (2026-07-10) — the platform measured at 5M members: accruals 139→345/sec, and Delta's config was carrying 17 junk test promotions

Core-platform day (no Insight-specific code), recorded here because the
results matter to Insight: the accrual path every survey submission and
compliance entry rides through is now ~2.5× faster, and the deploy bundle
Erica's site is waiting on gained two performance commits.

Bill drove his stress tools (5M-member preload into loyaltybig, then
100k/20k accrual runs); Claude monitored the database. Findings, by
measurement not theory: no missing indexes, no lock contention (Session
138's member lock exonerated) — the cost was ~250 database round-trips per
fresh-member accrual, dominated by the promotion engine querying member
state twice per active promotion and writing stats once per enrollment. A
temporary code walk-back to the Session-133 commit on the same data proved
Sessions 134–138 owned a real ~20% regression; two fixes (`e5b66d0`,
`46a962e`) hoisted the member's enrollment state into two queries, memoized
the per-counter activity reads, batched enrollment/counter/contribution
writes into multi-row statements, and aggregated stats to one flush — same
transactions, same semantics, full suite green twice. 139/sec → 345/sec;
reads measured separately at ~5,000/sec (profile AND activity list).

The discovery with teeth: 17 of Delta's 27 active promotions are test
residue (`MC-*`/`UI-*`/`DOW-*` codes with embedded Date.now() timestamps —
the exact generator patterns in the test suite), leaked April–June 2026.
Every accrual pays for them. v109 (deactivate by exact code list, shown to
Bill first) awaits his go; also open: whether the harness restores the DB
when a run crashes, which is the suspected leak.

Erica replied at session end — her material opens Session 140, with the
mandatory dress rehearsal before her deploy (v96–v108 + the S139 commits).


---

## Session 140 (2026-07-11/12) — DEPLOY DAY: the dress rehearsal earned its keep, v96–v109 went LIVE on Erica's site, and her nine-document packet set the roadmap

**Erica's July packet arrived and was triaged** (nine documents — the
RecoveryTrek/Affinity capability comparison she calls most important, the
Medication Registry and Document Repository build specs, the four-layer
consent/ROI architecture + Layer-1 participant agreement, the Wellness &
Support Directory set, and the Treatment Provider network application).
Full triage lives in ACTIVE_WORK ("ERICA'S JULY PACKET"); the sequencing
headline: the Document Repository is the foundation (the med registry's
evidence loop needs it), the consent items are legal-gated not build-gated,
and neither competitor has predictive risk scoring — PI²'s differentiator.

**The mandatory pre-deploy dress rehearsal ran for the first time and
caught three real problems** before they reached her live site:
1. **Her live data had duplicate membership numbers** — her July-6
   walkthrough double-submitted the "Joy Sunshine" test registration (one
   open enroll form, Save pressed twice during the multi-second save; both
   copies took reserved number 90). The v107 uniqueness migration would
   have DIED mid-deploy on it, stranding her site. v107 now repairs it
   in place first (ADVANCED copy keeps 90, RESOURCES copy renumbers to
   103, nothing deleted — both carry her real review-queue history).
2. **Adding a staff login on her live site would fail once** — the login
   link counter pointed at an already-used link (an old direct database
   insert bypassed the counter). New v109 trues it up; the test harness
   can no longer recreate the condition.
3. **Every participant-chart load on her site logged a hidden 500** — the
   badge lookup crashed on tenants without the BADGE molecule (badges are
   airline demo config). The endpoint now returns a clean empty list.

Rehearsal mechanics for next time: pull the live Heroku DB (needs the
newer pg_dump from `libpq`, Heroku runs Postgres 17), restore as
`loyalty_rehearsal`, migrate, point the server + suite at it — and set
BOTH `DATABASE_NAME` and `PGDATABASE` (run.cjs now forces them to agree;
the first run's mismatch sent test SQL at the real local DB — four planted
rows, found and removed, zero residue). Seven tests were made
environment-honest along the way (resolve personas/programs by NAME —
Steadman is #53 local / #60 live, Grace 46/53, the demo program 30/31;
relative counts; her real Medical Director detected instead of assumed
absent). Final rehearsal verdict: **77/77 tests, 1,533 asserts, green on
her migrated data; the Erica walk clean with zero console errors.**

**THE DEPLOY (Bill's go, CI green first): v96–v109 — fourteen migrations —
applied to the live Heroku database, verified live.** Version
2026.07.12.1112 confirmed; roster, MEDS (resurrected — 12 items for
Grace), instruments (all 10 incl. PHQ-9/GAD-7), badges, position-holders
(Dr. Erica Larson = Medical Director), follow-ups, notifications all
answering. **The release/testing email to Erica (Tom cc'd) is drafted and
approved** — compliments on the packet, release highlights, and a
7-step testing checklist.

**The double-enroll is closed end to end:** Save button locks during the
save ("Saving…", restored on failure), and a duplicate membership number
now answers as a plain-English 409 ("this participant may have just been
created — check the list") instead of a raw 500. Proven live: duplicate
POST refused, zero rows written. Local DB audited: zero duplicate numbers
on any tenant. (Numbers are unique WITHIN a tenant; different tenants may
legitimately share a number.)

**v110 (LOCAL-ONLY at wrap): Delta's 17 junk test promotions deactivated**
by exact Bill-approved code list (never deleted — enrollment history
stays). Delta: 27 → 10 real promotions. **The honest at-scale number: 498
accruals/sec** (Bill's 20k run, concurrency 10, 5M-member loyaltybig,
zero failures; avg 20ms, p99 52ms, max 195ms — Session 139's 5.1s tail is
gone). +44% over 345/sec; the old 1,056 whitepaper number predates the
S137/138 integrity hardening, so 498 is the number with every guarantee on.

**At wrap: Erica's testing feedback ARRIVED — not yet read. It opens
Session 141.** Also pending: v110's push to GitHub/Heroku (Bill's go),
the enroll page reacting politely to the new 409, the crashed-test-run
restore check, and the master-list + shared-Drive concept (merge with the
build-list draft; Bill will keep the shared copy in Google Drive for
Erica + Tom).

## Session 141 (2026-07-13) — Erica's testing feedback read + triaged; her three defects fixed the same day

**Her feedback (received at the 140 wrap) is the best she's sent** — organized
into working / defects / questions / change requests, plus two real build
specifications. What's working, her words: affiliations, the instruments
section with cadence assignment, MEDS updating, and the whole invite →
enroll → escalate-to-Medical-Director → bell chain. Filed verbatim:
`Erica_Testing_Feedback_2026-07-13.md`; specs alongside it
(`PI2_Intake_Workflow_Build_Specification.docx`,
`PI2_Network_Directory_Build_Specification.docx` — the latter SUPERSEDES the
July-packet wellness-directory materials). Full triage in ACTIVE_WORK.

**Defect 2 (the big one) — assigned instruments never reached the participant
portal.** Root cause: the portal's offers were HARDCODED — "Weekly Check-In"
always launched PPSI and the anchor battery was a fixed five-instrument list;
nothing ever asked what THIS participant is assigned, so her PHQ-9 assignment
could never appear (it wasn't even in the hardcoded list). Fix: the portal
renders "Your Assessments" from the member's expected set (`GET
/v1/meds/member/:id` — the same assignment-aware answer MEDS uses), self-report
instruments only (getExpectedInstruments now carries respondent_type;
clinician-completed Provider Pulse / CGI-S are never offered), with due-status
badges (Ready to take / Due soon / Overdue / Completed date / Up to date),
each row launching the take-survey modal, and a loud retry if the list can't
load. Default regime renders PPSI + the five anchors — exactly the old offers,
so unassigned participants see no change. This unblocks her PHQ-9 question-9
alert test. `test_instrument_assignment.cjs` gained a section-10 portal walk
(assigned regime = exactly the assignment; default = the cadenced self-report
set; clinician instruments never offered).

**Defect 1 — instruments section intermittently missing from the chart.**
The card started hidden and only appeared if its fetch succeeded; any hiccup
logged a hidden console.warn and the section simply wasn't there (her exact
symptom: re-enter the chart, it appears). Now the card always renders — on
failure it says the list couldn't be loaded and offers Try again; Manage
retries too. Verified by forcing a failed load in the browser: error state
shows, Try again recovers.

**Defect 3 — QR didn't prepopulate the referral type.** The invite modal's
QR and Copy button encode the IDENTICAL /p/ link — the culprit is the
standalone printable QR page (Session 122, Tom's demo), whose QR points at
the bare front door with no referral code. Fix: that page now accepts a
referral token (?c=TOKEN → QR targets /p/TOKEN, subtitle says it's a referral
link), and the invite modal gained a "Printable QR page" button that passes
its code. Verified end to end: minted a real code → /p/ redirect → context
endpoint returns referral type/affiliation/track (then revoked the test code).
Bare page unchanged = the generic screening QR, which is exactly her
"screening link" concept.

**Defect 4 (escalations indistinguishable) deliberately NOT patched** — her
intake specification retires that whole surface (Escalate/Advance replaced by
named, role-scoped dispositions); it folds into the intake rebuild.

**Riding along: the enroll page now answers the duplicate-number 409
politely** (Session 140's queued fix) — the server's plain-English message
shows verbatim and the participant search opens so staff can check the list;
Save re-enables for retry. Verified in the browser with a forced duplicate
(zero rows written).

**Design decisions this session (Bill):** registrants-vs-participants will be
one member population with an INTAKE_STATUS member molecule carrying the
intake lifecycle (sibling of REFERRAL_SOURCE; roster and intake queue become
filtered views; conversion at agreement-signing is a status change so history
rides). Release strategy: ship the defect fixes to Erica fast, build the
intake rework underneath.

**Also observed (follow-up, not this release):** MEDS "Consecutive Missed
Events" notifications don't dedup — 5,000+ identical criticals accumulated
since March, and the body doesn't name the member. Flagged for a future
session.

### Session 141, the morning after (2026-07-14) — the deploy, the master-list process, and two designs settled by email

**Deployed on Bill's go:** GitHub → CI green → Heroku (release v101,
version 2026.07.13.2143, DB v110) → restarted → verified read-only against
her live site (new portal/chart/QR code confirmed served; the live MEDS
answer carries respondent_type; zero writes to her data). The v110
migration found Heroku's Delta never had the junk promotions — that
residue was local-only. The fixes email went to Erica (Tom cc'd) after
verification.

**The master-list process was born** (Bill's design, recorded in memory):
we project-manage a master build list kept in the repo; dated Word
editions are EMAILED to Erica — Bill's read: she engages carefully with a
document sent to her, not with "go check Google Drive"; she confirms
completeness and ranks the Large items; her ranking sets the build order.
New folder `project_status/` holds every edition —
`PI2_Master_Build_List_2026-07-14.docx` (Edition 1) is produced, current,
and awaiting its send-day. A heads-up email went out first (no work asked,
just context); Erica: "This is so wonderful."

**Credentials — designed and confirmed entirely by email, before any
code:** Tom supplied the credential taxonomy (physicians MD/DO/MBBS/
MBChB/MBBCh/BMBS/BM BCh, PAs PA-C, nurses LPN/RN/NP, dentists
DDS/DMD/BDS) and two rules — no honorifics unless a state requires them,
and credentials never couple to boards (maxillofacial surgeons sit under
both). Design: CREDENTIAL internal-list member molecule (one per row,
multiple allowed), a Credentials CRUD page under Program Settings so
Erica's team owns the list, and retire-not-delete honored platform-wide
(molecule_value_text.is_active exists but nothing reads it yet — the
build brings it to life for every internal list). Both co-owners
confirmed same-day. Priority: gap-filler, per Bill — the process we just
sold them says small items fill gaps.

**The intake rebuild contract locked** (full text in ACTIVE_WORK): the
11-value INTAKE_STATUS member molecule (Erica's ten stages + Participant;
a separate Participant flag weighed and rejected — two facts that can
drift), intake items in their own table, the Intake Queue page,
server-enforced role actions riding positions, Phase 1 skeleton then
Phase 2 doors. Phase 1 opens Session 142.

---

## Session 142 (2026-07-14): Intake Rebuild Phase 1 — intake is its own surface

**The build the locked contract called for, delivered whole: registration
review left the Stability Registry.** Erica's intake spec, adopted verbatim
in Session 141, is now running code (local; deploy on Bill's go).

**One population, one truth (v111):** the INTAKE_STATUS member molecule —
Erica's ten lifecycle stages plus Participant, eleven values with explicit
per-molecule ids, member-side, in the M composite but deliberately NOT on
the profile form (a lifecycle status moves only through intake actions,
never a hand-edited dropdown). Every existing wi_php member backfilled to
Participant — Erica's live participants unchanged on day one, byte-verified.

**The intake item got its own table** (`intake_item` + attributed
`intake_note` rows): review type (case manager / medical director), named
owner, sent-by (the return path needs it), the two-business-day outreach
clock from registration (weekends skipped), outreach recording, and
resolution — and NO urgency, NO source stream, NO clinical tier anywhere.
Open registration reviews convert out of the registry (originals resolved
TO_INTAKE, never deleted); the REG_REVIEW dispatch now points at
`createIntakeItem` (new vertical module `intake.js`), so enrolling creates
an intake item and stamps the member Participant (today's staff-enroll door
keeps its meaning; Phase 2's registration link will mint true Registrants).

**The platform's first real permission gate, server-side, riding the
POSITIONCLINIC positions Erica already assigns:** a case manager may add
notes, record outreach, route to resources, and send for Medical Director
review; only the Medical Director may approve for screening, refer for
evaluation or treatment, send BACK with a written reason (the return path
Escalate never had), or close the file. Wrong role or wrong stage is
refused by the server in plain English — even a superuser holding no
position. Escalate and Advance are retired, by name.

**The Intake Queue page** (`intake_queue.html`, beside the roster on the
dashboard): chips are SLA + review type (overdue / due soon / CM review /
MD review), filters are stage / referral source / owner, and the clinical
tier colors do not exist on this surface. The bell notification now lands
on the intake ITEM, not the registry in general — Erica's change request
#1, closed. The Registrations chip and its dispositions are gone from
action_queue.html.

**The overdue clock (INTAKE_SLA, replacing REG_REVIEW_SLA):** flags and
notifies the case managers; the item STAYS with its case manager — the
contract's stand-in for Erica's open decision, switchable via sysparm
`intake_sla` (business_days=2, due_soon_hours=12, auto_escalate=false).

**The roster and the queue never share a record:** the wellness roster now
excludes anyone in a registrant status (fail-open — a lookup hiccup can
never hide a participant). Proven both directions: a routed-to-resources
person leaves the roster; everyone backfilled stays.

**Proof:** new `insight/test_intake_rebuild.cjs` (69 asserts, replaces the
old registration-review test) — the whole chain: enroll → item + stamp +
bell-on-item; every role/stage/reason refusal; outreach, send-for-review,
send-back, route-to-resources, approve-for-screening; SLA job flag +
rerun-dedup + no-auto-escalate; roster separation both ways; and a browser
walk of the queue as a case manager (role-scoped buttons, zero console
errors). Erica walk re-run green. Lint 0. SERVER_VERSION 2026.07.14.1128,
DB v111, all local — full suite, commit, and deploy await Bill's cue.

**Erica's open decisions stayed open** (outreach owner / auto-escalate /
retention / reactivation trigger) — defaults chosen per the contract,
every one of them config, not code.

## Session 142 (2026-07-14, later): the all-or-nothing startup rule + interrupted-run hygiene

**Bill's rule, stated twice and built once: the platform does not start
unless the database AND the ML engine are healthy — and neither
dependency ever fails silently again.**

1. **The launch handshake (Bill's catch).** `start.sh` had exported
   STARTCHECK since the first commit — and nothing ever read it. Now the
   server refuses to start without `STARTCHECK=Pointers` (start.sh + ci.yml
   set it; Heroku's DATABASE_URL is its handshake), refuses with no
   database configuration, and refuses when the database connection or
   boot chain fails — the old "up but answering 501 to everything" mode
   is dead. Value changed Billy → Pointers per Bill.
2. **ML engine is a required dependency (v112).** Boot gate polls
   /health up to 30s after the STARTUP hook launches the engine; not
   healthy → plain-English refusal, exit. Mid-run death: the wi_php
   watchdog auto-restarts (5s), LOGS every restart durably to error_log,
   and after 3 deaths in 5 minutes gives up and fires the critical
   ML_ENGINE_DOWN notification to tenant admins (rule seeded v112).
   All four paths proven live: healthy boot, dead-port refusal (exit 1
   at 30s), kill → logged restart in 5s, kill ×4 → give-up + critical
   notification delivered. CI now installs ml/requirements.txt.
   Correction recorded: Erica's Heroku dyno DOES run the ML engine
   (spawned as a child; logs show live predictions) — an earlier
   in-session claim that her site lacked ML was wrong.
3. **Interrupted test runs restore now.** PROVEN leak first (a suite run
   killed 75s in left 13 activities + 9 surveys — the junk-promotions
   mechanism), then run.cjs gained SIGINT/SIGTERM handlers: snapshot
   restore + server cache refresh before dying; crash path guarded the
   same way. Re-proven: a killed run cleans up after itself, zero residue.
4. **Master list rebuilt (Edition 1, still unsent):** intake Phase 1
   moved to "Built — arriving in your next update"; Large #1 is now the
   second half only (registration link, activation, reactivation,
   Columbia); bell item left Small (built). .docx regenerated from the
   .md and content-verified.

SERVER_VERSION 2026.07.14.1823, DB v112, lint 0. All local; this commit
+ GitHub push on Bill's go (given). Heroku untouched — the whole Session
142 bundle deploys as one announced release after Erica's retest.

**Session 143 (2026-07-14 evening) — INTAKE REBUILD PHASE 2: ALL FOUR DOORS
BUILT AND PROVEN (registration link, participant activation, Columbia at
intake, reactivation). All local; its own release after the Phase 1
release ships.**

Per the locked contract — Erica's intake spec, second half:

1. **The registration link (mints true Registrants).** The invite panel
   gains a link-type choice: *Screening link* (today's anonymous
   Performance Profile front door, unchanged) or *Registration link*.
   A registration link lands on the new public `/register` form — name,
   contact, referral type pre-filled from the link's context — and
   submitting creates a REGISTRANT: status Registered (never
   Participant), an intake item on the case manager's queue with the
   2-business-day clock running, referral source stamped, membership
   number allocated server-side. The person gets one plain confirmation
   and nothing else back. Plumbing note: member creation now flows
   through ONE door (`enrollMemberRecord`, extracted verbatim from
   POST /v1/member) so staff enroll and the public door can never
   drift; the intake status is stamped BEFORE enrollment promotions
   fire, which is why the REG_REVIEW dispatch no longer defaults these
   people to Participant.
2. **Participant activation — the one conversion moment (spec §4).**
   "Record signed agreement" on an open intake item (either intake
   position — the signature is an administrative fact; the clinical
   decisions stayed MD-only): assigns the clinic through the familiar
   organization→program picker, stamps Participant, resolves the item
   as PARTICIPANT, and the roster + MEDS pick them up instantly (no
   instrument rows = the program-default set, as always). Endpoint:
   POST /v1/participant-activations.
3. **Columbia at intake (v113) — the ONE intake→registry wire (spec
   §3).** C-SSRS screener seeded as instrument #11: 6 Yes/No items in
   three escalation categories, clinician-administered, screening
   purpose, cadence NULL (MEDS-exempt), license label left for Erica
   like the anchors. scoreCSSRS.js: ANY Yes raises CSSRS_POSITIVE →
   CSSRS_ALERT bonus → SR_SENTINEL registry item — proven firing for a
   REGISTRANT, exactly as her spec words it; the intake queue is
   untouched by the clinical alert (surface separation holds). The
   any-Yes threshold is deliberately maximum-conservative (the PHQ-9
   item-9 posture) and is protocol-tunable — Erica can narrow it.
4. **Reactivation — first-class return (spec §5/§9).** A closed,
   declined, routed-to-resources, or outside-care file reopens with a
   NEW intake item back in case-manager review — history, notes, and
   screenings intact, never re-registered. Two triggers (her "who
   initiates" decision stays open): the staff door (the queue's
   "Reactivate a closed file" button → POST /v1/intake-reactivations,
   either position) and automatically when the same person (exact
   name + email match) re-submits a registration link. A re-submit
   against an OPEN item just adds a repeat-contact note; the public
   answer is identical in every case — the form never reveals who is
   already known.

Proven by the new `insight/test_intake_phase2.cjs` (89 asserts, in the
manifest — suite is now 78 tests): the whole registrant journey in a
headless browser (mint → /p/ redirect → pre-filled form → confirmation →
queue arrival → UI activation with the clinic picker), the role/refusal
matrix on both new doors, dedup + both reactivation paths, negative and
positive Columbia on a registrant, and the invite panel's link-type
chooser — zero console/page errors. Neighbors re-run green: intake
Phase 1 (69), codes (35), Erica walk (18), instrument library (25).

SERVER_VERSION 2026.07.14.2243, DB **v113**, lint 0. All LOCAL — nothing
pushed; Phase 2 is its own release after the Phase 1 bundle ships.

**Session 143 (part 2, 2026-07-15) — THE MEDS NOTIFICATION FLOOD, FIXED
(v114). 5,461 identical "Consecutive Missed Events" criticals since March,
naming nobody — now: one alert per NEW missed period, every alert names
the member, and the bell lands on their chart.**

Root causes, all closed:
1. **No dedup on notifications** — the registry item deduped (skip if one
   open) but every daily scan AND every chart-load re-check re-fired the
   same notifications. Fix: notifications gain an opt-in `dedup_key`
   (v114 column + partial index); `fireNotificationEvent` refuses to
   deliver the same key twice. meds.js keys every fire on member +
   instrument + the episode's own due date + the miss count — so an
   unchanged state is SILENT, and each newly-missed period alerts exactly
   once. Events that pass no key behave exactly as before.
2. **Static templates** — the MEDS rule bodies were fixed strings ("A
   member has 3 or more consecutive missed events."). Now
   `{member_name}: {detail}`, the intake-rule shape.
3. **Dead-end bell** — MEDS notifications carried source page 'meds' (not
   a page) and no member. Now: physician_detail.html + the membership
   number — clicking the alert opens the participant's chart.
4. **Found along the way: the two overdue WARNING rules had never
   delivered to anyone.** They routed to role='clinician' — a role the
   platform_user CHECK constraint doesn't allow, so no login has ever
   held it. v114 repoints MEDS_SURVEY_OVERDUE + MEDS_COMPLIANCE_OVERDUE
   to the Case Manager position (the same recipients as the intake
   overdue clock — data, re-routable anytime). The critical
   MEDS_CONSECUTIVE_MISS (all clinical staff) is unchanged.
5. **The flood is gone** (Bill's call): v114 deletes every pre-fix MEDS
   overdue/consecutive notification — 5,461 notifications + 15,660
   delivery records locally; Erica's pile goes the same way when this
   deploys. Registry items (the clinical record) untouched.

Proven: test_meds_processing.cjs 15→23 asserts — alerts named, keyed, and
chart-routed; a re-check and the daily scan add ZERO notifications for an
unchanged state (exactly the path that built the flood).

SERVER_VERSION 2026.07.15.1207, DB **v114**, lint 0. LOCAL-ONLY — rides
the Phase 2 release (or its own, Bill's call).

**Session 143 (part 3, 2026-07-16) — CREDENTIALS (v115): "Jane Smith, MD"
everywhere staff look, Erica's team owns the list, and retire-not-delete
is finally real platform-wide. Tom + Erica's confirmed design, built as
the gap-filler Bill earmarked.**

1. **The CREDENTIAL member molecule (v115)** — ONE flat list, deliberately
   never partitioned by board or profession (Tom: a maxillofacial surgeon
   holds DDS under the medical board); a person holds several (one row
   each); Tom's 14-credential starting set seeded (MD DO MBBS MBChB MBBCh
   BMBS BM BCh PA-C LPN RN NP DDS DMD BDS). Built per MOLECULES.md — the
   REFERRAL_SOURCE/INTAKE_STATUS recipe: explicit value_ids 1..14 (§5.3),
   the member lookup row (§5.2), M composite but NOT the profile form
   (credentials move through their own multi-row door), round-trip proven
   at the byte level (§7).
2. **Retire-not-delete honored platform-wide** — molecule_value_text.
   is_active existed but nothing read it. Now: encodeMolecule and the
   row-endpoint encoder REFUSE a retired value for new writes in plain
   English; the values endpoints carry and manage is_active (PUT retires/
   un-retires; ?active_only=1 is the pick-list view); decode never checks,
   so stored history displays forever. Applies to EVERY internal list on
   the platform, not just credentials.
3. **The member multi-row door** — GET/POST/DELETE
   /v1/members/:id/molecule-rows/:key (the S129 user endpoints' member
   twin): duplicates 409, unknown values 400, retired values refused on
   add but still removable (record corrections), audited.
4. **The display rule** — name_format.js (NameCred): "Name, CRED[, CRED]",
   one rule, adopted on the roster (dashboard), the participant chart
   header + a credentials chips editor under the name, and the intake
   queue (rows + item modal). The roster and queue payloads carry each
   person's credential labels server-side (bulk read, fail-open for
   tenants without the molecule).
5. **The Credentials page** (Program Settings → Credentials,
   admin_credentials.html): list with Active/Retired state, add (a data
   entry, never code — proven by adding PhD and assigning it immediately),
   rename (everyone holding it re-displays the new form), retire/un-retire
   with the never-erases explanation on the page.

Proven by insight/test_credentials.cjs (36 asserts, in the manifest —
suite is now 79 tests): seed + byte proof, multi-credential assignment,
the full retire cycle (refused for new holders, hidden from pick-lists,
still displayed by existing holders, removable, un-retirable), the
Erica's-team add→assign loop, and a browser walk of the Credentials page
+ the chart chips + the header rule — zero console errors. Neighbors
re-run green (intake ×2, Erica walk, referral source, molecule create,
Delta CSR walk — encodeMolecule is a platform-wide door, so the blast
radius got the full check).

SERVER_VERSION 2026.07.16.0832, DB **v115**, lint 0. LOCAL-ONLY — rides
a release on Bill's call.

---

## Session 144 (2026-07-17) — Washington stand-up, story 1: the clinical engine moves to the vertical

The gap hunt for hardcoded-Wisconsin assumptions came back nearly empty (Bill
was right — Wisconsin was built clean): one hardcoded modal subtitle on the
dashboard ("Wisconsin Physician Health Program" in the Select Health System
popup), two cosmetic placeholder texts, one true marketing line on the demo
overview page. Those small UI fixes are queued, not yet made.

The one structural finding, fixed this session: the entire PI² clinical
engine — all 16 code files (ten instrument scorers, scorePPII, dominantDriver,
extendedCardDetector, protocolCards, custauth) — lived in wi_php's private
folder, and three shared server modules (wellness, ml_features, protocol_cards)
imported across the tenant boundary to reach it. History: the files were filed
under wi_php when the verticals architecture was born (S93–95, when Wisconsin
was the only workforce tenant), and the S129–131 Insight extraction cemented
the cross-boundary imports.

The move: all 16 files now live in `verticals/workforce_monitoring/clinical/`.
`getCustauth` gained Level 2 (vertical `clinical/custauth.js`; a tenant folder
still overrides). `loadScoringFunctions` scans `clinical/` first; tenant files
override by filename. The three imports repointed. wi_php's folder now holds
data/docs only — no code. Zero logic change; per-state differences stay in DB
config (weights, thresholds, cadences), which is how it already worked.

Proven: server restarted clean at 2026.07.17.0813 (ML engine healthy — one
restart hiccup was an orphaned ML process from the prior server holding port
5050, killed), lint 0, and five announced targeted tests green: PPSI subdomain
weighting (imports dominantDriver directly), protocol card library, PPII
history snapshot, accrual composite contract, intake Phase 2 (Columbia scorer
through the new location — custauth for wi_php now resolves via the NEW
shared-clinical fallback, so these runs prove the fallback live). Docs updated
(ESSENTIALS + MASTER verticals layout and loading order).

Why now: Washington signed 2026-07-16; wa_php is next. With the engine at the
vertical level, standing up the second state is configuration + per-state
content — the multi-tenant thesis made real.

## Session 144 (2026-07-17) — story 2: the last hardcoded-Wisconsin strings leave the shared pages

The three small fixes from the gap hunt: (1) the dashboard's Select Health
System popup subtitle now comes from tenant branding (data-brand fill on
load + window.TENANT_BRANDING on each open) instead of a hardcoded
"Wisconsin Physician Health Program" — wi_php shows its branding name
("Wisconsin PHP", Erica's own config), wa_php will show its own; (2) the
invite modal's affiliation placeholder is now neutral ("Program /
organization name"); (3) the public screening form's licensing-board hint
reads "e.g. State Medical Examining Board". The overview demo page's
"already runs the Wisconsin PHP today" line stays — it's a true statement,
not a tenant assumption. Erica walk test green (dashboard loads clean).
No server change — client files only, no version bump needed.

## Session 144 (2026-07-17) — story 3: WASHINGTON STANDS (v116, the wa_php tenant)

The second state, stood up as pure configuration. v116 copies Wisconsin's
entire configuration to the new wa_php tenant: all 37 molecules (lookups +
exact value_ids preserved — the one-byte cell contract), both composites
with details, input/display templates, the full 11-instrument survey
catalog (116 questions, C-SSRS included), 6 compliance items with statuses,
19 signal types, 5 external actions, all 27 active bonuses with their rules
and results, the REG_REVIEW enrollment promotion, 24 notification rules,
the follow-up schedule, PPII/PPSI streams + subdomains + current weight
sets, scheduled jobs (fresh clocks), and the point expiration rule. Links
allocated only via getNextLink; every internal reference remapped
(molecules, point types, actions, rules, composites, surveys).

Washington-specific content, not copied: evergreen branding ("Washington
PHP"), Pacific-time delivery window, and Washington's five licensing boards
(Washington Medical Commission, Osteopathic Medicine and Surgery, Dental
Quality Assurance Commission, Podiatric Medical Board, Veterinary Board of
Governors — names flagged to CONFIRM at kickoff). Deliberately NOT copied:
members, member data, logins (the tenant-chooser story owns those),
Wisconsin's evaluator samples, and her weight-set change history.

One environment truth fixed en route: the tenant_id sequence lagged the
hand-seeded tenants (same on Heroku) — v116 trues it up before inserting.

Proven three ways: the migration's own step-by-step verification; the boot
gate (verifyTenantMolecules would refuse to start on any system-molecule
drift in the copy — the server came up clean); and the new
test_wa_php_standup.cjs (28 asserts: config parity table by table, exact
INTAKE_STATUS value_ids, a LIVE encode round-trip on wa_php through the
API, Washington content checks, PPII weight parity, zero members/logins,
Wisconsin untouched). Suite is now 80 tests. Also fixed:
test_protocol_card_library silently skipped the moved clinical files
(stale paths + a silent existsSync-continue) — paths updated and the skip
made LOUD so a future file move fails the test instead of weakening it.

Washington's login and program picker come next — the tenant-chooser story.

## Session 144 (2026-07-17) — story 4: the TENANT CHOOSER (v117) — built real

Bill's requirement: the switcher must be REAL — designed so the eventual
real login process stands on it, not a demo shim. So the authorization
list is a database fact (platform_user_tenant: home program rides the
account; rows there are ADDITIONAL programs), and the server makes every
decision. Login answers with the program list only when a login holds
more than one (session starts safely bound to home); the login page shows
"Choose a program"; the shared header gains a program switcher. Every
switch goes through the one rebind door, which now admits a non-superuser
ONLY to a program on their list — everyone else gets exactly the S121
refusal they always got. Grant management is SUPERUSER-ONLY by design
(a tenant admin granting cross-program access would be privilege
escalation); a Program Access section on the user edit page gives the
platform operator add/remove. One-program logins see zero change.

Proven by core/test_tenant_chooser.cjs (34 asserts): grant CRUD guards
(duplicate 409, home-program 400, unknown 404), the chooser list appears
only for multi-program logins, a granted login switches WI↔WA but a third
program refuses 403 in plain English, a tenant ADMIN cannot read or write
grants, revocation closes the door, and a full browser walk of the real
login form → chooser panel → Washington dashboard → header switcher
showing both programs, zero page errors. Suite now 81 tests.

This is the wire Erica and Tom will use to oversee WI + WA. Their real
grants get made on the live site at deploy time (superuser action, not a
migration — logins differ per environment).

## Session 144 (2026-07-17, later) — story 5: the chooser scales (Bill's feedback after trying it as Erica)

Bill signed in as Erica, liked it, and called the scale problem: fine at
two programs, bad at ten. Both surfaces rebuilt to scale without changing
the two-program experience: the sign-in chooser keeps big buttons but they
now live in a scrollable list, and past six programs a type-to-filter box
appears on top. The header's cramped dropdown is gone — now a compact
button naming the current program that opens a branded panel (the
notification-panel pattern): filter box past six, scrollable list, active
program checked. Same authorization list, presentation only. Chooser walk
test updated to the new UI and green.

## Session 144 (2026-07-17, later) — story 6: the tenant stand-up machinery (Bill's "what's the process?" answered in code)

Bill's ask: reusable helper functions + a written list of all required
parts. Built as tenant_standup.js (project root, the get_next_link.js
pattern — migrations import it): REQUIRED_PARTS is the manifest (every
per-tenant config part, one list — adding a new config table to the
platform means adding one manifest line, and the copier's self-check +
verifier follow); copyTenantConfig stands up a new tenant as a full
config copy (state content — branding, timezone, licensing boards — is
supplied, never copied; refuses to overwrite; verifies itself against
the manifest before returning); verifyTenantSetup is the completeness
report (source count vs target count, part by part). The next state is
a five-line migration — docs/TENANT_STANDUP.md shows the Ohio example.

The lint earned its keep mid-build: the first draft put the clinical
scoring tables (PPII/PPSI) in the root module — healthcare terms in a
platform-shared file. Fixed properly: verticals/{vertical}/standup_parts.js
is the vertical's contribution (manifest entries + copy logic), loaded
dynamically; the platform module names no vertical concepts.

Proven by core/test_tenant_standup_module.cjs (13 asserts): a throwaway
tenant stood up through the door inside the harness, manifest self-check
green, value_ids exact, state content is the caller's, no people/logins,
verifier reports COMPLETE for the throwaway AND for wa_php (v116 and the
module agree on what complete means), overwrite refused in plain English.
Suite now 82 tests. v116 stays frozen (append-only); every tenant after
wa_php goes through this module.

## Session 144 (2026-07-18) — story 7: the walk covers the last two pages

The "do all the pages work?" claim had two honest gaps flagged since
Session 138: clinic.html and the public Performance Profile front door.
The Erica walk now covers both — section 5 opens the clinic page with a
real program context and asserts the roster renders with members and the
stat strip fills; section 6 logs the session out and walks the PUBLIC
front door as a true anonymous visitor (welcome step, crisis resources
up front, Begin → getting-started step with referral chips populated).
Both passed on the first run — no bugs found, the pages genuinely work.
The walk's zero-error gate now spans six surfaces.

## Session 144 (2026-07-18) — story 8: audit Tier-2 cleanup part 1 — errors stop dressing as data

Seven fixes from the 2026-07 platform audit's Tier-2 list, all the same
disease (a failure produces plausible-looking data instead of an honest
error): the roster export's clinician column says "(lookup failed)" +
logs instead of silently blanking (blank read as "unattended"); the
licensing-board lookup answers 500 on a DB error instead of "no board"
(an error is not an unlicensed member); the registry audit-history diff
logs + flags a failed read instead of silently showing "no changes"; ML
baselines EXCLUDE missing section scores instead of folding them in as
zeros (phantom zeros dragged baselines down — normal scores looked like
spikes); all five custauth latest/prior score reads gain the same-day
tiebreaker (two same-day submissions no longer make trend/spike
detection nondeterministic); deleteAllMoleculeRowsForLink derives its
table set from the catalog — the hardcoded list named a nonexistent
table (its DELETE threw and was SWALLOWED on every alias delete) and
missed five real ones (catalog finds all 11); the molecule-prover's
cleanup failure logs. Proven: catalog query returns the true 11-table
set; six targeted tests green (CSV export, pattern triggers, ML risk,
ML features, PPII snapshot, profile-changes/licensing); lint 0.
Remaining Tier-2 (next story): the four check-then-act windows.
Deferred with reasons: cache-reload window (single dyno today — parked
with the scaling notes); Tier-3 heavies (orphan sweep, entity-code
space) stay parked for Bill.

## Session 145 (2026-07-18) — the JULY AUDIT CLOSES: CI red fixed, the four check-then-act windows, v118 orphan sweep

**Story 0 — the Session-144 CI red, diagnosed and fixed (`fa09e9f`).**
CI run 29646200398 failed ONE assert: the wa_php stand-up test's "PPII
weights match Wisconsin." Test hygiene, not Washington: the PPII history
test changes Wisconsin's weights (slice C) and never put them back, so on
CI's from-scratch DB the stand-up test later compared Washington's copied
seeded weights against the moved ones. It passed locally only by
coincidence — the local DB carried that same slice-C change as PERMANENT
residue from a run that crashed 2026-05-27 (pre-S142 restore hardening),
and v116's copy had faithfully propagated the residue into wa_php. Fix:
the history test captures Wisconsin's weight values at step 0 and restores
them at both exit paths (98→99 asserts). The live local residue was
cleaned through the weights endpoint (never raw SQL behind the server's
weight cache): wi_php AND wa_php both current on the seeded values
(compliance .25 / events .15 / ppsi .25 / pulse .35); the residue sets
stay as inactive history (score-history rows reference them). Heroku
never had the residue.

**Story 1 — audit Tier-2 part 2: the four check-then-act windows close
(`d9457e0`, SERVER_VERSION 2026.07.18.1002).** Every look-then-act write
now rides one transaction serialized on the member's row lock (the S138
accrual pattern), plain-English 409s where a human should hear "someone
else just did this": (1) member-molecules PUT — the whole profile save is
all-or-nothing, simultaneous saves queue, exactly one row per field
survives, mid-save failure rolls back whole; (2) clinician assign — the
already-assigned check happens inside the lock, second assigner hears a
409, chart lists the clinician once (findMoleculeRow gained clientOverride
like its siblings); (3) ML score store — read-compare-insert rides the
lock, two concurrent runs write at most one history row; (4) badge add —
was a BARE insert, now an overlapping same-badge period answers 409, a
later non-overlapping period stays a legitimate re-award; its date parse
dropped the new Date('YYYY-MM-DD') wrapper (UTC day-shift trap).
**FOUND BY THE NEW TEST on first run:** both ML_RISK_SCORE readers used
lowercase .n1/.n2 against the UPPERCASE N1/N2 column keys — "only write
when changed" compared undefined-vs-score (a history row on EVERY scoring
call; 17 junk rows on Steadman locally), and /v1/ml/member/:id/history has
served an empty trajectory (undefined scores, null dates) since it
shipped. Both read N1/N2 now; history sorts newest-first. ⚠️ Erica's live
site runs the broken readers until the queued deploys ship; junk-history
cleanup on live is an optional later migration. New
core/test_check_then_act_windows.cjs (22 asserts, manifest now 83):
simultaneous saves/assigns/badge-adds serialize with byte-verified counts;
regressions green (referral_source, both composite-M, ml_risk,
side_filter_collision, erica_bugs, tenant_auth_gates,
cross_tenant_isolation).

**Story 2 — v118 orphan sweep: Tier-3 closes (`aa41afa`, SERVER_VERSION
2026.07.18.1019, DB v118).** The 26 orphaned activity-side molecule rows
(pre-soft-delete residue) swept by RULE, not row list — table set derived
from the catalog, per-table report, each environment sweeps what it
actually has (local: 26 across 5 of 11 tables; re-census ZERO; a fresh DB
or Heroku sweeps its own count honestly). Verified against live code: the
other Tier-3 items were ALREADY closed by S144 (score-read tiebreakers —
7 sites carry a.link DESC; cleanup logging) or are advisory notes
(member-number counter width, future-seed naming, entity-code someday).

**THE JULY AUDIT IS NOW FULLY CLOSED:** Tier-1 (S138) + Tier-2 part 1
(S144) + part 2 and Tier-3 (S145). Parked BY DESIGN, not unfinished:
cache-reload window (single dyno), entity-code-space merge (someday), and
the audit's "standing guards" (side-filter lint rule + horizon census
test) as their own future story.
