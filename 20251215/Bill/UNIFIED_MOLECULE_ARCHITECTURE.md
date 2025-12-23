# UNIFIED MOLECULE ARCHITECTURE
**Design Date:** 2025-11-28
**Status:** Approved - Ready for Implementation
**Author:** Bill Jansen with Claude

---

## Executive Summary

**The Insight:** Points, promotions, tiers, and all member state are THE SAME PATTERN - molecules and pointers.

**The Result:** An entire loyalty platform reduced to:
- Definitions (what CAN exist)
- Member state (molecules)
- Activity relationships (molecules)
- Pointers connecting everything

**Two core tables handle everything:**
- `member_detail_list` - All member state (point buckets, promo enrollments, tier status)
- `activity_detail_list` - All activity relationships (points earned/redeemed, promo contributions)

This is 40 years of loyalty system experience distilled into one unified architecture.

---

## The Evolution

**Molecules v1:** Store codes, decode for display (carrier = "DL" → "Delta Air Lines")

**Molecules v2:** Activity attributes are molecules (origin, destination, fare_class)

**Molecules v3:** Member state is molecules. Activity relationships are molecules. EVERYTHING is molecules.

The abstraction evolved until it became the entire system.

---

## Core Principles

1. **Everything is a pointer** - Numbers pointing to other numbers
2. **Everything is a molecule** - One pattern handles all cases
3. **Lazy creation** - Rows created on first use, not pre-populated
4. **Hybrid state** - Stored values for safety, molecules for elegance
5. **Two tables** - member_detail_list + activity_detail_list handle everything

---

## Table Architecture

### Core Tables (What Remains)

```sql
-- Tenants
CREATE TABLE tenant (
    tenant_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_name VARCHAR(100) NOT NULL
);

-- Members (now tiny)
CREATE TABLE member (
    member_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activities (now tiny)
CREATE TABLE activity (
    activity_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES member(member_id),
    activity_date DATE NOT NULL,
    post_date DATE NOT NULL,
    activity_type CHAR(1) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Molecule Definitions
CREATE TABLE molecule_def (
    molecule_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    molecule_key VARCHAR(50) NOT NULL,
    value_kind VARCHAR(20) NOT NULL,  -- 'static', 'dynamic', 'dynamic_list'
    context VARCHAR(20) NOT NULL,      -- 'member', 'activity', 'system'
    system_required BOOLEAN DEFAULT false,
    description VARCHAR(255),
    UNIQUE(tenant_id, molecule_key)
);

-- Molecule Column Definitions (for dynamic_list molecules)
CREATE TABLE molecule_column_def (
    column_def_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    column_name VARCHAR(50) NOT NULL,
    column_type VARCHAR(20) NOT NULL,  -- 'ref', 'numeric', 'date', 'text'
    column_order SMALLINT NOT NULL,
    description VARCHAR(255),
    UNIQUE(molecule_id, column_order)
);
```

### The Two Core Tables

```sql
-- Member State (replaces point_lot, member_promotion, member_tier, and more)
CREATE TABLE member_detail_list (
    detail_list_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES member(member_id),
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    v1 BIGINT,         -- Generic column 1 (meaning defined by molecule)
    v2 BIGINT,         -- Generic column 2
    v3 NUMERIC,        -- Generic column 3
    v4 NUMERIC,        -- Generic column 4
    v5 DATE,           -- Generic column 5
    v6 DATE,           -- Generic column 6
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mdl_member ON member_detail_list(member_id);
CREATE INDEX idx_mdl_member_molecule ON member_detail_list(member_id, molecule_id);

-- Activity Relationships (replaces redemption_detail, member_promotion_detail, activity points)
CREATE TABLE activity_detail_list (
    detail_list_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(activity_id),
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    v1 BIGINT,         -- Generic column 1 (typically bucket_id pointer)
    v2 NUMERIC,        -- Generic column 2 (typically amount)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_adl_activity ON activity_detail_list(activity_id);
CREATE INDEX idx_adl_bucket ON activity_detail_list(v1);  -- For finding activities by bucket
```

