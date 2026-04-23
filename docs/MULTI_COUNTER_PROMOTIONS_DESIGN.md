# Multi-Counter Promotions — Design Document

**Status:** Design complete, not yet built. Deferred to after the Tuesday/Wednesday presentation.
**Discussed:** Session 106, April 20 2026.
**Pattern precedent:** Mirrors the bonus_result pattern shipped in Session 105.

---

## 1. Motivation

Today a promotion has exactly one "what to count." Real-world loyalty programs routinely express compound or alternative-path goals that the current schema cannot represent:

- **"Fly 20,000 miles OR 20 flights to get Gold"** — alternative paths to the same reward.
- **"Fly 20,000 miles AND take 20 flights"** — compound requirement.
- **"Complete 5 surveys AND earn a Gold Token"** — mixed count types.
- **"Refer 3 friends OR complete your profile OR enroll in auto-debit"** — any-one-of engagement goal.

The platform needs to express "count N different things, with AND or OR between them, to qualify."

---

## 2. Design Philosophy

Reuse the pattern we already shipped in Session 105 for bonus results: move from one scalar field on the parent table to a child table with 0-N or 1-N rows, each describing one behavior. This time applied to "what to count" instead of "what happens when bonus fires."

Symmetry with rule criteria is intentional: promotions already combine rule criteria with AND/OR. Adding the same joiner pattern to counters makes the mental model consistent.

---

## 3. The Three-List Mental Model

After this change, a promotion admin page has three parallel repeating lists:

| Section | Answers | Table |
|---------|---------|-------|
| **Rule Criteria** (FILTER) | "Which activities even qualify to be counted?" | `rule_criteria` (via `promotion.rule_id → rule`) |
| **What to Count** (COUNT) | "How do we tally the activities that pass the filter?" | `promo_wt_count` (NEW) |
| **Promotion Results** (REWARD) | "What fires when the goal is met?" | `promotion_result` (already exists) |

Each section has its own AND/OR joiner (rule already has one; promo_wt_count gets a new one on the `promotion` row; results are always all-fire).

---

## 4. Schema Changes

### New table: `promo_wt_count`

```sql
CREATE TABLE promo_wt_count (
  wt_count_id SERIAL PRIMARY KEY,
  promotion_id INTEGER NOT NULL REFERENCES promotion(promotion_id) ON DELETE CASCADE,
  tenant_id SMALLINT NOT NULL,
  count_type VARCHAR(20) NOT NULL CHECK (count_type IN ('activities','miles','enrollments','molecules','tokens')),
  counter_molecule_id SMALLINT REFERENCES molecule_def(molecule_id),
  counter_token_adjustment_id INTEGER REFERENCES adjustment(adjustment_id),
  goal_amount NUMERIC NOT NULL CHECK (goal_amount > 0),
  sort_order SMALLINT DEFAULT 0,
  -- "required iff" check constraints (lifted from promotion table)
  CHECK (count_type = 'molecules' AND counter_molecule_id IS NOT NULL
      OR count_type <> 'molecules' AND counter_molecule_id IS NULL),
  CHECK (count_type = 'tokens' AND counter_token_adjustment_id IS NOT NULL
      OR count_type <> 'tokens' AND counter_token_adjustment_id IS NULL)
);

CREATE INDEX idx_promo_wt_count_promotion ON promo_wt_count(promotion_id);
```

### Changes to `promotion`

- **Add:** `counter_joiner VARCHAR(3) NOT NULL DEFAULT 'AND' CHECK (counter_joiner IN ('AND','OR'))`
- **Drop (post-migration):** `count_type`, `counter_molecule_id`, `counter_token_adjustment_id`, `goal_amount`
- **Drop check constraints** that referenced those columns

### New table: `member_promo_wt_count`

```sql
CREATE TABLE member_promo_wt_count (
  member_wt_count_id SERIAL PRIMARY KEY,
  member_promotion_id INTEGER NOT NULL REFERENCES member_promotion(member_promotion_id) ON DELETE CASCADE,
  wt_count_id INTEGER NOT NULL REFERENCES promo_wt_count(wt_count_id),
  tenant_id SMALLINT NOT NULL,
  progress_counter NUMERIC NOT NULL DEFAULT 0,
  goal_amount NUMERIC NOT NULL,   -- snapshot of promo_wt_count.goal_amount at enrollment time
  qualify_date DATE,               -- date THIS counter first hit its goal (NULL if not yet)
  UNIQUE (member_promotion_id, wt_count_id)
);

CREATE INDEX idx_mpwc_member_promotion ON member_promo_wt_count(member_promotion_id);
```

### Changes to `member_promotion`

- **Drop:** `progress_counter`, `goal_amount` (these move down to per-counter rows)
- **Keep:** `qualify_date` for whole-promotion qualification event
- **Keep:** everything else (enrolled flag, end_date, qualified_by_promotion_id, etc.)

