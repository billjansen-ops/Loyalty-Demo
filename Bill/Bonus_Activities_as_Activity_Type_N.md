# Bonus Activities as Activity Type 'N' - Architectural Design

**Author:** Bill Jansen  
**Date:** 2025-11-07  
**Status:** Proposed Architecture

---

## Executive Summary

Instead of storing bonuses in a separate `activity_bonus` table, this design treats bonuses as activities with type 'N'. Each bonus becomes a full activity record with molecules that point back to the parent activity and bonus rule. This provides unlimited flexibility, natural audit trails, and architectural purity while keeping the system simple and consistent.

---

## The Core Concept

### Traditional Approach (Current)
```
activity (id: 123, type: 'B', points: 1000, activity_date: 2025-11-05)
  └─ activity_detail: carrier=DL, origin=MSP, destination=BOS, fare_class=F

activity_bonus (activity_id: 123, bonus_id: 5, bonus_points: 100)
  └─ Fixed columns, no flexibility
```

### Proposed Approach (Activity Type 'N')
```
activity (id: 123, type: 'B', points: 1000, activity_date: 2025-11-05)
  └─ activity_detail: carrier=DL, origin=MSP, destination=BOS, fare_class=F

activity (id: 124, type: 'N', points: 100, activity_date: 2025-11-05)
  └─ activity_detail: parent_activity_id=123  (molecule pointing to parent)
  └─ activity_detail: bonus_rule_id=5
  └─ activity_detail: awarded_by='AUTO'  (optional)
  └─ activity_detail: promotion_code='SUMMER2025'  (optional)
```

---

## Activity Type 'N' Definition

**Character:** N  
**Meaning:** Bonus/Promotional Award  
**Purpose:** Points awarded as a result of evaluating bonus rules against a parent activity

### System Molecule: activity_type
```sql
-- Stored in molecule_def with context='system'
molecule_key: 'activity_type'
context: 'system'
value_kind: 'list'

-- Values in molecule_value_text:
B = Base Activity (core business event)
P = Partner Activity (partner earning)
A = Adjustment (manual correction)
R = Redemption (point spending)
N = Bonus/Promotional Award (derived from parent)
```

---

## Architecture Details

### Required Molecules for Type 'N'

**1. parent_activity_id** (NEW SYSTEM MOLECULE)
- **Type:** scalar numeric
- **Purpose:** Points to the activity that triggered this bonus
- **Context:** system
- **Usage:** Every 'N' activity must have this molecule
- **Example:** v_ref_id = 123 (points to base activity)

**2. bonus_rule_id** (NEW SYSTEM MOLECULE)
- **Type:** scalar numeric
- **Purpose:** Points to the bonus rule that awarded these points
- **Context:** system
- **Usage:** Links bonus to its triggering rule
- **Example:** v_ref_id = 5 (First Class bonus)

### Optional Molecules for Type 'N'

**3. awarded_by**
- **Type:** text
- **Purpose:** Who/what awarded the bonus (AUTO, CSR username, BATCH)
- **Context:** system
- **Usage:** Audit trail

**4. promotion_code**
- **Type:** text
- **Purpose:** Marketing promotion code if applicable
- **Context:** marketing
- **Usage:** Campaign tracking

**5. award_reason**
- **Type:** text
- **Purpose:** Human-readable explanation
- **Context:** system
- **Usage:** CSR notes, customer communication

**6. override_expiration**
- **Type:** date
- **Purpose:** If bonus has different expiration than parent
- **Context:** system
- **Usage:** Special promotions

---

## Query Patterns

### Display Activity with Bonuses

```sql
-- Get base activity
SELECT * FROM activity WHERE activity_id = 123;

-- Get bonuses for this activity
SELECT 
  n.*,
  parent.v_ref_id as parent_activity_id,
  bonus_rule.v_ref_id as bonus_rule_id
FROM activity n
JOIN activity_detail parent 
  ON n.activity_id = parent.activity_id 
  AND parent.molecule_id = [parent_activity_id_molecule]
JOIN activity_detail bonus_rule
  ON n.activity_id = bonus_rule.activity_id
  AND bonus_rule.molecule_id = [bonus_rule_id_molecule]
WHERE n.type = 'N'
  AND parent.v_ref_id = 123;

-- Performance optimization: also filter by activity_date
AND n.activity_date = (SELECT activity_date FROM activity WHERE activity_id = 123);
```