### Definition/Lookup Tables (Keep These)

```sql
-- Point Rules (expiration definitions)
CREATE TABLE point_rule (
    rule_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    rule_code VARCHAR(20) NOT NULL,
    rule_name VARCHAR(100),
    expire_date DATE,
    point_type VARCHAR(10) DEFAULT 'RDM',
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, rule_code)
);

-- Promotion Definitions
CREATE TABLE promotion (
    promotion_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    promotion_code VARCHAR(20) NOT NULL,
    promotion_name VARCHAR(100),
    count_type VARCHAR(20),      -- 'flights', 'miles', 'segments'
    goal_amount NUMERIC,
    reward_type VARCHAR(20),     -- 'points', 'tier', 'external'
    reward_value NUMERIC,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, promotion_code)
);

-- Tier Definitions
CREATE TABLE tier_def (
    tier_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    tier_code VARCHAR(20) NOT NULL,
    tier_name VARCHAR(100),
    tier_rank SMALLINT,
    qualification_points INTEGER,
    qualification_segments INTEGER,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, tier_code)
);
```

### Tables Eliminated

- **point_lot** - Replaced by member_detail_list (point_bucket molecule)
- **redemption_detail** - Replaced by activity_detail_list (points molecule)
- **member_promotion** - Replaced by member_detail_list (promo_bucket molecule)
- **member_promotion_detail** - Replaced by activity_detail_list (promo_contrib molecule)
- **member_tier** (if existed) - Replaced by member_detail_list (tier_bucket molecule)
- **point_amount on activity** - Replaced by activity_detail_list
- **lot_id on activity** - Replaced by activity_detail_list

---

## System-Required Molecules

These molecules are required for the platform to function:

### Point Bucket (Member Molecule)

**Purpose:** Tracks point balance by expiration rule (replaces point_lot)

```
molecule_key: 'point_bucket'
value_kind: 'dynamic_list'
context: 'member'
system_required: true

Columns:
  v1: rule_id (ref to point_rule)
  v2: (unused)
  v3: accrued (numeric)
  v4: redeemed (numeric)
  v5: expire_date (date)
  v6: (unused)
```

**Example data in member_detail_list:**

| detail_list_id | member_id | molecule_id | v1 (rule) | v3 (accrued) | v4 (redeemed) | v5 (expire) |
|----------------|-----------|-------------|-----------|--------------|---------------|-------------|
| 501 | 123 | 50 | 1 | 2000 | 2000 | 2025-12-31 |
| 502 | 123 | 50 | 2 | 1000 | 500 | 2026-12-31 |

### Points (Activity Molecule)

**Purpose:** Links activity to point bucket with amount (replaces lot_id, point_amount, redemption_detail)

```
molecule_key: 'points'
value_kind: 'dynamic_list'
context: 'activity'
system_required: true

Columns:
  v1: bucket_id (ref to member_detail_list.detail_list_id)
  v2: amount (numeric, positive=earn, negative=redeem)
```

**Example data in activity_detail_list:**

| detail_list_id | activity_id | molecule_id | v1 (bucket_id) | v2 (amount) |
|----------------|-------------|-------------|----------------|-------------|
| 901 | 45 | 51 | 501 | +1000 |
| 902 | 46 | 51 | 501 | +1000 |
| 903 | 47 | 51 | 502 | +1000 |
| 904 | 99 | 51 | 501 | -2000 |
| 905 | 99 | 51 | 502 | -500 |

### Promo Bucket (Member Molecule)

**Purpose:** Tracks promotion enrollment and progress (replaces member_promotion)

```
molecule_key: 'promo_bucket'
value_kind: 'dynamic_list'
context: 'member'
system_required: true

Columns:
  v1: promotion_id (ref to promotion)
  v2: (unused)
  v3: progress (numeric - counter toward goal)
  v4: (unused)
  v5: enrolled_date (date)
  v6: qualify_date (date, null until qualified)
```

