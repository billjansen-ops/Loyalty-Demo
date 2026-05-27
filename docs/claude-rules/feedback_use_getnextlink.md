---
name: Links — the Pointers key system
description: How links work, why they exist, and the ONE rule — always use getNextLink()
type: feedback
---

## What Links Are

Links are the internal primary keys that hold every core table together. They are the "Pointers" in the platform name. Every table uses the same naming convention:
- **link** = primary key ("who am I")
- **p_link** = parent link ("who owns me")

## How Link Encoding Works

The goal is **maximum key space in minimum bytes**. Link size depends on the column's byte width:

| Bytes | Data Type | Encoding | Max Keys | Examples |
|-------|-----------|----------|----------|---------|
| 1 | CHAR(1) | Base-127 squished | 127 | fare_class, activity_type, status codes |
| 2 | SMALLINT | Numeric, offset by -32768 | 65,535 | carriers, airports, states |
| 3 | CHAR(3) | Base-127 squished | 16.5M | flight_number, medium lookups |
| 4 | INTEGER | Numeric, offset by -2147483648 | 4.2B | stability_registry, future entities |
| 5 | CHAR(5) | Base-127 squished | 1T+ | member.link, activity.link |
| 8 | BIGINT | Raw counter (no encoding) | 9.2E18 | membership_number generation |

**Odd bytes (1, 3, 5) → CHAR with squish encoding (base-127, +1 offset to eliminate null bytes)**
**Even bytes (2, 4) → Numeric types with negative offset to use full signed range**
**8 bytes → Raw BIGINT, no encoding**

## The ONE Rule

**ALWAYS call `getNextLink(tenantId, tableKey)` and use whatever it returns. Period.**

- Don't look at the column type and try to figure out the encoding
- Don't allocate with MAX(link)+1 or hardcoded values
- Don't INSERT into link_tank directly
- Don't reason about whether a link is "a string" or "a number" — getNextLink handles it
- The caller doesn't need to know or care about the encoding — that's the whole point

`getNextLink()` lives in `get_next_link.js` (shared module). It:
1. Atomically increments the counter in link_tank (SELECT FOR UPDATE)
2. Auto-discovers column type from schema on first call
3. Returns the properly encoded value (squished CHAR or offset numeric)
4. Handles race conditions

## Where Links Live

`link_tank` table — one row per table_key, tracks next_link counter and link_bytes.

## Repeated Mistakes (Session 97, 99, 100)

- Used MAX(link)+1 in db_migrate instead of getNextLink → corrupted link_tank
- Declared activity_link as INTEGER when it's CHAR(5) → silent insert failures
- Tried to reason about link encoding instead of just calling the function
- Created stability_registry with INTEGER link, then got confused about whether it was "a link" or "a number" — it IS a link, getNextLink returns an integer for 4-byte tables, that's just how 4-byte links work

**Stop thinking. Call getNextLink. Use the result.**
