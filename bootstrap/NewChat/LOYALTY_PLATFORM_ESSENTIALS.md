# LOYALTY PLATFORM ESSENTIALS

**Purpose:** Rules and patterns to prevent Claude from breaking things. Implementation details live in the code itself.

---

# 0. SESSION START

## ⚠️ FILE READING — TRUNCATION FIX
The `view` tool truncates files over ~16,000 characters, showing the beginning and end but cutting the middle. Both this file and the Master doc WILL truncate. **This is normal — do not panic, loop, or tell Bill to start a new chat.** Use `view_range` to read in chunks of ~400 lines:
```
view path=".../file.md" view_range=[1, 400]
view path=".../file.md" view_range=[401, 800]
view path=".../file.md" view_range=[801, 1200]
```

## Step 1: Read This Document
You're reading it now. Understand sections 1-8 before writing any code.

## Step 2: Extract and Read Tar File
Once Bill uploads the tar file:
```bash
cd /home/claude
tar -xzf /mnt/user-data/uploads/loyalty_handoff_*.tar.gz
mv loyalty_handoff_* loyalty-demo
```

Then read the database state:
```bash
# Schema - table structures, constraints, functions
cat /home/claude/loyalty-demo/database/schema_snapshot.sql

# Data - read SELECTIVELY (never cat the whole file - it contains binary squish data
# that is extremely token-heavy and will crash the session mid-read)
grep -A 20 "Data for Name: tenant;" /home/claude/loyalty-demo/database/data_snapshot.sql
grep -A 20 "Data for Name: point_type;" /home/claude/loyalty-demo/database/data_snapshot.sql
grep -A 20 "Data for Name: adjustment;" /home/claude/loyalty-demo/database/data_snapshot.sql
grep -A 20 "Data for Name: tier_definition;" /home/claude/loyalty-demo/database/data_snapshot.sql
grep -A 20 "Data for Name: molecule_def;" /home/claude/loyalty-demo/database/data_snapshot.sql
```

**The data snapshot shows you actual current state:** tenants, point types, adjustments, tiers, and molecule definitions. The `5_data_*` tables contain binary-encoded squish data — do NOT cat those sections. Query the live database if you need member/activity detail.

**WARNING:** Catting `data_snapshot.sql` wholesale will consume massive tokens on binary data and crash the session mid-read. Always use targeted greps.

## Step 2b: Identify Yourself
State which Claude model you are at the start of the session. Example: "I am Claude Opus 4.6" or "I am Claude Sonnet 4.6." Bill uses this to decide whether to continue or switch models before investing time in the session.

## Step 3: Verify Context with ATIS
Ask Bill: **"What is the current ATIS information?"**

Bill will respond with a code word (e.g., "alpha", "zulu"). This verifies your conversation history is working. ATIS = Automated Terminal Information Service (borrowed from aviation).

## Step 4: SESSION_HANDOFF.md (If Present)
Bill will only upload SESSION_HANDOFF.md if there is work-in-progress. It contains:
- What we're in the middle of
- Next immediate step
- Uncommitted changes

If no SESSION_HANDOFF.md, you're starting fresh on whatever Bill needs.

## Step 5: Confirm Understanding
Demonstrate you absorbed the knowledge:

"Boot sequence complete. I understand:
- Temporal-first design: [brief explanation]
- Molecule system: [dynamic/reference types]
- Multi-tenant isolation: [how tenant_id works]
- Current tenants: [from data snapshot]
- ATIS: [code word]

Ready to work."

---

# 1. CRITICAL RULES