**Example data in member_detail_list:**

| detail_list_id | member_id | molecule_id | v1 (promo) | v3 (progress) | v5 (enrolled) | v6 (qualify) |
|----------------|-----------|-------------|------------|---------------|---------------|--------------|
| 601 | 123 | 52 | 5 | 2 | 2025-01-01 | null |

### Promo Contribution (Activity Molecule)

**Purpose:** Links activity to promo bucket with contribution (replaces member_promotion_detail)

```
molecule_key: 'promo_contrib'
value_kind: 'dynamic_list'
context: 'activity'
system_required: true

Columns:
  v1: bucket_id (ref to member_detail_list promo_bucket row)
  v2: amount (numeric, contribution to progress)
```

**Example data in activity_detail_list:**

| detail_list_id | activity_id | molecule_id | v1 (bucket_id) | v2 (amount) |
|----------------|-------------|-------------|----------------|-------------|
| 1001 | 45 | 53 | 601 | +1 |
| 1002 | 46 | 53 | 601 | +1 |

### Tier Bucket (Member Molecule)

**Purpose:** Tracks tier status with dates (replaces member_tier)

```
molecule_key: 'tier_bucket'
value_kind: 'dynamic_list'
context: 'member'
system_required: true

Columns:
  v1: tier_id (ref to tier_def)
  v2: (unused)
  v3: (unused)
  v4: (unused)
  v5: start_date (date)
  v6: end_date (date)
```

**Example data in member_detail_list:**

| detail_list_id | member_id | molecule_id | v1 (tier) | v5 (start) | v6 (end) |
|----------------|-----------|-------------|-----------|------------|----------|
| 701 | 123 | 54 | 3 | 2025-01-01 | 2025-12-31 |

---

## How It All Works

### Accrual Flow (Flight Earns Points)

1. **Activity created** (thin record):
   ```sql
   INSERT INTO activity (member_id, activity_date, post_date, activity_type)
   VALUES (123, '2025-06-15', '2025-06-15', 'A')
   RETURNING activity_id;  -- Returns 45
   ```

2. **Determine point rule:**
   ```sql
   SELECT rule_id, expire_date FROM point_rule
   WHERE tenant_id = 1 AND is_active = true
   AND expire_date > CURRENT_DATE;  -- Returns rule_id=2, expire=2026-12-31
   ```

3. **Find or create member point bucket:**
   ```sql
   SELECT detail_list_id FROM member_detail_list
   WHERE member_id = 123 AND molecule_id = 50 AND v1 = 2;
   
   -- If not found (lazy creation):
   INSERT INTO member_detail_list (member_id, molecule_id, v1, v3, v4, v5)
   VALUES (123, 50, 2, 0, 0, '2026-12-31')
   RETURNING detail_list_id;  -- Returns 502
   ```

4. **Update bucket accrued:**
   ```sql
   UPDATE member_detail_list
   SET v3 = v3 + 1000, updated_at = CURRENT_TIMESTAMP
   WHERE detail_list_id = 502;
   ```

5. **Create activity points molecule:**
   ```sql
   INSERT INTO activity_detail_list (activity_id, molecule_id, v1, v2)
   VALUES (45, 51, 502, 1000);
   ```

6. **Create other activity molecules** (carrier, origin, destination, etc.):
   ```sql
   INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id)
   VALUES (45, 10, 1),   -- carrier = DL
          (45, 11, 5),   -- origin = MSP
          (45, 12, 12);  -- destination = LAX
   ```

### Redemption Flow (Member Redeems 2,500 Points)

1. **Activity created:**
   ```sql
   INSERT INTO activity (member_id, activity_date, post_date, activity_type)
   VALUES (123, '2025-06-20', '2025-06-20', 'R')
   RETURNING activity_id;  -- Returns 99
   ```