### Changes to `member_promotion_detail`

- **Change FK:** drop `member_promotion_id`, add `member_wt_count_id INTEGER NOT NULL REFERENCES member_promo_wt_count(member_wt_count_id) ON DELETE CASCADE`
- **Unique key shifts:** from effectively (member_promotion_id, activity_link) to (member_wt_count_id, activity_link). One activity can now contribute to multiple counters on the same promotion → multiple detail rows per (member_promotion, activity).

---

## 5. Data Migration (db_migrate block)

Straightforward 1-to-1 copy — every existing promotion becomes a multi-counter promotion with exactly one counter. Zero behavior change for existing data.

1. Create `promo_wt_count` + `member_promo_wt_count` tables.
2. For each row in `promotion`, insert one row into `promo_wt_count` copying `count_type`, `counter_molecule_id`, `counter_token_adjustment_id`, `goal_amount`, sort_order=0.
3. For each row in `member_promotion`, insert one row into `member_promo_wt_count` pointing at the single `wt_count_id` for that promotion, copying `progress_counter` and `goal_amount`.
4. Re-point `member_promotion_detail` rows: add `member_wt_count_id`, look up via `member_promotion_id → member_promo_wt_count.member_wt_count_id` (one-to-one in this single-counter world).
5. Add `counter_joiner` column to `promotion` with default 'AND'.
6. Drop `count_type`, `counter_molecule_id`, `counter_token_adjustment_id`, `goal_amount` from `promotion`.
7. Drop `progress_counter`, `goal_amount` from `member_promotion`.
8. Drop `member_promotion_id` from `member_promotion_detail`.

**Verification queries** (run inside the migration, error on mismatch):
- `SELECT count(*) FROM promo_wt_count` = `SELECT count(*) FROM promotion` (one counter per promo after migration)
- `SELECT count(*) FROM member_promo_wt_count` = (pre-migration) `SELECT count(*) FROM member_promotion`
- `SELECT sum(progress_counter) FROM member_promo_wt_count` = (pre-migration) `SELECT sum(progress_counter) FROM member_promotion`
- `SELECT count(*) FROM member_promotion_detail WHERE member_wt_count_id IS NULL` = 0

---

## 6. Runtime Dispatch Changes

### Evaluation loop (pointers.js ~line 7427)

**Today:** outer loop over enrolled promotions; for each, run the single `count_type` branch to determine increment.

**New:** outer loop over enrolled promotions; **inner loop over that promotion's `promo_wt_count` rows**; for each counter, run its count_type branch.

Pseudocode:
```
For each enrolled member_promotion mp:
  Skip if already qualified (stays qualified — see §7).
  For each promo_wt_count wc on mp's promotion:
    Find the matching member_promo_wt_count mpwc.
    Compute incrementAmount based on wc.count_type (unchanged branch logic).
    If incrementAmount > 0:
      mpwc.progress_counter += incrementAmount
      Insert member_promotion_detail (member_wt_count_id=mpwc.id, activity_link, contribution_amount=incrementAmount)
      If mpwc.progress_counter >= mpwc.goal_amount AND mpwc.qualify_date IS NULL:
        mpwc.qualify_date = today
  After inner loop, evaluate promotion-level qualification (§7).
```

### Qualification logic (the bug-surface area)

After any counter updates on a promotion, check:
- **counter_joiner = 'OR':** qualify if ANY `member_promo_wt_count.qualify_date IS NOT NULL`
- **counter_joiner = 'AND':** qualify if ALL `member_promo_wt_count.qualify_date IS NOT NULL`

If qualified AND `member_promotion.qualify_date IS NULL`:
- Set `member_promotion.qualify_date = today`
- Fire all `promotion_result` rows (existing logic).

Never un-qualify (agreed §9).

### Special paths

- **Token counting** (pointers.js ~line 13319): loops over promotions where any `promo_wt_count.count_type = 'tokens'` matches the adjustment being issued. Each matching counter increments independently.
- **Enrollment counting** (pointers.js ~line 7785): at signup, fires +1 to any `promo_wt_count` with `count_type = 'enrollments'`. That counter's goal is typically 1. Mixing enrollment with activity-based counters is allowed (e.g., "enroll AND fly 5 times").

---

## 7. Activity-Delete Cascade (per-counter reversal)

When an activity is deleted, its contributions must be backed out **per counter**, not per promotion:

1. Find all `member_promotion_detail` rows where `activity_link = X`.
2. For each row:
   - Decrement the linked `member_promo_wt_count.progress_counter` by `contribution_amount`.
   - Delete the detail row.
3. One activity may touch multiple counters → multiple decrements, multiple row deletes.
4. **Do NOT un-qualify.** If a counter drops below its goal after deletion but the promotion has already fired results, the member keeps the reward. This preserves today's "once qualified, stay qualified" behavior.