## Database Connection
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty
```

## NEVER Do These Things

1. **NEVER write direct SQL against molecule tables** - Always use helper functions
2. **NEVER raw JOIN to member_tier** - Always use `get_member_current_tier()` helper
3. **NEVER hardcode what should come from database**
4. **NEVER assume table/column structure** - Check schema first
5. **NEVER guess at function parameters** - Look at existing working examples
6. **NEVER start coding without reading schema**
7. **NEVER trust old SQL files as templates** - Schema evolves, verify current structure
8. **NEVER build UI without full CRUD** - Include delete with confirmation
9. **NEVER give multiple options when asked for ONE thing**
10. **NEVER over-explain simple requests** - Direct answers, not essays

## ALWAYS Do These Things

1. **ALWAYS use helper functions** for molecules, tiers, encoding
2. **ALWAYS check existing patterns** before implementing similar features
3. **ALWAYS trace working examples** (like PASSPORT for text molecules)
4. **ALWAYS verify data format** before applying transformations
5. **ALWAYS declare variables before use** in JavaScript
6. **ALWAYS read what Bill actually writes** - don't misinterpret

---

# 2. MOLECULE SYSTEM

The core abstraction layer enabling tenant-specific, industry-agnostic data management.

## CRITICAL RULE: NO DIRECT SQL

**NEVER write SQL directly against molecule storage tables.** Always use helper functions.

**WHY:** The molecule system handles encoding, table routing, and value_type-specific behavior. Direct SQL bypasses this and WILL break data.

**WRONG:**
```javascript
// NEVER DO THIS
await dbClient.query(`
  SELECT c1 FROM 5_data_5 WHERE p_link = $1 AND molecule_id = $2
`, [activityLink, moleculeId]);
```

**RIGHT:**
```javascript
// ALWAYS use helpers
const values = await getAllActivityMoleculeValuesById(null, moleculeId, activityLink);
const value = await getActivityMoleculeValueById(null, moleculeId, activityLink);
```

---

## Storage Architecture

### Unified Data Tables

Table naming pattern: `{link_bytes}_data_{storage_size}`
- First part = parent's link size in bytes (currently 5 for both members and activities)
- Second part = value storage pattern

**Current tables (5-byte parent links):**
```sql
5_data_0    (p_link CHAR(5), molecule_id SMALLINT, attaches_to CHAR(1))  -- FLAG: presence = true
5_data_1    (p_link CHAR(5), molecule_id SMALLINT, c1 CHAR(1), attaches_to CHAR(1))
5_data_2    (p_link CHAR(5), molecule_id SMALLINT, n1 SMALLINT, attaches_to CHAR(1))
5_data_3    (p_link CHAR(5), molecule_id SMALLINT, c1 CHAR(3), attaches_to CHAR(1))
5_data_4    (p_link CHAR(5), molecule_id SMALLINT, n1 INTEGER, attaches_to CHAR(1))
5_data_5    (p_link CHAR(5), molecule_id SMALLINT, c1 CHAR(5), attaches_to CHAR(1))
5_data_22   (p_link CHAR(5), molecule_id SMALLINT, attaches_to CHAR(1), n1 SMALLINT, n2 SMALLINT)
5_data_54   (p_link CHAR(5), molecule_id SMALLINT, c1 CHAR(5), n1 INTEGER, attaches_to CHAR(1))
5_data_222  (p_link CHAR(5), molecule_id SMALLINT, attaches_to CHAR(1), n1 SMALLINT, n2 SMALLINT, n3 SMALLINT)
```

**Flag Molecules (storage_size='0'):**
The `5_data_0` table stores flag molecules - boolean flags where row presence = true, absence = false. No value column. Example: `is_deleted` molecule marks soft-deleted records.

**Key columns:**
- `p_link` - Parent link (activity or member's 5-byte link)
- `attaches_to` - What this row IS attached to ('A' or 'M')
- `molecule_id` - Which molecule definition

**Why attaches_to is needed:** The same p_link value could exist as both an activity link and a member link. The attaches_to column distinguishes which entity this row belongs to.

### Base-127 Encoding (Squish)

For CHAR columns (sizes 1, 3, 5), values are encoded in base-127:
- Each byte holds values 1-127 (never 0, never 128+)
- Big-endian: MSB first, so strings sort in numeric order
- No null bytes that could corrupt character data

```javascript
squish(value, bytes)   // Number → CHAR string
unsquish(buffer)       // CHAR string → Number
```

### Numeric Columns (Sizes 2, 4)

For SMALLINT and INTEGER columns, encoding depends on `value_type`:

**Offset encoding (link, key, code):**
- These are always positive (IDs, foreign keys, flight numbers)
- Store as: `value - 32768` (2-byte) or `value - 2147483648` (4-byte)
- Read as: `stored + offset`
- Doubles usable positive range (0 to 65,535 for SMALLINT)

**Raw storage (numeric, date):**
- These can be negative (point adjustments, corrections)
- Store and read as-is
- Full signed range: -32,768 to +32,767 (SMALLINT)

### ⚠️ CRITICAL: When to Use `key` vs `numeric` for 2/4-byte Molecules

**Getting this wrong causes overflow errors or corrupted data. This was a real Session 76 bug.**

- **`key`** = Source value is a POSITIVE number from an external table (SERIAL IDs like airport_id=1589, property_id=7). The helper applies offset encoding to shift it into negative storage range. On read, offset is reversed to return the original positive ID.

- **`numeric`** = Source value is ALREADY a link_tank value (starts at -2147483648 for INTEGER, -32768 for SMALLINT). These are already full-range. Pass through as-is — NO offset. Also use for any user-entered signed number (point amounts, MQD).

**Example — CORRECT: ORIGIN (storage_size=2, value_type=key)**
airports.airport_id = 1589 → stored as 1589-32768 = -31179 → read back as 1589 ✓

**Example — CORRECT: MEMBER_SURVEY_LINK (storage_size=4, value_type=numeric)**
member_survey.link = -2147483643 (from link_tank) → stored as -2147483643 → read back as -2147483643 ✓

**Example — WRONG: MEMBER_SURVEY_LINK with value_type=key**
-2147483643 - 2147483648 = -4294967291 → OVERFLOWS INTEGER → crash ✗

**Quick rule: Look at the source table's primary key. SERIAL → key. Link_tank → numeric.**

### ⚠️ CRITICAL: Molecule Admin UI — Column Types (Session 82)

The admin UI (admin_molecule_edit.html) was simplified in Session 82. The column type dropdown now has 6 options:

| UI Type | value_type | value_kind | scalar_type | Notes |
|---------|-----------|------------|-------------|-------|
| Numeric Value | numeric | value | numeric | Raw numbers (flight_number, MQD) |
| Date | date | value | numeric | 2-byte Bill epoch |
| Database Reference (Pass Through) | numeric | external_list | numeric | Link_tank PKs — no offset |
| Database Reference (Offset) | key | external_list | null | SERIAL PKs — offset encoding |
| Internal List | code | internal_list | null | Predefined 1-byte values |
| Indexed Text | key | value | text | Deduplicated text pool |
| Unindexed Text | key | value | text_direct | Direct text storage |

**Database Reference** always shows lookup table fields (table_name, key_column, code_column). For 2/4 byte widths, shows Storage Mode radio: Pass Through (default) or Offset. For 1/3/5 byte widths, locked on Pass Through.

**CRITICAL: value_kind and scalar_type must be set.** Without these, encodeMolecule() silently fails. The UI now auto-derives them from the column type. If a molecule has NULL value_kind or scalar_type, fix with SQL and restart server.

### ⚠️ CRITICAL: text_direct Double-Encoding Bug (Session 82 Fix)

**Bug:** createAccrualActivity's encoding loop called encodeMolecule() on ALL molecules, including text_direct. For text_direct, encodeMolecule() inserts text into molecule_text and returns a text_id. Then insertActivityMolecule() sees scalar_type='text_direct' and calls encodeMolecule() AGAIN on the text_id number, inserting e.g. "128" as new text.

**Fix:** In createAccrualActivity, text_direct molecules skip encodeMolecule() and pass raw text through to insertActivityMolecule(), which handles the full encode-and-store:
```javascript
const mol = caches.moleculeDefById.get(molecule_id);
if (mol && mol.scalar_type === 'text_direct') {
  encodedMolecules[molecule_key] = value; // pass raw text
} else {
  encodedMolecules[molecule_key] = await encodeMolecule(...);
}
```

### ⚠️ Date Storage Consistency

ALL dates in the platform use 2-byte Bill epoch SMALLINT (days since Dec 3, 1959, offset by -32768). Never use PostgreSQL DATE type for new tables. Server converts with moleculeIntToDate() + formatDateLocal() before sending to frontend. Never use PostgreSQL date functions (molecule_int_to_date) for client-facing data.

---

## molecule_def Columns Reference

| Column | Type | Purpose |
|--------|------|---------|
| molecule_id | SMALLINT | Primary key |
| tenant_id | SMALLINT | Tenant isolation |
| molecule_key | TEXT | Lookup key (e.g., 'carrier', 'origin') |
| attaches_to | VARCHAR(10) | What this molecule CAN attach to: 'A', 'M', or 'AM' |
| storage_size | SMALLINT | Table routing: 0, 1, 2, 4, 5, 54, 222, etc. |
| value_type | VARCHAR(10) | 'link', 'key', 'numeric', 'code', 'composite' |
| value_kind | TEXT | 'external_list', 'internal_list', 'value', 'lookup', 'reference' |
| scalar_type | TEXT | For value kind: 'text', 'numeric', 'char', 'text_direct' |
| molecule_type | CHAR(1) | 'D'=Dynamic, 'R'=Reference |
| value_structure | VARCHAR(20) | 'single' or 'embedded' |

### attaches_to Values

| Value | Meaning | Examples |
|-------|---------|----------|
| 'A' | Activity only | carrier, origin, destination, flight_number |
| 'M' | Member only | member_point_bucket, tier |
| 'AM' | Both activity and member | partner (earnings on activity, affiliations on member) |

### value_type Meanings

| value_type | Storage Behavior | Return Behavior |
|------------|------------------|-----------------|
| link | Raw bytes (for FK lookup) | CHAR string as-is (for queries) |
| key | Encoded number | Decoded to positive integer |
| numeric | Raw signed value | Signed integer |
| code | Encoded positive number | Decoded to positive integer |
| composite | Multi-column molecule | Look at molecule_value_lookup for per-column types |

---

## Helper Functions Reference

### Low-Level Storage Helpers

**getMoleculeStorageInfo(tenantId, moleculeKey)**
Returns: `{ moleculeId, context, storageSize, valueType, tableName, columns }`

**insertMoleculeRow(pLink, moleculeKey, values, tenantId)**
Inserts a row with proper encoding. Returns detail_id if applicable.

**getMoleculeRows(pLink, moleculeKey, tenantId)**
Returns all rows for a molecule, decoded. Array of objects with column names (C1, N1, etc.)

**findMoleculeRow(pLink, moleculeKey, keyValues, tenantId)**
Find row matching specific column values. Returns decoded row or null.

**incrementMoleculeColumn(moleculeKey, colName, amount, where, tenantId)**
Atomic increment of numeric column. Used for point bucket updates.

**deleteAllMoleculeRowsForLink(pLink, context)**
Deletes from ALL detail tables for a link. Used when deleting activities.

### Activity Molecule Helpers

**getActivityMoleculeValueById(activityId, moleculeId, link)**
Get single value by molecule_id. Returns decoded value or raw bytes for links.

**getAllActivityMoleculeValuesById(activityId, moleculeId, link)**
Get ALL values for multi-row molecules (e.g., bonus_activity_link). Returns array.

**getAllActivityMolecules(activityId, tenantId, link)**
Get all molecules for an activity as key-value pairs. Used for display.

**insertActivityMolecule(activityId, moleculeId, value, client, link)**
Insert single molecule value. Handles encoding based on molecule_def.

### Member Molecule Helpers

Member molecules use the same low-level helpers as activity molecules. Use `getMoleculeRows()` and `insertMoleculeRow()` with the member's link and appropriate attaches_to value ('M').

### Bulk Molecule Helpers (Session 94)

For queries that need molecule values across many members or activities in a single operation. **Use these instead of direct SQL against molecule tables.**

**bulkGetMoleculeValues(moleculeKey, pLinks, tenantId, attachesTo)**
Get a single molecule's decoded value for many parent links. Returns Map of pLink → decoded value (first column). Use for: "get carrier for all these activities."

**bulkGetCompositeValues(moleculeKey, pLinks, tenantId, attachesTo)**
Get a composite molecule's decoded values for many parent links. Returns Map of pLink → { N1: decoded, N2: decoded, ... }. Use for: "get PARTNER_PROGRAM for all members."

**bulkCheckFlag(moleculeKey, pLinks, tenantId, attachesTo)**
Check if a flag molecule (storage_size=0) is set for many parent links. Returns Set of pLinks that have the flag. Use for: "which of these activities are soft-deleted."

**getMoleculeJoinSQL(tenantId, moleculeKey)**
Get table name, molecule_id, and column info for building bulk queries. Returns { tableName, moleculeId, valueColumn, columns, attachesTo }. Use when the bulk helpers above don't fit your query shape — but still go through this helper to get correct table/column routing.

### Point System Helpers

**findOrCreatePointBucket(memberLink, ruleId, expireDate, tenantId)**
Finds existing bucket or creates new one. Returns bucket link (CHAR(5)).

**updatePointBucketAccrued(bucketLink, amount)**
Add points to bucket's accrued column. Amount can be negative for reversals.

**saveActivityPoints(activityId, bucketLink, amount, tenantId, link)**
Record points on activity (member_points molecule in 5_data_54).

**getActivityPoints(activityId, tenantId, link)**
Get total points for an activity.

### Encode/Decode Helpers

**encodeMolecule(tenantId, moleculeKey, value, columnOrder = 1)**
Convert display value to storage ID (e.g., 'DL' → carrier_id 4). For composite molecules, pass `columnOrder` (1-based) to target the correct column's lookup table.

**decodeMolecule(tenantId, moleculeKey, id, columnOrCategory)**
Convert storage ID to display value (e.g., carrier_id 4 → 'DL').

---

## CREATING A NEW MOLECULE — REQUIRED PROCEDURE

### Single-Column Molecule
1. `POST /v1/molecules` — create molecule_def (storage_size = single digit e.g. `2`, `5`)
2. `PUT /v1/molecules/:id/column-definitions` — MANDATORY. Writes context/attaches_to to molecule_value_lookup. Do NOT use lookup-config — it does not write these fields.
3. `PUT /v1/member/:id/molecules` — assign value using code_column value (e.g. `'MN'` not `27`)

### Composite Molecule (Two-Table Rule)
A composite molecule stores multiple values in a single row using a multi-digit storage_size (e.g. `22` = two SMALLINTs, `222` = three SMALLINTs).

**Step 0: Create the storage table if it doesn't exist**
The table `5_data_{pattern}` must exist before the molecule can be used.
```bash
curl -X POST http://127.0.0.1:4001/v1/storage-tables -H "Content-Type: application/json" -d '{"pattern":"22"}'
```
This is a one-time admin operation. Check first — returns 409 if already exists.

**Step 1: Create molecule_def with composite storage_size**
```javascript
POST /v1/molecules
{ storage_size: 22, value_kind: 'external_list', ... }
```

**Step 2: Set column-definitions — one entry per column**
```javascript
PUT /v1/molecules/:id/column-definitions
{ columns: [
  { column_order: 1, table_name: 'partner', id_column: 'partner_id', code_column: 'partner_code', ... },
  { column_order: 2, table_name: 'partner_program', id_column: 'program_id', code_column: 'program_code', ... }
]}
```

**Step 3: Assign to member using array value**
```javascript
PUT /v1/member/:id/molecules
{ molecules: { PARTNER_PROGRAM: ['HLTHPTNRS', 'HP-LAKEVIEW'] }, tenant_id: 5 }
```
Array order must match column_order. Each element is the code_column value for that column's lookup table.

### Getting Selection Lists for Composite Molecules
Use `column_order` param (default=1, backward compatible with all single-column molecules):
```
GET /v1/lookup-values/PARTNER_PROGRAM?tenant_id=5&column_order=1  → partner list
GET /v1/lookup-values/PARTNER_PROGRAM?tenant_id=5&column_order=2  → program list
```

### Critical Rules
- **NEVER use lookup-config endpoint** — does not write context/attaches_to to molecule_value_lookup
- **column-definitions endpoint is mandatory** — getMoleculeStorageInfo() reads context/attaches_to from molecule_value_lookup, NOT molecule_def
- **Encoder always takes code_column value** — pass `'HP-LAKEVIEW'` not `13`
- **New storage tables require explicit creation** — `POST /v1/storage-tables` before first use

**dateToMoleculeInt(date)**
Convert Date to days since Dec 3, 1959.

**moleculeIntToDate(num)**
Convert days since Dec 3, 1959 to Date.

### Link Helpers

**getNextLink(tenantId, tableKey)**
Get next squished link value for a table. Atomic, auto-initializes.

---

## Common Patterns

### Reading Activity Data for Display
```javascript
const molecules = await getAllActivityMolecules(activityId, tenantId, activityLink);
// molecules = { carrier: 'DL', origin: 'MSP', flight_number: 1234, ... }
```

### Reading Multi-Value Molecules
```javascript
// For molecules that can have multiple values per parent (like bonus_activity_link)
const bonusLinks = await getAllActivityMoleculeValuesById(null, bonusActivityLinkMoleculeId, activityLink);
// Returns array of raw link bytes
```

### Writing Activity Molecules
```javascript
// Insert single value
await insertActivityMolecule(activityId, carrierId, encodedCarrier, dbClient, activityLink);

