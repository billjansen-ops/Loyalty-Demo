# Multi-Counter Promotions — Session 107 Handoff

**Date checkpointed:** April 23, 2026 (end of Session 106 work on promos)
**Design spec:** `docs/MULTI_COUNTER_PROMOTIONS_DESIGN.md`
**State:** Migration complete + tested. Backend refactor partially done. Nothing applied to local DB. Nothing pushed to Heroku. Server still running v55-compat code.

---

## What is DONE and sitting in the working tree (uncommitted)

### 1. `db_migrate.js` — v56 migration block (TESTED)

- `TARGET_VERSION` bumped `55 → 56`
- New migration block at the end of the `migrations` array
- Creates `promo_wt_count` and `member_promo_wt_count` tables
- Adds `counter_joiner` column to `promotion` (default 'AND') and `member_promotion` (snapshotted at enrollment)
- Drops legacy columns: `promotion.count_type`, `counter_molecule_id`, `counter_token_adjustment_id`, `goal_amount`; `member_promotion.progress_counter`, `goal_amount`
- Repoints `member_promotion_detail.member_promotion_id` → `member_wt_count_id`, swaps primary key
- 1-to-1 data copy: every existing promotion becomes a single-counter promotion with joiner='AND' (zero behavior change for existing rows)
- In-transaction verification: row counts and sums compared pre-vs-post, throws (and rolls back) on mismatch

**Tested successfully against a clone:**
```
DROP DATABASE IF EXISTS loyalty_migrate_test;
CREATE DATABASE loyalty_migrate_test WITH TEMPLATE loyalty;
DATABASE_NAME=loyalty_migrate_test node db_migrate.js
```
Result: 43 promos → 43 counters, 281 enrollments → 281 member-counters, 385 detail rows preserved, sums exactly preserved (progress=157928, member_goal=1435120, promo_goal=58551).

**`loyalty_migrate_test` database should still exist on the local Postgres** and have the v56 schema — useful for testing the refactored backend against v56 data without touching `loyalty`.

### 2. `pointers.js` — cache + helpers (NOT COMPILED AGAINST v56 YET)

**Added to `caches` object declaration:**
- `promoWtCounts: new Map()` — key: promotion_id → array of promo_wt_count rows

**Added to cache-load flow (around line 1920, after promotion_results):**
- Loads `promo_wt_count` rows at startup, keyed by promotion_id
- `caches.promotions` SELECT uses `p.*` so it picks up `counter_joiner` automatically and loses dropped columns automatically (no SELECT change needed)

**Refactored `createMemberPromotionEnrollment`** (around line 13056):
- **New signature:** `(memberLink, promotionId, tenantId, enrolledDate, opts = {})`
- `opts.startQualified` replaces old `startingProgress = goal_amount` auto-qualify pattern
- `opts.client` for transactional contexts
- Inserts member_promotion + one member_promo_wt_count per promo_wt_count
- Snapshots `counter_joiner` from promotion onto member_promotion
- Returns `{ memberPromotionId, counter_joiner, qualify_date, wtCounts: [...], progress_counter, goal_amount }` where the last two are LEGACY compat fields summed across counters — for callers we haven't fully multi-counter-ized yet

**Added helper `evaluatePromoQualifiedByJoiner(joiner, mpwcRows)`** — applies AND/OR joiner logic against a member's counter rows.

**Added helper `getMemberPromoWtCounts(memberPromotionId, { lockForUpdate, client })`** — reads member_promo_wt_count rows joined with promo_wt_count for dispatch info. Supports `SELECT ... FOR UPDATE` for the concurrency lock in the increment hot path.

**Syntax clean** (`node --check pointers.js` passes).

---

## What is NOT done

### Backend refactor (mostly not started)

1. **`evaluatePromotions` function** (around line 7255, ~400 lines). Still uses `promotion.count_type`, `memberPromotion.progress_counter`, `memberPromotion.goal_amount` — all of which are gone post-migration. Needs inner loop over `member_promo_wt_count` rows with per-counter dispatch. See design doc §6 for pseudocode.

2. **`evaluateTokenActivity` function** (around line 13319). Still queries `p.count_type = 'tokens'` and updates `member_promotion.progress_counter`. Needs to walk promo_wt_count rows where `count_type='tokens'` instead, and increment the matching member_promo_wt_count.

3. **`evaluateEnrollmentPromotions` function** (around line 7806). Filters `allPromotions.filter(p => p.count_type === 'enrollments')` — that column no longer exists. Should filter by "has an enrollments counter" by joining through caches.promoWtCounts.

4. **Activity-delete cascade** (around line 15777). Currently: `UPDATE member_promotion SET progress_counter = progress_counter - $1`. Needs: per-counter reversal via member_promotion_detail.member_wt_count_id. One activity may touch multiple counters → multiple detail rows → multiple decrements. **Never un-qualify** (preserve existing semantics).

5. **Display / read queries** that reference `mp.progress_counter` or `mp.goal_amount`:
   - Line ~15469 (CSR member endpoint)
   - Lines ~18849, 18862-18863 (admin view with percent calc)
   - Any `/v1/member/:id/promotions` shape returning those fields
   - Need to switch to aggregating from member_promo_wt_count

