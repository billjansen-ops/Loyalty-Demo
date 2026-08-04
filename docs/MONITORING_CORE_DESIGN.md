# Monitoring + Toxicology Core — the design (Bill's go, Session 166)

**Status: SETTLED FOR STORIES 1-2; three Erica answers pending shape
stories 3-4 (her questions sent 2026-08-03, filed in
wi_php/project_status/Monitoring_Core_Questions_2026-08.md). This
document is the contract — implementation conforms to it; wrinkles
found in code come back here as design conversations, never silent
renegotiations.**

**Source of requirement:** Erica's WPHP Ranked Build Order rank 1
(2026-07-23): "Monitoring and toxicology core — toxicology, lab
integrations, random rules and paradigms, daily check-ins, collection
sites, calendar view, and excused absences. The largest single need and
the one Washington most cannot operate without. It is the difference
between a monitoring platform and an intake and assessment platform.
Build as one block."

---

## 1. The model in plain words

A **paradigm** is a named testing recipe owned by the program: how many
tests per period, how random, with what constraints. Each monitored
participant is **assigned** a paradigm (with effective dates) and a
**collection site**. A daily **selection engine** rolls the dice and
records who tests today. The participant performs a **daily check-in**
and only then learns whether today is a test day. Collections happen at
sites; **results** come back (a panel, an outcome, a chain-of-custody
reference) and the lab report document files in the repository, where
the access rules (Sensitive tier, the release action) already govern
it. **Excused absences** are recorded and approved by staff. The
**watching layer** notices what didn't happen — missed check-in, missed
test, positive — through the same signal/action machinery that files
registry items today.

## 2. Bill's rulings (2026-08-03, all settled)

- **Nobody sees the future.** The participant NEVER sees a future test
  day anywhere. Staff see TODAY's selections (they run the day); the
  calendar shows the future only as expected volume, never named days.
  A schedule that officially doesn't exist can't leak.
- **Excused absences are staff-recorded** (portal submission arrives
  with external portals), **approved by the Medical Director or Case
  Manager**. Whether an excused test re-rolls later in the period or
  drops is Erica's pending question — build re-roll unless she says
  drop.
- **Collection sites are a simple program-owned list** (name, address,
  phone, hours; assignable per participant; shown on the day-of
  notice). The shared-directory treatment can come later if Washington
  wants it.
- **Record spine:** configuration lives in small per-tenant tables
  (paradigms, sites, panels); events live on the person's TIMELINE as
  activities with molecules (check-ins, selections, collections,
  results) — the survey/compliance precedent. Balances derive; nothing
  stored twice.
- **The selection engine is a daily scheduled job** (the MED_SCAN
  pattern: one function shared by the scan and a manual Run button).
- **The watching layer reuses the existing alarm** — signals through
  the bonus/action machinery; no second bell.

## 2b. Build discovery, recorded (story 2 — for Bill's read, flag if wrong)

The platform ALREADY runs a selection loop: compliance.js's
RANDOM_DRUG_TEST job (daily; hardcoded 1-in-7 chance, min 2-day
spacing, forced selection at 10 days without) stamps
member_compliance.next_scheduled_date, and DRUG_TEST_MISSED (daily
5 PM) files a MISSED compliance result + notification when a selected
day passes with no specimen. Building a second engine beside it would
be the two-variants drift BEFORE_YOU_WRITE forbids. **Resolution (the
one-brain rule): the paradigm engine is the new BRAIN inside the
existing BODY.** The RANDOM_DRUG_TEST job now runs the paradigm engine
first (members with an active paradigm assignment — selection math
from THEIR paradigm, logged to test_selection, and the same
member_compliance pointers stamped so the existing missed-sweep and
notification work unchanged, day one); the legacy 1-in-7 rules keep
covering ONLY members with no paradigm. Nothing changes for anyone
until a paradigm is assigned; adoption is per-member; Wisconsin is
untouched until Erica configures paradigms. No new job rows, no
second bell, one selection engine per member — ever.

