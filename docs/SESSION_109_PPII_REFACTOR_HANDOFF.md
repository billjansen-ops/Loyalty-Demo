# Session 109 Handoff — PPII streams config-driven refactor

**Date checkpointed:** April 25 2026 (end of Session 108)
**Reason for handoff:** Refactor scope is too large to start at end of Session 108. Clean break preferred over risk of finishing mid-refactor in a bad state.

---

## What's shipped (do NOT touch)

The current state of `main` (HEAD `32af16c`):

- **db_migrate v57 applied to local `loyalty` and `loyaltybig`.** Adds `sysparm_key='ppii_weights'` per tenant, seeded for wi_php (tenant_id=5) with Erica's March 11 values: pulse 0.35, ppsi 0.25, compliance 0.25, events 0.15.
- **`admin_ppii_weights.html` works end-to-end.** Sliders, sum=1.0 enforcement, save, retrain via SSE log modal that streams the Python retrain in real time. 35-assertion test (`tests/insight/test_ppii_weights.cjs`) covers API + UI + retrain flow.
- **`ml/retrain_with_weights.py`** CLI accepts a `--weights` JSON, regenerates synthetic data, retrains the GradientBoosting+Calibrated classifier, bumps version, records `trained_against_ppii_weights` in `model_info.json`.
- **`scorePPII.js` accepts optional weights param** with hardcoded fallback. All production callers pass `caches.ppiiWeights.get(tenantId)`.
- **`custauth.js` POST_ACCRUAL receives weights via context.**
- **Insight dashboard nav card** added (PPII Scoring Weights live).
- **LPHeader tenant home** is now visible to non-superusers (was a blocker — non-superusers like Erica saw an empty app menu).
- Full suite: 34 tests, 627+ assertions, all green.

**Heroku is at `bf33f43` (Session 106). Local is at `32af16c`. Heroku is behind by Session 107 (multi-counter) + Session 108 (PPII weights). NOT deployed by user request.**

---

## What's designed but NOT built (the Session 109 work)

A platform-level refactor: make PPII streams config-driven, not hardcoded.

### Why

Today the four PPII streams (pulse / ppsi / compliance / events) are baked into code in **6+ places**:
- `scorePPII.js` (PPII_WEIGHTS_DEFAULT, PPII_MAXIMA, function signature)
- `ml/ml_service.py` (PPII_WEIGHTS module global, `simulate_trajectory` line ~410)
- `caches.ppiiWeights` cache loader query in `pointers.js`
- `admin_ppii_weights.html` (`STREAMS = ['pulse', 'ppsi', 'compliance', 'events']` array)
- `tests/insight/test_ppii_weights.cjs`
- The `sysparm_detail` rows themselves (codes match these names)

Insight architecture explicitly plans for more streams (Stream D Operational Strain, Stream E Wearables, Stream F Monthly Stability Pulse). Adding any of them today is a Claude session per stream. Bill's directive (April 25, non-negotiable): **"this has to be configurations, not hard coded. not negotiable. and now."**

### Architecture (designed, ready to implement)

**Four tables. Replaces sysparm-based weight storage.**

