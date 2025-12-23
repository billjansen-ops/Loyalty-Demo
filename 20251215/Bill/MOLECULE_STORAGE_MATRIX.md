# Molecule Storage Matrix

**Design Date:** 2025-12-02  
**Designer:** Bill Jansen  
**Origin:** "I designed this in my sleep" - 40 years of loyalty systems distilled into optimal storage

## The Problem

The original embedded molecule approach stored multi-value data as separate rows:

**member_point_bucket** (4 values × 4 rows):
```
| value_id | molecule_id | context_id | row_num | col | value |
|----------|-------------|------------|---------|-----|-------|
| 491      | 41          | 2153442807 | 1       | A   | 2     | (rule_id)
| 492      | 41          | 2153442807 | 1       | C   | 1344  | (accrued)
| 493      | 41          | 2153442807 | 1       | D   | 0     | (redeemed)
| 494      | 41          | 2153442807 | 1       | E   | 24865 | (expire_date)
```

**member_points** (2 values × 2 rows):
```
| value_id | molecule_id | context_id | row_num | col | value |
|----------|-------------|------------|---------|-----|-------|
| 501      | 42          | 12345      | 1       | A   | 491   | (bucket_id)
| 502      | 42          | 12345      | 1       | B   | 500   | (amount)
```

**Cost per first activity using a bucket:**
- 6 rows × ~56 bytes each = **336 bytes**
- Every column stored as BIGINT (8 bytes) regardless of actual need
- Massive waste for small values like rule_id

## The Solution

A comprehensive storage matrix that:
1. Right-sizes every value to its actual domain
2. Uses native types where beneficial
3. Packs multiple values into single rows
4. Self-describes schema via table naming convention

---

## Part 1: Storage Tiers

Five storage tiers based on byte count:

| Bytes | Storage Type | Max Value | Notes |
|-------|--------------|-----------|-------|
| 1 | CHAR(1) base-127 | 127 | squish encoding |
| 2 | SMALLINT | 65,536 | native type, better indexing |
| 3 | CHAR(3) base-127 | 2,048,383 | squish encoding |
| 4 | INTEGER | 4,294,967,296 | native type, better indexing |
| 5 | CHAR(5) base-127 | 33,038,369,407 | squish encoding |

**Hybrid Approach:**
- 1, 3, 5 bytes: Base-127 squish in CHARACTER fields (no native type exists)
- 2, 4 bytes: Native SMALLINT/INTEGER (better indexing, arithmetic, no encode/decode)

---

## Part 2: Base-127 Encoding (Squish)

**The Problem:** Null bytes (x'00') corrupt character data in many systems.

**The Solution:** Encode in base-127 with +1 offset. Every byte is 1-127, never 0, never 128+.

```javascript
// squish - number to CHARACTER (big-endian for correct sorting)
function squish(value, bytes) {
  const chars = [];
  let remaining = value;
  for (let i = 0; i < bytes; i++) {
    chars.unshift(String.fromCharCode((remaining % 127) + 1));
    remaining = Math.floor(remaining / 127);
  }
  return chars.join('');
}

// unsquish - CHARACTER back to number
function unsquish(buffer) {
  let value = 0;
  for (let i = 0; i < buffer.length; i++) {
    value = value * 127 + (buffer.charCodeAt(i) - 1);
  }
  return value;
}
```

**Big-endian** ensures squished values sort correctly: `squish(1) < squish(100) < squish(1000)`

---

## Part 3: Value Types

Six value types, each with specific storage and return behavior:

### link
**Purpose:** Primary key for a table  
**Sizes:** All 5  
**Returns:** Native type (CHAR for 1,3,5 / numeric for 2,4)  
**Storage:** Squish for 1,3,5 / Offset from MIN for 2,4  

The returned value matches the target table's PK column type.

### key
**Purpose:** Foreign key reference to external table  
**Sizes:** All 5  
**Returns:** Always numeric (positive integer)  
**Storage:** Squish for 1,3,5 / Offset from MIN for 2,4  

Caller gets a simple number; storage is right-sized.

### numeric
**Purpose:** Signed values for calculations  
**Sizes:** 2 and 4 only  
**Returns:** Signed numeric  
**Range:** -32,768 to +32,767 (2 byte) / -2.1B to +2.1B (4 byte)  

Used for: accrued miles, redeemed points, adjustments.

### code
**Purpose:** Positive identifiers, no calculations  
**Sizes:** All 5  
**Returns:** Numeric (positive)  
**Range:** 0 to max for tier  

Used for: flight_number, confirmation codes, sequence numbers.

### date
**Purpose:** Calendar dates  
**Sizes:** 2 bytes only  
**Storage:** SMALLINT  
**Range:** Days since December 3, 1959 (~179 years)  

Used for: activity_date, expire_date, start_date, end_date.

### bigdate
**Purpose:** Dates before 1959 OR datetime with precision  
**Sizes:** 3 bytes only  
**Storage:** CHAR(3) squish  
**Range:** Extended dates OR datetime at 1/10 minute precision  

Used for: Historical dates, timestamps requiring time component.

---

## Part 4: The Complete Matrix

| Bytes | Storage | link | key | numeric | code | date | bigdate |
|-------|---------|------|-----|---------|------|------|---------|
| 1 | CHAR(1) | ✓ → CHAR(1) | ✓ → numeric | — | ✓ → numeric | — | — |
| 2 | SMALLINT | ✓ → SMALLINT | ✓ → numeric | ✓ signed | ✓ → numeric | ✓ | — |
| 3 | CHAR(3) | ✓ → CHAR(3) | ✓ → numeric | — | ✓ → numeric | — | ✓ |
| 4 | INTEGER | ✓ → INTEGER | ✓ → numeric | ✓ signed | ✓ → numeric | — | — |
| 5 | CHAR(5) | ✓ → CHAR(5) | ✓ → numeric | — | ✓ → numeric | — | — |

