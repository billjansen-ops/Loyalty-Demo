# Erica batch analysis — 2026-08-04 (Session 166 tail)

UNCOMMITTED ON PURPOSE while the BI point-transfer session works the
repo; commit with the next wrap. This is the durable record of the
four-part Erica batch Bill pasted for analysis.

## 1. Access rules Rev 1.1 (PI2_Document_Access_Rules_Rev1.1.docx, Downloads)

Erica ran Rev 1.0 through Claude, revised, changes in red. Extraction
with red markers: session scratchpad rev11.txt. MOSTLY CONFIRMS the
S165/166 build; the deltas that change CODE:

1. **Break-glass: MD-only records grants (D-12).** We built MD-or-PA/
   admin as grantor. Rev 1.1: MD alone records; MD OR PA revokes
   (revocation deliberately less restricted); Emergency Access surface
   available to MD only for recording; no deputy, no out-of-band path
   (MD unavailable = no grant, accepted consequence); grant audit event
   gains "granting Medical Director"; distinct revocation audit event
   (we have it). → breakGlassOfficer splits grantor/revoker; screen
   role-aware; acceptance test AC-8 wording updated.
2. **§4 matrix cell changes:** CM +S at Tier 2 (D-11, WPHP Q-4 can
   withdraw); PA +U and +H at Tier 2; MD +S at Tier 3 (D-10 — was
   nobody); MD +download +H at org-level. → DOC_MATRIX constant + tests.
3. **Unclassified = Tier 2 STRICTLY (new AC-11, "no tier-less state").**
   Our wrinkle-(b) rule (unclassified uploads open to any classifying
   role) is DEAD — a role reaches an unclassified upload ONLY through
   its Tier 2 permissions. PA's new U at Tier 2 is what makes fax
   ingestion work through the matrix itself (their fix is stricter and
   more elegant than ours). → upload door: unclassified requires U at
   Tier 2; remove the any-mapped-role branch.
4. **Superseded = intersection with the matrix (D-13, new AC-12,
   AC-10 now BLOCKING).** Visible to MD, CM, and any role holding S at
   the tier — each only where they hold V. Resolves: T1 all three
   staff roles (PA GAINS T1 superseded), T2 MD+CM, T3 MD alone,
   org MD+PA (falls out, no special case). Replaces BOTH our wrinkle
   implementations (docVisible + the finder branch).
5. **Registrant documents carry the Tier 2 until-classified treatment**
   — reached only through Tier 2 permissions, exactly like unclassified
   uploads; no looser intake access model. → docEffectiveTier treats
   registrant_doc rows as Tier 2 (floor/exact — read §6.2 text at
   implementation; interpretation: exactly the until-classified
   treatment).
6. **Part 2 this phase: no consent artifact can exist until the consent
   architecture, so a flagged document is not downloadable/exportable
   by any role — INTENDED, not a defect.** Our interim
   Filed-consent-document mechanism (S165 story 2 invention) is
   retired: the download refuses regardless of part2_consent_link until
   the real consent object exists. Columns stay as plumbing (D-14:
   consent artifact scope field sized wide).
7. **The audit log is a protected surface (new §7.2 rules):**
   program-scoped; readable by MD + PA ONLY; reading the log writes its
   own audit event; no IHS read path (break-glass applies to the log);
   audit records exempt from retention; handled as sensitive wherever
   stored/exported. → (a) verify no existing endpoint leaks document
   audit rows to other roles; (b) an MD/PA audit-review door + surface
   with read-logging is now IN SCOPE (currently none exists).
8. **New per-program flags, built present-and-off:** caseload-only
   scoping (D-2), immediate-release-on-filing (D-3), program-obtained
   prescriber portal visibility (D-9, portal-phase). Retention
   schedules default INDEFINITE (already true — nothing deletes).
9. **No-change confirmations:** tier-lowering clarification matches our
   build exactly (classification-out-of-unclassified is not a
   lowering); matrix-is-sole-source = our deny-by-default architecture;
   IHS metadata exclusion = built; participant sees own superseded
   consents = portal-phase note (AC-3 exception).
10. **Register now names who may change each item**; D-1..D-14; her
    register's own rule: nothing blocks build, every open item is a
    flag value.

**Sizing: one focused "Rev 1.1 alignment" story** (matrix constant,
upload/visibility rules, break-glass grantor split + screen, Part 2
refusal, registrant tier floor, flags, audit-log door + leak check,
test rewrite incl. AC-10/11/12). Rev 1.1 supersedes as the contract
per her own register; her WPHP clarifications (Q-1, Q-4) change flag
values, not the build.

## 2. Monitoring answers (her email, full text in the S166 chat)

