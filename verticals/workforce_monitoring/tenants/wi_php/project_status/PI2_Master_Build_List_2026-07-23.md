# PI² Master Build List
**Edition 2 · July 23, 2026**

> Source of truth for the Word edition sent to Erica (+ Tom), produced 2026-07-23.
> Process: WE maintain this list in the repo; each send is a dated .docx snapshot in
> this folder (`PI2_Master_Build_List_YYYY-MM-DD.docx`, never overwritten); Erica
> confirms completeness and RANKS — her ranking sets the build order.
> **Publishing cadence (Bill, 2026-07-23): a fresh edition every Friday** while the
> build pace is this fast, stepping down to every other week when it settles; a
> ranking-ask always triggers an edition regardless of the calendar. Per-release
> notes keep their own rhythm (hers: note after, no heads-up).

Erica — this is the complete inventory of everything on the PI² build list, brought current. A lot has moved since Edition 1: your ranking now drives the build order, and everything Edition 1 called "arriving in your next update" is live on your site. Three asks this time:

1. **If anything is missing, add it.** Same standing rule — if you've asked for something and it isn't here, say so and it goes on the list.
2. **The Washington wish-list ranking**, whenever you get to it — no rush with your big meeting; the section below holds its place.
3. **Your document access rules** — still the one decision standing between the Document Repository (your #1) and real files.

## ✅ Recently completed — everything below is LIVE on your site

**July 22-23 — the "No longer needed" follow-up outcome (your suggestion, same-week):** a fifth way to complete a follow-up check, for when the check no longer applies. It clears the check from the pending count, never triggers any escalation or alert, and shows plainly in history and exports.

**July 22 — the screens release:** export timestamps read properly in Excel (all three export formats); the follow-up counts agree — the dashboard badge and the worklist now count the same population (pending checks on resolved items were silently missing from the badge); the safety-note banner on the registry renders its list (a pending safety review had no reachable Review door); mobile demo fixes (real avatar, wired stability ring).

**July 21 — two releases:**
- *Your feedback batch:* intake notes were never lost, they were hidden — the item detail and the participant chart now show a person's full intake history; the queue never hides an action's outcome (your "vanished send-back"); reactivation searches by name with a recently-closed list; Invite + Enroll buttons on the Intake Queue; "View chart"; the chart's back link knows where you came from. Plus: compliance items now start automatically the day someone becomes a participant (you confirmed the moment, pending Chris); and the MEDS self-heal was corrected so overdue people are never misread as current.
- *PHQ-9 question 9 is a SENTINEL* — your confirmed word, live the same day: a positive self-harm answer files an immediate sentinel item (was a 24-hour red), matching the intake Columbia screen.

**July 20 — your safety pair (from your testing):** registrants' registry items are no longer invisible in program views (no-clinic people appear everywhere, tagged Unassigned); and the bells that never rang — every registry-item alert, sentinels included, had been routing to roles no login has ever held — now reach your Medical Director and Case Manager positions. Also: an instrument assigned today is no longer instantly "missed," and completed instruments clear their missed items automatically.

**July 19 — the big release (Edition 1's "arriving in your next update," delivered):** your entire intake specification, both halves — the separate Intake Queue with the deadline clock, role-based actions enforced by the server, the registration link and public form, participant activation at the signing moment, the Columbia screening at intake, first-class reactivation. Plus credentials ("Jane Smith, MD" everywhere, your team owns the list), and the Document Repository screens — the participant chart's Documents card, the program Documents page, and the document detail with version history.

*(Earlier releases — July 12 and July 14 — as recorded in Edition 1.)*

## 🐞 Bugs

None open today. Anything you find goes here — and goes first.

## 🔹 Small Enhancements

1. **Per-track instrument templates** — each track (screening / optimization / monitoring) gets a default instrument set, applied automatically at activation. *Becomes configuration the moment your protocol answers arrive.*
2. **GAD-7 alert thresholds** — wired like the PHQ-9 alert once you set the protocol levels.
3. **Deactivation guard for open registry items** — your decision (July 23): no one can be deactivated while they still carry open registry items; the system stops at the door and says what's open, so everything is completed, defensible, and no safety item is left unseen. Design decided; ready to build when it reaches the top.

## 🔷 Large Enhancements — YOUR RANKING (received July 20) is the build order

### 1. Document Repository — ranked first; the spine and screens are BUILT and LIVE
What remains are decisions, not construction:
- **Your access rules — the one decision blocking your own #1** (who sees what: case manager / medical director / admin; does a participant see their own). You're writing these now. The standing gate holds: no real documents until role-based access is built.
- Phase B vendor picks + agreements (ours): production encrypted storage, inbound fax, OCR.

### 2. Consent architecture — ranked second; you drive it
- Legal review of Layers 1 and 4; each state's PHP supplies its own layers. Build hooks (e-signature, stored consent records, revocation) come after legal signs off. Nothing buildable yet.
- What it unlocks: participant email and text, true self-registration with participant logins, and the directory's sharing phase.

### 3. Network Directory — ranked third; THE NEXT BIG BUILD (your specification is the contract)
- Phase 1, the directory: your program's own network and the IHS network side by side, the three-way program setting (IHS only / program only / both), Listed and Verified states, neutral ordering, participant-applied filters, and "suggest an entity" with the participant's name never attached
- Phase 2, selections and sharing: a participant's selection is theirs alone — program staff cannot see it — and sharing happens only through a signed release, filed to the Document Repository
- The entity application and verification workflow: apply, credential review, annual re-verification — the review is purchased, never the outcome
- Paid features for Verified entities only, never inside a program's list (needs a payment provider)
- Suggested lists: criteria-matched, explainable, participant-private — payment carries zero weight

### 4. Medication Registry — ranked fourth; depends on the Document Repository
- Structured medication entries anchored to RxNorm
- The two governed reference tables (medication→test with detection windows; cross-reactivity) — license-or-build decision with clinical sign-off
- Quarterly and event-triggered attestation — a positive screen forces re-attestation before adjudication
- Reconciliation: Consistent / Partially explained / Unexplained → the review queue; a human medical reviewer always decides
- An unexplained confirmed positive moves the risk picture
- Photo and OCR evidence capture, stored in the repository
- Your nine open decisions from §9 stay open

### 5. Resource Library — ranked fifth; awaiting your specification, you're assembling the content
- The curated collection — papers, learning modules, pamphlets, tools, links — organized by topic, audience, and format
- Resource matching: screening and monitoring results steer the right content to the right person — your original screening-to-resources idea

*Running beneath everything: the predictive model keeps learning as real data accumulates — the capability your competitor analysis showed neither RecoveryTrek nor Affinity has.*

## 🗻 Washington's wish list (received July 22 — your ranking pending)

WPHP's platform wish list arrived through you. Awaiting your read: gut reaction (real need vs competitor echo), the pilot-vs-production split, and a master-list-style ranking. When it arrives it folds into the next edition of this list and feeds the August kickoff. *(Several items overlap the monitoring-track list below.)*

## 🔮 Maybe in the Future

**The monitoring-track table stakes** (your competitor comparison — each its own build; Washington's wish list may promote some of these):
- Daily check-in
- Random test-selection engine with participant notice
- Chain-of-custody number reporting
- Collection-site finder
- Participant calendar
- Secure messaging
- Camera document capture
- In-app billing and ledger
- Meeting-attendance GPS
- Travel and medical time-off requests, with a forms library

**And beyond:**
- Toxicology / lab ordering and results
- Treatment Provider Network — application, nine-domain scoring, network tiers, referral routing, the communication obligations, real-time professional-bed availability
- Escalate-until-acknowledged alerting — a critical alert walks text → call → app until receipt is confirmed (messaging provider needed first)
- Appointment and reminder machinery — proposed times, calendar invites, day-of reminders (consent-gated)
- Board reporting (counsel-gated)
- ~~Standing up the second state~~ — *happening: Washington signed; the wa_php program exists and stands ready for kickoff (~Aug 15)*

## 📋 In Your Court

- **Washington wish-list ranking** (your gut read, pilot-vs-production split, ranking)
- **Document repository access rules** (you're writing them — unlocks your #1 and the real-files gate)
- Clinical instrument library content and resource guide (yours, in progress)
- Consent architecture → multi-state PHP counsel; Layer-1 agreement → legal review
- Protocol answers: per-track instrument sets, GAD-7 thresholds, proprietary instrument picks and licensing
- Jim's confirmation on who owns the intake outreach clock
- Chris's confirmation of the compliance-starts-at-activation moment (you gave the provisional yes July 21)
- Medication registry §9 decisions, when that build approaches
