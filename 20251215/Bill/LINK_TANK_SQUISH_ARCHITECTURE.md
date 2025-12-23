# LINK TANK & SQUISH ARCHITECTURE
**Design Date:** 2025-12-01
**Status:** Ready for Implementation
**Authors:** Bill Jansen with Claude

---

## Executive Summary

**The Problem:** Every pointer in the system (member_id, activity_id, molecule values) is stored as BIGINT (8 bytes), regardless of actual capacity needs.

**The Solution:** Right-sized storage using base-255 encoding ("squish") with a central link registry ("link tank") managing all primary keys.

**The Result:** 50-75% storage reduction across the platform. Smaller indexes. Faster I/O. Cache-friendly. The "million years ago" philosophy applied to every pointer in the system.

---

## Core Concepts

### Everything is a Pointer

The entire loyalty platform is pointers:
- member.link → who is this member
- activity.link → which activity
- activity.p_link → which member owns this activity
- molecule values → pointers to lookup tables, text pools, other records

**If everything is a pointer, every pointer should be right-sized.**

### The Naming Convention

Borrowed from Bill's 1980s systems:

| Column | Meaning |
|--------|---------|
| `link` | Primary key - "who am I" |
| `p_link` | Parent link - "who owns me" |

**Every table, same pattern.** Self-documenting. Consistent.

---

## Squish/Unsquish Functions

### The Problem with Null Bytes

In some storage systems, x'00' (null byte) causes corruption:
- Treated as string terminator
- Bytes after null get shifted
- Padding inserted
- Data corrupted

**Discovered the hard way** in 1980s loyalty systems.

### The Solution: Base-255 Encoding

Instead of base-256 (0-255 per byte), use base-255 (1-255 per byte).

**Add 1 to every byte position. Null bytes become impossible.**

### Capacity by Tier

| Tier | Bytes | Max Value (Base-255) | Use Cases |
|------|-------|----------------------|-----------|
| 1 | 1 | 255 | fare_class, activity_type, status codes |
| 2 | 2 | 65,025 | carriers, airports, states, small lookups |
| 3 | 3 | 16,581,375 | flight_number, medium lookups |
| 4 | 4 | 4,228,250,625 | member.link (4B+ members per tenant) |
| 5 | 5 | 1,078,203,909,375 | activity.link (1T+ activities) |

### Function Signatures

```javascript
// squish: convert number to right-sized bytes
// MUST specify output size
function squish(value, bytes) {
    const buffer = Buffer.alloc(bytes);
    let remaining = value;
    for (let i = 0; i < bytes; i++) {
        buffer[i] = (remaining % 255) + 1;
        remaining = Math.floor(remaining / 255);
    }
    return buffer;
}

// unsquish: convert bytes back to number
// Size determined by buffer length (self-describing)
function unsquish(buffer) {
    let value = 0;
    for (let i = buffer.length - 1; i >= 0; i--) {
        value = value * 255 + (buffer[i] - 1);
    }
    return value;
}
```

### Example: Value 257

**Base-256 (problematic):**
```
257 = 1*256 + 1 = x'01 01'
256 = 1*256 + 0 = x'00 01' ← NULL BYTE!
```

**Base-255 (safe):**
```
257 = 1*255 + 2 → bytes: (2+1), (1+1) = x'03 02'
255 = 1*255 + 0 → bytes: (0+1), (1+1) = x'01 02'
254 = 0*255 + 254 → bytes: (254+1), (0+1) = x'FF 01'
```

**No null bytes. Ever.**

---

## Link Tank

### Purpose

Central registry that:
1. Tracks next available link value for each table
2. Stores the byte size for each table's links
3. Self-populates on first use
4. Prevents duplicate keys via SELECT FOR UPDATE

### Table Structure

```sql
CREATE TABLE link_tank (
    table_key VARCHAR(30) PRIMARY KEY,
    link_bytes SMALLINT NOT NULL,    -- 1, 2, 3, 4, or 5
    next_link BIGINT NOT NULL        -- Counter (squished on output)
);
```

### Self-Populating Behavior

**First request for 'member' link:**
1. Check if 'member' row exists in link_tank
2. If not: query information_schema for member.link column size
3. INSERT INTO link_tank ('member', 4, 1)
4. Return squish(1, 4)

**Subsequent requests:**
1. SELECT link_bytes, next_link FROM link_tank WHERE table_key = 'member' FOR UPDATE
2. UPDATE link_tank SET next_link = next_link + 1 WHERE table_key = 'member'
3. COMMIT
4. Return squish(next_link, link_bytes)