## 3. Erica's answers (ANSWERED 2026-08-04 — her email is the record;
## digest in wi_php/project_status/S166_Erica_Batch_Analysis_2026-08-04.md)

1. **Check-in channel: the existing lightweight participant app,
   APPROVED for the interim.** Go-live gate: authenticated participant
   login (consent architecture) before a missed check-in carries
   compliance weight. Staff-recorded check-ins are RULED OUT
   permanently (a proxy defeats the unpredictability the mechanism
   exists to create). Presumptive-positive treatment of misses =
   per-program configuration, never a constant.
2. **Excused absence: RE-ROLL, never drop** (contracted testing
   frequency; no incentive for absence requests). The engine's
   probability-spread already satisfies her randomly-drawn-replacement
   rule. NEW rules she added, building when her rescheduling document
   arrives (she is writing it — it becomes the 3b contract): per-week
   compression ceiling as program config + CM review flag; excusal
   request/approve/deny/reschedule as discrete recorded events; TRAVEL
   IS NOT EXCUSAL — out-of-area collection order at a destination site
   is the default travel path, excusal reserved for incapacity (reason
   taxonomy); extended absences beyond a program threshold bypass
   rescheduling → Medical Director + documented agreement modification.
3. **Positive results: the MRO state machine** (she is writing the
   formal document — it becomes the story-4 contract): sentinel flag
   immediate + internal only; append-only state history (received →
   screen non-negative → lab-confirmed → MRO review → disposition);
   dilute/adulterated/substituted/invalid/cancelled/refusal are
   SEPARATE compliance events, never positive/negative subtypes;
   record-LEVEL portal suppression; scoring and tier move only on
   disposition, forward-only; external reporting is never automatic;
   42 CFR Part 2 notification content rule — no substance names or
   treatment status in any text/email, staff included.

## 4. Kickoff fills in (not blocking; flexible data with seeds)

Washington's real paradigms (frequency, constraints) and panel list —
same philosophy as the licensing boards: the machinery ships with
sensible structures, kickoff enters the true values. Lab-vendor
integration is its own post-kickoff project; the manual result-entry
door means records never wait for vendors (integration replaces the
entry channel, never the records).

## 5. Small calls (Claude's, shown not asked)

Check-in cutoff time = a per-program setting in the program's timezone;
result entry = Medical Director + Case Manager; outcome vocabulary
(negative / positive / dilute / refusal / no-show) = data rows Erica
can extend; the calendar lives on the clinic dashboard; chain of
custody = a minimal reference field until the lab work fleshes it out.

## 6. The stories (one block, bite-size releases, Bill's go each)

1. **Collection sites + paradigms as config** — tables, doors, Program
   Settings screens, per-participant assignment (paradigm + site) on
   the chart. Manifest parts for the new config tables.
2. **The selection engine + its scheduled job + the staff calendar**
   (today's selections named; future as volume only).
3. **Check-ins + notice-at-check-in + excused absences** (channel per
   Erica's answer).
4. **Toxicology results + panels + manual entry + safety-net wiring**
   (missed/positive signals, registry filing; result-review model per
   Erica's answer).
5. **The acceptance walk on the sandbox** (the access-rules pattern:
   prove the block end to end on a copied tenant before real use).

## 7. Standing rules that apply throughout

Two-tenant rule (every WA config change lands on wa_php AND the
sandbox; sandbox may carry fictional demo sites, wa_php stays honestly
empty until kickoff). Codes not numbers — nothing Wisconsin-only.
Config is data. Dates via platform helpers only. Molecules considered
before any new text column. Whether Wisconsin turns the core on is
Erica's later call — machinery does nothing until a paradigm is
assigned.

## 8. Explicitly OUT of this build

Lab vendor integration (post-kickoff) · billing · automated
rescheduling (Washington clarification pending) · external portals ·
real participant logins (consent architecture) · customizable report
builder.
