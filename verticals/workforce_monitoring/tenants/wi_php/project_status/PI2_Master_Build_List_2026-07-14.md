# PI² Master Build List
**Edition 1 · July 14, 2026**

> Source of truth for the Word edition sent to Erica (+ Tom). Process: WE maintain
> this list in the repo; each send is a dated .docx snapshot in this folder
> (`PI2_Master_Build_List_YYYY-MM-DD.docx`, never overwritten); Erica confirms
> completeness and RANKS the Large Enhancements — her ranking sets the build order.
> The .docx beside this file is the exact content below, produced 2026-07-14.

Erica — this is the complete inventory of everything on the PI² build list: every request, specification, and idea from your packets, your testing, and our discussions, in one place. Three asks:

1. **If anything is missing, add it.** If you've asked for something and it isn't here, it fell through the cracks — say so and it goes on the list.
2. **Rank the Large Enhancements.** Your top three to five set the build order. Bugs always jump the line; small items fill the gaps between big ones.
3. **Tell us the update rhythm that works for you.** We're moving to smaller, more frequent updates — one improvement at a time, each with a short note about what changed — rather than big bundles. Does that fit how you and your team absorb change? And would you rather get a quick heads-up before each update lands, or just the note after it's live? Whatever cadence fits how you work, we'll match it.

## ✅ Recently completed

**Built and tested — arriving in your next update** (your intake specification, first half):
- **The Intake Queue is its own surface**, separated from the Stability Registry — prioritized by the deadline clock (on time / due soon / overdue), never by a clinical tier the person hasn't earned; registrant and participant counts reported separately
- **The corrected intake item**: review type, a named owner, and stage — "Urgency: Yellow" and "Source: Composite Score" are gone from intake
- **Role-based actions, enforced by the server**: the case manager records outreach, notes, routes to resources, and sends up; the Medical Director approves for screening, refers for evaluation or treatment, sends back with a reason, and is the only one who closes a file. Escalate and Advance are retired.
- **Your defect 4 solved properly**: an item awaiting Medical Director review says so, visibly
- **The bell lands on the registration itself**, not the general list
- The roster now holds participants only; registrants live on the Intake Queue

**Also built and tested — the second half of your intake specification** (arrives as its own update right after the first; one story per release):
- **The registration link**: the invite panel now offers two link types — the screening link (anonymous, sendable to anyone) and the registration link, which opens a simple public form (name, contact, referral type pre-filled from the link) and creates a true registrant record in the case manager's queue, deadline clock running
- **Participant activation — the gap you spotted in June**: "Record signed agreement" on an intake item assigns the clinic, starts their instruments, and moves them to the roster — a person becomes a participant at exactly one moment, the signing of the monitoring agreement
- **The Columbia screening at intake**: the C-SSRS screener is in the instrument catalog; a positive answer fires a SENTINEL immediately, participant or not. (Today ANY "yes" counts as positive — the most conservative setting; tell us if your protocol draws the line differently)
- **Reactivation as a first-class path**: a closed, declined, or routed-away file reopens with one click — same record, full history, never re-registered. And if that person uses a registration link again, the system recognizes them and reopens their file instead of creating a duplicate
- Your open decisions stay open: outreach owner (Jim), overdue behavior, record retention, reactivation trigger — we built sensible defaults, all changeable

