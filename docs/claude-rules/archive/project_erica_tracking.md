---
name: Erica's outstanding work items
description: Maintained list of what's built and what remains for Erica's releases
type: project
originSessionId: 89b77d55-1fa5-461d-b8e9-1b264b355b5a
---
## Archived Snapshot

This file is retained as a historical Claude-memory snapshot.

Do not treat it as current truth.
Use `STATE.md`, `ACTIVE_WORK.md`, and the current docs/history/correspondence
lane instead.

## Erica's Feature Tracking (Updated May 12, 2026 — Session 113)

### Current state with Erica

**Last email from Erica:** her round-2 reply to Session 112's email — approved all three design picks (text inputs, profile-edits-on-timeline, recalculate drill-down), confirmed PPSI_Q3 rename, picked option A for retroactive PPSI recompute (with a cutover marker), asked for Previous PPSI mirroring Previous PPII. Also raised the Affinity Work Site Monitor / Ohio form / Caduceus GPS direction as a future data-stream addition.

**Status of Session 113 round 2 items — all live on Heroku v71 / DB v65:**

| Item | Status | Notes |
|---|---|---|
| Sliders → text inputs on both admin weights pages | ✅ Shipped | Bar kept (read-only); number input is only interactive control |
| Profile changes log on profile page (NOT activity timeline) | ✅ Shipped | New `/v1/member/:id/profile-log` endpoint + Edit Profile button on chart + Profile Update Log section on csr_member.html. Earlier Session 113 round-1 timeline merge backed out. |
| Recalculate Member Scores drill-down | ✅ Shipped | `members[]` in response sorted by \|Δ\|; View Details modal with old → new → Δ |
| Previous PPSI sub-line + cutover marker | ✅ Shipped | New `/v1/member/:id/ppsi-history` endpoint; dashed purple "weights changed" line on trend canvas at cutover date |
| Notes filter renamed "💬 With Notes" | ✅ Shipped | Tooltip clarifies it filters Surveys/Pulses/Events with attached comments |
| PPSI_Q3 label rename → "PPSI Severe Item Response" | ✅ Shipped | db_migrate v65; internal signal code 'PPSI_Q3' unchanged |
| Retroactive PPSI recompute = option (A) "leave the past alone" | ✅ Shipped | Pre-cutover scores stay; new ones use new weights; cutover marker shows on chart |

**Email reply to Erica drafted at `docs/history/correspondence/ERICA_FEEDBACK_REPLY_SESSION_113_ROUND2.md` — NOT YET SENT.** Bill is going to send when ready. Covers the four items + thoughts on the Work Site Monitor direction.

### Open / awaiting Erica's input

| # | Item | Waiting for |
|---|------|-------------|
| 1 | **Affinity Work Site Monitor data stream** — new accrual stream alongside Pulse/PPSI/Compliance/Events. Platform's ppii_stream config supports this; the streams editor renders new streams dynamically. | Erica to send the actual Ohio form so we know what fields to capture |
| 2 | **Caduceus meeting attendance via Spectrum GPS** | Related to #1; same flow once form is in hand |
| 3 | **"Notes filter shows nothing" — which participant?** | Asked in Session 113 round-2 email; she didn't repro-name in her reply. Still unresolved. |
| 4 | Erica to retest Session 112 + Session 113 round 2 fixes on Heroku v71 | She tested before our deploy last time; this round she's expected to retest after. |

### Open / not yet built — broader Erica roadmap

| # | Item | Notes / status |
|---|------|----------------|
| 1 | **Mobile notification delivery** | Rules engine done (12 rules seeded), `sendDelivery()` is a stub. Needs vendor decisions (SendGrid? Twilio? APNs?). HIPAA-safe templates required. |
| 2 | **Role-based access controls (RBAC)** | Bouncer placeholder on 8 pages always says yes. Server-side enforcement not built. Waiting on SSO decision from Erica/Damian. |
| 3 | **Randomized toxicology selection + notification** | Differentiator vs Ohio. Platform-side: randomization algorithm, per-physician frequency from cadence, audit trail, escalation on no-ack. External: SMS/push, HL7/LIMS, lab result delivery, chain-of-custody. |
| 4 | **Secure document management** | Designed in Session 105/106 but not built. RBAC is prerequisite. member_document table, categorization, version control, HIPAA-compliant storage (S3 prod / DB dev). |
| 5 | **Consent framework / data access request workflow** | Not designed. Required for research consent flag, conditional flow for anchor battery, information boundary policy. Source: PI2_Participant_Rights_Transparency_and_Consent_Framework.pdf |
| 6 | **Participant status tracking** | PARKED per Erica. Wants state program input first. Too many variations without state feedback. |
| 7 | **Dashboard reorganize (physician portal layout)** | Licensing board system BUILT (Session 102). Dashboard grouping view (by clinic / staff caseload / licensing board) NOT yet built. |
| 8 | **Two remaining unbuilt trigger signals** | #4 Repeated Moderate (Yellow/Orange 3 weeks — now covered by T6 added Session 112) — DONE. #13 Missed Survey (MEDS cron) — DONE (MEDS detection). Both retired. |