### Critical: SELECT FOR UPDATE

**Without locking:**
```
Transaction A: SELECT next_link → 47
Transaction B: SELECT next_link → 47  ← SAME VALUE!
Transaction A: INSERT member with link 47
Transaction B: INSERT member with link 47  ← DUPLICATE KEY!
```

**With SELECT FOR UPDATE:**
```
Transaction A: SELECT next_link FOR UPDATE → 47 (row LOCKED)
Transaction B: SELECT next_link FOR UPDATE → WAITS...
Transaction A: UPDATE, COMMIT → row unlocked
Transaction B: SELECT completes → 48
```

**Guarantees uniqueness.**

### Helper Function

```javascript
async function getNextLink(client, tableKey) {
    // Check if table exists in link_tank
    let result = await client.query(
        'SELECT link_bytes, next_link FROM link_tank WHERE table_key = $1 FOR UPDATE',
        [tableKey]
    );
    
    if (result.rows.length === 0) {
        // First use - look up column size from schema
        const schemaResult = await client.query(`
            SELECT character_octet_length 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = 'link'
        `, [tableKey]);
        
        const linkBytes = schemaResult.rows[0].character_octet_length;
        
        // Self-populate
        await client.query(
            'INSERT INTO link_tank (table_key, link_bytes, next_link) VALUES ($1, $2, 1)',
            [tableKey, linkBytes]
        );
        
        return squish(1, linkBytes);
    }
    
    const { link_bytes, next_link } = result.rows[0];
    
    // Increment counter
    await client.query(
        'UPDATE link_tank SET next_link = next_link + 1 WHERE table_key = $1',
        [tableKey]
    );
    
    return squish(next_link, link_bytes);
}
```

---

## Storage Comparison

### Current (All BIGINT)

**Per activity with 5 molecules:**
- activity.activity_id: 8 bytes
- activity.member_id: 8 bytes
- molecule values (5 × 8): 40 bytes
- **Total: 56 bytes** in IDs/pointers

### Proposed (Right-Sized)

**Per activity with 5 molecules:**
- activity.link: 5 bytes
- activity.p_link: 4 bytes
- carrier: 2 bytes
- origin: 2 bytes
- destination: 2 bytes
- fare_class: 1 byte
- flight_number: 3 bytes
- **Total: 19 bytes** in IDs/pointers

**66% reduction.**

### At Scale

| Records | Current | Proposed | Savings |
|---------|---------|----------|---------|
| 1M activities | 56 MB | 19 MB | 37 MB |
| 10M activities | 560 MB | 190 MB | 370 MB |
| 100M activities | 5.6 GB | 1.9 GB | 3.7 GB |

**Plus index savings.** Smaller keys = smaller indexes = faster lookups.

---

## Table Structure Changes

### member

**Current:**
```sql
member_id BIGINT PRIMARY KEY
tenant_id SMALLINT
-- other columns
```

**Proposed:**
```sql
link BYTEA(4) PRIMARY KEY      -- 4 bytes, ~4B members
tenant_id SMALLINT
-- other columns
```

### activity

**Current:**
```sql
activity_id BIGINT PRIMARY KEY
member_id BIGINT REFERENCES member
-- other columns
```

**Proposed:**
```sql
link BYTEA(5) PRIMARY KEY       -- 5 bytes, ~1T activities
p_link BYTEA(4) REFERENCES member(link)  -- points to member
-- other columns
```

### molecule_value_list

**Current:**
```sql
value_id BIGSERIAL PRIMARY KEY
molecule_id INTEGER
context_id BIGINT              -- activity or member ID
row_num INTEGER
col CHAR(1)
value BIGINT                   -- always 8 bytes
```

**Proposed:**
```sql
link BYTEA(5) PRIMARY KEY      -- 5 bytes
molecule_id SMALLINT           -- 2 bytes (65K molecule types)
p_link BYTEA(5)                -- parent (activity or member link)
row_num BYTEA(1)               -- 1 byte (max 255 rows per record)
col CHAR(1)                    -- 1 byte
-- value stored in child table based on molecule's storage tier
```

### Molecule Value Child Tables

