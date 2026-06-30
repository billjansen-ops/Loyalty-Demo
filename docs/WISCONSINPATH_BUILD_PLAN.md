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

## Related
- `PERFORMANCE_PROFILE_OER_PLAN.md` — now a pointer to this file (the Performance Profile
  demo detail + the OER-question source text still live there).
- `project_erica_tracking` memory — Erica relationship / waiting-on items.
- `PI2_WisconsinPATH_Build_Requirements.docx` — Erica's source spec (Bill's working doc, uncommitted).
- Capability evidence (Session 125 scan): registry → `verticals/workforce_monitoring/server/registry.js`;
  MEDS/compliance → `meds.js` / `compliance.js`; protocol cards → `tenants/wi_php/protocolCards.js`;
  risk tiering → `server/wellness.js`; instruments → `tenants/wi_php/score*.js`.
