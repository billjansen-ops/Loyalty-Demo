**INSIGHT HEALTH SOLUTIONS**

Build Notes & Working Document

*Predictive Performance Intelligence Infrastructure (PI^2)*

**LIVING DOCUMENT --- Updated as design evolves**

CONFIDENTIAL --- PRIMADA INTERNAL \| Last Updated: May 5, 2026 (v44 — Session 112: Erica's post-rollout feedback batch. Six bug fixes against the v43 PPSI editor cut, three new regression tests (C17/C18/C19), one demo-data migration (db_migrate v64). MEDS member status: GET /v1/meds/member/:memberLink was passing membership_number directly into member_link comparisons in subqueries (CHAR(5) vs string) so every cadenced item read as never_completed regardless of whether the participant had completed the survey. Fix: resolveMember(membership_number, tenantId) at the top of the endpoint, then memberRec.link in subqueries — completed items now advance correctly (Grace Newfield #46 was Erica's reproducer). C18 test (12 assertions) covers the membership_number → member.link resolution + 404 for unknown numbers + status-reflects-completed-surveys invariant. Insight Recovery PPSI history seeded — Erica reported Recovery participants had no trend graph; root cause was zero engineered PPSI activity for the Recovery clinic personas (only Insight Health Solutions had history). db_migrate v64 seeded 10 Recovery participants × 4 surveys each = 40 PPSI surveys + 1360 answers + 40 PPSI scoring activities + 40 ppii_score_history snapshots, spaced across the prior 90 days, with answer distributions tuned to match each persona's registry urgency tier (RED/ORANGE/YELLOW/SENTINEL drivers). All 4 surveys per participant get score_math_version=2 (Option A) so they consume the new editor's weights. First v64 attempt failed with 'value 209390400000 out of range for type integer' (wrong scale on member_survey.start_ts — used billDay*100 instead of /10) and a second attempt failed 'link_tank has no row for activity' (custom inline nextLink didn't auto-create the link_tank row). Fix: switched to 10-second-block timestamps via (billDay + 32768) * 8640, and replaced the inline link allocator with the imported getNextLink helper which auto-discovers schema and creates link_tank rows on first use. Follow-up sort order fix — completed follow-ups were sorted oldest-first inside the completed slice, pushing the most recent completion to the bottom of the list. /v1/registry-followups ORDER BY rewritten to put pending items first (scheduled_date ASC) then completed items (completed_ts DESC). C10 test extended with two new sort-order assertions. Edit Participant scroll + Back-nav fix — the Save button was rendering below the fold at <600px viewport with no scroll affordance, and Back from Edit Participant was always returning to /csr_member.html instead of the originating clinic roster. Tried multiple flex-chain repairs (min-height:0 plumbing, force flex on app-layout, fix tab-container display override) — all blocked on different downstream constraints. Settled on the pragmatic fix: revert csr_member.html to natural body scroll (lp-header is position:fixed so stays pinned anyway) and remove the inner-flex-scroll machinery. New goBackFromMember() reads enroll_context and routes back to clinic.html (with program_id/partner_id) when the user came in via the roster, dashboard otherwise. Old physician_management.html replaced with a meta-refresh + JS redirect to dashboard.html — page is deprecated, only reachable via stale URLs/bookmarks, redirect avoids the 'no clinic context' error. Pulse return-to-chart fix — Erica reported that completing a pulse on a participant chart bounced the user back to the roster, losing their place; same complaint applied to the staff-search and roster-row-click entry paths. Three entry paths into clinic.html's pulse flow now share one mechanism: a let pulseReturnToChart variable populated by (a) the auto-launch IIFE when ?action=pulse&memberId=… is on the URL (admin path from physician_detail.html → launchPulse), (b) startPhysicianSearch's MemberSearchModal callback, and (c) rowPulse on the roster row. offerCGIS's afterAll() callback branches on the flag and calls PageContext.navigate('physician_detail.html', { memberId, programId }) when set, else falls back to loadDashboard(). Flag is cleared after consumption so a subsequent pulse-from-roster doesn't inherit stale state. C19 test (11 assertions) covers the static wiring (declaration + all three set sites + offerCGIS routing branch + flag-cleared-after-use) and a browser end-to-end check (navigates to clinic.html with action=pulse, asserts the flag was populated, intercepts PageContext.navigate, calls offerCGIS, asserts the recorded navigation target is physician_detail.html with the right memberId). PPSI sub-domain weighting routing test (C17 — Session 111 backfill) — earlier session shipped pickPPSIDriverSection that ranks declines by (rawDelta/sectionMax) × weight when subdomainWeights are supplied, but no test covered the weight-vs-raw divergence cases. C17 (6 assertions) verifies fallback to raw delta when no weights, GLOBAL emphasis flips ranking, equal weights ties broken by raw delta, zero-weight sections get suppressed even when they have the largest decline, and a flat-baseline returns null. T6 protocol card library entry — Erica found that clicking the T6 badge on Yellow/Orange registry items open 3+ weeks went to a dead end. Root cause: the F1_T5 detection sweep in pointers.js had been writing registry rows tagged EXTENDED_CARD: 'T6' / PROTOCOL_CARD: 'T6' since Session 100, but T6 was never added to protocolCards.js. The inline modal lookup failed, fell back to opening protocol_cards.html#T6 in a new tab — which also had no T6 entry — so the click did nothing visible. Fix: added T6 ('Repeated Moderate — Early Warning') to PROTOCOL_CARDS modeled on T5's structure (trajectory category, 5 protocol steps, the same modal-required fields), with timelines tuned for the 3-week early-warning window between T5's 12-week chronic threshold. Added T6 to CARD_CATEGORIES.trajectory.cards, CARD_PRIORITY (positioned above T5 since T6 fires first chronologically and T5 supersedes at week 12), and DETECTION_RULES (rule text mirrors the actual SQL: open Yellow/Orange registry item for 21+ consecutive days with no open T5/T6 already on the participant). New test C20 (23 assertions) is the first library-completeness invariant on the platform: scans pointers.js + dominantDriver.js + custauth.js for every literal EXTENDED_CARD/PROTOCOL_CARD card code the detection engine writes and asserts each has a PROTOCOL_CARDS entry; verifies internal consistency (every code in CARD_CATEGORIES, CARD_PRIORITY, DETECTION_RULES resolves to a library entry); modal-field quality gate (every library card has id/name/category/categoryLabel/color/summary/steps/assignment/successMetric/escalationTrigger non-empty); browser end-to-end check on action_queue.html that clicking T6 opens the inline modal AND does NOT fall through to window.open (the user-visible symptom Erica reported). The literal-string scan only covers the F1_T5 sweep family (T1-T6, F1) — S1, A1-A8, P1-P5, M1-M3, D-series flow through dominantDriver.js variable lookups and are caught by the internal-consistency invariant instead. A future T7 added to the detection sweep without a library entry now fails C20 immediately. Full suite: 39 tests, 795 assertions, all passing on local v64. Heroku still at db v63 / SERVER_VERSION 2026.04.28.0900 — auth dropped before push, deferred until Bill re-runs heroku login. SERVER_VERSION 2026.05.08.1430, EXPECTED_DB_VERSION 64. v43 header preserved below. v43 — Session 111: PPSI subdomain section weights editor (Erica's Option A math). New v59 schema (ppsi_subdomain + ppsi_subdomain_weight_set + ppsi_subdomain_weight_set_value) mirrors the v58 streams pattern with an extra is_factory_default flag on the weight set. Seeded the 8 wi_php sections (SLEEP/BURNOUT/WORK/ISOLATION/COGNITIVE/RECOVERY/PURPOSE/GLOBAL — codes match survey_question_category.category_code) with TWO equal-weight bundles: a factory-default anchor (is_current=false, is_factory_default=true) that the Restore Defaults button reads from, and an editable current row (is_current=true). Both seeded at 0.125 each and diverge once Erica edits. v60 added member_survey.score_math_version (1=legacy raw sum, 2=Option A) so the cutover is per-survey identifiable; existing 113 rows backfilled to 1, ppii_stream.max_value for 'ppsi' lowered 102→100 to match the new normalization scale. v61 rescaled any pre-existing ppsi components in ppii_score_history_component from 0..102 → 0..100 (zero rows in practice). scorePPSI.js rewritten — Option A: per-section sum/section_max → fraction × section weight → sum across sections × 100, returns 0..100 plus score_math_version: 2 in the result envelope. Subdomains and weights flow into the scorer via context (caller passes from caches.ppsiSubdomains and caches.ppsiSubdomainWeights). Survey-submit restructured so end_ts and score_math_version are written together in ONE UPDATE (rather than the prior end_ts UPDATE plus a later score_math_version UPDATE) — two separate UPDATEs on the same member_survey row in one transaction caused PG to take FOR KEY SHARE on the parent member tuple, deadlocking with createAccrualActivity's FOR UPDATE on the same row. The single combined UPDATE skips the FK re-validation entirely. Discovered + fixed mid-session via pg_locks inspection during a hung curl reproduction. Read-side branching: fetchPpsiRaw, /v1/wellness/members's ppsi query, gatherMemberFeatures's ppsiScores query, custauth.js POST_ACCRUAL ppsiResult+ppsiPrior queries all LEFT JOIN member_survey via d4.n1 (MEMBER_SURVEY_LINK is a size-4 numeric stored as offset-encoded int identical to ms.link, so direct integer JOIN works) and normalize per math_version (`v === 2 ? round(score) : score * 100/102`). PPII_MAXIMA.ppsi changed 102→100 in scorePPII.js so calcPPII consumes the post-normalization value as identity. New endpoints (mirror v58 PPII triplet): GET /v1/tenants/:id/ppsi-section-weights returns sections joined to BOTH the current and factory weight sets so the UI can render factory hints + gate Restore Defaults; PUT validates body covers active subdomain codes + sum=1.0, transactional flip-and-insert on the partial unique index; POST .../restore-defaults reads the factory row and seeds a new is_current row from those values, leaves factory untouched. All three reload caches in-place preserving factory_weight_set_id. New admin page admin_ppsi_section_weights.html — 8 sliders driven by the GET response's sections array (no hardcoded list), per-section factory hints (highlighted when current diverges), sum indicator, save gating, Restore Defaults button gated on (no-unsaved AND not-already-at-factory), Recent Changes panel with FACTORY + CURRENT badges, no ML retrain panel. Equivalence verification: ppsi_norm BYTE-IDENTICAL pre/post for all 9 wi_php members with PPSI scores (5→5, 19→19, 1→1, 35→35, 33→33, 83→83 …); PPII composite drifts 0–2 points on 5 of 9 because PPII_MAXIMA.ppsi shifted 102→100 — expected and within tolerance. Existing PPSI scores explicitly NOT recomputed — pre-cutover member_survey rows carry score_math_version=1 and their MEMBER_POINTS molecule values stay at 0..102 raw sum, normalized to 0..100 only at read time. Erica's reply (April 26) confirmed Option A + equal-weights default + Restore Defaults; design unblocked. SERVER_VERSION 2026.04.26.1500, EXPECTED_DB_VERSION 61. v42 header preserved below. v42 — Session 110 (cont'd): PPII history audit, slice D — Recent Changes panel + Recalculate-for-everyone on the admin weights page. GET /v1/tenants/:id/ppii-weights now also returns recent_changes (last 10 ppii_weight_set rows joined to platform_user for changed_by, with per-stream weights collapsed into one entry per row). New POST /v1/tenants/:id/ppii-weights/recalculate (superuser only) iterates every member with at least one ppii_score_history row, recomputes their composite from stored components × current weights inside one transaction, and writes a new row tagged trigger_type='WEIGHT_CHANGE_RECOMPUTE'. Members with no prior snapshot are left alone — they'll get one organically on next survey/pulse/event activity, which keeps the recompute side-effect bounded. Admin UI on admin_ppii_weights.html: new Recalculate Member Scores section with confirmation dialog and result indicator + new Recent Changes section with v# label, CURRENT badge on the active row, weights breakdown, change_note italic, who/when. Both buttons gated on no-unsaved-changes (saving must precede). saveWeights() reloads the GET response after a successful PUT so the new entry shows in Recent Changes immediately. Test extended to 52 assertions: snapshot under v1, weight change to v2, second snapshot under v2, recent_changes shape verification, recalculate writes one WEIGHT_CHANGE_RECOMPUTE row per member with prior history, non-superuser POST recalculate → 403. Slice closes the streams audit story end-to-end (B writes snapshots, C displays Previous PPII on chart, D recomputes everyone after a weights change + shows the audit trail). Full suite: 35/35 tests, 690/690 assertions. PPSI subdomain editor unblocked by Erica's reply (Option A normalize-first-then-weight, equal-weights default, Restore Defaults factory-reset button) — slice queued for next session. Erica explicitly delighted with audit/history design as proposed. v41 header preserved below. v41 — Session 110 (cont'd): event-detection bug fixed across three call sites. ACCRUAL_TYPE is a Dynamic-text molecule whose values live in molecule_value_text (rows: SURVEY/COMP/EVENT/OPS/WEAR/PULSE/ANCHOR_SURVEY); 5_data_1.c1 is a 1-byte squish-encoded value_id (decode: ASCII(c1) - 1). Custauth.js's events query had been joining molecule_value_embedded_list — empty for this molecule — so the events stream was silently null for every PPII snapshot ever written. Wellness/members's loose NOT-EXISTS filter was effectively masking the bug by treating any-untagged-as-event. Fix: all three sites (wellness/members, custauth POST_ACCRUAL, ppiiStreamFetchers.fetchEventsRaw) now join molecule_value_text with mvt.value_id = (ASCII(d1.c1) - 1) AND mvt.text_value = 'EVENT'. All 169 demo activities are properly tagged (65 SURVEY, 43 COMP, 33 EVENT, 27 PULSE, 1 ANCHOR_SURVEY) — the strict filter now works correctly. Tiebreaker on a.link DESC kept for stable selection across same-date events. 4 of 5 baseline members now match exact pre-refactor PPII (James 18, Michelle 20, Elena 26, David 36); Patricia 62 vs baseline 46 — the difference is the new deterministic tiebreaker picking the higher-link severity-3 event vs the prior nondeterministic pick of the severity-1 event among same-date ties (the new pick is correct: same-day data, deterministic order). Snapshot test now also captures the events component (assertions 33 → 34) since the join works. Note: pg_restore-based test snapshots can leave the in-memory ppiiWeights cache stale (cache holds a higher weight_set_id than the restored DB) — restart the server when running individual tests after a full-suite run; full-suite runs are unaffected because tests advance the cache and DB together. v40 header preserved below. v40 — Session 110 (cont'd): PPII history audit, slice C — Previous PPII visible on participant chart. New endpoint GET /v1/member/:id/ppii-history?tenant_id=N&limit=N (matches the existing /v1/member/:id/activities pattern) returns recent ppii_score_history rows with components inlined and the tenant's current_weight_set_id for the chart's 'Previous' rule. physician_detail.html: new sub-line under the PPII Score card reads from the endpoint and renders 'Previous: <score> — weight set v<id>, <date>' only when the most recent snapshot under a non-current weight set exists; hidden cleanly otherwise. Test extended to 33 assertions: submits an event under v1 weights, verifies the snapshot via the new endpoint, PUTs new weights to create v2, submits a second event, verifies one snapshot under v2 (current) and one under v1 (the chart's Previous anchor), confirms picking 'most recent snapshot where weight_set_id != current' yields the v1 row. Slice C surfaces a known cross-path inconsistency: wellness/members's live PPII calc and custauth's snapshot calc pick different 'latest events' when data has same-date ties (NOT-EXISTS-survey-molecules vs JOIN ACCRUAL_TYPE='EVENT'). The chart can show Current and Previous numbers that look inconsistent. Fix proposed for the next slice — converge wellness onto the per-member fetcher registry (calcPPIIFromMember) so both paths read identical inputs. Slices D (Recalculate-for-everyone button) and E (wellness-converge) still ahead. Full suite: 35/35 tests, 671/671 assertions. v39 header preserved below. v39 — Session 110 (cont'd): PPII history snapshots wired (slice B of Erica's audit/history feature). New scorePPII.recordPpiiSnapshot helper writes one ppii_score_history row + one ppii_score_history_component row per non-null stream; called from custauth.js POST_ACCRUAL right after calcPPII so every survey/pulse/compliance/event activity that produces a new PPII captures a defensible snapshot — composite + raw stream values + weight_set_id in effect + trigger_type (data.ACCRUAL_TYPE). Component rows skip null streams so 'no data' is distinguishable from 'raw value = 0' on read-back. weight_set_id sourced from caches.ppiiWeights.get(tenantId).weight_set_id (the v58 cache shape change). Snapshot failure is caught and logged so audit-write regressions don't break the accrual pipeline. Read-side endpoints (/v1/wellness/members) intentionally do NOT snapshot — those would write thousands of rows per dashboard load. New regression test tests/insight/test_ppii_history_snapshot.cjs (14 assertions): submits an event for Patricia Walsh, verifies one row appears in ppii_score_history with the correct tenant_id / p_link / weight_set_id / trigger_type='EVENT' / score-in-range, verifies component rows for every non-null stream, and verifies the math invariant — components + snapshot weights reproduce the stored score under proportional reweighting. That invariant is what makes the upcoming "Recalculate for everyone" button trivial: every member's score under any new weight set can be derived from stored components without re-querying activity. Sets up slice C (chart shows Previous PPII when weights change) and slice D (Recalculate button on admin weights page). PPSI subdomain editor still blocked on Erica's three answers (section names, math A vs B, defaults). Full suite: 35/35 tests, 652/652 assertions. v38 header preserved below. v38 — Sessions 109 + 110: PPII streams config-driven refactor. Replaces the v57 sysparm-based ppii_weights with five purpose-built tables (db_migrate v58): ppii_stream (per-tenant dictionary of streams — code, label, max_value, source_function, is_active, sort_order, added_in_phase), ppii_weight_set (versioned weight bundles with effective_from / changed_by_user / change_note / is_current and a partial unique index enforcing at-most-one-current per tenant), ppii_weight_set_value (one row per set+stream), and audit-snapshot tables ppii_score_history + ppii_score_history_component (built but not yet wired — pending Erica's reply on history/audit scope). Migration seeded the four wi_php streams (pulse/ppsi/compliance/events with their max values + source_function names) and migrated the prior sysparm 'ppii_weights' row into ppii_weight_set #1 inside one transaction with sum-to-1.0 + orphan-code verification before dropping the sysparm row. New ppiiStreamFetchers registry in pointers.js with four async per-member fetchers (fetchPulseRaw, fetchPpsiRaw, fetchComplianceRaw, fetchEventsRaw) — same activity-type/molecule filters as the existing wellness batch queries, scoped to a single member. scorePPII.js now exports calcPPIIFromMember alongside the legacy calcPPII; both share an internal composeFromContributions that applies proportional reweighting when a stream is null. ml_service.py composite formula uses W.get(code, 0) so unknown stream codes don't throw KeyError; retrain_with_weights.py no longer hardcodes the four pilot streams and replaces (not just updates) ml_service.PPII_WEIGHTS. pointers.js cache layer adds caches.ppiiStreams (tenant_id → active ppii_stream rows) and rewrites caches.ppiiWeights to load from ppii_weight_set + ppii_weight_set_value (is_current=true) with new shape { <stream_code>: weight, …, weight_set_id }. Legacy named-key access (weights.pulse, weights.ppsi, …) preserved so custauth.js, ML retrain endpoint, and inline /v1/wellness/members scoring read identical numbers. GET/PUT /v1/tenants/:id/ppii-weights endpoints rewritten against v58 — GET joins ppii_stream + ppii_weight_set + ppii_weight_set_value and returns { tenant_id, weight_set_id, streams[{code,label,max_value,sort_order,weight}], weights{}, sum, model_info } with the legacy 'weights' map kept for backward compat; PUT validates the body covers exactly the tenant's active stream codes (extras → 400, missing → 400), accepts an optional change_note, and in one transaction flips the prior is_current row to false then inserts a new ppii_weight_set with changed_by_user=session.userId and one ppii_weight_set_value per stream (UNSET-old before INSERT-new with FOR UPDATE on the prior row to handle the partial-unique-index race). admin_ppii_weights.html drops its hardcoded ['pulse','ppsi','compliance','events'] list and LABELS map and renders slider rows dynamically from the GET response's streams array — adding/removing a stream now requires only a ppii_stream row, no UI edit. Equivalence verification: full test suite passes 34/34 tests, 638/638 assertions identically. Three-way spot-check (Session 109 baseline / Heroku v55 / Local v58) showed the scoring chain produces identical output given identical inputs (Elena Vasquez matched all three exactly); the 3 members with input drift were traced to non-deterministic ORDER BY a.activity_date DESC ties in the existing wellness/members query — pre-existing behavior, unrelated to the refactor. EXPECTED_DB_VERSION 57 → 58. Heroku still at v55, intentionally behind. v37 header preserved below. v37 — Session 107: Multi-counter promotions (core platform capability). Every promotion can now track multiple "what to count" counters joined by AND or OR, e.g. "fly 20,000 miles OR take 20 flights" or "enroll AND complete 5 surveys." db_migrate v56 adds promo_wt_count + member_promo_wt_count tables and counter_joiner column on promotion + member_promotion; drops legacy count_type / goal_amount / counter_molecule_id / counter_token_adjustment_id from promotion and progress_counter / goal_amount from member_promotion; member_promotion_detail repointed from member_promotion_id to member_wt_count_id. 1-to-1 data migration — every pre-existing promotion becomes a single-counter promotion with joiner='AND'; pre/post row counts + sums verified inside the transaction. pointers.js: caches.promoWtCounts loaded at startup; createMemberPromotionEnrollment refactored to new signature (memberLink, promotionId, tenantId, enrolledDate, opts) — opts.startQualified / opts.startingProgressByWtCountId / opts.client; per-counter member_promo_wt_count rows created at enrollment snapshotting goal_amount. New helpers evaluatePromoQualifiedByJoiner(joiner, mpwcRows) and getMemberPromoWtCounts(mpId, {lockForUpdate, client}). New helper computeIncrementForCounter(counter, activityId, activityLink, activityData, tenantId) dispatches the count_type → amount branch per counter. evaluatePromotions rewritten as outer loop over promos, inner loop over member_promo_wt_count rows, joiner-based qualification at promo level. evaluateTokenActivity rewritten to walk promo_wt_count rows matching adjustment_id; per-counter increment. evaluateEnrollmentPromotions rewritten — seeds only enrollment counters to goal (not all counters), then checks joiner before firing results (mixed "enroll AND fly 5 times" promos behave correctly). Activity-delete cascade rewritten to reverse progress per counter via member_promotion_detail.member_wt_count_id. Admin /v1/promotions list + single + describe endpoints return legacy single-counter convenience fields plus a new `counters[]` array with per-counter detail. POST/PUT /v1/promotions accept a `counters[]` array (multi-counter authoring) and fall back to the legacy single-counter fields. /v1/members/:memberId/promotions returns aggregate progress + per-counter `counters[]` array. admin_promotion_edit.html: new accented "What to Count" section with add/edit/remove counter dialog and joiner dropdown (shows when ≥2 counters). csr_member.html: multi-counter promotions render as a stacked list of progress bars labeled with "Joined by AND/OR"; single-counter promotions keep existing compact display. EXPECTED_DB_VERSION bumped 55→56. New test tests/core/test_multi_counter_promotions.cjs — 12 assertions covering OR-qualifies-when-any-counter-hits-goal and AND-qualifies-only-when-all-counters-hit-goal end-to-end through the accrual pipeline. Full suite: 33 tests, 542 assertions, all passing (against real loyalty DB at v56). Retro-credit simulation (runPromotionSimulation) gated to single-counter promos for now — multi-counter simulation modeling is a future enhancement. Heroku not deployed this session (Heroku remains v54 / DB v55). v36 header preserved below. v36 — Session 106 (small, presentation-prep): Database Utilities admin page gets per-row DB version badge (green = current, yellow = behind, gray = unknown) and an Update button per row that runs db_migrate.js against that specific database via a live SSE log-streaming modal. Target DB version shown in the current-DB banner. EXPECTED_DB_VERSION lifted to a module-level constant in pointers.js (single source of truth; must stay in sync with db_migrate.js TARGET_VERSION). /v1/admin/databases now includes db_version per DB and expected_db_version at top level. New endpoint GET /v1/admin/database/:name/migrate spawns a child node db_migrate.js process with DATABASE_NAME env override (zero change for CLI callers), line-buffers stdout/stderr to SSE, and kills the child if the client disconnects. No DB changes. Heroku not deployed. Secure document management still next-up (deferred from Session 106 start per big-presentation timing). v35 — Session 105 complete: Bonus Result Engine (Delta), Erica April 11 feedback batch (Insight), Erica April 15 fix-up. Survey timestamps migrated from Unix seconds to Bill epoch datetime (db_migrate v55). platformToday() / platformTodayStr() / platformNow() / dateToBillEpochDateTime() consolidation — 42 scattered "today" computations replaced with single helpers. dateToBillEpoch merged into dateToMoleculeInt. Registry click-through fixed (type coercion). Mark in Error UI on survey + compliance detail modals (supervisor-only). Schedule Mode selector (cadence/random/undetermined) on compliance cadence edit. Export Chart button on participant chart (CSV + PDF with section selection). View Participant button on follow-up modals. PPSI/Pulse/validation-battery submission timestamp bug fixed. New browser test suite: tests/insight/test_participant_chart_ui.cjs — 17 assertions covering all the UI gaps Erica found. Full suite: 32 tests, 528 assertions. Heroku v54, DB v55. v34 header preserved below. v34 — Session 105: Bonus Result Engine (Delta) + Erica feedback batch (Insight). Bonus Result Engine: multi-result bonuses via new bonus_result table + BONUS_RESULT molecule (db_migrate v46); applyBonusToActivity loops over rows (points create Type N child activities, external results hang BONUS_RESULT molecule + fire action handler); 11 Delta legacy bonuses seeded as one-points-row each; CRUD endpoints; admin_bonus_edit Results dialog; csr_member verbose view shows ⚡ labels for non-point results. Erica feedback batch: removed Mobile tab from staff participant chart; clicking an open registry item in the chart jumps to Stability Registry with that item pre-opened (PageContext.openItemLink); follow-up detail now shows Next Follow-up link in Done section; participant chart open-items panel merges registry items + upcoming follow-ups + pending drug tests inline; registry item detail shows auto-generated follow-up chain with status badges; manual follow-up creation via POST /v1/registry-followups and "+ New Follow-up" dialog on action_queue. Soft-delete plumbing (db_migrate v47): voided_ts/voided_by/voided_reason on member_survey + compliance_result, partial indexes on non-voided rows, PATCH /v1/member-surveys/:link/void and /v1/compliance-results/:link/void endpoints. MEDS random-scheduled drug tests (db_migrate v47): schedule_mode + next_scheduled_date on member_compliance, parallel detection branch in processMedsForMember + calculateMedsNextDue that flags random items when next_scheduled_date passes with no satisfying non-voided result; cadenced branch now also honors voided_ts filter. Session 105 test fixes: updated 5 core tests to honor Delta's calculated flight miles (Session 104 calc_function fix), added MEDS to test_dominant_driver valid list. Session 105 final: 31/31 tests, 527/527 assertions. db_migrate v48 (stray test row cleanup). Heroku still at v48/DB v45 — not deployed. Session 104: ML v0.3.0 (3 new features), all 13 triggers complete, molecule single source of truth, bonus/promo UI redesign, Heroku v48/DB v45. Session 103: Bug fixes (5), test suite (16 tests/286 assertions/Playwright), terminology (Participant/Health Support Staff), feature requests (#9-18), licensing board system. Session 101: Notification Delivery System (core platform) — notification_delivery + notification_delivery_config tables, NOTIFY_DELIVER (5-min) + NOTIFY_DIGEST (daily) scheduled jobs, sendDelivery() stub for vendor swap, delivery window enforcement (7am-9pm, critical bypasses), per-tenant config, queue visibility page (notification_queue.html), dashboard nav card. db_migrate v35. Session 101: ML model retrained v0.2.0, molecule refactor, F1/T5 batch detection, db_migrate v34. Session 100: Protocol Card Reference Library (29 cards), Extended Card Detection Engine (9 detectors, 11 promotion rules), PPSI Safety Alerts, getNextLink shared module + link_tank fix. db_migrate v30-v33.)

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

*This is a living document. Updated as design decisions are made and questions are resolved.*