2. **Find buckets with available points (FIFO by expire_date):**
   ```sql
   SELECT detail_list_id, v1 as rule_id, v5 as expire_date,
          (v3 - v4) as available
   FROM member_detail_list
   WHERE member_id = 123 AND molecule_id = 50 AND (v3 - v4) > 0
   ORDER BY v5 ASC;
   ```
   
   Returns:
   | detail_list_id | rule_id | expire_date | available |
   |----------------|---------|-------------|-----------|
   | 501 | 1 | 2025-12-31 | 2000 |
   | 502 | 2 | 2026-12-31 | 1000 |

3. **Consume FIFO (2,500 needed):**
   
   Bucket 501: Take 2,000 (all available)
   ```sql
   UPDATE member_detail_list SET v4 = v4 + 2000 WHERE detail_list_id = 501;
   ```
   
   Bucket 502: Take 500 (partial)
   ```sql
   UPDATE member_detail_list SET v4 = v4 + 500 WHERE detail_list_id = 502;
   ```

4. **Create activity points molecules (negative amounts):**
   ```sql
   INSERT INTO activity_detail_list (activity_id, molecule_id, v1, v2)
   VALUES (99, 51, 501, -2000),
          (99, 51, 502, -500);
   ```

### Reversal Flow (Delete Redemption)

1. **Find redemption molecules:**
   ```sql
   SELECT v1 as bucket_id, v2 as amount
   FROM activity_detail_list
   WHERE activity_id = 99 AND molecule_id = 51;
   ```
   
   Returns:
   | bucket_id | amount |
   |-----------|--------|
   | 501 | -2000 |
   | 502 | -500 |

2. **Reverse each bucket:**
   ```sql
   UPDATE member_detail_list SET v4 = v4 - 2000 WHERE detail_list_id = 501;
   UPDATE member_detail_list SET v4 = v4 - 500 WHERE detail_list_id = 502;
   ```

3. **Delete activity molecules:**
   ```sql
   DELETE FROM activity_detail_list WHERE activity_id = 99;
   DELETE FROM activity_detail WHERE activity_id = 99;
   ```

4. **Delete activity:**
   ```sql
   DELETE FROM activity WHERE activity_id = 99;
   ```

### Balance Query

**Total balance:**
```sql
SELECT SUM(v3 - v4) as balance
FROM member_detail_list
WHERE member_id = 123 AND molecule_id = 50;
```

**Point summary by expiration:**
```sql
SELECT 
    v5 as expire_date,
    v3 as accrued,
    v4 as redeemed,
    (v3 - v4) as available,
    CASE WHEN v5 >= CURRENT_DATE THEN 'Active' ELSE 'Expired' END as status
FROM member_detail_list
WHERE member_id = 123 AND molecule_id = 50
ORDER BY v5;
```

### Promotion Flow

1. **Enroll member (lazy creation):**
   ```sql
   INSERT INTO member_detail_list (member_id, molecule_id, v1, v3, v5)
   VALUES (123, 52, 5, 0, '2025-01-01')
   RETURNING detail_list_id;  -- Returns 601
   ```

2. **Activity contributes:**
   ```sql
   -- Update progress
   UPDATE member_detail_list SET v3 = v3 + 1 WHERE detail_list_id = 601;
   
   -- Record contribution
   INSERT INTO activity_detail_list (activity_id, molecule_id, v1, v2)
   VALUES (45, 53, 601, 1);
   ```

3. **Check qualification:**
   ```sql
   SELECT mdl.v3 as progress, p.goal_amount
   FROM member_detail_list mdl
   JOIN promotion p ON mdl.v1 = p.promotion_id
   WHERE mdl.detail_list_id = 601;
   
   -- If v3 >= goal_amount, update qualify_date:
   UPDATE member_detail_list SET v6 = CURRENT_DATE WHERE detail_list_id = 601;
   ```

