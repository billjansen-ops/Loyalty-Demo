# ACTIVE WORK

## ▶ CURRENT (BI stream, 2026-08-05) — DEPLOY DONE; TEST SUITE PARALLELISED; MOLECULE DATE/TIME IS THE NEXT BUILD

**Code state: Local == GitHub at `0738395`, CI GENUINELY GREEN (run
31000870280, the CI workflow's own conclusion). SERVER_VERSION
2026.08.05.0231, DB v158 locally. HEROKU IS LIVE at 2026.08.04.2351 /
v158 — deployed this session, live-verified, and Bill confirmed his
login works again. Heroku is TWO COMMITS BEHIND local: `0d311ad` (a
Session 167 billing/run-stamps DESIGN DOC from a concurrent session —
docs only, rode along on this session's push) and `0738395` (the test
lanes + the ML-adoption server change). Neither is urgent: no
migration, nothing user-visible.**

**DONE this session:**
1. **THE DEPLOY (the login fix is live).** Heroku went 2026.08.02.2129 /
   v149 → 2026.08.04.2351 / v158; migrations v150–v158 applied cleanly
   (S166 monitoring stories, S167 clock + session fixes, BI point
   transfers v153 / corporate accounts v154 / link ordering v155 /
   molecule two-door v158). Erica-activity window checked clear first
   (last write 01:37 UTC). Bill verified his own login on live.
2. **THE FULL SUITE RUNS IN PARALLEL LANES — 10.5 min → 4.9 min local,
   13.6 → 6.8 on CI — and TESTS NO LONGER TOUCH THE WORKING DATABASE.**
   Each lane gets its own copy of the database + its own server. The
   snapshot that seeds them is a READ, so there is nothing to restore —
   the restore that destroyed the local DB on 2026-08-05 is off the path
   entirely, and Bill can work while the suite runs. Four real defects
   found and fixed at the cause: two servers fought over the ML engine's
   single port (a server now ADOPTS a healthy engine instead of spawning
   a second); lane databases were planned blind (ANALYZE after restore —
   without it, 2 lanes were SLOWER than none); the login page was loaded
   with waitUntil 'networkidle', both slow and fragile (now waits for the
   form — this is why individual tests got faster too); and two tests had
   NO fixtures of their own, reading other tests' leftovers on a tenant
   that ships with ZERO members (both now build their own and pass
   standing alone). Also: manifest order preserved WITHIN a lane, a
   manifest `lane_group` for genuinely coupled tests (the Delta
   member-1002 promotion family), per-test timings + slowest report, test
   filters/comma-lists, and the run holds the machine awake (idle sleep
   destroyed two full runs today and produced failures that looked real).

**THE NEXT BUILD — MOLECULE DATE/TIME (settled with Bill this session;
build to this, do not re-litigate):**

The molecule's contract is that you hand it the value as humans know it
and it stores our format. Dates do not honour that today: `value_type
'date'` exists (offered in the maintenance page, fixed at 2 bytes,
stored RAW not offset), but the engine does NOT convert — every caller
runs `dateToMoleculeInt` / `moleculeIntToDate` by hand and has to know
which of the two Bill-epoch schemes applies. `bigdate` is already NAMED
in the encodeValue/decodeValue contracts with no implementation.

- **Both types translate, both directions.** Conversion moves into
  encode/decode, once. A bare number is REFUSED loudly (not sniffed and
  tolerated — Bill's ruling: sniffing is permanent machinery to excuse a
  single caller, and it recreates the two-ways-to-do-one-thing trap).
- **The whole blast radius, verified:** `GROUP_REMOVED` is the ONLY date
  molecule on the platform (7 rows = same molecule once per tenant).
  **ONE write** (pointers.js:12316, passes `platformToday()` — change it
  to pass a real date). **Three JS reads** (pointers.js:12286, 12312,
  12769). **Four presence-only checks** that never read the value and are
  unaffected. **ONE SQL join** (pointers.js:12831, `moleculeJoinSQL`) —
  this is the second exit: it returns the stored number straight into a
  query result with no JS in the path, so it must convert on the Postgres
  side (`molecule_int_to_date` exists) or JS and SQL will disagree and
  the two-encodings trap simply moves.
- **The maintenance page** gains Date/Time beside Date, fixed at 4 bytes
  the same way Date is fixed at 2 (`COLUMN_TYPES` in
  admin_molecule_edit.html ~line 726), mapped to `bigdate` on save
  (~line 1816), labelled on read-back (~line 1415). The server column
  validator (pointers.js ~16741/16748) must accept `bigdate` or the page
  offers what the API rejects.
- **Round-trip proof on BOTH types is mandatory** (MOLECULES.md §7) — a
  wrong molecule returns nothing rather than failing.
- **Docs:** MOLECULES.md is the authority; add a pointer from
  BEFORE_YOU_WRITE's two-encodings section.

**WHY it matters now:** it is the foundation for PENDING TRANSACTIONS,
Ryan Douglas's requirement and Bill's design: a pending event is a
ZERO-POINT activity carrying a molecule of pattern `44` — column 1 the
pending points, column 2 the date/time it stops being applicable.
Pending points are NOT in the member's balance and NOT in the buckets
(Bill's ruling — nothing to net), so the molecule is display plus an
expiry compared at READ time, no sweep job. When the real event lands,
convert the activity in place (do not delete-and-re-add — it breaks the
audit continuity and the platform's own destructive-delete rule).

**BI WORLDWIDE — meeting Tuesday 2026-08-11, afternoon, Ryan Douglas
(CTO) + Gary Hansen:**
- **The requirements-to-platform map EXISTS and is good** — Bill's
  "High Level Requirements for Global Points Account - Pointers Response"
  (iCloud/BillJ/Primada/BIW, not in the repo). Claims were checked
  against the live platform this session and hold, with ONE exception.
- **FIX BEFORE TUESDAY:** the balances section says suppression from a
  statement is "a per transaction attribute carried by the molecule
  system", which reads as built. It is not: there is no suppression
  attribute, no molecule, and no view that would honour one. Replacement
  wording was given to Bill in the session chat (status becomes "In
  place; suppression is configuration plus a small read change"). Bill's
  own observation, worth keeping: statements are really the ONLINE
  transaction list now, which makes suppression a live operational need
  (hiding corrections and reversal/rebook pairs), not a legacy one.
- **Be ready for:** the doc says "runs on AWS with managed Postgres" —
  true, but via Heroku. If Ryan is asking about deployment into THEIR
  infrastructure that is a second question.
- **The two questions back to Ryan are the right two** (does "multiple
  currencies" mean points-by-program or financial currency; is the third
  taxable state transfer). Get them answered BEFORE Tuesday if possible.
  A third worth adding: does a suppressed transaction still count toward
  the balance (Bill's read, and mine, is yes — hidden, not erased).
- **STILL TO PREPARE: the demo script.** Bill's instinct is the shape:
  show Delta, then change ONE thing live, then Marriott running a
  completely different program on the same engine. The document's own
  argument is that the requirements list proves only that we are not
  disqualified — the demo should spend its time on the thing that is hard
  to copy.

**Smaller items parked:** lane runs show no live progress on screen (the
blind-wait complaint — worth fixing); 3 lanes might get under 4 minutes
(2 lanes now finish nearly balanced, so the remaining gain is small).

---

## ✅ PRIOR (Session 167, 2026-08-05 IST)

**Code state: EVERYTHING IS DEPLOYED. Local == GitHub == Heroku at
`5bad2e7`, CI GENUINELY GREEN (run 31031231082, the CI workflow's own
conclusion). Live SERVER_VERSION 2026.08.05.0758, DB v158 everywhere.
Deployed 2026-08-05 midday Central on Bill's go: the whole S167 backlog
(monitoring stories 1-3a, BI point transfers v153 + corporate accounts
v154 + byte-true link ordering v155, Rev 1.1 alignment v156,
session-expiry v157, molecule two-door v158, molecule date/time) plus
BOTH login fixes and the Network Directory card repoint. Live-verified:
version, dyno 200, 401 probe, the repointed card and its destination,
and Bill's chooser on the sign-in page. Erica had a live session
throughout and it SURVIVED the restart (DB-backed sessions + the v157
timestamptz fix). ✅ BILL'S LOGIN WORKS ON LIVE AGAIN — broken there
since the Aug 2 deploy, fixed now.**

**DONE this session:** (1) the LOGIN LOOP, both heads — the
no-home-program account shape (Bill's own) gets the program chooser;
landings probe for a real page (Delta → the platform menu); the shape
is IN THE GATE (test_login_no_home_program). (2) THE REV 1.1 ALIGNMENT
(v156) — Erica's revised spec built end to end: matrix cells,
unclassified strictly Tier 2 (AC-11), the D-13 superseded intersection
(AC-10 Blocking, AC-12), Part 2 refuses outright, MD-only break-glass
grants + role-aware screen + counts-only notification, the §7.3
protected audit log (leak check closed THREE doors incl. one broken
since birth) + new review door/screen, three per-program flags present
and off. (3) THE TWO-CLOCK FIND (v157) — see build notes S167 parts
2-3: one clock everywhere, session expiry made absolute (the
every-login-deletes-other-sessions landmine), lint Pattern 13.

**The queue, in order:**
1. **Heroku deploy on Bill's go** (CI already green; Erica-activity
   check → push → `heroku run node db_migrate.js` (v150→v157) →
   restart → live verify). User-visible: Bill's login works again;
   otherwise machinery sleeps (monitoring waits on paradigm config,
   access rules wait on Erica's flip).
2. **Story 3b — the daily check-in via the participant app** (channel
   approved by Erica 2026-08-04; docs/MONITORING_CORE_DESIGN.md §3;
   her rescheduling-rules document becomes the excusal-extension
   contract when it arrives).
3. **Queued small sweep:** ~20 test psql helpers still pass SQL through
   shell `-c` quoting — the 0x60/backtick class (intake_phase2 is the
   pattern: STDIN + SQL-escaped link literals).
4. **Bill decisions parked this session:** (a) the legacy promotion
   engine's 17 bare CURRENT_DATE sites (native DATE columns,
   PG-internal, self-consistent — flagged in BEFORE_YOU_WRITE);
   (b) whether Bill's account should keep the login program chooser or
   get a home program bound.
5. **Bill's side:** the two reply emails to Erica (final, in the S166
   chat); his Marvin availability week of 8/16 (Erica asked again
   2026-08-05; he is back in Central from India on the 9th, and Mon/Thu
   that week are the WPHP standing slots).
   ✅ **DONE 2026-08-05 — BOTH DOCUMENTS REQUESTED.** Bill emailed Erica
   accepting both offers: the RESCHEDULING RULES document (becomes the
   story 3b excusal contract: request/approve/deny events, per-week
   ceiling + what happens when compression exceeds it, travel as an
   out-of-area collection order rather than an excusal, extended absence
   to the MD for a documented monitoring-agreement change) and the
   RESULT STATE MACHINE document (the story 4 contract). The email
   flagged the results document as the more time-sensitive of the two
   (Tom's lab specs land in ~a week and the result record is what they
   land in), asked her to cover HOW THE MRO FUNCTION WORKS in practice
   (the MD, a separate program person, or a lab-provided service —
   it decides whether the review step lives in the platform or is
   recorded after the fact elsewhere), and told her rough notes are
   fine. **Now waiting on her two documents.**
6. **Watch:** Aug 13 orientation; master-list edition ~Fri Aug 7 (fold
   in: access rules done + confirmed + Rev 1.1 BUILT, monitoring stories
   1-3a); Marvin meetings week of 8/16; her rules-flip + inventory notes.
   **WPHP PRE-KICKOFF EXCHANGE (2026-08-03/05):** Erica sent the
   consolidated pre-kickoff update + monthly progress letter + her
   clarification questions to the WPHP team (Bundy/Reilly/Chow) with the
   full Zoom series booked. **Bundy replied 2026-08-05: "Looking forward
   to kickoff"; his team will answer the clarification questions before
   or AT kickoff (those answers unblock her held wish-list items —
   external stakeholder model, agreements, board information); Kellie
   out this week, SAMANTHA STARTING NOW** (her sandbox login exists and
   works — the S167 login loop only ever hit no-home-program accounts,
   i.e. Bill's). **Kickoff Aug 13 will scope RECOVERYTREK DATA MIGRATION
   and LAB INTEGRATION** — both are commitments with a joint assessment
   named (see the Washington section below), neither has ever been
   technically scoped by us. Expect real scoping work out of that
   meeting.
7. **THE CONSENT FRAMEWORK IS WITH COUNSEL (2026-08-05, Erica):** Damian
   sent it to his attorney Joe today. This is the gate on the largest
   waiting column — Part 2 downloads (currently refuse for every role,
   Rev 1.1's intended behavior), participant portal surfaces, messaging
   to any Insight member (the gate ships closed), external-party access
   (D-8), and the consent ARTIFACT object itself, which Erica's register
   says counsel confirms BEFORE it is built (her Q-8; D-14 sizes the
   scope field wide so it isn't rebuilt). Everything behind it is
   plumbed and waiting for a value or an object — nothing to build until
   Joe's read lands. Watch for it coming back through Erica/Damian.
8. **LAB VENDOR TRACK IS MOVING (Tom, 2026-08-05):** accounts APPROVED
   at Quest and USDTL, LabCorp pending; all three know we intend to
   integrate and are assembling their integration specs. Tom expects
   baseline integration information END OF THIS WEEK OR EARLY NEXT, then
   walkthrough calls. **Sequencing note for whoever takes those calls:
   THREE labs = THREE integrations (each its own format, transport, and
   certification cycle on THEIR calendar), and today the platform has
   nowhere to put a result — story 4 (toxicology results + the MRO state
   machine) is unbuilt and its spec is the document Erica offered to
   write. Manual result entry is the design's stated interim path
   (design doc §4/§8: lab integration is explicitly a post-kickoff
   project). Getting story 4 built while the specs arrive is what makes
   the integration work land on something.** Questions worth asking on
   those calls: transport and format; whether they support electronic
   ORDERS out (chain of custody / donor registration) or results only;
   what identifiers they key on; whether screen and confirmation arrive
   as separate events (Erica's state machine needs them separate); how
   long their test/certification cycle runs; and whether the MRO
   function is theirs or ours (Erica flagged MRO as a distinct role —
   may be the MD or a separate person, kept as data).

**S167 lessons for the record:** (1) an account shape no test logs in
with is an account that breaks silently — the gate only protects the
paths it walks; (2) when a fix fails twice, the third look goes UNDER
the symptom (the login loop, the two clocks, the session landmine were
one chain); (3) a suite red only in the IST morning is a timezone
telling you something.

---

## ✅ PRIOR (Session 166 FINAL wrap, 2026-08-04) — RAN TO COMPLETION in S167

**Code state: local is TWO COMMITS AHEAD of GitHub (`f922931` the
login-redirect-loop fix + `ea68b5b` the 401-interceptor consolidation —
client files only, targeted tests green, walked live). GitHub at
`ea0d82a`, CI GENUINELY GREEN there (run 30880693497; suite 103/3,115
incl. the BI session's point transfers v153). Local DB v153,
SERVER_VERSION 2026.08.03.2133 (the BI session's — pointers.js
untouched since). Heroku at 2026.08.02.2129 / v149; the next deploy
carries v150–v153.**

**The queue, in order:**
1. **THE REV 1.1 ALIGNMENT STORY — the next build (Bill's go given
   2026-08-04).** Erica's PI2_Document_Access_Rules_Rev1.1.docx
   (Downloads) supersedes as the access-rules contract; the full build
   delta is in wi_php/project_status/S166_Erica_Batch_Analysis_
   2026-08-04.md §1 (red-marked extraction: S166 scratchpad rev11.txt —
   re-extract from the docx if gone). The deltas: MD-only break-glass
   grants (PA revokes only; screen role-aware), §4 matrix cells
   (CM +S@T2, PA +U/H@T2, MD +S@T3, MD +D/H@org), unclassified
   strictly Tier 2 (kills the any-classifier upload; AC-11),
   superseded = V ∩ (MD/CM/S-holder) per tier (D-13; AC-12; AC-10 now
   Blocking), registrant docs = Tier 2 until-classified treatment,
   Part 2 downloads refuse entirely until the consent architecture
   (retire the interim Filed-consent-doc mechanism; columns stay),
   audit log = protected surface (MD+PA-only read door, reading is
   audited, leak check on existing endpoints), new present-and-off
   flags (caseload-only, immediate-release, prescriber-portal).
   Then FULL SUITE → push (carries the two pending login-fix commits)
   → CI → Heroku on Bill's separate go.
2. **Story 3b — the daily check-in via the participant app** (Erica
   approved the channel 2026-08-04; docs/MONITORING_CORE_DESIGN.md §3
   is current). Core only; the excusal extensions + result state
   machine WAIT for her two promised documents (they become the 3b/4
   contracts).
3. **Bill's side:** the two reply emails to Erica (final, in the S166
   chat); his Marvin availability week of 8/16.
4. **Watch:** Aug 13 orientation (sandbox ready incl. monitoring demo
   config); her WPHP kickoff email (carries her clarification
   questions); master-list edition ~Fri Aug 7 (fold in: access rules
   done + confirmed, monitoring stories 1-3a, Rev 1.1 received);
   Marvin meetings week of 8/16; her rules-flip + inventory notes.

**S166 late finds (the login loop):** login.html now VERIFIES the
session server-side before auto-forwarding (stale cache cleared, stays
on form); ONE global 401 interceptor lives in brand-loader.js (auth.js
twin deleted — census 109 vs 12 pages; do not re-add); sessions are
DB-BACKED — server restarts do NOT kill them, the TEST SUITE's
snapshot/restore DOES (rewinds the session table; why Bill's session
died). Local session table was cleared during verification — everyone
logs in fresh locally once.

---

## ✅ PRIOR (Session 166 wrap, 2026-08-03) — Bill in transit AMS → Bangalore

**The four-story ACCESS-RULES BUILD is COMPLETE and DEPLOYED (see STATE
S166): local == GitHub == Heroku at `c2a3802`+, DB v149 everywhere, CI
genuinely green (run 30784240724), full suite 100 tests / 2,997
asserts. Nothing user-visible shipped — every tenant stays mode 'open'
until Erica's flip. Both notes SENT (access-rules-built to Erica; WPHP
monthly update #1 via Erica). The S163 after-update-note question is
CLOSED (overtaken by events, Bill 2026-08-03).**

**The queue, in order:**
1. **THE MONITORING + TOXICOLOGY CORE — STORIES 1, 2, AND 3a ARE
   DONE.** Story 3a (excused absences, v152, commit `3216f3f`,
   test_selection_engine 41/41, walked live) is LOCAL-ONLY, not yet
   pushed — the excusal mark, quota re-roll, missed-sweep pointer
   clear, MD/CM rule via the role map, the calendar Excuse button.
   Stories 1-2 (commits `bb2cfb4` v150 + `c9e9c4a` v151;
   test_monitoring_core 32/32 + test_selection_engine 32/32, screens
   walked on the sandbox; docs/MONITORING_CORE_DESIGN.md is the
   settled contract — note §2b's build discovery: the paradigm engine
   is the new BRAIN inside the EXISTING RANDOM_DRUG_TEST body; legacy
   1-in-7 covers only paradigm-less members; flag §2b to Bill if he
   hasn't read it). Story 1 = sites + paradigms + temporal assignment;
   story 2 = the selection engine + Testing-tab calendar +
   nobody-sees-the-future enforced server-side. **STORIES 3-4 WAIT ON
   ERICA'S THREE ANSWERS** (sent 2026-08-03; check-in channel →
   story 3, positive-result review → story 4; excused-absence default
   re-roll). Story 5 = the sandbox acceptance walk after 3-4.
   **PUSHED AND CI GENUINELY GREEN: GitHub at `a7797d3`, CI run
   30800980652 (the CI workflow's own conclusion; suite 102/3,061 as
   the gate). The gate earned its keep three times: the Amsterdam
   badge-date catch + a test-order dependency (`ddb7cd5`), then the
   S165 migration-replay class found BOTH its doors — the copier's
   paradigm copy (`ad0413b`) AND the standup self-verify counting a
   not-yet-born table (`a7797d3`); one spurious GitHub-side
   cancellation re-run to green. NEXT: Heroku on Bill's separate go
   (carries v150+v151; nothing user-visible anywhere — the machinery
   sleeps until paradigms are configured; sandbox has demo config:
   STD24 + two fictional Seattle sites + Marcus Webb assigned + one
   for-cause selection dated 2026-08-03).
2. **Waiting on Erica:** (a) ✅ ANSWERED 2026-08-03 — "Both decisions
   you made regarding the logic appear to be acceptable": the two
   story-1 spec wrinkles (PA keeps superseded org-level; unclassified
   uploads open to the three classifying roles) are CONFIRMED — the
   access-rules build is confirmed against her spec end to end;
   (b) her flip decision — mode 'rules' per program lifts the
   real-files gate (not yet given; her call, no rush); (c) her three
   monitoring answers (she's swamped — "once the other items are off
   my plate" — expect days, not hours); (d) her promised
   system-inventory notes (still pending).
3. **Watch this week:** FSPHP meeting (prep asks may land); Aug 13
   orientation (sandbox READY — staff logins ChrisB/KellieR/SamanthaC
   exist; Erica initiates invites); master-list cadence suggests a
   fresh edition ~Friday Aug 7 folding in access-rules-done.
4. **Small repo nit, next code session:** v149's migration DESCRIPTION
   prose still says "3-byte link" from a pre-correction draft — the
   code and console output correctly say 4-byte integer. Prose-only
   fix (the migration is applied everywhere; behavior identical).

**Session-166 lessons:** (1) link_tank.next_link is BIGINT — node-pg
returns it as a STRING; any code using a returned link as a JS Map key
or for identity must normalize (the grant door does; the acceptance
test caught it first run). (2) A test fixture that uploads documents
for a person BEFORE activation gets registrant-stamped documents —
that's the boundary working, not a bug; fixtures wanting chart
documents upload after activation.

---

## ✅ PRIOR (Session 165 wrap, 2026-08-03) — Bangalore week — STORY 4 RAN TO COMPLETION in S166

**Stories 1–3 of the access-rules build are DONE, pushed, CI genuinely
green at `cea41ae` (run 30773833707 — verified by the CI workflow's own
conclusion; see STATE for the S164 CI-record correction). Full suite
99 tests / 2,841 asserts. Nothing user-visible shipped — every tenant
stays in document mode 'open' until Erica's flip; the real-files gate
stands until story 4 proves AC-1..AC-8.**

**The queue, in order:**
1. **Heroku deploy on Bill's go** (CI already green; Erica-activity
   check → push → `heroku run node db_migrate.js` (v145→v148) →
   restart → live verify). Carries the six S164 + five S165 commits.
   No release note (nothing user-visible; the instrument catalog
   ordering on copied tenants is the only observable change).
2. **STORY 4 OF THE ACCESS-RULES BUILD — break-glass + the IHS/
   superuser lockout. DESIGN PASS WITH BILL FIRST, then build.**
   Bill's understanding re-confirmed in S165: superusers lose live
   document CONTENT (matrix stays for program staff); the emergency
   path is a named grant — program approval recorded first, scoped to
   named documents, automatic notification to the program's MD + PA,
   full audit of everything opened, 24-hour expiry (spec §7.1, D-5
   Decided, AC-8 Blocking). Design questions to settle with Bill:
   (a) what a grant looks like (table + admin surface? who at the
   program records approval — which door, which roles);
   (b) the notification wording + channel (the notification system
   exists; messaging consent gate is closed — staff notifications are
   the right rail);
   (c) what the grant unlocks mechanically (superuser + grant →
   content doors open for THOSE documents only; audit every open);
   (d) the honest raw-database boundary: code locks every interface;
   the Heroku credentials cannot be code-revoked — that part is
   commitment + audit, and it gets STATED PLAINLY to Bill and Erica
   in the design and in any claim made to programs (never buried);
   (e) the acceptance test that proves AC-1..AC-8 end to end and
   lifts the real-files gate (the story-4 exit).
3. **CARRIED QUESTION (Bill never answered in S164/165):** did he send
   Erica the after-update note from the S163 Tier 1 deploy (drafted in
   the S163 chat)? His call to send or skip — don't let it dangle.
4. **THE WPHP MONTHLY LETTER — window Aug 4-8 IS NOW OPEN.** Raise it
   at next session start (plain-text draft for Bill's review; material
   in the S163 queue notes + the Washington section below). Doubles as
   the pre-kickoff letter.
5. **Watch:** FSPHP meeting this week; Erica's system-inventory notes
   (promised, still pending); Aug 13 orientation (sandbox READY).
   When the access-rules build finishes story 4, the note to Erica
   should flag the two spec wrinkles interpreted in story 1 ((a) PA +
   superseded org-level docs; (b) unclassified uploads open to all
   three classifying roles) for her confirmation.

**Session-165 lessons:** (1) verify CI by the CI WORKFLOW's own
conclusion — a green run number can belong to the pages-build
workflow (that's how S164's red CI went unseen). (2) The migration-
replay class: current copier code runs inside OLD migrations on
CI's from-baseline replay — any copier column younger than a
migration that calls the copier needs an existence guard. (3) A
standing-guard test that compares against "live" config must know
that CI's replayed database is not the live config (the S164 drift
guard went red on first contact because S164's CI never reached the
suite step).

---

## ✅ PRIOR (Session 164 wrap, 2026-08-02) — Bangalore week — STORIES 1-3 RAN TO COMPLETION in S165

**The fixing era is CLOSED. All four audit standing guards built, both
parked decisions fixed, the demo-side tenant-fallback family swept —
everything pushed to GitHub at `29c2043`, CI GREEN (run 30768215495).
Full suite green as the push gate: 99 tests / 2,698 asserts. Heroku is
BEHIND (2026.08.02.1220 / v144) — the next deploy carries six commits +
migration v145 (nothing user-visible except the instrument catalog
finally ordering correctly on copied tenants; no release note needed).**

**THE NEXT CONSTRUCTION IS LIVE: the ACCESS-RULES BUILD (Erica's
PI2_Document_Access_Rules spec is the contract). Bill approved the
four-story shape AND said GO on Story 1 in Session 164 — the design
below is settled; the next session builds it without re-litigating.**

**The queue, in order:**
1. **Heroku deploy on Bill's go** (CI already green; Erica-activity
   check → push → `heroku run node db_migrate.js` (v145) → restart →
   live verify). No release note (nothing user-visible).
2. **STORY 1 OF THE ACCESS-RULES BUILD — design settled, build it:**
   - **The four stories (Bill approved 2026-08-02):** (1) tiers + the
     §4 permission matrix; (2) audit-before-serve + Tier-2 export
     exclusion + Part 2 flag plumbing; (3) registrant boundary +
     promotion review action + lab release action; (4) break-glass +
     the IHS/superuser lockout (Bill knowingly accepted that it
     constrains him and Claude on live). Acceptance test proving her
     AC-1..AC-8 lifts the real-files gate at the end.
   - **Spec extraction lives at the session scratchpad but re-extract
     from the .docx if needed** (wi_php/PI2_Document_Access_Rules.docx;
     unzip + strip w:t tags — pandoc is not installed).
   - **Story 1 design (settled in S164, build to this):**
     tier semantics on the EXISTING document.confidentiality column
     (1=Standard 2=Sensitive 3=Restricted 4=Org-level);
     document_type.default_tier column via migration v146, seeded per
     spec §5 (license/contract→4, consent+correspondence→1, everything
     else→2), backfill document.confidentiality from type defaults,
     all three workforce tenants (two-tenant rule);
     **role resolution is DATA, not code** — sysparm 'document_access'
     gains category 'role_map' rows per tenant (MD →
     'position:POSITIONCLINIC:MEDDIR', CM →
     'position:POSITIONCLINIC:CASEMAN', PA → 'admin') read through the
     EXISTING sessionMatchesAudience machinery so the platform file
     never names a vertical molecule (the v130 layering rule);
     **multi-role sessions get the UNION of their roles' permissions**
     (Erica herself holds both positions);
     the §4 matrix lives as a code constant keyed tier×role → codes
     V/D/U/C/S/H/X; lifecycle overlays it (R = classifying roles only,
     S = MD/CM per §6.1); **unclassified documents = Tier 2 until
     classified** (replaces v130's admin-only rule);
     enforcement at resolveDocumentTarget ('V' to see at all, no
     oracle) + per-door codes (file→D, edit/classify→C, replace→S,
     legal hold→H, upload→U) + a finder WHERE clause built from the
     session's permitted tier×status combos;
     mode 'open' stays today's behavior — the matrix IS mode 'rules'
     now; **test_document_access gets REWRITTEN to prove the matrix**
     (its 33 asserts prove the retired v130 audience-rows model);
     document_access_rule table STAYS (future per-type overrides +
     story 3's participant rules; it is manifest-tracked);
     tier changes log with before/after; lowering below the type
     default requires MD (raise = any classifier).
   - **Two spec wrinkles, interpreted (flag to Erica in the next note,
     build proceeds):** (a) §6.1 makes Superseded visible to MD/CM only
     but §4 gives PA full org-level lifecycle — implemented as §6.1
     for member-linked docs, PA keeps visibility on superseded
     ORG-LEVEL (tier 4) docs it manages; (b) §4 gives PA no U on
     Tier 2 but §2 says PA "manages ingestion" and inbound faxes
     default Tier 2 — implemented as: UNCLASSIFIED uploads allowed for
     all three classifying roles, TYPED uploads require U on the
     type's default tier.
3. **Stories 2-4 in order** (each its own bite-size release, Bill's go
   each).
4. **CARRIED QUESTION (Bill never answered in S164):** did he send
   Erica the after-update note from the S163 Tier 1 deploy (drafted in
   the S163 chat)? His call to send or skip — don't let it dangle.
5. **THE WPHP MONTHLY LETTER — Bill said "too soon" on 2026-08-02;
   window runs Aug 4-8.** Raise it again mid-window.
6. **Watch:** FSPHP meeting this week; Erica's system-inventory notes
   (promised, still pending); Aug 13 orientation (sandbox READY, and
   the instrument catalog now displays in proper order there).

**Session-164 lesson:** Bill's frustration signal of the day — three
sessions of fixing with nothing new to show. The fix queue is now
genuinely empty and the guards make the bug classes unwritable;
sessions from here BUILD. Also: `git add -u` swept in a file that
wasn't ours (ml/model_info.json retrain stamp) — amended out; stage
explicitly.

---

## ✅ PRIOR (Session 163 wrap, 2026-08-02) — Bangalore week — RAN TO COMPLETION in S164

**The Wisconsin-assumptions audit is FULLY DISPOSED (Tier 1 deployed
live, Tier 2 + Tier 3 fixed and committed). Three commits sit unpushed
(`94d4206`, `9b9d803`, `fe0a4b2` + wrap) carrying migrations v143+v144
(both invisible to users). **FULL SUITE GREEN AT WRAP as the push gate:
97 tests / 2,620 asserts (tests/last_run.log records it).**

**The queue, in order:**
1. **Push the S163 remainder to GitHub on Bill's go** (full suite green
   is the gate) → CI → Heroku on his separate go (carries v143 + v144 —
   run `heroku run node db_migrate.js`). No release note needed
   (nothing user-visible). Also confirm whether Bill sent Erica the
   after-update note from the Tier 1 deploy (drafted in the S163 chat;
   his call to send or skip).
2. **FIRST WPHP MONTHLY LETTER — Bill's window Aug 4-8 is OPEN**
   (doubles as the pre-kickoff letter; plain-text draft for his review;
   material: wa_php stood up, sandbox live + document types fixed,
   engagement engine + messaging foundation, safety-detector layer
   audited end to end and proven on a copied tenant, kickoff checklist
   in the Washington section below).
3. **The four remaining standing guards from the audit** (its own
   story): #1 lint rule — numeric literal assigned to *_link/*_id names
   outside db_migrate.js (would have caught the whole S160-162 family);
   #2 lint rule — tenant fallback `|| <literal>` in client pages;
   #6 manifest contract test — machine-diff REQUIRED_PARTS + the
   not-copied list against the schema's per-tenant tables (make the
   not-copied list machine-readable first); #5 one parameterized
   UI-test run of Erica's daily screens against the SANDBOX tenant
   (every current UI test pins tenant 5).
4. **Two Bill decisions parked from Tier 3:** (a) performance_profile
   .html scores on a hardcoded wi_php snapshot (public no-login page,
   demo-contained — keep or wire?); (b) meds.js/instruments.js ORDER BY
   link = instrument catalog order only on wi_php — a portable sort
   needs a display_order column (schema change, his call).
5. **THE ACCESS-RULES BUILD** — still the next big Insight construction
   (her spec is the contract; triage in the S159 section below).
6. **Watch:** FSPHP meeting this week; Erica's system-inventory notes
   (promised, still pending); Aug 13 orientation (sandbox READY —
   document types fixed and deployed this session).

**Session-163 lesson (on the record):** report findings at one size —
who is affected + what action is needed; "nobody/none" = line item, not
headline. And the test runner now writes tests/last_run.log so a
failure's name can never be lost again (Bill had to ask twice — it's
fixed once and for all now).

---

## ✅ PRIOR (Session 162 wrap, 2026-08-01 late) — RAN TO COMPLETION in S163

**Local is SIX commits ahead of GitHub (through `d015032` + wrap) —
NOTHING pushed, full suite NOT yet run. Session 162 fixed seven audit
findings as they were found (Bill's standing direction this session:
FIX as you find, don't catalog-and-rank — given twice, it outranks the
old audit model). The audit doc is
docs/WISCONSIN_ASSUMPTIONS_AUDIT_2026_08.md.**

**The queue, in order:**
1. **Startup fast-checks, then FULL SUITE (the push gate)** — 97 tests;
   the seven fixes have only targeted proof (test_pattern_triggers
   78/78 + lint 0). Announce the run (DB snapshot/restore). Then push
   to GitHub on Bill's go → CI green → Heroku on his separate go.
   **Release note to Erica after deploy** — wording matters: live
   wi_php starts filing band/pattern alerts again after 4.5 silent
   months (that's the fix working; frame it that way).
2. **Continue the Tier 1 fixes from the audit doc, in order:**
   - **1.3** compliance_rules.html — tenant from URL, defaults '5',
     linked with no param from admin_settings.html:67; superusers READ
     AND WRITE Wisconsin's compliance items believing they're WA. Fix
     like poser_mobile (session + redirect), fix the bare link.
   - **1.4** admin_ppsi_section_weights (`|| '5'`) +
     admin_ppii_weights (`|| '1'` — Delta!) — saves land on the wrong
     tenant; ALSO confine the unguarded weight GETs in
     scoring_admin.js (any authed user reads any tenant's weights).
   - **1.5** the `|| 5` family on 14 shared screens (list in the audit
     doc §1.5) — propagate poser_mobile.html:723's redirect pattern.
   - **1.6** Central-time hardcodes: custauth.js:~505 signal
     activity_date (WA signals 22:00-24:00 Pacific get tomorrow's
     date); notification delivery-window defaults
     (pointers.js:19734/29982 + tenant_standup.js:539); program_tz
     literal (pointers.js:7391). Timezone is tenant data — the
     per-tenant source exists.
   - **1.7** sandbox has ZERO document_type rows (verified 9/9/0) —
     small migration + copier part; **the Aug 13 orientation hits this
     if they touch documents.** wa_php already has its 9 (two-tenant
     rule satisfied by the backfill covering the sandbox).
3. **FIRST WPHP MONTHLY LETTER — Bill's window Aug 4-8 opens Monday**
   (doubles as the pre-kickoff letter; plain-text draft for his
   review; material: wa_php stood up, sandbox live, engagement engine
   + messaging foundation, kickoff checklist in the Washington section
   below; can now honestly add: safety-detector layer audited end to
   end and proven on a copied tenant).
4. **Tier 2/3 of the audit** (Bill picks pace): copier reward-reference
   remap + manifest gaps, encode-door sign guard, census blind spots,
   seeders, startPPSI dead door, and the six standing-guard
   recommendations (lint rules etc.) — all in the audit doc.
5. **Watch:** FSPHP meeting this week (Chris's coaching: exploration
   not sales); Erica's system-inventory notes (promised, still
   pending); Aug 13 orientation readiness (sandbox seeded; document
   types = item 1.7).

**Session-162 lesson (recorded in memory):** when Bill approves an
audit he means find-AND-FIX in one motion; the S142-147
catalog-then-rank model is retired for audits unless he asks for it.

---

## ▶ PRIOR (Session 161 wrap, 2026-08-01) — Bangalore week

**Nothing is mid-flight in code. Local == GitHub == Heroku at `a46a4c9`
/ 2026.07.31.1353 / v141. The sandbox is LIVE and SEEDED (ready for the
Aug 13 orientation). Bill flies to Bangalore Sunday 8/2 — sessions
continue normally, hours shifted ~12.5h from Central.**

**The queue, in order:**
1. **CONFIRM: did Edition 3 go out Friday?** (Files ready in
   wi_php/project_status/; regenerated once already this week. If not
   sent, it goes first.) Also confirm the FSPHP pre-meeting email went
   (drafted in the Session 161 chat — technical answers 2–6, platform
   described as NOT live anywhere; Erica/Tom answer 1/7/8/9).
2. **FIRST WPHP MONTHLY LETTER — Bill's window Aug 4–8** (doubles as the
   pre-kickoff letter; draft plain-text for his review; material: wa_php
   stood up, sandbox live for the exploration party, engagement engine +
   messaging foundation, kickoff checklist in the Washington section
   below).
3. **THE WISCONSIN-ASSUMPTIONS AUDIT (Bill's yes 2026-08-01) — its own
   session, the agreed next construction.** Model: the S142-147 audit
   (read-only lenses → findings list → Bill ranks fixes). Why: FIVE
   wi_php-assumption bugs found in ONE day (Session 161), every one
   latent on production-bound wa_php. The lenses:
   (a) numeric literals that are secretly Wisconsin ids (survey links,
   question/category numbers, action ids — codes like 'PPSI' are fine,
   NUMBERS are the turds);
   (b) hardcoded tenant checks (tenant 5 / wi_php-only behavior);
   (c) copier manifest completeness — other tenant-less tables like
   survey_question_answer, keyed through a parent, invisible to counts;
   (d) client pages on shared vertical paths (poser_mobile's
   SURVEY_LINK=1 + `===1` niceties; survey-take-modal's unused
   startPPSI(1); seed_pulse_events);
   (e) code that only works because wi_php ids are small positives (the
   offset family).
   **FIRST CONFIRMED CUSTOMER (fix first): custauth's
   protective-collapse detector filters `sq.category_link IN (4,6,7)` —
   wi_php's category numbers — a SAFETY detector that silently never
   fires on wa_php or the sandbox.** Two-tenant rule applies to any
   data fixes (both WA tenants).
4. **FSPHP MEETING this week** (Chris's coaching: exploration not
   sales; no incumbent AI vendor; Linda has the RIS IT group's name —
   the interoperability answer deliberately asks about RIS standards).
5. **THE ACCESS-RULES BUILD** — the next big Insight construction (her
   spec is the contract; triage in the S159 section below). On Bill's
   go, after the audit or beside it — his call.
6. **Watch:** Erica's system inventory notes (promised, still pending);
   anything the Aug 13 orientation needs (sandbox is READY — staff
   passwords were handed to Bill in Session 161; resets go through the
   admin Users screen).

**Small carried notes (Session 161):** the midnight daily-job window
makes the shared-CPU Basic dyno sluggish for ~15s (diagnosed, harmless,
self-clearing) — dyno sizing + job-stagger ride Washington pilot prep;
the FULL_PPSI flag-clear now lives in meds.js behind the
afterSurveySubmitted vertical callback (pointers.js no longer names
PPSI); the offset-regime census + the 'Survey answer options' manifest
part are the standing guards born this session.

---

## ▶ PRIOR (Session 159 wrap, 2026-07-29 evening) — the week is now FULL and dated

**⚠️ BILL TRAVELS SUNDAY 8/2 — his LAST Bangalore trip. Out for TEAM
MEETINGS next week (India ~12.5h ahead of Central; he MAY join a call if
the team finds a compatible hour — floated in his reply). BUT — his
correction, same evening: few meetings scheduled in Bangalore, so he has
LOTS of working time with Claude next week. So: build sessions proceed
normally during travel week (sandbox build, WPHP letter, even the
access-rules build can start on his go); only team-call scheduling is
constrained. Friday's Edition 3 send unaffected. Expect his working
hours to be shifted ~12.5h from Central.**

**NEW (2026-07-30): FSPHP MEETING NEXT WEEK (week of Aug 3 — Bill's
Bangalore week).** Erica + team meet Chris and the FSPHP group (Chris is
FSPHP's Chief Medical Officer — the national room; states follow the
Federation). Chris's prep coaching to Erica: NOT a sales pitch —
curiosity, great questions, ample dialogue; "what can you learn from
this meeting?" Linda (FSPHP) knows what to bring AND the name of the IT
group FSPHP works with for the RIS — Erica is reaching out to her.
CORRECTION on the record: FSPHP is NOT currently working with an AI
company (the earlier impression was a misunderstanding — no incumbent
AI vendor in that conversation). Watch for prep asks landing on us
(demo? deck? data/capability answers for the RIS discussion).**

**Nothing is mid-flight in code. The queue, in order:**
1. **TOMORROW (Wed 7/30), Bill sends** the sandbox-access reply to Erica's
   team thread — drafted and saved:
   `wa_php/WPHP_Sandbox_Access_Reply_2026-07-29.md` (Bill held it
   deliberately: "not tonight, tomorrow"). Wording for her point 2 + his
   cover line, both ready to copy.
2. **FRIDAY (8/1): regenerate Edition 3 AGAIN, then send** — fold in her WA
   ranking (placeholder section becomes her answer), flip her #1 to
   "rules received, build scheduled," collapse the cover note's three asks
   to one + thanks. Files: `wi_php/project_status/` (list .md + .docx) and
   the cover-email .md beside them. Watch for her detailed system
   INVENTORY NOTES (promised "tonight and tomorrow") — fold anything she
   flags into the same edition.
3. **SANDBOX BUILD — STARTED Session 160 (2026-07-31, Bill moved it up).
   STATE: config DONE, staff DONE, people seeding BLOCKED on a REAL
   PLATFORM BUG the sandbox caught (details below — it protects the WA
   pilot itself).**
   ✅ DONE: migration v139 applied locally (tenant 7 'wphp_sandbox' /
   "WPHP Exploration", full wi_php config copy via copyTenantConfig, all
   26 manifest parts verified, Pacific TZ, the 5 WA boards, 4 fictional
   health systems / 8 clinics; test_tenant_standup_module green).
   SERVER_VERSION 2026.07.31.1114 / EXPECTED_DB_VERSION 139. Staff
   logins created + positioned via real doors: ChrisB (admin, MEDDIR),
   KellieR + SamanthaC (csr, CASEMAN), all @ CAS-SEATTLE; EricaL granted
   the sandbox in her chooser (TomJ = Heroku-only, script skips politely
   locally). Seed script:
   verticals/workforce_monitoring/tenants/wphp_sandbox/seed_sandbox_people.cjs
   (idempotent; generates + prints staff passwords once; people via real
   doors AS the staff: Kellie creates/dispositions, Chris reviews,
   activations, PPSI sittings with per-story answer patterns).
   🐛 **THE BUG (blocks people seeding, LATENT ON REAL wa_php TOO):**
   SURVEY_LINK molecule (2-byte) is value_type='key' (offset encoding,
   MOLECULES.md §5) — correct for wi_php's LEGACY positive survey ids
   (PPSI=1, PHQ9=9) but WRONG for every copied tenant, whose survey.link
   comes from link_tank already in the offset region (sandbox PPSI =
   -32756, wa_php PPSI = -32767). First survey submit → encodeMolecule
   double-offsets (-32756 − 32768 = -65524) → smallint overflow → 500 in
   createAccrualActivity/insertActivityMolecule. **The first survey ever
   submitted on the Washington pilot would have hit exactly this.**
   MOLECULES.md line ~106 already states the rule being violated: SERIAL
   id → 'key' (offset); link_tank PK → 'numeric' (pass-through) — the
   Session 76 bug class. **Fix shape to discuss with Bill (design, not
   patch):** unify the regime — migration re-encodes wi_php's historical
   SURVEY_LINK stored bytes (+32768: stored −32767→1 = the link, values
   fit raw since legacy links are 1..9), flips molecule_def to
   numeric/value/numeric for ALL tenants (mirroring MEMBER_SURVEY_LINK,
   the documented pass-through exemplar), then MOLECULES.md §7 round-trip
   proof + reader sweep (moleculeJoinSQL/lookup decode paths).
   🐛 **SECOND LATENT BUG, same neighborhood:** pointers.js ~32448 gates
   the PPSI post-submit step on `msRow.survey_link === 1` — a hardcoded
   wi_php-ism; on ANY copied tenant the PPSI-specific step silently
   skips. Fix by survey_code === 'PPSI'.
   ⚠️ Local DB state note: the failed runs left partial people — Marcus
   Webb activated with ONE OPEN PPSI sitting (+ a debug sitting), NO
   completed sittings; nobody else created. The seed script skips
   existing people by roster name — after the fix, either finish Marcus
   by hand-completing his sittings or accept his thinner story.
   **The original build shape (still the contract):** new
   tenant (6th) for the WPHP exploration party — copyTenantConfig from
   wi_php ("WPHP Exploration" branding, Pacific TZ, WA boards), FAKE
   health systems/clinics (fine here, unlike wa_php), ~a dozen
   story-driven fictional participants (Bill's leaning: stories over
   volume — Chris evaluates workflow, not scale), named logins for
   Chris/Kellie/Samantha (MD/CM/CM roles), sandbox grant added to Erica's
   + Tom's logins (chooser). One build session + one deploy. The S159
   copier fixes (groups/MEDs/promotion results now copy faithfully) were
   the dress rehearsal for exactly this.
   **STANDING RULE (Bill, 2026-07-29, Session 160): once the sandbox
   exists, every Washington config/rule change applies to BOTH Washington
   tenants (wa_php + the sandbox) at the same time — they must never
   drift apart while Chris's team explores. Code + schema propagate
   automatically; tenant config rows do NOT, so every WA config task is a
   two-tenant task until the sandbox retires. Exception: the kickoff
   configuration (real licensing boards, health systems, clinics) goes to
   wa_php ONLY — the sandbox keeps its fictional versions.**
4. **FIRST WPHP MONTHLY LETTER (Aug 4-8 window)** — see the dated
   deliverable below; it now also confirms the Aug 13 orientation.
5. **THE ACCESS-RULES BUILD** — the next big Insight construction (her
   spec is the contract, triage below). Fresh session(s), Bill's go.

**THE FEASIBILITY CLOCK — PLAN ACCEPTED (Chris Bundy, 2026-07-30):**
Erica sent her work-plan reply the morning of 7/30 WITH Bill's sandbox
wording as her point 2 VERBATIM (queue item 1 is DONE — the sandbox
commitment "ready before the August 13 orientation" is now a promise on
the record with WPHP). Chris replied same day: "great plan" — Allison
(his EA, ayang@wphp.org) sends their 90-min availability for **8/13
orientation**; a standing slot 1-2×/week through end of August (Erica
proposed Mon and/or Thu); at least 2 of their 3 at each meeting; ERICA
INITIATES THE MEETING INVITES once times are set. Out-of-office: Chris
Aug 6-11 + Aug 24-29; **Samantha out the LAST week of August**; Kellie
may flex some time week of Aug 2 despite PTO. Go/no-go by SEPTEMBER.
Erica's working group: her, Tom, and "a technology lead" (Bill) —
first working sessions may fall during Bill's Bangalore week (~12.5h
shift). Erica also flagged a CLARIFICATION-QUESTIONS list from the WA
platform list for the early sessions (how they define connections and
stakeholders; preferences on agreements and board information) — these
are the very blockers her held-off wish-list items named, so answers
feed straight back into the ranked build queue. Shared question log =
a running doc, feasibility picture built in writing.

## 🔔 ERICA'S DROP ARRIVED (2026-07-29, Session 159 tail) — BOTH watch items landed at once

**Three documents, received by email and filed (untracked, her-working-docs
pattern):** `wa_php/WPHP_Ranked_Build_Based on Wishlist.docx`,
`wa_php/WPHP_Wish_List_Organized.docx`,
`wi_php/PI2_Document_Access_Rules.docx`. Her email also promises a
**detailed system inventory with notes "tonight and tomorrow"** — watch
for that next; "everything looks great so far."

**1. THE WA RANKING (dated July 23).** She ranked ONLY items clear enough
to build with no open question; everything else is held with its blocker
named. Her ranked queue: (1) **monitoring + toxicology core as ONE BLOCK**
(toxicology, lab integrations, random rules/paradigms, daily check-ins,
collection sites, calendar view, excused absences — "the difference
between a monitoring platform and an intake and assessment platform");
(2) consents — WITH expiry timeline from day one, can't be added cleanly
later; (3) eSignature — a VENDOR SELECTION not a build, can start in
parallel (Bill decision: vendor + money); (4) current medications = the
med registry, deps satisfied; (5) secure messaging — consent-gated so it
follows (2); NOTE her organized list marks messaging "Do not have" — she
doesn't know the v138 foundation shipped; Edition 3 already tells her;
(6) letter/form templates, standalone. Held-off list names each blocker
(external stakeholder model = the early Washington clarification
everything portal-shaped waits on; Organizations = our Network Directory,
"built on our own timeline"). Group 1 of the organized list is a
show-Washington-what-exists inventory. RECONCILE against
wa_php/WPHP_Wish_List_Analysis.md (our internal read) before kickoff.

**2. THE DOCUMENT ACCESS RULES — her #1 UNBLOCKS, but the "one admin PUT"
assumption is DEAD.** Her spec is far richer than the v130 plumbing's
type × audience rows: **deny-by-default access computed from role +
program + confidentiality TIER + type + lifecycle status.** New concepts
the platform does not have: a confidentiality-tier enum on document
metadata (Standard / Sensitive / Restricted / Org-level) with a
per-type default tier; participant/registrant PORTAL document visibility
incl. a logged RELEASE action for lab results; the registrant boundary
(registrant docs never on clinical surfaces; promotion at activation is
an explicit logged staff action, never automatic); audit-BEFORE-serve
(failed audit write blocks content); Tier-2 exclusion from ALL bulk
export; 42 CFR Part 2 flag requiring a linked consent artifact +
disclosure event; break-glass for IHS technical staff (⚠️ that's US —
no vendor access to document content through ANY production interface,
24h-expiring named grants only — operational constraint on Bill+Claude,
flag before any live-document support work); legal hold + supersede
(already built, S147). **Her decision register D-1..D-8 explicitly says
NOTHING stops construction** (counsel-gated items build their plumbing
now); §9 gives acceptance criteria AC-1..AC-8 (Blocking) that ARE the
release condition for the real-files gate; §10 lists her open questions
(hers + counsel's, not ours to close). **This is the next big Insight
build — a real construction project, its own fresh session(s), the spec
is the contract.** v130's mode/rules table + resolveDocumentTarget choke
point is the right foundation to build it on.

**3. EDITION 3 MUST BE REGENERATED AGAIN before Friday's send:** fold the
WA ranking in (the placeholder section becomes her organized answer);
move "document access rules" from In Your Court to received-with-thanks
(her #1 now reads: rules received, build scheduled); the cover note's
three asks collapse to one (anything missing) + thanks for the two that
landed; keep the messaging-exists note (her list thinks messaging doesn't
exist). The cover-note file also needs its ranking-ask paragraph swapped
per its own header instruction.

---

## ▶ PRIOR (Session 158 wrap): NOTHING MID-FLIGHT — Edition 3 FRIDAY, then Bill picks

**Everything built in Session 158 is DEPLOYED — see STATE.md.** Local ==
GitHub == Heroku at `3692e50` / 2026.07.27.0942 / DB v138. Automatic
MEDS (Groups+MEDS complete through story 3), the outbound messaging
foundation (docs/MESSAGING_DESIGN.md is the contract; provider still
the standing OUR_LIST decision), the arrowhead favicon, the Scheduled
Jobs door, and Bill's four small rulings are ALL LIVE. Suite 97 tests /
2,563 asserts, lint 0, CI green (run 30324842655).

**Agenda candidates (Bill picks):**
1. **SEND master list Edition 3 to Erica FRIDAY JULY 31** (drafted in
   wi_php/project_status/ — whichever session is open Friday sends it;
   REGENERATE first regardless: this week's edition should fold in
   Manual+Automatic MEDS done, the messaging foundation, and the small
   fixes; and fold in her WA ranking if it lands).
2. ~~Possible list adds~~ — **RULED (Bill, Session 159, 2026-07-28):
   BOTH NO.** (a) Programs admin screen: NO for now — Claude stands up
   new tenants by hand (seedUniversalMolecules is the door); (b) SQL
   fast-path for 10M preview: fine as it is. Neither goes on OUR_LIST;
   don't re-raise unless circumstances change.
3. ~~Decision-proof filler~~ — **BOTH ITEMS WERE STALE, closed Session
   159.** (a) Intake-handler transaction hardening: ALREADY BUILT
   Session 148 (commit c28b4a8; all three intake doors ride
   member-row-locked transactions, comments cite "S148 audit #8").
   (b) The hardcoded-127.0.0.1 cleanup: the client-page sweep was DONE
   Session 153 (guide line 360); a fresh grep found ONE real remainder
   — ml_report.js pinned its DB pool + ML port — fixed Session 159
   (env-defaulted, matching db_migrate.js / ML_SERVICE_URL patterns).
   Remaining 127.0.0.1 hits are legitimate: env-var defaults, the
   server's own loopback self-calls, dev CORS, comments, and
   historical one-time seed/backfill scripts.
4. **Parked, Bill's to unpark:** brochure migration to its own Heroku
   app (he said no 2026-07-27; plan sketched in the S157 notes + this
   file's history; riders: visit roll-up, Google Analytics yes/no,
   Mark's password change — all still owed); the outbound provider
   pick (money + BAA); clinical MEDS onto the shared engine (story 4,
   possibly never — the design doc records that as legitimate).

**Watch (outranks everything):** Erica's WA wish-list ranking + her
document access rules (one admin PUT away — STATE S155 ship 4).

**Dated deliverable — FIRST WPHP MONTHLY UPDATE (early August):** the LOI
(executed 2026-07-16) makes monthly progress updates a standing
commitment; the first is due ~Aug 16. Bill's timing call (Session 159,
2026-07-29): ahead of the deadline but NOT July — draft it in the
Aug 4–8 window so it lands roughly a week before the ~Aug 15 kickoff and
doubles as the pre-kickoff letter (where things stand + what kickoff
needs from them: licensing-board names, health-system list). Plain-text
draft for Bill to review and send, same as the Erica process. Material to
draw on: wa_php stood up and ready, 10M-scale proof (S157), engagement
engine + messaging foundation shipped, kickoff checklist in this file's
Washington section.

**Small notes carried:** WINBACK_60 demo MED on LOCAL Delta (manual,
never fired — walked back to Manual after the run-mode screen proof);
BILLTEST + 364,291 open episodes on loyaltybig; Delta login lands on
missing /verticals/airline/dashboard.html (demo nit, parked); the
messaging consent gate ships CLOSED for workforce tenants (opens only
with Erica's consent architecture, deliberately).

## ✅ PRIOR (superseded — Session 158 ran this agenda): Session 157 wrap notes

**Everything built in Session 157 is DEPLOYED — see STATE.md.** Local ==
GitHub == Heroku at 2026.07.26.1723 / DB v136. Groups v1 AND Manual MEDS
(stories 1–2 of docs/GROUPS_AND_MEDS_DESIGN.md) are live; the design doc
remains the contract for story 3 (automatic MEDS) and beyond.

**Agenda candidates (Bill picks):**
1. **SEND master list Edition 3 to Erica FRIDAY JULY 31** (drafted +
   current in wi_php/project_status/ — whichever session is open Friday
   sends it; regenerate first if her WA ranking lands).
2. **Story 3: AUTOMATIC MEDS** — the standing watch: scheduler job under
   its own job code, next-due thinking, run_mode 'A' unlocks. Discuss
   shape with Bill first, as always.
3. **Brochure migration to its own Heroku app** — carries three riders:
   the brochure-visit roll-up (stop writing one usage_log row per view),
   the Google Analytics yes/no (Bill's marketing call), Mark's password
   change (still owed).
4. **Bill's four small rulings** (mobile-demo doors; demo battery; WA
   empty clinic picker; View Participant vs View chart).
5. Possible list items, Bill's call: Programs admin screen (no tenant
   CRUD page exists — admin_branding covers appearance only); SQL
   fast-path for instant MED/group preview at 10M scale (second
   evaluator — needs a mandatory parity guard; his decision).

**Watch (outranks everything):** Erica's WA wish-list ranking + her
document access rules (one admin PUT away — STATE S155 ship 4).

**Small notes carried from Session 157:** WINBACK_60 demo MED on LOCAL
loyalty Delta (never fired — walk artifact turned demo, like
MN_MEMBERS); BILLTEST + 364,291 open episodes on loyaltybig (Bill's 10M
live test); Delta login lands on missing
/verticals/airline/dashboard.html (demo nit, parked); outbound SMS/email
provider pick still the standing OUR_LIST decision — sms/email MED
results save honestly and no-op loudly until it lands.

**Groups v1 (story 1 of docs/GROUPS_AND_MEDS_DESIGN.md) is DONE and
ON GITHUB, CI green — see STATE.md Session 156.** Nothing is
unfinished; the design doc remains the contract for stories 2–4
(manual MEDS → automatic MEDS → someday clinical migration), each its
own session on Bill's go.

**Agenda candidates (Bill picks):**
1. **Heroku deploy of Groups v1** — bite-size release, CI already
   green (run 30185455289). Sequence: Erica-activity check → push →
   `heroku run node db_migrate.js` (v131) → restart → live verify.
   No release note to Erica needed (platform-side; her tenants got
   the two molecules but no Insight surface changed).
2. **SEND master list Edition 3 to Erica FRIDAY JULY 31** (drafted +
   current, .md + .docx in wi_php/project_status/ — whichever session
   is open Friday sends it; regenerate first if her WA ranking lands).
3. **Story 2: MANUAL MEDS** (docs/GROUPS_AND_MEDS_DESIGN.md §7 —
   definition + preview + run-once + identification records +
   results). Discuss shape with Bill first, as always.
4. Brochure migration to its own Heroku app (+ Mark's password change).
5. Bill's four small rulings (mobile-demo doors; demo battery; WA
   empty clinic picker; View Participant vs View chart).

**Watch (outranks everything):** Erica's WA wish-list ranking + her
document access rules (one admin PUT away — STATE S155 ship 4).

**Small notes carried from Session 156:** MN_MEMBERS demo group lives
on LOCAL Delta only (Bill kept it — a walk artifact turned demo).
Schema drift found: CI/baseline has FK bonus_stats→bonus that local
lacks (recorded in build notes; harmless now that the delete door
cleans stats — reconcile someday, through Bill).

## ✅ PRIOR (superseded by the above): SEND EDITION 3 FRIDAY / BROCHURE MIGRATION / SMALL RULINGS — no big build unblocked

**Session 155 shipped FOUR releases — see STATE.md.** Local ==
GitHub == Heroku at 2026.07.25.1439 / DB v130. Suite 93/2,341.
(1) The §7.1 selection partition (v129) + standing-guard test.
(2) The Primada brochure LIVE at primada.io + www.primada.io
(temporary co-tenant on the platform app; visit tracking =
usage_log BROCHURE_VISIT).
(3) The deactivation guard (Erica's Small #3, her design verbatim).
(4) Document access plumbing (v130): mode 'open' seeded = zero
behavior change; when Erica's rules arrive they're entered as ONE
admin PUT (/v1/document-access: her rows + mode 'rules') — her #1
unblocks same-day. The real-files gate STANDS until that flip.

**AGENDA CANDIDATES (Bill picks):**
1. **SEND master list EDITION 3 — FRIDAY JULY 31** (drafted +
   current in wi_php/project_status/, .md + .docx; regenerate first
   if her WA ranking lands — the generator script pattern is in the
   S155 chat/build notes; the .docx omits the repo process block).
2. **Brochure migration** to its own Heroku app (decouples the
   public site from platform deploys/boot rules): copy primada/,
   tiny static server, move the two DNS pointers (Mark's Squarespace:
   www CNAME + the @ forwarding rule), retire the host-routing block
   + both primada domain entries on the platform app. ALSO owed:
   Mark changes the password that appeared in a screenshot.
3. **Bill's four small rulings** (S152 walks, detail in the guide):
   mobile-demo launcher doors; mobile demo battery; WA empty clinic
   picker; "View Participant" vs "View chart".

**Phase 2 remainder (blocked, do NOT start):** the §7.2 release flow
(executed artifact, 42 CFR Part 2-shaped, filed under Consent
Layer 3) + participant selection surfaces — both gated on the consent
architecture (legal) + her document access rules + participant
identity (no logins today; connects to the S127 person model).
Suggestions/suggested lists/applications/paid features remain OUT;
her §10 open decisions STAY OPEN.

**Watch for (may reorder everything):** Erica's WA wish-list ranking —
her big team meeting was JULY 24, the ranking may arrive right after
(reconcile against wa_php/WPHP_Wish_List_Analysis.md, fold into the
master list). Her document access rules. Chris's compliance
confirmation.

**Standing rules from Session 153 (Bill):**
- An Erica-approved idea TYPICALLY GOES ON THE MASTER LIST for her
  ranking, not straight to build.
- Tours happen in separate TOUR sessions; regular sessions BUILD.
  (Chapter 3 of the guided tour waits for a tour session.)
- Master list cadence: a fresh edition every FRIDAY while the pace is
  fast; every other week when it settles; a ranking-ask always
  triggers an edition.

**Bill's four small rulings still open** (from the S152 walks, detail
in the guide): (a) where should the mobile demo be reachable from
(both launcher doors are orphans)? (b) mobile demo's hardcoded
battery — wire it or leave as demo? (c) WA's empty clinic picker wants
an honest empty state; (d) "View Participant" vs "View chart" label
consistency.

## ▶ WPHP WISH LIST (received from Erica 2026-07-22) — SHE DRIVES; our analysis stays internal

Washington's platform wish list arrived via Erica ("the big one").
Bill's reply (sent 2026-07-22 as REPLY-ALL to the internal team —
Erica, Tom, Damian, Joe, Mark; NO Washington recipients; NO analysis
shared, that hold HELD — deliberately unprimed) asks her for: gut reaction (real need vs
competitor echo), the pilot-vs-production split (Bill's instinct:
little of it gates the October pilot), and a master-list-style
ranking. **Our internal item-by-item gap analysis + t-shirt sizes:
verticals/workforce_monitoring/tenants/wa_php/WPHP_Wish_List_Analysis.md**
(~60% exists or is spec'd; true gaps = testing engine, external
portals, billing, reporting). When her ranking arrives: reconcile
against the analysis, fold into the master-list process (Edition 2
territory), and it feeds the August kickoff. **Her reply (2026-07-23):
she'll try to work the ranking today; the team's big meeting is
July 24 so it may slip — she's already spotted items she can rank, and
confirmed the team had the list as given to her. Still waiting, no
action.**

**Bill's parked decisions carry unchanged** (do NOT act without him):
public protocol cards; Delta brand fallback on logged-out pages;
bouncer.js placeholder; missed compliance events ring bells but
never file a worklist item (David Nguyen); notes consolidation;
loyalty_rehearsal keep/drop. Canonical detail:
docs/INSIGHT_OWNERS_GUIDE.md.
**RESOLVED off that list (Erica, 2026-07-23):** deactivated members'
open registry items — her pick is a HARD STOP at the deactivation door
until open items are addressed (option 2 of Bill's email). Per the new
"typically on the list" discipline it's now Small Enhancement #3 on
the master list (design decided, builds when it reaches the top), NOT
an immediate build. Erica Kind's pre-existing overdue RED gets
surfaced/resolved as part of that build.

Filler if blocked: the ~10-file hardcoded-127.0.0.1 dev cleanup (list
in the guide's lessons-as-lenses sweep).

## ✅ PRIOR (Session 151 wrap, superseded — Session 152 ran exactly this agenda): SESSION 152 — THE SCREENS-HOLD-UP SESSION

**Session 151 finished the whole ship — see STATE.md.** Both releases
are LIVE and verified (S149 batch + S150 fixes at `69c5205`, then
question-9 SENTINEL v126 at `25e0f60`). Local == GitHub == Heroku at
**2026.07.21.2100 / DB v126**. Release-1 note SENT to Erica; she
answered same evening (question 9 = sentinel → BUILT + DEPLOYED;
retest worked; compliance-at-activation CONFIRMED pending Chris).
Release-2 note handed to Bill.

**SESSION 152 AGENDA (Bill picked it, 2026-07-21): the three
screen-proof items:**
1. **Extend test_page_action_geometry to the Insight screens** — it
   pixel-measures 25 admin/edit pages, ZERO healthcare ones (S150
   standing ruling). Erica's daily screens first: dashboard, intake
   queue, action queue/registry, chart, clinic, documents, portal.
2. **Walk the not-yet-walked surfaces** (before Erica finds them):
   compliance_member deep pass, poser_mobile, CSV export downloads,
   wa_php tenant screens. (The tenant chooser WAS walked by the
   tour-setup window 2026-07-21 via throwaway login — clean.)
3. **Chapter 3 prep-walk** (the safety net: registry, SLAs, follow-ups,
   bells) — Claude walks every screen alone FIRST, then Bill's tour
   resumes (he holds the tour prompt).
Filler if blocked: the ~10-file hardcoded-127.0.0.1 dev cleanup
(list in the guide's lessons-as-lenses sweep).

**Bill's parked decisions** (do NOT act without him): public protocol
cards; Delta brand fallback on logged-out pages; bouncer.js
placeholder; deactivated members' open registry items (safety-shaped
example: deactivated Erica Kind carries an OVERDUE RED self-harm item
the scan will never process); missed compliance events ring bells but
never file a registry worklist item (David Nguyen, 19 consecutive
missed drug tests, bells only); notes consolidation;
loyalty_rehearsal keep/drop. Canonical detail:
docs/INSIGHT_OWNERS_GUIDE.md.

**Deploy-timing rule (new, from tonight's near miss):** Erica tests on
live in the EVENINGS — before any evening deploy/restart, check her
recent activity (the release-1 restart landed 11 minutes after her
8:14–8:18 PM session, by luck not planning).

## ✅ PRIOR (Session 150 opener, superseded — everything below was DONE in-session): FIX THE WALK FINDINGS, THEN THE HELD S149 DEPLOY

**Session 150 happened (the tutorial session) and changed shape mid-flight:**
the guided tour became a screens-actually-work audit after Bill hit three
broken things in the first chapter. Full findings + Bill's rulings live in
**docs/INSIGHT_OWNERS_GUIDE.md** (created S150, the session's one sanctioned
repo write — read its Findings log before touching anything). Highlights:

- ✅ **THE HOLD IS LIFTED — all six defects FIXED + browser-walked same
  session (Bill's go), commit follows the S150 guide commit.** Fixed:
  queue Invite QR (script tag); queue Enroll Back (enroll_context);
  chart Edit Profile Back (enroll_context + goBackFromMember re-injects
  member_id); action bars pinned outside the scroller on 7 modals
  (intake_queue ×3, action_queue ×4); clinic closeCompItemModal defined
  (modal closes, + Add Entry works); action_queue updatePreview defined
  (column toggles refresh a visible preview). Lint 0. pointers.js
  untouched — no version bump, no migrations.
- **The two pre-S149 dead buttons ARE almost certainly live today**
  (clinic compliance close, export toggles) — the next release's note to
  Erica should mention both fixes.
- **Bill's standing ruling on testing (also in the guide):** a button is
  done when PRESSING it produces its outcome; screen-touching releases get
  their screens WALKED before shipping; extend test_page_action_geometry
  to the healthcare screens (it covers 25 admin pages, zero Insight ones);
  walk the deployed-but-unused surfaces (documents screens, credentials,
  chooser, wa_php) before Erica does.
- **Architecture drift found (decision parked, NOT a cleanup task):**
  human-written text bypassed the molecule system in ten places (v9→v111);
  intake_item has an EMPTY entity code in link_tank; ACTIVITY_COMMENT
  (tenant 5) has no lookup row. Bill's rule is in permanent memory
  (feedback_text_goes_through_molecules): molecule considered FIRST before
  any new text column/table, choice brought to Bill. Consolidation of the
  ten existing places = its own future decision session.
- **Friction list (fix with the batch or after, Bill's call):** queue rows
  don't look clickable; Invite/Enroll adjacent twins; deep links to
  clinic/chart dead-end with no header and no way back (chart ignores
  ?memberId= entirely).
- The tour itself got through Chapter 1 only (intake). Chapters 2-5
  (monitoring engine, safety net, newer wings, roadmap) NOT toured — the
  guide's Part 2 lists them; future sessions extend the guide as they go.
  Before any future tour: Claude walks the screens FIRST, alone.

## ▶ PRIOR (set Session 149, 2026-07-21): THE TUTORIAL SESSION (Session 150) — superseded by the above

**A NON-DEVELOPMENT session, Bill's request:** pull a fresh copy of
Erica's live data into `loyalty_rehearsal`, run the local server against
the copy, and walk Bill through the whole Insight platform as a guided
tour (he feels his understanding drifting). No code changes, no tests,
no pushes, live site untouched. Five chapters: a person's whole journey
(invite → intake → activation → chart); the monitoring engine (MEDS,
instruments, PPSI→PPII→tiers→alerts); the safety net (registry, SLAs,
follow-ups, bells); the newer wings (documents, credentials, chooser,
wa_php); where it's going (Erica's ranking, open questions). Capture
every drift point Bill voices → seed `docs/INSIGHT_OWNERS_GUIDE.md`
(the ONLY repo write that session, local commit only). Paste prompt was
given to Bill at Session 149 end.

**PENDING AFTER THE TUTORIAL — the Session 149 batch deploy:** the
Erica-feedback batch is BUILT + COMMITTED LOCALLY (through the compliance
addendum commit, SERVER_VERSION 2026.07.21.0856, DB stays v125) but NOT
pushed anywhere. Sequence when Bill gives the go, in a development
session: full suite (the push gate) → GitHub → CI green → Heroku on his
explicit go → migrations none → restart + live verify → the short NOTE
to Erica after (her chosen rhythm). **THE NOTE MUST INCLUDE (Bill,
2026-07-21):** this release answers her Items 2.1/2.3 (intake history
now visible on item + chart), 3.1/3.2 (queue never hides an action's
outcome), Question 1 (reactivation by name + recent list), Question 3/4
(View chart, origin-aware back link, queue Invite/Enroll) — AND the
compliance change: compliance items now start AUTOMATICALLY the day
someone becomes a participant (assignment moved from the old broken
enrollment hook to activation; registrants carry none) — ask her to
CONFIRM that moment is right for her workflow.
OPEN for Bill (wording/design, small): reactivate label text; her
invite/register nomenclature; multi-position-holder routing (with Erica);
lifecycle views sketch.
Then: THE NETWORK DIRECTORY (her #3, the next big build, fresh session).

## ✅ Session 149 (2026-07-21): the small Erica-feedback batch — BUILT, all four parts (full story in Insight Build Notes + STATE)

Notes were never lost, they were hidden (item detail now shows the
person's full intake history; chart gains the Intake history card);
the "vanished" send-back was filter persistence (filters reset when an
action would hide its own outcome + stale-response epoch guard);
send-back assignment works as designed (returns to sender; Tom has no
login); reactivation searches by NAME + recent list; queue gains
Invite/Enroll; "View chart"; origin-aware back link. Tests 105+89
targeted green, lint 0. Committed locally `d7f5449`, NOT pushed.

## ▶ PRIOR queue (Session 148 wrap, 2026-07-20) — superseded by the above; kept for reference

**1. The small Erica-feedback batch — one bite-size release, note after
(her chosen rhythm):**
- **Verify the two "data loss" flags** (her Item 2.1/2.3): do notes +
  outreach really vanish on reactivation and on registrant→participant
  conversion, or are they retained but not DISPLAYED? Hunch: display
  (intake_note rows live on the intake item; a reactivation creates a
  NEW item, and the chart may only show the current item's notes).
  Prove against data, then either fix the display (show full history
  across a person's items) or fix the retention.
- **Her first-load glitches** (Item 3.1/3.2: send-back item vanished
  once; clicking an item did nothing once; both self-healed on
  reload) — browser-walk the queue's first-visit path; smells like a
  page-load race.
- **Assignment logic questions** (Item 3.3): send-back went to HER (she
  holds both roles) instead of Tom (the CM who sent it) — check
  send_back's sent_by path for the both-roles case; and DESIGN ANSWER
  needed for multiple case managers (today: first position holder gets
  it — confirm with Bill/Erica whether that stands).
- **Label + button batch** (her Questions 1/3/4 + Item 3): reactivation
  search by NAME + recent list; reactivate label wording; origin-aware
  back link (roster vs intake queue — use PageContext, not a hardcoded
  label); enroll/invite buttons on the Intake Queue; "View participant"
  → "View chart"; her invite/register wording suggestion (Bill's call
  on nomenclature).
- **Her lifecycle questions** (Item 2): where do inactive people go
  (findable list?); a single every-person-ever-touched view regardless
  of status. DESIGN — sketch options for Bill/Erica, don't build
  unasked.

**2. Then: THE NETWORK DIRECTORY (her #3, the first big buildable item)**
— fresh session, her spec is the contract
(PI2_Network_Directory_Build_Specification.docx, filed S141; canonical
notes in the JULY PACKET section below).

**Awaiting (no action):** her document access rules (SHE is writing
them — unlocks her #1 + the real-files gate); her registrant retest
after the v125 deploy; her RED→SENTINEL word (one-row config when given);
Washington kickoff ~Aug 15 (decides the monitoring-track MEL).

## ▶ ERICA'S RANKING — THE BUILD ORDER (received 2026-07-20, Session 148)

Her reply to master list Edition 1 (verbatim ranking; email in Bill's
mailbox). **Edition 1 confirmed COMPLETE — "I don't see anything
missing."** The Large Enhancements ranking IS the build order now:

1. **Document Repository** — spine + screens already LIVE (v121 + S147).
   What remains are DECISIONS, not code: (a) **role-based document access
   — the one decision we owe HER, now blocking her own #1**; asked in
   Bill's reply (who sees what: case manager / medical director / admin;
   does a participant see their own). The gate stands: no real documents
   until built. (b) Phase B vendor picks + BAAs (Bill's): production
   object storage, inbound fax, OCR.
2. **Consent Architecture** — SHE drives it: legal review of Layers 1+4;
   each state's PHP supplies its own layers. Build hooks (e-signature,
   stored consent records, revocation) come after legal signs off.
   Nothing buildable yet.
3. **Network Directory** — her spec (filed S141). **THE FIRST BIG
   BUILDABLE ITEM** — the natural next construction project.
4. **Medication Registry** — depends on the repository (evidence loop).
5. **Resource Library** — she is producing the content (plus the clinical
   instruments library incl. licensing/proprietary questions).

**Her "Maybe in the Future" intelligence (the monitoring-track parity
list from her competitor comparison):** Washington may need items 1-3
(daily check-in, secure messaging, time-off requests + forms library)
depending on kickoff (~Aug 15); Wisconsin eventually wants 1-7 (adds
labs, random test selection + notice, collection site finder, chain of
custody), then the rest (calendar, GPS attendance, appointments/
reminders, billing/ledger, camera capture, escalate-until-acknowledged,
board reporting). MEL discipline applies — the whole team blessed Bill's
MEL framing by email 2026-07-17 (Tom: "perfect way to frame our
priorities"; Erica: "our base is our own").

**Her question, answered in Bill's reply:** "Secure messaging — we
already have this with notes, correct?" Partly: staff notes are
attributed record-keeping, NOT messaging; staff↔participant messaging
doesn't exist (participants have no logins) and is gated on HER consent
architecture (#2 unlocks it).

**BOTH ANSWERED (her short follow-up, 2026-07-20):** (a) the document
access role model: SHE IS WORKING ON IT ("I will work on the document
repository rules") — the gate stays until her rules arrive and get
built; (b) update rhythm decided: **NO heads-up before, a NOTE AFTER
each update lands.** That is now the standing release process: deploy,
then send a short note. She also confirmed the messages-vs-notes
explanation landed.

## ✅ Session 147 (2026-07-19): DEPLOYED TO ERICA — one release, everything through v122, LIVE AND VERIFIED

The whole sequence completed same-session on Bill's go: screens + fix
built and proven → full suite green (87/2,030) → committed + pushed, CI
green twice → dress rehearsal on a copy of her live data (caught 3
test-honesty gaps, fixed + re-proven both environments; VPN had to be
turned off for pg:pull — port 5432 was blocked) → Heroku push +
migrations v111→v122 (counts matched rehearsal: 270 ML echoes, 8
orphans) → live verify (ML engine healthy, screens serving) →
deploy-day extras done (Erica = live person #104 clinician-flagged with
ZERO intake items, EricaL linked + wa_php granted) → announcement email
on Bill's clipboard (Erica, Tom cc'd). Full record in STATE.md +
Insight Build Notes.

**THEN, same session — the SESSIONS 142-147 SECURITY AUDIT.** Six
read-only lenses; foundations verified sound; six Tier-1 fixes built,
tested, DEPLOYED + live-verified (Heroku now **2026.07.19.2131 / DB
v123**). Full report + disposition:
**docs/PLATFORM_AUDIT_2026_07_SESSIONS_142-147.md**.

**ONE THING OWED (needs a decision — the other is now BUILT):**
0. ✅ **Registration abuse-resistance (audit #5) — BUILT Session 147**
   (Bill's decisions: hand-built, thresholds in settings). Per-IP rate
   limiter on login + register (sysparm-tunable, v124), single-use links
   enforced at the write. Tested + proven; awaiting the Heroku deploy go.
1. ~~**Registration abuse-resistance**~~ (DONE — see above).
   (a) Rate limiting on `/v1/register` + `/v1/auth/login` — needs a
   choice: add `express-rate-limit` (a dependency) OR hand-roll a per-IP
   limiter, AND threshold numbers (it throttles Erica's LIVE login, so
   wrong numbers lock her out). (b) Single-use links aren't enforced on
   the write: `/p/:code` (landing) consumes the code but `/v1/register`
   (write) doesn't — the fix is to move the use-count to the register
   write and stop the landing consuming it. Lower urgency: links are
   staff-distributed today. Recommendation in the audit doc.
2. **Document role-based access** (audit #2, PINNED TO A GATE).
   **DECIDED (Bill, 2026-07-20): this is an ERICA decision** — she wrote
   the Network Directory / repository spec and owns the role model (what
   a case manager vs. medical director vs. admin sees; whether a
   participant sees their own). ASK HER alongside her release walk +
   ranking. The GATE stands: **no real (non-test) document uploads until
   role-based access is built** — unlocks with Phase B (storage + BAAs).
   Until then any logged-in user in a program can read every document —
   fine because only test files exist.

**Audit follow-ups that need NO decision (grab as filler):** Tier-2 #8 —
wrap the intake action/activation/reactivation handlers in item-row-locked
transactions (check-then-act, same class S145 closed for member writes;
low odds, self-contained). Tier-3 hardening batch (login enumeration,
prod CORS/SameSite, the `req.tenantId || req.query.tenant_id` fallback
cleanup, document nosniff + list-audit) — all in the audit doc.

**WAITING ON ERICA (still drives the real roadmap): her walk of the new
release** (intake workflow, documents, credentials, the chooser) + the
master list Edition 1 completeness check and Large ranking — those set
the next build. Tom's login = still Bill's call.

**Standing rule (carried):** test documents only on Erica's live site
until production file storage + BAAs exist.

**Phase B of the repository (parked — decisions, not code):** inbound-fax
vendor + BAA; OCR build-vs-buy + BAA; production encrypted object storage
(new backend in document_storage.js + locator-walking migration);
auto-classification threshold; retention periods with counsel.

**Small carried notes:** (a) no manual create-link screen for document
linked records — system flows will set those pointers (med-registry
evidence); build a screen only if Bill asks. (b) Future tenant standups:
REG_REVIEW's rule/criterion is created per-tenant by v122 for tenants
that exist now; a NEW workforce tenant's standup should get the same
gate (check when the next state stands up).

## ✅ Session 145 (2026-07-18): THE JULY AUDIT CLOSED — CI red fixed, Tier-2 part 2 (four check-then-act windows), v118 orphan sweep

Full story in STATE.md + Insight Build Notes. All four windows now ride
one member-row-locked transaction (S138 pattern) with plain-English 409s;
the new test caught a REAL extra bug (ML_RISK_SCORE read lowercase .n1/.n2
against UPPERCASE keys — a junk history row on every scoring call, and the
ML history endpoint empty since it shipped — both fixed; ⚠️ Erica's live
site carries the broken readers until the queued deploys ship, and a
junk-history cleanup on live is an optional later migration). v118 swept
the 26 orphaned rows by rule. Parked by design: cache-reload window
(single dyno), entity-code merge (someday), the audit's "standing guards"
(side-filter lint rule + horizon census test) as a future filler story.

## 🖋️ WASHINGTON — stood up locally Session 144 (LOI signed 2026-07-16)

wa_php EXISTS locally (v116) + the tenant chooser (v117) — full story in
STATE.md. Erica's LOCAL login has the wa_php grant (live grant happens at
deploy). Tom HAS a live login now (TomJ on Wisconsin — seen active and
receiving a send-back notification 2026-07-21 evening; no linked person
record yet, no wa_php grant). WA licensing-board names need
kickoff confirmation. Kickoff ~Aug 15; RecoveryTrek migration + lab
integration get scoped there, not before.
**Kickoff checklist (grows as items land):** confirm licensing-board
names; **configure WA health systems + clinics** (the picker shows an
honest "No health systems configured yet" empty state until then —
Session 158 ruling, deliberately NOT placeholder data on a
production-bound tenant); **convert wa_php REG_REVIEW to a
promotion_result row** (found Session 159 during the docs truth pass —
WA's Registration Review Trigger is the ONLY real promotion still
running on the legacy `promotion.reward_type` fallback; wi_php's twin
already has a proper result row. Harmless today — WA has 0 members so it
has never fired — but it must be converted BEFORE anyone registers there,
and it would break silently if the legacy fallback were ever retired.
Small migration, no decision needed. Bill's call Session 159: not worth
a same-day migration + deploy for a tenant with nobody in it).

## 🖋️ WASHINGTON SIGNED — the first papered deal (LOI executed 2026-07-16)

**WPHP (Washington Physicians Health Program) signed the LOI on July 16,
2026** — Sheldon Cooper (Executive Director) + Erica for IHS. The FIRST
program to sign; Wisconsin has not signed yet. Bill: Washington is the
national leader — states follow what Washington does.

**The LOI document itself is confidential and stays OUT of this repo.**
Bill holds the PDF. What planning needs to know:

- **Kickoff meeting ~by Aug 15, 2026** (30 days from execution)
- **Functional PILOT due ~Oct 16, 2026** (3 months): technical validation,
  workflow testing, RecoveryTrek data-migration validation — NO live
  enrollment in pilot. A mutual feasibility gate follows it.
- **FULL PRODUCTION by June 30, 2027**: risk scoring, clinical workflows,
  enrollment. Iterative UAT with WPHP clinical coordinators from the pilot
  onward. 1-2 month instrument-calibration period after launch.
- **Monthly progress updates to WPHP start now** — a standing deliverable.

**Build implications (sequence with Erica's ranking when it arrives):**
1. **The wa_php tenant** — the second state, the multi-tenant thesis made
   real: standing it up should be configuration + per-state content, not
   construction. What IS net-new gets scoped at kickoff.
2. **RecoveryTrek data migration** — all WPHP participant/monitoring data;
   joint quality/format assessment during development; migration validation
   is a pilot deliverable. (RecoveryTrek is the competitor from Erica's
   comparison — no predictive risk scoring.)
3. **Lab integration** moves up the priority list (lab services agreements
   are committed for pilot + production; Tom is working lab vendors).
4. **The tenant chooser (multi-state operator)** — Bill confirmed
   2026-07-16: a login authorized for MORE THAN ONE program gets a
   "choose a program" step at login + a header switcher (Erica/Tom
   overseeing WI + WA). One-tenant logins see no change; program staff
   stay confined exactly as today. Touches the S121 tenant-isolation
   wall — the cross-tenant attack tests must grow to prove "authorized
   for two" never softens "confined to yours." Connects to the S127
   person-model / login→person bridge direction.
5. Chris Bundy's 7 capability criteria (memory: project_washington_state)
   are the WA checklist — data portability and security posture are in
   the LOI's definitive-agreement scope.


## ✅ Session 140 (2026-07-11/12): DEPLOY DAY — dress rehearsal caught 3 real bugs, v96–v109 LIVE on Erica's site, double-enroll closed, v110 + 498/sec. Her TESTING FEEDBACK arrived at wrap (unread).
Full story in STATE.md. Local: SERVER_VERSION 2026.07.12.2329 / DB v110 /
lint 0. Heroku: 2026.07.12.1112 / v109 — live-verified. **v110 (commit
`0debd62`) is LOCAL-ONLY** — GitHub/Heroku are at v109.

## ▶ ERICA'S TESTING FEEDBACK (received at 140 wrap, READ + TRIAGED Session 141, 2026-07-13)

Email verbatim: `verticals/workforce_monitoring/tenants/wi_php/Erica_Testing_Feedback_2026-07-13.md`.
Two attached specs filed alongside it:
`PI2_Intake_Workflow_Build_Specification.docx` and
`PI2_Network_Directory_Build_Specification.docx`.

**What's working (her words):** affiliations, the instruments section +
cadence assignment, MEDS updating, invite → enroll → escalate to Medical
Director → bell + registration section. The deploy landed well.

**DEFECTS — 1, 2, 3 FIXED Session 141 (same day), verified live + targeted
tests green (7 tests / 179 asserts incl. a new portal walk); defect 4 folds
into the intake rebuild. The enroll-page 409 politeness (S140 queued fix)
rode along. SERVER_VERSION 2026.07.13.2143. Awaiting Bill's cue: full
suite → commit → GitHub → CI → Heroku → release email to Erica.**
1. **Instruments card intermittently missing on the participant chart** —
   `physician_detail.html` `loadInstruments()`: the card starts
   `display:none` and only shows if the fetch succeeds; ANY transient
   failure → `console.warn` only, section invisible, no retry, no error
   shown. Fix: surface the failure + retry; find the underlying
   intermittent error in her Heroku logs (what is 500ing/timing out?).
2. **Assigned instruments never reach the participant portal** — THE BIG
   ONE; blocks her question-9 alert test. `physician_portal.html`
   hardcodes its offers: "Take survey" = always `startPPSI`; anchor
   battery = a fixed 5-instrument list. It never calls
   `GET /v1/members/:id/instruments` / getExpectedInstruments — the
   participant-facing surface was the missed adopter of the v97
   assignment model (wellness.js + exports.js were adopted S132; the
   portal wasn't). PHQ-9/GAD-7 aren't in the hardcoded list at all.
   Fix: portal builds its survey offers from the member's expected set.
3. **QR doesn't prepopulate referral type (copied link does)** — the
   refer modal's QR and Copy button encode the IDENTICAL
   `/p/:code` URL (`refer_participant.js` `_show()`), so the modal QR
   should carry context. Prime suspect: she used the standalone
   `performance_profile_qr.html` demo page (Session 122, Tom's demo) —
   its QR points at the bare front door with NO referral code. Confirm
   which QR she scanned / repro; likely fix = retire or upgrade the demo
   QR page.
4. **Escalated items indistinguishable in the registration list** — true
   as built (S129 Escalate leaves the item in the same list, same form).
   Superseded by the intake spec, which retires Escalate entirely —
   fold into the intake rebuild, don't patch separately unless she needs
   interim relief.

**HER QUESTIONS (answered in-session, Bill to confirm):**
- **Two link types** (registration link = requires demographics, creates a
  record for case-manager review; screening link = anonymous front door,
  usable for promotion). Recommendation: YES — the code system already
  carries typed codes + context; a `registration` code type creating a
  REGISTRANT (per the intake spec) + intake-queue item is the natural
  build; ties to the L1 agreement acceptance flow when legal signs off.
- **Credentials at enrollment — CONFIRMED by Tom + Erica (2026-07-14),
  ready to build:** design = CREDENTIAL internal-list member molecule
  (one credential per row, multiple rows allowed — "Jane Smith, MD, PhD");
  ONE FLAT LIST, deliberately NOT partitioned by board/profession (Tom:
  "they can be assigned to any board" — maxillofacial surgeons hold DDS
  under the medical board; never couple credential↔licensing board);
  retire-not-delete honored platform-wide (molecule_value_text.is_active
  EXISTS but NO code reads it yet — encoder must refuse retired values
  for new writes, pick-lists hide them, stored history decodes forever);
  a Credentials CRUD page under Program Settings (licensing-boards page
  is the template) so Erica's team owns the list; display rule
  "Name, CRED[, CRED]" everywhere (Erica literally signs "Erica Larson,
  D.O."). Original Tom answer:** NO
  honorifics (Mr./Ms./Mrs.) unless a state requires them; credentials
  chosen from a curated per-profession list, displayed after the name
  ("Jane Smith, MD"). Tom's starting set: physicians MD / DO / MBBS /
  MBChB / MBBCh / BMBS / BM BCh; PAs PA-C; nurses LPN / RN / NP
  (expects growth — "alphabet soup"); dentists DDS / DMD / BDS
  (maxillofacial surgeons sit under BOTH boards). Build as a data-driven
  list (adding a credential = an entry, not code). One shared name
  formatting rule used everywhere.

**CHANGE REQUESTS:**
1. Bell click on a new registration lands on the item itself, not the
   Registry in general — small, but the target surface changes with the
   intake rebuild; do together.
2. Title/credentials — above.

**THE INTAKE SPEC (`PI2_Intake_Workflow_Build_Specification.docx`)** —
corrects + separates what S129 built: Intake Queue (administrative,
registrants, SLA-prioritized) split from the Stability Registry
(clinical, participants, tier-prioritized). Registrant vs participant as
distinct record populations; conversion at exactly ONE moment (signing
the monitoring agreement); 10-status intake lifecycle; role-scoped
actions enforced server-side (case manager cannot approve entrance;
Medical Director gets "send back with reason" — Escalate and Advance are
retired); intake items drop Urgency/Source (no clinical tier on an
unassessed registrant) and gain review type / assigned-to / stage;
reactivation is first-class (history carries forward, never re-register).
One deliberate intake→registry connection: a positive Columbia (C-SSRS)
screening at intake fires SENTINEL immediately. Open decisions she lists
(who performs outreach — confirm with Jim Lorence; SLA auto-escalate;
registrant retention; reactivation trigger) are NOT ours to close.

**THE NETWORK DIRECTORY SPEC
(`PI2_Network_Directory_Build_Specification.docx`)** — SUPERSEDES the
July-packet evaluator-directory / IHS wellness-directory materials
(packet item #6). Three named systems now canonical: **Network Directory**
(entities), **Resource Library** (content, spec'd separately, she's
producing it), **Document Repository** (internal records service, already
spec'd). Directory = two sections sharing a data model but not
governance: Monitoring Program Network (program's own list, no IHS
verification, money NEVER touches it — hard firewall) + IHS Network
Directory (Listed/Verified states; verification is credentialing — fee
buys the review, never the outcome; paid features only for Verified,
never inside a program's list). Program config = one setting: IHS only /
Program only / Both. Participant selections are PARTICIPANT-SCOPED at
the data layer (program staff cannot read them — the requirement she
flags as "most likely to be broken quietly in build"); sharing only via
an executed release (42 CFR Part 2-shaped) filed to the Document
Repository under Consent Layer 3. Appendix copy is normative. Her §10
open decisions stay open — do not close in build.

## ▶ THE INTAKE REBUILD — DESIGN CONTRACT LOCKED (Bill, 2026-07-14, Session 141)

Erica's intake spec adopted whole. Bill's decided shape — implementation
conforms to THIS, never renegotiate from code wrinkles:

1. **One population, one truth: the INTAKE_STATUS internal-list member
   molecule, ELEVEN values** — Erica's ten lifecycle stages (Registered /
   Case manager review / Medical director review / Routed to resources /
   In screening / In evaluation / In treatment / Pending reactivation /
   Declined / Closed) **plus 'Participant'.** Signing the monitoring
   agreement = a status change on the same record; history rides; the
   roster is "status = Participant", the intake queue is the open
   registrant statuses. Explicitly REJECTED (Bill, after weighing it): a
   separate Participant FLAG overriding the status — two facts that can
   drift; the populations are disjoint by spec, so they're values of one
   field. Migration backfills all existing members to 'Participant'
   (Erica's 26 live participants unchanged on day one).
2. **The intake work item gets its OWN table** — deliberately not
   stability_registry (separation by construction; intake items can never
   pollute clinical tier counts). Reuses the proven patterns: named
   owner, SLA clock, triage notes, audit. Migration converts existing
   open registration-review registry items; the Registrations chip
   leaves the Stability Registry.
3. **The Intake Queue page** — new surface beside the roster; filters:
   stage, referral source, owner, SLA state (on time / due soon /
   overdue). NO clinical tiers anywhere on it.
4. **Role-scoped actions enforced SERVER-SIDE** (the platform's first
   real permission gate, riding the POSITIONCLINIC positions Erica
   already assigns): Case Manager = add note / route to resources / send
   for director review; Medical Director = approve for screening / refer
   evaluation / refer treatment / route to resources / SEND BACK with
   reason (the missing return path) / close file. Escalate + Advance
   RETIRE. Wrong-role requests refused by the server, not just hidden.
5. **Build order:** Phase 1 skeleton = status molecule + backfill,
   intake item table + conversion, queue page, role actions. Phase 2
   doors = registration link (demographics → Registered person + intake
   item), participant activation (accept assigns clinic + starts
   instruments), Columbia screening at intake (positive → SENTINEL — the
   ONE deliberate intake→registry wire). Bell-lands-on-item rides
   Phase 1.
6. **Erica's open decisions STAY OPEN** (outreach owner — Jim; overdue
   auto-escalate vs flag; registrant retention; reactivation trigger).
   Defaults until answered: outreach clock = case manager (her spec's
   assignment); overdue = flags, stays with case manager, configurable.

## ▶ REMAINING QUEUE (post-142)

1. ✅ **Intake Rebuild Phase 1 — BUILT Session 142** (commit `37a161b`,
   v111; full story in STATE.md). **NEXT BUILD: Phase 2** — the doors,
   per the same locked contract: registration link (demographics →
   Registered person + intake item), participant activation (accept
   assigns clinic + starts instruments — the moment someone signs the
   monitoring agreement and joins the roster), Columbia at intake
   (positive → SENTINEL, the ONE intake→registry wire), reactivation.
   Its own release after the Phase 1 release ships (Bill: one feature
   per release).
1b. **PENDING DEPLOY: the whole Session 142 bundle** (v111+v112 +
   intake rebuild + startup rule) ships as ONE announced release —
   "your intake spec is built" — after Erica's retest feedback, on
   Bill's explicit go. ⚠️ First deploy under the all-or-nothing rule:
   her site won't boot without a healthy ML engine (her dyno runs one —
   verified live 2026-07-14).
2. ✅ v110 + Session 141 fixes DEPLOYED to Heroku 2026-07-14 (release
   v101, version 2026.07.13.2143, DB v110, live-verified). Heroku's
   Delta never had the junk promotions — local-only residue.
3. ✅ **The master list — PROCESS ESTABLISHED + Edition 1 PRODUCED**
   (see memory `project_erica_masterlist_process` + STATE). Google Drive
   idea replaced by Bill's better read of Erica: dated .docx editions
   EMAILED. Edition 1 sits in `wi_php/project_status/`. **SENT — Bill
   emailed it to Erica (confirmed 2026-07-17, Session 144).** Now waiting
   on her completeness check + Large ranking (sets the build order) and
   her update-rhythm answer.
4. **Small queued fixes:** (a) ✅ enroll-page 409 politeness — DONE
   Session 141 (deployed); (b) ✅ interrupted-test-run restore — DONE
   Session 142: PROVEN leak (a run killed 75s in left 13 activities +
   9 surveys), then run.cjs gained SIGINT/SIGTERM handlers that restore
   the snapshot + refresh server caches before dying; re-proven clean
   (killed run restores itself, zero residue).
5. **Gap-filler, fully specified, both co-owners confirmed:** the
   credentials build (see the confirmed design above) — NOT top of list
   (Bill's call); grab it when intake work is waiting on an answer.
6. **Parked (diminishing returns):** stress-TOOL inefficiencies — it loads
   all 5M members into server memory per job (~1 GB spike) and picks members
   via deep LIMIT/OFFSET. Fine for occasional use.
7. **Flagged Session 141:** MEDS "Consecutive Missed Events" notification
   dedup (5,000+ identical criticals since March; body names no member).
8. ✅ **Testing-gap follow-up — DONE Session 145:**
   insight/test_participant_day_walk.cjs (20 asserts) — one record walks
   invited → registered → activated → assigned → portal → take → RED
   alert (Erica's blocked question-9 test end to end). Journey healthy.

**Session-140 operational notes worth keeping:**
- Dress-rehearsal recipe: `heroku pg:pull` needs the newer pg_dump (brew's
  `libpq` — Heroku runs Postgres 17; installed Session 140); restore as
  `loyalty_rehearsal`; `DATABASE_NAME=loyalty_rehearsal node db_migrate.js`;
  run the server with `PGDATABASE=loyalty_rehearsal` (since Session 142 a
  direct launch also needs `STARTCHECK=Pointers` — the launch handshake);
  run the suite with both env vars (run.cjs now forces PGDATABASE =
  DATABASE_NAME itself).
- Tests are environment-honest now: personas/programs resolve by NAME
  (Steadman #53 local / #60 live; Grace 46/53; demo program 30/31).
  Write new tests that way — no hand-entered ids, relative counts.
- Membership numbers: unique WITHIN a tenant (v107); cross-tenant sharing
  legal. Number reserved atomically at enroll-form open; Save locks during
  save; duplicates answer as a plain-English 409.

## ▶ ERICA'S JULY PACKET (received 2026-07-11, Session 140) — the standing Erica roadmap

Nine documents + her email. Source files:
`verticals/workforce_monitoring/tenants/wi_php/` (her working docs, untracked).
Her email also says SHE is producing two more things herself (content, not
build asks): a clinical instrument library and a resource guide library for
screening completers. None of this changes the held deploy — these are
roadmap items, not deploy blockers.

**1. Competitor capability comparison** (`PI2_Competitor_Capability_List.docx`)
— her "most important." RecoveryTrek vs Affinity SPECTRUM, built from public
screenshots. What BOTH competitors have that Pointers/Insight does not (the
table-stakes checklist for the monitoring track): daily check-in, random
test-selection engine + notice, chain-of-custody (COC) number reporting,
collection-site finder, participant calendar, secure messaging, camera
document capture, in-app billing/ledger (Affinity native), meeting-attendance
GPS (Affinity), travel/medical time-off requests + forms library
(RecoveryTrek). What NEITHER has: **predictive risk scoring — PI²'s
differentiator** — plus no NPI prescriber verification, no OCR pre-fill, no
auto med-vs-result reconciliation (all three are in Erica's med-registry
spec, i.e. deliberate leapfrogs). Use this as the gap checklist when scoping
monitoring-track features; includes competitor test pricing for reference.

**2. Medication Registry Module — build spec 0.1**
(`PI2_Medication_Registry_Build_Spec.docx`). Record-and-reconcile only
(explicitly NOT ordering/prescribing/pharmacy — compliance requirement, not
backlog). Core: structured med entries anchored to RxNorm (free NLM standard,
public RxNav API); two curated reference tables (med→analyte map with
detection windows; immunoassay cross-reactivity) treated as governed clinical
content — forward-only, version-stamped, clinical sign-off; quarterly +
event-triggered participant attestation (a positive screen forces
re-attestation before adjudication); positive-screen reconciliation →
Consistent / Partial-Unverified / Unexplained → review queue, human medical
reviewer always decides (never auto-clear); unexplained confirmed positive →
PPII event signal + risk-tier move; participant photo/OCR evidence capture
(evidence stored in the Document Repository). Platform mapping: review
queue/registry/signal machinery exists; RxNorm + reference tables + attestation
loop are net-new. **Depends on the Document Repository (#5).** Nine open
build decisions listed in her §9 (PDMP ingestion, license-vs-build the
analyte tables, OCR vendor + BAA, cadence, reviewer role…).

**3. Consent & ROI architecture — DRAFT for legal review**
(`IHS_PI2_Consent_Architecture_DRAFT.docx`). The long-awaited Q6 consent
model, now written as a framework: **4 layers** (L1 base participant
agreement / L2 state-specific PHP monitoring agreement / L3 42 CFR Part 2
authorization when SUD treatment data flows / L4 per-recipient
purpose-specific ROI) × **3 pathways** (screening-only = L1 only;
optimization-track = L1 + L4 if sharing; monitoring-track = all four).
State addenda sketched for WI, WA, OH, PA, TN with named contacts. Next
steps are LEGAL (retain multi-state PHP counsel; collect partner PHPs' real
consent docs). Build implications when it lands: e-signature + per-layer
consent records, per-disclosure audit trail, revocation handling. **This is
the framework that gates participant-facing email/SMS (Damian's item 2) and
real self-registration.** Washington will supply their own consent docs.

**4. Layer 1 Participant Agreement — draft**
(`IHS_Layer1_Participant_Agreement_Draft.docx`). The actual L1 document —
Erica says it "just needs legal review." Covers all three pathways;
bracketed items for counsel (retention days, governing law, arbitration).
First build hook once legal signs off: an acceptance flow (electronic
acceptance + stored record) at screening/registration.

**5. Document Repository — shared-service build spec 0.1**
(`PI2_Document_Repository_Build_Spec.docx`). Shared PHI file service:
encrypted object storage separate from the DB, one metadata record per file
(type taxonomy, participant + optional entity linkage, version, retention
class, legal hold, checksum), ingestion via upload / inbound fax-as-PDF /
secure email / API, OCR + auto-classification, role-based access +
tamper-evident audit of every view/download/change, full-text search.
Explicitly not authoring or e-signing. Consumers: med-registry evidence
(#2), outside assessments/evaluations, executed contracts, consent forms
(#3/#4). **Foundation piece — the med registry's evidence loop can't build
without it.** Her §8 positions it against Epic/athena/Cerner: parity on
mechanics, differentiator = program-entity linkage; receive-don't-replicate
on interop.

**6. Wellness & Support Directory — ⚠️ SUPERSEDED (Session 141) by the
Network Directory spec** (`PI2_Network_Directory_Build_Specification.docx`,
see the testing-feedback section above). The three docs below remain
useful background (the fee schedule is being recast as a
verification/re-verification fee), but the directory design of record is
now the Network Directory spec. Original packet notes:
(3 docs: `IHS_Directory_Listing_Standard`,
`IHS_Directory_Listing_Application`, `IHS_Directory_Fees_and_Tiers`).
**Separate from PHP work — Erica's potential first revenue.** Public curated
directory of coaching/wellness/support providers for healthcare
professionals. Tiers: Listed (free, self-attested) / Verified ($349/yr,
credential-reviewed) / Featured ($549/yr, disclosed paid placement) /
Organization (custom). Careful legal framing throughout: flat fee never
referral-based, listing ≠ referral/endorsement, verification earned not
bought. Complements screening→resources. Platform mapping: the evaluator
directory (Stage 3, built) is the seed pattern; net-new = application +
vetting workflow, paid tiers/billing, public search front end.

**7. Treatment Provider Application**
(`PI2_Treatment_Provider_Application.docx`). Intake application for the PI²
**treatment-provider NETWORK** (distinct from #6's wellness directory):
facilities offering evaluation/treatment to health professionals. 42 CFR
Part 2 compliance + accreditation (ASAM/JCAHO/CARF) required; ASAM levels of
care; healthcare-professional track; staffing; bed capacity (real-time
professional-bed availability in the PI² profile); outcomes tracking with
consent to reconcile against monitoring data (required); 12 communication
obligations (1-business-day notice of AMA departure / positive screen /
level-of-care change, weekly progress reports, discharge timelines); scored
across nine domains → network tier that governs referral routing. Platform
mapping: partner/tenant + registry machinery help, but network tiering +
referral routing are net-new.

**Sequencing view (for when Bill picks builds):** #5 Document Repository is
the foundation (#2 depends on it; #3/#4 consent records use it). #3/#4 are
legal-gated, not build-gated. #1 is a checklist, not a build. #6 is
standalone and revenue-motivated. #7 rides the monitoring-track buildout.

---

**Still open from Session 138 (unchanged):**
- **Tier-2 remainder triage with Bill** (docs/PLATFORM_AUDIT_2026_07.md):
  MEDS cluster is DONE; still open — error-shaped-as-data catches
  (exports.js blank clinician column, licensing.js null board, registry.js
  swallowed notification fires + audit diff), check-then-act windows
  (member-molecules PUT, clinician assign, ML upsert, badge add), ML
  baseline phantom zeros, cache-reload window (single-process today),
  Tier-3 housekeeping.
- **Candidate filler:** extend the Erica walk to clinic.html + the public
  Performance Profile front door (Bill asked "do all the pages work?" —
  those two are the honest gaps in the blanket claim).
- **Open design decision for Bill (audit 1.4 residue):** a real
  login→person bridge. Both display-name notification branches deliver to
  ZERO logins in live data. Ties into the Session-127 "person is a person"
  direction. Until built, name-matching is tenant-scoped + refuses
  ambiguity.

**Also standing:**
- BT is DELETED (v108, Bill's call — it was half-built and poisoned the new
  accrual transaction). If Bill wants a test molecule later, create it via
  createMoleculeComplete (builds the table + proves a round-trip) — do NOT
  resurrect BT by hand.
- Erica drafts from Session 137 (nudge + post-deploy announcement) still
  usable; announcement goes ONLY after the Heroku deploy.
- Standing rules: announce EVERY test run; full-suite runs on Bill's cue;
  nothing to GitHub/Heroku without his explicit go. S137 test rules hold
  (own state, no hand-entered-data assumptions, relative asserts, capture
  suite output to a file — never re-run just to re-read failures).

## ▶ SOMEDAY / BACKLOG — moved to docs/OUR_LIST.md (2026-07-25)

Platform-side ideas and parked backlog now live ONCE, in
**docs/OUR_LIST.md** (Bill's platform list — the sibling of Erica's
master list). When Bill says "add this to our list," it goes there.
The index tidy-up + usage-based index audit entries moved there
verbatim; the Groups + MEDS platform design (docs/GROUPS_AND_MEDS_DESIGN.md)
is its first Large entry.

## ✅ Session 135: FLAG molecules DONE (QUEUED item 1 — built, proven, all local)

Flag is a first-class third molecule type (Dynamic stores / Reference queries /
**Flag marks presence**). All four scoped pieces landed; suite 68/1382 green, lint 0,
DB **v102**, SERVER_VERSION 2026.07.07.1218. Local commits only — nothing pushed.

1. **The one flag door:** `setFlag`/`clearFlag`/`isFlagSet`/`getFlaggedLinks` +
   `flagCondSQL` (for set-based queries) in pointers.js, exposed on `ctx.molecules`.
   The side ('A'/'M') comes from the DEFINITION's attaches_to (several flag defs lack
   lookup rows, so the storage-info default guessed 'A' — the §5.2 trap); an override
   naming a side the flag doesn't have is rejected. The generic row helpers refuse
   zero-column molecules and point to the flag door. Every hand-roll folded: IS_DELETED
   trio (now thin wrappers; special-purpose cache removed), member-timeline NOT-EXISTS
   ×2, clinicians.js, custauth FILTER_MEMBER_LIST, scoring_history FULL_PPSI, ml-report
   exclusion (whose missing-molecule branch was a latent 500).
2. **Create:** `createMoleculeComplete` accepts pattern '0' — plain-English validation
   (needs a side on 5-byte parents; no columns/values/composites), `ensureStorageTable`
   builds `{n}_data_0` presence tables (PK p_link+molecule_id+attaches_to), prover uses
   set→confirm→clear→confirm-absent. Admin page offers the Flag type (form = name/label
   + parent size + attaches-to); molecules list shows Flag as its own type + filter.
3. **Rules:** "is set" / "is not set" operators — criteria editor offers ONLY those two
   for a flag (value box hidden; the S134 trap is closed), criteria CRUD accepts them
   with no value, and `evaluateCriteria` checks row presence (member flags via
   memberLink; activity flags via a new optional activityLink plumbed through both
   engines + both simulations).
4. **Member flag doors + acceptance test:** GET/POST/DELETE `/v1/members/:id/flags/:key`
   (set/clear need a login). `tests/core/test_flag_molecules.cjs` (32 asserts) proves
   the FOB scenario end to end: percent-100 bonus + "FOB is set" → double points only
   while flagged, "is not set" inverts, browser walks of the create form + editor.
5. **v102 migration:** normalizes any FULL_PPSI_REQUESTED rows from 'A' to 'M' — the old
   write path stored the member flag on the activity side (0 rows locally; Heroku may
   have some; reads didn't filter the side so nothing was visibly broken).

## ▶ ROADMAP INPUTS from the co-owners (Session 134, 2026-07-07) — Damian's email (did NOT go to Erica)

Damian's feedback lands two real work items. Both ride the agenda Erica's second
email sets (her clinical protocols shape #1's rules; her consent work gates #2's
participant-facing half). Bill's reply to Damian drafted in-chat Session 134.

1. **Red-alert escalate-until-acknowledged ladder.** Today a self-harm indicator
   (PHQ-9 item 9) → RED registry item (24h SLA) → notification routed by position —
   but IN-APP ONLY. The per-channel delivery framework (email/SMS/push records,
   critical-bypasses-quiet-hours, retry budget) is BUILT; missing: (a) the external
   provider send (Twilio/SendGrid — deliberately held pending provider selection),
   (b) the ladder Damian describes: escalate channel-by-channel (text → call → app
   alert) until receipt is CONFIRMED. No acknowledge-or-escalate loop exists anywhere
   yet. Precedent to build on: the REG_REVIEW_SLA job (overdue reviews auto-escalate
   YELLOW→ORANGE + re-route). Staff-facing — NOT gated on the consent model; buildable
   once a provider is picked.

2. **Participant friction reduction ("doctors lose their staff").** Damian's diagnosis:
   physicians in these programs abruptly lose all admin support; any perceived busywork
   → incomplete data / missed tests / non-compliance → garbage into the predictive
   model. Exists today: auto-scheduled registry follow-ups; per-participant expected
   instruments (MEDS knows who owes what, when). Does NOT exist: appointment machinery
   of any kind (appointments today are results staff record after the fact), proposed
   appointment times, calendar invites, email + day-of-text reminders. ⚠️ GATE: any
   direct email/SMS to a participant about program activities is a privacy event —
   42 CFR Part 2 / Erica's Q6 consent model (with her + Chris + legal). Design now,
   switch on behind the consent framework.

✅ **DONE Session 135 (Bill's go, while he was in a meeting): the page-layout sweep.**
Root cause was two stacked shell bugs on ~45 pages: app-layout sized 100vh under the
fixed 48px nav (bottom 48px clipped — unreachable, not just below the fold) and
theme.css's `.main-content { min-height: 100vh }` silently re-inflating the shell.
Fixed everywhere (calc(100vh - 48px) + min-height: 0); bonus/tier/molecule/partner
edit also moved their action bars out of the scroll region (position:sticky is
unreliable inside these shells — .card overflow etc.). Standing test
`core/test_page_action_geometry.cjs`: 29 page loads measured in pixels at 1280x720,
create AND edit modes, entity refs resolved live. Earlier same session: csr_member
profile got the same treatment plus a two-column layout (fits above the fold, no
scrolling) and a Cancel that actually leaves the page.

## ▶ QUEUED (Session 134, Bill-approved scope — each its own fresh session)

1. ✅ **FLAG molecules — DONE Session 135** (see the section at the top of this file).

2. ✅ **System-molecule true-up — DONE Session 135** (Bill's "keep going"; details in
   STATE.md). v103 trued up all 8 system molecules on every tenant (defs + column
   metadata + system_required); boot Layer-4 shape check refuses to start on drift
   (negative-tested); clone carries system_required + parent_bytes; identity test
   (34 asserts). **`saveActivityPoints` untouched per Bill's explicit hold** — with
   the true-up landed, routing it through insertMoleculeRow is now UNBLOCKED but
   remains its own decision for Bill. Original plan kept below for reference.

   **Original plan (Bill approved 2026-07-07):** The platform has
   two molecule kinds in one table: tenant molecules (CARRIER, LICENSING_BOARD — real
   per-tenant differences) and SYSTEM molecules (MEMBER_POINTS, IS_DELETED, the bonus
   linkage set) that must be identical everywhere — and the copies have drifted:
   **MEMBER_POINTS has molecule_value_lookup column metadata on tenants 1+3 ONLY;
   United (2), Ferrari (4), Insight (5) have none.** Decision: do NOT move to shared
   global defs (every chokepoint asks tenant+key; too deep a cut). Instead: (a) one
   migration trues up system molecules across all tenants (seed the missing
   MEMBER_POINTS column metadata first); (b) deepen the existing Session-115 boot
   check (`verifyTenantMolecules` — hard process.exit(1); currently checks the def
   EXISTS, not that its shape is complete) to verify system molecules match the
   reference shape; (c) clone flow stamps platform molecules for new tenants;
   (d) optional suite test asserting cross-tenant system-molecule identity.
   **ONLY AFTER the true-up:** `saveActivityPoints`' direct 5_data_54 INSERT could
   route through insertMoleculeRow — Bill's explicit call 2026-07-07: **leave the
   points save alone until then; it works everywhere precisely because it doesn't
   consult the (missing) metadata, and it is key.**

## Session 133: evaluator directory (Stage 3) + molecule tooling shipped locally. ERICA REPLIED — she loves it; two questions answered; a second email is coming.

**Done this session (all LOCAL-ONLY; suite 64/1300 green, lint 0, SERVER_VERSION
2026.07.06.1338, DB v99):**
1. **Vetted evaluator directory (Stage 3, db_migrate v99)** — committed `0033cd6` (NOT
   pushed). `evaluator` table + SAMPLE seeds + EVALUATOR member molecule; `evaluators.js`
   (staff CRUD + PUBLIC directory endpoint); `admin_evaluators.html` (Program Settings)
   + participant `evaluator_directory.html` at `/evaluator-directory` + dashboard Try-It.
   Fixed a real S130 bug: `/v1/code-context/:token` wasn't public, so the referral
   pre-fill silently died for anonymous participants. `test_evaluator_directory.cjs` (35).
2. **Molecule composite auto-wiring** (uncommitted at write-time; committed with handoff)
   — new shared `molecule_composites.js`, called by both the create page and migrations:
   member Required tick → M composite; activity per-type Applies/Required grid → one
   composite row per type. DELETE path also cleans composite_detail now.
3. **Text molecules made column-aware** — `encodeMolecule` dispatches per-column, so a
   text field works as an internal-table lookup in any column (not just column 1); the
   prover proves multi-column text. Single-column molecules byte-for-byte unchanged.
   Also: the create page's Numeric Value width dropdown now offers only 2/4 bytes.

### ▶ NEXT SESSION
1. **Erica's second email drives the day when it arrives.** She promised a follow-up
   with "additional information and other items." Hold the Heroku deploy and BATCH:
   the pending bundle (v96–v99: instrument library + assignment + composite closure +
   evaluator directory) + her button change + whatever's in email #2 + an announcement.
   **A reply to her first email is drafted in-chat for Bill to send** (answers both
   questions, lists the next release). A forward note to Joe + Mark is drafted too.
2. **DONE (committed `2181dcd`): the participant-invite action reads "Invite" not
   "Refer"** (Erica's request — dashboard + clinic buttons + modal header). Left the
   "By Referral Source" tab and the "Referral type" chips as-is (classification, not the
   action). Rides the pending deploy. *Open: ask Erica if she wants those left as-is.*
3. **⛔ PARKED — showing a MULTI-COLUMN molecule on the activity timeline.** Root cause found:
   the activity-display FETCH only reads the single-cell tables (5_data_1..5), so
   multi-column molecule values are never loaded for the timeline. The SAVE side is done
   + proven; the DISPLAY side changes the core timeline query every tenant uses — its own
   fresh session, whole query in view. Nothing uses a multi-column molecule today, so zero cost
   to doing it right later.
4. **Deploy note:** Session 133 is LOCAL-ONLY (nothing pushed). The next `git push heroku
   main` carries Sessions 130–133 and applies v96–v99. On Bill's explicit go, CI green first.

### ▶ THE STAGE-5 GAP Erica surfaced (design, not queued yet)
Her "I didn't see the participant after acceptance" question points at the real next
stage: **"accept into program" today just resolves the review — it doesn't activate the
participant** (assign a clinic, start their monitoring instruments/compliance). Turning an
accepted participant into an actively-monitored one is the "entering the monitoring
program" stage (WISCONSINPATH_BUILD_PLAN Stage 5), not built. Worth scoping when her
feedback/priorities land.

---

## Session 132: instrument-assignment SCREEN DONE + display surfaces adopted. Stage 2 part 2 is COMPLETE. Still waiting on Erica.

**Done this session (all verified live — suite 60/1196 green, lint 0, SERVER_VERSION
2026.07.04.1137, DB stays v97, local-only):**
1. **The Instruments card on the participant chart** (physician_detail.html) — regime badge
   (Program default / Individual schedule) + count collapsed; Manage expands the full catalog
   with per-row Assign / Pause / Resume / Edit (mode+cadence) / Remove through the v97
   endpoints. First-assignment and last-removal regime warnings; server's plain-English
   cadence rejection surfaced as-is; every change refreshes the MEDS card. Claude click-walked
   the live screen end-to-end before handing over (zero console errors, zero residue rows).
2. **wellness.js** missed-survey flag honors the member's expected set via
   getExpectedInstruments (not expected = never flagged; cadence override changes the window;
   one_time missed only until a completion ≥ start_date). Tenant-global PPSI cadence read gone.
3. **exports.js** chart-export MEDS section = the member's expected set (with mode), not the
   tenant catalog.
4. Test `insight/test_instrument_assignment.cjs` extended 28→42 assertions (export set,
   wellness window, headless browser walk of the card).

**Also done (evening, Session 132, Bill's design check → go): COMPOSITE CLOSURE (v98).**
Bill's spec for add-activity: required composite molecules must be populated (was already
built) AND data outside the composite must error (was NOT built — silently discarded).
Now: strays → plain-English 400 naming them; carry-only pipeline context is DECLARED per
tenant (sysparm `accrual_context_keys`, v98 seeds wi_php's DOMINANT_DRIVER /
DOMINANT_SUBDOMAIN / PROTOCOL_CARD); direct MEMBER_POINTS rejected with guidance; failed
calculations are loud (required = accrual rejected, optional = console.error). No-spoof
proven (sent 'ZZZZZZ', server stored 'B738'). New core/test_accrual_composite_contract.cjs
(15 asserts). Suite 63/1254 green, lint 0. SERVER_VERSION 2026.07.04.2042, DB **v98** —
the Erica deploy now applies **v96–v98**.

**Also done (late, Session 132, Bill's go): docs truth pass (plumbing item 2).** ESSENTIALS
+ MASTER corrected against live code/DB — retired date helpers (dateToActivityInt is gone;
canonical pair documented), platformToday consolidation marked DONE (was "pending"),
member_survey Unix-seconds note updated (fixed at v55), 10-instrument survey catalog +
member_instrument, notification delivery framework status (built; provider send stubbed),
audit user_link width (v88), member_id retired / activity storage shape (4 columns, points
via molecule), security section updated to post-S121 reality (was "no authentication"),
migration version now a pointer not a number (was frozen at 78), compliance UI path,
§4 line-refs flagged as approximate. Docs-only commit.

**Also done (later in Session 132, Bill's go): Delta UI test coverage — the "what's
fragile" item, CLOSED.** `delta/test_csr_ui_walk.cjs` (19 asserts — CSR member page /
point summary / posts a real flight through the template form) +
`delta/test_admin_pages_render.cjs` (24 admin pages, zero console errors). The sweep
caught a real pre-existing bug on first run: admin_users / admin_user_edit / admin_clone
double-loaded lp-header.js + auth.js ("already been declared" console errors) — head-level
duplicate includes removed (HTML-only). Suite 62/1239 green, lint 0.

### ▶ NEXT SESSION
1. **Erica/Tom feedback drives the day when it arrives** — Stage-1 refinements + the
   12-vs-122 verdict + instrument questions (proprietary picks, anchor license labels,
   GAD-7 alert thresholds). **The next Erica push bundles:** referral loop + refinements +
   instrument library + assignment machinery + screen + composite closure, with a strong
   announcement email. Deploy applies **v96–v98**, on Bill's go, CI green first.
2. No queued build otherwise — Stage 2 part 2 (assignment plumbing + screen + surfaces)
   is complete. Candidate fillers if the wait continues: per-track assignment templates
   are BLOCKED on Erica's protocol answers (they become config rows, not code); the
   **evaluator directory** (Stage 3 — unblocked, Bill decided it headlines the release
   AFTER the current bundle, build it if the wait drags); the **access-control kernel**
   (designed Session 132 — `docs/ACCESS_CONTROL_DESIGN.md`, Bill's users/groups/yes-no
   model; build when the first real gate is needed, not before).

## Session 131: molecule hardening DONE + instrument-assignment PLUMBING DONE (v97). Screen built in Session 132.

**Done this session (all verified live, suite 60/1182 green, lint 0):**
1. Migration pacing always on (`83e96ea`) — CI opts out via `MIGRATE_NO_PAUSE=1`.
2. **Molecule Tier-1 hardening (`38e5f42`)** — ONE creation routine `createMoleculeComplete`
   (`POST /v1/molecules/complete`): one transaction, §5 invariants validated in plain English,
   real-path round-trip proof, self-removal on failure. Admin create = one call. Migrations
   call the routine directly; CI's from-scratch replay is the guard (Bill's decision — no
   frozen SQL/versioning unless we ever ship to uncontrolled environments).
3. **Instrument assignment plumbing (`9a84528`, db v97)** — `member_instrument` +
   `getExpectedInstruments()` in meds.js (all four MEDS sites) + endpoints
   `GET/POST/PATCH/DELETE /v1/members/:id/instruments`. Semantics (agreed with Bill):
   no rows = today's owes-everything default; any rows = owes exactly the active
   assignments; fully paused = owes nothing; `one_time` = screening (due once from
   start_date, satisfied forever by a completion on/after it). Watch the offset: a
   Bill-epoch start_date near "today" is ~-8449, NOT a positive number.

### ▶ NEXT SESSION: the assignment screen (the second half of Stage 2 part 2)
1. **The assignment section on the participant chart** (physician_detail.html) — list the
   tenant's instruments with assignment state (GET returns `regime` + per-instrument
   `assignment`/`expected`), assign / pause / cadence-override / remove through the
   existing endpoints. Browser-walk it BEFORE Bill sees it (the Session 129 commitment).
2. **Adopt `getExpectedInstruments` on the two display surfaces** still showing the
   tenant-global set: `wellness.js` (~line 75, PPSI missed-survey display) and
   `exports.js` (~line 315, the participant chart export MEDS section).
3. Design decisions already made — don't reopen: default regime = today's behavior;
   who-may-assign deferred until role enforcement exists; per-track assignment templates
   wait for Erica's protocol answers (they become config, not code).

### ▶ WAITING ON ERICA/TOM (drives the day when it arrives)
- Review-queue feedback → Stage-1 refinements + the 12-vs-122 verdict.
- Instrument questions ride along: proprietary picks (MCMI-IV…), anchor-battery license
  labels, GAD-7 alert thresholds.
- **The next Erica push bundles:** referral loop + their refinements + the instrument
  library (+ now the hardening + assignment machinery riding invisibly) + a strong
  announcement email (Bill asked explicitly). Deploy applies **v96+v97**, on Bill's go,
  CI green first.

## Session 130: referral-code consumer DONE + instrument library part 1 DONE (v96). Waiting on Erica.

**Both built, tested, committed locally — NOT pushed, NOT deployed (Bill's explicit decision:
wait for Erica/Tom's review-queue feedback before the next push, then ship one coherent update).**

1. **Referral-code consumer (commit `4a38932`):** QR referral pre-fills the Performance
   Profile. `/p/:code` carries only the opaque token (`?c=`); new public read-only
   `GET /v1/code-context/:token` (whitelisted fields, never consumes a use); pre-selected
   referral chip + affiliation note; failure degrades to the blank form. Browser-walked.
   `test_codes.cjs` 20→35 assertions. No DB change.
2. **Instrument library part 1 (db_migrate v96):** PHQ-9 + GAD-7 (public domain) seeded as
   data + `scorePHQ9.js`/`scoreGAD7.js`; **PHQ-9 item 9 positive → PHQ9_SI_POSITIVE →
   PHQ9_SI_ALERT bonus → RED registry item (24h SLA)**; catalog metadata
   (`instrument_purpose`/`license_status` on survey, badges on admin_surveys.html; anchors'
   licensing left "To confirm" — Erica's call); screening = cadence NULL = MEDS-exempt.
   New `insight/test_instrument_library.cjs` (25 assertions). Migration runner now paces
   applied versions for Bill (TTY-only; `MIGRATE_NO_PAUSE=1` escape hatch).
   Suite **58/1119** green, lint 0. SERVER_VERSION 2026.07.03.1217, DB **v96**.

### ▶ NEXT (order agreed with Bill, Session 130)
1. **Erica/Tom feedback drives the day when it arrives** — Stage-1 refinements + the
   12-vs-122 position-shape verdict. The NEXT ERICA PUSH bundles: referral loop close +
   her refinements + the instrument library (+ a strong announcement email, like the
   review-queue one — Bill asked for this explicitly).
2. **Ask Erica alongside her feedback:** which proprietary instruments to license
   (MCMI-IV…), anchor-battery license labels to confirm, GAD-7 alert thresholds (protocol),
   and instrument priorities.
3. **Stage 2 part 2 (needs its own design pass):** per-participant instrument assignment —
   who takes what, when; screening-at-intake vs cadence monitoring. Touches MEDS.
4. Unblocked filler if the wait continues: molecule Tier-1 hardening (validate-at-creation
   + auto round-trip, parked Session 128).

## Session 129: shore-up list DONE (all 6) + POSITION/POSITIONCLINIC parity DONE (v92). Next: the assignment surface.

**Parity DONE (db_migrate v92, Bill's go):** the UI-created POSITION/POSITIONCLINIC + their
`4_data_*` tables were deleted and recreated in ONE migration — definitions (new ids 149/150),
column defs (POSITIONCLINIC col 1 borrows POSITION's list), values (value_id 1–3), tables +
indexes. By molecule_key. This migration is how the pair reaches Heroku. Round-trip re-proven
on the recreated pair (encode/decode + borrowed values). **12-vs-122 resolved by Bill:** build
on position+clinic; real use decides if the health-system level is ever needed (tables empty,
local-only — changing shape before deploy stays cheap).

**ASSIGNMENT SURFACE — ✅ BUILT + PROVEN (Session 129, later same session):**
- **Plumbing:** three generic endpoints under the /v1/users admin gate —
  `GET/POST/DELETE /v1/users/:id/molecule-rows/:key` (molecule key rides the URL, so no
  tenant-specific names in platform code). Guards: own-tenant confinement, parent_bytes=4
  required, unknown list codes 400, exact duplicates 409. Row removal reuses the EXISTING
  `deleteMoleculeRow` helper (a duplicate helper was written then removed — grep first).
- **The user-parent round-trip is PROVEN at the byte level** (the "final proof" from the
  S128 notes): position stored as squished value_id via the BORROWED list, clinic id raw,
  owner = the login's 4-byte link; removal by value tuple; tables left clean.
- **Screen:** `admin_user_edit.html` (edit mode) — a data-driven assignments section, one
  per user-level molecule of the user's tenant (Delta users: nothing shows). Position
  dropdown from the shared list; clinic picked partner-first→program (same flow as the
  physician search Erica knows). Add / duplicate-error / Remove all browser-verified by
  Claude before Bill saw it. Molecules that OWN a borrowed list (POSITION) are excluded
  from the sections — the list home is not an assignment surface.
- **Test:** `tests/insight/test_user_positions.cjs` (20 assertions) in the manifest.
  Suite now **56 tests / 1038 assertions**, all green; lint 0.
- Wording note for Bill: the field labels in the section ("The position", "The partner
  Program") come from the molecule's column descriptions — editable per tenant in the
  molecule admin, not hardcoded.

### ✅ THE REVIEW QUEUE IS BUILT (Session 129, later same session) — next: Bill click-test, then the Erica deploy
All three pieces + gates done (details in STATE.md / build notes):
- **Trigger is pure config (v95):** enroll → REG_REVIEW promotion (enrollment counter)
  qualifies at signup → external result → registry item (YELLOW/48h) → action-scoped event
  `REGISTRY_REG_REVIEW` → notification rule routes **by position** (new recipient_type
  'position', recipient_role 'POSITIONCLINIC:CASEMAN' as data).
- **Queue UI:** Registrations chip on the action queue; triage-note-required dispositions
  on REG_REVIEW items — Advance / Route to Resources / Escalate (assigns to a Medical
  Director holder + notifies with the note; actionable 409 when no one holds the position).
- **Overdue clock:** REG_REVIEW_SLA job (daily + manual-run) — YELLOW→ORANGE, auto-assign
  to MD, escalation notification; rerun-safe.
- **Two REAL pre-existing bugs found by the browser walk and fixed:** (1) clinic-scoped
  registry views hid clinic-less members — registration reviews (program intake) now stay
  visible under any clinic view; (2) **with any filter active, clicking a queue item opened
  the WRONG record** (the caseload patch renders from a temp array; position-based indexes
  went stale) — clicks now resolve items by link, never position.
- Test `insight/test_registration_review.cjs` (28 assertions). Suite **57 tests** green,
  lint 0. Walk done at admin level with a DB snapshot/restore around it (zero residue).

**✅ DEPLOYED 2026-07-02** — GitHub (CI green) + Heroku, all 11 migrations v85→v95 applied,
live-verified (version, pages, DB config, staff roster). Announcement email approved by Bill,
addressed to Erica + Tom (`docs/ERICA_REVIEW_QUEUE_ANNOUNCEMENT.md`), Bill sending.
Positions deliberately NOT pre-assigned on the live site — Erica's walkthrough starts there.

### ▶ NEXT (pending Erica/Tom feedback)
1. **Their feedback drives Stage-1 refinements** — including the real-world verdict on
   Bill's 12-vs-122 position-shape question.
2. **Unblocked meanwhile: the referral-code consumer** — QR referral pre-fills the
   Performance Profile (deferred since Session 125; design decided: `/p/:code` →
   `/performance-profile?c=CODE`, context resolved server-side, never in the URL).
3. **Then Stage 2 (screening):** instrument library + biopsychosocial template — ask Erica
   which instruments first + the proprietary-licensing question alongside her queue feedback.
4. **Still gated:** consent architecture (Erica's Q6 → Chris + legal — the biggest unlock),
   resource-library content (hers), Stage 8 board reporting (counsel).

**DEPLOY DECISION (Bill, Session 129): hold the Heroku/Erica deploy until the review queue
is built.** Referral classification + dashboard segmentation alone aren't tangible enough for
Erica ("she doesn't know or care we updated the molecule system") — ship the complete Stage-1
registration story in one visible update: classification + segmentation + the review queue
with her routing. So: assignment surface → review queue → THEN deploy (v85→v92+, on Bill's go).

**Working-style commitment (Session 129, after a rough two days):** Claude click-tests every
new screen end-to-end in the browser BEFORE handing it to Bill — Bill is never again the first
person to click a screen. See memory `feedback_live_words_over_notes` for the rest.

**Shore-up list CLOSED (Session 129, all verified live):**
1. DELETE /v1/molecules/:id now cleans the molecule's `{n}_data_*` storage rows (proven with a
   planted row on a throwaway molecule). 2. Create-flow step-2 failure now surfaces as an error
   instead of a false "saved successfully". 3. GET /v1/molecules/:id + all five groups endpoints
   tenant-gated (cross-tenant proven blocked both directions). 4. Test modal errors on missing
   session tenant instead of silently testing tenant 1. 5. Locked column definitions labeled
   as by-design on the edit page. 6. ML_RISK_LEVEL + ML_CONFIDENCE deleted via **db_migrate v91**
   (Bill's go; by molecule_key; the "seeded display-template line referencing them" in the S128
   audit note was STALE — no such line exists). SERVER_VERSION 2026.07.01.2358, DB **v91**,
   suite 55/1018 green, lint 0. Heroku deploy now applies **v85→v91**.

**Erica ANSWERED the Stage-1 routing question (2026-07-01 email):** registration reviews go
**Case-Manager-first — the case manager triages, then escalates/routes to the Medical Director
when needed.** ("I think your first instinct would be correct.") Build it as the default, as a
setting — not hardcoded. This unblocks the review-queue routing config.

## Session 128: molecules-on-users foundation BUILT (local-only). Next: the assignment surface + the shore-up list.

**Where the foundation stands after Session 128** (all verified live; details in STATE.md):
steps 1–3 of the plan are DONE — user link widened to 4-byte (v88), engine routes storage by
`molecule_def.parent_bytes` (v89), admin page has the parent-size picker + the reworded
**"Used in Rules Criteria for:"** Activity/Member boxes (independent; both-off = not a rule
field; `/v1/molecules/by-source` now honors them via `attaches_to`). PLUS a piece the plan
didn't have: **shared internal lists** (v90 — a list column borrows another molecule's list;
round-trip proven; borrower writes rejected).

**Created via the UI (Bill driving, wi_php):** POSITION (mol 145 → `4_data_1`, values
Case Manager / Medical Director / Clinician, saved + DB-verified) and POSITIONCLINIC
(mol 147 → `4_data_12`: position borrows POSITION's list + clinic → `partner_program`).
**POSITIONCLINIC is NOT round-trip-proven** — nothing writes user-parent rows yet.

### ▶ NEXT BUILD: the position/clinic assignment surface
The screen (likely on user admin) that puts a POSITIONCLINIC row on a staff login —
the first real write into `4_data_12`, and the round-trip proof that finishes the molecule.
Building it **settles Bill's open 12-vs-122 concern below first** — decide before real data.
After that: the WisconsinPATH Stage-1 **review queue** (role routing rides on positions).

**Then the parity step (Bill's plan, agreed Session 128):** once the assignment surface
proves the final shape, DELETE the UI-created POSITION + POSITIONCLINIC locally (and drop
`4_data_1` / `4_data_12`), and recreate all of it in ONE db_migrate version — molecules,
values, list-source pointer, and the `4_data_*` tables — so local and Heroku converge through
the same migration. Migration rules: resolve POSITION by **molecule_key, never molecule_id**
(sequences diverge across environments); the migration creates the storage tables itself
(Heroku must not depend on anything the UI did locally). Remember the DELETE endpoint doesn't
clean storage rows (shore-up item 1) — both tables are empty today, keep them that way.

### ▶ SHORE-UP LIST — ✅ DONE Session 129 (see top of file; kept for reference)
Every page Bill used today was broken (all fixed; see STATE). The audit found what's left:
1. **DELETE /v1/molecules/:id orphans storage rows** (VERIFIED in code — deletes the
   definition + value tables but never the `{n}_data_*` rows; ghost data if a molecule id
   is ever reused).
2. **Create-flow step-2 failure is swallowed** — column-definitions PUT wrapped in a
   catch that only console.warns, then the page alerts "saved successfully" (manufactures
   half-built molecules — today's root failure class).
3. **`GET /v1/molecules/:id` + the groups endpoints have no tenant check** (cross-tenant
   config read; the write side was scoped in S121, these reads were missed).
4. **Molecule Test modal falls back to tenant 1** when no tenant in session.
5. **Column defs on existing molecules are view-only BY DESIGN** (storage lock) — but the
   page doesn't say so; label it.
6. **ML_RISK_LEVEL + ML_CONFIDENCE are orphan definitions** (no columns, no data, zero code
   references — abandoned design; migration comment says level is computed from score).
   Delete them + fix the one seeded display-template line (template 40) that references
   them. wi_php config — Bill's go first.

**Session 127 shipped (local commit `4c829d2`, verified, NOT deployed):** WisconsinPATH Stage 1
**dashboard segmentation by referral source** — the participant list carries each member's
`REFERRAL_SOURCE` as `{code,label}`, and `dashboard.html` has a new **"By Referral Source"** tab
(mirrors "By Licensing Board"). No DB change; reads the Session-126 molecule. Rides the post-demo
Heroku deploy with Session 126.

**Session 127 also shipped (local commit `e13a4c4`, front-end only):** the molecule admin page
(`admin_molecule_edit.html`) no longer **requires** "attaches to member/activity" — dropped the
validation gate, the required `*`, and the "select at least one" help text. First tiny step toward
molecules on other parents.

### ▶ DIRECTION DECIDED — build molecules-on-users (the foundation). Build NOT started.

**Source of truth: `docs/MOLECULE_PARENT_GENERALIZATION.md` (Session 127)** — the full design +
decisions + the exact migration. `docs/MOLECULES.md` §11 summarises it, §1 forward-points. Read the
design doc first. The "foundation-first vs feature-first" fork is **resolved: foundation-first** —
Bill chose to build molecules-on-users, then the review queue rides on it.

**THE NEXT STEP (start here):** the data migration — **widen the user `link` from 2-byte to 4-byte**,
via `db_migrate.js` (never direct SQL). Exactly **6 columns** smallint → integer: `platform_user.link`
+ `audit_log_1..5.user_link`. **Leave the link tank untouched** (the allocator just increments; the
column width was the only limit — verified this session). No FKs on `link`. Bump `TARGET_VERSION` +
`EXPECTED_DB_VERSION`, restart, and prove the audit trail still joins. Do a final sweep for any
differently-named copy of the link first. **This is a schema change touching audit (record of truth)
— get Bill's go before applying.** Then: (2) kill the hardcoded 5-byte assumption in the molecule
machine + admin page; (3) add the parent-type control + the "Available to the rules engine" flag to
the admin page; (4) with Bill driving the maintenance page, create the first user molecule (`(role,
clinic)` → `4_data_12`, `p_link integer`) and prove a round-trip.

**⚠️ Bill's open concern (Session 128 — revisit when building the assignment screen):**
POSITIONCLINIC was built as `4_data_12` (position + clinic only). Bill suspects it may need to be
**`4_data_122`** (position + health system + clinic — mirroring the member PARTNER_PROGRAM's
partner+program pair). The 12 shape rests on: clinic → health system is derivable
(`partner_program.partner_id`); the molecule is not a rule field (the rules-engine
"value-must-be-on-the-row" argument that justifies Delta storing both doesn't apply); and the
member molecule's partner column proved unread. **Decide for real when the position/clinic
assignment surface is built** — if assigning a position at the health-system level (no specific
clinic) turns out to be needed, Bill is right and it becomes 122. Don't store real data in
`4_data_12` until this is settled.

The design context that got us here (keep for the next session):

Scoping the Stage-1 **review queue** (role routing → triage notes → SLA escalation → disposition)
surfaced a foundational identity question. Where the discussion landed:

- **"A person is a person"** — one population, no separate "staff type." Today's member-vs-login
  split is mostly an accident of auth.
- Roles modeled as **(clinic + capacity)** multi-row molecules on the person; **"monitored" is
  just one capacity** (alongside case-manager / director) — one affiliation concept, not two
  enrollments. One person can hold many role@clinic rows *and* be monitored.
- The **login stays a separate dumb keycard** pointing at the person — the one thing that can't
  be a molecule (auth runs before identity is known; needs a value→person lookup that fails loud).
- Molecule overhead is a non-issue at this scale, so molecules are fine for the affiliation model —
  **but** molecule **Tier-1 hardening** (validate-at-creation + auto round-trip; low-risk, only
  touches new-molecule creation) becomes a prerequisite, since the access model would rest on molecules.

**⚠️ Verified current-state correction (Session 127, checked against the DB/code):** today a login
(`platform_user`) is **NOT attached to a member at all** — no member pointer exists. Its `link`
column is the login's *own* id — allocated via `getNextLink('platform_user')` from `link_tank`,
primed at −32768 (the 5 live logins are −32768…−32764), **not** `MAX(link)+1`/`from 100` (I had that
wrong) — not a reference to `member`. The session
carries only `userId`/`tenantId`/`role`. And `platform_user.role` is CHECK-constrained to
**`superuser`/`admin`/`csr`** only — so the clinical titles (case-manager, medical-director) can't
even live on a login today; they exist only as `notification_rule.recipient_role` targets that
currently match zero users. Logins and members are two disconnected worlds, bridged in exactly one
fragile spot (notification routing matches a member's clinician to a login by **display_name**).
Consequence: the "keycard points at the person" wiring is **net-new to build**, not existing — and
**feature-first also has to introduce role-holding from scratch** (clinical roles aren't on logins),
so its "it's already there" advantage is smaller than first stated.

**Fork resolved → foundation-first.** Also settled this session: **tenant + access-tier
(superuser/admin/csr) stay explicit fields, NOT molecules** (resolved before the molecule layer;
a "tenant molecule" is circular); domain roles = molecules on the user. **Rules-engine
participation becomes an explicit molecule flag** (decoupled from A/M), so new parents are fenced
out of bonus/promotion logic by default. **Tier-1 molecule hardening** (validate-at-creation + auto
round-trip) rides along when we extend the fragile layer — Bill to confirm if it's in this pass.

**Reuse map for the review queue is done** (registry =
worklist backbone with status/assigned_to/SLA/notes + chart display; notification engine routes by
role; the one net-new engine piece is an SLA-deadline escalation job). `docs/WISCONSINPATH_BUILD_PLAN.md`
Stage 1 rows have the reuse-vs-new detail.

**Erica's routing answer arrived (Session 129, see top of file):** Case-Manager-first, escalate
to the Medical Director. Default behavior, configurable — not hardcoded.

---

## Prior — Session 126 ended clean

Session 126 ended clean — nothing half-built. `REFERRAL_SOURCE` (the WisconsinPATH Stage 1
classification field) is built + round-trip-verified, the internal-list `value_id` bug is
fixed at the root with a guard, and the molecule documentation is consolidated into one
authority. All on `origin/main`, CI-gated, **NOT deployed to Heroku** (Dr. Stadler demo is
2026-07-01 — deploy after).

**What's done (Session 126):**
- **`REFERRAL_SOURCE` member molecule** (db_migrate v85+v86) — Stage 1 referral classification
  (Self-referral / Employer / Board-mandated) on the participant; verified by
  `tests/insight/test_referral_source.cjs`. Registration lifts `referral_type` from the
  referral `code` row's JSONB into this molecule.
- **Internal-list `value_id` bug fixed at the root** (db_migrate v87 + pointers.js): shared
  `allocateListValueId()`, clone/static-text paths fixed, 3 overflowed lists renumbered to
  per-molecule 1..N, `CHECK (value_id BETWEEN 1 AND 127)` guard added.
- **Molecule docs bulletproofed:** `docs/MOLECULES.md` is the single source of truth; master §2
  and essentials §2 gutted to a pointer; wired into START_HERE + the skill.

**Next up (in rough priority):**
1. **Deploy Session 126 to Heroku — AFTER the 2026-07-01 demo, on Bill's go.** `git push heroku
   main` then `heroku run --app hdwhf "node db_migrate.js"` (applies v85→v87) then restart +
   verify. Local is ahead: SERVER_VERSION 2026.06.30.2101, DB v87; Heroku v98 / DB v84.
2. **Continue WisconsinPATH Stage 1 (unblocked, reuse-heavy):** `REFERRAL_SOURCE` is the
   classification field — next is dashboard **segmentation** by it, then the **review queue +
   role routing (Med Director / Case Manager) + triage notes + SLA escalation + disposition**,
   all riding existing registry / notification / SLA engines. See `docs/WISCONSINPATH_BUILD_PLAN.md`.
3. **The consumer half of the referral loop (post-demo)** — Performance Profile reads its code
   and pre-fills. Design decided: `/p/:code` → clean `/performance-profile?c=CODE` (opaque token
   only), form resolves context via a read-only endpoint (context never in the URL). Edits the
   live demo page, so it waited until after the demo.
4. **"Add observer"** — deferred until the Stage-5 observer actor/onboarding exists.
5. **Resource-library matching** (score → content) — Erica is compiling the content.

**⚠️ Molecule work: read `docs/MOLECULES.md` first.** Session 126 lost hours to a molecule bug
that the (now-fixed) docs would have prevented. It's the single source of truth now.

**⛔ Blocked on Erica/others (the big asks from her June email):**
- **Privacy model (her Q6)** — dual-track / 42 CFR Part 2. Erica is drafting a
  preliminary version; needs Chris + legal. This **gates** real self-registration +
  participant portal + PHP linkage. The ball is largely in her court here.
- Resource-library **content** — hers to compile.

Full plan + statuses: **`docs/WISCONSINPATH_BUILD_PLAN.md`** (the master roadmap +
code-grounded gap analysis — Session 125; supersedes the old OER-plan roadmap). Erica
relationship / waiting-on items: `project_erica_tracking` memory.

**NEW (Session 125): WisconsinPATH master build plan.** Jim's anticipated Wisconsin-program
workflow → Erica's build requirements (`PI2_WisconsinPATH_Build_Requirements.docx`, her
working doc) → reconciled into `docs/WISCONSINPATH_BUILD_PLAN.md` with a capability scan.
Key finding: the spec is solid, but **consent/release-of-information, toxicology/lab orders,
and OER activation do NOT exist yet** (Erica had them as "Configure"/exists) — they're
net-new, and the consent piece is the same 42 CFR Part 2 work gated on her Q6. Erica expects
this to **reuse across Washington** — design net-new pieces tenant-configurable. Not started;
roadmap/planning only.

---

## ⛔ DO NOT resume the RLS / database tenant-lock work.

Session 123 built then removed RLS (perf cost — accruals 1,056/s → ~100/s; insurance
not yet needed). Session 124 collapsed migrations v81/v82 to no-ops to unfreeze Heroku
(the real v81 can't run on Heroku — RDS forbids creating a login role with a password).
Do not reach for RLS again without Bill explicitly asking — design preserved in
**`docs/RLS_BACKSTOP_DESIGN.md`**.

Note: "RBAC" (role enforcement for the product's portal/observer logins) is a separate,
still-relevant thing needed before real self-registration — but it is NOT the RLS lock.
