# STATE — where things stand right now

Last updated: 2026-07-19 (Session 147, pre-deploy).

**SESSION 147 — THE REPOSITORY SCREENS + THE STAFF-RECORD FIX (v122), AND
THE DEPLOY DECISION: EVERYTHING SHIPS TO ERICA AS ONE RELEASE.**

**The three Document Repository screens** (pure screen work on the v121
spine, no server change): the participant-chart Documents card
(physician_detail.html, Instruments-card pattern incl. the always-appear
failure contract), the program Documents page (documents.html — chips
with live counts incl. the unassigned queue, type/search filters, upload
dialog with roster person picker; dashboard card added), and the shared
document detail panel (document-detail-modal.js — classify / person /
date / status moves / Replace-file with the frozen-version chain walked
both directions / Download / admin-only legal hold + retention).
Browser-walked by Claude first, then made permanent:
test_document_repository.cjs 28→40 asserts (drives all three screens
headlessly in CI). Scope note: linked records display + unlink only — no
manual create-link screen (system flows set those pointers later).

**The staff-record fix (v122) — Bill's YES, data not code.** REG_REVIEW
gains a real rule: ONE criterion "IS_CLINICIAN is not set" (both
workforce tenants). Code: POST /v1/member optional creation flags
(generic, caller-named, validated up front) raised via beforePromotions —
after insert, BEFORE rules evaluate. Sweep closed Erica's stray local
intake item (STAFF_RECORD, member status deliberately untouched).
test_intake_rebuild.cjs 69→74. Deploy day creates her live record with
flags:['IS_CLINICIAN'] — no stray item ever files live.

**THE DEPLOY DECISION (Bill, this session): the four queued bite-size
releases are SUPERSEDED — everything ships as ONE release at the tip.**
Reason: the pinned queue commits carry bugs later work fixed (the broken
ML readers among them); sequential pinned deploys would put known-broken
code live between releases. Sequence agreed: full suite → commit →
GitHub + CI green → MANDATORY dress rehearsal on a copy of her live data
(shows the v119 junk-row deletion count first) → Bill's explicit go →
Heroku push + migrations v111→v122 + restart + live verify (FIRST deploy
under the all-or-nothing rule; her dyno's ML engine verified running
2026-07-14) → deploy-day extras (create Erica's person record via the
enroll door WITH the clinician flag + link EricaL, grant her login
wa_php) → THEN the announcement email to Erica, Tom cc'd (deploy before
email). The staff-record fix stays OUT of her release notes — she never
saw the problem.

Local at this writing: SERVER_VERSION **2026.07.19.1639**, DB **v122**,
suite 87 tests (both grown tests re-proven targeted; the full-suite
pre-commit gate is the next step), lint 0. GitHub: Session 146 commit
e91c57b + all Session 147 work LOCAL-ONLY until the gate passes.
Heroku: **2026.07.13.2143 / DB v110** — still live, untouched.

---

