# PPII Weights UI — Design Document

**Status:** Designed, not built. Awaiting answers from Erica on 4 open questions (email drafted but not yet sent as of Session 106).
**Discussed:** Session 106, April 23 2026.
**Pattern precedent:** Reuses the SSE log-streaming modal from the DB Utilities "Update" button (Session 106).

---

## 1. Motivation

Chris raised the question at the April 22 demo about how we weight the different variables in the PPII scoring. It surfaced a real gap: Erica, who designed the clinical model, has no way to adjust the weights without asking Claude to edit code.

Three reasons this matters:

1. **Aligns with platform philosophy.** Per `docs/LOYALTY_PLATFORM_MASTER.md`: "data drives behavior, not hardcoded logic." Today `PPII_WEIGHTS` is a hardcoded JS const. Any change requires code edit → commit → push → server restart. That's wrong for a value the clinical architect should own.

2. **Pilot tuning.** As real WI PHP data arrives, Erica will want to tune the weights. Gating those adjustments on a developer creates a bottleneck and dilutes her ownership of the clinical framework.

3. **Per-tenant differentiation.** Wisconsin weights Pulse at 35%. Another state's PHP, or a nurses' board program, might weight Compliance heaviest because their program philosophy differs. Same engine, different weights — exactly what the sysparm layer was built for.

A secondary benefit: strong demo material. "Here's the page where the clinical architect adjusts her own model, and here's the live ML retrain firing against the new weights" is the kind of demo that turns audience anxiety about black-box AI into confidence about a legible, clinician-controlled system.

---

## 2. What Exists Today

**Hardcoded in `verticals/workforce_monitoring/tenants/wi_php/scorePPII.js`:**

```javascript
const PPII_WEIGHTS = {
  pulse:      0.35,
  ppsi:       0.25,
  compliance: 0.25,
  events:     0.15
};
```

(Exact values confirmed by Erica March 11, 2026.)

**PPSI subdomain weights** — separately flagged in `scorePPSI.js` as *"BLOCKING: Final section weights pending from Erica."* Has never been resolved. Same pattern: hardcoded const awaiting her input.

**ML model** (`ml/ml_service.py`, v0.3.0, GradientBoostingClassifier + CalibratedClassifierCV) — consumes PPII as one of 19 input features. Model trained against the current weight set. Changing weights drifts the model's calibration (see §7 ML Impact).

**No admin UI for either** — Claude edits the file when Erica asks.

---

## 3. What We're Building

A new admin page `admin_ppii_weights.html` where Erica can adjust scoring weights directly. Changes persist in the `sysparm` table (per-tenant), are loaded into cache at server startup, and `scorePPII.js` reads from the cache instead of the hardcoded const. A one-click retrain button regenerates the ML model against the new weights with a live log modal.

---

## 4. Decisions Made in Discussion

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Weights live in `sysparm` table (per-tenant) | Matches the existing platform pattern for tenant-level configurable values. |
| 2 | Default access: superuser only | Safest default. Can broaden to a program-admin role later once RBAC is real (currently Bouncer is placeholder). |
| 3 | Validation: weights must sum to 1.0 | Enforce server-side. UI shows live sum so admin can't fight with it. |
| 4 | Audit trail: always capture; visible log in UI is follow-up | Server logs who changed what when regardless. Displaying that log in the UI is a phase-2 polish. |
| 5 | Single page with PPII streams + (optionally) PPSI subdomain weights | Same admin page serves both; unblocks the "BLOCKING: PPSI section weights pending" note at the same cost as building just PPII streams. Confirm scope with Erica — see Q1. |
| 6 | ML retrain is admin-triggered, not automatic | Retraining on every weight tweak is wasteful and changes model behavior unexpectedly. Explicit button, explicit event. |
| 7 | Retrain uses SSE log modal pattern from Session 106 DB Utilities | Proven, reusable, and genuinely cool to watch. |
| 8 | Snapshot vs retroactive scoring when weights change — **default retroactive** | Today PPII is computed on-demand, not stored, so weight changes are effectively retroactive for all historical displays. Snapshot-on-calculation is a phase-2 enhancement if Erica asks for it (see Q2). |