The existing "Core: Activity Delete Cascade" test (11 assertions) will need extension to cover multi-counter cases.

---

## 8. UI Changes

### Admin promotion edit page

Three parallel repeating sections, all using the same add/edit/remove dialog pattern we already have for promotion results:

1. **What to Count** — joiner dropdown (AND/OR, visible only when ≥2 rows) + list of counter rows. Each row: count_type dropdown + conditional secondary picker (molecule/token) + goal_amount input.
2. **Rule Criteria** — existing, unchanged.
3. **Promotion Results** — existing, unchanged.

### Member-facing progress display

- **Single counter (migrated promos default here):** collapse to the current single-line look — no visual change.
- **Multi-counter:** bullet list of counters with the joiner shown:
  ```
  Fly to Gold Status  (OR)
    • 15,000 / 20,000 miles        75%
    • 17 / 20 flights              85%
  ```
- **Qualified view:** highlight which counter(s) crossed the finish line.

### Member-facing API shape

- Today: one `{ progress_counter, goal_amount, count_type }` per enrolled promo.
- New: array of `{ wt_count_id, count_type, counter_label, progress_counter, goal_amount, percent }` per enrolled promo, plus the promo-level `counter_joiner`.

---

## 9. Decisions Made in Discussion

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Flat joiner — single AND or OR across all counters on a promo, no nested groups | Covers 95%; nested adds significant complexity. Can revisit if needed. |
| 2 | Allow all count_type mixes (enrollments, tokens, activities, miles, molecules) | "Enroll and fly 5 times" is a real use case. No artificial restrictions. |
| 3 | `duration_type` / `duration_end_date` / `duration_days` stay on `promotion` (per-promo, not per-counter) | "30 days to fly 20k miles OR 20 flights" is natural. Per-counter duration would be confusing. |
| 4 | `process_limit_count` stays on `promotion` | Applies to the whole promo. Resetting progress on re-enrollment resets ALL counters together. |
| 5 | Goal amount snapshots to member instance at enrollment | Preserves today's invariant: once enrolled, goals don't shift if admin edits the promo. |
| 6 | Never un-qualify | Activities don't retroactively undo rewards. Applies to qualify events at both counter level and promotion level. |
| 7 | One activity contributes independently to each matching counter | Unique key on `member_promotion_detail` shifts to `(member_wt_count_id, activity_link)`. |

---

## 10. Risk Assessment

**Bang-for-buck:** High. Unlocks standard loyalty scenarios the platform cannot express today.

**Complexity:** Medium. Pattern is familiar (bonus_result precedent). Schema change is mechanical. Migration is 1-to-1 copy.

**Bug surface:**
1. **Qualify-transition detection.** "Did the joiner condition just flip from false to true?" — not hard, but it's where bugs will live. Must not double-fire when a non-critical counter later goes over goal.
2. **Data migration touches live core tables.** `member_promotion`, `member_promotion_detail`. Migration needs row-count and sum checks inside the transaction.
3. **Special paths.** Token and enrollment dispatchers need the new counter-loop pattern.
4. **Test updates.** Core: Promotion Engine (11 assertions), Complex Rules (19), Adjustments (14), Activity Delete Cascade (11) — all assume single-counter model. Will need updates.

**Timing:** NOT a pre-presentation change. This touches core schema on an active, data-rich table. Post-Tuesday/Wednesday work.

---

## 11. Build Order (when we do this)

1. db_migrate block — new tables, data copy, verification queries inside the transaction, drop old columns.
2. Cache layer — load `promo_wt_count` into memory with the promotion it belongs to.
3. Evaluation loop refactor — outer loop over promos, inner over counters, joiner-based qualification check.
4. Token and enrollment special paths — update to match the new dispatcher.
5. Activity-delete cascade — per-counter reversal logic.
6. Test suite updates — extend existing tests, add new multi-counter test cases.
7. Admin UI — three-section layout with repeating "What to Count" section.
8. Member-facing UI — multi-counter progress display, collapse-to-single-line for single-counter promos.
9. API shape change — counter array in enrolled-promotions response.
10. Release notes + Insight build notes.

Estimated: 1-2 sessions of focused work. Most of the time will be in test updates and UI.

---

## 12. Open Questions

- **Counter labels in UI:** Should admins set a custom label per counter (e.g., "International Miles" instead of "miles"), or auto-derive from count_type + picker? Probably auto-derive for now, add labels later if needed.
- **Qualified-by-counter disclosure:** When OR qualifies, do we show the member which counter got them there? Probably yes in the admin/CSR view, maybe not in the member app.
- **Progress display ordering:** Use `sort_order` from `promo_wt_count` or let the admin drag-and-drop? Start with `sort_order` column, worry about drag-and-drop later.