6. **Admin enrollment endpoint** (around line 18927). Currently INSERT with progress_counter + goal_amount columns. Must use new createMemberPromotionEnrollment.

7. **Auto-qualify endpoint at line 19005** — `progress_counter = goal_amount`. Must set every counter's progress to its goal AND qualify_date.

8. **Stress test code** at lines 20672, 20810. Creates member_promotion rows directly with progress_counter/goal_amount columns. Must be rewritten.

9. **8 callsites** of old `createMemberPromotionEnrollment` signature that still pass `promotion.goal_amount` as 4th arg — they'll break with the new signature. Grep: `createMemberPromotionEnrollment(` returns all of them.

10. **EXPECTED_DB_VERSION in pointers.js** still = 55. Must bump to 56 AT THE SAME TIME as running the migration on local loyalty (otherwise server crashes on startup).

### Everything else (steps 3-11 of the plan)

- Admin edit page tabs (FILTER/COUNT/REWARD)
- CSR view of promos (single-line collapse for single-counter)
- Member-facing API shape change
- Member-facing UI
- Test suite updates (4 existing files + 1 new)
- Polish + deploy

See `docs/MULTI_COUNTER_PROMOTIONS_DESIGN.md` for the full plan.

---

## Critical rules for the next session

1. **DO NOT migrate local loyalty DB until backend code in pointers.js is fully refactored to v56-aware.** The running server will crash on next restart if DB is v56 but EXPECTED_DB_VERSION is still 55 (guard in pointers.js:2572). The running server will also crash if DB is v55 but the code tries to SELECT `promotion.count_type` (column doesn't exist). Backend must be refactored FIRST, then bump EXPECTED_DB_VERSION to 56 + run migration + restart, as one atomic step.

2. **DO use `loyalty_migrate_test` database to test the refactored backend.** Point the server at it (`PGDATABASE=loyalty_migrate_test node pointers.js`) to exercise the v56 schema before touching local loyalty.

3. **All schema changes via `db_migrate.js`** — the v56 block exists and is solid. If additional schema adjustments surface during refactor, add a v57 block, don't edit v56.

4. **Don't un-qualify.** Once a member is qualified, stay qualified. Activity-delete cascade reverses progress but preserves qualify_date.

5. **Grandfather by default.** Admin edits to a promo's counter set don't retroactively apply to existing enrollees unless the admin explicitly opts in per edit.

6. **Restart the server after editing pointers.js** (memory rule from feedback_restart_server.md). Kill PID, `bootstrap/start.sh`, verify version.

---

## Resume prompt (cut and paste to start next session)

```
Session 107 startup — continuing multi-counter promotions build.

Read in order:
1. docs/MULTI_COUNTER_PROMOTIONS_DESIGN.md — full design spec
2. docs/SESSION_107_PROMOS_HANDOFF.md — what's done, what's not, critical rules
3. Memory files as normal (MEMORY.md + anything referenced)

State when you begin:
- Uncommitted changes in pointers.js (caches + helpers refactored, createMemberPromotionEnrollment new signature, evaluatePromoQualifiedByJoiner + getMemberPromoWtCounts helpers added) and db_migrate.js (v56 block added, TARGET_VERSION=56)
- Migration TESTED on loyalty_migrate_test clone (v56 schema), NOT applied to local loyalty
- Server still running PID from before (check with lsof -i :4001) on v55-compatible code
- Heroku on v58 (unrelated work: DB Utilities page + bare-root fix + app-switcher restriction). No promos code on Heroku.

First actions:
1. Confirm uncommitted state with `git status` — should show pointers.js + db_migrate.js modified, nothing else
2. Confirm loyalty_migrate_test still has v56 schema with `psql -h 127.0.0.1 -U billjansen -d loyalty_migrate_test -c "\d promo_wt_count"`
3. Point server at loyalty_migrate_test for refactor testing: kill current server, then `PGDATABASE=loyalty_migrate_test bootstrap/start.sh`
4. Start at step 2 of the todo list (evaluatePromotions refactor). Do NOT touch local loyalty DB until all of steps 2-5 (backend) are complete and syntax+runtime-clean.

Follow the step order in todos 2 → 5 (backend) → 6 → 7 → 8 → 9 → 10 → 11. Checkpoint after step 5 (backend complete, ready to migrate local loyalty) to verify with Bill before the first local DB migration.

Use extra-high model mode. Core platform hot-path refactor — no room for sloppy judgment.

First thing after the reads: tell Bill what's in the uncommitted changes and confirm the resume point.
```

---

## If you need to abort the refactor and clean up

If we decide not to continue the promos build (e.g., switching priorities):

```bash
# Revert uncommitted changes in pointers.js and db_migrate.js ONLY
cd /Users/billjansen/Projects/Loyalty-Demo
git checkout -- pointers.js db_migrate.js

# Drop the test clone
psql -h 127.0.0.1 -U billjansen -d postgres -c "DROP DATABASE IF EXISTS loyalty_migrate_test"

# The design doc and this handoff doc stay — they're committed already (design doc) or worth keeping (this file)
```

Current state post-abort: local loyalty and Heroku both on v55/v58, no promos work anywhere, design preserved for future pickup.