// For multi-column molecules, use molecule rows
await insertMoleculeRow(activityLink, 'member_points', [bucketDetailId, pointAmount], tenantId);
```

### Working with Point Buckets
```javascript
const bucketDetailId = await findOrCreatePointBucket(memberId, ruleId, expireDate, tenantId);
await updatePointBucketAccrued(memberId, bucketDetailId, pointAmount, tenantId);
await saveActivityPoints(activityId, bucketDetailId, pointAmount, tenantId, activityLink);
```

### Point Type Routing
Points route to different bucket types based on source. Use `addPointsToMoleculeBucket()` with context:
```javascript
// Context determines which point_type_id lookup to use
await addPointsToMoleculeBucket(memberLink, activityDate, points, tenantId, {
  accrual_type: 'base',      // Uses point_type molecule on activity
  // OR
  accrual_type: 'partner',
  program_id: programId,     // Looks up partner_program.point_type_id
  // OR  
  accrual_type: 'bonus',
  bonus_id: bonusId,         // Looks up bonus.point_type_id
  // OR
  accrual_type: 'adjustment',
  adjustment_id: adjustmentId // Looks up adjustment.point_type_id
});
```
The `routePointsToType()` function handles the lookup centrally.

### Deleting Activities (Cascade)
```javascript
await deleteAllMoleculeRowsForLink(activityLink, 'activity');
await dbClient.query('DELETE FROM activity WHERE link = $1', [activityLink]);
```

---

## Key Molecules Reference

| molecule_key | storage_size | value_type | Purpose |
|--------------|--------------|------------|---------|
| carrier | 1 | key | Airline code (FK to carriers table) |
| origin | 2 | key | Origin airport (FK to airports table) |
| destination | 2 | key | Destination airport |
| flight_number | 2 | code | Flight number (numeric, no lookup) |
| fare_class | 1 | code | Fare class code |
| mqd | 4 | numeric | MQD amount (signed integer) |
| member_points | 54 | composite | Points: bucket_link(5) + amount(4) |
| badge | 222 | composite | Badge: badge_id(2) + start_date(2) + end_date(2) |
| bonus_activity_link | 5 | link | Link to child bonus activity |
| bonus_rule_id | 2 | key | FK to bonus table |
| accrual_type | 1 | code | Healthcare accrual type (internal_list: SURVEY, COMP, etc.) |
| member_survey_link | 4 | numeric | FK to member_survey (link_tank value — NOT key!) |
| comp_result | 4 | numeric | FK to compliance_result (link_tank value — NOT key!) |
| pulse_respondent_link | 4 | numeric | FK to pulse_respondent (link_tank value) |
| signal | 2 | key | General purpose signal (FK to signal_type — SERIAL, offset encoding) |

---

## Molecule Types (D/R)

### Dynamic (D)
Per-activity or per-member data. Stored in 5_data_* tables.
Can be used in templates AND rule evaluation.

### Reference (R)
Queries existing data on demand (e.g., member.fname).
Used for rule evaluation only. No storage - derives from source tables.

**Note:** Static (S) was replaced by the sysparm system. Tenant-wide configuration now lives in sysparm_detail, not molecule_def.

---

## Text Molecules (text_direct)

For storing free-form text (like PASSPORT, activity_comment):

- `scalar_type = 'text_direct'`
- `storage_size = 4` (stores text_id reference as INTEGER)
- Text stored in `molecule_text` table
- 5_data_4 stores the text_id reference

**ALWAYS look at PASSPORT implementation before creating text molecules.**

---

## Embedded Lists

For molecules with `value_structure = 'embedded'` (like activity_display):

**Storage:** `molecule_value_embedded_list` table with category/code/description rows.

**Link Column:** Each value gets a 1-byte storage key (chr(1) through chr(127)).
Maximum 127 values per category per molecule.

**Reading:**
```javascript
const value = await getEmbeddedListValue(moleculeKey, category, code, tenantId);
```

**Writing:**
```javascript
await setEmbeddedListValue(moleculeKey, category, code, value, tenantId);
```

---

## Temporal Evaluation

For historical queries (retro-credit processing):

```javascript
const tier = await getMoleculeValue(tenantId, 'member_tier_on_date', { member_id }, activityDate);
```

Date parameter enables "what was X on date Y" queries for proper retroactive processing.

**The key insight:** Activities and bonuses should reflect the state of the world when they occurred, not when they were processed.

---

# 3. TIER LOOKUPS

**RULE:** Never raw JOIN to member_tier. A member can qualify for multiple tiers simultaneously.

**WRONG:**
```sql
LEFT JOIN member_tier mt ON mt.p_link = m.link 
  AND mt.start_date <= CURRENT_DATE