**Capacity Reference:**

| Bytes | Max Value | Use Cases |
|-------|-----------|-----------|
| 1 | 127 | fare_class, cabin, activity_type, tier, status |
| 2 | 65,536 | carriers, airports, states, partners, dates |
| 3 | 2,048,383 | cities, postal codes, bigdate/datetime |
| 4 | 4,294,967,296 | point amounts, large counters |
| 5 | 33,038,369,407 | member.link, activity.link |

---

## Part 5: Multi-Column Detail Tables

Instead of one-row-per-value, we create purpose-built tables with multiple typed columns.

### Naming Convention

Table name encodes the schema: `{context}_detail_{column_sizes}`

**Examples:**
- `activity_detail_1` → single CHAR(1) column
- `activity_detail_5` → single CHAR(5) column
- `activity_detail_54` → CHAR(5) + INTEGER columns
- `member_detail_2244` → SMALLINT + SMALLINT + INTEGER + INTEGER columns

The name IS the schema. Code can parse "2244" and know exactly what columns exist.

### Base Detail Tables (Single Column)

| Table | Value Column | Use Case |
|-------|--------------|----------|
| activity_detail_1 | CHAR(1) | fare_class, cabin |
| activity_detail_2 | SMALLINT | carrier, airport, date |
| activity_detail_3 | CHAR(3) | cities, bigdate |
| activity_detail_4 | INTEGER | point amounts |
| activity_detail_5 | CHAR(5) | cross-references |

### Composite Detail Tables (Multiple Columns)

Created as needed for specific molecule combinations:

**activity_detail_54** (for member_points molecule):
```sql
CREATE TABLE activity_detail_54 (
  detail_id BIGINT PRIMARY KEY,
  activity_id BIGINT NOT NULL,      -- p_link
  molecule_id INTEGER NOT NULL,
  col_5 CHAR(5),                     -- bucket link
  col_4 INTEGER                      -- amount
);
```

**member_detail_2244** (for member_point_bucket molecule):
```sql
CREATE TABLE member_detail_2244 (
  detail_id BIGINT PRIMARY KEY,
  member_id BIGINT NOT NULL,        -- p_link (or use CHAR(5) link)
  molecule_id INTEGER NOT NULL,
  col_2a SMALLINT,                   -- rule_id (key)
  col_2b SMALLINT,                   -- expire_date (date)
  col_4a INTEGER,                    -- accrued (numeric)
  col_4b INTEGER                     -- redeemed (numeric)
);
```

---

## Part 6: The Transformation

### Before (Embedded Row Storage)

**First activity using a new bucket:**

member_point_bucket (4 rows):
- Row header + value_id(8) + molecule_id(4) + context_id(8) + row_num(4) + col(1) + value(8) 
- ~56 bytes × 4 rows = **224 bytes**

member_points (2 rows):
- ~56 bytes × 2 rows = **112 bytes**

**Total: 336 bytes**

### After (Matrix Storage)

**member_detail_2244** (1 row for bucket):
- detail_id(8) + member_id(8) + molecule_id(4) + rule_id(2) + expire_date(2) + accrued(4) + redeemed(4)
- **~32 bytes** (including header)

**activity_detail_54** (1 row for points):
- detail_id(8) + activity_id(8) + molecule_id(4) + bucket_link(5) + amount(4)
- **~29 bytes** (including header)

**Total: ~61 bytes** for first activity

But wait - subsequent activities on same bucket only add activity_detail_54:
- **~29 bytes** per additional activity

### Storage Reduction

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| First activity + bucket | 336 bytes | 61 bytes | **82%** |
| Subsequent activity | 112 bytes | 29 bytes | **74%** |

At 100 million activities: **~10 GB saved**

---

## Part 7: Performance Benefits

### Fewer Rows
- Before: 6 rows for first activity
- After: 2 rows for first activity
- Fewer index entries, faster inserts, faster queries

### Native Types
- SMALLINT and INTEGER use native PostgreSQL operations
- No encode/decode for arithmetic
- Native indexing for 2 and 4 byte columns

### Single-Row Access
- Fetch one row, get all values
- No assembly from multiple rows
- Simpler queries, faster execution

### Right-Sized Indexes
- Index on SMALLINT: 2 bytes per entry
- Index on CHAR(5): 5 bytes per entry
- vs. BIGINT indexes: 8 bytes per entry everywhere

---

## Part 8: Implementation Notes

### Molecule Definition
molecule_def will specify:
- `storage_size`: 1, 2, 3, 4, or 5
- `value_type`: link, key, numeric, code, date, bigdate
- For composite molecules: column definitions with size and type per column

### Helper Functions
- `squish(value, bytes)` → CHAR string
- `unsquish(buffer)` → number
- `getNextLink(tenantId, tableKey)` → native type based on table's link size
- `encodeValue(value, size, type)` → storage format
- `decodeValue(stored, size, type)` → application format

### Table Creation
Tables created on demand. When a new composite molecule is defined (e.g., "2244"), the system creates `{context}_detail_2244` if it doesn't exist.

---

## Summary

The Molecule Storage Matrix transforms molecule storage from a bloated one-size-fits-all approach to a precision-engineered system where:

1. **Every byte is intentional** - storage tier matches data domain
2. **Types are meaningful** - link, key, numeric, code, date, bigdate
3. **Tables self-describe** - name encodes schema
4. **Performance is optimal** - native types, single rows, right-sized indexes

**From 336 bytes to 61 bytes. From 6 rows to 2 rows. Same flexibility. Much faster.**

*"Everything is pointers, everything is right-sized, data drives behavior."*
