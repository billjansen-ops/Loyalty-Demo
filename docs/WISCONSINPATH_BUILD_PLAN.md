# WisconsinPATH — Master Build Plan & Gap Analysis

**The single master roadmap for the Wisconsin PHP program build (and the reusable
state-PHP program template behind it).** This supersedes the roadmap section of
`PERFORMANCE_PROFILE_OER_PLAN.md` — that file now points here.

**Sources.**
- Jim's anticipated workflow for the Wisconsin program (to be branded **WisconsinPATH**).
- Erica's translation of it into build requirements: `PI2_WisconsinPATH_Build_Requirements.docx`
  (Bill's Downloads / wi_php working folder — **not committed**, it's a working doc).
- A code-grounded capability scan of this platform (Session 125) — so the
  "what already exists" column reflects the actual code, not the spec's optimism.

**Why this is bigger than one client.** Erica expects this to carry straight over to
the **Washington** program. Built right, WisconsinPATH is not a Wisconsin feature — it's
a **reusable PHP-program template**: each new state program is a new instance of the same
engine. Design every net-new piece tenant-configurable, not Wisconsin-hardcoded.

Status key: **Built** (exists, no change) · **Configure** (engine exists, needs wiring) ·
**New build** (net-new) · ⚠️ = Erica's spec classified this lighter than the code supports.

---

## The honest corrections (read first)

The capability scan caught three items the spec treats as "already there" that **do not
exist in the code today**. They're load-bearing, so flag them in any estimate:

1. ⚠️ **Consent / Release-of-Information architecture** (Erica: "Configure"). There is **no
   consent/ROI/e-signature/versioning anything** in the platform. This appears in Stage 2
   (Layer 2, Level 3/4 ROI) *and* Stage 5 (monitoring agreement) — it's foundational, and
   it's the same 42 CFR Part 2 / dual-track privacy work gated on Erica's Q6 (legal). This
   is a **real net-new build**, not a config toggle.
2. ⚠️ **Toxicology / lab orders** (Erica: "Configure" in the Stage 2 plan). No lab/tox
   integration exists (no tox order, no urine-drug-screen, no lab result). **Net-new.**
3. ⚠️ **OER activation** (Erica: "already exists," Stage 5). The OER is **roadmap only —
   no tables, endpoints, or scoring**. So both OER activation *and* workplace-monitor
   assignment are net-new.

Everything else Erica classified holds up against the code (see per-stage tables).

---

## Stage-by-stage gap analysis

### Stage 1 — Registration
*How a participant enters — self/employer/board-mandated — reviewed and routed before clinical work.*

