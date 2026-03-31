# Insight Platform — Release Notes

## March 30, 2026

- **Protocol Card Reference Library** — all 29 stabilization protocol cards are now viewable in a dedicated reference library. Each card shows the full clinical protocol: what it is, what it is NOT, step-by-step actions with tier-adjusted timelines, responsible role, success metrics, and escalation triggers
  - Cards organized by category: PPSI Pathway (A), PPSI Sub-Domain (A1-A8), Provider Pulse Signal (P1-P5), Compliance (C), Event (D), Safety (S1), Multi-Stream (M1-M3), Destabilization Archetypes (T1-T5), Intervention Failure (F1), Enhanced Event (D2-D3)
  - Search across all cards by keyword
  - Clickable protocol card badges in the Stability Registry and Physician Detail — click any badge to view the full clinical protocol in a modal
  - *Where to find it: Dashboard → "Protocol Cards" navigation card; Stability Registry → click any protocol card badge; Physician Detail → click any protocol card badge*
- **Extended Card Detection Engine** — the system now automatically detects 9 complex destabilization patterns from accrual data and assigns the appropriate extended protocol card
  - **M1 (Multi-Domain PPSI)** — 3+ PPSI domains elevated simultaneously
  - **M2 (Cross-Stream Co-Dominant)** — two data streams within 5 percentage points of each other
  - **M3 (Self-Report/Clinician Discordance)** — Provider Pulse exceeds PPSI by more than 15% for 2+ months
  - **T1 (Slow Burn)** — gradual 15+ point rise over 6+ weeks
  - **T2 (Acute Break)** — 20+ point spike in 1-2 weeks. Auto-elevates to minimum Orange urgency
  - **T3 (Oscillator)** — rise and partial recovery cycling 3+ times in 12 weeks
  - **T4 (Silent Slide)** — low PPSI but rising Provider Pulse or declining compliance. Auto-elevates to Orange
  - **D2 (Compound Event Cascade)** — 2+ events in a 14-day window with super-additive severity
  - **D3 (State-Dependent Event)** — event occurring while physician is already in Yellow or Orange tier
  - Detection runs automatically on every accrual. Highest-priority pattern wins when multiple match
  - Extended card badges appear alongside primary protocol card badges in the Stability Registry and Physician Detail
  - *Where to find it: Stability Registry → extended card badges on registry items; Physician Detail → activity timeline and registry items*
- **PPSI Safety Alerts** — when a physician adds a note on their weekly PPSI check-in, all clinical staff are immediately notified. Connects to the S1 (Safety Sentinel) protocol card for safety-related disclosures
  - New "Anything else you want to share this week?" comment field on the last question of the mobile check-in
  - All notes trigger an alert — no keyword filtering, no false negatives on safety
  - Notification bell appears on clinic pages (Clinic Dashboard, Physician Detail, Stability Registry, Compliance) with urgent animation when critical alerts are waiting (yellow bell swing, pulsing red badge)
  - Clicking the notification navigates directly to the physician's detail page
  - "PPSI Notes for Review" section on Physician Detail shows pending notes with action buttons: "Reviewed — No Action" or "Create Registry Item"
  - Configurable per survey via `note_alert` flag — currently enabled for PPSI only
  - *Where to find it: Mobile App → Weekly Check-in → comment field on last question; Clinic Dashboard → notification bell; Physician Detail → "PPSI Notes for Review" section*

## March 26, 2026

- **Predictive Risk Scoring (ML)** — machine learning engine that analyzes 16 data points per physician to produce a 0-100 risk score with clinical risk label (Minimal, Low, Moderate, High, Critical)
  - Gathers real-time data from PPSI surveys, Provider Pulse, compliance status, stability registry items, MEDS flags, and enrollment duration
  - Yellow "Predictive Risk" card on Physician Detail page shows current score, risk level, confidence phase, and contributing factors
  - Score stored as ML_RISK_SCORE molecule (5_data_22: score + date) — new row only written when score changes, building trajectory over time
  - Calibrated Random Forest model (Pre-Alpha v0.1) trained on synthetic clinical patterns: stable, gradual decline, spike-recover, sudden crash, and registry-driven destabilization
  - Card shows "Predictive Risk service unavailable" when ML service is down — never silently disappears
  - ML service auto-starts with Pointers server via wi_php custauth STARTUP hook
  - *Where to find it: Physician Detail → "PREDICTIVE RISK" card (yellow)*