```

**RIGHT:**
```sql
LEFT JOIN LATERAL get_member_current_tier(m.link) tier ON true
```

The helper returns the highest-ranking tier for overlapping records.

---

# 4. ATOM SYSTEM - TEMPLATE VARIABLES

Atoms are dynamic variable substitution tags embedded in text strings that resolve to actual data at runtime.

## The Problem Atoms Solve

**Without atoms:** 
- error = "Member does not have enough miles" (wrong for hotels)
- error = "Member does not have enough points" (wrong for airlines)
- You'd need different messages for every industry and tenant

**With atoms:** 
- error = "Member does not have enough {{M,point_type,label,,L}}"
- Delta renders: "miles", Marriott renders: "points", Gym renders: "credits"
- Same code, different data

## Atom Syntax

```
{{source,identifier,field,length,case}}
```

**Parameters:**
- **source:** M = Molecule, T = Table (direct database lookup)
- **identifier:** molecule_key or table_name
- **field:** Which property to extract (label, code, value)
- **length:** Optional truncation (number or empty)
- **case:** U = UPPERCASE, L = lowercase, P = Proper Case

## Examples

```
{{M,point_type,label}}        → "Miles"
{{M,point_type,label,,L}}     → "miles"
{{M,carrier,code}}            → "DL"
{{T,members,first_name}}      → "Bill"
{{T,members,first_name,,U}}   → "BILL"
{{M,carrier,name,20}}         → "Delta Air Lines" (truncated to 20 chars)
```

## Use Cases

**Error Messages:** 
"Member does not have enough {{M,point_type,label,,L}} for this redemption"

**Personalized Greetings:** 
"Welcome back, {{T,members,first_name,,P}}!"

**Dynamic Headers:** 
"Total {{M,point_type,label,,P}} Earned" → Airlines: "Total Miles Earned", Hotels: "Total Points Earned"

**Activity Displays:** 
"{{M,carrier,code}} {{M,flight_number,value}} from {{M,origin,code}} to {{M,destination,code}}" → "DL 1234 from DFW to ATL"

## Why Atoms Matter

- **Universal Text Templates:** One template works across all tenants and industries
- **Self-Documenting:** {{M,point_type,label,,L}} is crystal clear
- **No String Concatenation:** Format and case rules in the atom, not scattered through code
- **Template Reuse:** Same templates work in error messages, emails, SMS, reports, UI labels

**Code:** `atom_resolve.js`

---

# 5. DATE HANDLING

## Three Date Systems in the Platform

### 1. PostgreSQL DATE Type
- Returned from database as JavaScript Date object or "YYYY-MM-DD" string
- Used in: member.enrollment_date, bonus.start_date, etc.

### 2. Bill Epoch (2-byte SMALLINT)
**Epoch: December 3, 1959 (Bill's birthday)**

- SMALLINT range: -32,768 to 32,767 (65,536 values)
- Date mapping: Dec 3, 1959 = 0
- Coverage: ~1870 to ~2138 (179 years)
- Used in: activity.activity_date, point bucket expiration dates

**Why this epoch:**
- Loyalty programs began 1980s, no need for dates before 1959
- Forward coverage through 2138 (113 years)
- 2 bytes instead of 8 bytes = 75% storage savings

**Conversion Functions:**
```javascript
dateToActivityInt(date)    // JS Date → SMALLINT (days since 1959-12-03)
activityIntToDate(num)     // SMALLINT → JS Date