### List Member Activities (Exclude Bonuses)

```sql
-- All base activities (never show type 'N' in main list)
SELECT * FROM activity 
WHERE member_id = 2153442807 
  AND activity_type != 'N'
ORDER BY activity_date DESC;
```

### Reverse Activity with Bonuses

```sql
-- Find all bonuses for parent activity
SELECT n.activity_id
FROM activity n
JOIN activity_detail parent 
  ON n.activity_id = parent.activity_id 
  AND parent.molecule_id = [parent_activity_id_molecule]
WHERE n.type = 'N'
  AND parent.v_ref_id = 123;

-- Reverse each bonus (create type 'A' adjustment activities)
-- Then reverse the parent
```

### Calculate Total Points for Activity

```sql
-- Base points + all bonus points
SELECT 
  base.activity_id,
  base.point_amount as base_points,
  COALESCE(SUM(bonus.point_amount), 0) as bonus_points,
  base.point_amount + COALESCE(SUM(bonus.point_amount), 0) as total_points
FROM activity base
LEFT JOIN activity_detail parent_link
  ON parent_link.v_ref_id = base.activity_id
  AND parent_link.molecule_id = [parent_activity_id_molecule]
LEFT JOIN activity bonus
  ON bonus.activity_id = parent_link.activity_id
  AND bonus.activity_type = 'N'
WHERE base.activity_id = 123
GROUP BY base.activity_id, base.point_amount;
```

---

## Why This Design Is Brilliant

### 1. Architectural Purity
**Everything is an activity.** No special tables, no special code. The bonus system uses the same infrastructure as everything else:
- activity table
- activity_detail molecules
- encode/decode functions
- template rendering

**Consistency:** If you understand how base activities work, you understand how bonuses work.

### 2. Unlimited Flexibility
Traditional `activity_bonus` table has fixed columns:
```sql
activity_bonus_id, activity_id, bonus_id, bonus_points, created_at
```

Want to track promotion codes? **Schema change required.**  
Want CSR notes? **Schema change required.**  
Want override expirations? **Schema change required.**

With activity type 'N', just add molecules:
```sql
-- No schema changes ever
INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id)
VALUES (124, [promotion_code_molecule], [text_pool_id]);
```

### 3. Natural Audit Trail
Bonuses appear in the activity stream:
```
11/07/2025 - Flight MSP-BOS - 1,000 miles
11/07/2025 - First Class Bonus - 500 miles
11/07/2025 - Summer Promotion - 200 miles
```

**No separate bonus query needed.** Chronological order is automatic.

### 4. Elegant Reversals
Reverse a flight? Find all type 'N' activities with `parent_activity_id = 123` and reverse them too.

**One pattern handles:**
- Reverse base activity
- Reverse all associated bonuses
- Reverse adjustments
- Cascade reversals

### 5. Point Lot Association
Each bonus gets its own `lot_id`:
```sql
activity (id: 123, type: 'B', lot_id: 5001)  -- Base miles
activity (id: 124, type: 'N', lot_id: 5002)  -- Bonus miles

-- Different expiration rules per lot
point_lot (lot_id: 5001, expire_date: 2026-11-07)  -- Base expires in 1 year
point_lot (lot_id: 5002, expire_date: 2025-12-31)  -- Bonus expires end of year
```

Traditional systems struggle with different expiration rules for bonuses.

### 6. Reporting & Analytics
```sql
-- How many bonus miles awarded this month?
SELECT SUM(point_amount) 
FROM activity 
WHERE activity_type = 'N' 
  AND activity_date >= '2025-11-01';

-- Which bonus rules awarded the most?
SELECT 
  bonus_rule.v_ref_id as rule_id,
  COUNT(*) as times_awarded,
  SUM(point_amount) as total_points
FROM activity n
JOIN activity_detail bonus_rule 
  ON n.activity_id = bonus_rule.activity_id
  AND bonus_rule.molecule_id = [bonus_rule_id_molecule]
WHERE n.activity_type = 'N'
GROUP BY bonus_rule.v_ref_id;
```

All standard SQL. No special reporting tables.

---

## The Tradeoffs

### ❌ Query Complexity
**Problem:** Every member activity query needs `WHERE activity_type != 'N'`

**Example:**
```sql
-- Before (simple)
SELECT * FROM activity WHERE member_id = 123;

-- After (filter needed)
SELECT * FROM activity WHERE member_id = 123 AND activity_type != 'N';
```

