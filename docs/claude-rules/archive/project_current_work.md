---
name: Current work status
description: Active work status for the Loyalty Platform - what's done, in progress, and next
type: project
originSessionId: f1f2d28c-f6b5-4115-98b5-a927a5f91ae2
---
## Archived Snapshot

This file is retained as a historical Claude-memory snapshot.

Do not treat it as current truth.
Use `STATE.md` and `ACTIVE_WORK.md` instead.

## Current Status (May 12, 2026 — Session 113 in handoff)

### What's live on Heroku (v71 / DB v65)

**Session 112 (Erica round 1):** MEDS member status fix, Recovery participant PPSI history seed (db_migrate v64), follow-up sort order, Edit/Enroll Participant scroll + Back nav, Pulse return-to-chart (3 entry paths), T6 protocol card library entry + library completeness test, custauth cold-start race fix. C17/C18/C19/C20 tests. Build notes v44.

**Session 113 round 2 (Erica feedback):** All four design items from her last reply are deployed:
- Sliders removed from both admin weights pages (typeable number input + read-only bar)
- Profile changes surfacing on the **profile page** (`csr_member.html`), not the activity timeline — new GET `/v1/member/:id/profile-log` endpoint + "Edit Profile" button on participant chart + "Profile Update Log" section on the profile page
- Recalculate Member Scores drill-down — endpoint returns `members[]` sorted by |Δ|; "View details →" modal table on the admin page
- Previous PPSI sub-line under Last PPSI card on the participant chart + dashed purple "weights changed" cutover marker on the trend canvas
- "Notes" filter renamed to "💬 With Notes" with clarifying tooltip
- PPSI_Q3 user-facing labels renamed to "PPSI Severe Item Response" via db_migrate v65 (internal signal code 'PPSI_Q3' unchanged)

Tests: C21 rewritten (35), C22 new (12). **Full suite 41 tests / 863 assertions all passing.** CI green on commit `9b83d9a`. SERVER_VERSION 2026.05.12.1000, EXPECTED_DB_VERSION 65.

### What's LOCAL only — not committed, not pushed, not deployed

Member Demo Site routing fix (discovered late-Session-113):
- New file: `verticals/workforce_monitoring/tenants/wi_php/index.html` — Wisconsin Tier 1 override, meta-refresh + JS redirect to `verticals/workforce_monitoring/dashboard.html` (same destination Erica's login reaches)
- New file: `index.html` (project root) — generic "🚧 Under Construction" page with Back-to-Menu link for tenants without their own
- One-line edit to `pointers.js` line 7231: `app.use(express.static(__dirname, { index: false }));` — prevents express.static from auto-serving the root `index.html` for `/` directory requests, which would have hijacked the existing `app.get('/')` → `/login.html` redirect

Verified locally via curl: Wisconsin session → redirect to dashboard; Delta (or any non-wi_php) session → Under Construction; `/` → login redirect. No tests yet for this flow. Three files staged in working tree but not committed.

### What's queued / drafted

- **Email reply to Erica** drafted at `docs/history/correspondence/ERICA_FEEDBACK_REPLY_SESSION_113_ROUND2.md` — NOT YET SENT. Covers the four design items + thoughts on the Work Site Monitor / Caduceus GPS data-stream direction Erica raised. Bill is going to send when ready.
- **Member Demo Site fix** ready to commit/push/deploy on Bill's call.

### Session 113 handoff

`docs/SESSION_113_HANDOFF.md` carries the full chain trace for the Member Demo Site routing design + lessons from the session's failure pattern.

---

**STANDING ITEMS:**
- Bill's password on local is ferrari308. NEVER TOUCH IT.
- Claude system user on local + Heroku (password: claude123).
- Negative adjustments create activity but don't FIFO-debit buckets (documented in test, TODO in code).
- loyaltytest database is pre-migration era — too old for db_migrate.

**NEXT SESSION PRIORITIES (broader, beyond pending deploy):**
1. Secure document management (designed, not built)
2. Real RBAC (Bouncer is still a placeholder)
3. Work Site Monitor data stream when Erica sends the Ohio form
4. Other core platform gaps: redemption catalog, referral tracking, fraud/velocity, GDPR tooling

**ERICA'S REMAINING ITEMS (not for immediate build):**
- Mobile notification delivery — sendDelivery() stub; vendor decision needed
- RBAC enforcement — SSO decision needed
- Secure document management — designed in S105
- Consent framework — not designed
- Participant status tracking — parked per Erica
