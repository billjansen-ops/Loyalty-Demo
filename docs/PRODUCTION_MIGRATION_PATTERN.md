# Production Migration Pattern

**Status:** Architecture reference, not yet implemented as platform tooling.
**Written:** April 25 2026, prompted by watching v56 take 23+ minutes on `loyaltybig`.

---

## When This Matters

The current `db_migrate.js` runs every migration block in a single transaction. For dev, test, demo databases, and even our current `loyalty` (~tens of thousands of rows), that's correct — it's atomic, it's understandable, it's safe.

It stops being correct the moment any of these are true:

- The migration includes a statement linear in row count on a multi-million-row table (e.g. `UPDATE ... SET col = subquery FROM other_table`).
- The application is taking live writes and can't tolerate a multi-minute write block.
- The single transaction would hold long-lived locks during a deploy window.
- "Roll back if anything goes wrong" stops being viable because rolling back means losing hours of in-flight transactions.

For Wisconsin PHP and any other production deploy, we should plan to be in this regime.

---

## The Pattern: Expand → Migrate → Contract

Treat any schema change that's not metadata-only as **four phases**, each its own deploy. The running app is never asked to understand a schema state it doesn't recognize.

| Phase | Schema | Code | Lock impact |
|---|---|---|---|
| **1. Expand** | Add new tables/columns alongside the old ones. Old columns stay. | Reads from old. **Dual-writes** to both old and new. | Adding nullable columns and tables is metadata-only in modern Postgres — milliseconds. |
| **2. Migrate (Backfill)** | Backfill new tables/columns in **batches** (10k rows, sleep, repeat). | No change. | Each batch holds locks for seconds, not minutes. Live writers see brief pauses. |
| **3. Read-cutover** | None. | Reads switch to new schema. **Still dual-writes.** Lets you verify divergence and roll back the read change without a schema rollback. | None. |
| **4. Contract** | Drop old columns/tables. | Stops dual-writing in the same deploy. | Dropping a column is metadata-only too. |

The window between Phase 1 and Phase 4 may span days. That is a feature, not a bug. It's where the safety lives.

### Why dual-write before read-cutover

Phase 1 ships a code change that double-pays on every write (writes to old + new). The new write may fail; the old one shouldn't. Production traffic seeds the new tables for free during the dual-write window. By the time backfill (Phase 2) finishes, all rows that have been written-since-deploy are already in the new shape.

### Why read-cutover before contract

Phase 3 is the riskiest moment — flipping reads to a new code path. If the new path has a bug, you can roll back the deploy. The old columns still exist, dual-writes are still happening, no data is lost. You only drop the old columns (Phase 4) once Phase 3 has been observed in production for a while.

---

## Worked Example: v56 (Multi-Counter Promotions) Done Right

Our actual v56 migration ran as one transaction, with these steps:

1. Create `promo_wt_count` and `member_promo_wt_count` tables.
2. Add `counter_joiner` column to `promotion` and `member_promotion`.
3. Copy existing rows 1-to-1 into the new tables.
4. **`UPDATE member_promotion_detail` setting `member_wt_count_id` from a join.**
5. Drop legacy columns: `progress_counter`, `goal_amount`, `count_type`, `counter_molecule_id`, `counter_token_adjustment_id`.
6. Verify row counts and sums; commit.

Step 4 is the killer on a large database. It scans the entire `member_promotion_detail` table, joins each row to `member_promo_wt_count`, and updates in place. On `loyaltybig`, this took 20+ minutes holding strong locks on `member_promotion_detail`. In production with live writers, that's an outage.

### How the four-phase version of v56 would look

**Phase 1 (Expand) — deploy 1:**
- Migration: create both new tables, add `counter_joiner` and `member_wt_count_id` (nullable) columns. No data movement.
- Code: every place that writes to `member_promotion` also writes to `member_promo_wt_count`. Every place that inserts into `member_promotion_detail` populates both `member_promotion_id` (old) and `member_wt_count_id` (new). All reads still go through the old columns.
- Risk: small. Writers do a tiny extra write per accrual.

**Phase 2 (Backfill) — background job, no deploy:**
- For each existing `member_promotion`, ensure a `member_promo_wt_count` row exists with the snapshotted goal/progress.
- For each `member_promotion_detail` row missing `member_wt_count_id`, batch-update from the join, 10k rows at a time, with `pg_sleep` between batches.
- Track progress in a `migration_progress` table so the job can be paused/resumed.
- Verify per batch: row count matches, sums match.
- Run during off-peak. Can take days.