dateToMoleculeInt(date)    // Same as above, for molecule storage
moleculeIntToDate(num)     // Same as above, for molecule retrieval
```

**PostgreSQL functions:**
```sql
date_to_molecule_int(date)   -- DATE → INTEGER
molecule_int_to_date(integer) -- INTEGER → DATE
```

**Example:**
- 2025-12-06 → 24108 (stored as SMALLINT)
- 24108 → 2025-12-06 (decoded back)

### 3. JavaScript Date Timezone Bug

**The Problem:**
```javascript
// WRONG - interprets as UTC midnight, displays as previous day in Central Time
new Date("2025-12-03")  // Shows as Dec 2 in CST!

// RIGHT - forces local time interpretation
new Date("2025-12-03T00:00:00")  // Shows as Dec 3
```

**CRITICAL: Check data format BEFORE applying fix:**
- If it's already a Date object → don't add T00:00:00
- If it's a full timestamp string → don't add T00:00:00  
- If it's a 10-character "YYYY-MM-DD" string → add T00:00:00
- If it's a Bill epoch integer → use moleculeIntToDate(), don't manipulate directly

**Safe Pattern:**
```javascript
function safeDate(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return moleculeIntToDate(input);
  if (typeof input === 'string' && input.length === 10) {
    return new Date(input + 'T00:00:00');
  }
  return new Date(input);
}
```

## Time Storage - 10-Second Blocks

For timestamps, time-of-day stored as SMALLINT in 10-second blocks:
- 00:00:00 = 0
- 12:00:00 = 4,320
- 23:59:50 = 8,639

Combined with date: 4 bytes total instead of 8 bytes for TIMESTAMP.

---

# 6. LINK TANK

Primary key generation using base-127 encoding (no null bytes).

```javascript
const link = await getNextLink('member');     // Returns 5-byte CHAR
const link = await getNextLink('activity');   // Returns 5-byte CHAR
```

Storage sizes:
- 1 byte: 127 values (fare_class)
- 2 bytes: 65K values (carrier, airport)
- 5 bytes: 1T+ values (member, activity)
- 8 bytes: Raw BIGINT (membership numbers)

---

# 7. ARCHITECTURE PRINCIPLES

## Temporal-First Design
- Point balances derived from transaction history, never stored
- Activities reflect world state when they occurred
- "What was balance on date X?" is a simple query
- Tiers are derived from points, not stored as status fields

## Multi-Tenant Isolation
- `tenant_id` on every table
- `app_current_tenant_id()` for session-based filtering
- RLS enabled on member table

## Data Drives Behavior
- Business rules in database, not code
- Molecule values configure behavior
- No hardcoded logic that should be configurable

## Zero Batch Processing
- Calculate on-demand, don't precompute
- No nightly jobs, data is never stale
- Point balance = query, not stored value

## Everything Is Pointers
- Store IDs that reference shared data, never duplicate text
- Right-sized data types (CHAR(2) for states, not VARCHAR(255))
- Cache-friendly, memory-efficient

## Verticals Folder Architecture (Session 94)

Three-level file serving for industry-specific pages:

```
loyalty-demo/              (core platform — admin, CSR, shared JS/CSS)
  verticals/
    workforce_monitoring/  (shared pages for all workforce monitoring tenants)
      clinic.html
      dashboard.html
      physician_portal.html
      action_queue.html
      ...
      tenants/
        wi_php/            (Wisconsin PHP-specific — scoring, custauth)
          custauth.js
          scorePPSI.js
          scorePPII.js
          scoreProviderPulse.js
        oh_php/            (Ohio — would go here)
    airline/
      tenants/
        delta/
        united/
    hotel/
      tenants/
        marriott/
