# ACTIVE WORK

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
   EMAILED. Edition 1 sits in `wi_php/project_status/`, current and
   UNSENT — **Bill sends it in a few days** (heads-up email sent; Erica
   blessed the concept). When it goes: her completeness check + Large
   ranking come back and set the build order.
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
8. **Testing-gap follow-up (from the "why didn't we catch these" answer):**
   a participant-day walk test — invited → registered → assigned →
   portal → take; Erica caught that journey broken at two points.

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

## ▶ SOMEDAY / BACKLOG (low priority, Bill parked — don't do without his go)

- **Config-table index tidy-up (v105 candidate).** A platform-wide structural index
  audit (Session 136) found ~29 more provably-redundant indexes beyond the storage
  tables v104 already cleaned: ~6 exact duplicates of a unique/primary key (e.g.
  `idx_tenant_id` = `tenant_pkey`, `idx_platform_user_username` = the username unique
  key, `idx_airports_code`/`idx_carriers_code`), and ~23 standalone columns shadowed by
  a composite that leads with them (mostly `idx_X_tenant (tenant_id)` under a
  `(tenant_id, code)` unique key; a few FK columns like `member_compliance(member_link)`
  under `(member_link, compliance_item_id)`). **ROI is LOW** — every one is on a small
  config/reference table (~16 kB each, ~0.5 MB total), so this buys marginally cheaper
  writes + a cleaner schema, NOT disk (unlike v104's GB-scale storage indexes). Do it, if
  ever, as ONE v105 migration using **shape-based, expression-safe** detection (the query
  is worked out — it lives in the Session 136 chat). **CRITICAL trap:** a naive
  column-list match FALSELY flags expression indexes as redundant — `member (tenant_id,
  lower(lname))` name-search and `molecule_def (tenant_id, lower(molecule_key))` MUST be
  kept; exclude any index whose `indkey` contains 0 (an expression), plus partial (WHERE)
  and unique/primary indexes. The refined detector already filters these + the dead
  `zzz_*` tables.
- **Usage-based index audit — BLOCKED on real traffic.** Dropping *truly-unused*
  indexes (idx_scan = 0) needs production query stats. Local has only test-suite traffic
  and Heroku only demo traffic; the generated loyaltybig had all-zero scans (now deleted).
  Not doable meaningfully until there's a real-load environment.

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