---

## Member Attributes as Molecules (Optional Extension)

Member table can become even thinner:

```sql
CREATE TABLE member (
    member_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

All other attributes become single-value member molecules in `member_detail`:

```sql
CREATE TABLE member_detail (
    member_id BIGINT NOT NULL,
    molecule_id INTEGER NOT NULL,
    v_ref_id BIGINT,
    PRIMARY KEY (member_id, molecule_id)
);
```

| member_id | molecule_key | v_ref_id |
|-----------|--------------|----------|
| 123 | fname | 5001 (→ text pool "William") |
| 123 | lname | 5002 (→ text pool "Jansen") |
| 123 | state | 24 (→ state lookup "MN") |
| 123 | status | 1 (→ status lookup "Active") |

**The entire platform becomes:**
- Everything about a member = molecules
- Everything about an activity = molecules
- Pointers connecting everything

---

## Implementation Phases

### Phase 1: Schema Creation

1. Create `molecule_column_def` table
2. Create `member_detail_list` table
3. Create `activity_detail_list` table
4. Add system-required molecule definitions
5. Add column definitions for each molecule

### Phase 2: Point System Migration

1. Create `point_bucket` and `points` molecules
2. Update activity posting to use molecules
3. Update balance queries
4. Update point summary page
5. Test accruals thoroughly

### Phase 3: Redemption Migration

1. Update redemption posting to use molecules
2. FIFO from member_detail_list
3. Multiple bucket consumption creates multiple rows
4. Test redemptions and reversals

### Phase 4: Promotion Migration

1. Create `promo_bucket` and `promo_contrib` molecules
2. Update promotion enrollment
3. Update contribution tracking
4. Update qualification checking
5. Test full promotion lifecycle

### Phase 5: Tier Migration

1. Create `tier_bucket` molecule
2. Update tier assignment
3. Update get_member_tier_on_date function
4. Test tier queries

### Phase 6: Cleanup

1. Remove old tables:
   - point_lot
   - redemption_detail
   - member_promotion
   - member_promotion_detail
2. Remove old columns:
   - activity.point_amount
   - activity.lot_id
3. Update all remaining code references

### Phase 7: Testing

Full regression testing:
- [ ] Accrual creates bucket if needed
- [ ] Accrual updates existing bucket
- [ ] Activity points molecule created
- [ ] Balance query correct
- [ ] Point summary displays correctly
- [ ] Redemption FIFO works
- [ ] Multi-bucket redemption works
- [ ] Reversal restores buckets correctly
- [ ] Promotion enrollment works
- [ ] Promotion contribution tracking works
- [ ] Promotion qualification works
- [ ] Tier assignment works
- [ ] Tier temporal queries work

---

## Key Code Locations to Modify

**server_db_api.js:**
- Activity posting endpoint
- Redemption posting endpoint
- Balance calculation
- Point summary endpoint
- Promotion enrollment
- Promotion contribution
- Promotion qualification
- Tier assignment
- Reversal logic

**HTML Pages:**
- member-header.js (balance display)
- point-summary.html
- add_activity.html
- add_redemption.html
- promotions pages
- tier pages

---

## Helper Functions Needed

```javascript
// Get or create point bucket for member/rule
async function getOrCreatePointBucket(memberId, ruleId, expireDate, tenantId) {
    // Check if exists
    // If not, create (lazy)
    // Return detail_list_id
}

// Get member point balance
async function getPointBalance(memberId, tenantId) {
    // SUM(v3 - v4) from member_detail_list WHERE molecule = point_bucket
}

// Get point summary by expiration
async function getPointSummary(memberId, tenantId) {
    // Return rows with expire_date, accrued, redeemed, available
}

// Consume points FIFO
async function consumePoints(memberId, amount, tenantId) {
    // Find buckets with available > 0, ORDER BY expire_date
    // Consume oldest first
    // Return array of {bucket_id, amount_consumed}
}

