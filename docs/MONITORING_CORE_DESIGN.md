# Monitoring + Toxicology Core — design brief (DRAFT FOR DISCUSSION)

**Status: NOTHING HERE IS DECIDED.** This is preparation for the design
pass with Bill, drafted at Session 166 wrap so the conversation starts
from Erica's materials instead of from scratch. Bill's design, settled in
that conversation, becomes the contract — this file then gets rewritten
to record it (the GROUPS_AND_MEDS_DESIGN.md pattern). Until then, treat
every "proposed" below as a question.

**Sources:** Erica's WPHP Ranked Build Order (2026-07-23, her #1 —
"build as one block"), her WPHP Wish List Organized (the monitoring
cluster), wa_php/WPHP_Wish_List_Analysis.md (our internal read,
S152).

---

## 1. What Erica asked for (her words)

Rank 1: "Monitoring and toxicology core — toxicology, lab integrations,
random rules and paradigms, daily check-ins, collection sites, calendar
view, and excused absences. The largest single need and the one
Washington most cannot operate without. It is the difference between a
monitoring platform and an intake and assessment platform, and several
reports we already built are waiting on this data to become useful.
Build as one block."

Scope notes already on the record:

- **Lab integrations are in her block but gated on kickoff** — the LOI
  commits them for pilot; vendors/BAAs/interfaces get scoped at the
  kickoff meeting (Tom is working lab vendors). The core builds the
  record machinery first; integration later replaces the entry channel,
  never the records.
- **Automated rescheduling is NOT in scope** — it sits in her Group 4
  clarification request to Washington ("do they want an option to select
  the follow up rather than the predetermined cadence?"). Calendar VIEW
  is in scope; automated rescheduling waits for Washington's answer.
- **External portals are NOT in scope** — facilitator/liaison portals
  and portal-submitted excused absences are held on the stakeholder
  model + consent architecture. Staff-side flows only for now.
- **Participant logins are consent-gated** (her rank 2) — the daily
  check-in's sequencing question, see §4c.

## 2. The domain in plain words

The standard PHP monitoring model the block implements:

1. A **paradigm** says how often and how randomly a participant is
   tested (e.g. "24 tests per year, random, never two consecutive
   days, weekdays only").
2. The **selection engine** rolls the dice on schedule and decides who
   tests when.
3. The participant performs a **daily check-in** and learns — only
   then — whether today is a test day (no forewarning is the point).
4. On a test day they go to a **collection site**; the collection
   happens with **chain of custody**; the lab runs a **panel**; a
   **result** comes back (negative / positive / dilute / etc.).
5. An **excused absence** (travel, illness) is requested and approved,
   and the selection engine knows about it.
6. The **watching layer** notices what didn't happen: missed check-in,
   missed test, positive result — and files the right alarm.
7. Staff see it all on a **calendar view** and the existing dashboards.

## 3. What already exists to build on (the inventory)

- **The compliance engine** — compliance items with cadence, results,
  missed-event bells (the David Nguyen case), compliance_member screen.
  The nearest existing shape to "expected recurring event with results."
- **Scheduled jobs** — per-tenant job rows, daily platform jobs
  (MED_SCAN precedent: one function, scan + manual Run button share it).
- **The participant app** (poser_mobile) — the weekly check-in already
  works tenant-portably; no real participant logins yet.
- **Notifications** — position/role routing, tenant-timezone delivery
  windows.
- **Partners/clinics + the Network Directory** — the directory-shaped
  machinery collection sites could ride (her organized list itself filed
  collection-site directories under Network Directory).
- **The document repository + access rules** — LAB is already a document
  type at Sensitive tier, and the participant release action for lab
  reports ALREADY EXISTS (access-rules story 3). Result records and
  lab-report documents meet here.
- **Temporal-first activities + molecules** — the platform's standing
  answer for event records; balances derive, nothing stored twice.
- **The safety layer** — bonuses/actions (SR_*), the stability registry,
  PPII detectors: positives and missed-test patterns have somewhere
  real to land.
- **MEDS** — standing watches over member facts, if "N missed tests in
  M days" wants to be a watch rather than a hardcoded detector.

## 4. The design questions for Bill (the discussion agenda)

a. **The record spine.** Are check-ins, selections, collections, and
   results ACTIVITIES with molecules (temporal-first, the platform
   instinct), new tables (the compliance_result precedent), or a mix?
   This decision shapes everything downstream.

b. **What is a paradigm, concretely?** A named per-program definition
   (data, never code) assigned per participant: frequency per period,
   randomness constraints (min gap, weekday rules, blackout dates),
   effective dates. Who edits it (MD only?), and does a paradigm change
   mid-period re-roll the selection?

c. **The daily check-in without participant logins.** The classic model
   needs the participant to check in daily, but real participant logins
   arrive with the consent architecture (her rank 2). Sequencing
   options to discuss: build the check-in machinery now with the
   existing participant-app pattern (the weekly check-in's door),
   accept staff-recorded check-ins as the interim channel, or hold the
   participant-facing piece until consents land. The selection engine
   and result records need none of that to be useful.

d. **Notice semantics.** Participant learns "test today" only at
   check-in. What do STAFF see ahead of time, and does the notice
   itself write an audit/activity record?

e. **Collection sites.** Reuse the Network Directory dual-track
   (shared pool + program list), or a simpler per-program list? Sites
   are per-participant assignable and appear on the notice.

f. **Results and panels.** Manual entry door FIRST (staff enter what
   the lab reports); panels as per-program data; chain-of-custody
   fields; the lab-report document links to the result record (and the
   existing release action covers participant visibility). What fires
   on a positive — which action codes, which registry behavior?

g. **Excused absences.** Staff-recorded request/approve now (who
   approves — MD?); the portal submission flow arrives with external
   portals. How does an approved absence interact with selection (skip?
   reschedule within period?).

h. **Calendar view.** Read-only staff calendar over expected/selected
   events first? Which screens carry it (clinic? member chart?).

i. **Story shape (tentative, for reaction, not decided):**
   1. Collection sites + paradigms as config (+ screens).
   2. The selection engine + its scheduled job + staff calendar.
   3. Check-in machinery + notice-at-check-in + excused absences.
   4. Toxicology results + panels + manual entry + safety-net wiring
      (missed/positive detectors, registry filing).
   5. The acceptance walk on the sandbox (the access-rules pattern:
      prove it end to end on a copied tenant before real use).
   Lab integration is its own later project, post-kickoff scoping.

j. **Standing rules that apply regardless:** two-tenant rule (every WA
   config lands on wa_php AND the sandbox); codes not numbers
   (nothing Wisconsin-only); config is data; dates via platform
   helpers; molecules considered before any new text column.

## 5. Explicitly OUT of the first build

Lab vendor integration (kickoff scoping) · billing · automated
rescheduling (Washington clarification pending) · external portals ·
real participant logins (consent architecture) · customizable report
builder.