**Mitigation:**
- Create view: `CREATE VIEW member_activities AS SELECT * FROM activity WHERE activity_type != 'N'`
- Use view in all member-facing queries
- Document this requirement in query patterns

### ❌ Activity Table Size
**Problem:** Table grows 2-3x larger

**Math:**
- 1 flight = 1 base activity
- 2 bonuses = 2 type 'N' activities
- Total: 3 activity records instead of 1

**Impact:**
- 10M flights without bonuses: 10M activity rows
- 10M flights with 2 bonuses each: 30M activity rows
- Storage: 30M × ~313 bytes = ~9GB (still tiny)

**Mitigation:**
- PostgreSQL handles 30M rows easily
- Proper indexes make queries fast
- Storage is cheap
- Partitioning by date if needed in future

### ❌ New System Molecule Type
**Problem:** `parent_activity_id` is a molecule that points to an activity_id

**Conceptual oddity:**
- Molecules usually point to domain data (airports, carriers)
- This one points to infrastructure (activity_id)

**Is this okay?**
- **YES** - Molecules are just typed pointers
- `parent_activity_id` is just another pointer
- Store as numeric scalar: `v_ref_id = 123`
- Conceptually consistent even if slightly unusual

### ❌ Foreign Key Enforcement Complexity
**Problem:** Can't enforce `parent_activity_id` references with traditional FK

Traditional FK:
```sql
FOREIGN KEY (parent_activity_id) REFERENCES activity(activity_id)
```

But `parent_activity_id` is buried in activity_detail as v_ref_id.

**Solutions:**
1. **Application-level enforcement** - Code validates parent exists
2. **Trigger** - Database trigger checks on INSERT
3. **Accept it** - Trust the system, validate in queries

**Recommendation:** Application-level enforcement is sufficient. The system controls all writes.

---

## Implementation Plan

### Phase 1: Database Schema

**Step 1:** Add 'N' to activity_type molecule
```sql
-- Insert type 'N' into molecule_value_text
INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order)
VALUES 
  ([activity_type_molecule_id], 'N', 'Bonus/Promotional Award', 5);
```

**Step 2:** Create new system molecules
```sql
-- parent_activity_id molecule
INSERT INTO molecule_def (tenant_id, molecule_key, label, context, value_kind, scalar_type, is_static, is_permanent, is_active)
VALUES 
  (1, 'parent_activity_id', 'Parent Activity ID', 'system', 'scalar', 'numeric', false, true, true);

-- bonus_rule_id molecule  
INSERT INTO molecule_def (tenant_id, molecule_key, label, context, value_kind, scalar_type, is_static, is_permanent, is_active)
VALUES
  (1, 'bonus_rule_id', 'Bonus Rule ID', 'system', 'scalar', 'numeric', false, true, true);
```

**Step 3:** Create member_activities view
```sql
CREATE VIEW member_activities AS
SELECT * FROM activity WHERE activity_type != 'N';
```

### Phase 2: Code Changes

**Step 1:** Update bonus evaluation function
```javascript
// Old: Insert into activity_bonus table
async function awardBonus(activityId, bonusId, bonusPoints) {
  await dbClient.query(`
    INSERT INTO activity_bonus (activity_id, bonus_id, bonus_points)
    VALUES ($1, $2, $3)
  `, [activityId, bonusId, bonusPoints]);
}

// New: Create type 'N' activity
async function awardBonus(memberId, activityId, activityDate, bonusId, bonusPoints, lotId) {
  // Create bonus activity
  const result = await dbClient.query(`
    INSERT INTO activity (member_id, activity_date, post_date, activity_type, point_amount, lot_id)
    VALUES ($1, $2, NOW()::DATE, 'N', $3, $4)
    RETURNING activity_id
  `, [memberId, activityDate, bonusPoints, lotId]);
  
  const bonusActivityId = result.rows[0].activity_id;
  
  // Add parent_activity_id molecule
  await encodeMolecule(bonusActivityId, 'parent_activity_id', activityId);
  
  // Add bonus_rule_id molecule
  await encodeMolecule(bonusActivityId, 'bonus_rule_id', bonusId);
}
```

**Step 2:** Update activity list query
```javascript
// Use the view
const query = `
  SELECT * FROM member_activities
  WHERE member_id = $1
  ORDER BY activity_date DESC
`;
```