**PRIOR — SESSION 146 — TWO FOUNDATIONS, BOTH DECISION-PROOF (Erica still quiet;
Bill's filter for the day: build only what never gets rebuilt and never
touches what she's testing).**

**Story 1 — the LOGIN→PERSON BRIDGE (v120), the S127 keycard model built.**
`platform_user_person`: each login optionally points at its person record
(member), ONE POINTER PER PROGRAM (multi-state staff = one login, a person
per state), one login per person enforced. GET/PUT/DELETE
/v1/users/:id/person on the /v1/users admin gate — target login must work
in the session's program, person must belong to it, person-already-claimed
= plain-English 409 naming the holder. The two notification branches that
hunted logins by display name (delivered to NOBODY live — S138 audit 1.4)
now follow the pointer; name matching is GONE; unlinked clinician logs
loudly, unlinked member quiet by design. admin_user_edit gains the Linked
person section (browser-verified). Erica HAS a person record now: member
#62, IS_CLINICIAN-flagged, EricaL linked — deploy day repeats those two
steps on live. test_login_person_bridge.cjs (28 asserts) proves routing
through REAL MEDS dispatch incl. deactivated-login stops-receiving.
FOUND, PARKED FOR BILL: (a) staff person records drag participant
ceremony — the enroll flow filed an open CM intake item for Erica's staff
record (terminal dispositions restamp status, so it can't just be
resolved); recommendation = REG_REVIEW rule gains "IS_CLINICIAN is not
set" criterion + sweep, AWAITING BILL'S YES/NO, her stray item left open
locally; (b) notification_rule's CHECK doesn't allow 'assigned_clinician'
— that branch is unreachable config until a one-line migration widens it.

**Story 2 — DOCUMENT REPOSITORY PHASE A SPINE (v121), Erica's spec 0.1.**
The filing cabinet, vendors stubbed behind a black box: document_type
(her 9-type taxonomy seeded per workforce tenant), document (the card:
owner pointer, typed linked-record pointer validated via link_tank,
R→I→F→S lifecycle, version chain, retention class, legal hold, sha-256
checksum), document_file (the 'db' backend — bytes outside the card;
production object storage = second backend + locator migration later,
invisible above document_storage.js). Six endpoints: upload (base64,
sysparm-capped 10MB default), finder (member/org/unassigned/status/type/q,
superseded hidden by default), card, file (checksum-verified EVERY read),
PATCH (superseded frozen; legal hold/retention admin-only), replace
(supersede-never-delete). Views + downloads audit as action 'V'.
test_document_repository.cjs (28 asserts) incl. ACTUAL tampering refused
loudly. STILL TO BUILD (next session opens here): the three screens —
participant-chart Documents card, program Documents page + unassigned
queue, document detail. Phase B (fax, OCR, production storage) = vendor
picks + BAAs, not code. STANDING RULE: test documents only on Erica's
live site until real storage + paperwork exist.

Local: SERVER_VERSION **2026.07.19.1232**, DB **v121**, suite **87 tests /
2,013 asserts GREEN in full** (the cued gate — it took TWO runs: the first
was red because BOTH new tests left in-run residue on wi_php that the
wa_php parity tests counted later in the same run, the S145 weight-residue
lesson repeating; both tests now clean up what they plant), lint 0.
GitHub: **the Session 146 commit is LOCAL-ONLY — push on Bill's go.**
Heroku: **2026.07.13.2143 / DB v110** — LIVE, untouched, frozen by cadence
(the four queued bite-size releases wait on Erica's retest feedback;
deploy-day migrations now run v111→v121; deploy-day additions grew two
steps: create Erica's person record + link her login).

**Waiting on Erica (unchanged, drives everything):** retest feedback,
Edition 1 completeness + Large ranking, update rhythm.

---

**PRIOR — SESSION 145 — THE JULY AUDIT CLOSED (Tier-1 S138 → Tier-2 part 1 S144 →
part 2 + Tier-3 today), and the Session-144 CI red was diagnosed and
fixed.** Three commits: (1) `fa09e9f` — CI run 29646200398's one red
assert was TEST HYGIENE: the PPII history test moved Wisconsin's weights
and never restored them, so the wa_php stand-up parity check failed on
CI's from-scratch DB; it passed locally only because the local DB carried
that same weight change as PERMANENT residue from a run that crashed
2026-05-27. The test now restores pre-test weights at both exits; local
wi_php AND wa_php were cleaned to the seeded values through the weights
endpoint. (2) `d9457e0` — the four check-then-act windows (profile save /
clinician assign / ML score store / badge add) each ride one
member-row-locked transaction (S138 pattern), plain-English 409s. The new
test found a REAL extra bug on first run: both ML_RISK_SCORE readers used
lowercase .n1/.n2 against UPPERCASE N1/N2 keys — a junk history row on
EVERY scoring call and an empty ML-history endpoint since it shipped;
both fixed. ⚠️ Erica's live site carries the broken ML readers until the
queued deploys ship. Badge add also lost its new Date('YYYY-MM-DD')
UTC-day-shift wrapper. (3) `aa41afa` — v118 rule-based orphan sweep: the
26 orphaned activity-side rows deleted (re-census ZERO); the other Tier-3
items were already closed in S144 or are advisory. Audit doc stamped
CLOSED.

**LATER SAME SESSION (pre-push additions):** v119 ML echo cleanup (44 of
75 wi_php history rows were echoes of the broken readers — deleted by
rule, real changes untouched; Bill KNOWINGLY pre-approved that this
deletes junk rows on Erica's live DB at the eventual deploy, dress
rehearsal shows the exact count first) + the audit's two STANDING GUARDS:
lint Pattern 9 (statement-scoped — every storage-table query must carry
attaches_to; its FIRST run caught 12 real gaps, all fixed, incl. the
zero-caller incrementMoleculeColumn born without a side filter) and
tests/core/test_horizon_census.cjs (59 asserts — reddens when any
code/counter space passes 80%; fullest today: AIRCRAFT_TYPE at 91 of 127
value_ids). Local: SERVER_VERSION **2026.07.18.1112**, DB **v119**, suite
**84 tests / 1,934 asserts GREEN in full** (the cued push-gate run —
469s; the run also proves the weights-test + wa_php-standup ordering fix
in one window), lint 0 with Pattern 9 live. **Correction to the S144 wrap
note below: CI on `848b995` went RED (one assert, the weight residue) —
fixed by `fa09e9f`.** GitHub: **pushed on Bill's go 2026-07-18** through
the Session 145 push commit (all S144 leftovers + S145); CI watch started
at push — if this file is being read at a fresh session start, VERIFY
that run went green before anything else.
Heroku: **2026.07.13.2143 / DB v110** — LIVE, untouched, still frozen by
cadence (the four queued bite-size releases wait on Erica's retest
feedback; wa_php + chooser + today's work ride behind them; next deploy's
migrations now run v111→v119).

**WRAP (later same session):** the push's CI went RED once more (run
29652481483, ONE assert — the new test's ML site): rows carry a date but
no TIME, so a single-row "newest" pick breaks same-day ties by disk scan
order; CI's fresh heap served the stale same-day row and a concurrent
scoring run re-inserted (local had passed by scan-order luck — the second
environment-dependent coincidence of the day). HOTFIX `b92338b`: the
change-compare treats ALL newest-date rows as the reference set; the test
now forces the same-day case (primer call → concurrent pair must write
ZERO). **CI GREEN run 29652906180 — the push gate truly closed.** Then
v119 ML echo cleanup + the two standing guards (`730ebaa`): lint Pattern 9
(storage-table queries must carry attaches_to — its FIRST run caught 12
real gaps, all fixed) and the horizon census test. Then the
**PARTICIPANT-DAY WALK** (`b502ec0`, test_participant_day_walk, 20
asserts): ONE record walks invited → registered → activated → assigned →
portal → take → RED alert — Erica's blocked question-9 test proven end to
end on a fresh registrant; the JOURNEY IS HEALTHY (the sole first-run red
was the test's own yesterday-dated take; the platform's on/after rule is
right). Lessons recorded durably: BEFORE_YOU_WRITE gains the
date-tiebreaker pattern + the "second kind of X is a design event" rule;
MOLECULES.md §8 gains the UPPERCASE-N1-keys trap. **Waiting on Erica is
the honest platform state — her three replies (retest, ranking, rhythm)
set the next agenda.** Final: SERVER_VERSION **2026.07.18.1215**, DB
**v119**, suite **85 tests**, lint 0 (Pattern 9 live). Wrap commit pushed
after a second cued full-suite gate — next session verifies that CI run
green at start, as always.

---

**PRIOR — SESSION 144 — WASHINGTON STOOD UP. Ten commits: the clinical engine
moved to the vertical (16 files → verticals/workforce_monitoring/clinical/,
loaders gained the shared-clinical fallback); the last hardcoded-Wisconsin
strings left the shared pages; wa_php CREATED (v116 — full config copy,
WA branding/boards/Pacific TZ, no people); the TENANT CHOOSER (v117 —
platform_user_tenant authorization list, login chooser + header switcher,
server re-checks every switch, grant management superuser-only, S121 wall
attack-tested); the chooser made scalable (scrollable + type-to-filter
past 6); the tenant stand-up MACHINERY (tenant_standup.js — manifest +
copier + verifier; vertical parts via verticals/{v}/standup_parts.js;
docs/TENANT_STANDUP.md; next state = 5-line migration); the Erica walk
covers clinic.html + the public Performance Profile (the two honest gaps —
both healthy); audit Tier-2 part 1 (errors stop dressing as data — 7
fixes incl. the alias-delete table list derived from the catalog).

Local: SERVER_VERSION **2026.07.18.0837**, DB **v117**, suite **84 tests**
(82 verified together mid-session at 1,842 asserts; +walk extension +
targeted-green audit fixes since), lint 0. GitHub: pushed through
`848b995` (CI run 29646200398 was in progress at push — VERIFY GREEN at
next start); **3 commits local-only at wrap** (walk extension, audit part
1, this handoff) — push on Bill's go.
Heroku: **2026.07.13.2143 / DB v110** — LIVE, untouched, frozen where
Erica tests, BY AGREED CADENCE: the four queued bite-size releases (see
below) wait for HER retest feedback. Nothing new deploys until she
replies. wa_php (v116) + chooser (v117) ride BEHIND those four.

**Waiting on Erica (drives everything):** retest feedback on the July 14
deploy; master list Edition 1 completeness check + Large ranking (Edition
1 IS SENT); update-rhythm answer.

**Deploy-day additions (when the queue ships):** grant Erica's live login
wa_php access (superuser action, POST /v1/users/:id/tenants); create
Tom's login if he's getting one (none exists on live); confirm WA
licensing-board names at kickoff.

**Session 144 lessons (recorded in memory):** pipeline overhead
(one suite per push gate, never watch CI — feedback_pipeline_overhead);
the Erica-grant incident — NEVER touch a real person's authorizations to
demonstrate anything (throwaway logins exist for that); recite repo notes
as "the notes say", not as current fact.

**NEXT SESSION OPENS: audit Tier-2 part 2 — the four check-then-act
windows** (member-molecules PUT delete-then-insert without a transaction;
clinician assign; ML score upsert; badge add — two staff acting at once
can duplicate or lose data; wrap in transactions / DB-enforced upserts).
Then Tier-3 lights (orphan-row sweep needs Bill's go). Erica's replies
outrank everything if they arrive.**

**SESSION 143 — THE DAY WASHINGTON SIGNED, and three builds landed:
INTAKE PHASE 2 (Erica's spec complete, both halves), the MEDS
NOTIFICATION FLOOD fixed, and CREDENTIALS ("Jane Smith, MD" +
retire-not-delete platform-wide). Master list Edition 1 finalized with
its cover email — Bill sends. Releases go BITE-SIZE from now on (new
standing rule): four small releases queued, one story each.**

Local == GitHub through the wrap commit, CI GREEN on every push (three
code pushes + one docs push). Local: SERVER_VERSION **2026.07.16.0832**,
DB **v115**, suite **79 tests / 1,764 asserts** green (two cued full
runs), lint 0.
Heroku: **2026.07.13.2143 / DB v110** (release v101) — LIVE, untouched,
behind by design. **Four bite-size releases queued** (each pinned to its
story's commit, on Bill's explicit go, dress-rehearsal rules): (1) intake
Phase 1 [S142 bundle, deploy pinned at `49e922b`]; (2) intake Phase 2
[`173d1c8`, v113]; (3) MEDS notification fix [`941e88e`, v114];
(4) credentials [`93803c1`, v115]. ⚠️ Release 1 is the first deploy under
the all-or-nothing rule — her dyno's ML engine verified running.

What Session 143 did:
1. **🖋️ WASHINGTON SIGNED — the first papered deal.** WPHP executed the
   LOI 2026-07-16 (Sheldon Cooper, Exec Director + Erica for IHS).
   Wisconsin has NOT signed. Kickoff ~Aug 15; functional pilot ~Oct 16
   (RecoveryTrek migration validation); production by June 30, 2027;
   monthly WPHP updates start NOW; 180-day exclusivity. LOI is
   CONFIDENTIAL — document stays out of the repo; planning dates live in
   ACTIVE_WORK ("WASHINGTON SIGNED" section) + memory
   project_washington_state. Honest risk read: monitoring-track table
   stakes + lab integration are the real net-new for WA production;
   security/compliance hardening (HIPAA/42 CFR/BAA) required; economics
   unset until the definitive agreement.
2. **Intake Phase 2 (v113, `173d1c8`)** — the four doors per the locked
   contract: registration link (invite panel link-type choice → public
   /register form → true REGISTRANT via ONE member-creation door,
   enrollMemberRecord), participant activation ("Record signed agreement"
   → clinic + Participant + item resolved, either intake position),
   Columbia C-SSRS at intake (any Yes → CSSRS_POSITIVE → SR_SENTINEL —
   the ONE intake→registry wire, proven on a registrant; threshold
   Erica-tunable), reactivation (staff door + automatic on re-register;
   history intact, never re-registered; dedup never reveals who exists).
   test_intake_phase2.cjs, 89 asserts incl. full browser walk.
3. **MEDS flood fixed (v114, `941e88e`)** — 5,461 identical criticals
   deleted; notifications gain opt-in dedup_key (one alert per NEW missed
   period); bodies NAME the member; bell lands on the chart; the two
   overdue warning rules had routed to a role no login can hold
   (delivered to NOBODY ever) → repointed to Case Managers.
   test_meds_processing 15→23 asserts.
4. **Credentials (v115, `93803c1`)** — CREDENTIAL member molecule (one
   flat list, multiple per person, Tom's 14 values); retire-not-delete
   honored PLATFORM-WIDE (encoder refuses retired values, active-only
   pick-lists, history decodes forever); member multi-row door
   (/v1/members/:id/molecule-rows/:key); NameCred display rule on
   roster/chart/queue; admin_credentials.html under Program Settings.
   test_credentials.cjs, 36 asserts. Suite now 79 tests.
5. **Master list Edition 1 FINAL + cover email** — dated to the send day
   (2026-07-16): intake both halves + credentials in Recently completed,
   Large list renumbered 1-5 (starts at Network Directory), ask #3 = the
   update-rhythm question. Both .docx files in wi_php/project_status/
   (list + cover email); email text also at
   docs/ERICA_MASTER_LIST_EDITION1_EMAIL.md. Bill sends; no deploy
   needed first (nothing claimed live that isn't).
6. **NEXT SESSION OPENS: the Washington stand-up** — wa_php tenant as the
   pilot skeleton + the hardcoded-Wisconsin gap hunt + the TENANT CHOOSER
   (multi-state operator — Bill confirmed; see ACTIVE_WORK WA section).
   Erica's retest/ranking still drive the day if they arrive.
Standing rules held: every test run announced; full suite on Bill's cue
(two cued runs, one spanned machine sleep — the 2 browser-timeout flakes
passed in isolation and clean in CI); GitHub pushes on explicit go;
Heroku and Erica's live data untouched.

---

**PRIOR — SESSION 142 — INTAKE REBUILD PHASE 1 BUILT + THE ALL-OR-NOTHING STARTUP
RULE. Erica's intake spec is running code: intake left the Stability
Registry (own table, own queue page, server-enforced role actions —
the platform's first real permission gate). Then Bill's rule: the
platform refuses to start unless the database AND the ML engine are
healthy, and neither ever fails silently again. Everything on GitHub,
CI green. Heroku DELIBERATELY untouched — the whole 142 bundle ships as
ONE announced release ("your intake spec is built") after Erica's
retest feedback; Bill wants releases lean, one story each.**

Local: SERVER_VERSION **2026.07.14.1823**, DB **v112**, suite **77 tests /
1,631 asserts** green (cued pre-commit runs), lint 0.
GitHub: everything through **`b2af76e`**, CI green (the from-scratch replay
now installs the ML engine + waits for readiness).
Heroku: **2026.07.13.2143 / DB v110** (release v101) — LIVE, behind by
design. Next deploy applies **v111+v112** and carries all Session 142
commits, on Bill's explicit go, dress-rehearsal rules apply. ⚠️ Deploy
note: once deployed, her site won't boot without a healthy ML engine
(Bill's chosen behavior) — her dyno already runs it (verified serving
live predictions 2026-07-14; an in-session claim that her site lacked
ML was WRONG and is corrected in the build notes).

What Session 142 did:
1. **Intake Rebuild Phase 1 (v111, commit `37a161b`)** — per the locked
   contract: INTAKE_STATUS member molecule (Erica's 10 stages +
   Participant, explicit value_ids, in the M composite but deliberately
   NOT the profile form), all wi_php members backfilled to Participant
   (byte-verified); intake_item + intake_note tables (SLA clock = 2
   business days, sysparm-tunable); open REG_REVIEW items convert
   (resolution TO_INTAKE, nothing deleted); REG_REVIEW dispatch →
   createIntakeItem (new intake.js vertical module) — staff enroll
   stamps Participant (Phase 2's registration link mints true
   Registrants); role actions enforced server-side via POSITIONCLINIC
   (CM: note/outreach/route-resources/send-to-MD; MD: +approve-screening/
   refer-eval/refer-treatment/send-BACK-with-reason/close-file; Escalate
   + Advance RETIRED, endpoint + SLA-job + chip removed); intake_queue.html
   (SLA + review-type chips, NO clinical tiers, bell lands on the item);
   roster excludes registrant statuses (fail-open, tenants without the
   molecule unaffected). INTAKE_SLA job: overdue FLAGS + notifies CM,
   auto-escalate OFF (contract default, configurable). Test
   insight/test_intake_rebuild.cjs (69 asserts incl. role-refusal matrix
   + CM browser walk) replaces the retired-flow test_registration_review.
2. **The all-or-nothing startup rule (v112, commit `aba70c2`)** — Bill's
   rule: STARTCHECK=Pointers launch handshake (start.sh set it since the
   FIRST commit; nothing ever read it — now pointers.js refuses without
   it; Heroku's handshake is DATABASE_URL; ci.yml sets it); no DB config
   → refuse; DB/boot-chain failure → refuse loudly (the silent 501
   "DB-less" mode is DEAD — WORKFLOWS.md updated); ML engine required at
   boot (requireMlHealthy polls /health 30s after the STARTUP hook
   launches it) — dead-port refusal proven exit-1; mid-run ML death:
   watchdog auto-restarts (5s), EVERY restart logged durably to
   error_log, 3 deaths in 5 min → give up + critical ML_ENGINE_DOWN
   notification to tenant admins (rule v112) — all proven live by
   killing the engine repeatedly. Deliberate kills (re-STARTUP) don't
   count. CI installs ml/requirements.txt.
3. **Interrupted test runs restore now (run.cjs)** — leak PROVEN first
   (a run killed 75s in left 13 activities + 9 surveys — the junk-
   promotions mechanism), then SIGINT/SIGTERM handlers restore snapshot
   + refresh caches before dying; crash path guarded; re-proven zero
   residue. Queue item 4b closed.
4. **Readiness hotfix (`b2af76e`)** — the ML gate lengthens boot, so the
   harness + CI now wait for /version session_ready:true instead of a
   live port (CI run 29378066640 failed on that race; green after).
5. **Master list REBUILT (Edition 1, still UNSENT)** — intake Phase 1
   moved to "Built — arriving in your next update"; Large #1 is now the
   SECOND HALF only (registration link, activation, reactivation,
   Columbia); bell item left Small (built). .docx regenerated from the
   .md and content-verified. Bill sends when ready; her retest bugs go
   in first.
Standing rules held: every test run announced (4 full-suite + targeted +
2 announced kill-experiments); GitHub pushes on Bill's explicit go;
Heroku and Erica's live data untouched.

---

**PRIOR — SESSION 141 — ERICA'S FEEDBACK DAY: her testing feedback (the best she's
sent) was read, triaged, and her three fixable defects were FIXED, TESTED,
AND DEPLOYED TO HER LIVE SITE within the session. The master-list process
was born and blessed by Erica + Tom same-day. The credentials feature was
designed and confirmed by both co-owners without a line of code. The
INTAKE REBUILD design contract is LOCKED — Phase 1 opens Session 142.**

Local: SERVER_VERSION **2026.07.13.2143**, DB **v110**, suite **77 tests /
1,590 asserts** green (the cued pre-commit run), lint 0.
Heroku: **2026.07.13.2143 / DB v110** (release v101) — LIVE, deployed
2026-07-14 morning on Bill's go after CI green, verified read-only (new
portal/chart/QR code served; live MEDS answers carry respondent_type;
zero writes to Erica's data). Fun fact from the migration: Heroku's Delta
never had the 17 junk promotions — that residue was local-only.
GitHub: everything through `8e51717` + this wrap commit, CI green.
**Local == GitHub == Heroku. Nothing held, nothing pending deploy.**

What Session 141 did:
1. **Erica's feedback triaged** (verbatim + her two specs filed in
   `verticals/workforce_monitoring/tenants/wi_php/`; full triage in
   ACTIVE_WORK). Her intake spec = the corrected registration workflow;
   her Network Directory spec SUPERSEDES the July-packet wellness
   directory. Three named systems now canonical: Network Directory /
   Resource Library / Document Repository.
2. **Her three defects fixed same-day + verified live + tested:**
   (a) participant portal offers now come from the member's expected
   instrument set — was hardcoded PPSI + fixed anchor battery, so her
   assigned PHQ-9 could never appear; self-report only; unblocks her
   question-9 alert test; (b) the chart's instruments card renders its
   failure + Try-again instead of vanishing silently; (c) the printable
   QR page (the real culprit — the invite modal's QR was always correct)
   now carries a referral token; invite modal gained a Printable QR
   button. Defect 4 (escalations indistinguishable) deliberately folds
   into the intake rebuild. Riding along: the enroll page answers the
   duplicate-number 409 in plain English + opens the participant search.
   test_instrument_assignment gained a portal walk (42→50 asserts).
   Fixes email SENT to Erica (Tom cc'd) after the deploy verified.
3. **THE MASTER-LIST PROCESS (memory: project_erica_masterlist_process):**
   we PM a repo-kept master list; dated .docx editions EMAILED to Erica
   (never "check Google Drive"); she confirms completeness + RANKS the
   Large items → build order. Home:
   `verticals/workforce_monitoring/tenants/wi_php/project_status/` —
   **Edition 1 (.md committed, .docx ready beside it) is CURRENT and
   UNSENT; Bill sends it in a few days** (heads-up email already sent;
   Erica: "This is so wonderful"). Sections: Recently completed / Bugs /
   Small / Large (rankable, sub-builds shown) / Maybe / In Your Court.
4. **Credentials feature — CONFIRMED by Tom + Erica, ready to build as a
   GAP-FILLER (not top of list, Bill's call):** CREDENTIAL internal-list
   member molecule, ONE flat list (never coupled to boards — Tom),
   multiple per person, "Jane Smith, MD" display, NO honorifics; a
   Credentials CRUD page under Program Settings; retire-not-delete —
   NOTE: `molecule_value_text.is_active` EXISTS but NO code honors it
   yet; the build makes the platform honor it everywhere.
5. **INTAKE REBUILD CONTRACT LOCKED** (full contract in ACTIVE_WORK):
   11-value INTAKE_STATUS member molecule (her 10 stages + Participant —
   a separate Participant flag was weighed and REJECTED); intake items
   in their OWN table (never stability_registry); the Intake Queue page;
   role-scoped actions enforced server-side (the first real permission
   gate, riding positions); Phase 1 skeleton → Phase 2 doors
   (registration link, activation, Columbia→SENTINEL).
6. **Flagged for later:** MEDS "Consecutive Missed Events" notifications
   never dedup (5,000+ identical criticals since March, body names no
   member) — in ACTIVE_WORK + a task chip.
Standing rules held: every test run announced (7 targeted + 1 cued full
suite); GitHub and Heroku pushes each on Bill's explicit go; Erica's live
data untouched (read-only verification).

---

**PRIOR — SESSION 140 — DEPLOY DAY. The dress rehearsal caught three real bugs on
its first run, then v96–v109 (fourteen migrations) went LIVE on Erica's
Heroku site and was click-verified. Her nine-document packet was triaged
into ACTIVE_WORK (the standing Erica roadmap). The double-enroll she hit
July 6 is closed end to end. v110 deactivated Delta's 17 junk promotions
(LOCAL-ONLY at wrap) and the honest at-scale number is 498 accruals/sec.
ERICA'S TESTING FEEDBACK ARRIVED AT WRAP — unread; it opens Session 141.**

Local: SERVER_VERSION **2026.07.12.2329**, DB **v110**, lint 0, suite
**77 tests / 1,533 asserts** green on the REHEARSAL copy of her live data
(the sanctioned pre-deploy gate; CI green from-scratch on the deployed
commits). Local server back on `loyalty`.
Heroku: **2026.07.12.1112 / DB v109** — LIVE and verified (roster, MEDS
resurrected, 10-instrument catalog incl. PHQ-9/GAD-7, badges clean,
position routing finds Dr. Larson, follow-ups, notifications).
**Unpushed: commit `0debd62` (v110) — GitHub/Heroku still at v109; push
on Bill's go** (Delta-only, zero Erica risk).

What Session 140 did:
1. **Erica's packet triaged** — see ACTIVE_WORK "ERICA'S JULY PACKET":
   competitor comparison (neither RecoveryTrek nor Affinity has predictive
   risk scoring), Medication Registry spec, Document Repository spec (the
   foundation dependency), consent architecture (legal-gated; unlocks
   participant messaging + self-registration), Layer-1 agreement, Wellness
   Directory (her revenue idea), Treatment Provider network. Source .docx
   files in `verticals/workforce_monitoring/tenants/wi_php/` (untracked).
2. **The dress rehearsal (first ever) caught, before deploy:** (a) her
   live Joy Sunshine double-registration — both #90 — which would have
   KILLED v107 mid-deploy (v107 amended: repairs in place, ADVANCED keeps
   90, RESOURCES → 103, nothing deleted); (b) the platform_user link
   counter pointing at a used link (staff-login creation 500s once on her
   live site) → **v109** trues it up; (c) the badge endpoint 500ing every
   chart load on tenants without the BADGE molecule → clean empty list.
   Plus: run.cjs forces PGDATABASE = DATABASE_NAME (the first rehearsal
   run's mismatch let test SQL hit the real local DB — four planted rows
   cleaned, zero residue), and seven tests made environment-honest
   (resolve by NAME — Steadman #53 local/#60 live, Grace 46/53, program
   30/31; relative counts; real-MD-holder aware). Verdict: 77/77 green on
   her migrated data, Erica walk zero console errors.
3. **Deployed on Bill's go:** GitHub push → CI green → Heroku push →
   fourteen migrations applied → restart → live verification. The
   release/testing email to Erica (Tom cc'd) is DRAFTED AND APPROVED
   (packet compliments + highlights + 7-step testing checklist; the
   double-enroll and speed bullets removed at Bill's direction).
4. **Double-enroll closed:** root cause = ONE open enroll form submitting
   twice during a multi-second save (number reserved atomically at open —
   the counter was never the hole). Save now locks during save;
   POST /v1/member answers the v107 refusal with a plain-English 409;
   proven live (duplicate refused, zero rows written). Local DB audited:
   zero duplicate numbers (unique WITHIN a tenant by design — tenants may
   share numbers).
5. **v110 + the honest number:** 17 junk Delta promotions off (exact code
   list, Bill-approved, deactivate-never-delete) → Delta 27→10 active.
   Bill's 20k concurrency-10 run on the 5M-member loyaltybig:
   **498/sec, zero failures, avg 20ms / p99 52ms / max 195ms** (S139's
   5.1s tail gone). +44% over 345; the 1,056 whitepaper number predates
   the S137/138 integrity hardening — 498 is the number with every
   guarantee on.
Standing rules held: every test run announced; the rehearsal was the cued
full-suite gate; GitHub and Heroku pushes each on Bill's explicit go.

---

**PRIOR — SESSION 139 — ACCRUAL THROUGHPUT AT 5M MEMBERS: 139/sec → 345/sec (2.5×),
the S134–138 regression found by measurement and surpassed, and 17 JUNK TEST
PROMOTIONS discovered live on Delta (v109 deactivation awaiting Bill's go).
ERICA REPLIED at session end — her material opens Session 140 (deploy day:
dress rehearsal MANDATORY first). Both commits on GitHub (`e5b66d0`,
`46a962e`), CI green on the first; the second's CI was running at wrap
(verify at next start).**
Local: SERVER_VERSION **2026.07.10.2132**, DB **v108** (no schema change
today), suite **77 tests / 1,577 asserts** green TWICE (both cued full runs),
lint 0. Heroku deliberately behind (2026.07.02.2003 / v95) — the held Erica
bundle now deploys **v96–v108 + the two S139 perf commits** on Bill's
explicit go, dress rehearsal first.

What Session 139 did (Bill drove stress tests, Claude monitored the DB):
1. **Bill's stress test caught a real problem:** accruals at 5M members ran
   139–220/sec vs the ~1,056/sec whitepaper-era number. Diagnosis by
   measurement (reset pg_stat counters + live query sampling during Bill's
   runs): ~250 DB round-trips per fresh-member accrual — no missing indexes,
   no lock waits (S138's member lock exonerated), nothing saturated; pure
   round-trip stacking. A code walk-back (server temporarily run on the S133
   commit against the same data — nothing committed, restored after) proved
   S134–138 owned a real ~20% regression + a fat latency tail (339ms → 5.1s
   max); the rest was per-request promotion volume.
2. **Fix 1 (`e5b66d0`):** evaluatePromotions loads the member's whole
   enrollment state in TWO hoisted queries (was 2 per active promotion × 27
   on Delta), kept current in-memory incl. the enroll-cascade path; fresh
   enrollments reuse their INSERT..RETURNING counter rows; per-counter
   activity reads memoized (27 identical MEMBER_POINTS reads → 1);
   promotion_stats aggregated to ONE flush per accrual (flushPromotionStats,
   same on-the-pool never-harm contract); enrollment counter INSERTs are one
   multi-row statement. 139 → 268/sec.
3. **Fix 2 (`46a962e`):** the per-counter progress UPDATE + contribution-log
   INSERT (2 × 27 per accrual) accumulate in-loop and flush as one multi-row
   UPDATE + one multi-row INSERT on the SAME transaction client — atomicity
   and qualify_date arithmetic identical. 268 → **345/sec**. Read paths
   measured healthy untouched: **~5,000/sec** on member profile AND activity
   list at 5M members (validates the S136 bulk-read helpers at scale).
4. **🚨 FOUND: 17 of Delta's 27 active promotions are TEST RESIDUE** (codes
   `MC-*-<Date.now()>`, `UI-<Date.now()>`, `DOW-*` — the exact generator
   patterns in test_multi_counter_promotions / test_promotion_engine; leaked
   April–June 2026, likely from runs that crashed before restore). Every
   accrual pays for all 27; ~2/3 of the promotion work is debris — this is
   most of the remaining gap to the old 1,056/sec benchmark, which ran with
   ~10 real promotions. **Pending Bill's decision: v109 migration to
   DEACTIVATE (not delete — enrollment history references them) the 17 by
   exact code list, with the list shown to Bill before it runs.** Also open:
   verify the test harness restores the DB when a run CRASHES mid-way (else
   residue re-accumulates).
5. **Scale context (Bill):** Northwest processed 50k accruals per NIGHT in
   batch (~1.75/sec); Pointers now does that whole workload in ~2.5 minutes,
   live, with bonuses/promotions/audit per accrual. The 5M-member loyaltybig
   (Bill's preload, ~33k member inserts/sec) remains for future perf work.
Process notes: one server hang mid-day (cause unproven — Claude killed the
process before capturing state; lesson recorded); the monitoring pattern
that worked: reset pg_stat counters → Bill runs the load → read per-table
counts + sample live pg_stat_activity queries. Standing rules held: every
test run announced; two cued full suites; GitHub pushes on Bill's go;
Heroku untouched.

---

**PRIOR — SESSION 138 — AUDIT TIER-1 COMPLETE (all four), MEDS RESURRECTED, the
test-harness ghost-cache bug fixed, the Erica walk added. EVERYTHING ON
GITHUB, CI GREEN (through `abb98c0`).**
Local: SERVER_VERSION **2026.07.10.1026**, DB **v108**, suite **77 tests /
1,577 asserts green** (two full cued runs today), lint 0. Heroku deliberately
untouched (2026.07.02.2003 / v95) — the held Erica bundle now deploys
**v96–v108** on Bill's explicit go, **with the NEW MANDATORY pre-deploy dress
rehearsal against a copy of her live data** (see ACTIVE_WORK). Erica: still
quiet; her reply drives deploy day.

What Session 138 shipped (7 commits, all on origin/main, CI green):
1. **v107 — three uniqueness guards** (audit 1.1b/1.3): one point bucket per
   member+rule, one OPEN enrollment per member+promotion (partial — repeatable
   promos keep a row per completion), one membership number per tenant. Zero
   violations existed; the migration fails loudly naming offenders otherwise.
2. **The accrual member lock actually holds** (audit 1.1): createAccrualActivity
   takes the caller's transaction client; FOR UPDATE held to COMMIT; every
   write AND every read-of-own-writes (both engines, getAllActivityMolecules,
   getActivityPoints, getActivityMoleculeValueById) rides the client. All
   three callers pass theirs (accrual route, survey submit — its deadlock-
   workaround class retired — compliance entry). getNextLink stays on the pool
   BY DESIGN (no cross-member queuing; a rollback burns a link, harmless).
   Engines rethrow inside a caller's transaction; evaluateBonuses'
   activity-not-found tenant-1 fallback is GONE. Partner route got the same
   fix (+ its bucket-failure path no longer leaves the transaction open).
   Transaction discipline: the three stats writers run DELIBERATELY on the
   pool (never-harm-the-accrual contract); external-action dispatch in both
   engines + the multi-column read loop are savepoint-protected; broken defs
   are skipped via a pool-side table-existence probe. New
   core/test_concurrent_accruals.cjs (7 asserts): 6 simultaneous flights at
   one member — all 201, exact activity/bonus/point deltas, zero duplicates.
3. **~50 "no tenant? assume Delta" defaults fail closed** (audit 1.2): 52
   scripted sites + the display-template INSERT param + the audit-report
   render + 2 dev-tool job starts → plain-English 400. The accrual route's
   guard ROLLBACKs its already-open transaction first; the other
   transaction-holding routes verified guard-before-BEGIN.
4. **Notification hardening** (audit 1.4): display_name lookups tenant-scoped,
   ambiguous matches refused loudly. Finding: BOTH name-matching branches
   deliver to ZERO logins in live data (display names carry titles) — the
   real fix is a login→person bridge, a data-model decision for Bill
   (ties into the S127 person-model direction).
5. **v108 — BT deleted** (Bill's call): the half-built "bills test" molecule
   (def + 3 column rows, storage table never created). It was the transaction
   poisoner that surfaced the swallowed-error class.
6. **The test-harness ghost-cache bug — fixed** (it bit Bill live: FK error
   posting a flight right after the suite ran): run.cjs restored the DB but
   never told the RUNNING server — stale cached promotions/bonuses meant
   phantom bonus points and silently-missing enrollments after EVERY suite
   run since the suite has existed. Every restore path now refreshes server
   caches via /v1/admin/cache/refresh (loud restart-the-server warning if it
   can't). Proven live in every later run ("Server caches refreshed").
7. **MEDS WAS SILENTLY DEAD — resurrected** (audit Tier-2 opener, Bill's go):
   (a) processMedsForMember crashed on undefined `surveys` (the v97 refactor
   renamed it `instruments` everywhere but the recalc block) — every
   overdue member's run rolled back its own alerts + registry items and
   returned success-shaped counts; (b) the chart's page-load trigger 404'd
   on every load (public membership number compared against the internal
   link), response ignored. BOTH doors fixed; recalc rewritten (now also
   covers random-scheduled compliance, which the old recalc omitted);
   failures now throw/report honestly (the daily scan isolates a sick
   member, keeps going, reports a failed count). New
   insight/test_meds_processing.cjs (15 asserts): overdue participant →
   check with the PUBLIC number → registry item + schedule bump PERSIST in
   the DB → dedup across re-check and manual scan run.
   **⚠️ Erica's LIVE site still runs the dead MEDS until the deploy.**
8. **The Erica walk** (insight/test_erica_walk.cjs, 16 asserts): a
   throwaway tenant-5 ADMIN login (her real role) walks login → dashboard →
   Steadman's chart (the page-load MEDS check must NOT fail) → action queue
   → notifications, zero console/page errors across the walk.
Standing rules held: every run announced; two full-suite runs on Bill's cue
(75/1,546 then 77/1,577, both green); GitHub pushes on his explicit go;
Heroku untouched.

---

**PRIOR — SESSION 137 — THE MOLECULE SIDE-IDENTITY WORK, ALL OF IT: Step-0 defusal
(v105) + the entity-type registry (v106) built, proven, and PUSHED; then a
five-lens platform audit (verdict: nothing fundamental).**
Local: SERVER_VERSION **2026.07.09.2205**, DB **v106**, suite 74 tests /
~1,530 asserts (every test green on CI's from-scratch DB after the hotfix;
local full runs were noisy only from machine sleep/load and my own test's
brittleness — three lessons now recorded in ACTIVE_WORK), lint 0. Heroku
deliberately behind (2026.07.02.2003 / v95) — the held Erica bundle now
deploys **v96–v106** on Bill's explicit go. Erica: still quiet; Bill's
decision — wait for her reply to his July-6 reply, NO nudge email.

What Session 137 shipped (commits `58a2f53`, `a60d5e1`, `83ffe2b`, `458954b`
— all on origin/main):
1. **Step-0 defusal (v105):** every value-molecule read filters attaches_to
   via the ONE resolver (resolveRowSide) the write path uses — the four row
   helpers (+ attachesOverride params), moleculeJoinSQL/moleculeCondSQL,
   both timeline UNION reads, the single-value activity readers, badge
   read/deletes; member profile form reads AND writes 'M' explicitly (its
   PUT used to delete-M-then-insert-A for both-sided molecules). Proven by
   core/test_side_filter_collision.cjs (planted cross-side collisions).
   Found+fixed along the way: ML_RISK_SCORE stored the same members' scores
   on TWO sides (missing lookup row, the §5.2 trap — v105 adds the rows and
   restamps 63 member-link rows to 'M'); clinician assign/unassign had been
   500ing on case-sensitive column matching in findMoleculeRow/
   deleteMoleculeRow (case-insensitive now).
2. **Entity-type registry (v106) — molecules attach to ANYTHING:** link_tank
   keeps a 1-byte entity code per attachable table (used purely as the
   existing table-name directory; LINK ALLOCATION COMPLETELY UNTOUCHED —
   Bill's in-session refinement; no de-tenanting, no counter merges). Legacy
   codes = the letters' own numbers (activity 64 'A', alias 75 'L', member
   76 'M' — zero rows rewritten); platform_user minted 77 ('N'); the one
   4_data_12 placeholder row restamped (the inert-'A' convention is
   RETIRED — every row's byte tells the truth). resolveEntityCode: cached
   table→code door, self-registers on first attachment (schema-existence
   guard, loud on typos), codes 1–127 unique never-null (31 BANNED — it
   encodes as blank), minted above the high-water mark, never reused.
   molecule_def.parent_entity_id names a non-5-byte molecule's parent
   (createMoleculeComplete takes parent_table; clone/auto-provision/boot
   Layer-4 carry it). Proven live: first-ever clinic molecule
   (partner_program self-registered code 78) round-tripped —
   core/test_entity_registry.cjs (24 asserts). MOLECULES.md gains §5.0 (row
   identity = parent + molecule + SIDE, always — the never-written-down
   invariant behind the ~130-session flaw) and §12 (the registry).
3. **The platform audit (Bill's ask):** five parallel read-only lenses —
   growth horizons, row identity, silent defaults, cleanup completeness,
   concurrency perimeter. **Nothing fundamental.** Ranked findings (Tier-1
   verified by hand): the accrual member lock doesn't actually hold
   (pool-issued FOR UPDATE — redemption/adjustment do it right), ~50
   "no tenant → assume Delta" defaults, membership_number trusted-but-not-
   unique, display_name notification routing. Full report:
   **docs/PLATFORM_AUDIT_2026_07.md**. Bill approved: Tier-1 fixes open the
   next session.
Standing rules held: every test run announced; full suite on Bill's cue
(the cued run took three passes to get an honest verdict — my new test had
three brittle assumptions, all fixed; one unannounced suite re-run was my
process miss, owned and corrected with capture-to-file).

---

**PRIOR — SESSION 136 — EVERYTHING PUSHED TO GITHUB, CI GREEN (through `2067e79`).**
Local: SERVER_VERSION **2026.07.08.2219**, DB **v104**, suite **72/1,488** green,
lint 0. Heroku deliberately untouched (2026.07.02.2003 / v95) — the held Erica
bundle now deploys **v96–v104** on Bill's explicit go with an announcement.
Erica stayed quiet all day; **the Thursday news-first nudge is due 2026-07-09.**

What Session 136 shipped (all on origin/main, CI green):
1. **saveActivityPoints through insertMoleculeRow** — the hottest write (every
   accrual/redemption MEMBER_POINTS row) through the one door, proven
   byte-identical against the frozen old INSERT (`core/test_points_write_path.cjs`,
   18 asserts; 3-bucket redemption, raw signed negatives). Dead activity_id
   fallback (retired column — would have crashed) removed.
2. **Bulk molecule reads:** `bulkGetMoleculeValues` (one query per link-list,
   getMoleculeRows shape) + `moleculeJoinSQL`/`moleculeCondSQL` (flagCondSQL's
   counterparts for value molecules; encoded values ride $ params). Adopted at
   every hand-tuned survey-join site (timeline points query, all 8 custauth
   stream reads, wellness, scoring_history, ml_features, extendedCardDetector —
   which now takes fragment builders, not an id map). Wellness roster dropped 3
   N+1 loops. New parity test `core/test_bulk_molecule_reads.cjs` (endpoint
   output vs frozen SQL) — which caught a REAL S135 regression:
   FILTER_MEMBER_LIST's 5 vertical call sites never passed ctx.molecules, so
   clinician filtering silently no-opped (4 clinicians on the wellness roster).
   Fixed. ml_report.js (standalone CLI, own pool) deliberately untouched.
3. **Retro-sim preloads through moleculeJoinSQL** — killed the hardcoded
   `5_data_${storageSize}` (assumed 5-byte parents). The ONLY raw molecule-table
   access left in the server is the two parked timeline UNION reads.
4. **db_migrate v104** — dropped 7 provably-redundant indexes (6 standalone
   (p_link) on base storage tables + idx_activity_link, a PK duplicate),
   detected by column shape, expression-safe. Measured first on the 17 GB
   loyaltybig (~572 B per activity all-in; indexes were 57%). loyaltybig then
   DELETED on Bill's call (17 GB reclaimed; no generator script existed — build
   one if a scale DB is ever needed again). Config-table index tidy-up (~29
   more, ~0.5 MB, LOW ROI) parked as backlog in ACTIVE_WORK.
5. **Terminology:** "multi-column molecule" is canonical (Bill's term) —
   defined in MASTER §Unified Data Tables; the session-coined "bundled" and
   MOLECULES.md's colliding "Composite" label retired; ~20 comments swept +
   one variable rename. No logic change.
6. **🚨 THE BIG ONE — entity-type registry DESIGNED + link-collision time bomb
   MEASURED:** member links (counter 305) will start colliding with existing
   activity links (337+) in **~32 more member enrollments**, and the generic
   value reads don't filter attaches_to → 'AM' molecules (SEAT_TYPE,
   IS_DELETED) on a colliding pair return BOTH sides' rows: random wrong data.
   **Step-0 defusal (side-filter the reads) is the next session's urgent
   opener — before member #337.** Full Bill-approved design:
   `docs/MOLECULE_ATTACH_ANYTHING_DESIGN.md` — link_tank de-tenants and becomes
   the entity registry, attaches_to becomes a squished 1-byte entity id,
   ZERO-REWRITE migration (activity=64 / alias=75 / member=76 — the existing
   letter bytes already ARE those ids squished).
Also: CI workflow actions bumped off deprecated Node-20 runtimes. Standing
rules held: every test run announced; full suite on Bill's cue only (3 cued
runs, all green).

---

**PRIOR — SESSION 135 (wrap) — EVERYTHING PUSHED TO GITHUB, CI GREEN.** Full suite ran on
Bill's cue: **70 tests / 1,458 asserts, 0 failures**; then all 16 Session 133–135
commits pushed to origin/main (CI run 28894678419 green — from-scratch migration
replay v1→v103 + full suite in the cloud). **Heroku deliberately untouched**
(2026.07.02.2003 / v95) — the held Erica bundle deploys v96–v103 on Bill's explicit
go with an announcement. Local: SERVER_VERSION 2026.07.07.1430, DB v103, lint 0.
Next-session plan (saveActivityPoints opener, Bill's go) is in ACTIVE_WORK.md.

---

**SESSION 135 (late) — the SYSTEM-MOLECULE TRUE-UP (queued item 2, v103).** The
engine's 8 system molecules (IS_DELETED, MEMBER_POINTS, BONUS_RULE_ID/
BONUS_ACTIVITY_LINK/BONUS_ACTIVITY_ID/BONUS_RESULT, MEMBER_PROMOTION, PROMOTION)
now have the SAME shape on every tenant: v103 created the missing defs
(United/Ferrari lacked the whole bonus-linkage set — a latent break on their
first bonus; Marriott lacked BONUS_RESULT; wi_php lacked PROMOTION), copied the
missing column metadata (MEMBER_POINTS had its 2 rows on tenants 1+3 only), and
flagged system_required everywhere. `verifyTenantMolecules` gains **Layer 4**:
every system molecule's def shape + column metadata compared to the tenant-1
reference, hard boot refusal on drift — negative-tested (a deleted metadata row
produced the named, plain-English refusal). The clone def-copy now carries
system_required + parent_bytes (it silently dropped both). New
`core/test_system_molecule_identity.cjs` (34 asserts). MEMBER_SURVEY_LINK stays
optional-per-tenant by design (code handles its absence). **saveActivityPoints
deliberately untouched (Bill's hold)** — now unblocked, its own decision.
SERVER_VERSION 2026.07.07.1430, DB **v103**; held deploy now carries v96–v103.

---

**SESSION 135 (afternoon) — the PAGE-LAYOUT SWEEP + the member-profile rework +
the Flags area, all Bill-driven same-day feedback. All local; targeted tests green;
the full suite awaits Bill's cue (new rule: no test runs while Bill works — every
run snapshots/restores the DB and one ERASED his in-progress bonus; see memory
feedback_tests_wipe_concurrent_work).**

- **Page-layout sweep (Bill's go, run during his meeting):** ~45 pages shared two
  stacked shell bugs — app-layout sized 100vh under the fixed 48px nav (bottom 48px
  clipped by body overflow:hidden, UNREACHABLE) and theme.css's
  `.main-content { min-height: 100vh }` re-inflating the shell. Fixed everywhere
  (`calc(100vh - 48px)` + `min-height: 0`). Bonus/tier/molecule/partner edit also
  moved action bars out of the scroll region (sticky is unreliable inside these
  shells). **Standing test `core/test_page_action_geometry.cjs`** — 29 page loads
  measured in pixels at 1280x720 (create + edit modes, entity refs resolved live).
- **csr_member profile tab:** two-column form (single under 1000px) fits above the
  fold with NO scrolling at desktop size (measured 396px content, Save at 608/720);
  Cancel now leaves the page (unedited → straight to activity view; edited →
  confirm, revert, leave). Walk test asserts both.
- **Flags area on the member profile:** GET /v1/members/:id/flags lists the tenant's
  member flags with state (member-context only; system flags excluded);
  csr_member.html renders on/off ticks that apply immediately via the flag
  endpoints. Proven by browser walk (tick really sets/clears at the DB).
- **Fix:** /v1/storage-tables checks refused the `_data_0` flag pattern — Delta's
  create page falsely claimed 5_data_0 didn't exist.
- **Bill's Delta demo config created via UI (LOCAL DB only, not in any migration):**
  FOB member flag + "FOB TEST" percent-100 bonus with criterion "Friend of Bill is
  set" (recreated by Claude after a test-run restore erased Bill's original — the
  incident behind the new no-tests-while-Bill-works rule).

---

**SESSION 135 — FLAG MOLECULES are a first-class third molecule type (Dynamic stores /
Reference queries / Flag marks presence). Built to Bill's Session-134 scope, proven by
the FOB double-points acceptance test. ALL LOCAL-ONLY (nothing pushed). Local
SERVER_VERSION 2026.07.07.1218, DB v102, suite 68 tests / 1,382 asserts green, lint 0.
Heroku still 2026.07.02.2003 / v95 — the held Erica bundle now deploys v96–v102.**

- **One flag door:** `setFlag` / `clearFlag` / `isFlagSet` / `getFlaggedLinks` +
  `flagCondSQL` (presence condition for set-based queries), exposed on `ctx.molecules`.
  The side (A/M) resolves from the DEFINITION's attaches_to — not molecule_value_lookup,
  whose missing-row default silently guesses 'A' (the §5.2 trap; FULL_PPSI_REQUESTED
  was hitting it in production code). An override naming a side the flag doesn't have
  is rejected plainly. The generic row helpers (insert/get/find/deleteMoleculeRow) now
  REFUSE zero-column molecules and point to the flag door.
- **Every hand-roll folded in:** IS_DELETED trio = thin wrappers (its special-purpose
  cache deleted; auto-provisioned defs now feed the moleculeDef cache in the same
  load); member-timeline soft-delete NOT-EXISTS ×2 → flagCondSQL; clinicians.js
  isClinician/getClinicians; custauth FILTER_MEMBER_LIST (via ctx-passed
  getFlaggedLinks); scoring_history FULL_PPSI set/clear/check; the post-survey flag
  clear; the ml-report clinician exclusion — whose missing-molecule branch was a
  latent 500 (getMoleculeStorageInfo throws, it never returned null), now degrades
  cleanly for tenants without the flag.
- **Create (the third type):** `createMoleculeComplete` accepts pattern '0' — flag
  validation in plain English (5-byte flags need a side A/M/AM; no columns, no values,
  no composites), `ensureStorageTable` builds `{n}_data_0` presence tables (no value
  columns; PK p_link+molecule_id+attaches_to, which idempotent set relies on;
  `storagePatternColumnDefs('0')` = []), header carries value_kind 'value' like the
  seeded flags, and the prover uses presence semantics (set → confirm → clear →
  confirm absent through the real doors). Admin create page offers **Flag** (form =
  name/label + parent size + attaches-to; flag parent size locked on edit);
  admin_molecules.html shows Flag as its own TYPE badge + filter and now shows the
  `_data_0` storage table (was '-').
- **Rules ("is set" / "is not set"):** `evaluateCriteria` gets a flag branch ahead of
  the type dispatch — member flags check memberLink, activity flags check a NEW
  optional `activityLink` argument (plumbed at both engines + both simulations; the
  test rigs evaluating an unsaved activity pass null, and an activity-flag criterion
  fails with a clear reason there). Criteria CRUD (bonus + promotion, POST + PUT)
  accepts the presence operators with NO value (stores ''). The shared criteria editor
  offers ONLY the two presence operators for a flag molecule and hides the value box —
  closing the Session-134 trap (a flag was listed in the dropdown but a rule on it
  could never match). Editor fix riding along: `data-storage-size="${m.storage_size ||
  ''}"` swallowed numeric 0 — now `??`.
- **Member flag doors:** GET/POST/DELETE `/v1/members/:id/flags/:key` (set/clear need
  a login; non-flag key or wrong side → plain-English 400).
- **v102 migration:** normalizes any FULL_PPSI_REQUESTED `5_data_0` rows from 'A' to
  'M' (the old write path stored the member flag on the activity side; reads didn't
  filter, so it worked by accident — the new helpers do filter). 0 rows locally;
  idempotent for Heroku.
- **Acceptance test `core/test_flag_molecules.cjs` (32 asserts):** create FOB via the
  routine (round-trip proven), rejection wording, flag-door round-trip + idempotency,
  FOBDOUBLE percent-100 bonus + "FOB is set" → fires ONLY while flagged (bonus points
  = the computed base, i.e. double), "is not set" inverts, test-rig member-flag
  evaluation, browser walks of the create form + the criteria editor (flag-only
  operators, hidden value box, standard list intact for non-flags).
- **Deploy note:** nothing pushed to GitHub or Heroku. Next `git push heroku main`
  carries Sessions 130–135 and applies **v96–v102**, on Bill's explicit go, CI first.

---

**SESSION 134 — THE MOLECULE COLUMN CONTRACT, everywhere ("molecule + column, column 1
when unsaid, molecules untouched"): display templates + input templates + the
bonus/promotion rules engine all reference multi-column molecules by column
now — plus a rule-1 cleanup that removed every hand-rolled molecule decode in the
platform. ALL LOCAL-ONLY (nothing pushed). Local SERVER_VERSION 2026.07.07.0836,
DB v101, suite 67 tests / 1,350 asserts green, lint 0. Heroku still 2026.07.02.2003 /
v95 — the held Erica bundle now deploys v96–v101.**

- **Rule-1 cleanup (fix-NOW items, Bill's order):** the Session-133 hand-rolled
  per-column decode in the timeline display is gone — `decodeMoleculeColumn` is the
  box's ONE per-column decode door (text/list/lookup/passthrough, 'code'|'label');
  the display branch AND the create-routine's round-trip prover both call it. The two
  SQL-side squish decodes (`ASCII(c1)-1` in wellness.js Stream G + custauth.js events)
  are gone — the stored byte is computed via encodeMolecule+encodeValue in JS and
  compared opaquely in SQL (proved: identical 52-row selection; drops the mvt join).
  custauth POST_ACCRUAL context now carries molecules.encodeMolecule + encodeValue
  (all 3 call sites: accruals, survey scoring, compliance).
- **Display templates (v100):** references are `[M,KEY,column,"format",maxLen]` —
  column optional, missing = 1 (renderer safety net). v100 stamped all 16 existing
  lines to explicit column 1 (rendering proven byte-identical) AND added
  input_template_field.column_number (DEFAULT 1). Both server renderers resolve
  column N of a multi-column molecule; the builder page has a Column picker.
  `core/test_display_template_columns.cjs` (16 asserts): [M,MEMBER_POINTS,2] renders
  the flight's points from the multi-column table on the live timeline + builder walk.
- **Input templates:** field CRUD carries column_number; the add-activity form renders
  a column-2+ field as its own input; getFormData assembles a multi-column molecule into
  ONE array value (index = column−1); createAccrualActivity encodes each element by
  its own column (encodeMolecule columnOrder) and stores the row via insertMoleculeRow.
  Scalar payloads byte-identical. The input-template editor gets the Column picker.
  `core/test_input_template_columns.cjs` (17 asserts): enter ['UA',42] by column →
  one stored row → "UA/42" on the timeline; CRUD round-trip; browser walks of the
  form AND the editor page.
- **Rules engine (v101):** rule_criteria.column_number (DEFAULT 1). The shared
  criteria editor (criteria-editor.js — used by BOTH engines) gets the Column picker;
  both engines' criteria CRUD carries it; `evaluateCriteria` (the ONE shared
  evaluator) resolves each criterion against its column — multi-column payload value is an
  ARRAY, and the comparison branch follows the COLUMN's own kind.
  `getAllActivityMolecules` now returns multi-column molecules as ARRAYS (the contract
  shape), so read-back evaluation (bonus engine re-reads, audit, retro) sees the same
  shape as a live payload; both simulation pre-loaders build it too.
  `core/test_rule_criteria_columns.cjs` (17 asserts): a "col1=UA AND col2=42" bonus
  fails/passes correctly in the test rig AND fires on a real accrual; editor walk.
- **Page fixes (Bill's screenshot):** admin_input_template_edit.html Save/Cancel now
  in a fixed action bar — TWO stacked layout bugs found by MEASURING in a headless
  browser (page sized 100vh under the 48px fixed nav + missing flex min-height:0);
  the test asserts the Save button's pixels are inside the viewport. All three column
  pickers (display builder, input editor, criteria editor) read "number — column
  name" (column descriptions; col 1 falls back to the molecule label), single-column
  molecules included.
- **Also:** dead one-off `SQL/backfill_dominant_driver.js` deleted. Co-owner feedback
  recorded: Mark's note; Damian's TWO roadmap items (red-alert escalate-until-
  acknowledged ladder; participant-friction automation, consent-gated) → ACTIVE_WORK;
  a praising reply to Damian drafted in-chat for Bill to send. New memory
  `feedback_hold_the_contract` — the 4-stop lesson: implementation details conform to
  Bill's contract, never renegotiate it from code wrinkles.
- **Deploy note:** nothing pushed to GitHub or Heroku. Next `git push heroku main`
  carries Sessions 130–134 and applies **v96–v101**, on Bill's explicit go, CI first.

---

**SESSION 133 — evaluator directory (Stage 3) + molecule-tooling improvements, and
ERICA'S FEEDBACK ARRIVED (she loves it). All LOCAL-ONLY — nothing pushed to GitHub or
Heroku. Local SERVER_VERSION 2026.07.06.1338, DB v99, suite 64/1300 green, lint 0.
Heroku still 2026.07.02.2003 / v95 — the Erica bundle now deploys v96–v99.**

- **Vetted evaluator directory (Stage 3, db_migrate v99) — committed local `0033cd6`,
  NOT pushed.** `evaluator` table (licensing_board pattern + credentials, evaluation
  types, city/state for out-of-state, cost_low/high/notes for up-front cost disclosure)
  + 3 SAMPLE seeds; EVALUATOR member molecule (external_list → evaluator) on M composite
  + input template. Vertical module `evaluators.js`: staff CRUD `/v1/evaluators` +
  PUBLIC `GET /v1/evaluator-directory?t=` (anonymous, active-only, whitelisted). Staff
  page `admin_evaluators.html` (Program Settings → Evaluators), participant page
  `evaluator_directory.html` at public route `/evaluator-directory` + dashboard Try-It
  row. **Real bug fixed:** `/v1/code-context/:token` (S130 referral pre-fill) was never
  public → anonymous participants got 401 and the pre-fill silently died; now public.
  `insight/test_evaluator_directory.cjs` (35 asserts).
- **Molecule tooling (UNCOMMITTED at handoff-write time; committed with the handoff):**
  - **Composite auto-wiring** — new shared `molecule_composites.js`
    (`wireMoleculeToComposites`, pure SQL) called by BOTH `createMoleculeComplete` (create
    page) AND migrations, same params: `member_composite {required}` → M composite;
    `activity_composites [{activity_type, required}]` → per-type rows (required per type).
    Create page has a member Required tick + an activity per-type Applies/Required grid.
    D-only; validated up front; DELETE path now also cleans composite_detail rows (a gap
    the auto-wiring would otherwise have exposed). Create sequence: molecule → table →
    lookup/values → composite → COMMIT → prove-or-remove.
  - **Text molecules made column-aware** — `encodeMolecule` now dispatches on the SPECIFIC
    column's kind (columnOrder>1), so a text field is an internal-table lookup in ANY
    column (text_id in molecule_text / molecule_text_pool), not just column 1. columnOrder
    1 unchanged → every single-column molecule byte-for-byte identical. The round-trip
    prover no longer bails on multi-column text — it proves it.
  - **Page fix:** a Numeric Value column now offers only 2/4-byte widths (the page was
    offering 1/3/5, which the server correctly rejects).
  - `core/test_molecule_create.cjs` extended to 46 asserts (composite auto-wire member +
    per-type activity, reference-with-composite rejected, multi-column text PROVES).
  - Design note: `docs/MOLECULE_COMPOSITE_AUTOWIRE_DESIGN.md`.
- **⛔ PARKED (own fresh session): showing a MULTI-COLUMN molecule on the activity timeline.**
  Root cause found + written down: the activity-display FETCH query only reads the
  single-cell tables (5_data_1..5), so a multi-column molecule's values are never loaded
  for the timeline (text or not). The SAVE side is done + proven; the DISPLAY side is a
  change to the core timeline query every tenant uses — do it rested, with the whole query
  in view, not at the tail of a long session.
- **ERICA FEEDBACK (2026-07-06 email) — she ran Stage 1 end-to-end and loves it.** Two
  questions, both answered (working-as-designed, not bugs):
  1. *"After acceptance, should the participant show in the registry? I didn't see them."*
     — No, by design: **Advance resolves the review item, so it correctly leaves the open
     queue.** There is no separate "accept into program" activation yet — Advance just
     closes the review; it doesn't assign a clinic or start monitoring. That's the
     "entering the monitoring program" stage (not built). Unassigned participant shows in
     the all-participants view, not under a clinic filter.
  2. *"Does the screening tool create a registry item like a new participant does?"* — Not
     today (the Performance Profile creates no record); wiring screening→intake→registry
     reuses the exact review flow — future (Stage 2).
  - Requested: dashboard button **"Refer a participant" → "Invite a participant"** —
    **DONE (`2181dcd`)** across dashboard + clinic buttons + modal header (front-end only).
    She's sending a **second email** with more — hold/batch the deploy.
  - **A reply is drafted (in-chat) for Bill to send**; a suggested forward note to Joe +
    Mark (keep-in-the-loop) is drafted too.

**SESSION 132 — the instrument-assignment SCREEN built + the two display surfaces
adopted the assigned set (Stage 2 part 2 COMPLETE). Erica/Tom still quiet — nothing
received, nothing sent. All verified live: SERVER_VERSION 2026.07.04.1137, DB stays
v97 (no schema change), suite 60/1196 green, lint 0. LOCAL-ONLY — not pushed, not
deployed (the Erica bundle still waits on her feedback; deploy carries v96+v97).**

- **Instruments card on the participant chart (physician_detail.html):** regime badge
  ("Program default" / "Individual schedule") + takes-count when collapsed; Manage
  expands the tenant catalog (10 instruments for wi_php) with schedule, purpose,
  Takes-It state, and per-row Assign / Pause / Resume / Edit / Remove via the v97
  endpoints. First-assignment + last-removal regime warnings; the server's
  plain-English cadence rejection surfaces verbatim; every write refreshes the MEDS
  card (loadMedsStatus refactored from IIFE to named function; empty = hidden).
  Click-walked live end-to-end before Bill saw it — zero console errors, zero residue.
- **wellness.js:** missed-survey flag resolves through getExpectedInstruments — a
  participant who doesn't owe PPSI is never flagged; cadence override honored;
  one_time missed only until a completion ≥ start_date. Tenant-global cadence read gone.
- **exports.js:** chart-export MEDS section = the member's expected set (with mode).
- Test extended 28→42 asserts incl. a browser walk of the card. One preview-only
  artifact noted (NOT a code change): browsing via `localhost` instead of `127.0.0.1`
  breaks dashboard API cookies (dashboard hardcodes 127.0.0.1 as API base) — use
  127.0.0.1 in the browser, as always.

**SESSION 132 (wrap) — three small closers:** the Database Utilities clone/rename form
now lowercases entered names instead of rejecting capitals ("Bill" → "bill" — Postgres
folds database names; the page was refusing instead of fixing); the **docs truth pass**
(plumbing item 2, Bill's go) corrected 14 stale claims in ESSENTIALS + MASTER against
live code/DB (retired date helpers, "platformToday pending" → DONE, Unix-seconds note →
fixed at v55, 10-instrument catalog, notification delivery framework status, audit
user_link width v88, member_id retired + real activity storage shape, security section
brought to post-S121 reality, migration version now a pointer not a frozen "78");
and **access control is DESIGNED, not built** — `docs/ACCESS_CONTROL_DESIGN.md`, Bill's
users/groups/yes-no model, kernel-first-then-gates sequencing, build when the first
real gate is needed. ALL Session 132 commits pushed to GitHub at session end (CI green
— verify `git log origin/main..main` empty).

**SESSION 132 (evening) — COMPOSITE CLOSURE: the accrual contract enforced both ways
(Bill's design check → one real gap found and closed). SERVER_VERSION 2026.07.04.2042,
DB v98, suite 63/1254 green, lint 0. LOCAL-ONLY.**
Bill's spec: the add-activity process must (1) error when a required composite molecule
is missing, and (2) error on any data that isn't in the composite. Audit result:
(1) was already built; (2) was NOT — unknown payload fields were silently discarded
(never stored, but the caller was told "success"). Now:
- **Closure check** in POST /v1/members/:id/accruals: every caller-sent field must be a
  composite molecule or a DECLARED carry-only context key; strays → plain-English 400
  naming them. Judged on the raw payload BEFORE the data-edit function and custauth
  PRE_ACCRUAL (tenant hooks stay free to add pipeline fields). Direct MEMBER_POINTS →
  400 with "send base_points" guidance.
- **db_migrate v98** — sysparm `accrual_context_keys` declares wi_php's three carry-only
  keys (DOMINANT_DRIVER / DOMINANT_SUBDOMAIN / PROTOCOL_CARD — the PPII recalc self-POST
  carries them to createRegistryItem; they have no molecule_defs and are never stored).
  Adding a context key for any tenant = an INSERT, never code.
- **Failed calculations are never silent now:** a required calculated molecule that fails
  kills the accrual with a plain-English error; an optional one is skipped with a loud
  console.error (was: silently absent from the activity).
- **No-spoof verified:** client-sent AIRCRAFT_TYPE 'ZZZZZZ' → server stored its own
  calculation ('B738'). New `core/test_accrual_composite_contract.cjs` (15 asserts).
  Full suite proves every existing surface/pipeline was already composite-clean.

**SESSION 132 (later) — DELTA UI TEST COVERAGE (the "what's fragile" item, closed) +
a real bug it caught on first run.** Two new browser tests (Bill's go, plumbing while
Erica is quiet):
- `delta/test_csr_ui_walk.cjs` (19 asserts) — the daily CSR path in a headless browser:
  csr_member.html timeline renders via display templates, efficient/verbose toggle
  actually swaps content, bonus green block present, profile tab populates (lazy load),
  points tab totals; point-summary.html bucket rows + totals; and add_activity.html
  **posts a real flight through the template form** (ORIGIN/DESTINATION typeaheads with
  exact-match auto-select, CARRIER select pinned to DL, generic fill for the rest) —
  POST /accruals 201, redirect back, activity count grows. DB mutation wiped by restore.
- `delta/test_admin_pages_render.cjs` (24 asserts) — 24 core admin list pages must
  render real content with ZERO console/page errors and no bounce to login/unauthorized.
- **Real bug found+fixed:** `admin_users.html`, `admin_user_edit.html`, `admin_clone.html`
  each loaded lp-header.js TWICE (a head-level copy with area 'admin' + the canonical
  bottom pair) — the head copy ran before auth.js existed, triggering lp-header's dynamic
  auth.js inject alongside the static tag → "Identifier 'Auth'/'LPHeader' has already
  been declared" console errors on every load. Head-level duplicates removed (HTML-only,
  no server change). Note admin_user_edit.html is also the Insight staff-assignment
  surface, so Insight benefits too.

---

**SESSION 131 — a waiting day (Erica/Tom quiet over the July 4th weekend) spent on
plumbing that does NOT widen the Erica gap, per Bill's direction. Three things landed,
all verified live: SERVER_VERSION 2026.07.03.2200, DB v97, suite 60/1182 green, lint 0.
ALL Session 130+131 commits are ON GITHUB (through `734dc30`, both CI runs green —
local == origin, verified at session end). Heroku unchanged
and deliberately BEHIND (2026.07.02.2003 / DB v95) — the Erica bundle still waits for
her feedback and deploys v96+v97 together with an announcement email.**

- **Migration pacing always on (`83e96ea`):** the Session-130 per-version display no
  longer hides behind terminal detection (Bill updated older DBs and saw no pauses);
  CI opts out explicitly via `MIGRATE_NO_PAUSE=1` in ci.yml. Already-applied versions
  never paused and still don't — a current DB finishes in <0.1s.
- **Molecule Tier-1 hardening (`38e5f42`):** ONE creation routine,
  `createMoleculeComplete` (`POST /v1/molecules/complete`) — one transaction creates
  definition + lookup rows + values (explicit per-molecule value_ids) + the storage
  table if missing; validates every MOLECULES.md §5 invariant up front in plain
  English; **proves a real-path round-trip and removes the molecule if the proof
  fails**. Admin create page = one call (five-call sequence gone); migrations call the
  routine directly — CI's from-scratch replay guards routine evolution (agreed: no
  frozen/versioned per-migration SQL; revisit only for uncontrolled environments).
  `core/test_molecule_create.cjs` (35 asserts incl. browser walk). MOLECULES.md §6
  documents it; §1/§11 caught up (parent generalization is BUILT).
- **Instrument assignment plumbing (`9a84528`, db_migrate v97):** `member_instrument`
  — per-participant who-takes-what-when, mirroring member_compliance. No rows =
  today's owes-every-cadenced-survey (deploy-day safe); any rows = owes exactly the
  active assignments; fully paused = owes nothing; `one_time` = screening-at-intake
  (due once from start_date, satisfied forever by a completion on/after it — connects
  PHQ-9/GAD-7 to MEDS). MEDS resolves through `getExpectedInstruments()` at all four
  sites. Endpoints `GET/POST/PATCH/DELETE /v1/members/:id/instruments` (writes recalc
  MEDS next-due). `insight/test_instrument_assignment.cjs` (28 asserts).
  **NEXT SESSION: the assignment screen** on the participant chart + wellness.js/
  exports.js display surfaces adopt the helper (they still show the tenant-global set).
- Design decisions recorded in ACTIVE_WORK: default regime = today's behavior (Bill);
  who-may-assign deferred until role enforcement exists (nothing enforces per-position
  permissions anywhere yet); per-track assignment templates wait on Erica's protocol
  answers (plumbing now, valves later).

---

**SESSION 130 — the REFERRAL LOOP CLOSED (QR referral pre-fills the Performance Profile)
and the INSTRUMENT LIBRARY OPENED (Stage 2 part 1: PHQ-9 + GAD-7, catalog metadata, the
PHQ-9 self-harm alert chain). Both verified live end-to-end and browser-walked from login:
SERVER_VERSION 2026.07.03.1217, DB v96, suite 58/1119 green, lint 0. Both commits
LOCAL-ONLY (not pushed, not deployed) — Bill's decision: wait for Erica/Tom's review-queue
feedback, then bundle referral loop + their refinements + the instrument library into ONE
visible push with a strong announcement email.**

- **Referral-code consumer (`4a38932`, no DB change):** `/p/:code` now forwards carrying
  ONLY the opaque token (`?c=`) — the Session-124 placeholder that put referral details in
  the query string is gone. New public read-only `GET /v1/code-context/:token` returns the
  whitelisted context fields without consuming a use; the Performance Profile pre-selects
  the matching referral chip + shows the affiliation; any failure degrades to the blank
  form. `test_codes.cjs` 20→35 assertions incl. a browser walk.
- **Instrument library part 1 (`a5a71cf`, db_migrate v96):** PHQ-9 + GAD-7 (public domain)
  seeded as data + `scorePHQ9.js`/`scoreGAD7.js` on published bands. **Safety chain:**
  PHQ-9 item 9 (own PHQ9_SI category) positive → PHQ9_SI_POSITIVE signal → PHQ9_SI_ALERT
  bonus → RED registry item, 24h SLA. Catalog metadata `instrument_purpose`/`license_status`
  on survey + badges on admin_surveys.html (anchor licensing "To confirm" — Erica's call).
  Screening = cadence NULL = MEDS-exempt. New `test_instrument_library.cjs` (25 assertions).
  Migration runner now paces applied versions on a TTY ("Starting Version X" … hold …
  "complete" … hold; `MIGRATE_NO_PAUSE=1` escape).
- **Next Erica asks (send with her feedback exchange):** proprietary instrument picks +
  licensing (MCMI-IV…), anchor-battery license labels, GAD-7 alert thresholds.
- Full session detail: `ACTIVE_WORK.md` + Insight Build Notes.

---

**SESSION 129 — shore-up CLOSED (6 items), POSITION/POSITIONCLINIC PARITY (v92), and the
POSITION/CLINIC ASSIGNMENT SURFACE BUILT + PROVEN (the first user-parent molecule write —
byte-verified round-trip). Erica's Stage-1 routing answer recorded. All verified live:
SERVER_VERSION 2026.07.02.0826, DB v92, suite 56/1038 green, lint 0. Everything LOCAL-ONLY
(not pushed, not deployed). Deploy decision: hold the Erica deploy until the review queue
ships (classification+segmentation alone aren't tangible enough for her).**

- **Assignment surface (later in Session 129):** generic endpoints
  `GET/POST/DELETE /v1/users/:id/molecule-rows/:key` (admin gate, own-tenant, parent_bytes=4
  guard, dup 409) + a data-driven assignments section on `admin_user_edit.html` (position
  dropdown from the shared list; clinic via partner-first→program, Erica's known flow;
  borrowed-list owners excluded). Round-trip proven at byte level on the recreated pair;
  browser-verified end to end before Bill saw it. New test
  `insight/test_user_positions.cjs` (20 assertions). Detail in ACTIVE_WORK.md.

- **v92 — POSITION/POSITIONCLINIC parity (the Session 128 plan, executed on Bill's go).**
  Deleted the UI-created pair (145/147) + dropped `4_data_1`/`4_data_12`, recreated ALL of it
  in the one migration: definitions (new ids 149/150, parent_bytes 4), column defs
  (POSITIONCLINIC col 1 **borrows POSITION's list** via `list_source_molecule_id`), the 3
  POSITION values (explicit value_id 1–3), both storage tables + indexes. Resolved by
  **molecule_key** — this migration is how the pair reaches Heroku at deploy. **Round-trip
  re-proven on the recreated pair:** encode MEDDIR→2, decode 2→MEDDIR, POSITIONCLINIC values
  resolve through the borrow pointer. Tables empty (nothing writes user-parent rows yet).
  **Shape decision (Bill):** stay position+clinic (12); real use decides if the health-system
  level (122) is needed — shape can still change locally before deploy.

- Items 1–5 (code): molecule DELETE cleans its `{n}_data_*` storage rows (proven with a
  planted row); create-flow step-2 failure surfaces instead of a false success; GET
  /v1/molecules/:id + all five groups endpoints tenant-gated (`moleculeGroupTenantGate`,
  proven blocked cross-tenant both directions); Test modal errors on missing session tenant
  (no more silent tenant-1); locked column defs labeled by-design on the edit page.
- Item 6 (migration, Bill's go): **db_migrate v91** deletes orphan molecule definitions
  ML_RISK_LEVEL + ML_CONFIDENCE (wi_php, by molecule_key — they exist on Heroku from v49,
  so the migration cleans both environments). The S128 audit note's "seeded display-template
  line referencing them" was STALE — no such line exists.
- **Erica's Stage-1 routing answer (2026-07-01):** registration reviews are
  **Case-Manager-first, escalate to Medical Director** — default + configurable. Recorded in
  ACTIVE_WORK; unblocks review-queue routing once positions land.
- **Correction to the Session 128 notes:** Sessions 127+128 commits ARE on `origin/main`
  (pushed after session end; verified `git log origin/main..main` empty at 129 start).

---

**SESSION 128 — molecules-on-users foundation BUILT (steps 1–3 + shared lists), first two
4-byte-parent molecules created via the UI, and a hard day of molecule-admin-page repairs.
ALL LOCAL-ONLY — nothing pushed to GitHub or Heroku. Every claim below verified live at
session end: SERVER_VERSION 2026.07.01.2251, DB v90, suite 55/1018 green, lint 0.**

- **v88 — user link widened 2→4 byte.** Exactly 6 columns smallint→integer
  (`platform_user.link` + `audit_log_1..5.user_link`); link tank untouched (allocator just
  increments — verified); no FKs on `link`. Audit who-did-what join re-verified after.
- **v89 — the molecule engine routes by parent key size.** `molecule_def.parent_bytes`
  (1–5, DEFAULT 5) + `getDetailTableName(parentBytes, storageSize)` → `{n}_data_*`. All 92
  pre-existing molecules default to 5 — byte-for-byte unchanged. p_link type follows parent
  bytes (odd→CHAR, even→numeric), stored raw; only value columns encode.
- **v90 — shared internal lists.** `molecule_value_lookup.list_source_molecule_id`: a list
  column can borrow another molecule's value list (one list, no double entry, can't drift).
  `resolveListSourceId()` applied at the chokepoints (encodeMolecule / decodeMolecule /
  GET values); value ADD/EDIT/DELETE **rejected** on a borrower (no shadow copies). Admin
  column type "Internal List — use another molecule's list" + source picker; borrowed values
  render read-only. **Round-trip PROVEN** via throwaway borrower (values read from source;
  encode MEDDIR→2; decode 2→MEDDIR; shadow-write rejected; cleaned up).
- **Two-box fix (rules criteria).** `/v1/molecules/by-source/:source` now decides the side
  from `attaches_to` (was single-valued `context`, so both-ticked molecules never showed on
  the member side). Delta's BT + SEAT_TYPE now appear on BOTH sides; system/tenant molecules
  still excluded. Checkbox label reworded: **"Used in Rules Criteria for:"** (Activity /
  Member, independent; both-off = not a rule field).
- **Molecule admin pages repaired (every page Bill touched today was broken):**
  (1) UI-created molecules never got `value_kind` on the header → reopen couldn't show List
  Values and the values endpoints rejected them ("not a list molecule") — column-def save now
  syncs col-1 kind to the header, and GET falls back to col-1; (2) `saveInternalListValues`
  existed but was NEVER CALLED — "+ Add Value" silently dropped everything — now wired into
  save; (3) the list page hid any molecule with empty attaches_to (non-rule molecules looked
  deleted) — non-rule molecules always show now; (4) legacy molecules (blank `column_type`)
  rendered TYPE "–" with no lookup-config gear — display now derives from value_kind etc.;
  (5) checkboxes load from `attaches_to` only (no more phantom Member tick); context saves
  as `'none'` when neither box ticked; (6) parent-size picker (1–5) on the edit page drives
  `{n}_data_*` + create-table; (7) list page: SIZE/PARENT/DETAILS collapsed into one
  **STORAGE** column (`4_data_12` style).
- **Created via the UI on wi_php (Bill driving):** **POSITION** (mol 145, internal list on
  the 4-byte parent, `4_data_1`, values Case Manager / Medical Director / Clinician —
  saved + verified in DB) and **POSITIONCLINIC** (mol 147, `4_data_12` created: col 1
  borrows POSITION's list, col 2 → `partner_program` ref). **POSITIONCLINIC is NOT
  round-trip-proven** — nothing writes user-parent molecule rows yet (the assignment
  surface is the next build) and **Bill's 12-vs-122 concern is open** (see ACTIVE_WORK) —
  no real data into `4_data_12` until settled.
- **Molecule-admin audit run (agent, findings verified where stated):** real items on the
  shore-up list in ACTIVE_WORK — DELETE molecule orphans storage-table rows (verified in
  code); create-flow step-2 failure swallowed (console.warn + success alert); GET
  /v1/molecules/:id + groups endpoints missing tenant check; Test modal tenant-1 fallback;
  "columns locked on existing molecules" is by design but unlabeled; plus two orphan
  definitions **ML_RISK_LEVEL / ML_CONFIDENCE** (no columns, no data, no code references —
  abandoned design; one seeded display-template line still points at them).
- **Deploy math changed:** Heroku deploy now carries Sessions 126+127+128 —
  `git push heroku main` then `heroku run --app hdwhf "node db_migrate.js"` applies
  **v85→v90**, restart, verify. On Bill's go only.

**SESSION 127 — WisconsinPATH Stage 1 dashboard segmentation by referral source (SHIPPED to
`origin/main`? NO — local commit `4c829d2` only; verify `git log origin/main..main`). CI-clean,
DELIBERATELY NOT on Heroku (rides the post-demo deploy with Session 126).**

- **Dashboard segmentation by referral source (local `4c829d2`).** `GET /v1/wellness/members` now
  attaches each member's `REFERRAL_SOURCE` as `{code,label}` (two-layer molecule read
  `getMoleculeRows` → `decodeMolecule`, wrapped so a bad value can't break the list; `decodeMolecule`
  exposed on `ctx.molecules`). `dashboard.html` has a new **"By Referral Source"** tab in Program View
  (mirrors "By Licensing Board") + search. `SERVER_VERSION` **2026.06.30.2246**. **No DB change** —
  reads the Session-126 molecule (DB stays v87). Verified: live round-trip, tab renders on real data,
  lint 0, `test_referral_source` 9/9.
- **Molecule admin — dropped the "attaches to at least one" requirement (local `e13a4c4`, front-end
  only).** `admin_molecule_edit.html`: removed the validation gate + the required `*` + the "select
  at least one" help text on the Attaches To field. First tiny step toward molecules on other parents.
- **NOTE: `4c829d2`/`e13a4c4` + the design-doc commits are LOCAL-ONLY** — nothing pushed to
  `origin/main` (push on Bill's go). Local is ahead of both origin and Heroku.
- **Design DONE + APPROVED — molecules-on-users (the review-queue foundation). Build NOT started.**
  Source of truth: **`docs/MOLECULE_PARENT_GENERALIZATION.md`** (+ `MOLECULES.md` §11/§1). Direction:
  "a person is a person"; domain roles = `(role, clinic)` molecules **on the user** (`4_data_*`,
  `p_link integer`); login stays a separate keycard; tenant + access-tier stay explicit fields (not
  molecules); rules-engine participation becomes an explicit molecule flag. **NEXT STEP:** the data
  migration — widen the user `link` 2→4 byte via `db_migrate.js`, exactly 6 columns smallint→integer
  (`platform_user.link` + `audit_log_1..5.user_link`), **link tank untouched**, no FKs on `link`.
  Schema change touching audit — **get Bill's go before applying.** Full plan + the remaining moves
  in the design doc / `ACTIVE_WORK.md`.
- **Verified current-state fact (corrects an earlier in-session claim):** a login (`platform_user`)
  is **NOT attached to a member** today — its `link` is the login's own id, not a member pointer;
  the session carries only `userId`/`tenantId`/`role`; and `role` is CHECK-constrained to
  `superuser`/`admin`/`csr`, so clinical titles can't live on a login. Logins and members are
  disconnected (one fragile display_name bridge in notification routing). See `ACTIVE_WORK.md`.

---

**SESSION 126 — WisconsinPATH Stage 1 `REFERRAL_SOURCE` molecule + the real internal-list
bug + molecule-doc overhaul. All on `origin/main`, CI-gated, DELIBERATELY NOT on Heroku
(Dr. Stadler demo is 2026-07-01 — deploy after).**

- **`REFERRAL_SOURCE` member molecule (db_migrate v85+v86)** — the first real piece of
  WisconsinPATH Stage 1: how a participant entered the program (Self-referral / Employer /
  Board-mandated), an internal-list on the member (`attaches_to='M'`). Drives dashboard
  segmentation, safe-haven status, board-reporting eligibility. Registration lifts
  `referral_type` from the referral `code` row's JSONB into this molecule (JSONB carries;
  molecule queries + drives behavior). v85 = molecule_def + the mandatory
  `molecule_value_lookup` row + 3 values + member composite-M; v86 = added to the M input
  template so it shows/edits on the participant profile. Round-trip verified by
  `tests/insight/test_referral_source.cjs` (9/9).
- **The real molecule bug, fixed at the root (db_migrate v87 + pointers.js).** Internal-list
  values store a PER-MOLECULE 1-127 code (the `value_id`) squished into a 1-byte cell, but
  `molecule_value_text.value_id` DEFAULTS to a GLOBAL sequence (now past 127). Any list
  seeded via a raw INSERT (bypassing the first-available allocator) got value_ids >127 that
  silently overflow the byte on save → reads come back empty. Fix: (1) shared
  `allocateListValueId()` — the one place list codes get numbered; `POST /v1/molecules/:id/values`
  routes through it; (2) clone path preserves `value_id`; (3) static-text path pins it;
  (4) v87 renumbers the 3 lists that had already overflowed — `REFERRAL_SOURCE`,
  `EXTENDED_CARD`, `STATE`(t5), all ZERO stored rows so nothing re-mapped — to per-molecule
  1..N, then adds `CHECK (value_id BETWEEN 1 AND 127)` so a bad insert fails loudly.
  Full suite 55/1018 green, lint 0.
- **Molecule documentation made bulletproof + consolidated.** New **`docs/MOLECULES.md`** is
  the single source of truth (mechanism, per-type recipes, silent-failure invariants,
  helpers + never-raw-SQL, verified exemplars — FARE_CLASS/ACCRUAL_TYPE/REFERRAL_SOURCE/
  LICENSING_BOARD/PASSPORT; STATE is NOT an exemplar — and the MANDATORY round-trip
  verification). `master §2` and `essentials §2` gutted to a framing paragraph + pointer
  (no duplicated mechanism to drift). Reachable from the spine: `START_HERE`,
  `BEFORE_YOU_WRITE`, essentials §2, master §2, and the loyalty-platform skill all route to it.
- **Why the deep-dive:** `REFERRAL_SOURCE` failed its round-trip; tracing it to ground
  surfaced the value_id-overflow bug and the fact the docs were descriptive-not-operative.
  The doc overhaul is the durable fix so no future session repeats it.
- **Local is now AHEAD of Heroku and not deployed:** local SERVER_VERSION 2026.06.30.2101,
  DB v87; Heroku still v98 / DB v84 / SERVER 2026.06.29.1120. Deploy (push heroku + `node
  db_migrate.js` to apply v85→v87 + restart) is a post-demo step, on Bill's go.

---

**SESSION 125 (afternoon) — Refer-participant workflow + WisconsinPATH master plan.**
- **Refer-participant feature (`bb200a8`, deployed Heroku v98, DB v84) — LIVE, Bill
  click-tested "looks good."** The first real consumer of the Session-124 `code`
  table. A "👥 Refer participant" button on the program dashboard (Program Overview
  header) + the clinic roster (action row) opens a panel (referral type:
  self/employer/board-mandated · affiliation · optional track · single-use toggle),
  mints a referral code via `POST /v1/codes` (tenant from session), and returns a
  shareable **link + QR** pointing at the Performance Profile front door — the live
  front door of **WisconsinPATH Stage 1**. Shared module
  `verticals/workforce_monitoring/refer_participant.js` (one place, both surfaces);
  reuses the `admin_codes.html` mint+QR pattern + vendored `/qrcode.min.js`. Context
  rides server-side in the code table, never in the QR. **Front-end only — no
  `pointers.js`, no `SERVER_VERSION`, no DB change.** Separate from the demo pages
  (zero risk to the 2026-07-01 demo; demo pages re-verified 200 after deploy).
  - **Still TODO (post-demo):** the *consumer* half — the Performance Profile reading
    the code to pre-fill — was deliberately deferred (it edits the live demo page).
    "Add observer" also deferred (needs the Stage-5 observer flow that doesn't exist).
- **WisconsinPATH master build plan (`docs/WISCONSINPATH_BUILD_PLAN.md`).** Jim's
  anticipated Wisconsin-program workflow → Erica's build requirements
  (`PI2_WisconsinPATH_Build_Requirements.docx`, her working doc) → one master roadmap
  + code-grounded gap analysis (an Explore-agent capability scan). **Key finding: the
  spec is solid but three items Erica marked "Configure"/exists do NOT exist —
  consent/release-of-information architecture (the 42 CFR Part 2 work, gated on her
  Q6), toxicology/lab orders, and OER activation (roadmap only).** Reusable across
  state PHP programs (Erica expects Washington crossover). Consolidated to ONE doc:
  the old `PERFORMANCE_PROFILE_OER_PLAN.md` is now a tombstone redirect;
  `ACTIVE_WORK.md` + `project_erica_tracking` memory point at the master.
- **Two emails drafted, both pending Bill to send:** the welcome/overview "live now"
  note, and the reply acknowledging Erica's WisconsinPATH spec.

---

**SESSION 125 (morning) — Erica overview/welcome updates + demo readiness fix (deployed,
Heroku v97, DB v84).** Front-end-only changes (HTML; no `pointers.js`, no
`SERVER_VERSION` bump), all on `origin/main` (`6ec3004`), CI-green, **live on
demo.primada.io**:
- **Demo readiness pass (`6ec3004`)** before the 2026-07-01 Dr. Stadler Zoom:
  drove the live Performance Profile end-to-end in a browser. Found + fixed a
  pre-existing crash — `showStep()` called `el("actions").scrollIntoView` but no
  `actions` element exists, so it threw a TypeError on **every** step transition,
  skipping `window.scrollTo(0,0)` + `updateNext()` (no scroll-to-top between the
  long PPSI/Foundations sections; Next-button counter not initialized on arrival).
  From the Session 122 build. Fix: drop the dead/broken line. Verified live: full
  run-through (welcome→intro→PPSI→Foundations→results) throws **0** errors and
  scores (PPSI 51/100). Overview + QR pages also checked clean.

The three Erica changes (`9962c8c`):
- Performance Profile **welcome** rewritten to Erica's wording (adds "…professional
  development" + a new "professional strength" paragraph; crisis box kept).
- Overview walkthrough: **OER section removed** + remaining OER mentions scrubbed,
  renumbered to a clean 5 sections (Mike/Jim are focused on PI² + screening for the
  funding approval; OER held for the Chris/Jim talk).
- Overview: new **"What PI² is"** band (Predictive Performance Intelligence
  Infrastructure) after the hero, from `PI2_Performance_Profile.docx`.
- Email to Erica drafted (welcome + overview updates) — confirm with Bill / send.

**⚠️ Side effect of this deploy — the Session 124 code table is now ALSO on Heroku.**
`git push heroku main` deploys *all* unpushed commits, so it carried `81c50f8` (the
code table, EXPECTED_DB_VERSION 84) along with the HTML. Heroku DB was at 83 → the
dyno crashed on the version mismatch at boot. Fixed with the documented step:
`heroku run "node db_migrate.js"` (applied v84 — `code` table created, Heroku-safe),
restart, verified site back up. **Heroku now release v96, DB v84, SERVER_VERSION
2026.06.29.1120.** The code table has no Erica-facing consumer yet — it just sits
there now, live but unused (its real consumer is still the "next work" below).
Lesson for next time: to ship ONLY the current commit, the prior GitHub-only commit
will ride along — expect it and plan the migration.

---

**SESSION 124 — general-purpose code table (now deployed in Session 125; see above).** The session's
last piece: a reusable code/voucher mechanism — the "real QR" pattern behind
referral/access codes. On `origin/main`, **CI-green, deliberately NOT on Heroku**
(no Erica-facing change yet; it's foundation with no live consumer):
- `81c50f8` — **`code` table (db_migrate v84)** — the platform's **first Tier-4
  (4-byte INTEGER link) entity**. First link `-2147483648` via `getNextLink('code')`.
  Public token is a 16-byte base58 random string (`gen_code.js` `generateCode` off
  `crypto.randomBytes`), kept SEPARATE from the link so the enumerable PK is never
  exposed. Columns: link PK, code token (unique), code_type, tenant_id, Bill-epoch
  start/end dates, max_uses/used_count, status, and a **JSONB `context`** for
  carry-only named-value pairs (JSONB not molecules — see `feedback_molecules_vs_jsonb`).
  Engine: `mintCode`/`resolveCode`/`consumeCode` (atomic used_count guard).
  Endpoints `POST/GET/PATCH /v1/codes` (tenant-scoped) + public `GET /p/:code`
  (resolve→validate→consume→302 to target w/ context as query params; generic 404
  otherwise). `admin_codes.html` = **internal maintenance tool** (mint/list/revoke +
  QR), on the main admin hub — NOT an Erica page; her real minting will be workflow
  buttons in the Insight surfaces later. Moved `qrcode.min.js` to project root (shared
  asset; a root page can't reference a `verticals/` path). `SERVER_VERSION`
  **2026.06.29.1120**, `EXPECTED_DB_VERSION` 83→**84**. Test `tests/core/test_codes.cjs`.
- **OER answers emailed to Erica/Tom** (the 8-question reply). Erica's remaining big
  asks (self-registration, participant portal, PHP linkage, observer accounts) are
  unbuilt and largely gated on **her privacy model — Q6, back on her + Chris + legal**.

**EARLIER SESSION 124 — Platform Overview walkthrough + unfroze Heroku deploys.**
Both on `origin/main`, CI-green, and **deployed to Heroku (release v95, DB v83)**:
- `226fde1` — **Platform Overview walkthrough** (`verticals/workforce_monitoring/overview.html`),
  the Dr. Stadler 2026-07-01 fallback/companion. Static public page at clean route
  `GET /overview` (mirrors `/performance-profile`); walks Insight → two instruments →
  OER monitoring → engine → roadmap, with a button to launch the live
  `/performance-profile` demo. Listed in the dashboard "New — Try It" section.
  DEMO-CONTAINED (no login, no PHI). `SERVER_VERSION` **2026.06.28.1754**. Also folded
  in the Erica/Tom answer: Tom thumbs-upped Foundations scoring → now final.
- `e940a2a` — **hotfix: collapsed RLS migrations v81/v82 to no-ops.** Deploying 124
  first surfaced a Session 123 landmine: code expects DB v83 but Heroku was still v80
  (S123 never deployed), and the catch-up migration **failed on Heroku at v81**
  (`must be a member of rds_password to alter passwords` — RDS forbids creating a
  login role with a password). Since v81→v82→v83 nets to zero, v81/v82 are now no-ops
  and v83 (already Heroku-safe, idempotent) is kept. Every environment now converges
  RLS-free at v83. **This permanently unfreezes Heroku deploys.** RLS design still
  preserved in `docs/RLS_BACKSTOP_DESIGN.md` + git (`b27ca88`).
- Incident note: the dyno crashed mid-deploy and was rolled back to v92 to keep the
  site up; after the hotfix it was redeployed (v95) + migrated to v83 + verified live
  on demo.primada.io (`/overview` 200, `/performance-profile` 200, version 2026.06.28.1754).
- **Heroku now matches local:** release v95, DB v83, `SERVER_VERSION` 2026.06.28.1754.

**NEXT WORK: still Erica's stuff.** Email to Erica/Tom (OER answers + the new overview
page) is drafted/pending — Bill said we'd handle it once the deploy was fixed (it is).
Then the referral-code→context table (the real-QR mechanism). See `ACTIVE_WORK.md`.

---

## PRIOR — Session 123

Last updated: 2026-06-28 (Session 123).

**SESSION 123 — built a database tenant-lock (RLS), then REMOVED it the same
session. Net effect on the platform: nothing changed except docs/tests. The
platform is back to its fast, pre-session state.** Two commits, both on
`origin/main`, both CI-green:
- `b27ca88` — built the RLS backstop (app_rls role + tenant_isolation policies on
  56 tables via db_migrate v81/v82; per-request connection pinning + `SET ROLE`
  enforcement in `pointers.js`, gated by `RLS_ENFORCE`).
- `06167e8` — **REMOVED it.** `pointers.js` restored byte-for-byte to its pre-RLS
  state; db_migrate **v83** drops the policies + `app_rls` role and restores
  member's original decorative RLS. Reverted because enforcement cost real write
  performance (accruals **1,056/s baseline → ~100/s enforced**; pinning pulled
  `getNextLink`'s counter UPDATE into the request transaction, serializing writes
  on one shared row) to guard a failure mode the platform already covers
  (code-level isolation + the Session 122 cross-tenant tests). Bill's call: not
  worth it for a demo with no live PHI.
- **Kept (zero cost):** the Session 121 hardening, the Session 122 cross-tenant
  regression tests, and `docs/RLS_BACKSTOP_DESIGN.md` as the record if real PHI
  ever lands. **Do NOT resume RLS** — see `ACTIVE_WORK.md`.
- **Heroku was never touched this session** — no RLS code ever deployed there, so
  zero production exposure throughout. (Heroku later advanced in Session 124 — now
  release v95, DB v83, SERVER_VERSION 2026.06.28.1754.) ⚠️ SUPERSEDED: this session's
  note said a future Heroku migration would "create then drop the RLS objects" — that
  was **wrong for Heroku** (v81 creates a login role with a password, which RDS
  forbids). Session 124 collapsed v81/v82 to no-ops to fix it.
- `SERVER_VERSION` **2026.06.28.1550**; **local DB at v83**; full suite
  **53/988 green** on the restored platform; lint 0.

**NEXT WORK: Erica's stuff** (her 8 OER questions; the Performance Profile / OER
build per `docs/PERFORMANCE_PROFILE_OER_PLAN.md`). Not RLS, not RBAC. See
`ACTIVE_WORK.md`.

---

## PRIOR — Session 122 (the baseline the platform is restored to)

Last updated: 2026-06-26 (Session 122).

**SHIPPED THIS SESSION (Session 122 — tests + docs only, NOT deployed, no
server/DB change).** The lock-in piece of the tenant-isolation backstop: real
cross-tenant regression tests that verify the Session 121 fixes by *attack*
(not just code review), plus the written plan for the database-level RLS net.

- **Cross-tenant lock-in tests** (2 new files, 33 assertions, all green):
  - `tests/insight/test_cross_tenant_isolation.cjs` — a tenant-1 (Delta) user is
    blocked from every tenant-5 (Insight) PHI/PII surface Session 121 scoped
    (member profile, survey answers by link, stability registry, MEDS, PPII
    history, member search, physician-annotation **write**); plus reverse
    direction (a throwaway tenant-5 csr, created at runtime + wiped by the
    snapshot restore, blocked from tenant-1). **Two-sided:** each attacker-404 is
    paired with an oracle call proving the resource is really there, so a pass
    means "blocked," not "absent"; a legit-control phase proves own-tenant access
    still works.
  - `tests/core/test_tenant_auth_gates.cjs` — keystone privilege gates:
    `POST /v1/auth/tenant` superuser-only (csr **and** admin blocked),
    `/v1/users*` admin-only with own-tenant confinement + forged-`tenant_id`
    ignored, `/v1/clone` superuser-only, + a superuser positive control.
- **RLS backstop design** — `docs/RLS_BACKSTOP_DESIGN.md`: verified the current
  DB lock is decorative (RLS only on `member`, not FORCEd, `app.tenant_id` GUC
  never set, app connects as a bypass superuser), the three footguns, and a
  staged reversible rollout + both-direction test gate. **Design only — no DB or
  code change.**
- **The "lighter lint" was deliberately dropped** — a grep for "tenant query
  missing `tenant_id`" can't distinguish safe from leaky here (globally-unique
  link IDs, helper-built SQL, ~885 query sites); it would be a meaningless green
  check. The regression tests are the reliable version of that gate.

`SERVER_VERSION` **unchanged 2026.06.25.1557**; **no DB change** (stays v80) for
the tenant-isolation work. Full suite **53 tests / 987 assertions / 0 fail**; lint 0.

**ALSO SHIPPED + DEPLOYED THIS SESSION (Session 122 — Heroku release v90,
front-end only).** Performance Profile QR demo for the Dr. Stadler meeting
(2026-07-01), the slice Tom scoped. A no-login, QR-reachable assessment
(PPSI + Foundations of Health) that scores on the device:
- `verticals/workforce_monitoring/performance_profile.html` — the assessment +
  scored result (stability tier, dominant lifestyle driver, matched resources).
- `verticals/workforce_monitoring/performance_profile_qr.html` — QR companion;
  target URL **derived from `window.location.origin`** (override `?base=`), never
  hardcoded — a per-environment value belongs to the environment, not sysparm.
- `verticals/workforce_monitoring/qrcode.min.js` — vendored QR generator (MIT).
DEMO-CONTAINED: in-page scoring, **nothing persisted, no account, no wi_php data
touched**. PPSI now scores the **live weighted way** (Option A, real wi_php
weights, `ppii_thresholds` bands → 0-100) per Erica's 2026-06-27 confirmation
("score like we have it built"); Foundations tiers as written (Erica approved).
The bigger build (self-registration, portal, observer/OER, PHP
linkage) sits behind Phase 0 foundation (RBAC + RLS).

**Then made it discoverable (release v91, `SERVER_VERSION` 2026.06.27.2010 —
`pointers.js` edited, no DB change).** The first cut was an orphan page nothing
linked to — which broke Erica's "log into the site and test it" pattern. Fixed
with clean public routes `/performance-profile` + `/performance-profile/qr` and a
data-driven **"New — Try It"** section on the Insight dashboard (`dashboard.html`)
— each item shows name, description, the clean URL, and Open + Copy-link, with the
URL built from `window.location.origin` (so on demo.primada.io it reads
`demo.primada.io/performance-profile`). Future features add one row to
`TRY_IT_ITEMS`. Verified live on demo.primada.io (v91): version 200, both clean
routes 200 no-login. So **Erica tests the normal way**: log in → dashboard →
New — Try It → Performance Profile. Plan/status:
`docs/PERFORMANCE_PROFILE_OER_PLAN.md`.

The one open tenant-isolation follow-up is executing RLS itself (its own
session — see `ACTIVE_WORK.md` + the design doc).

**PRIOR — Session 121 (deployed to GitHub + Heroku release v89).**
Tenant-isolation hardening, end to end — Bill's question was "are we in a good
place tenant-wise?" A three-agent isolation audit (core data layer / Insight
leakage / auth + session binding) found real cross-tenant access holes; it did
**not** come back clean. This session closed them. Two commits:

- `dd5de91` — **KEYSTONE + IDORs + admin writes.** `POST /v1/auth/tenant` now
  requires role=superuser (was the master key: any authenticated user could
  POST `{tenant_id:N}` and rebind their own session to another tenant). The
  tenant-resolution middleware (~L1804) now only honors a client-supplied
  `tenant_id` for superusers, so **`req.tenantId` is authoritative** platform-
  wide. Raw-link IDORs scoped to `req.tenantId` (`activities/:link/full`,
  DELETE `activities/:link`, `member-surveys/:link` GET — PHI). Admin
  UPDATE/DELETE-by-global-PK given a `tenant_id` predicate (signal_type,
  external_result_action, notification_rule, scheduled_job, bonus/promotion
  criteria, licensing_board, stability_registry, registry_followup,
  survey_note_review). Survey-admin family + notification-delivery (was
  param-first) + scheduled-jobs list switched to `req.tenantId`. SQL injection
  in `exports.js` compliance report (interpolated `member_id`) parameterized.
- `88821b1` — **RESIDUAL SWEEP + AUTH GATES + loose ends.** ~55 more handlers
  that sourced tenant from `req.body`/`req.query` switched to `req.tenantId`
  (config CRUD, member-scoped writes, PHI reads/writes incl. MEDS + PPII/PPSI
  history + physician-annotation create, **member + alias search which leaked
  PII cross-tenant**, notifications, reference reads). Two no-tenant-check
  IDORs scoped (`molecules/:id/column-definitions`, `audit/user-report`).
  **AUTH GATES** (these were UNGATED — any authenticated user, even a CSR,
  could create a superuser / reset passwords / clone tenant config): all
  `/v1/users*` now admin/superuser-only via a prefix middleware, with
  non-superusers confined to their own tenant + blocked from granting
  superuser; `POST /v1/clone` superuser-only. Loose ends: session cookie
  `secure` true on Heroku (`!!process.env.DATABASE_URL`; trust proxy already
  on), false for local/CI http; registry audit-history join pinned to
  `sr.tenant_id` (defense-in-depth — rows already tenant-scoped via the
  per-tenant entity link).

`SERVER_VERSION` **2026.06.25.1557**; **no DB change** (stays v80). Verified
live on Heroku v89: dyno up, version endpoint 200 with the new version, and
`/v1/users` + `/v1/clone` + `/v1/auth/me` all 401 unauthenticated. Full suite
51/51 (955 assertions), lint 0. One test updated: C22 (`test_ppsi_history`)
asserted the old "missing tenant_id → 400" contract; the endpoint now derives
tenant from the session, so the test asserts the new contract instead.

**NOT DONE — deliberately deferred (discussed + agreed with Bill):**
- **RLS backstop (fix #1).** Make the database enforce tenant isolation as a
  net behind the code, so a future forgotten filter is a harmless empty result,
  not a leak. RLS is currently **decorative**: enabled only on `member`, not
  forced; the connection role is a superuser that bypasses RLS; the
  `app.tenant_id` GUC is never set anywhere. High value (box holds real PHI)
  but **HIGH-RISK**: the pooled-connection GUC trap can *create* a leak, the
  non-superuser DB-role change can break migrations, and it's prone to
  "works locally / breaks on Heroku." Needs its own design + tests + a fresh
  session. **Cheaper alternative to weigh first:** a build-time/test check that
  fails the suite when a tenant query lacks its filter — most of the protection
  at a fraction of the risk.
- **Lock-in regression tests.** The fixes are verified by code review + the
  full suite staying green (no regression), **not** by a live cross-tenant
  attack (no non-superuser creds were used). A few "tenant A can't reach
  tenant B" negative tests would prove + freeze the fixes.
- Two tiny audit items already handled this session (cookie `secure`, registry
  audit join). No other tenant items outstanding besides the two above.

**PRIOR — Session 120 (deployed to GitHub + Heroku release v88).**
A whole-codebase "reasonableness audit" (five parallel sweeps: dates, fetches,
DB-access rules, tenant leakage, save flows/silent catches) followed by fixes
for everything it found. Destructive saves, silent catches, molecule SQL, tier
joins, and link allocation all came back **clean**. What wasn't clean:
- **Licensing-board extraction** (commit `3a1dc7c`). The six
  `/v1/licensing-boards` + `/v1/members/:id/licensing-board` endpoints were
  still in `pointers.js` — missed by Phase 6 and the 130/131 sweeps because
  the lowercase URLs never tripped the case-sensitive lint and 'licensing'
  isn't in its healthcare-terms regex. Moved verbatim to
  `verticals/workforce_monitoring/server/licensing.js` (registered in the
  vertical's `index.js`; `encodeMolecule` added to `ctx.molecules`). Pure
  relocation — only vertical pages call them, no callback bridge.
- **Date-shortcut fixes + lint upgrade** (commit `c446d5b`).
  `.toISOString().slice(0,10)` — the UTC-shift twin of the banned
  `.split('T')[0]` form, invisible to the old lint regex — replaced everywhere:
  pointers.js (7 sites), csr_member.html, point-summary.html/.js,
  simulation-modal.js, Insight wellness/scoring_history/exports, bootstrap
  seeds, and **7 Insight test files** (after 6 PM Central they submitted
  tomorrow's activity date — latent flake). Lint Pattern 2 now catches both
  spellings; `uploads/` added to SKIP_DIRS.
- **Fetch hardening** (commit `c446d5b`). 17 load-path fetch sites missing
  `r.ok` checks got them; physician_detail's loadActivities called `.json()`
  before checking `.ok` — reordered.
- **survey-take-modal.js** default tenant 5 → null (platform-shared files
  carry no tenant defaults).
- **Debris**: 10 stale `.claude/worktrees` copies (228MB) + 27 `claude/*`
  branches (every one verified 0 commits ahead of main) deleted; the one
  stale branch on GitHub (`claude/exciting-leakey`) deleted too.
- `ml/model_info.json` trained_at refresh committed (`0524088`) — test-suite
  ML retrains rewrite the timestamp; model itself unchanged.

`SERVER_VERSION` **2026.06.11.1433**; **no DB change** (stays v80). Verified
live on Heroku v88: dyno up, version endpoint 200 with new version.

PRIOR (Session 119, Heroku v87): admin-UI polish on the template/composite
admin pages (reversed Flight/Activity labels fixed, Member/Activity composites
split into two aligned cards). HTML-only.
All three changes are admin-UI only (HTML); no `pointers.js` / `SERVER_VERSION`
/ DB change. `SERVER_VERSION` stays `2026.06.07.1706`, DB stays **v80**. These
were polish on the template/composite admin pages — no automated test coverage
(consistent with the "No Delta UI test coverage" fragility note below).
- **Display-template admin labels — fixed reversed Flight/Activity wording**
  (commit `f36034c`). The Activity Display Templates listing + edit pages
  sourced their type labels backwards relative to the server's own convention.
  The server (`pointers.js` ~5694–5873) labels a type-`A` activity from the
  `activity_type_label` sysparm ("Flight" for Delta, "Stay"/"Accrual" elsewhere)
  and uses the generic word "Activity" as the umbrella. Now: listing **header**
  stays generic ("Activity Display Templates"); the type-`A` **row** reads
  "Flight"; the edit page **header** reflects the template's own type (Edit
  Flight / Edit Redemption…); the edit dropdown's `A` option reads "Flight".
  Shared `labelForType(code)` helper on both pages — nothing tenant-specific
  hardcoded ("Flight" always comes from the sysparm). Files:
  `admin_activity_display_templates.html`, `admin_activity_display_template_edit.html`.
- **Composites admin — member/activity visually separated** (commit `40a4ead`),
  mirroring the Activity Input Templates page. Split the single composites table
  into two cards: **Activity Composites** (all non-`M` types) and **Member
  Composites** (`composite_type 'M'`). Added a `.type-M` badge color (was
  unstyled). Generalized the page title ("🧩 Composites" / subtitle "…each
  activity type and the member profile"). Shared `renderCompositeRow()` helper.
  File: `admin_composites.html`.
- **Composites admin — column alignment** (commit `46a0603`). The two cards'
  columns didn't line up because they're separate `<table>`s under
  `table-layout:auto` (each sized to its own content). Fixed with
  `table-layout:fixed` + an identical `<colgroup>` on both tables (the single
  source of column widths; per-`<th>` widths removed). File: `admin_composites.html`.

Verified live on Heroku v87: `admin_composites.html` serves "Member Composites"
+ `table-layout:fixed` + `<colgroup>`; `admin_activity_display_templates.html`
serves the `labelForType` helper + generic header. Dyno up; version endpoint 200
(`2026.06.07.1706`); DB up.

PRIOR (Session 118, Heroku v86, DB v80 — still the current code/DB baseline):
Member Composites (`composite_type 'M'`) made the authority for tenant-specific
member molecule fields (db **v79** seeds M for Delta {PASSPORT} + Insight
{LICENSING_BOARD}); member enroll/update validate against the M composite at
`PUT /v1/member/:id/molecules`; member-enrollment duplicate-PK bug fixed by
consolidating the `member` link_tank to one global row (db **v80**). Full detail
in git (`9cf67d8`) + the Insight Build Notes.

**NEXT WORK:** none queued — `ACTIVE_WORK.md` at placeholder.

Don't trust this summary blindly — verify live: `git log --oneline origin/main..main`,
the deploy table below, and the chat title for the session number.

**Category 1**: the five healthcare-named endpoints Phase 6 missed
(3 survey-note-reviews, 2 physician-annotations) are out of `pointers.js`
and live in `verticals/workforce_monitoring/server/notes.js`, with the two
remaining platform-side table references bridged via verticalCallbacks
(getMemberNotes, recordSurveyNoteReview).

**Category 2 — ML scoring pipeline + exports — SHIPPED.** Architecture (b)
from `docs/history/HANDOFF_FROM_130.md`. What moved out of `pointers.js`:
- `gatherMemberFeatures` (the ~240-line PPSI/Pulse/compliance/MEDS/registry
  feature builder) → `verticals/workforce_monitoring/server/ml_features.js`,
  registered as `verticalCallbacks.getMemberFeatures`. `scoreMemberML` (generic
  ML plumbing — POST to ML service, store ML_RISK_SCORE molecule) STAYS
  platform-side and reads the callback with a null guard.
- Both export endpoints (`GET /v1/export/:report`,
  `GET /v1/export/participant/:membershipNumber`) → new
  `verticals/workforce_monitoring/server/exports.js`. Insight-only (called only
  from physician_detail.html + action_queue.html). `toCsv` moved with them;
  clinician/notes enrichments call the vertical's own getAssignedClinicians /
  getMemberNotes (now named exports) directly.
- Deleted the dead `ppiiStreamFetchers` registry (~115 lines) — nothing called
  `calcPPIIFromMember` at runtime.
- `/v1/ml/retrain` STAYS platform-side (generic SSE retrain plumbing); the
  Insight weight-bundle shape bridged to `verticalCallbacks.prepareRetrainWeights`
  (scoring_admin.js).
- 15 platform-side comments reworded to clear standalone PPII/PPSI/MEDS prose.

`pointers.js` dropped 27735 → ~26975 lines (-759).

**Verified by the agreed Category 2 falsifier, not by lint alone:** Part-B = 0
standalone `ppii/ppsi/meds` tokens in `pointers.js` (case-insensitive,
whole-word, COMMENTS INCLUDED) outside the BUILD_NOTES log; lint 0; full suite
48 tests / 924 assertions / 0 failures (server restarted on the new code with
PG env vars first — same DB-less gotcha as Category 1, handled up front). C14
CSV Export + Participant Chart Export exercise the relocated /v1/export routes;
C12 + C16 ML tests exercise the getMemberFeatures callback.

Lint count is 0 and the script is fail-on-match in the test runner. The lint
regex is case-sensitive — that is exactly what let the 5 Category-1 endpoints
slip (lowercase URLs) and why camelCase cache names (`ppiiStreams`) and
snake_case tables (`ppii_stream`) don't trip it. Don't treat lint = 0 as proof
of clean separation; the falsifier above is the real gate.

**Insight extraction from `pointers.js` is now functionally complete** — no
healthcare-named endpoints, ML feature gathering, or standalone PPII/PPSI/MEDS
tokens remain platform-side. Remaining Insight-coupled bits in `pointers.js`
are intentional, scoped-out: the cache loaders (query `ppii_stream` etc. — a
table/cache-rename migration, not in scope) and the survey-render math-version
branching.

---

## Deploy state

| Thing | Value |
|---|---|
| `origin/main` | Session 130–132 commits pushed (2026-07-04). **Session 133 is LOCAL-ONLY — NOT pushed.** Local is AHEAD of origin (verify `git log --oneline origin/main..main`). |
| Local-only commits | Session 133: evaluator directory (`0033cd6`) + the molecule-tooling/handoff commit. On Bill's go to push. |
| Last deployed app change (Heroku) | `ae4f4c1` — **Sessions 126–129 DEPLOYED 2026-07-02** (the full WisconsinPATH Stage-1 story). Verified live: version endpoint, public pages 200, DB v95, queue config present. |
| `SERVER_VERSION` (local) | `2026.07.06.1338` (Session 133 — text molecules column-aware) |
| `SERVER_VERSION` (Heroku) | `2026.07.02.2003` (**Heroku is BEHIND local** — Sessions 130–133 not deployed; the Erica-bundle deploy carries them + applies v96–v99) |
| `EXPECTED_DB_VERSION` (local code) | `99` (must match db_migrate `TARGET_VERSION`) |
| Local DB version | `99` (v99 evaluator directory — Stage 3; verified live) |
| Heroku DB version | `95` (the next deploy will apply v96–v99) |
| Heroku app name | `hdwhf` |
| Heroku URL | https://hdwhf-6e6c604bb3f3.herokuapp.com (custom domain: https://demo.primada.io) |
| Heroku release | `v98` (refer-participant) · v97 (crash fix) · v96 (Erica edits + code table) |

> **The code table now has its first consumer** — the refer-participant workflow (v98).
> The *consumer* half (Performance Profile reading the code to pre-fill) is still TODO
> (post-demo, since it edits the live demo page).

GitHub remote: `git@github.com:billjansen-ops/Loyalty-Demo.git`
Heroku remote: `https://git.heroku.com/hdwhf.git`

There is one branch: `main`. No feature branches, no worktrees.

---

## Test suite

- **63 tests total**, **all 63 passing / 1254 assertions** (last full run: Session 132,
  after the composite closure landed — `core/test_accrual_composite_contract.cjs`,
  15 asserts). Session 132 also extended `test_instrument_assignment`
  28→42 asserts (browser walk of the Instruments card) and added
  `delta/test_csr_ui_walk.cjs` (19 asserts — CSR path incl. posting a real flight through
  the template form) + `delta/test_admin_pages_render.cjs` (24 asserts — 24 admin pages,
  zero console errors). Session 131 added
  `core/test_molecule_create.cjs` (35 asserts — the one-call molecule creation routine
  + round-trip proof + browser walk of the create page) and
  `insight/test_instrument_assignment.cjs` (28 asserts — per-participant assignment +
  MEDS honoring the assigned set). Session 124 added `core/test_codes.cjs`
  (extended Session 130 for the code-context endpoint); Session 126 added
  `insight/test_referral_source.cjs`; Session 129 added
  `insight/test_user_positions.cjs` + `insight/test_registration_review.cjs`;
  Session 130 added `insight/test_instrument_library.cjs`.
- Session 122 added `core/test_tenant_auth_gates.cjs` (12 assertions — the
  privilege-escalation gates) and `insight/test_cross_tenant_isolation.cjs`
  (21 assertions — cross-tenant PHI/PII isolation, both directions, two-sided
  with oracle proofs).
- Session 120 added no tests but **fixed date construction in 7 Insight test
  files** — they built activity dates via UTC (`toISOString().slice(0,10)`),
  so runs after 6 PM Central submitted tomorrow's date (latent flake source,
  now local-date via `toLocaleDateString('en-CA')`).
- Session 118 added 3: `delta/test_member_composite_m.cjs` (PASSPORT + enroll/
  update required-field validation + template-reject + scoping),
  `insight/test_member_composite_m.cjs` (LICENSING_BOARD path + cross-tenant
  reject + scoping), `delta/test_member_composite_ui.cjs` (browser: PASSPORT
  renders on csr_member.html).
- The C12 ML Predictive Risk Scoring flake mentioned in earlier STATE
  revisions has not reproduced lately; if it returns, it's an existing
  intermittent (the "Valid risk label" assertion), not a regression
  from current work.
- Run: `node tests/run.cjs` for the full suite, or
  `node tests/run.cjs <manifest-path>` for a single test (e.g.
  `node tests/run.cjs insight/test_compliance.cjs`).
- Manifest: `tests/manifest.json` lists every test.
- Coverage: strong on Insight (wi_php), now decent on Delta after
  Session 127's 5-test smoke addition (bonus edit, promotion edit,
  molecule edit, typeahead, CSR green block grouping).

---

## Anti-pattern lint

`node tests/lint-anti-patterns.cjs` — fail-on-match grep-based detector.

**Current count: 0 matches.** Treat any non-zero count as a regression
to fix before commit.

The lint script is now flipped from report-only to fail-on-match
(exit 1 on any unsuppressed hit) AND wired into `tests/run.cjs` as a
Pre-flight step that runs before Step 1 (Verify Server) — fails fast
on any new anti-pattern before any database snapshot or test setup.

**Eight patterns enforced (Session 120 added 6–8 — the DB-access rules
that used to live only in docs):**
1. DST millisecond date math · 2. `toISOString().split('T')` **or
`.slice(0,10)`** (both spellings) · 3. `new Date('YYYY-MM-DD')` ·
4. healthcare terms in root files · 5. `verticals/` path in root files ·
**6. direct SQL against molecule storage tables** (use the helpers) ·
**7. raw `JOIN/FROM member_tier`** (use `get_member_current_tier()`) ·
**8. raw `link_tank` / `MAX(link)+1`** (use `getNextLink()`).
Patterns 6–8 are server-JS only, exempt the test suite (fixtures read
raw rows), and carry per-rule allowlists (`MOLECULE_SQL_ALLOW` /
`TIER_SQL_ALLOW` / `LINK_ALLOC_ALLOW`) naming the sanctioned data-layer
files — the helper layer (`pointers.js`), migrations, vertical scoring
hooks, and one-time backfill/seed scripts. Adding a file to an allowlist
is the conscious, reviewed act that keeps a *new* raw-access site from
landing silently. Self-tested Session 120: 0 on clean code, fires on a
planted violation of each. Still necessary-not-sufficient — grep can't
see a cleverly disguised bypass, but it catches the obvious ones, which
are what have bitten the platform before.

---

## Pending structural work

In order. Each step is mostly wasted without the next.

### 1. Delta-side smoke tests ✅ DONE (Session 127)

Five smoke tests added in `tests/delta/`:
- Bonus edit save preserves `bonus_result_id`
- Promotion edit save preserves `promotion_result_id`
- Molecule edit save preserves `value_id`
- Typeahead auto-selects on exact-code match
- CSR green block groups externals under parent bonus

These catch the destructive-save reverts, typeahead silent failures,
and CSR grouping regressions that Session 126 fixed by hand.

### 2. Extract Insight server code from `pointers.js` — ✅ FUNCTIONALLY COMPLETE

Design doc: `docs/INSIGHT_EXTRACTION_DESIGN.md`. Inventory:
`docs/INSIGHT_TOUCH_POINTS.md`.

| Phase | Status |
|---|---|
| 1 — Scaffolding + inventory | ✅ Session 127 |
| 2 — Molecule readiness contract + fail-closed auth | ⚠️ Session 127 SHIPPED, FAIL-CLOSED CONTRACT VERIFIED Session 130 (the original 127 version was a silent no-op for 4 sessions — see retrospective) |
| 2.1 — Scheduled-job framework gap fix | ✅ Session 127 |
| 3 — Compliance (9 endpoints + 2 job handlers) | ✅ Session 128 |
| 4 — MEDS (4 endpoints + 1 job handler + 2 helpers + 1 constant) | ✅ Session 128 |
| 5 — PPSI/PPII (13 endpoints + 1 platform import + 1 callback boundary) | ✅ Session 129 |
| 6 — Registry/Clinicians/Followups/Cards (15 endpoints + 2 imports + 1 job handler) | ✅ Session 130 core + Session 131 (5 missed endpoints) — see below |
| Post-6 round 1 — clinician helpers + Layer 3 test | ✅ Session 130 |
| Post-6 round 2 — createRegistryItem + scheduleFollowups + action handlers registry | ✅ Session 130 |
| Post-6 round 3 — 5 missed endpoints (physician-annotations + survey-note-reviews) | ✅ Session 131 (Category 1) |
| Post-6 round 4 — ML scoring pipeline + exports | ✅ Session 131 (Category 2) — arch (b): gatherMemberFeatures → ml_features.js (getMemberFeatures callback), both /v1/export endpoints → exports.js, dead ppiiStreamFetchers deleted, /v1/ml/retrain weight-shape bridged. Part-B = 0, suite green |

**Phase 6 endpoint extraction is now complete (Session 131,
Category 1)**: the five healthcare-named endpoints originally missed —
three `/v1/survey-note-reviews/...` and two `/v1/physician-
annotations/...` — now live in
`verticals/workforce_monitoring/server/notes.js`, and the two
platform-side references to the physician_annotation /
survey_note_review tables are bridged via verticalCallbacks
(getMemberNotes for the `/v1/export/:report` notes section,
recordSurveyNoteReview for the `/v1/member-surveys/:link/answers`
note-alert branch), each with a safe fallback. Their lowercase URLs
never tripped the case-sensitive lint regex — that is how they slipped
past the original "lint = 0 means clean" check — so this round was
gated on the explicit falsifier (0 endpoints, 0 table refs, lint 0,
suite 48/924 green), not lint alone. Category 2 was the final extraction
step and is now complete.

Success criteria (unchanged):
- Boot with WI_PHP disabled → Delta works end-to-end.
- Boot with WI_PHP enabled → Insight works end-to-end.
- `node tests/lint-anti-patterns.cjs` returns zero matches.
- Full test suite passes (Delta smoke tests + Insight + Core).

### 3. Flip the lint from report-only to fail-on-match ✅ DONE (Session 130)

Wired `tests/lint-anti-patterns.cjs` into `tests/run.cjs` as a
Pre-flight step that runs before Step 1 (Verify Server). The script
itself now exits 1 on any unsuppressed match (final `process.exit(0); //
report only` replaced with `process.exit(1)`; header banner updated).

### 4. Optional cleanup

The current cleanup work is documentation/trust work:
- keep the startup spine (`START_HERE.md`, `HANDOFF.md`, `STATE.md`,
  `WORKFLOWS.md`, `docs/BEFORE_YOU_WRITE.md`) aligned with live code
- continue curating archive duplication under `learnings/` and `20251215/`

---

## What's fragile right now

- **Heroku is dev/demo, not production.** No real users on it 24/7.
  That's why the deploy risk profile is "404 → fix → redeploy," not
  "user harm." Don't change that assumption without Bill's confirmation.
- ~~**No Delta UI test coverage.** A Delta-surface change ships on
  manual verification only.~~ **Closed Session 132.** Two browser tests
  now cover the Delta UI: `delta/test_csr_ui_walk.cjs` (the daily CSR
  path — member page tabs/timeline/toggle/green block, point summary,
  and posting a real flight through the template form) and
  `delta/test_admin_pages_render.cjs` (24 core admin pages must render
  with zero console errors). The sweep caught a real bug on its first
  run — see the Session 132 notes.
- **The Insight build notes**
  (`verticals/workforce_monitoring/tenants/wi_php/Insight_Build_Notes.md`)
  is Bill's narrative record across sessions. Append to it each session;
  don't rewrite history.
- **Migrations and Postgres sequences.** Member IDs from `member_id`
  sequence diverge between local and Heroku. Migrations that reference
  members must resolve by **name** (or membership_number), not by
  numeric ID.
- ~~**Pre-existing C12 flake.** The ML predictive risk test sometimes
  fails on "Valid risk label (got: Minimal)". Not session-blocking,
  but if you see it, that's the flake — not a regression caused by
  whatever you just did.~~ **Closed Session 130.** The test was
  rejecting `'Minimal'` even though the ML model legitimately emits
  it when training data is sparse. Fixed by accepting the label in
  `validLabels` rather than papering over with retries.

---

## Files that need careful handling

| File | Why |
|---|---|
| `pointers.js` | The platform server. Every edit needs `SERVER_VERSION` bump + `BUILD_NOTES` update + server restart. |
| `db_migrate.js` | All DB changes go here. Append-only — never edit a previously-applied migration. |
| `verticals/workforce_monitoring/tenants/wi_php/Insight_Build_Notes.md` | Bill's narrative record. Append; don't rewrite. |
| `docs/LOYALTY_PLATFORM_ESSENTIALS.md` | Bill's platform rules. Don't edit without his go. |
| `docs/LOYALTY_PLATFORM_MASTER.md` | Platform architecture doc. Same. |
| `docs/BEFORE_YOU_WRITE.md` | Anti-pattern reference. Update when you find a new pattern worth preserving. |

---

## Tenants — at a glance

| Tenant | Tenant ID | Vertical | Primary surfaces |
|---|---|---|---|
| delta | 1 | airline | `csr_member.html`, `bonus_test.html`, root admin pages |
| united | 2 | airline | Same as delta (shared surfaces) |
| marriott | 3 | hotel | Same root admin pages |
| ferrari | 4 | automotive | Same root admin pages |
| wi_php | 5 | workforce_monitoring | `verticals/workforce_monitoring/*` and tenants subdir |

Delta member used as a reference test member: **2153442807**.
Insight (wi_php) reference test member: see Insight Build Notes for
the engineered participants seeded by v49.