> **✅ STAGE 1 BUILT AND DEPLOYED (Sessions 126–129, live 2026-07-02).** Referral-source
> classification + dashboard segmentation, staff positions (Users & Roles), and the
> registration review queue — case-manager-first routing with Medical Director escalation
> (Erica's answer, as settings), triage notes, three dispositions, 48-hour SLA clock with
> auto-escalation. Remaining from the table below: only the optional intake wizard.
> One deferred adjacent piece: the referral-code CONSUMER (QR → pre-filled Performance
> Profile) — the natural next small build.

| Requirement | Erica | Code reality | Net-new work |
|---|---|---|---|
| General screening | Built | **Exists** — survey engine + auto-scoring | — |
| PHP registers a participant | Built | **Exists** — `POST /v1/member` (minimal; no program-entry wizard) | optional intake wizard |
| Referral-source classification (self/employer/mandated) → dashboard segmentation | New build | Genuinely new — no such field | Required classification field; drives safe-haven status + board-reporting eligibility |
| Review queue → role routing (Med Director / Case Manager) | New build | **Reuse-heavy** — notification + role-routing engine exists (registry/notification) | The review-queue *surface* + role assignment |
| Triage notes + SLA escalation | New build | **Reuse-heavy** — SLA timer + escalation exist (`stability_registry.sla_hours/deadline`, MEDS) | Triage-note field to chart/audit; wire SLA timer |
| Disposition + reassignment (advance / route to resources) | New build | **Reuse-heavy** — registry assign/reassign/status exist | Disposition action + the two routes |

### Stage 2 — Screening for program eligibility
*Structured clinical screening with the consents and instruments behind it.*

| Requirement | Erica | Code reality | Net-new work |
|---|---|---|---|
| Layer 2 ROI signed | Configure | ⚠️ **Not found** — no consent architecture | **Net-new** consent/e-sign/versioning (foundational) |
| Instrument library (PHQ-9, GAD-7, MCMI-IV…) | New build | **Partial** — 8 instruments scored in code (PPSI, Pulse, Stanford PFI, CGIS, Mini-Z, UCLA-3, CFQ, PROMIS-8A), but no PHQ-9/GAD-7 and no selection UI/catalog | New instruments + library/catalog UI + licensing layer for proprietary tools |
| Biopsychosocial + MSE template | New build | Genuinely new | New chart template |
| Risk assessment → SENTINEL event | Configure | **Exists** — protocol cards incl. SENTINEL; risk tiering | wire risk section → card |
| Plan with toxicology orders + recommendations | Configure | ⚠️ **Not found** — no lab/tox integration | **Net-new** lab/tox order layer |
| ROI Level 3 / 4 | Configure | ⚠️ **Not found** — consent architecture | **Net-new** (same as above) |
| Disposition → Stability Registry / team review | Configure | **Exists** — registry create/assign | wire disposition |

### Stage 3 — Vetted evaluator directory
| Requirement | Erica | Code reality | Net-new work |
|---|---|---|---|
| Evaluator directory, participant-facing, up-front cost disclosure, out-of-state | New build | **Partial** — clinician/board/partner *lookups* exist; no evaluator catalog | New directory on the lookup pattern + cost disclosure + out-of-state (no in-state WI evaluator per source) |

### Stage 4 — Vetted treatment-facility directory
| Requirement | Erica | Code reality | Net-new work |
|---|---|---|---|
| Treatment-facility directory + participant selection | New build | No facility directory | New directory |
| On selection: notify program, send ROI, send Provider Pulse + registration to treatment team | New build | **Provider Pulse exists**; notification engine exists | Selection→notify, ROI generation (needs consent layer), packet transmission |

### Stage 5 — Entering the monitoring program
| Requirement | Erica | Code reality | Net-new work |
|---|---|---|---|
| Participant marked active | Configure | **Exists** — member status/tier | set status |
| Consent + monitoring agreement | Configure | ⚠️ **Not found** — consent architecture | **Net-new** (same foundational consent build) |
| Compliance-monitoring protocol selected + activated | Configure | **Exists** — compliance + MEDS engine, cadence/thresholds | select protocol per contract |
| OER activated; workplace monitor selected | New build | ⚠️ **OER is roadmap only — no code** | **Net-new** OER instrument *and* observer/monitor actor |
| Group attendance + peer-support logs | New build | Genuinely new | New attendance-verification log |

### Stage 6 — Workplace liaison & restriction flags
| Requirement | Erica | Code reality | Net-new work |
|---|---|---|---|
| Chart flag for work-/board-restriction | New build | **Partial** — only protocol-card guidance ("assess need for restriction"); no flag/enforcement | New chart flag, visible to team, drives notifications |

### Stage 7 — Treatment completion & close-out
| Requirement | Erica | Code reality | Net-new work |
|---|---|---|---|
| Completion + program close-out (successful completion) | New build | Genuinely new | Completion record + close-out determination |

### Stage 8 — Non-compliance & board reporting *(legally gated)*
| Requirement | Erica | Code reality | Net-new work |
|---|---|---|---|
| Non-compliance flags + board-reporting module + safe-haven conversion | New build | **Partial** — `licensing_board` directory exists; no reporting engine, no safe-haven logic | New reporting module + safe-haven conversion (a referral accepted in lieu of reporting converts to a report on non-completion) |

---

## The existing "Erica list," folded in

This master is the **union** of Jim's workflow and everything we were already tracking for
Erica, so nothing falls out:

- **Erica's 8 OER questions** (from `PERFORMANCE_PROFILE_OER_PLAN.md`) map onto the
  monitoring stages: observer onboarding/auth → Stage 5; recurring cadence + reminders +
  overdue → MEDS (exists); auto-escalation (Stability Alert / 7F indicators / Sec 9) →
  signal→registry (exists); one-business-day reportable event → Stage 8 fast path;
  cross-form integrated PHP view → participant chart (exists); confidentiality / 42 CFR
  Part 2 → the consent build (Q6, gated); observer transitions + COI flagging → Stage 5/8.
- **Performance Profile demo** — done + live (`/performance-profile`, Heroku v97).
- **Resource-library matching** (score → content) — still Erica's content to compile;
  builds on the protocol-card / dominant-driver pattern (exists).
- **Dual-track privacy (wellness-grade vs clinical-grade / 42 CFR Part 2)** — the same
  consent foundation flagged above; **Erica's Q6**, needs Chris + legal.
- **Washington crossover** — design net-new pieces as a reusable, tenant-configurable
  template, not Wisconsin-hardcoded.

---

## What's gated on legal / Erica (not ours to unblock)

- **Consent / 42 CFR Part 2 / dual-track privacy model** — Erica's Q6; she's drafting a
  preliminary version, needs Chris + legal. **Gates** the consent architecture, which in
  turn gates Stages 2, 4, 5.
- **Board-reporting + safe-haven rules** (Stage 8) — Erica's own note: defined with the
  program and reviewed by counsel before they go live.
- **Resource-library content** — Erica compiling.
- **Proprietary-instrument licensing** (e.g., MCMI-IV) — attribution/licensing layer.

---

## Suggested build sequence (for discussion, not committed)

1. **Reuse-heavy, unblocked, high-visibility:** referral classification + dashboard
   segmentation; review queue + triage + disposition (Stage 1) — all ride existing
   registry/notification/SLA engines.
2. **The consent foundation** — once Q6 lands. It's the single biggest unlock (Stages 2,
   4, 5 all wait on it) and the riskiest (legal). Don't start net-new consent UI before
   the privacy model is settled.