### Outstanding design questions for Erica (from Insight Build Notes Section 18)

- #8 Trigger stacking: one level or two
- #9 Trigger expiration: persist or auto-reverse
- #10 Clinician override expiration
- #11 Tier thresholds: single event override?
- #15 Role-based access details
- #21 Seven-stream weights with Provider Pulse
- #35 Tier duration for trigger escalations
- #44 Auto-return to Green when items resolve

---

## Recent session-by-session summary (newest first)

### Session 113 (May 12, 2026) — round 2 + Member Demo Site

All four design picks from her round-2 reply built and deployed (see top of file). Member Demo Site routing bug discovered and fixed locally (3 files, not pushed yet). Build notes v45.

### Session 112 (May 5, 2026) — Erica's post-rollout feedback batch

Six bug fixes: MEDS member status (Grace Newfield), Recovery participants trend graph (db_migrate v64 seeded 40 surveys × 10 personas), follow-up sort order, Edit/Enroll Participant scroll + Back nav, Pulse return-to-chart (3 entry paths), T6 protocol card library entry. Three regression tests (C18, C19, C20). Custauth cold-start race fix (real prod bug discovered via CI). GitHub Actions CI green. Build notes v44.

### Session 111 (April 26, 2026) — PPSI subdomain editor

Erica's Option A math shipped. New ppsi_subdomain + ppsi_subdomain_weight_set + ppsi_subdomain_weight_set_value tables (db_migrate v59-61). Per-section normalize → weight → sum × 100. Restore Defaults button. SERVER_VERSION 2026.04.26.1500. Build notes v43.

### Session 110 (April 20-25, 2026) — PPII history audit + Recalculate Member Scores

Slice B: ppii_score_history snapshots wired (recordPpiiSnapshot helper, custauth POST_ACCRUAL). Slice C: Previous PPII sub-line on chart + GET /v1/member/:id/ppii-history endpoint. Slice D: Recalculate-for-everyone button + Recent Changes panel on admin weights page. PPII streams config-driven refactor (db_migrate v58). Build notes v38-v42.

### Session 105 (April 11-18, 2026) — Erica April 11 feedback batch

12 items shipped: demo clinic (Insight Recovery & Wellness Center, 11 participants + 2 staff), removed Mobile tab from staff view, click-through registry items, follow-ups + drug tests merged into open-items panel, registry auto-follow-up chain display, manual follow-up creation, soft-delete plumbing (db_migrate v47), random drug testing, undetermined appointments, chart export, compliance config updates. Plus April 15 fix-up: Mark in Error UI, Schedule Mode selector, Export Chart button, View Participant button on follow-up modals, PPSI/Pulse timestamp bug. Bonus Result Engine on Delta also shipped. Build notes v34-v35.

### Pre-Session 105 archive

(Full historical detail in build notes — preserved for reference, not duplicated here.)

Session 95-104:
- Physician Affiliations, Mobile Notification Rules Engine, Dominant Driver Analysis, Stabilization Protocol Cards (29-card library), Outcome Tracking & Follow-up, MEDS, Pattern-Based Triggers, Score Feedback / Physician Annotations, Compliance Cadence Overrides, Clinician-to-Member Relationships, Convergent Validation Battery, ML Predictive Modeling v0.2.0 retrain, Extended Card Detection Engine, PPSI Safety Alerts, F1/T5 Batch Detection, Notification Delivery System framework, Mini PPSI bug fixes, Terminology Changes (Participant / Health Support Staff), Mobile app Trends tab, Add/remove assigned staff, Outreach notes, FULL_PPSI_REQUESTED flag, Notes & Outreach section, Activity timeline filter buttons, Licensing board system, Risk explanation contextual text.