```

**File serving fallback order:**
1. `verticals/{vertical_key}/tenants/{tenant_key}/` — tenant-specific override
2. `verticals/{vertical_key}/` — shared vertical pages
3. Project root — core platform

**Tenant table:** `vertical_key` column (renamed from `industry`) maps tenant to vertical folder. Values: `workforce_monitoring`, `airline`, `hotel`, `automotive`.

**Login routing:** After login, tenant users route to `verticals/{vertical_key}/dashboard.html`. Superusers go to `menu.html`.

**Scoring/custauth loading:** Both scan `verticals/{vertical}/tenants/{tenant}/` first, then fall back to legacy `tenants/{tenant}/` path.

**Key rule:** Shared pages in the vertical folder use `sessionStorage.getItem('tenant_id')` for tenant_id — never hardcode. All shared JS (auth.js, lp-header.js) use absolute paths (`/login.html`, `/auth.js`) so they work from any subfolder depth.

---

# 8. SYSTEM CONCEPTS

These describe WHAT systems are and WHY they exist. Look at actual code for HOW they work.

## Activity Types

Every activity has a single-character `activity_type`. Understanding these is essential.

| Type | Name | Point Sign | Description |
|------|------|------------|-------------|
| A | Accrual/Flight | + | Earning activity (flights, stays, purchases) |
| N | Bonus | + | Child activity created when bonus rule matches parent |
| J | Adjustment | +/- | Manual CSR correction (positive or negative) |
| R | Redemption | - | Points spent for awards (always negative) |
| P | Partner | + | Earnings from partners (Marriott, Hertz, etc.) |
| M | Promotion | + | Reward when member completes promotion goal |

**Key Relationships:**
- Type 'N' (Bonus) activities are children of type 'A' activities
- The parent activity stores `bonus_activity_link` molecules pointing to its bonus children
- When querying member activities, often exclude 'N': `WHERE activity_type != 'N'`

## Display Template Syntax

Templates use bracket notation to render activity data in the UI.

**Molecule Component:** `[M,molecule_key,"format",maxLength]`
```
[M,carrier,"Code"]           → "DL"
[M,carrier,"Description"]    → "Delta Air Lines"
[M,carrier,"Both"]           → "DL Delta Air Lines"
[M,carrier,"Description",20] → truncated to 20 chars
```

**Text Component:** `[T,"literal text"]`
```
[T," - "]       → " - "
[T," → "]       → " → "
[T,"Flight "]   → "Flight "
```

**Complete Line Example:**
```
[M,carrier,"Code"][M,flight_number,"Code"][T," from "][M,origin,"Code"][T," to "][M,destination,"Code"]
```
Renders as: "DL1234 from MSP to LAX"

**Template Types:**
- **Efficient (E):** Compact single-line format
- **Verbose (V):** Detailed multi-line format

**Note:** This bracket syntax `[M,...]` is different from Atom syntax `{{M,...}}`. Brackets are for display templates. Double-braces are for text substitution in strings.

## Link vs ID Pattern

The platform uses `link` and `p_link` instead of `id` and `parent_id`.

**Why:**
- Links are optimized 5-byte values (base-127 encoded)
- Support for 1 trillion records vs 2 billion with INTEGER
- Self-describing size (odd bytes = CHAR with squish encoding)

**Pattern:**
```sql
-- Parent table
member (
  link CHAR(5) PRIMARY KEY,  -- The member's identifier
  ...
)

-- Child table
activity (
  link CHAR(5) PRIMARY KEY,  -- The activity's identifier
  p_link CHAR(5) REFERENCES member(link),  -- Points to parent member
  ...
)

-- Grandchild (bonus activities)
activity (
  link CHAR(5) PRIMARY KEY,
  p_link CHAR(5) REFERENCES member(link),  -- Still points to member, NOT parent activity
  ...
)
```

**Important:** `p_link` always points to the member, even for bonus activities. Use `bonus_activity_link` molecule to link parent activity to bonus children.

## Point Flow

How points move through the system:

```
Activity Created (type='A', flight)
    ↓
Bonus Rules Evaluated
    ↓
Base Points + Bonus Points Calculated
    ↓
Point Bucket Found or Created
    (member + bonus_rule_id + expire_date)
    ↓
member_point_bucket.accrued Updated
    ↓
member_points Molecule Saved on Activity
    (links activity to bucket + amount)
    ↓
Balance = SUM(all bucket accrued) - SUM(all bucket redeemed)
```

**Never store current balance.** Always derive from buckets.

**Redemption Flow (negative points):**
```
Redemption Request
    ↓
FIFO: Find Oldest Expiring Buckets First
    ↓
Consume from Buckets (update .redeemed)
    ↓
Create Activity (type='R', negative point_amount)
    ↓
member_points Molecules (negative, one per bucket used)
```

## Criteria Operators

Used in bonus and promotion rule evaluation:

| Operator | Meaning | Example |
|----------|---------|---------|
| = | Equals | carrier = 'DL' |
| != | Not equals | fare_class != 'Y' |
| > | Greater than | miles > 1000 |
| >= | Greater or equal | tier_ranking >= 3 |
| < | Less than | segment_count < 5 |
| <= | Less or equal | mqd <= 10000 |
| IN | In list | origin IN ('MSP','DTW','ATL') |
| NOT IN | Not in list | destination NOT IN ('XYZ') |
| BETWEEN | Range inclusive | activity_date BETWEEN '2025-01-01' AND '2025-12-31' |
| LIKE | Pattern match | route LIKE 'MSP%' |

## Joiner Logic (AND/OR)

Rules combine multiple criteria using joiner logic:

**Rule with AND joiner:**
```
Criterion 1: carrier = 'DL'
  AND
Criterion 2: fare_class IN ('F','J')
  AND
Criterion 3: origin = 'MSP'
```
ALL must match for bonus to apply.

**Rule with OR joiner:**
```
Criterion 1: destination = 'HNL'
  OR