3. **Instrument library + biopsychosocial/MSE template** (Stage 2) — extends the scoring
   engine; mostly unblocked except proprietary licensing.
4. **Directories** (Stages 3–4) — build on the lookup pattern.
5. **Monitoring assembly** (Stage 5) — compliance protocol is config; OER + observer actor
   + attendance logs are the net-new.
6. **Restriction flags, close-out, board reporting** (Stages 6–8) — Stage 8 last, behind
   counsel.

---

---

## Performance Profile demo — shipped (the front door)

The self-service **Performance Profile** (PPSI stability + Foundations dominant-driver) is
**built and live** — public no-login route `/performance-profile` (+ `/performance-profile/qr`
and the `/overview` walkthrough), scored on the device, demo-contained (nothing persisted,
no PHI). It's the accessible entry point to the whole lifecycle above. Scoring is final
(Erica + Tom confirmed 2026-06-27/28): PPSI uses the live weighted scoring (real wi_php
subdomain weights → 0–100, banded by `ppii_thresholds`); Foundations tiers as written.
Built as the Dr. Stadler 2026-07-01 demo; the `/overview` page is the companion walkthrough.

## QR / referral-code mechanism (built; consumer pending)

A QR must stay simple: its content is just **base URL + one opaque code** (e.g.
`demo.primada.io/p/7QF9K2X8`), never a pile of `?org=&ref=` params. The code is a key into
the general-purpose **`code` table** (Session 124, db_migrate v84, live Heroku v97):
affiliation, usage limits (`max_uses`/`used_count`), validity window, status, + JSONB context
— resolved server-side at `/p/:code`. Table-backed beats URL params: dense-free QR, nothing
tamperable, **never reprint** (change the row, the printed QR still works), one mechanism for
QR + email links + partner referrals. Engine done; its Insight-facing consumer (the "refer
participant / add observer" buttons that mint a code) is still to build — it's the producer
side of Stage 1 registration + Stage 5 observer assignment.

## Erica's 8 OER questions (source requirements, mapped to stages above)

The eight functional requirements behind the OER / monitoring stages:

1. **Observer onboarding / authentication** — a named workplace observer gets credentialed
   in (email-link verification / PHP manual verification / MFA), secure but easy. → Stage 5.
2. **Recurring cadence + reminder logic** — per-participant monitoring intensity generates
   each observer's report cycle, reminders before due, overdue flags. → MEDS (exists).
3. **Automatic escalation triggers** — certain answers fire to the PHP on submit (the
   "immediate stabilization" alert, any 7F Observable Indicator of Possible Impairment,
   Sec 9 practice-restriction noncompliance). → signal→registry (exists).
4. **One-business-day reportable-event pathway** — separate immediate submission for events
   that can't wait (positive tox, treatment-compliance issues, against-advice discharge,
   failure to stop practicing). → Stage 8 fast path.
5. **Cross-form integration** — OER + Fitness-for-Duty + Provider Report as one integrated
   PHP view, not three siloed streams. → participant chart (exists).
6. **Confidentiality / statutory protection** — clinical-grade handling under 42 CFR Part 2
   + state PHP statutes + HIPAA, distinct from optimization-track data. → consent build (Q6).
7. **Observer transitions** — observers change; clean reassignment preserving the
   longitudinal record, PHP authorizing each transition. → Stage 5/8.
8. **Conflict-of-interest flagging** — Section 2 COI declaration; an outside relationship
   flags that report to the PHP for review. → Stage 8.

## Open decisions (the whole effort)

| # | Decision | Status |
|---|---|---|
| 1 | PPSI scoring — live weighted, not flat tiers | ✅ Resolved (Erica 2026-06-27) |
| 2 | 42 CFR Part 2 consent / release model | ⛔ Erica drafting prelim; needs Chris + legal (Q6) |
| 3 | RBAC (real role enforcement, not the always-yes placeholder) — prerequisite for real self-registration. **NOT the RLS DB-lock** (tried + removed Session 123) | ☐ Open |
| 4 | Observer identity & "sees only own reports" rule | ☐ Open (new finer-than-tenant access model) |

## Related
- `project_erica_tracking` memory — Erica relationship / waiting-on items (historical).
- `PI2_WisconsinPATH_Build_Requirements.docx` + `PI2_Occupational_Environment_Report.docx`
  + `PI2_Performance_Profile.docx` — Erica's source specs (Bill's working docs, uncommitted).
- `docs/RLS_BACKSTOP_DESIGN.md` — the (removed) database lock; do not resume without Bill asking.
- Capability evidence (Session 125 scan): registry → `verticals/workforce_monitoring/server/registry.js`;
  MEDS/compliance → `meds.js` / `compliance.js`; protocol cards → `tenants/wi_php/protocolCards.js`;
  risk tiering → `server/wellness.js`; instruments → `tenants/wi_php/score*.js`.
