# PI² Master Build List
**Edition 4 · August 7, 2026**

> Source of truth for the Word edition sent to Erica (+ Tom), send 2026-08-07
> (the Friday cadence). Process unchanged: WE maintain this list in the repo; each send
> is a dated .docx snapshot in this folder (`PI2_Master_Build_List_YYYY-MM-DD.docx`,
> never overwritten); Erica confirms completeness and RANKS — her ranking sets the
> build order. Regenerated Session 169 (2026-08-07): the access-rules build complete
> incl. her Rev 1.1, the monitoring core stories 1-3a, toxicology results + the result
> state machine (her Washington #1's heart) built and live, the exploration sandbox
> stood up and pre-loaded, and the platform-wide safety audit — all folded in.

Erica — the weekly edition. The headline is your Washington #1: **toxicology results and the result state machine are built and live**, exactly to the answers you emailed, and the exploration sandbox is pre-loaded with a dozen example results so your first look is a working screen, not an empty one. Behind it, a big week: your document access rules — including your Rev 1.1 — are **completely built**, the monitoring engine (random selection, paradigms, calendars, excused absences) is live and waiting for configuration, and the platform went through a top-to-bottom safety audit. One ask remains:

1. **If anything is missing, add it.** Same standing rule — if you've asked for something and it isn't here, say so and it goes on the list.

## ✅ Recently completed — everything below is LIVE

**August 6-7 — TOXICOLOGY RESULTS + THE RESULT STATE MACHINE (the heart of your Washington #1), built to your emailed answers:** a result is recorded (manual entry for now — the interim path until the lab integrations), then walks the exact chain you specified: received → screen non-negative → lab confirmed → MRO review → final disposition. Every step is an event with who and when; the history is append-only and complete. What makes it yours:

- **The MRO is a role, not a person, and it's data** — today it points at the Medical Director's position; when you seat the MRO elsewhere (a program person, or a lab service), that's a settings change, never a rebuild. Only the MRO can move a result from review to disposition — enforced, and proven by automated test.
- **Scoring moves ONLY at disposition** — never at receipt, never at screen, never during review — and the compliance event is dated the disposition day, exactly once per result. A preliminary result can never move anyone's score.
- **Your six special results (dilute, adulterated, substituted, invalid, cancelled, refusal) file as their own compliance events** under a new Drug Test Exceptions item — never disguised as positives or negatives. Their scoring weight is deliberately set to zero until your document sets real values; the sentinel ones (adulterated, substituted, refusal) still ring the safety machinery immediately, weight or no weight.
- **The notification rule you set is absolute:** staff notifications never contain the member, the stage, or the answer — the text is identical and generic every time ("a result requires attention — log in"). Participant notification at disposition deliberately waits for the consent architecture.
- **Voiding is a mark, never a deletion** — a reason is required, the record stays visible, and voiding an already-disposed result also retracts its compliance event, on the record.
- **Your promised result-state-machine document is still welcome** — the machine is data all the way down (stages, transitions, who-may-move-what, dispositions, reasons), so your document changes rows and settings, not the build.

**August 5-6 — YOUR REV 1.1 ACCESS RULES, built end to end (your #1 on the main list is now COMPLETE):** the revised matrix cells, unclassified documents strictly Tier 2, the superseded-document rule, Part 2 downloads refusing for every role until the consent architecture, break-glass grants restricted to the Medical Director with a role-aware screen, and the audit log itself now a protected surface (reading it is restricted and itself audited). Combined with the four-story build from last week, your access-rules specification is fully built and proven by a test that walks all eight of your Blocking acceptance criteria. **Every program still runs in open mode until you flip it — the flip is yours, no rush.**

**August 2-3 — THE MONITORING ENGINE (your Washington #1's selection half):** collection sites, testing paradigms (the named recipes — how many tests per month, which days, minimum gaps), per-member temporal assignment, the selection engine (each member selected by their own paradigm's math, uniform spread, nobody can see a future test day — enforced on the server, not the screen), the Testing-tab calendar, and excused absences with automatic re-rolls. **It all sleeps until paradigms are configured** — configuration, not code, wakes it. Your rescheduling-rules document becomes the excusal contract when it arrives.

**August 1-2 — THE PLATFORM-WIDE SAFETY AUDIT (found by us, fixed by us):** a top-to-bottom pass looking for places where the platform quietly assumed Wisconsin. Twelve findings, all fixed, and standing guards built so the bug classes can't come back. The one you may notice: **the band/pattern alert layer (PPII thresholds, spikes, trends, protective collapse) is filing again on your live program** — a plumbing break had silenced it since mid-March while the per-survey alerts kept flowing, which is why nothing looked wrong. If items appear that feel like they "should have" filed weeks ago, that is the system catching up honestly.

**August 1 — THE EXPLORATION SANDBOX, stood up and pre-loaded for the August 13 orientation:** a complete, separate program ("WPHP Exploration") with twelve fictional people whose stories exercise the real machinery — rising risk, improvement, overdue silence, an intake queue with life in it. **And as of today it also carries a dozen toxicology results in every stage** — mid-review, disposed, one voided, one unmatched — so the Testing tab is a worked example. Staff logins for Chris's team exist (credentials in the cover email); you and Tom already have it in your program choosers. Nothing in the sandbox is real data; explore destructively with a clear conscience.

*(Earlier releases — July 12 through July 27 — as recorded in Editions 1 through 3.)*

## 🐞 Bugs

None open today. Anything you find goes here — and goes first.

## 🔹 Small Enhancements

1. **Per-track instrument templates** — each track (screening / optimization / monitoring) gets a default instrument set, applied automatically at activation. *Becomes configuration the moment your protocol answers arrive.*
2. **GAD-7 alert thresholds** — wired like the PHQ-9 alert once you set the protocol levels.

## 🔷 Large Enhancements — YOUR RANKING is the build order

### 1. Document Repository — ranked first; ✅ THE BUILD IS COMPLETE (including your Rev 1.1)
- Tiers, the permission matrix, audit-before-serve, the registrant boundary, release actions, break-glass, the protected audit log — all built, all proven against your acceptance criteria. **What remains is yours: the flip.** Each program moves from open mode to rules mode on your say-so; until then nothing changes on anyone's screen.
- Phase B vendor picks + agreements (ours): production encrypted storage, inbound fax, OCR.

### 2. Consent architecture — ranked second; ✅ now WITH COUNSEL (Damian sent it to Joe, August 5)
- Everything behind it is plumbed and waiting: Part 2 downloads, participant email and text (the messaging door ships locked), the directory's sharing step, participant portal surfaces, and now the participant notice at toxicology disposition. When counsel's read lands, doors open deliberately; nothing needs rebuilding.

### 3. Network Directory — ranked third; Phase 1 LIVE and confirmed ("just perfect" — thank you)
- The dashboard card now points at the Network Directory (the stale evaluator-directory link is fixed — your catch).
- Your two rulings are recorded: the promoted-listing badge and the suggestion block are deferred; the old Evaluators section stays for now.
- ⏳ Phase 2 sharing step waits on the consent architecture, with the selection wall already built and guarded underneath.

### 4. Medication Registry — ranked fourth; nothing blocks it, queued behind the monitoring work
- As recorded in Edition 3; your nine open decisions from §9 stay open.

### 5. Resource Library — ranked fifth; awaiting your specification, you're assembling the content

*Running beneath everything: the predictive model keeps learning as real data accumulates.*

## 🗻 Washington — YOUR RANKED BUILD ORDER, with real movement on #1

**Your ranked queue:**
1. **Monitoring and toxicology core — SUBSTANTIALLY BUILT AND LIVE.** ✅ Random rules and paradigms, collection sites, the selection engine, the calendar, excused absences (sleeping until configured). ✅ Toxicology results and the result state machine (see the headline above). ⏳ Still ahead in this block: **daily check-ins** (your rescheduling-rules document becomes the contract when it arrives) and **the lab integrations** — Tom's vendor track is moving (Quest and USDTL accounts approved, LabCorp pending, integration specs expected imminently), and the result record they'll land in now exists. Manual result entry is the working path until then, by design.
2. **Consents** — with counsel as of August 5 (see Large #2).
3. **Electronic signature integration** — vendor selection, ours, in motion as its own decision.
4. **Current medications** — the medication registry (Large #4); nothing blocks it.
5. **Secure messaging** — the plumbing exists and ships locked; waits on your consent architecture and a provider choice (ours).
6. **Letter and form templates** — standalone; could move up if kickoff signals need.

**Held off your list, blocker named — unchanged from Edition 3** (the external stakeholder model, portals, treatment records, board information, group requirements, billing, and your Group 4 clarification items). **Bundy's team will answer the clarification questions before or at the August 13 kickoff** — those answers unblock your held items and feed straight back into this queue. Kickoff will also scope the RecoveryTrek data migration and the lab integrations.

## 🔮 Maybe in the Future

**The monitoring-track table stakes** (your competitor comparison — the starred ones were promoted into your ranked #1 block, and most are now built):
- ~~Random test-selection engine~~ ★ — **built, sleeping until configured**
- ~~Participant calendar~~ ★ — **built (Testing tab)**
- ~~Toxicology / lab results~~ ★ — **built and live (the headline)**
- Daily check-in ★ — next in the #1 block
- Collection-site finder ★ — the sites exist; the finder screen is small once check-ins land
- Chain-of-custody number reporting — the result record already carries the reference field
- Secure messaging ★ — plumbing built, consent-gated
- Camera document capture; in-app billing and ledger; meeting-attendance GPS; travel and medical time-off requests

**And beyond:** Treatment Provider Network; escalate-until-acknowledged alerting; appointment and reminder machinery; board reporting (counsel-gated).

## 📋 In Your Court

- **The flip decision** — each program from open mode to rules mode on your say-so (the access-rules build is complete and waiting).
- **Your result-state-machine document** — welcome whenever ready; it changes settings and vocabulary, not the build. Your MRO answer (who actually performs the review in practice) is the piece with the most reach.
- **Your rescheduling-rules document** — becomes the daily check-in / excusal contract (the next piece of your Washington #1).
- **Exception weights** — the six special results currently carry zero scoring weight by design; your document sets the real values.
- **Your system inventory notes** — still welcome; anything you flag folds into the next edition (or sooner if it's a bug).
- **Filling the Network Directory** — live and empty; your team adds the entities.
- **Erica Kind's leftover open RED item** — deactivated before the guard existed; needs a clinical resolution so nothing sits unseen.
- Clinical instrument library content and resource guide (yours, in progress).
- Consent architecture — with Joe as of August 5; we watch for it coming back.
- Protocol answers: per-track instrument sets, GAD-7 thresholds, proprietary instrument picks and licensing.
- Medication registry §9 decisions, when that build approaches.