- **Check-ins:** existing lightweight participant app APPROVED for
  interim → STORY 3b UNBLOCKED. Go-live gate: authenticated participant
  login (consent architecture) before check-ins carry compliance
  weight. NO staff-recorded check-ins ever (defeats unpredictability).
  Missed check-in/test = presumptively positive → PER-PROGRAM CONFIG,
  not a constant.
- **Excused absences: RE-ROLL CONFIRMED** (our default). Engine's
  probability-spread over remaining eligible days already satisfies
  "randomly drawn replacement, never first-day-back". NEW requirements:
  per-week ceiling as program config + flag-to-CM-review when
  compression would exceed it; excusal REQUEST/approve/deny/reschedule
  as discrete actor+timestamp events (our one-way mark is approve-only
  — needs the request/deny shape); TRAVEL IS NOT EXCUSAL — reason
  taxonomy + OUT-OF-AREA COLLECTION ORDER as the default travel path
  (new concept; pairs with collection_site); extended absences beyond a
  program threshold bypass rescheduling → Medical Director + documented
  monitoring-agreement modification. She OFFERED to write the
  rescheduling rules document — SAY YES (it becomes the 3b contract).
- **Positive results (story 4's real spec):** sentinel-immediate,
  internal-only; result record is a STATE MACHINE with append-only
  history: Received → screen non-negative (sentinel) → lab-confirmed
  (GC-MS/LC-MS-MS) → MRO review → disposition {confirmed positive |
  reconciled legitimate-medical-explanation (verified negative,
  documented) | reconciled lab/admin error (typed) | other (narrative +
  MRO signature)}. Dilute, adulterated, substituted, invalid,
  cancelled, refusal = SEPARATE compliance events with own workflows/
  alert paths, never positive/negative subtypes. Record-LEVEL portal
  suppression (no pending item, no gap). Notifications by stage
  (sentinel: CM + MRO queue + MD internal only; confirmed: clinical
  tier fires, participant sees + notified; external reporting NEVER
  automatic). Scoring/tier move ONLY on disposition, forward-only from
  disposition date. 42 CFR Part 2 notification content rule: no result
  content/substance names/treatment status in ANY text or email —
  staff included; "action required, log in" only. She OFFERED the
  state-machine document — SAY YES (the story-4 contract).
  ⚠️ Check under the same principle: the BREAK_GLASS_GRANT notification
  detail includes document TITLES — audit whether titles can carry
  sensitive content; likely change to counts-only.
- **MRO is a distinct FUNCTION** — likely a role-map addition (MRO may
  be the MD or a separate person; keep as data).

## 3. Marvin Behavioral Health (thread + two PDFs, Downloads)

- WHO: teletherapy/behavioral-health platform specialized in healthcare
  workers (burnout, moral injury, substance misuse; 24/7 crisis line;
  therapist network avg 15-16 yrs; leadership/resilience programs;
  PHQ-9/GAD-7/MBI outcome tracking, de-identified aggregate reporting).
  Real traction: Novant, McLaren, Baystate, Harvard South Shore
  psychiatry residency, Wisconsin Medical Society logo on the trust
  slide. VP Sales Holly Hockemeier; clinical director Jacinta Harmann;
  John Bracaglia. Met Erica + Dr. Joles July 24.
- WHAT THEY WANT: clinical deep-dive + "IT alignment... integration
  specifics" — the IT person is effectively Bill. Erica asked the team
  for availability WEEK OF 8/16 for both meetings.
- PLATFORM READ: care-delivery complement, not competitor — Insight
  monitors/detects, Marvin treats. The natural integration is
  referral-out (and maybe outcomes-back), which is TREATMENT-STATUS
  DISCLOSURE territory: any participant data flowing to Marvin rides
  the consent architecture + 42 CFR Part 2. First meeting =
  exploratory; no integration commitments; nothing lands on the build
  queue until Erica ranks it.

## 4. Actions

- BILL: (1) send Erica his week-of-8/16 availability (Marvin ×2 —
  note WPHP standing slots + the Aug 13 orientation crowd that week);
  (2) answer her "someone else to take a deeper look" ask —
  recommendation: health-information privacy counsel (HIPAA/Part 2)
  before real files, rather than the larger internal group; (3) tell
  her YES to both offered documents (rescheduling rules + result state
  machine); (4) go/timing for the Rev 1.1 alignment story.
- BUILD QUEUE (next dev session, after the BI push clears + our held
  push lands): Rev 1.1 alignment story; then 3b (check-ins via the
  participant app) once her rescheduling doc arrives; story 4 shaped by
  her state-machine doc; excusal request/deny events + travel taxonomy
  + out-of-area collection orders + per-week ceiling fold into 3b/4.
- RECORDED CONFIRMATIONS: wrinkles (a)/(b) confirmed by her Aug 3 note
  — but note Rev 1.1 then SUPERSEDES both wrinkle implementations with
  cleaner rules (points 3-4 above).