```sql
-- 1. The dictionary of streams (per tenant)
CREATE TABLE ppii_stream (
  ppii_stream_id     SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id          SMALLINT NOT NULL REFERENCES tenant(tenant_id),
  code               VARCHAR(20) NOT NULL,        -- 'pulse', 'ppsi', etc.
  label              VARCHAR(50) NOT NULL,        -- UI display name
  max_value          NUMERIC NOT NULL CHECK (max_value > 0),
  source_function    VARCHAR(50) NOT NULL,        -- registry key for fetcher
  is_active          BOOLEAN NOT NULL DEFAULT true,
  sort_order         SMALLINT NOT NULL DEFAULT 0,
  added_in_phase     VARCHAR(20),                  -- 'pilot', 'post-pilot' (optional)
  UNIQUE (tenant_id, code)
);

-- 2. Versioned weight bundles (replaces sysparm storage of weights)
CREATE TABLE ppii_weight_set (
  weight_set_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id          SMALLINT NOT NULL REFERENCES tenant(tenant_id),
  effective_from     TIMESTAMP NOT NULL,
  changed_by_user    INTEGER REFERENCES users(user_id),
  change_note        TEXT,
  is_current         BOOLEAN NOT NULL DEFAULT false
);

-- 3. The actual weights — one row per (set, stream)
CREATE TABLE ppii_weight_set_value (
  weight_set_id      INTEGER NOT NULL REFERENCES ppii_weight_set(weight_set_id),
  stream_code        VARCHAR(20) NOT NULL,
  weight             NUMERIC NOT NULL CHECK (weight BETWEEN 0 AND 1),
  PRIMARY KEY (weight_set_id, stream_code)
);

-- 4 + 5. Audit / history (BUILT IN PHASE 2, NOT THIS REFACTOR — design only)
CREATE TABLE ppii_score_history (
  history_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id          SMALLINT NOT NULL REFERENCES tenant(tenant_id),
  p_link             CHAR(5) NOT NULL,
  computed_at        TIMESTAMP NOT NULL,
  ppii_score         SMALLINT NOT NULL CHECK (ppii_score BETWEEN 0 AND 100),
  weight_set_id      INTEGER NOT NULL REFERENCES ppii_weight_set(weight_set_id),
  trigger            VARCHAR(30)        -- 'recompute' | 'tier_change' | 'registry_item' etc.
);
CREATE INDEX ON ppii_score_history(p_link, computed_at DESC);

CREATE TABLE ppii_score_history_component (
  history_id         BIGINT NOT NULL REFERENCES ppii_score_history(history_id) ON DELETE CASCADE,
  stream_code        VARCHAR(20) NOT NULL,
  raw_value          NUMERIC NOT NULL,
  PRIMARY KEY (history_id, stream_code)
);
```

**Why a child table for components instead of JSONB:** referential integrity (FK → ppii_stream.code), better analytics (`GROUP BY stream_code`), trivial recompute against new weights (single JOIN), type safety. JSONB was lazy.

**Why `ppii_weight_set` versioned table replaces sysparm:** the change log Erica wants becomes `SELECT * FROM ppii_weight_set ORDER BY effective_from DESC` — no separate audit table. Recompute under historical weights is a JOIN to `ppii_weight_set_value`. Replaces sysparm cleanly.

### What the refactor must do (in order)

1. **db_migrate v58:**
   - Create `ppii_stream`, `ppii_weight_set`, `ppii_weight_set_value`, `ppii_score_history`, `ppii_score_history_component`.
   - Seed `ppii_stream` for wi_php with the existing 4 streams: `pulse` (max 42, source `fetchPulseRaw`), `ppsi` (max 102, source `fetchPpsiRaw`), `compliance` (max 18, source `fetchComplianceRaw`), `events` (max 3, source `fetchEventsRaw`). Use Erica's March 11 weights as the initial weight set.
   - Migrate the existing `sysparm_key='ppii_weights'` row into a `ppii_weight_set` row (effective_from = NOW, is_current = true).
   - DROP the sysparm row after the migration verifies the new tables.
   - In-transaction verification: sum of weights = 1.0 per tenant, all stream codes match registered fetcher names.

2. **Source-function registry in `pointers.js`:**
   ```js
   const ppiiStreamFetchers = {
     fetchPulseRaw:      async (memberLink, tenantId, db) => { /* current pulse_respondent query */ },
     fetchPpsiRaw:       async (memberLink, tenantId, db) => { /* current member_survey query */ },
     fetchComplianceRaw: async (memberLink, tenantId, db) => { /* current sum-of-last-6 query */ },
     fetchEventsRaw:     async (memberLink, tenantId, db) => { /* current most-recent-event query */ },
   };
   ```
   Each `ppii_stream` row references one of these by name.

3. **`scorePPII.js` refactor:** `calcPPII` no longer takes named raw params. Takes `{ memberLink, tenantId }` and:
   - Reads cached `ppii_stream` rows for the tenant
   - For each active stream, calls the source_function to get the raw value
   - Normalizes against `max_value`
   - Applies the weight from current `ppii_weight_set_value`
   - Returns the composite

4. **`ml_service.py` refactor:** `simulate_trajectory` reads PPII_WEIGHTS as a dict keyed by stream code. The retrain CLI (`retrain_with_weights.py`) accepts whatever stream codes are passed.

5. **`pointers.js`** cache layer: replace `caches.ppiiWeights` (which queries sysparm) with two caches — `caches.ppiiStreams` (per tenant → array of stream rows) and `caches.ppiiWeights` (per tenant → current `ppii_weight_set_value` rows joined to stream codes). Both reload on weight save and on cache refresh.

