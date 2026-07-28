# PI² Master Build List
**Edition 3 · July 31, 2026**

> Source of truth for the Word edition sent to Erica (+ Tom), planned send 2026-07-31
> (the Friday cadence). Process unchanged: WE maintain this list in the repo; each send
> is a dated .docx snapshot in this folder (`PI2_Master_Build_List_YYYY-MM-DD.docx`,
> never overwritten); Erica confirms completeness and RANKS — her ranking sets the
> build order. If her Washington ranking lands before Friday, fold it in and
> regenerate before sending.

Erica — the weekly edition, as promised. The headline is your #3: the Network Directory is live, and the first piece of its second phase — the privacy wall around participant selections — is built and running. This past week was quieter on your screens and louder underneath: the platform grew an engagement rules engine and the full outbound messaging foundation — plumbing that waits behind your consent architecture (details below). Three asks, two of them carried:

1. **If anything is missing, add it.** Same standing rule — if you've asked for something and it isn't here, say so and it goes on the list.
2. **The Washington wish-list ranking**, whenever you get to it — the section below still holds its place.
3. **Your document access rules** — still the one decision standing between the Document Repository (your #1) and real files, and now also part of what unlocks the directory's sharing step.

## ✅ Recently completed — everything below is LIVE on your site

**July 24 — the Network Directory, Phase 1 (your #3, built to your specification):** both sections live side by side — your program's own network and the IHS Network Directory — with the three-way program setting (IHS only / program only / both), Listed and Verified states, neutral alphabetical ordering (verification is a badge and a filter, never a rank), cost in the detail view only, and your Appendix A wording exactly. The participant page works without a login, for screening completers as well as participants. **The directory starts empty on purpose — your team fills it.** Your program's management screen and the IHS network screen are both under settings; verification changes are restricted to platform administration, exactly as your spec separates the governance.

**July 24 — the selection wall (the first half of Phase 2, the piece your spec flags as "most likely to be broken quietly in build"):** when a participant selects an entity from the directory, that selection now has a home — and it is participant-scoped at the data layer, exactly per your section 7.1. No program screen, report, export, dashboard, or support tool can read it; nothing announces it; deleting or renaming a directory entity can neither destroy nor reveal it. And the protection is automated: our test suite now attacks that wall from every staff door on every run, and fails loudly if any future change would let a program role read a selection. It cannot be broken quietly. **What deliberately waits:** the sharing step (the signed release, filed under Consent Layer 3) and the participant-facing screens — both depend on the consent architecture (your #2, with legal) and your document access rules. When those land, the doors get built onto a wall that is already standing and already guarded.

**July 25 — the deactivation guard (your decision of July 23, built to your words):** nobody can be deactivated while they still carry open registry items. The system stops at the door and lists exactly what's open — urgency, reason, and the date each item was opened — so everything is completed, defensible, and no safety item is left unseen. Resolving the items unlocks the door; reactivating someone was never blocked. One piece of housekeeping this surfaces: **one already-deactivated test person (Erica Kind) carries an open overdue RED item from before the guard existed** — the guard can't reach back, so that one needs your team to resolve it clinically, and then the books are clean.

**July 26-27 — two small visible touches, and two large foundations underneath.** The visible pair: the registry's item view button now reads **"View chart"** (your wording, matching the intake queue), and the health-system picker now says **"No health systems configured yet"** instead of opening an empty window — Washington shows that honestly until its kickoff configuration, on purpose; no placeholder data on a production-bound program. Underneath, two platform foundations you'll feel later rather than see now:

- **An engagement rules engine** — define a condition once (for example, "no activity in 60 days") and the platform checks everyone against it daily and acts exactly once per episode, never nagging the same person twice. Your clinical monitoring machinery is completely separate and untouched — this is the general-purpose engine that future monitoring-track features (reminders, check-in nudges, escalation) will be built on.
- **The outbound messaging foundation** — every future email or text to a member now flows through one queue with an address snapshot, delivery receipts, bounce history that heals itself when an address is corrected, and a do-not-contact rulebook. **For your programs the messaging door ships locked:** no participant can be emailed or texted until your consent architecture deliberately opens it — it cannot happen by accident or misconfiguration. No delivery provider is connected yet (that vendor choice is ours, still ahead); the machinery is built and waiting.

**July 22-23 — the "No longer needed" follow-up outcome (your suggestion, same-week)** and **the screens release** — as recorded in Edition 2.

*(Earlier releases — July 12 through July 21 — as recorded in Editions 1 and 2.)*

## 🐞 Bugs

None open today. Anything you find goes here — and goes first.

## 🔹 Small Enhancements

1. **Per-track instrument templates** — each track (screening / optimization / monitoring) gets a default instrument set, applied automatically at activation. *Becomes configuration the moment your protocol answers arrive.*
2. **GAD-7 alert thresholds** — wired like the PHQ-9 alert once you set the protocol levels.
3. ~~Deactivation guard for open registry items~~ — **built and live July 25** (see Recently completed).

## 🔷 Large Enhancements — YOUR RANKING (received July 20) is the build order

### 1. Document Repository — ranked first; the spine and screens are BUILT and LIVE
What remains are decisions, not construction:
- **Your access rules — the one decision blocking your own #1** (who sees what: case manager / medical director / admin; does a participant see their own). You're writing these now. The standing gate holds: no real documents until role-based access is built.
- Phase B vendor picks + agreements (ours): production encrypted storage, inbound fax, OCR.

### 2. Consent architecture — ranked second; you drive it
- Legal review of Layers 1 and 4; each state's PHP supplies its own layers. Build hooks (e-signature, stored consent records, revocation) come after legal signs off. Nothing buildable yet.
- What it unlocks: participant email and text, true self-registration with participant logins, and the directory's sharing step — the release flow now waits on this and on your access rules, with the selection wall already built underneath it.
- New since last edition: **the messaging plumbing itself is now built and waiting** (the queue, receipts, and bounce handling — see Recently completed), behind a consent gate that ships locked for your programs. When your consent architecture says go, the door opens deliberately; nothing needs to be rebuilt.

### 3. Network Directory — ranked third; Phase 1 LIVE, Phase 2 half-built
- ✅ **Phase 1, the directory — LIVE July 24** (see Recently completed). Your team fills it.
- ✅ **Phase 2, first half — the selection wall — LIVE July 24**: a participant's selection is theirs alone; program staff cannot see it, enforced at the data layer and guarded by automated test.
- ⏳ **Phase 2, second half — sharing**: the signed release (named recipient, chosen purpose, twelve-month duration with revocation, typed-name execution), filed to the Document Repository under Consent Layer 3. Waits on the consent architecture (#2) and your access rules.
- The entity application and verification workflow: apply, credential review, annual re-verification — the review is purchased, never the outcome
- Paid features for Verified entities only, never inside a program's list (needs a payment provider)
- Suggested lists: criteria-matched, explainable, participant-private — payment carries zero weight
- Your §10 open decisions stay open; everything above is built to the neutral defaults your spec prescribes

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
- Secure messaging *(the delivery plumbing now exists — waits on your consent architecture and a provider choice)*
- Camera document capture
- In-app billing and ledger
- Meeting-attendance GPS
- Travel and medical time-off requests, with a forms library

**And beyond:**
- Toxicology / lab ordering and results
- Treatment Provider Network — application, nine-domain scoring, network tiers, referral routing, the communication obligations, real-time professional-bed availability
- Escalate-until-acknowledged alerting — a critical alert walks text → call → app until receipt is confirmed *(the queue and receipt machinery now exist; a messaging provider is still needed)*
- Appointment and reminder machinery — proposed times, calendar invites, day-of reminders (consent-gated)
- Board reporting (counsel-gated)
- ~~Standing up the second state~~ — *happening: Washington signed; the wa_php program exists and stands ready for kickoff (~Aug 15)*

## 📋 In Your Court

- **Washington wish-list ranking** (your gut read, pilot-vs-production split, ranking)
- **Document repository access rules** (you're writing them — unlocks your #1, the real-files gate, and the directory's sharing step)
- **Filling the Network Directory** — it's live and empty; your team adds the entities (your program list and the IHS pool)
- **Erica Kind's leftover open RED item** — deactivated before the guard existed; needs a clinical resolution so nothing sits unseen
- Clinical instrument library content and resource guide (yours, in progress)
- Consent architecture → multi-state PHP counsel; Layer-1 agreement → legal review
- Protocol answers: per-track instrument sets, GAD-7 thresholds, proprietary instrument picks and licensing
- Jim's confirmation on who owns the intake outreach clock
- Chris's confirmation of the compliance-starts-at-activation moment (you gave the provisional yes July 21)
- Medication registry §9 decisions, when that build approaches