- **Clinician exclusion from physician lists** — clinicians (David Chen, Sarah Mitchell) no longer appear in physician roster, member search, or any physician-facing list. Applied via custauth FILTER_MEMBER_LIST hook — tenant-specific, other tenants unaffected
- **ML Feature Report** — diagnostic report showing all 16 input features and predicted score for every physician. Used for model tuning and clinical review
  - *Where to find it: node ml_report.js (command line tool)*
- **Database migration v27** — ML_RISK_SCORE molecule migrated from 5_data_2 (score only) to 5_data_22 (score + date composite)

## March 25, 2026

- **Missing Event Detection (MEDS)** — automated gap detection across all cadenced surveys and compliance items. The system identifies when a physician has missed a scheduled assessment or compliance event and escalates through notifications
  - Daily scheduled scan with configurable frequency and start time
  - Real-time check on physician page load — data is always current when viewing a physician
  - Full MEDS status on Physician Detail page showing every cadenced item: current, due soon, overdue, or never completed — with last completion date and cadence
  - Consecutive miss escalation: 3+ missed events triggers critical notification to all clinical staff
  - MEDS flags visible on clinic roster (MISSED SURVEY, ESCALATE badges)
  - *Where to find it: Clinic Dashboard → roster flags; Physician Detail → "MEDS STATUS" section; Settings → Scheduled Jobs (admin)*
- **Scheduled Jobs System** — core platform infrastructure for recurring automated tasks
  - Admin page for viewing job status, run history, and triggering manual runs
  - Configurable interval (hourly to weekly) and preferred start time
  - Run history log with analyzed/processed/flagged counts per run
  - *Where to find it: Settings → Scheduled Jobs*
- **Convergent Validation Anchor Battery** — 6 established clinical instruments now available alongside the PPSI
  - PROMIS Sleep Disturbance 8a (8 items, T-score normed)
  - Stanford Professional Fulfillment Index (16 items, 3 subscales)
  - Mini-Z Burnout Assessment (7 items, 3 subscales)
  - UCLA Loneliness Scale (3 items)
  - Cognitive Failures Questionnaire (3 items)
  - Clinical Global Impression — Severity (1 item, clinician-rated)
  - Each instrument scores automatically using published methodology
  - *Where to find it: Physician Detail → "Validation Battery" card; Mobile App → "Assessments" tile; CGI-S prompts after Provider Pulse submission*

## March 24, 2026

- **Clinician-to-Physician Assignments** — clinicians can now be assigned to physicians, driving caseload management and notification routing across the platform
  - **Clinic Dashboard → Clinicians tab** — view all clinicians at a clinic, expand to see their assigned physicians, assign or remove physicians
  - **Clinic Dashboard → Roster filter** — filter the physician roster by clinician to see only their assigned physicians and all associated tier/compliance data
  - **Stability Registry → Clinician filter** — filter the priority worklist and follow-up queue to a specific clinician's caseload
  - **Physician Detail** — shows assigned clinician(s) below affiliations
  - **Dashboard → Clinician Caseloads** — new summary table showing each clinician's physician count and tier breakdown
  - **Physician Portal → Clinician Caseload** — new entry path lets clinicians select from their assigned physicians to enter the portal
  - **Notifications** — alerts now route to the physician's assigned clinician automatically
  - *Where to find it: Clinic Dashboard → "Clinicians" tab; clinician filter dropdown appears on Roster, Stability Registry, and Follow-ups*
- **CSV Export** — download data as CSV from the Stability Registry, Follow-ups, Roster, and Compliance pages
  - Column selection with preview before download
  - Roster and Registry exports now include "Assigned Clinician" column
  - *Where to find it: Stability Registry → "Export" button; Clinic Dashboard → "Export" button*
- **Notification Rules Engine** — 12 notification rules configured per clinical team specifications
  - Registry creation, urgency-specific alerts, sentinel events, missed surveys (24h + 48h escalation), follow-up reminders, pattern detections
  - Routes to appropriate recipients by role (admin, clinical authority, case manager, clinician)
  - *Where to find it: Notifications appear via bell icon; rules configured in Program Settings*
- **Configurable Member Terminology** — the platform label for monitored individuals (currently "Physician") is now configurable per program, allowing the same platform to serve first responders, nurses, or other populations without code changes
  - *Where to find it: Program Settings → Member Labels*

