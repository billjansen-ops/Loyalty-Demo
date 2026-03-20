# Insight Platform — Release Notes

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