6. **`pointers.js`** GET/PUT endpoints: `/v1/tenants/:id/ppii-weights` reads from the new tables. PUT creates a new `ppii_weight_set` row, marks it `is_current`, clears the previous one. Audit info lives in the row itself (changed_by_user, change_note).

7. **`admin_ppii_weights.html` refactor:** `STREAMS = [...]` array gone. UI iterates over what `GET` returns. Each slider row dynamically rendered from the response.

8. **All callers of `calcPPII`** (`pointers.js` x2, `custauth.js`) updated to the new signature.

### What "equivalence" means (the verification gate)

This refactor is invisible to users. Same scores, same thresholds, same signals.

**Two layers of verification:**

1. **Full test suite passes unchanged.** All 34 tests / 627+ assertions must produce identical results. If even one assertion's expected value drifts, something broke. The existing `test_ppii_weights.cjs` will need minor updates (e.g., the response shape may grow a `streams` field), but no behavioral changes to existing tests.

2. **Spot-check Insight members on local `loyalty`.** Before starting refactor: query a handful of wi_php members, record their current PPII via the wellness endpoint. After refactor: same query, same members, results must match exactly.

`loyaltybig` is Delta tenant data — PPII does not apply. NOT in scope for verification.

### Build order in Session 109

1. Capture pre-refactor PPII spot-check values for Insight members.
2. Write db_migrate v58 + test against `loyalty_v58_test` clone.
3. Source-function registry in pointers.js.
4. scorePPII.js refactor (with old signature also kept temporarily so callers can migrate one at a time).
5. ml_service.py refactor.
6. Cache layer.
7. Endpoints.
8. Admin UI.
9. Apply v58 to local `loyalty`.
10. Run test suite — confirm green without modification.
11. Run spot-check — confirm identical PPII for the captured members.
12. Once both green, this is "step 1 complete." Update build notes + commit + push.

**Only THEN** start on:
- `ppii_score_history` writes (snapshots on calc)
- Chart "current vs previous" rendering
- Recompute button on admin page
- Recent Changes panel on admin page

That's the audit/history feature — separate session, separate scope, **only after Erica replies to the proposal email**.

### What's deferred (don't build until clinical answers)

- **PPSI subdomain weights tab** — Erica needs to answer 3 clinical questions (section keys, weighting math semantic, default values) per the email draft.
- **Audit/history feature** — Erica needs to react to the proposal in `docs/PPII_PROPOSAL_EMAIL_TO_ERICA.md`. The 4-table architecture is designed but the visible behavior (chart rendering, recompute button, change log panel) waits on her sign-off.

---

## Erica conversation status

- Original proposal email sent Session 105/106-ish (covered in `docs/PPII_WEIGHTS_UI_DESIGN.md` § Appendix).
- Erica replied April 25 with her four answers (yes-yes-talk-Erica-only).
- Bill drafted the follow-up email with proposal + PPSI questions in `docs/PPII_PROPOSAL_EMAIL_TO_ERICA.md`. **As of Session 108 end, NOT YET SENT.** Bill may send before Session 109 starts.
- If Erica replies with material changes to the audit design before Session 109 wraps up the refactor, that's fine — the refactor is independent of the audit feature. Audit gets re-scoped if needed.

---

## Heroku state

- Code: `bf33f43` (end of Session 106).
- DB: v55.
- Behind: Session 107 multi-counter (v56), Session 108 PPII weights (v57).
- **Not deployed by user request.** Bill said "lets hold for now."
- v56 migration takes 45-60 minutes on a `loyaltybig`-scale DB — when deployed, plan accordingly. See `docs/PRODUCTION_MIGRATION_PATTERN.md` for the long-term answer (Expand/Migrate/Contract pattern).

---

## Key reminders for Session 109

- **Discuss first, code later.** Bill explicitly flagged this multiple times in Session 108. Don't open new questions or audit unrelated code without his prompt.
- **No scope creep.** This session's job is the refactor + equivalence verification. Period. Audit/history is next session.
- **bumps SERVER_VERSION + BUILD_NOTES every pointers.js edit.** Memory rule. Restart server after edits. Don't ask permission.
- **Never reference "Claude" in user-facing text or external docs.** Bill flagged this on the Erica email — say "engineering" instead.
- **Loyalty-only spot check.** loyaltybig is Delta data; PPII doesn't apply.

---

## Resume prompt (cut and paste below)

The startup prompt for Session 109 lives at the bottom of this file. Use it verbatim.