---

## 5. Schema

### Storage approach

Use existing `sysparm` + `sysparm_detail` pattern. One sysparm key per weight family, one sysparm_detail row per individual weight.

**Example data for tenant_id=5 (wi_php):**

```sql
-- sysparm
(sysparm_id, tenant_id, sysparm_key,    value_type, description)
(_,         5,          'ppii_weights', 'json',     'PPII stream weights — must sum to 1.0')

-- sysparm_detail  (one row per stream)
(sysparm_id, category,   code,         value)
(_,          'stream',   'pulse',      '0.35')
(_,          'stream',   'ppsi',       '0.25')
(_,          'stream',   'compliance', '0.25')
(_,          'stream',   'events',     '0.15')
```

**If PPSI section weights are added in same ship (Q1 answer = yes):**

```sql
-- sysparm
(_, 5, 'ppsi_section_weights', 'json', 'PPSI subdomain weights within PPSI — must sum to 1.0')

-- sysparm_detail  (one row per PPSI section)
(_, 'section', 'clinical_competence', '0.20')
(_, 'section', 'cognitive',           '0.15')
(_, 'section', 'work_sustainability', '0.15')
(_, 'section', 'isolation',           '0.10')
(_, 'section', 'recovery',            '0.15')
(_, 'section', 'purpose',             '0.10')
(_, 'section', 'substance_use',       '0.10')
(_, 'section', 'safety',              '0.05')
```

(Exact section keys TBD — match `scorePPSI.js` definitions.)

### Migration (db_migrate v??)

TARGET_VERSION bumps. Migration block:

1. Insert sysparm + sysparm_detail rows for each existing tenant using the current hardcoded values as the seed.
2. For WI PHP specifically: use the values Erica confirmed March 11.
3. For other tenants (Delta, etc.): skip PPII weights — not applicable.
4. Verification: sum of stream weights = 1.0 per tenant; fail and rollback if not.

**No schema change to create new tables.** Reuses existing sysparm infrastructure.

---

## 6. Server Changes (`pointers.js`)

### 6.1 Cache loading

Add to cache-load flow (near other sysparm-backed caches):

```javascript
caches.ppiiWeights = new Map();  // key: tenantId → { pulse, ppsi, compliance, events }
caches.ppsiSectionWeights = new Map();  // key: tenantId → { clinical_competence, ... }
```

Load at startup and on cache-refresh:

```sql
SELECT s.tenant_id, s.sysparm_key, sd.code, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
WHERE s.sysparm_key IN ('ppii_weights', 'ppsi_section_weights')
  AND sd.category IN ('stream', 'section');
```

Bucket rows into the two cache maps by sysparm_key.

### 6.2 scorePPII.js consumption

`scorePPII.js` currently does:

```javascript
const PPII_WEIGHTS = { pulse: 0.35, ... };
// ...
const score = pulseScore * PPII_WEIGHTS.pulse + ...;
```

Change to read from cache, with hardcoded fallback for safety:

```javascript
import { getCachedPpiiWeights } from '../../../../pointers.js';  // or via injected helper
const weights = getCachedPpiiWeights(tenantId) || {
  pulse: 0.35, ppsi: 0.25, compliance: 0.25, events: 0.15
};
const score = pulseScore * weights.pulse + ...;
```