**Step 3:** Update bonus display query
```javascript
async function loadActivityBonuses(activityId) {
  const query = `
    SELECT 
      n.activity_id,
      n.point_amount as bonus_points,
      bonus_rule.v_ref_id as bonus_rule_id
    FROM activity n
    JOIN activity_detail parent 
      ON n.activity_id = parent.activity_id 
      AND parent.molecule_id = $2
    JOIN activity_detail bonus_rule
      ON n.activity_id = bonus_rule.activity_id
      AND bonus_rule.molecule_id = $3
    WHERE n.activity_type = 'N'
      AND parent.v_ref_id = $1
  `;
  
  return await dbClient.query(query, [
    activityId,
    PARENT_ACTIVITY_ID_MOLECULE_ID,
    BONUS_RULE_ID_MOLECULE_ID
  ]);
}
```

### Phase 3: Migration Strategy

**Option A: Hard Cutover**
1. Migrate all existing `activity_bonus` records to type 'N' activities
2. Drop `activity_bonus` table
3. Deploy new code

**Option B: Dual Write (Safer)**
1. Write to both systems for 30 days
2. Verify type 'N' system works
3. Stop writing to `activity_bonus`
4. Eventually drop old table

**Option C: New Data Only**
1. Keep old bonuses in `activity_bonus`
2. New bonuses use type 'N'
3. Queries check both sources
4. Migrate old data over time

**Recommendation:** Option B (Dual Write) for safety.

---

## Comparison: Traditional vs Type 'N'

| Aspect | Traditional (activity_bonus table) | Type 'N' (Bonus as Activity) |
|--------|-----------------------------------|------------------------------|
| **Schema** | Separate table with fixed columns | Same table, flexible molecules |
| **Flexibility** | Schema change to add fields | Add molecules, no schema change |
| **Audit Trail** | Separate query to find bonuses | Natural chronological stream |
| **Reversal** | Custom logic per entity type | One pattern for all |
| **Reporting** | Join activity_bonus table | Standard activity queries |
| **Point Lots** | Bonuses share parent's lot | Each bonus has own lot |
| **Expiration** | Same as parent activity | Can differ from parent |
| **Storage** | Smaller (separate table) | Larger (3x activity rows) |
| **Query Complexity** | Simpler member queries | Must filter type != 'N' |
| **Conceptual Model** | Bonuses are special | Everything is an activity |

---

## Future Extensions

### 1. Cascading Bonuses
Bonuses that trigger other bonuses:
```
Activity 123 (Base) → 1000 points
  ├─ Activity 124 (Bonus N) → 500 points (First Class)
  │    └─ Activity 125 (Bonus N) → 50 points (Bonus on bonus!)
  └─ Activity 126 (Bonus N) → 200 points (Summer promo)
```

Type 'N' activities can themselves have child type 'N' activities!

### 2. Bonus Clawbacks
If member doesn't meet requirements (e.g., doesn't complete return flight):
```
Activity 127 (Adjustment A) → -500 points
  └─ activity_detail: parent_activity_id = 124 (bonus being clawed back)
  └─ activity_detail: reason = "Did not complete return flight"
```

### 3. Different Point Types for Bonuses
```
Activity 123 (Base) → 1000 miles
Activity 124 (Bonus N) → 5000 tier_points (different point type!)
```

Each gets its own lot with appropriate expiration rules.

### 4. Marketing Attribution
```
Activity 124 (Bonus N)
  └─ activity_detail: promotion_code = "SUMMER2025"
  └─ activity_detail: campaign_id = 789
  └─ activity_detail: channel = "email"
```

Full marketing analytics without schema changes.

---

## Conclusion

Making bonuses activity type 'N' instead of a separate table aligns perfectly with the molecule architecture philosophy:

**✅ Data-driven behavior**  
**✅ Unlimited flexibility through molecules**  
**✅ One pattern for all entity types**  
**✅ Self-documenting system**  
**✅ Future-proof design**

The tradeoffs (query complexity, storage size) are manageable and worth the architectural benefits.

This design treats bonuses as first-class citizens in the activity stream, not as afterthoughts in a side table. It's conceptually pure, infinitely flexible, and built to last decades.

---

**Status:** Ready for implementation  
**Risk Level:** Medium (requires careful migration)  
**Reward:** High (architectural elegance, unlimited flexibility)  
**Recommendation:** Proceed with dual-write migration strategy