**Phase 3 (Read-cutover) — deploy 2:**
- No schema change.
- Code: `evaluatePromotions`, `getMemberPromoWtCounts`, all read paths now use the new tables. Dual-write continues — old columns still maintained for safety net.
- Watch dashboards for a week. If anything diverges, roll back THIS deploy and you're back to phase 1+2 cleanly.

**Phase 4 (Contract) — deploy 3 + migration:**
- Code: stop dual-writing. Old write paths removed.
- Migration: drop the legacy columns. Add the FK and PK changes that v56 currently does.
- This deploy is irreversible, so it ships only after read-cutover has been stable.

Total: three deploys, one background job, ~1 week elapsed. No outage, no minute-long lock, no all-or-nothing transactional risk.

### What the v56 transactional version did right (and we keep)

- Verification step at the end (compare pre/post row counts and sums). The four-phase version embeds this in Phase 2's batch verification AND in Phase 3's pre-contract sanity check.
- "Once enrolled, snapshot the counter set" semantic. This is a code/design rule, not a migration concern, and stays unchanged.

---

## What We'd Need to Build to Support This

We don't have the platform pieces yet. Listed by priority:

1. **Phased migration runner.** `db_migrate.js` would understand that v56a, v56b, v56c, v56d are sequential and can be applied independently. Each phase has its own version number; the running code carries a "minimum required schema version" that lets you reject deploys that would skip a phase.

2. **Background job framework with checkpointing.** Today's scheduled jobs run at fixed times and don't track resumable progress. A backfill job needs:
   - Idempotency (re-running picks up where it left off via a `migration_progress` row)
   - Throttling (`pg_sleep` between batches; configurable batch size)
   - Cancellation that doesn't leave the DB inconsistent
   - Observability (a dashboard showing rows-per-second, ETA, lag)

3. **Dual-write helper functions.** Every dual-write site is identical-looking boilerplate; a helper like `withDualWrite(oldOp, newOp, { failOnNew: false })` would cut errors and make the dual-write phase trivially auditable.

4. **Schema-version-aware code branches.** A `sysparm` or feature-flag layer that lets code ask "are we past read-cutover for the multi-counter migration?" and branch accordingly. Today this would be hardcoded based on EXPECTED_DB_VERSION; cleaner is a named flag per migration.

5. **Cancellable migrations.** The Session 106 SSE migrate endpoint already kills the child on client disconnect, but the child's open transaction may sit holding locks until rollback completes. For a 23-minute UPDATE, that rollback is itself slow. Phased migrations sidestep this entirely (each batch is short).

---

## Decision Criteria — Which Pattern To Use

Use the **single-transaction pattern** (current `db_migrate.js`) when at least one of these is true:

- The migration is small (no statements linear in row count, or the table is small).
- The database is dev, test, demo, or a clone we can afford to throw away.
- We can take an outage / maintenance window of the duration the migration needs.
- The schema change is metadata-only (column add with default in newer Postgres, table create, index create concurrently).

Use the **four-phase Expand/Migrate/Contract pattern** when:

- The migration includes any statement that's linear in production-scale row counts.
- The application is serving live writes that we cannot pause.
- A failed migration partway through would be worse than rolling forward.
- The total elapsed time we can afford is much shorter than the time the linear statement would take.

Use **operationally-enhanced single-transaction** (read replica failover, brief read-only mode, etc.) when neither extreme fits — e.g. small enough to migrate in one transaction but big enough that we want to avoid even a few seconds of lock contention.

---

## Heroku Specifics

Heroku's `release` phase runs migrations on each deploy. For the simple pattern, this is fine. For the four-phase pattern, we run:

- Phase 1: deploy with migration in release phase. Fast — metadata only.
- Phase 2: do NOT run via release phase. Run as a one-shot dyno (`heroku run`) or as a background worker process. Release-phase scripts are bounded by Heroku's deploy timeout (~30 minutes); long backfills aren't appropriate.
- Phase 3: deploy with no migration. Or with a small no-op marker migration so the version number advances.
- Phase 4: deploy with the contract migration in release phase. Fast — column drops only.

Heroku's read replica add-on (Heroku Postgres standalone replicas) is the right tool if we need to take a planned 30-second cutover window with zero data loss. Not for v56-style work, but for major rewrites.

---

## TL;DR

| | Single transaction (today) | Four-phase (production) |
|---|---|---|
| Time to deploy | Minutes | Days |
| Outage risk | Linear in worst statement | Zero |
| Code complexity | None — one schema | Dual-write window |
| Rollback | Free (transaction rolls back) | Per-phase, possible up through Phase 3 |
| Verification | At commit | Continuous during Phase 2 + 3 |
| When to use | Dev/test, small DBs, planned windows | Live production at scale |

The discipline is recognizing **before** writing the migration which regime we're in.