Fallback exists so the scorer never breaks if sysparm is missing for a tenant (e.g., during initial rollout or for tenants where PPII doesn't apply).

### 6.3 Endpoints

**GET `/v1/tenants/:tenantId/ppii-weights`** — returns the current weight set for that tenant. Superuser-only.

**PUT `/v1/tenants/:tenantId/ppii-weights`** — accepts `{ pulse, ppsi, compliance, events }`. Validates:
- All four present, each in [0, 1]
- Sum == 1.0 (allow ±0.001 floating-point tolerance)

On success:
- Upsert sysparm_detail rows
- Reload cache for that tenant
- Insert audit row (who/when/what changed)
- Return new values + a `ml_calibration_drift_warning: true|false` indicating whether the change is material enough to recommend retraining (see §7).

**GET `/v1/tenants/:tenantId/ppsi-section-weights`** and **PUT** — same pattern for PPSI sections, only built if Q1 scope includes PPSI.

**POST `/v1/ml/retrain` (SSE)** — new endpoint. Streams log lines from the child Python retrain process as Server-Sent Events. Same shape as the Session 106 `/v1/admin/database/:name/migrate` endpoint. Spawns `python ml/ml_service_retrain.py` (or calls the existing `/train` endpoint on the running ML service) with the current tenant's weights, streams stdout/stderr, sends `{ type: 'done', code }` when complete. Kills child on client disconnect.

### 6.4 Audit

New table or reuse existing audit infrastructure. Each weight change gets logged:
- changed_by (user_id)
- tenant_id
- sysparm_key (e.g., 'ppii_weights')
- old_values (JSON)
- new_values (JSON)
- changed_ts (Bill epoch datetime)

Can reuse the `platform_error_log` approach or create a dedicated `sysparm_change_log` table. Phase-1: log to server console + persist minimally; phase-2: wire into admin UI change log view.

---

## 7. ML Impact

Changing PPII weights shifts the distribution of PPII values that the ML model sees as input. The model was trained against a specific weight set, so dramatic shifts drift its calibration.

### Magnitude guidance

| Change | Impact | Action |
|---|---|---|
| ±5% on any stream | Negligible drift | No retrain needed |
| ±10-15% | Noticeable drift on edge cases | Recommend retrain |
| >15% or category re-weighting (e.g., Pulse 35% → 15%) | Material miscalibration | Retrain before deploying |

The server's PUT endpoint computes the magnitude of change and returns `ml_calibration_drift_warning: true` when the change exceeds 10% on any stream. The UI surfaces this as a soft yellow banner: *"This change may affect ML model calibration. Recommend retraining before new scores are relied upon."*

### Retrain flow

1. User clicks "Retrain ML" button on the weights page
2. Opens the SSE log modal (same component as DB migrate)
3. Server spawns the retrain process with current weights
4. Logs stream in real time:
   ```
   ▶ Regenerating training dataset with current PPII weights
     Pulse: 0.35, PPSI: 0.25, Compliance: 0.25, Events: 0.15
     Generating 10,000 synthetic member trajectories...
     ✓ Dataset ready: 10,000 members × 19 features
   ▶ Training GradientBoostingClassifier
     Epoch 10/100  loss=0.423
     ...
     ✓ Training complete
   ▶ Calibrating probability outputs (CalibratedClassifierCV)
     Running 5-fold cross-validation...
     ✓ Calibration complete
   ▶ Evaluating
     AUC-ROC:     0.874
     Brier score: 0.142
     Feature importance (top 3):
       ppii_current: 0.28
       domain_breadth: 0.19
       chronicity: 0.14
   ▶ Saving model
     ✓ /ml/model.pkl (v0.3.1)
     ✓ /ml/scaler.pkl
     ✓ model_info.json updated
   ◀ Retrain complete (42.3s). Model v0.3.1 now active.
   ```
5. On success, the running ML service reloads `model.pkl` (or is restarted as a subprocess)
6. Model version tracked in `model_info.json` alongside the PPII weight set version it was trained against

### Version tracking

Store in `ml/model_info.json`:

```json
{
  "model_version": "0.3.1",
  "trained_at": "2026-04-25T14:32:00Z",
  "trained_against_ppii_weights": { "pulse": 0.35, "ppsi": 0.25, "compliance": 0.25, "events": 0.15 },
  "trained_against_ppsi_weights": { ... },
  "training_samples": 10000,
  "metrics": { "auc_roc": 0.874, "brier": 0.142 }
}
```

The admin page reads this and shows: *"Current ML model v0.3.1 trained March 11, 2026 against PPII weight set. ⚠ Current weights differ by 12% — retrain recommended."*

---

## 8. UI (`admin_ppii_weights.html`)

### Layout

Standard admin page (matching the pattern of other `admin_*.html` files — LONGORIA styling, lp-header, brand-loader).

**Header:** "PPII Scoring Weights" + subtitle "Adjust the relative weight of each input stream to the composite risk score"

**If scope includes PPSI sections (Q1 answer = yes):** tabbed layout
- Tab 1: **PPII Stream Weights** (Pulse / PPSI / Compliance / Events)
- Tab 2: **PPSI Section Weights** (8 subdomains)

**Each tab contents:**

- Live "Sum: 1.00 ✓" indicator at the top (red if not 1.0)
- One row per weight:
  - Label (e.g., "Pulse")
  - Number input (0-100 as percent, converted to 0-1 internally) OR slider + number input
  - Live visual bar showing relative contribution
- "Save" button (disabled until sum = 1.0)
- "Reset to Defaults" button (loads the March 11 Erica-confirmed values)

**ML calibration indicator:**

Small panel near the top:

```
Current ML model: v0.3.0 trained Mar 11, 2026
Change magnitude: 0% from trained weights ✓ No retrain needed
[ Retrain ML ] ← disabled until changes are saved
```

Updates live as the admin drags sliders. Turns yellow at >10% drift, red at >15%.

### Retrain button

- Disabled until weights have been saved (retraining against unsaved state is confusing)
- Opens the SSE log modal on click
- Modal reuses the component from `system_database.html` (the "Update" button in DB Utilities) — dark terminal-style panel, spinner, streaming log, Cancel/Close buttons

### Change log view (phase-2)

Collapsible "Recent Changes" section at the bottom showing the last N weight adjustments with user + timestamp. Reads from the audit trail.

---

## 9. Open Questions for Erica (pending reply to email)

The email sent to Erica poses these four questions. Answers shape scope and behavior.

1. **Scope:** Just PPII stream weights, or also PPSI subdomain weights in the same page?
   - If **yes to PPSI** → add ~1 hour to the build; unblocks the "BLOCKING: PPSI section weights pending" note
   - If **no** → keep build tight, PPSI can be a follow-up
2. **History:** When weights change, should past PPII scores stay as originally calculated, or recompute against new weights?
   - Default: **retroactive** (today's on-demand behavior). Snapshot-at-calc would require storing PPII + weight version per member-score.
3. **Audit visibility:** Visible change log in the UI, or invisible server-side only?
   - Default: **invisible for v1**, visible as phase-2 enhancement
4. **Access:** Erica only, or any program-admin-level user?
   - Default: **superuser-only for v1** (safest), broaden when real RBAC ships

---

## 10. Build Order

Aligned with Session 106 workflow (discuss → code → test → push):

1. **Migration block** — seed sysparm rows for each existing tenant with current hardcoded values
2. **Cache loading** — add `ppiiWeights` and optionally `ppsiSectionWeights` maps; load at startup and cache-refresh
3. **Server: scorePPII.js consumption** — read from cache with hardcoded fallback
4. **Server: GET/PUT endpoints** — validation, audit log insert, drift-warning computation
5. **Server: SSE retrain endpoint** — spawn + stream, reusing `/v1/admin/database/:name/migrate` as template
6. **UI: `admin_ppii_weights.html`** — tabs, sliders, live sum, drift indicator, retrain button + modal
7. **Tests** — validation path, sum-must-equal-1, drift-warning triggering, retrain happy path
8. **Polish** — SERVER_VERSION bump, BUILD_NOTES, Insight_Build_Notes.md header
9. **Deploy** — push origin + heroku, `heroku run node db_migrate.js --app hdwhf` before web restart

**Estimated total effort:** 4-5 hours (1 focused session). Adding PPSI section weights adds ~1 hour. Adding phase-2 change log UI adds ~1 hour.

---

## 11. Risk Assessment

**Bang-for-buck:** High. Directly unlocks clinical ownership of the model, plus gives Erica a compelling demo artifact.

**Complexity:** Low-medium. Reuses existing sysparm pattern. Reuses SSE log modal from Session 106. No new tables, no schema migration beyond sysparm seeding.

**Bug surface:**

1. **Validation edge cases** — floating-point sum tolerance, non-numeric inputs, missing fields
2. **Cache consistency** — after PUT, cache must reload BEFORE the response returns, or the next scoring call uses stale values
3. **ML retrain failure modes** — Python process crash, model file write race, stale model served during reload window
4. **Scorer fallback path** — if sysparm rows accidentally dropped, fallback to hardcoded defaults must fire cleanly

**Timing:** Safe to build anytime. No core schema changes to production-critical tables. Worst case: UI bug, roll back the `admin_ppii_weights.html` file.

---

## 12. Resume Prompt (cut and paste to start build session)

```
Session [N] startup — building Erica's PPII weighting UI.

Read in order:
1. docs/PPII_WEIGHTS_UI_DESIGN.md — full design spec
2. Memory files as normal (MEMORY.md + anything referenced)

State when you begin:
- No code written yet for this feature. Hardcoded weights still live in
  verticals/workforce_monitoring/tenants/wi_php/scorePPII.js
- ML model v0.3.0 is the current trained version; trained_against_ppii_weights
  is recorded in ml/model_info.json
- Session 107 promos work may or may not be shipped — check git log before
  assuming current Heroku state
- Check if Erica has replied to the email (§9 of the design doc) — her answers
  shape Q1 (scope), Q2 (history), Q3 (audit), Q4 (access). If no reply yet,
  build with the defaults listed in §4

First actions:
1. Confirm clean working tree with `git status`
2. Read ml/ml_service.py to understand the existing /train endpoint and how
   ml_service subprocess is managed
3. Read the SSE migrate endpoint in pointers.js (the Session 106 db_migrate
   streaming log modal) as the template for the retrain flow
4. Start at step 1 of the build order (migration block seeding sysparm)

Use extra-high model mode — this touches the clinical scoring path and the
ML model file. Not hot-path risky like promos, but the seeding + validation
logic needs to be right the first time.

First thing after the reads: confirm plan with Bill before writing any code,
especially the scope decision (Q1) since it affects the migration block and
the UI structure.
```

---

## Appendix: Email draft sent to Erica

**Subject:** A thought from Chris's question — giving you the weighting controls

Hi Erica,

When Chris asked the question about how we weight the different variables in the scoring, it occurred to me that you should have a way of adjusting these yourself — you're the one who owns the clinical model, and in pilot (and post-pilot) you're going to want to tune things as real data comes in.

What I'm picturing is a page in the admin area where you can:

- See the current PPII stream weights (Pulse 35%, PPSI 25%, Compliance 25%, Events 15%)
- Adjust them (sliders or direct input), with a live "sum = 1.00" check so the math always balances
- Save, and have the change take effect immediately for future scoring
- Optionally extend this to PPSI section weights too — I know you had those flagged as still pending

One bonus: when a weight change is material enough to affect the ML model, we'd add a "Retrain the ML against these weights" button. It would pop up a live log window showing the retrain as it happens — dataset generation, training progress, accuracy metrics, the works. Part practical, part honestly pretty cool to demo.

If you agree this would be valuable, a couple of questions to shape it:

1. **Scope:** Just PPII stream weights, or also PPSI subdomain weights in the same page?
2. **History:** When you change a weight, should past PPII scores stay as they were originally calculated, or do you want the system to recompute them against the new weights? (Clinical defensibility argument either way — curious what feels right to you.)
3. **Audit:** Do you want a visible "change log" on the page — who adjusted what, when, and why — or is that overkill?
4. **Access:** Should this be you only, or any program-admin-level user? Thinking about when we have multiple states on the platform.

No rush on the answers. Wanted to plant the seed while the demo was still fresh. And seriously — you did beautifully yesterday. Chris raising this with the Federation is a real win.

Bill
