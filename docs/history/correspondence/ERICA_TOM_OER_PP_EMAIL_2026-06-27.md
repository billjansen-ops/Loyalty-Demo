# Erica + Tom — Performance Profile & OER requirements + Wednesday demo (2026-06-27)

**Captured Session 123** (it was only in Bill's mail before — the source the whole
Erica build rests on). This is the verbatim thread: Erica's original requirements
for both instruments, Tom's scoping notes, Bill's 4 questions, and Erica + Tom's
**answers** to those questions.

The actionable answers are folded into `docs/PERFORMANCE_PROFILE_OER_PLAN.md`
(open decisions). Erica's OER "Questions:" list is the "ERICA'S 8 OER QUESTIONS"
section there.

---

## Erica + Tom's ANSWERS to Bill's 4 questions (most recent)

1. **PPSI scoring** (straight section totals vs the weighted PPSI we run today)?
   → **Erica:** "Score and run like we have it already built. Sorry for the
   confusion on that, good catch." → use the **live weighted PPSI**. ✅ done in demo.
2. **Foundations of Health ranges/tiers final as written?**
   → **Erica:** "Yes, I like the way that looks. **Tom, do you have thoughts or
   changes to the scoring?**" → Erica approved; **Tom later gave a thumbs-up on the
   scoring (confirmed to Bill, 2026-06-28) — Foundations scoring is now final.**
3. **Monitoring-track consent / release-of-information approach (42 CFR Part 2),
   or plan for legal review?**
   → **Erica:** "I can create a preliminary version, but we will need input from
   **both Chris and legal** on this."
4. **(Tom) Wednesday — live "scan, take it, see your result"? Dr. Stadler scanning
   his own phone in the room?**
   → **Tom:** "We will be on a **zoom**, so I had envisioned that we would simply
   **share our screen and display the QR and then simply go to a link** for the
   questionnaire in order to give him an idea of simplicity of use. Other than that
   I think **Erica had intended on providing a brief walkthrough of our
   infrastructure** as we had done for Washington." → **NOT** in-room phone scan;
   it's Zoom screen-share (show QR + open the link) + Erica's infra walkthrough.
   → **Bill:** "Agree with Tom on this."

---

## Bill → Erica, Tom (2026-06-27, the "Wednesday plan + answers" email)

> Erica, Tom —
>
> Thanks for these — we've been through both forms and Erica's notes in detail.
> Quick summary of where we're headed and a few questions.
>
> **For Wednesday (Dr. Stadler).** We're building a working QR demo of the
> Performance Profile: scan the code, take the assessment, and get a scored result
> on the spot — both the stability read (PPSI) and the dominant lifestyle driver
> from the Foundations of Health section, which is the optimization story. The
> walkthrough of Erica's documents is ready as a backup, but we're aiming to put
> the live experience in Dr. Stadler's hands.
>
> **The bigger picture — encouraging.** A lot of what these two instruments need,
> we've already built (scoring, dominant-driver logic, scheduled reminders,
> automatic escalation, the integrated participant view). So the assessments
> themselves come together quickly. The genuinely new pieces are the
> self-registration front door, the participant portal, the observer accounts for
> the OER, and the cross-PHP linkage. We'll phase those — and we'll stand up the
> access-control and data-protection foundation appropriate for clinical monitoring
> data (42 CFR Part 2 / HIPAA) before real participants start self-registering, so
> it's done right from day one.
>
> A few questions so we build the right thing:
> - (Erica) PPSI straight section totals into four tiers, or the weighted PPSI we
>   already run today?
> - (Erica) Are the Foundations of Health score ranges and tiers final as written?
> - (Erica) Monitoring track — consent / release-of-information approach given 42 CFR
>   Part 2, or plan for a legal review?
> - (Tom) For Wednesday — is a live "scan, take it, see your result" what you'd like
>   Dr. Stadler to experience, and will he be scanning on his own phone in the room?
>
> Keep sending things our way — this is coming together well.
> Bill

## Tom → (earlier, 2026-06-27)

> I think initially if we simply had a qr pathway to access the professional profile
> that would be enough for Dr. Stadler on Wednesday. If that's not possible I think
> we can still provide an excellent overview of what we're developing as Erica has
> put together some documents. **The OER is lower priority for Wednesday as
> workforce monitoring and optimization are going to [be] big sellers for Dr.
> Stadler.**

---

## Erica's ORIGINAL requirements email (the source for the whole build)

### Performance Profile

Created but needs help conceptualizing the technical build. Mike's primary interest
is workforce support and well-being, so the framing matters: **this needs to read as
an accessible entry point, not a clinical intake.**