## March 22, 2026

- **Outcome Tracking & Follow-up System** — when a registry item is created, the system automatically schedules success checks based on urgency tier (Yellow/Orange: 2, 4, 8 weeks; Red: weekly then 4/8 weeks; Sentinel: 48 hours then weekly). Coordinators complete each check by assessing outcome (Improving, Stable, Declining, Escalated) with notes
  - Follow-up queue with overdue badge, filterable by status
  - *Where to find it: Stability Registry → "Follow-ups" tab*
- **Pattern-Based Triggers** — the system now detects emerging instability patterns before a threshold is crossed:
  - **PPII Trend Up** — PPII score rising for 3 consecutive measurement periods
  - **PPII Spike** — PPII score jumps 15+ points in a single period
  - **Protective Collapse** — Isolation, Recovery, and Purpose sub-domains all worsening simultaneously over consecutive surveys
  - Each pattern automatically creates a registry item with dominant driver analysis, protocol card, and scheduled follow-ups
  - All thresholds are configurable per tenant
  - *Where to find it: Pattern-triggered items appear in the Stability Registry alongside threshold-triggered items*
- **Physician Annotations** — physicians can now add contextual notes to their scores (travel, life events, schedule changes, anything relevant). Notes are entered from the Physician Portal and visible to the care team on the physician detail page
  - *Where to find it: Physician Portal → "Add a Note" card; care team view → Physician Detail → "Physician Notes" section*

## March 20, 2026

- **Dominant Driver Analysis** — when a physician's PPII composite crosses a threshold, the system now automatically identifies which data stream drove the escalation (PPSI Self-Report, Provider Pulse, Compliance, or Events) and, for PPSI, which of the 8 sub-domains contributed most
  - *Where to find it: Stability Registry → click any item → "Dominant Driver Analysis" section in the detail modal*
- **Stabilization Protocol Cards** — each registry item is automatically assigned one of 17 protocol cards based on the dominant driver routing (A1–A8 for PPSI sub-domains, P1–P5 for Provider Pulse signals, C for Compliance, D for Events, S1 for Suicide Risk)
  - Color-coded badge displayed on each registry item
  - *Where to find it: Stability Registry → Protocol Card badge on each row and in the detail modal*
- **Affiliations Management** — new page for managing physician affiliations (hospital systems, clinic groups, practice networks). Add, edit, and remove affiliations with full audit trail
  - *Where to find it: Dashboard → Program Management → "Affiliations"*
- **Notification System** — the platform's notification engine is now wired into Insight. In-app notifications with bell icon and unread count badge. Additional delivery channels (email, SMS, push) and specific notification triggers will be configured based on clinical team input
  - *Where to find it: Bell icon in the navigation header (mobile)*

## March 19, 2026

- **Registry History** — full audit trail of all registry actions (create, resolve, assign, reopen)
  - Three views: All Activity, By Clinic, By User
  - Shows who did what, when, and field-level changes
  - Reopen button on resolved items — undo a resolve directly from the history page
  - *Where to find it: Stability Registry → "History" button (top right)*
- **Compliance Cadence System** — compliance items now have a configurable cadence
  - Each rule defines a default cadence: Weekly, Monthly, Quarterly, Yearly, or Custom (specify days)
  - When a compliance item is assigned to a physician, the default cadence copies down automatically
  - Per-physician cadence override — click the pencil icon on any compliance card to change that physician's cadence independently
  - *Where to find it: Open any physician's compliance page → cadence badges show at the bottom of each card with a pencil icon to edit*
- **Compliance Rules** — new admin page for managing compliance item definitions
  - Add, edit, activate/deactivate compliance items
  - Set default cadence and weight per item
  - *Where to find it: Dashboard → Program Management → "Compliance Rules"*
- **Physician Management** — "Compliance" button now navigates directly to the physician's compliance detail page instead of opening a toggle modal
  - *Where to find it: Any clinic → Physician Management → click "Compliance" on a physician row*

## March 17, 2026

- Maintain / update compliance categories per physician
  - *Where to find it: Physician's compliance page → "Manage Compliance Items" button (top right)*
- Cancel (return) from physician page
- Search for physician — all physicians or by clinic
  - *Where to find it: Any clinic dashboard → search bar at the top of the roster*
- Renamed compliance button to "Manage Compliance Items"