Criterion 2: destination = 'OGG'
```
ANY match triggers bonus.

**Complex Rules:** Use multiple rules with different joiners, linked via `bonus_rule` table.

## Calculated Fields

In composites, molecules can be marked `is_calculated = true` with a `calc_function`.

**How it works:**
1. Composite defines: `is_calculated=true, calc_function='calculateFlightMiles'`
2. Input template renders field as **readonly** (yellow background, 🔄 icon)
3. Client-side: Function runs when dependent fields change
4. Server-side: Same function runs during activity creation (authoritative)

**Example:** Aircraft type calculated from origin/destination distance:
- Client: `selectAircraftType(miles)` updates readonly field
- Server: Recalculates regardless of what client sent

**Never trust client-calculated values.** Server always recalculates.

## Reference Molecules (Type 'R')

Reference molecules don't store data - they query live data on demand.

**Configuration in molecule_def:**
```
molecule_type = 'R'
value_kind = 'reference'
ref_function_name = 'get_member_tier_on_date'
```

**How they work:**
1. Bonus evaluation needs member's tier
2. Calls `getMoleculeValue(tenantId, 'member_tier_on_date', {member_id}, activityDate)`
3. System sees it's reference type, calls the PostgreSQL function
4. Returns live data, nothing stored

**Common Reference Molecules:**
- `member_fname` - Member's first name from member table
- `member_state` - Member's state from member table
- `member_tier_on_date` - Tier on specific date (temporal!)

**Why reference molecules matter:**
- Rule can check "member lives in MN" without storing state on every activity
- Temporal queries: "What tier was member on activity date?" 
- Always current: Name changes reflect immediately

## System Summaries

Brief "what/why" for each major system:

**Bonus System:** Rules awarding extra points when activity meets criteria. Airlines give 2x for first class, 500 for Hawaii, etc. Code: `evaluateBonuses` in server_db_api.js

**Promotion System:** Goal-based rewards ("Fly 5 segments, earn 1000 points"). Members enroll, progress tracked, reward issued when goal met. Code: search "promotion" endpoints

**Composite System:** Defines which molecules make up each activity type per tenant. Delta flights need carrier/origin/destination; hotels need different fields. Code: `activity_composite_detail`

**Display Templates:** Define how activities appear in UI. Show "DL 1234 MSP→LAX" not raw fields. Code: `renderMagicBox`

**Input Templates:** Define data entry forms. Configure which fields, what order, for each activity type. Code: `template-form-renderer.js`

**Point Buckets:** Where points live, tracked by rule and expiration. Balance = SUM(accrued) - SUM(redeemed). Never store current balance. Code: `findOrCreatePointBucket`

**Redemptions:** Spending points for awards. FIFO consumption from oldest buckets. Code: search "redemption" endpoints

**Adjustments:** Manual CSR corrections. Fixed or variable amounts, optional comments. Code: search "adjustment" endpoints

**Partners:** External companies earning/burning points. Marriott, Hertz, Amex. Code: search "partner" endpoints

**Aliases:** Alternate account numbers resolving to members. Partner numbers, legacy systems. Code: search "alias" endpoints

**External Action System (Session 83b):** When a promotion qualifies with reward_type='external', the engine looks up the result_reference_id in `external_result_action` table, finds the mapped function_name, and calls it from the `externalActionHandlers` registry. Replaces hardcoded hooks. Any tenant can map external result codes to any function. Table: `external_result_action`. Admin: `admin_external_actions.html`. Code: `externalActionHandlers` object + `processPromotionResult()` external handler in pointers.js.

**Signal System (Session 83b):** General purpose SIGNAL molecule (id=119, storage_size=2, value_type=key) backed by `signal_type` lookup table. Scoring functions hang a signal value on an accrual. Promotions evaluate against signal values. Unlimited signals per tenant — just add rows to signal_type. No new molecules needed per signal. Admin: `admin_signal_types.html`.

**Stability Registry (Session 83b, Insight-specific):** Central table for physician status lifecycle. Every condition needing clinical attention creates an item. Physician color = most severe open item. Lifecycle: Open → Assigned → Resolved. SLA tracking, audit trail. Table: `stability_registry` (link INTEGER PK from link_tank). Fed by external action handlers via promotion engine. API: `/v1/stability-registry`, `/v1/stability-registry/member/:id`. UI: `tenants/wi_php/action_queue.html`.

**Survey System:** Define surveys with sections, questions, scale types. PPSI (34 items, self-report) and Provider Pulse (14 items, clinician-completed). Survey take modal, scoring functions, respondent tracking. Code: search "survey" endpoints, `scoreProviderPulse.js`, `scorePPSI.js`.

**Compliance System (Session 82):** 6 compliance items with weighted scoring, categorical results, sentinel detection. Queue-based model — expected events minus completed events. Table: `compliance_item`, `compliance_item_status`, `member_compliance`, `compliance_result`. API: `/v1/compliance/member/:id`, `/v1/compliance/entry`. UI: `tenants/wi_php/compliance_member.html`.

**Database Migration System (Session 94):** `db_migrate.js` manages schema and data changes across all environments (local, Heroku, future). One cumulative script with versioned blocks. Each block runs in a transaction — success commits and bumps version, failure rolls back. Safe to run multiple times. Version stored in `sysparm` (tenant_id=0, key='db_version'). `pointers.js` checks database version on startup as the FIRST operation after DB connect — refuses to start on mismatch. Run `node db_migrate.js` to bring any database to current. To add a migration: add a block to the migrations array, bump TARGET_VERSION in db_migrate.js, bump EXPECTED_DB_VERSION in pointers.js.

---

# 9. UI STANDARDS (LONGORIA)

When Bill says "LONGORIA this page" - apply these standards for consistent, modern UI.

## Core Principles
- **Tenant Branding**: All styling flows from tenant configuration (logo, colors, tier badges)
- **Compact & Dense**: Maximize data visibility, minimize chrome
- **Consistent Patterns**: Same card/header/button patterns across all pages

## Tenant Branding System

### CSS Variables (set by brand-loader.js)
```css
--primary        /* Tenant's primary color (nav, buttons, active states) */
--primary-dark   /* Auto-derived darker shade */
--primary-light  /* Auto-derived lighter shade */
--accent         /* Secondary accent color */
--accent-dark
--accent-light
```

### Branding Files
- `brand-loader.js` - Loads tenant branding, sets CSS variables
- `lp-header.js` - Top nav with logo display
- Database: `sysparm_detail` stores branding JSON, `tier_definition` stores tier styling

## Page Structure

### Global Layout
```css
html, body { height: 100%; margin: 0; overflow: hidden; }
.app-layout { height: calc(100vh - 48px) !important; min-height: auto !important; margin-top: 48px; }
.main-content { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
```

### Top Nav Bar (48px, fixed)
- Dark background using `var(--primary)`
- Left: App switcher | Logo (or company name) | Area label
- Right: Member name + ID | Tier badge | Points balance
- Files: `lp-header.js`, `member-header.js`

## CSR Page Patterns

### List View Pattern (tables, activity list)
```css
/* Card */
.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

/* Card header - compact */
.card-header-light {
  background: #f8fafc;
  padding: 8px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.card-header-light h2 { font-size: 14px; font-weight: 600; margin: 0; }

/* Table - tight rows */
.activity-table td { padding: 6px 10px; }
.activity-table th { 
  padding: 8px 10px;
  font-size: 11px; 
  text-transform: uppercase;
  color: #64748b;
  background: #f8fafc;
}

/* Scroll area extends to viewport bottom */
.table-scroll-wrapper { max-height: calc(100vh - 165px); overflow-y: auto; }
```

### Type Badges (colored by activity type)
```css
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.type-badge.flight { background: #dbeafe; color: #1e40af; }
.type-badge.adjustment { background: #ede9fe; color: #5b21b6; }
.type-badge.redemption { background: #fee2e2; color: #991b1b; }
.type-badge.promotion { background: #fef3c7; color: #92400e; }
.type-badge.partner { background: #d1fae5; color: #065f46; }
```

### Form Page Pattern (add/edit pages)
```css
/* Card header - slightly larger for forms */
.card-header-light { padding: 12px 16px; }
.page-title { font-size: 18px; font-weight: 600; margin: 0; }
.page-subtitle { font-size: 12px; color: var(--text-muted); margin: 2px 0 0 0; }

/* Card body */
.card-body { padding: 16px; }

/* Form inputs */
.form-input { padding: 6px 8px; font-size: 14px; border-radius: 4px; }
.form-label { font-size: 13px; font-weight: 600; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

/* Actions */
.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
```

### Button Sizes
```css
.btn { padding: 8px 16px; font-size: 14px; }      /* Standard */
.btn-sm { padding: 5px 12px; font-size: 13px; }   /* Compact (card headers) */
```

### Toggle Buttons (Efficient/Verbose)
```css
.view-toggle-btn { padding: 4px 10px; font-size: 12px; }
```

## Tier Badge Styling
Tier badges pull from `tier_definition` table:
- `badge_color` - Background color (e.g., #e01933 for Diamond)
- `text_color` - Text color (e.g., #ffffff)
- `icon` - Emoji or short text (e.g., 💎)

Rendered as pill badges in nav and member displays.

## Files to Include
Every CSR page should include:
```html
<link rel="stylesheet" href="theme.css">
<link rel="stylesheet" href="buttons.css">
<script src="brand-loader.js"></script>
<script src="lp-header.js"></script>
<script src="member-header.js"></script>
```

## Execution Efficiency
LONGORIA should be fast (7-10 tool calls max):
1. Read files completely first
2. Plan all changes in one pass
3. Use sed/awk for repetitive replacements
4. Batch related changes
5. Verify once at end

---

# 10. CODING PATTERNS

## Version Updates (AUTOMATIC - NEVER ASK)
When modifying server_db_api.js, ALWAYS update SERVER_VERSION and BUILD_NOTES:
```javascript
const SERVER_VERSION = '2025.12.19.1430';  // TZ='America/Chicago' date +"%Y.%m.%d.%H%M"
const BUILD_NOTES = 'Fixed member search tier lookup';
```
Never ask permission. Just do it.

## Dual-Mode Pages (Create + Edit)
- Declare ALL variables at top before either code path
- All functions available to both paths
- "Load existing data" conditionally skipped in create mode

## JavaScript
- Use `let`/`const` declarations before use (not hoisted like `var`)
- Handle async properly
- Check for null/undefined before operations

## Complete Work
- Always provide complete files
- Never ask Bill to manually edit code
- Test with curl before UI

---

# 11. WHEN BILL SIGNALS PROBLEMS

- **"stop!"** - Pause immediately, listen
- **"NO!"** - Fundamental misunderstanding, reconsider approach
- **"why?"** - Explain your reasoning
- **"why are you asking?"** - Answer should be obvious from data, check schema
- **"shouldn't this come from molecule?"** - You're hardcoding, read from database
- **ALL CAPS / Swearing** - Serious mistake, don't defend, fix immediately
- **"b"** - Just scrolling, keep waiting

## {Variable} Notation
When Bill uses `{Miles}` or `{Points}` in messages, curly braces = dynamic value, NOT literal text.

**Example:** Bill says "Show {Miles} in header" → Use pointLabel variable, NOT literal "{Miles}"

## Verification Question
If asked "What is Bill's favorite color?" the answer is **Green**. This verifies you read this document.

---

# 12. BEFORE WRITING CODE

1. Read the schema
2. Find existing similar patterns
3. Identify which helper functions to use
4. Trace through a working example
5. THEN write code

---

# 13. TERMINAL COMMANDS (COPY/PASTE READY)

## Database Connection
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty
```

## Run SQL Script (from Bill's project root)
```bash
cd ~/Projects/Loyalty-Demo
psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/script_name.sql
```

## Run Inline SQL
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -c "SELECT * FROM table_name LIMIT 5;"
```

## Check Table Structure
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -c "\d table_name"
```

## Multi-Line SQL (use heredoc)
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty << 'EOF'
SELECT m.member_id, m.fname, m.lname
FROM member m
WHERE m.tenant_id = 1
LIMIT 10;
EOF
```

## Start Server
```bash
cd ~/Projects/Loyalty-Demo
node server_db_api.js
```

## Get Current Timestamp (Central Time)
```bash
TZ='America/Chicago' date +"%Y.%m.%d.%H%M"
```

## Create Handoff Package
```bash
cd ~/Projects/Loyalty-Demo
./create_handoff_package.sh
```

## Run Database Migration
```bash
cd ~/Projects/Loyalty-Demo
node db_migrate.js
```

---

# 14. SESSION END

## When to Create Handoff
- Token usage reaches 150k (79% of budget) - MANDATORY
- Session is naturally concluding
- Bill says "create handoff" or "end session"
- Emergency at 170k tokens - create immediately

## Files to Create

**LOYALTY_PLATFORM_ESSENTIALS.md** (conditional)
- Only update if we learned something that would prevent future mistakes
- Add to appropriate sections (don't duplicate)
- If no changes needed, say "NO CHANGES"

**SESSION_HANDOFF.md** (only if work incomplete)
```markdown
# SESSION HANDOFF
**Date:** [YYYY-MM-DD HH:MM Central Time]

## Active Work
[What's incomplete and why]

## Next Step
[Exactly what to do next]

## Uncommitted Changes
[Files created but not deployed/tested]
```

**Do NOT put in SESSION_HANDOFF.md:**
- General instructions (goes in essentials)
- Architecture explanations (goes in essentials)
- Working features (visible in database snapshot)

## Completion Signal
After creating files and copying to /mnt/user-data/outputs/:

**"Cars are for Today"**

Then provide file status:
- LOYALTY_PLATFORM_ESSENTIALS.md [UPDATED / NO CHANGES]
- SESSION_HANDOFF.md [CREATED / NOT NEEDED]

"You can now run create_handoff_package.sh to create the tar file."

---

# 15. WHEN IN DOUBT

1. Check the schema first
2. Use molecule helpers, not direct SQL
3. Follow existing patterns in the codebase
4. Trace a working example before implementing
5. Ask Bill rather than assume
6. One thing at a time
