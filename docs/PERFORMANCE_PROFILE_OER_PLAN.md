# Performance Profile + OER — Build Plan & Tracker

**Purpose.** The single living tracker for the next major Insight build: Erica's
two new instruments (the **Performance Profile** self-service assessment and the
**Occupational Environment Report / OER**) and the platform capabilities behind
them. Source: Erica's June 2026 email + `PI2_Performance_Profile.docx` /
`PI2_Occupational_Environment_Report.docx` (Bill's working docs, not committed),
plus Tom's scoping note for the Dr. Stadler meeting.

**How this file stays current.** Update the status markers at the end of every
work session. `ACTIVE_WORK.md` and `STATE.md` point here so the next session
lands on it. Erica's relationship items (what she owes us / we owe her) live in
the `project_erica_tracking` memory.

Status key: ☐ not started · ◐ in progress · ✅ done · ⛔ blocked on a decision.

---

## NEAR-TERM MILESTONE — Dr. Stadler demo, Wednesday **2026-07-01** (~3 working days)

**Goal (per Tom):** a QR code that opens the Performance Profile, someone takes
it, and sees a scored result. Tom parked the OER and named a fallback — an
overview walkthrough of Erica's documents. Workforce monitoring + optimization
are the sellers for Dr. Stadler.

**Scope decision: build the working QR demo — full Performance Profile (PPSI +
Foundations) — scoped tight, demo-contained, with the overview as a guaranteed
fallback.** The Foundations half produces the "top lifestyle driver" result,
which is the *optimization* story Tom is selling.

**Explicitly OUT for Wednesday:** account creation, participant portal, PHP
linkage, observer logins, OER, dual-track privacy plumbing. None needed to make
the point — and all of it sits on foundation work (RBAC + RLS) not yet built.

**Build order (each step leaves something demoable):**
1. ✅ Public no-login entry point — turned out **simpler than planned**: static
   `.html` already passes the auth gate ([pointers.js:1842](../pointers.js)) and
   `express.static(__dirname)` serves any file by real path, so the page is
   reachable at its full URL with **no `pointers.js`/auth/DB change**.
   **Demo-contained:** in-page scoring, nothing persisted, no wi_php data.
   Page: `verticals/workforce_monitoring/performance_profile.html`.
2. ✅ **PPSI path end-to-end** — 34 items, 8 sections, flat raw-sum tiers per the
   doc. Scored in-page (the live `scorePPSI.js` is the weighted variant needing
   DB/member context — deferred to the real build).
3. ✅ **Foundations of Health** — 16 items, 3 pillars, per-pillar normalize →
   highest = dominant lifestyle driver.
4. ✅ **Result screen** — PPSI tier + section bars; Foundations tier + dominant
   driver callout + pillar bars; matched-resource teasers. Verified in the
   mobile preview: scoring internally consistent, no console errors, lint 0.
5. ✅ **QR code** — companion page `performance_profile_qr.html` renders a real
   QR (vendored `qrcode.min.js`, MIT, offline — no external call at scan time).
   **URL not hardcoded:** derived from `window.location.origin` (override via
   `?base=`), so dev/erica/prod each self-describe. Decision: a per-ENVIRONMENT
   value belongs to the environment, **not sysparm** (sysparm is per-tenant,
   seeded identically across environments). Verified in preview.
6. ☐ **Overview walkthrough** assembled from Erica's docs — guaranteed fallback.
7. ✅ **Discoverable entry point + clean URLs** (the key fix — see below). Erica's
   established pattern is "log into the site and the feature is there to test." The
   first build was an orphan page nothing linked to, which broke that. Fixed:
   - Clean public routes `GET /performance-profile` and `/performance-profile/qr`
     (in `pointers.js`, added to `PUBLIC_ROUTES`; QR page now references
     `qrcode.min.js` by absolute path so it works at the clean nested URL).
   - A data-driven **"New — Try It"** section on the Insight dashboard
     (`dashboard.html`) — each item shows name, description, the clean URL, and
     **Open** + **Copy link**. The URL is built from `window.location.origin`, so
     on demo.primada.io it reads `demo.primada.io/performance-profile`. Future
     features (OER, etc.) just add one row to the `TRY_IT_ITEMS` array.
   So Erica tests the normal way: log into demo.primada.io → dashboard → New — Try
   It → Performance Profile. `SERVER_VERSION` 2026.06.27.2010; no DB change.

**Built beyond the minimal floor:** a short intro step (referral type, the
stability/performance dual-track chips, and the licensure gate with conditional
fields) so the demo shows the "single front door for multiple populations" story.

**Pattern going forward:** every new in-progress feature gets a row in the
dashboard "New — Try It" list (one entry in `TRY_IT_ITEMS`), so staff always find
new things to test in one place — no stray URLs, no lost context.

**DESIGN DECISION — QR / referral codes (build later, not in the demo).** A QR
must stay simple: its content is just the **base URL + one big opaque code**
(e.g. `demo.primada.io/p/7QF9K2X8`) — NOT a pile of `?org=…&ref=…` parameters.
The code is a key into a **code→context table** (to build when it's time, likely
backed by `link_tank` for the unique value) that resolves server-side:
- **affiliation** — which org/PHP this code belongs to (answers "who do we
  affiliate this to?"); the code carries it, the table holds it
- **usage limits** — single-use vs reusable (`max_uses` / `used_count`)
- **validity window** — `valid_from` / `valid_until` (time-boxed codes)
- **status** — active / revoked
Why table-backed beats URL params: cleaner/denser-free QR (scans reliably),
nothing exposed or tamperable, **never reprint** (change the row, the printed QR
stays valid), and one reusable mechanism for QR + email links + partner referrals.
Fits the platform grain ("everything is pointers"; config in tables, not URLs).
Handles the PHP-referral case: a one-time, expiring code tied to a person.

**Open decisions for the demo (flag, don't guess):**
- ✅ **PPSI scoring — RESOLVED (Erica, 2026-06-27): use the live weighted
  scoring.** "Score and run like we have it already built." The demo now uses
  Option A weighted scoring — the real wi_php subdomain weights (snapshot of the
  current set: GLOBAL 0.50, SLEEP 0.105, BURNOUT 0.095, WORK/ISOLATION/COGNITIVE
  0.10, RECOVERY & PURPOSE 0.00) → 0-100 score, banded by the live
  `ppii_thresholds` (yellow 35 / orange 55 / red 75). NOT the doc's flat tiers.
- ⛔ **Persist or ephemeral:** recommend ephemeral / demo-tenant for Wednesday so
  the public entry never writes into real PHP data.

---

## OPEN DECISIONS (the whole effort, not just the demo)

| # | Decision | Why it matters |
|---|---|---|
| 1 | ✅ RESOLVED — PPSI uses the live weighted scoring (Erica, 2026-06-27), not flat tiers | Demo updated |
| 2 | 42 CFR Part 2 consent / release model | Legal standard, not a checkbox; may need counsel |
| 3 | RBAC + RLS sequencing relative to the public launch | Prerequisite for real self-registration |
| 4 | Observer identity & "sees only own reports" rule | New, finer-grained-than-tenant access model |

---

## FULL ROADMAP (the real build, behind the demo)

### Phase 0 — Foundation (prerequisite for anything public-facing)
- ☐ Role-based access control (RBAC) — enforcement, not the current always-yes placeholder
- ☐ Database-level tenant lock (RLS) — see `docs/RLS_BACKSTOP_DESIGN.md`

### Phase 1 — Instruments (cheap, reuse-heavy)
- ◐ PPSI (exists; reconcile scoring) · ☐ Foundations of Health survey + scoring · ☐ OER rating form + scoring

### Phase 2 — Portals & actors (the new surfaces)
- ☐ Public self-registration → account creation
- ☐ Participant portal (resources matched to results; persistent home)
- ☐ Observer actor: login type, scoped to assigned participant, sees only own reports

### Phase 3 — Linkage & privacy (the hard integration)
- ☐ Bidirectional PHP linkage (participant opt-in + PHP referral-in, data flows into monitoring)
- ☐ Dual-track privacy: wellness-grade vs clinical-grade (42 CFR Part 2) from registration onward
- ☐ Resource library (score → content mapping; built on the protocol-card / dominant-driver pattern)
- ☐ OER mechanics: recurring cadence + reminders + overdue flags; auto-escalation (Stability Alert,
  7F indicators, Section 9) via signal→registry; one-business-day reportable-event pathway;
  multi-observer; observer transitions; COI flagging; integrated cross-form participant view

### Erica's parallel side-work (she's building; not our ask yet)
- Resource library content · more dominant-driver / protocol-card lifestyle content ·
  medication tracker with urine-drug-screen cross-reference (overlaps roadmap "randomized tox")

---

## REUSE MAP — most of this already exists

| Capability | Reuse |
|---|---|
| PPSI scoring + tiers | `scorePPSI.js`, survey engine |
| Foundations → dominant driver | `dominantDriver.js` / PPII-stream pattern (new instrument, proven shape) |
| Score → resource matching | protocol-card library + dominant-driver→card mapping |
| OER cadence / reminders / overdue | `followup_schedule`, MEDS cadence, notification engine |
| OER auto-escalation | signal → bonus → external action → `stability_registry` |
| Reportable event (immediate) | event reporting + immediate notification |
| Multiple observers per participant | multi-clinician assignment pattern (new visibility rule) |
| Integrated participant view | participant chart already merges multiple streams |

**Genuinely new (the real work):** public self-registration + participant portal;
the observer actor; dual-track / 42 CFR Part 2 privacy; cross-PHP linkage.

---

## Related
- `docs/RLS_BACKSTOP_DESIGN.md` — the database lock (Phase 0)
- `project_erica_tracking` memory — Erica relationship / waiting-on items
- Source forms: `PI2_Performance_Profile.docx`, `PI2_Occupational_Environment_Report.docx` (Bill's Downloads)
