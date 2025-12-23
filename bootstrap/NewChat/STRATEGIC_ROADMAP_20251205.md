# Loyalty Platform Strategic Roadmap
**Date:** December 5, 2025  
**Status:** Planning Document

---

## Implementation Order

1. Verify activity_id → link refactor complete
2. data5_* table consolidation
3. Sysparm separation
4. Date types (3-byte bigdate, 4-byte datetime)
5. Remove post_date
6. New member molecules (member_tier, member_promotion, promotion_detail)
7. Membership number optimization
8. Investigate activity_date reads
9. activity_date 2-byte conversion

---

## 1. Verify activity_id → link Refactor

**Status:** NOT COMPLETE

**Findings:**
- 88 total references to activity_id in server_db_api.js
- 11 places do `SELECT link FROM activity WHERE activity_id = $1` - translation layer, duplicated
- Still using activity_id for inserts (RETURNING activity_id)
- Still using activity_id in joins and grouping

**Action Required:** Complete the refactor. Consider creating helper to eliminate the 11 duplicated translation queries.

---

## 2. data5_* Table Consolidation

**Current State:**
- activity_detail_1, activity_detail_2, activity_detail_3, activity_detail_4, activity_detail_5, activity_detail_54
- member_detail_2244

**Problem:** Naming is tied to business context (activity vs member), but both use 5-byte parent keys.

**Solution:** Generic naming based on parent key size:

| Old Name | New Name |
|----------|----------|
| activity_detail_1 | data5_1 |
| activity_detail_2 | data5_2 |
| activity_detail_3 | data5_3 |
| activity_detail_4 | data5_4 |
| activity_detail_5 | data5_5 |
| activity_detail_54 | data5_54 |
| member_detail_2244 | data5_2244 |

**Naming Convention:**
- First number = parent key size (bytes)
- Suffix = column structure

Example: `data5_54` means:
- Parent: 5-byte p_link (CHAR(5))
- Columns: 5 + 4 (CHAR(5) + INTEGER)

**Benefits:**
- Molecules can attach to anything with a 5-byte key
- Decoupled from business semantics
- molecule_def.context still identifies what it is (activity, member, tier, promotion)
- Future-proof for new parent entity types

**Future Extension:**
- data4_* tables for 4-byte parent keys
- data3_* tables for 3-byte parent keys

---

## 3. Sysparm Separation

**Status:** IMPLEMENTED - Schema and API complete

**Current State:** Molecules handling both:
1. Data molecules - carrier, origin, fare_class, mqd, member_points, member_point_bucket
2. System config - activity_display (icon, label, color), currency labels, etc.

**Problem:** Molecules pulling double duty complicates the abstraction.

**Solution:** New sysparm tables for configuration:

**sysparm (parent)**
```
sysparm_id      INTEGER PRIMARY KEY (auto-increment)
tenant_id       SMALLINT NOT NULL
sysparm_key     VARCHAR(50) NOT NULL
value_type      VARCHAR(20) NOT NULL -- 'numeric', 'text', 'date', 'boolean'
description     VARCHAR(255)
UNIQUE(tenant_id, sysparm_key)
```

**sysparm_detail (child)**
```
detail_id       INTEGER PRIMARY KEY (auto-increment)
sysparm_id      INTEGER NOT NULL -- FK to sysparm, CASCADE DELETE
category        VARCHAR(50)   -- 'A', 'R', 'N' for activity types (optional)
code            VARCHAR(50)   -- 'icon', 'label', 'color' (optional)
value           TEXT
sort_order      SMALLINT DEFAULT 0
```

**API Endpoints:**
- `GET /v1/sysparms` - List all sysparms for tenant
- `GET /v1/sysparms/:id` - Get sysparm with details
- `GET /v1/sysparms/key/:key` - Get sysparm by key
- `GET /v1/sysparms/key/:key/value` - Get single value (with category/code query params)
- `POST /v1/sysparms` - Create sysparm with details
- `PUT /v1/sysparms/:id` - Update sysparm and replace details
- `DELETE /v1/sysparms/:id` - Delete sysparm (cascades to details)

**Helper Functions:**
- `getSysparmValue(tenantId, key, category, code)` - Get single value, type-coerced
- `getSysparmDetails(tenantId, key)` - Get all details for a key

**Sample Data Added:**
- `membership_number_offset` (numeric) = 2153442000
- `activity_display` (text) with icon/label/color per activity type (A, N, R)

**Next Steps:** Migrate existing embedded list molecules and static config to sysparm tables.

---

## 4. Date Types

### Current: 2-byte date
- storage_size = '2'
- value_type = 'date'
- Epoch: 12/3/1959 = 0
- Range: 0 to 65,535 days (~2138)
- Helpers: dateToMoleculeInt(), moleculeIntToDate()

### New: 3-byte bigdate
- storage_size = '3'
- value_type = 'bigdate'
- Epoch: 12/3/0000 = 0
- Range: 0 to 16,777,215 days (~46,000 AD)
- Use case: Birthdates, historical dates before 1959
- No negative numbers needed
- Helpers: bigdateToInt(), intToBigdate()

