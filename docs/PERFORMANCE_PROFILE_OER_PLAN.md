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
   seeded identically across environments). Verified in preview. **Deploy to
   Heroku pending** so the QR resolves to a phone-scannable public URL.
6. ☐ **Overview walkthrough** assembled from Erica's docs — guaranteed fallback.

**Built beyond the minimal floor:** a short intro step (referral type, the
stability/performance dual-track chips, and the licensure gate with conditional
fields) so the demo shows the "single front door for multiple populations" story.

**Hosting decision for Wednesday (open):** for Dr. Stadler to scan on his own
phone, the QR must point at a public URL → **deploy the page to Heroku** (needs
Bill's go; CI green first; it's a static page, no DB/server change so deploy is
low-risk). Alternative: demo on Bill's/Tom's own device against localhost (no
deploy, but Dr. Stadler can't scan it himself).

**Open decisions for the demo (flag, don't guess):**
- ⛔ **PPSI scoring:** the PP doc shows flat section sums → 4 tiers; our live PPSI
  has subdomain *weighting* (Session 111). For the demo, use the doc's flat tiers
  to match what Erica wrote; reconcile properly later.
- ⛔ **Persist or ephemeral:** recommend ephemeral / demo-tenant for Wednesday so
  the public entry never writes into real PHP data.

---

## OPEN DECISIONS (the whole effort, not just the demo)

| # | Decision | Why it matters |
|---|---|---|
| 1 | PPSI: reuse existing weighted scoring vs. the PP doc's flat section tiers | Reuse vs. fork the instrument |
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