Intended as a **single entry point for any individual** engaging with us — a PHP
participant entering monitoring, a healthcare professional pursuing performance
optimization, a first responder, a licensed practitioner, or any other working
professional seeking support/resources. Built around two integrated components: the
**Predictive Professional Stability Index (PPSI)** and the **Foundations of Health
Profile** (physical activity, nutrition, substance use). All instruments draw
exclusively from public-domain federal references (AUDIT-C, NIDA Quick Screen, HHS
Physical Activity Guidelines) plus the proprietary PPSI — **no licensing
dependencies**.

**Dual-track design:** Reason for Referral and Service Preferences each have separate
"stability/wellness" and "performance optimization" tracks — peak-performance coaching
enters the same door as acute stabilization without either being mislabeled. A
**Licensure Status gate** conditionally surfaces professional licensing fields only
for licensed practitioners (non-licensed workforce users complete without friction).

Vision: a shareable link → registration portal → complete assessment → account created
→ access to resources → ongoing engagement via a participant portal. (Erica: "I've
struggled to conceptualize the linkage architecture.")

Build items:
1. **Self-registration and assessment flow** — a link (from us, a partner, a colleague,
   or a QR code) → form → scores PPSI + Foundations → creates a participant account on
   submission. No staff intervention for the initial pathway.
2. **Tiered participant portal access** — resources matched to results (e.g. sleep
   content for PPSI Sleep Stability concern range; lifestyle-pillar content for the
   weakest Foundations pillar; general well-being content for all). The portal is the
   persistent home for ongoing engagement.
3. **PHP linkage — bidirectional.** (a) Participant can opt in to PHP connection from
   the portal if warranted. (b) A PHP can refer an individual, registered + linked to
   that PHP's monitoring framework immediately on form completion — data flows from
   registration into the PHP workflow without manual re-entry. The form already
   captures Reason for Referral source, licensing board, and state.
4. **Resource library structure** — scalable map of assessment domain scores →
   recommended resources; add/retire/update content without rebuilding matching logic.
   (Erica is compiling content now.)
5. **Privacy and data handling architecture** — dual-track: optimization-track expects
   wellness-app-level privacy; PHP-monitoring expects clinical-grade confidentiality
   with appropriate releases. Distinguish the pathways **from the moment of
   registration** and apply the corresponding data handling.

### Occupational Environment Report (OER)

Second form ready to build. Structurally different: captures **workplace observer
input** on PHP participants under monitoring. Recurring cadence (monthly or quarterly
per the PHP's monitoring intensity).

- The user is **not the participant** — it's a workplace contact designated to observe
  and report, under a release of information signed at the start of monitoring. The
  observer authenticates and submits reports; they get an **observer access pathway**
  (a recurring secure submission portal), not a participant portal.
- **Recurring on a schedule, not one-time intake.** Track each participant's reporting
  cadence, generate observer-specific cycles, send reminders before due dates, flag
  overdue, possibly show the previous report's data for continuity (form has "Previous
  Report Date" / "Next Report Due Date").
- **Multiple observers per participant** (Monitoring Team Roster, Section 12) — e.g.
  medical director, occupational health provider, peer monitor. Each observer sees
  **only their own** report history (not other observers'), for objectivity.
- **Data flows into the PHP's monitoring workflow, not the participant's account.** The
  participant doesn't see their OER content — it's between observer and PHP. Key
  privacy/architectural distinction from the self-report flow.

**Questions:** (the 8 — see ERICA'S 8 OER QUESTIONS in the plan doc):
observer onboarding/authentication · recurring cadence + reminders · automatic
escalation triggers (Sec 11 stability alert / Sec 7F impairment indicators / Sec 9
restriction noncompliance) · one-business-day reportable-event pathway (positive tox,
treatment-compliance, against-advice discharge, failure to stop practicing) ·
cross-form integration (OER + Fitness-for-Duty + Provider Report → one PHP view) ·
confidentiality / statutory protection (42 CFR Part 2 + state PHP statutes + HIPAA) ·
observer transitions (preserve longitudinal record; PHP authorizes each) ·
conflict-of-interest flagging (Section 2 COI declaration → flag to PHP for review).

### Erica's parallel side-work (she's building; not our ask yet)
- Resource library + additional dominant-driver logic + protocol cards that link to the
  screening tool with supportive / lifestyle-medicine info.
- A **medication system** that tracks current meds and cross-references a flagged urine
  drug screen against prescribed meds (e.g. a stimulant medication).