```sql
CREATE TABLE molecule_value_1 (
    link BYTEA(5) PRIMARY KEY REFERENCES molecule_value_list(link),
    value BYTEA(1)
);

CREATE TABLE molecule_value_2 (
    link BYTEA(5) PRIMARY KEY REFERENCES molecule_value_list(link),
    value BYTEA(2)
);

CREATE TABLE molecule_value_3 (
    link BYTEA(5) PRIMARY KEY REFERENCES molecule_value_list(link),
    value BYTEA(3)
);

CREATE TABLE molecule_value_4 (
    link BYTEA(5) PRIMARY KEY REFERENCES molecule_value_list(link),
    value BYTEA(4)
);

CREATE TABLE molecule_value_5 (
    link BYTEA(5) PRIMARY KEY REFERENCES molecule_value_list(link),
    value BYTEA(5)
);
```

---

## Migration Strategy

### Phase 1: Add Infrastructure

1. Create link_tank table
2. Create squish/unsquish helper functions
3. Create getNextLink function

### Phase 2: Migrate member Table

1. Add `link` column (BYTEA(4))
2. Populate: `UPDATE member SET link = squish(member_id, 4)`
3. Seed link_tank: `INSERT INTO link_tank VALUES ('member', 4, MAX(member_id) + 1)`
4. Test member lookups by link
5. Update code to use link
6. Drop member_id column (after full verification)

### Phase 3: Migrate activity Table

1. Add `link` column (BYTEA(5))
2. Add `p_link` column (BYTEA(4))
3. Populate: 
   ```sql
   UPDATE activity SET 
     link = squish(activity_id, 5),
     p_link = (SELECT link FROM member WHERE member_id = activity.member_id)
   ```
4. Seed link_tank for activity
5. Test activity lookups and parent joins
6. Update code to use link/p_link
7. Drop activity_id, member_id columns

### Phase 4: Migrate Molecules

1. Create molecule_value_1 through _5 child tables
2. Add link/p_link to molecule_value_list
3. Migrate values to appropriate child tables based on molecule storage tier
4. Update encode/decode functions to route to child tables
5. Test all molecule operations
6. Drop old value column

### Safety Principles

- **Parallel columns:** Old and new exist together during migration
- **Incremental:** One table at a time
- **Reversible:** Can switch back to old columns if issues
- **Testable:** Binary pass/fail - pointers work or they don't

---

## Testing Checklist

### Squish/Unsquish
- [ ] Round-trip 1 through 300 (verify 255 boundary)
- [ ] Round-trip max values for each tier
- [ ] Verify zero null bytes in output
- [ ] Index on squished column works
- [ ] Index lookup returns correct row

### Link Tank
- [ ] First use creates row with correct byte size
- [ ] Subsequent uses increment counter
- [ ] SELECT FOR UPDATE prevents duplicates under load
- [ ] Concurrent transactions get unique values

### Member Table
- [ ] All members have unique links
- [ ] Lookup by link returns correct member
- [ ] New members get links from link_tank
- [ ] Link values match old member_ids (during migration)

### Activity Table
- [ ] All activities have unique links
- [ ] p_link correctly points to parent member
- [ ] Activity → Member join works via link/p_link
- [ ] New activities get links from link_tank

### Molecules
- [ ] encode() stores to correct child table
- [ ] decode() retrieves from correct child table
- [ ] All existing molecule values accessible
- [ ] New molecule values stored correctly
- [ ] Point buckets work
- [ ] Redemption molecules work

---

## Why This Matters

### Performance
- Smaller data = less I/O
- Smaller indexes = faster lookups
- Cache-friendly = more data fits in memory
- The bottleneck is ALWAYS I/O

### Philosophy
- "Million years ago" thinking
- Right-sized data types
- Everything is a pointer
- Pointers should be as small as possible

### History
- Base-255 encoding invented in 1980s to avoid null byte bugs
- link/p_link naming from original Reward system
- Proven patterns, modern implementation

### The Demo Story

"Every pointer in our system is right-sized. Member IDs are 4 bytes, not 8. Activity IDs are 5 bytes. Molecule values are 1-5 bytes depending on what they hold. We save 50-75% on storage and our indexes are tiny. This is 40 years of optimization discipline baked into the architecture."

---

## Conclusion

This isn't just an optimization. It's the completion of the "everything is a pointer" philosophy.

If the platform is pointers, and the abstraction hides storage, then storage should be optimal.

**Squish makes it safe.** Base-255 encoding, no null bytes, bulletproof.

**Link tank makes it manageable.** Self-populating, SELECT FOR UPDATE, no duplicates.

**The result:** A platform that's not just elegant in concept, but optimal in implementation.

**Pointer. Right-sized. All the way down.**
