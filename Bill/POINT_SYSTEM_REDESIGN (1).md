# POINT SYSTEM REDESIGN
**Design Date:** 2025-11-26
**Status:** Approved - Ready for Implementation
**Author:** Bill Jansen with Claude

---

## Executive Summary

Redesign the point system to be fully activity-centric. Each accrual tracks its own "available" balance. No buckets. No aggregation. No stored state to sync.

**Core insight:** Each earning activity IS its own bucket. Balance = SUM(available). That's it.

This is temporal-first philosophy taken to its logical extreme.

---

## Current State (What Exists Today)

**activity table:**
- activity_id, member_id, activity_date, post_date, activity_type
- point_amount (stored on activity)
- lot_id (pointer to point_lot bucket)

**point_lot table:**
- lot_id, member_id, expire_date
- accrued (running total - stored)
- redeemed (running total - stored)

**redemption_detail table:**
- activity_id, lot_id, points_used
- Tracks which buckets funded each redemption

**Problems with current model:**
- Mixed patterns (some things are molecules, some aren't)
- Stored state (accrued/redeemed) requires sync
- Separate table for redemption tracking
- Bucket aggregation adds complexity
- Not extensible to multiple point types without more tables

---

## New Design

### Core Principles

1. **Everything is activity** - All point movements are activities
2. **Each accrual is its own bucket** - No aggregation needed
3. **available column tracks remaining balance** - Updated on redemption
4. **Balance = SUM(available)** - One query, always correct
5. **Redemptions store negative points with available = 0** - Never consumed

### New Table: activity_detail_list

Extends molecule system to support multiple rows per molecule per activity:

```sql
CREATE TABLE activity_detail_list (
    detail_list_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(activity_id),
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    rule_id INTEGER NOT NULL REFERENCES point_rule(rule_id),
    points NUMERIC NOT NULL,      -- positive for earn, negative for redeem
    available NUMERIC NOT NULL,   -- remaining balance (0 for redemptions)
    point_type VARCHAR(10) DEFAULT 'RDM',  -- future: MQM, MQD, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_adl_activity ON activity_detail_list(activity_id);
CREATE INDEX idx_adl_member_points ON activity_detail_list(activity_id, molecule_id);
CREATE INDEX idx_adl_available ON activity_detail_list(available) WHERE available > 0;
```

### New Table: point_rule

Defines expiration rules:

```sql
CREATE TABLE point_rule (
    rule_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    rule_code VARCHAR(20) NOT NULL,
    rule_name VARCHAR(100),
    expire_date DATE,  -- NULL = never expires
    point_type VARCHAR(10) DEFAULT 'RDM',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, rule_code)
);
```

### Changes to activity table

Remove these columns:
- point_amount (moves to activity_detail_list)
- lot_id (no longer needed)

Activity becomes thin:
```sql
CREATE TABLE activity (
    activity_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES member(member_id),
    activity_date DATE NOT NULL,
    post_date DATE NOT NULL,
    activity_type CHAR(1) NOT NULL,
    mqd NUMERIC DEFAULT 0  -- keep for promotion counting
);
```

### Tables Removed

- **point_lot** - Gone. Each accrual tracks its own available.
- **redemption_detail** - Gone. Redemptions are just negative point rows.

---

## How It Works

### Example: Three Accruals, One Redemption

**Setup:** Two point rules exist
- Rule A: expire_date 2025-12-31 (last year)
- Rule B: expire_date 2026-12-31 (this year)

**Accrual 1:** 1,000 points, last year activity
```
activity: {activity_id: 1, member_id: 123, activity_type: 'A'}
activity_detail_list: {activity_id: 1, molecule: 'points', rule_id: A, points: 1000, available: 1000}
```

**Accrual 2:** 1,000 points, last year activity
```
activity: {activity_id: 2, member_id: 123, activity_type: 'A'}
activity_detail_list: {activity_id: 2, molecule: 'points', rule_id: A, points: 1000, available: 1000}
```

**Accrual 3:** 1,000 points, this year activity
```
activity: {activity_id: 3, member_id: 123, activity_type: 'A'}
activity_detail_list: {activity_id: 3, molecule: 'points', rule_id: B, points: 1000, available: 1000}
```

**State after accruals:**
| activity_id | rule_id | points | available |
|-------------|---------|--------|-----------|
| 1 | A | 1,000 | 1,000 |
| 2 | A | 1,000 | 1,000 |
| 3 | B | 1,000 | 1,000 |

**Balance = SUM(available) = 3,000** ✓

**Redemption:** 2,500 points (FIFO - oldest first)

Step 1: Find accruals with available > 0, ORDER BY expire_date, activity_date
Step 2: Consume 1,000 from activity 1 (available: 1000 → 0)
Step 3: Consume 1,000 from activity 2 (available: 1000 → 0)
Step 4: Consume 500 from activity 3 (available: 1000 → 500)
Step 5: Create redemption activity with breakdown by rule

**State after redemption:**
| activity_id | rule_id | points | available |
|-------------|---------|--------|-----------|
| 1 | A | 1,000 | 0 |
| 2 | A | 1,000 | 0 |
| 3 | B | 1,000 | 500 |
| 4 | A | -2,000 | 0 |
| 4 | B | -500 | 0 |

**Balance = SUM(available) = 500** ✓

### Key Points

- **Accruals:** points = available (at creation)
- **Redemptions:** available = 0 always (never consumed from)
- **FIFO:** Query by expire_date, activity_date WHERE available > 0
- **Redemptions store negative points** grouped by rule_id

---

## Balance Calculations

**Total balance:**
```sql
SELECT SUM(available) as balance
FROM activity_detail_list adl
JOIN activity a ON adl.activity_id = a.activity_id
JOIN molecule_def m ON adl.molecule_id = m.molecule_id
WHERE a.member_id = 123
  AND m.molecule_key = 'points';
```

**Point summary by expiration (for point summary page):**
```sql
SELECT 
    r.expire_date,
    SUM(CASE WHEN adl.points > 0 THEN adl.points ELSE 0 END) as accrued,
    SUM(CASE WHEN adl.points < 0 THEN ABS(adl.points) ELSE 0 END) as redeemed,
    SUM(adl.available) as available
FROM activity_detail_list adl
JOIN activity a ON adl.activity_id = a.activity_id
JOIN molecule_def m ON adl.molecule_id = m.molecule_id
JOIN point_rule r ON adl.rule_id = r.rule_id
WHERE a.member_id = 123
  AND m.molecule_key = 'points'
GROUP BY r.rule_id, r.expire_date
ORDER BY r.expire_date;
```

Result:
| expire_date | accrued | redeemed | available |
|-------------|---------|----------|-----------|
| 2025-12-31 | 2,000 | 2,000 | 0 |
| 2026-12-31 | 1,000 | 500 | 500 |

**Same display as today. No stored buckets needed.**

---

## Reversals

**How reversal works:**

Redemption activity 4 has:
- Rule A: -2,000
- Rule B: -500

**To reverse:**

1. Delete redemption rows from activity_detail_list
2. Restore available on accruals by rule:
   - Rule A: Find accruals with available < points, restore newest first
   - Rule B: Same

**No cross-reference needed.** The redemption's breakdown by rule IS the reversal map. Restoring within same rule preserves aging.

```sql
-- For Rule A, restore 2,000 points to accruals (newest first within rule)
UPDATE activity_detail_list adl
SET available = points
FROM activity a
JOIN point_rule r ON adl.rule_id = r.rule_id
WHERE adl.activity_id = a.activity_id
  AND a.member_id = 123
  AND adl.rule_id = 'A'
  AND adl.available < adl.points
ORDER BY a.activity_date DESC
-- (actual implementation needs cursor or iterative logic)
```

---

## Implementation Steps

### Phase 1: Schema Changes
1. Create point_rule table
2. Create activity_detail_list table
3. Add 'points' molecule to molecule_def
4. Populate point_rule with current expiration rules

### Phase 2: Core Functions
1. Create getPointBalance(member_id, tenant_id) function
2. Create getPointSummary(member_id, tenant_id) function - returns by expiration
3. Create assignPointRule(activity_date, tenant_id) function - determines which rule applies
4. Create consumePoints(member_id, amount, tenant_id) function - FIFO consumption

### Phase 3: Activity Posting
1. Modify POST /v1/activities to write to activity_detail_list
2. Set points = available for accruals
3. Remove point_amount and lot_id from activity inserts
4. Test: Add flight, verify member header shows correct balance

### Phase 4: Point Summary Page
1. Update point-summary.html to use getPointSummary()
2. Verify display matches old format (accrued/redeemed/available by expiration)
3. Test: Verify columns match expected values

### Phase 5: Redemptions
1. Modify redemption posting:
   - Call consumePoints() to update available on accruals
   - Write negative point rows to activity_detail_list
   - Set available = 0 on redemption rows
2. Remove redemption_detail writes
3. Test: Redeem points, verify balance updates, verify point summary

### Phase 6: Bonuses
1. Bonus points also go through activity_detail_list
2. Bonus activities (type 'N') get their own point rows
3. points = available at creation
4. Test: Earn bonus, verify in balance

### Phase 7: Cleanup
1. Remove point_amount column from activity table
2. Remove lot_id column from activity table
3. Drop point_lot table
4. Drop redemption_detail table
5. Update any remaining queries

---

## Key Code Locations to Modify

**server_db_api.js:**
- Activity posting endpoint
- Redemption posting endpoint
- Member balance calculation
- Point summary endpoint
- Bonus evaluation (points assignment)

**HTML Pages:**
- member-header.js (balance display)
- point-summary.html (bucket display)
- add_activity.html (point entry)
- add_redemption.html (redemption processing)

---

## Testing Checklist

- [ ] Add flight activity - balance increases
- [ ] Add second flight activity - balance increases correctly
- [ ] Point summary shows correct expirations
- [ ] Redemption deducts from oldest first (FIFO)
- [ ] Partial consumption works (available partially decremented)
- [ ] Multi-rule redemption works (spans expirations)
- [ ] Member header shows correct total
- [ ] Bonus points appear in balance
- [ ] Adjustment (type J) works positive and negative
- [ ] Partner activity (type P) works
- [ ] Reversal restores available correctly
- [ ] Reversed points maintain original expiration

---

## Future Enhancement: Multiple Point Types

Add point_type column (already in schema):
- RDM (redeemable miles)
- MQM (medallion qualifying miles)
- MQD (medallion qualifying dollars)

Balance queries add: `WHERE point_type = 'RDM'`

Promotions can sum specific types or all types.

Redemption rules can restrict: "This award requires RDM only"

**Same structure. No schema changes. Just filter by point_type.**

---

## Future Enhancement: Delta Dating

**Concept:** Points never expire as long as member is active. Every activity bumps all points to new expiration.

**Implementation Path (when needed):**

### New Table: member_point_rule

```sql
CREATE TABLE member_point_rule (
    member_rule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES member(member_id),
    rule_id INTEGER NOT NULL REFERENCES point_rule(rule_id),
    expire_date DATE,  -- UPDATABLE - this is the key
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, rule_id)
);
```

### How It Works

1. **point_rule** defines the template (expiration_period = 36 months)
2. **member_point_rule** is member's instance with actual expire_date
3. **activity_detail_list** points to member_rule_id (not rule_id)

### Delta Dating Flow

1. Member flies
2. Find/create their member_point_rule for applicable rule
3. Update expire_date = activity_date + 36 months
4. **All activities pointing to that member_rule_id now have new expiration**

### Why This Works

- One update extends ALL points for that member/rule
- No touching individual activity rows
- Point summary query joins through member_point_rule to get current expire_date
- Reversal? Just restore available. Expiration is on member_rule, not activity.

### Migration Path

When ready to implement:
1. Create member_point_rule table
2. Populate from existing activities (one row per member per rule)
3. Add member_rule_id column to activity_detail_list
4. Update FK to point to member_point_rule instead of point_rule
5. Simple migration - no recalculation needed

**Deferred - adds complexity. Implement after base model is solid.**

---

## Why Now?

1. **No data to convert.** Fresh start means no migration scripts.
2. **Code is known.** We wrote it. No archaeology.
3. **Later is harder.** Converting live data is traumatic.
4. **Elegance pays dividends.** Every future feature is easier.

---

## Performance Notes

**Concern:** "Is querying all activities slow?"

**Reality:** 
- Active member: 50-100 activities/year
- 10 years = 500-1,000 activities
- Lifetime max = ~2,000 activities

SUM with proper indexes = sub-millisecond.

**Index strategy:**
- idx_adl_activity: Fast joins
- idx_adl_available: FIFO queries (WHERE available > 0)
- Composite index on (member_id, molecule_key, available) if needed

Performance concern dismissed.

---

## Design Rationale

This design emerged from first-principles thinking:

1. Activities are the atomic unit of truth
2. Each accrual IS its own bucket
3. available column = remaining balance
4. Redemptions = negative points with available = 0
5. Balance = SUM(available) - always correct
6. No stored state to sync
7. No bucket aggregation
8. No separate redemption tracking table

**The result:** 

A point system where:
- Simple programs (one point type, fixed expiration) = trivial
- Complex programs (multiple types, Delta Dating, redemption restrictions) = same structure
- Zero code changes for new complexity
- One query for balance
- One pattern for everything

This is 40 years of loyalty system experience distilled into one clean architecture.

---

## Summary

| Concept | Old Model | New Model |
|---------|-----------|-----------|
| Point storage | point_amount on activity | activity_detail_list rows |
| Bucket storage | point_lot table | Each accrual IS a bucket |
| Balance | SUM(accrued - redeemed) from point_lot | SUM(available) |
| Redemption tracking | redemption_detail table | Negative point rows, available=0 |
| FIFO | Query point_lot by expire_date | Query accruals by expire_date WHERE available > 0 |
| Reversal | Restore point_lot.redeemed | Restore accrual.available by rule |
| Multiple point types | New tables needed | Just add point_type filter |
| Delta Dating | Complex | Add member_point_rule layer |

**Simpler. Cleaner. More flexible. Same performance.**