// Get or create promo bucket
async function getOrCreatePromoBucket(memberId, promotionId, tenantId) {
    // Check if exists
    // If not, create (lazy)
    // Return detail_list_id
}

// Increment promo progress
async function incrementPromoProgress(bucketId, amount) {
    // UPDATE v3 = v3 + amount
    // Check if qualified
    // Return qualified status
}
```

---

## Performance Notes

**Indexes are key:**
- `member_detail_list(member_id, molecule_id)` - Fast bucket lookup
- `member_detail_list(v5)` - FIFO by expire_date (for point buckets)
- `activity_detail_list(activity_id)` - Fast activity molecule lookup
- `activity_detail_list(v1)` - Find activities by bucket_id (for reversals)

**Row counts:**
- member_detail_list: ~5-20 rows per member (buckets across features)
- activity_detail_list: 1-5 rows per activity (points + promo contributions)
- With proper indexes: sub-millisecond queries

**Generic columns (v1, v2, etc.):**
- BIGINT and NUMERIC cover all use cases
- Molecule definition tells app what each column means
- No performance penalty vs named columns

---

## The Architecture Summary

**What exists:**

| Table | Purpose |
|-------|---------|
| tenant | Who |
| member | Just IDs |
| activity | Just IDs + date + type |
| molecule_def | What molecules exist |
| molecule_column_def | What columns each molecule has |
| member_detail | Single-value member attributes |
| member_detail_list | Multi-row member state |
| activity_detail | Single-value activity attributes |
| activity_detail_list | Multi-row activity relationships |
| point_rule | Expiration definitions |
| promotion | Promotion definitions |
| tier_def | Tier definitions |
| (lookups) | carrier, airport, etc. |

**What it handles:**

- Points (earn, redeem, balance, expiration)
- Promotions (enroll, track, qualify)
- Tiers (assign, track, temporal queries)
- Any future feature (just add molecules)

**The pattern:**

1. Member has bucket molecules (state)
2. Activities have relationship molecules (pointers + amounts)
3. Definitions tell what molecules mean
4. Pointers connect everything
5. Two tables handle all state and relationships

---

## Why This Works

1. **One pattern** - Everything is molecules. No special cases.

2. **Hybrid safety** - Stored values (accrued/redeemed) make deletes safe.

3. **Lazy creation** - No empty rows. Row existing IS the event.

4. **Flexible** - Add point types, promo types, anything - same structure.

5. **Fast** - Proper indexes. Numbers and pointers. Cache-friendly.

6. **Teachable** - "Molecules and pointers." That's the whole platform.

---

## The Demo Story

"Our entire loyalty platform is two tables and pointers. Points, promotions, tiers - same pattern. Need a new feature? Add a molecule. That's it."

"By the way, while I've been showing you this, we've processed 400 transactions per second in the background. On my laptop."

---

## Delta Dating (Future Enhancement)

When needed, add member_point_rule table:

```sql
CREATE TABLE member_point_rule (
    member_rule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id BIGINT NOT NULL,
    rule_id INTEGER NOT NULL,
    expire_date DATE,  -- UPDATABLE
    UNIQUE(member_id, rule_id)
);
```

Point buckets point to member_rule_id instead of rule_id. One update extends all points.

**Deferred until needed.**

---

## Conclusion

This design emerged from first-principles thinking:

- What IS a loyalty platform? Members and activities.
- What IS member state? Buckets tracking progress.
- What ARE activity relationships? Pointers to buckets with amounts.
- What's the pattern? Same for points, promotions, tiers.
- What's the simplest structure? Two tables. Pointers.

**40 years of experience led to this moment.**

The entire loyalty industry, all the complexity, all the millions spent on systems with dozens of special-purpose tables...

**Reduced to molecules and pointers.**

---

## Ready to Build

Upload this document to a new chat session and say:

"Let's implement the Unified Molecule Architecture."

The new Claude will have everything needed to begin.