### New: 4-byte datetime
- storage_size = '4'
- value_type = 'datetime'
- Epoch: 12/3/2000 00:00:00 = 0
- Precision: 1 second
- Storage: INTEGER with offset encoding (stored = seconds - 2,147,483,648)
- Range: ~136 years → 2136 (matches 2-byte date horizon)
- Use case: Timestamps, audit trails, processing times
- Helpers: datetimeToInt(), intToDatetime()
- No cache needed - integer arithmetic is nanoseconds

---

## 5. Remove post_date

**Current:** activity table has both activity_date and post_date

**Decision:** Remove post_date. Audit trail subsystem will capture this information when implemented.

**Refactor:** Trivial - only 3 references in server_db_api.js.

**Resulting activity table:**
```
activity_id     BIGINT        -- OPEN QUESTION: still needed?
activity_date   DATE
activity_type   CHAR(1)
link            CHAR(5)
p_link          CHAR(5)
```

---

## 6. New Member Molecules

### member_tier
**storage_size = '2222'**

| Position | Size | Column | Type | Purpose |
|----------|------|--------|------|---------|
| 1 | 2 | n1 | key | tier_id (rule) |
| 2 | 2 | n2 | date | start_date |
| 3 | 2 | n3 | date | end_date |
| 4 | 2 | n4 | numeric | ranking |

- Context: member
- p_link = member's link

### member_promotion
**storage_size = '222244'**

| Position | Size | Column | Type | Purpose |
|----------|------|--------|------|---------|
| 1 | 2 | n1 | key | promotion_id (rule) |
| 2 | 2 | n2 | date | enroll_date |
| 3 | 2 | n3 | date | qualify_date |
| 4 | 2 | n4 | date | process_date |
| 5 | 4 | n5 | numeric | goal |
| 6 | 4 | n6 | numeric | counter |

- Context: member
- p_link = member's link
- Has its own link for promotion_detail children

### promotion_detail
**storage_size = '54'**

| Position | Size | Column | Type | Purpose |
|----------|------|--------|------|---------|
| 1 | 5 | c1 | link | activity_link |
| 2 | 4 | n1 | numeric | amount contributed |

- Context: member
- p_link = member_promotion's link

**Hierarchy:**
```
member
  └── member_promotion (p_link = member's link)
        └── promotion_detail (p_link = promotion's link)
```

**Rationale:** If we're already touching all references for link migration, converting to molecules is one surgery instead of two. Consistent architecture with member_point_bucket.

---

## 7. Membership Number Optimization

**Current:** Last used membership number stored in sysparm (e.g., 2153442807)

**Problem:** Large number, general config table hit for sequence generation

**Solution:** Split into offset + counter

**sysparm:** offset value = 2153442000  
**link_tank:** counter = 807

**Membership number = offset + counter**

**Benefits:**
- link_tank counter stays small, tighter storage
- Offset is a business config decision per tenant
- Jump to new range = update sysparm offset
- link_tank already built for atomic sequence generation under load

---

## 8. Investigate activity_date Reads

**Status:** INVESTIGATION COMPLETE

**Findings:**
- 74 total references to activity_date in server_db_api.js
- No common getActivity/fetchActivity helper exists
- Reads are scattered:
  - INSERT INTO activity (activity_date, ...) - writes
  - SELECT a.activity_date - direct DB reads
  - activityData.activity_date - object property access
  - new Date(activityData.activity_date) - conversions
  - Date comparisons for bonus/promotion range checks

**Conclusion:** Need to create a common activity fetch helper, refactor reads to use it, then change storage.

---

## 9. activity_date 2-byte Conversion

**Depends on:** Section 8 investigation

**Strategy:**
1. Create date wrapper helper
2. Refactor all activity_date reads to use helper
3. Change storage to 2-byte
4. Downstream code receives Date objects, never knows storage changed

---

## Open Questions

1. ~~Is activity_id → link refactor complete?~~ **NO - 88 references remain**
2. Should activity_id remain on activity table?
3. ~~activity_date read patterns - common helper or scattered?~~ **Scattered - need to create helper**

---

## Summary Table

| Item | Complexity | Dependencies | Status |
|------|------------|--------------|--------|
| Verify activity_id refactor | Investigation | None | **DONE - 88 refs remain** |
| data5_* consolidation | Medium | None | Pending |
| Sysparm separation | Medium | None | **DONE - schema + API** |
| Date types (bigdate, datetime) | Low | None | Pending |
| Remove post_date | Trivial | None | Pending |
| member_tier molecule | Medium | data5_* | Pending |
| member_promotion molecule | Medium | data5_* | Pending |
| promotion_detail molecule | Medium | member_promotion | Pending |
| Membership number optimization | Low | Sysparm | Pending |
| Investigate activity_date | Investigation | None | **DONE - scattered, need helper** |
| activity_date conversion | High | Create helper first | Pending |