**Also built and tested — credentials** (the design you and Tom confirmed; its own small update):
- Credentials display after the name — "Jane Smith, MD" — on the roster, the participant chart, and the intake queue; a person can hold several ("Erica Larson, D.O., PhD")
- One flat list for every profession, on purpose — never tied to a licensing board (Tom's maxillofacial-surgeon rule); no honorifics
- Tom's starting set is loaded (MD, DO, the international physician degrees, PA-C, LPN, RN, NP, DDS, DMD, BDS)
- **A Credentials page under Program Settings** — your team owns the list: add a new credential, rename one, or retire one. Retiring never erases: a retired credential stops being offered but keeps displaying for everyone who holds it

**July 14 release** (from your testing feedback):
- Assigned instruments now reach the participant portal — the portal shows each participant exactly their own assessments, with schedules and due status
- The instruments section no longer vanishes from the chart — if it can't load, it says so and offers "Try again"
- QR codes carry the referral details, and each referral now has a printable QR page
- A duplicate membership number at enrollment gets a plain-English explanation and opens the participant search

**July 12 release:** the items in your testing checklist — instrument assignment with cadences, the resurrected overdue-tracking, the 10-instrument catalog with PHQ-9 and GAD-7, position-based routing, and the registration review flow you exercised.

## 🐞 Bugs

None open today. Anything you find goes here — and goes first.

## 🔹 Small Enhancements

1. **Per-track instrument templates** — each track (screening / optimization / monitoring) gets a default instrument set, applied automatically at activation. *Becomes configuration the moment your protocol answers arrive.*
2. **GAD-7 alert thresholds** — wired like the PHQ-9 alert once you set the protocol levels.

## 🔷 Large Enhancements (please rank)

*(Your entire intake specification — both halves — is now built; see Recently completed. It came off this list, so the ranking starts with the directory.)*

### 1. Network Directory — your specification; supersedes the earlier directory materials
- Phase 1, the directory: your program's own network and the IHS network side by side, the three-way program setting (IHS only / program only / both), Listed and Verified states, neutral ordering, participant-applied filters, and "suggest an entity" with the participant's name never attached
- Phase 2, selections and sharing: a participant's selection is theirs alone — program staff cannot see it — and sharing happens only through a signed release, filed to the Document Repository
- The entity application and verification workflow: apply, credential review, annual re-verification — the review is purchased, never the outcome
- Paid features for Verified entities only, never inside a program's list (needs a payment provider)
- Suggested lists: criteria-matched, explainable, participant-private — payment carries zero weight

### 2. Document Repository — the foundation piece; the medication registry and the consent records build on it
- Encrypted file storage, separate from the database
- One record per file: type, participant and entity linkage, versions, retention class, legal hold
- Ingestion by upload, fax-as-PDF, secure email, and API
- OCR and auto-classification (vendor selection needed)
- Role-based access with a tamper-evident log of every view and download
- Full-text search

### 3. Medication Registry — your specification; depends on the Document Repository
- Structured medication entries anchored to RxNorm
- The two governed reference tables (medication→test with detection windows; cross-reactivity) — license-or-build decision with clinical sign-off
- Quarterly and event-triggered attestation — a positive screen forces re-attestation before adjudication
- Reconciliation: Consistent / Partially explained / Unexplained → the review queue; a human medical reviewer always decides
- An unexplained confirmed positive moves the risk picture
- Photo and OCR evidence capture, stored in the repository
- Your nine open decisions from §9 stay open

### 4. Consent architecture, built — gated on legal review, not on build effort
- Electronic acceptance of the Layer-1 agreement at registration and screening
- Per-layer consent records and per-recipient releases, with disclosure audit and revocation
- What it unlocks: participant email and text, true self-registration with participant logins, and the directory's sharing phase

### 5. Resource Library — awaiting your specification; you're assembling the content
- The curated collection — papers, learning modules, pamphlets, tools, links — organized by topic, audience, and format
- Resource matching: screening and monitoring results steer the right content to the right person — your original screening-to-resources idea

*Running beneath everything: the predictive model keeps learning as real data accumulates — the capability your competitor analysis showed neither RecoveryTrek nor Affinity has.*

## 🔮 Maybe in the Future

**The monitoring-track table stakes** (your competitor comparison — each its own build):
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
- Standing up the second state — everything above is being built so a new program is configuration, not construction

## 📋 In Your Court

- Rank the Large Enhancements; add anything missing
- Clinical instrument library content and resource guide (yours, in progress)
- Consent architecture → multi-state PHP counsel; Layer-1 agreement → legal review
- Protocol answers: per-track instrument sets, GAD-7 thresholds, proprietary instrument picks and licensing
- Jim's confirmation on who owns the intake outreach clock
- Medication registry §9 decisions, when that build approaches
