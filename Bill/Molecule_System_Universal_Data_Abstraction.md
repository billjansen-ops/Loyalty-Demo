# Molecule System - Universal Data Abstraction Architecture

**Author:** Bill Jansen  
**Date:** 2025-11-07  
**Status:** Core System Architecture

---

## Executive Summary

The molecule system is a universal data abstraction layer that makes the loyalty platform completely industry-agnostic. Instead of hardcoding concepts like "carrier" or "hotel brand" into the application, all domain-specific data is stored as "molecules" - typed, configurable attributes that can point to lookups, lists, or scalar values. One codebase works for airlines, hotels, credit cards, retail, and any future industry by simply configuring different molecule definitions. No code changes required.

---

## The Core Problem

### Traditional Loyalty Platforms

**Airlines have:**
```sql
CREATE TABLE flight_activity (
  activity_id BIGINT,
  carrier_code VARCHAR(2),
  origin_airport VARCHAR(3),
  destination_airport VARCHAR(3),
  fare_class VARCHAR(1),
  flight_number VARCHAR(10),
  ...
);
```

**Hotels need:**
```sql
CREATE TABLE hotel_activity (
  activity_id BIGINT,
  hotel_brand VARCHAR(50),
  property_code VARCHAR(10),
  room_type VARCHAR(20),
  rate_code VARCHAR(10),
  nights INTEGER,
  ...
);
```

**Problems:**
- ❌ Different tables for each industry
- ❌ Code knows about specific fields (carrier_code, hotel_brand)
- ❌ Bonus engine has if/else branches per industry
- ❌ Adding new industry requires new tables + new code
- ❌ Schema changes require deployment

### The Molecule Solution

**One table for all industries:**
```sql
CREATE TABLE activity_detail (
  activity_id BIGINT,
  molecule_id INTEGER,
  v_ref_id BIGINT
);
```

**Airlines configure:**
```sql
molecule_key: 'carrier', lookup_table: 'airline'
molecule_key: 'origin', lookup_table: 'airport'
molecule_key: 'fare_class', value_kind: 'list'
```

**Hotels configure:**
```sql
molecule_key: 'hotel_brand', lookup_table: 'hotel_brand'
molecule_key: 'room_type', value_kind: 'list'
molecule_key: 'rate_code', value_kind: 'list'
```

**Same code. Different configuration. Zero deployment.**

---

## What Is A Molecule?

### Conceptual Definition

**A molecule is a typed, configurable attribute that can be attached to entities (activities, members, tenants).**

Think of molecules as:
- **Nouns** - Things that describe the entity (carrier, origin, room_type)
- **Metadata** - Configuration about how to store/display the value
- **Pointers** - References to values stored elsewhere

### Key Characteristics

**1. Molecules are universal**
- Same system works for ANY industry
- Just configure different molecule definitions

**2. Molecules are typed**
- lookup = reference to external table
- list = pick from predefined values
- scalar = store single value

**3. Molecules are self-documenting**
- molecule_def describes itself (label, description)
- No separate documentation needed

**4. Molecules are data-driven**
- Change label "Carrier Code" → "Airline" (ripples everywhere)
- Add new list value (no code change)
- Hook to new lookup table (just configuration)

---

## The Three-Tier Architecture

### Tier 1: Definition (molecule_def)

**What is this molecule?**

```sql
CREATE TABLE molecule_def (
  molecule_id INTEGER PRIMARY KEY,
  tenant_id SMALLINT NOT NULL,
  molecule_key VARCHAR(50) NOT NULL,  -- 'carrier', 'origin', 'fare_class'
  label VARCHAR(100),                 -- 'Carrier Code', 'Origin Airport'
  description TEXT,                   -- Long explanation
  context VARCHAR(20),                -- 'activity', 'member', 'system', 'program'
  value_kind VARCHAR(20),             -- 'lookup', 'list', 'scalar'
  scalar_type VARCHAR(20),            -- 'numeric', 'text', 'date', 'boolean'
  is_static BOOLEAN,                  -- Configuration vs transactional
  is_permanent BOOLEAN,               -- Can be deleted?
  is_active BOOLEAN,                  -- Currently in use?
  sample_code VARCHAR(50),            -- Example: 'DL'
  sample_description VARCHAR(200),    -- Example: 'Delta Air Lines'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example definitions:**

```sql
-- Airline carrier (lookup)
molecule_id: 1
molecule_key: 'carrier'
label: 'Carrier Code'
context: 'activity'
value_kind: 'lookup'
lookup_table_key: 'airline'

-- Fare class (list)
molecule_id: 2
molecule_key: 'fare_class'
label: 'Fare Class'
context: 'activity'
value_kind: 'list'

-- Flight number (scalar text)
molecule_id: 3
molecule_key: 'flight_number'
label: 'Flight Number'
context: 'activity'
value_kind: 'scalar'
scalar_type: 'text'
```

### Tier 2: Values (molecule_value_* tables)

**Where are the actual values stored?**

Different tables for different value kinds:

#### A. Lookup Values (molecule_value_lookup)

**For external table references:**

```sql
CREATE TABLE molecule_value_lookup (
  molecule_id INTEGER PRIMARY KEY,
  table_name VARCHAR(100),        -- 'airport', 'airline', 'hotel_brand'
  id_column VARCHAR(100),         -- 'airport_id', 'airline_id'
  code_column VARCHAR(100),       -- 'iata_code', 'carrier_code'
  description_column VARCHAR(100) -- 'airport_name', 'airline_name'
);
```

**Example:**
```sql
molecule_id: 1 (carrier)
table_name: 'airline'
id_column: 'airline_id'
code_column: 'carrier_code'
description_column: 'airline_name'

-- v_ref_id in activity_detail = airline_id from airline table
```

#### B. List Values (molecule_value_text)

**For predefined list of options:**

```sql
CREATE TABLE molecule_value_text (
  value_id SERIAL PRIMARY KEY,
  molecule_id INTEGER NOT NULL,
  text_value VARCHAR(50),         -- 'F', 'J', 'Y'
  display_label VARCHAR(200),     -- 'First Class', 'Business', 'Economy'
  sort_order INTEGER
);
```

**Example:**
```sql
molecule_id: 2 (fare_class)

value_id: 1, text_value: 'F', display_label: 'First Class', sort_order: 1
value_id: 2, text_value: 'J', display_label: 'Business Class', sort_order: 2
value_id: 3, text_value: 'Y', display_label: 'Economy Class', sort_order: 3

-- v_ref_id in activity_detail = value_id (1, 2, or 3)
```

#### C. Scalar Text (molecule_text_pool)

**For deduplicated text values:**

```sql
CREATE TABLE molecule_text_pool (
  text_id SERIAL PRIMARY KEY,
  text_value TEXT UNIQUE
);
```

**Example:**
```sql
text_id: 101, text_value: 'DL1234'
text_id: 102, text_value: 'AA5678'
text_id: 103, text_value: 'UA9012'

-- v_ref_id in activity_detail = text_id
-- Store "DL1234" once, reference 1 million times
```

#### D. Scalar Numeric (stored directly)

**For numeric values:**

```sql
-- No separate table needed!
-- v_ref_id in activity_detail = the actual number
```

**Example:**
```sql
molecule_key: 'horsepower'
scalar_type: 'numeric'

-- v_ref_id: 450 (the actual horsepower value)
```

#### E. Scalar Date (stored directly)

**For date values:**

```sql
-- No separate table needed!
-- v_ref_id = encoded date (if using 2-byte dates)
-- Or v_ref_id = days since epoch
```

#### F. Scalar Boolean (stored directly)

**For true/false values:**

```sql
-- No separate table needed!
-- v_ref_id: 1 = true, 0 = false
```

### Tier 3: Usage (activity_detail)

**Which activity has which molecule values?**

```sql
CREATE TABLE activity_detail (
  activity_id BIGINT NOT NULL,
  molecule_id INTEGER NOT NULL,
  v_ref_id BIGINT,
  
  PRIMARY KEY (activity_id, molecule_id),
  FOREIGN KEY (activity_id) REFERENCES activity(activity_id),
  FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id)
);
```

**Example: Flight MSP → BOS on Delta:**

```sql
-- activity_id: 12345

-- Origin (lookup)
activity_id: 12345, molecule_id: 5, v_ref_id: 3456  -- airport_id for MSP

-- Destination (lookup)
activity_id: 12345, molecule_id: 6, v_ref_id: 789   -- airport_id for BOS

-- Carrier (lookup)
activity_id: 12345, molecule_id: 1, v_ref_id: 42    -- airline_id for Delta

-- Fare class (list)
activity_id: 12345, molecule_id: 2, v_ref_id: 1     -- value_id for 'F'

-- Flight number (scalar text)
activity_id: 12345, molecule_id: 3, v_ref_id: 101   -- text_id for 'DL1234'
```

---

## The Polymorphic v_ref_id Pointer

### The Magic Column

**v_ref_id is a BIGINT that points to different things based on value_kind:**

| Value Kind | v_ref_id Points To |
|------------|-------------------|
| **lookup** | Foreign table ID (airport_id, airline_id, hotel_id) |
| **list** | molecule_value_text.value_id |
| **scalar (text)** | molecule_text_pool.text_id |
| **scalar (numeric)** | The actual number |
| **scalar (date)** | Date encoding or days since epoch |
| **scalar (boolean)** | 1 (true) or 0 (false) |

### Why Polymorphic?

**One column handles all cases:**
- ✅ Simpler schema (just 3 columns in activity_detail)
- ✅ Consistent storage (always 8 bytes)
- ✅ Universal functions (encode/decode work for all types)

**Tradeoff:**
- ⚠️ Can't enforce foreign keys at database level
- ⚠️ Application must validate v_ref_id points to valid value
- ⚠️ Debugging requires knowing molecule type

---

## Universal Encode/Decode Functions

### The Two Functions That Run Everything

#### encodeMolecule(tenantId, moleculeKey, value)

**Input:** Human-readable value  
**Output:** Integer ID for v_ref_id

**Algorithm:**
```javascript
async function encodeMolecule(tenantId, moleculeKey, value) {
  // 1. Get molecule definition
  const molecule = await getMolecule(tenantId, moleculeKey);
  
  // 2. Branch based on value_kind
  switch (molecule.value_kind) {
    case 'lookup':
      // Query external table
      return await lookupExternalId(molecule, value);
      
    case 'list':
      // Find or create list value
      return await findListValueId(molecule.molecule_id, value);
      
    case 'scalar':
      if (molecule.scalar_type === 'text') {
        // Deduplicate text
        return await getOrCreateTextId(value);
      } else if (molecule.scalar_type === 'numeric') {
        // Return number directly
        return parseInt(value);
      } else if (molecule.scalar_type === 'date') {
        // Encode date
        return encodeDate(value);
      } else if (molecule.scalar_type === 'boolean') {
        // 1 or 0
        return value ? 1 : 0;
      }
  }
}
```

**Example calls:**
```javascript
// Lookup
await encodeMolecule(1, 'carrier', 'DL')  → 42 (airline_id)

// List
await encodeMolecule(1, 'fare_class', 'F')  → 1 (value_id)

// Scalar text
await encodeMolecule(1, 'flight_number', 'DL1234')  → 101 (text_id)

// Scalar numeric
await encodeMolecule(1, 'horsepower', 450)  → 450 (the number)
```

#### decodeMolecule(tenantId, moleculeKey, v_ref_id)

**Input:** Integer ID from v_ref_id  
**Output:** Human-readable value

**Algorithm:**
```javascript
async function decodeMolecule(tenantId, moleculeKey, v_ref_id) {
  // 1. Get molecule definition
  const molecule = await getMolecule(tenantId, moleculeKey);
  
  // 2. Branch based on value_kind
  switch (molecule.value_kind) {
    case 'lookup':
      // Query external table
      return await lookupExternalValue(molecule, v_ref_id);
      
    case 'list':
      // Query molecule_value_text
      return await getListValue(v_ref_id);
      
    case 'scalar':
      if (molecule.scalar_type === 'text') {
        // Query text_pool
        return await getTextValue(v_ref_id);
      } else if (molecule.scalar_type === 'numeric') {
        // Return number directly
        return v_ref_id;
      } else if (molecule.scalar_type === 'date') {
        // Decode date
        return decodeDate(v_ref_id);
      } else if (molecule.scalar_type === 'boolean') {
        // Convert 1/0 to true/false
        return v_ref_id === 1;
      }
  }
}
```

**Example calls:**
```javascript
// Lookup
await decodeMolecule(1, 'carrier', 42)  → 'DL'

// List
await decodeMolecule(1, 'fare_class', 1)  → 'F'

// Scalar text
await decodeMolecule(1, 'flight_number', 101)  → 'DL1234'

// Scalar numeric
await decodeMolecule(1, 'horsepower', 450)  → 450
```

### Why Universal Functions Are Brilliant

**One encode/decode works for:**
- ✅ All industries (airlines, hotels, credit cards)
- ✅ All molecule types (lookup, list, scalar)
- ✅ All scalar types (text, numeric, date, boolean)

**Add new molecule type?**
- Update encode/decode functions
- That's it. No other code changes.

**Add new industry?**
- Configure molecule definitions
- Encode/decode already works

---

## Real-World Examples

### Example 1: Airline Flight Activity

**Molecules needed:**
```sql
carrier (lookup → airline table)
origin (lookup → airport table)
destination (lookup → airport table)
fare_class (list: F, J, Y)
flight_number (scalar text)
```

**Creating activity:**
```javascript
// Create base activity record
const activityId = await createActivity({
  member_id: 2153442807,
  activity_date: '2025-11-07',
  activity_type: 'B',
  point_amount: 1500
});

// Encode and store molecules
await encodeMolecule(1, 'carrier', 'DL');        // → 42
await encodeMolecule(1, 'origin', 'MSP');        // → 3456
await encodeMolecule(1, 'destination', 'BOS');   // → 789
await encodeMolecule(1, 'fare_class', 'F');      // → 1
await encodeMolecule(1, 'flight_number', 'DL1234'); // → 101

// Store in activity_detail
INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES
  (activityId, 1, 42),    -- carrier
  (activityId, 5, 3456),  -- origin
  (activityId, 6, 789),   -- destination
  (activityId, 2, 1),     -- fare_class
  (activityId, 3, 101);   -- flight_number
```

**Displaying activity:**
```javascript
// Load activity molecules
const molecules = await loadActivityMolecules(activityId);

// Decode each one
const carrier = await decodeMolecule(1, 'carrier', molecules.carrier);     // 'DL'
const origin = await decodeMolecule(1, 'origin', molecules.origin);       // 'MSP'
const destination = await decodeMolecule(1, 'destination', molecules.destination); // 'BOS'
const fareClass = await decodeMolecule(1, 'fare_class', molecules.fare_class);   // 'F'
const flightNum = await decodeMolecule(1, 'flight_number', molecules.flight_number); // 'DL1234'

// Display: "DL1234: MSP → BOS (First Class)"
```

### Example 2: Hotel Stay Activity

**Molecules needed:**
```sql
hotel_brand (lookup → hotel_brand table)
property_code (scalar text)
room_type (list: Standard, Deluxe, Suite)
rate_code (list: BAR, Corp, Promo)
nights (scalar numeric)
room_revenue (scalar numeric)
```

**Same code, different configuration:**
```javascript
// Create activity (IDENTICAL code)
const activityId = await createActivity({
  member_id: 2153442807,
  activity_date: '2025-11-07',
  activity_type: 'B',
  point_amount: 2500
});

// Encode molecules (IDENTICAL function calls)
await encodeMolecule(1, 'hotel_brand', 'Marriott');     // → 15
await encodeMolecule(1, 'property_code', 'BOSMA');      // → 502
await encodeMolecule(1, 'room_type', 'Suite');          // → 8
await encodeMolecule(1, 'rate_code', 'Corp');           // → 12
await encodeMolecule(1, 'nights', 3);                   // → 3
await encodeMolecule(1, 'room_revenue', 89900);         // → 89900 (cents)

// Store in activity_detail (IDENTICAL code)
INSERT INTO activity_detail ...
```

**The code doesn't know or care if it's storing flights or hotel stays.**

### Example 3: Bonus Activities (Type 'N')

**Molecules needed:**
```sql
parent_activity_id (scalar numeric - points to parent)
bonus_rule_id (scalar numeric - points to bonus rule)
awarded_by (scalar text - 'AUTO', 'CSR', username)
promotion_code (scalar text - optional)
```

**Creating bonus:**
```javascript
// Create bonus activity
const bonusActivityId = await createActivity({
  member_id: 2153442807,
  activity_date: '2025-11-07',
  activity_type: 'N',
  point_amount: 500
});

// Encode molecules
await encodeMolecule(1, 'parent_activity_id', 12345);  // → 12345
await encodeMolecule(1, 'bonus_rule_id', 7);           // → 7
await encodeMolecule(1, 'awarded_by', 'AUTO');         // → 203

// Store in activity_detail
INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES
  (bonusActivityId, [parent_activity_id_mol], 12345),
  (bonusActivityId, [bonus_rule_id_mol], 7),
  (bonusActivityId, [awarded_by_mol], 203);
```

**Finding bonuses for activity:**
```sql
-- Get all bonuses for activity 12345
SELECT n.*, parent.v_ref_id as parent_id
FROM activity n
JOIN activity_detail parent 
  ON n.activity_id = parent.activity_id
  AND parent.molecule_id = [parent_activity_id_molecule]
WHERE n.activity_type = 'N'
  AND parent.v_ref_id = 12345;
```

---

## Molecule Contexts

### The context Field

**Molecules are categorized by where they're used:**

| Context | Description | Example Molecules |
|---------|-------------|------------------|
| **activity** | Attached to activities | carrier, origin, destination, fare_class |
| **member** | Attached to members | home_airport, preferred_airline, tier_level |
| **system** | System configuration | activity_type, parent_activity_id, bonus_rule_id |
| **program** | Program configuration | point_type_label, activity_type_label |

### Context Examples

**activity context:**
```sql
-- These describe WHAT happened
carrier, origin, destination, flight_number, fare_class
hotel_brand, room_type, property_code, nights
merchant, category, amount, transaction_id
```

**member context:**
```sql
-- These describe WHO the member is
home_airport, preferred_airline, communication_preference
tier_level, enrollment_date, birth_date
```

**system context:**
```sql
-- These are infrastructure
activity_type (B, P, A, R, N)
parent_activity_id (for bonuses)
bonus_rule_id (which rule awarded bonus)
```

**program context:**
```sql
-- These are display labels
point_type_label (miles vs points vs stars)
activity_type_label (Flight vs Activity vs Transaction)
```

---

## Molecule Flags

### is_static vs is_active

**is_static: Configuration vs Transactional**

```sql
is_static = true:  Configuration molecules (rarely change)
  - point_type_label ('miles')
  - activity_type_label ('Flight')
  - retro_days_allowed (90)

is_static = false: Transactional molecules (change per activity)
  - origin (changes every flight)
  - destination (changes every flight)
  - fare_class (changes per booking)
```

**is_active: Currently Used**

```sql
is_active = true:  In production use
is_active = false: Deprecated, don't use for new activities
```

**is_permanent: Can Be Deleted**

```sql
is_permanent = true:  Core system molecule, can't delete
is_permanent = false: Custom molecule, can delete if unused
```

---

## Sample Data for Previews

### sample_code and sample_description

**Purpose:** Template previews without loading full datasets

**Example:**
```sql
molecule_key: 'carrier'
sample_code: 'DL'
sample_description: 'Delta Air Lines'

molecule_key: 'origin'
sample_code: 'BOS'
sample_description: 'Boston Logan International'

molecule_key: 'fare_class'
sample_code: 'F'
sample_description: 'First Class'
```

**Usage in template editor:**
```javascript
// Load minimal sample data for preview
const molecule = await getMolecule('carrier', { return_type: 'with_samples' });

// Returns only:
{
  molecule_key: 'carrier',
  label: 'Carrier Code',
  sample_code: 'DL',
  sample_description: 'Delta Air Lines'
}

// Use for preview (not live data)
const preview = renderTemplate(template, {
  carrier: { Code: 'DL', Description: 'Delta Air Lines' },
  origin: { Code: 'BOS', Description: 'Boston Logan' }
});
```

---

## Template-Driven Display

### Display Templates Use Molecules

**Template language:**
```
[M,molecule_key,"format"]  - Insert molecule value
[T,"text"]                 - Insert literal text
```

**Example template:**
```
Line 1: [M,origin,"Code"] [T,"→"] [M,destination,"Code"]
Line 2: [M,carrier,"Code"] [T," "] [M,flight_number,"Code"]
Line 3: [M,fare_class,"Description"]
```

**Rendering:**
```javascript
// Load decoded molecules for activity
const decoded = {
  origin: 'MSP',
  destination: 'BOS',
  carrier: 'DL',
  flight_number: 'DL1234',
  fare_class: 'First Class'
};

// Render template
const output = renderTemplate(template, decoded);

// Output:
MSP → BOS
DL DL1234
First Class
```

**Why brilliant:**
- ✅ Display format is configuration, not code
- ✅ Change template without deployment
- ✅ A/B test different displays
- ✅ Different tenants can have different formats

---

## Query Patterns

### Pattern 1: Load All Molecules for Activity

```sql
SELECT 
  md.molecule_key,
  ad.v_ref_id
FROM activity_detail ad
JOIN molecule_def md ON ad.molecule_id = md.molecule_id
WHERE ad.activity_id = $1;
```

**Returns:**
```
molecule_key     | v_ref_id
-----------------|---------
carrier          | 42
origin           | 3456
destination      | 789
fare_class       | 1
flight_number    | 101
```

### Pattern 2: Decode Lookup Molecule

```sql
-- For carrier (lookup → airline table)
SELECT 
  md.molecule_key,
  mvl.table_name,
  mvl.code_column,
  a.carrier_code,
  a.airline_name
FROM activity_detail ad
JOIN molecule_def md ON ad.molecule_id = md.molecule_id
JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
JOIN airline a ON ad.v_ref_id = a.airline_id
WHERE ad.activity_id = $1
  AND md.molecule_key = 'carrier';
```

### Pattern 3: Decode List Molecule

```sql
-- For fare_class (list)
SELECT 
  md.molecule_key,
  mvt.text_value,
  mvt.display_label
FROM activity_detail ad
JOIN molecule_def md ON ad.molecule_id = md.molecule_id
JOIN molecule_value_text mvt ON ad.v_ref_id = mvt.value_id
WHERE ad.activity_id = $1
  AND md.molecule_key = 'fare_class';
```

### Pattern 4: Decode Scalar Text Molecule

```sql
-- For flight_number (scalar text)
SELECT 
  md.molecule_key,
  mtp.text_value
FROM activity_detail ad
JOIN molecule_def md ON ad.molecule_id = md.molecule_id
JOIN molecule_text_pool mtp ON ad.v_ref_id = mtp.text_id
WHERE ad.activity_id = $1
  AND md.molecule_key = 'flight_number';
```

### Pattern 5: Decode Scalar Numeric Molecule

```sql
-- For horsepower (scalar numeric)
SELECT 
  md.molecule_key,
  ad.v_ref_id as value  -- The value IS v_ref_id
FROM activity_detail ad
JOIN molecule_def md ON ad.molecule_id = md.molecule_id
WHERE ad.activity_id = $1
  AND md.molecule_key = 'horsepower';
```

### Pattern 6: Universal Decode (All Types)

```sql
-- One query handles all molecule types
SELECT 
  md.molecule_key,
  md.value_kind,
  md.scalar_type,
  ad.v_ref_id,
  
  -- Lookup (join external table dynamically - application handles this)
  mvl.table_name,
  mvl.code_column,
  
  -- List
  mvt.text_value as list_code,
  mvt.display_label as list_description,
  
  -- Scalar text
  mtp.text_value as scalar_text
  
FROM activity_detail ad
JOIN molecule_def md ON ad.molecule_id = md.molecule_id
LEFT JOIN molecule_value_lookup mvl 
  ON md.molecule_id = mvl.molecule_id 
  AND md.value_kind = 'lookup'
LEFT JOIN molecule_value_text mvt 
  ON ad.v_ref_id = mvt.value_id 
  AND md.value_kind = 'list'
LEFT JOIN molecule_text_pool mtp 
  ON ad.v_ref_id = mtp.text_id 
  AND md.value_kind = 'scalar' 
  AND md.scalar_type = 'text'
WHERE ad.activity_id = $1;
```

---

## Performance Characteristics

### Storage Efficiency

**Per activity molecule:**
```
activity_detail row:
  activity_id: 8 bytes
  molecule_id: 4 bytes
  v_ref_id: 8 bytes
  Total: 20 bytes per molecule
```

**Compared to traditional:**
```sql
-- Traditional (separate columns)
carrier_code VARCHAR(2)           -- ~5 bytes
origin_airport VARCHAR(3)         -- ~6 bytes
destination_airport VARCHAR(3)    -- ~6 bytes
fare_class VARCHAR(1)             -- ~4 bytes
flight_number VARCHAR(10)         -- ~13 bytes
Total: ~34 bytes

-- Molecule system (5 molecules)
5 × 20 bytes = 100 bytes

-- Difference: 3x more storage for molecules
```

**BUT: Gains outweigh costs**

**Text deduplication:**
```
Store "DL1234" 1 million times:
  Traditional: 1M × 13 bytes = 13 MB
  Molecule: Once in text_pool + 1M pointers = 13 bytes + 8 MB = 8 MB
  Savings: 5 MB (38% reduction)
```

**Lookup optimization:**
```
Store Delta carrier 1 million times:
  Traditional: 1M × 2 bytes = 2 MB (just code)
  Molecule: 1M × 8 bytes = 8 MB (pointer to airline table)
  Cost: 6 MB more

BUT: Full airline_name available via join (no separate storage)
AND: Change "Delta" → "Delta Air Lines" ripples everywhere instantly
```

### Query Performance

**Single activity decode:**
```
Load 5 molecules for 1 activity:
  - 1 query to get all molecule_ids and v_ref_ids
  - 5 decode operations (lookup, list, scalar)
  - Total: ~6 queries, ~10ms

Traditional:
  - 1 query, all columns
  - Total: 1 query, ~2ms

Molecules are 5x slower for single activity
```

**Bulk activity decode:**
```
Load 1000 activities:
  - 1 query to get all molecules (1000 × 5 = 5000 rows)
  - Batch decode by type (group lookups, lists, scalars)
  - Total: ~10 queries, ~50ms

Traditional:
  - 1 query, 1000 rows
  - Total: 1 query, ~30ms

Molecules are 1.7x slower for bulk activities
```

**But: Flexibility is worth it**
- Add new molecule: No code change
- Change display: No deployment
- New industry: Just configuration

**Optimization strategies:**
- Cache decoded molecules at request level
- Batch decode operations
- Preload common lookups (carriers, airports)
- Use views for frequently accessed patterns

---

## Why This Design Is Brilliant

### 1. Industry Agnostic

**One codebase works for ANY industry:**

```javascript
// This EXACT code works for:
// - Airlines (carrier, origin, destination)
// - Hotels (brand, property, room_type)
// - Credit cards (merchant, category, amount)
// - Retail (store, product, department)
// - Automotive (dealer, make, model)

async function createActivity(activityData) {
  const activityId = await insertActivity(activityData);
  
  for (const [moleculeKey, value] of Object.entries(activityData.molecules)) {
    const vRefId = await encodeMolecule(tenantId, moleculeKey, value);
    await insertActivityDetail(activityId, moleculeKey, vRefId);
  }
  
  return activityId;
}
```

**No if/else branches. No industry-specific code. Just data.**

### 2. Self-Documenting Metadata

**Want to know what molecules exist?**
```sql
SELECT molecule_key, label, description, value_kind
FROM molecule_def
WHERE tenant_id = 1
  AND context = 'activity';
```

**Returns:**
```
molecule_key | label          | value_kind
-------------|----------------|------------
carrier      | Carrier Code   | lookup
origin       | Origin Airport | lookup
destination  | Dest Airport   | lookup
fare_class   | Fare Class     | list
```

**The system documents itself. No separate wiki needed.**

### 3. Zero Schema Changes

**Add new molecule:**
```sql
-- Just insert configuration
INSERT INTO molecule_def (molecule_key, label, value_kind, ...)
VALUES ('baggage_weight', 'Baggage Weight (lbs)', 'scalar', ...);

-- Code already handles it (encode/decode are universal)
```

**Traditional systems:**
```sql
-- Schema change required
ALTER TABLE flight_activity ADD COLUMN baggage_weight INTEGER;

-- Code change required
UPDATE application code to handle new column

-- Deployment required
Deploy new code + run migration
```

### 4. Instant Label Updates

**Change label:**
```sql
UPDATE molecule_def 
SET label = 'Airline Code' 
WHERE molecule_key = 'carrier';
```

**Effect:** Every display that shows this molecule now says "Airline Code" instead of "Carrier Code". No code change. No deployment.

**Traditional systems:**
```javascript
// Hardcoded in 47 places
const carrierLabel = "Carrier Code";

// Must find and update all 47
// Must deploy new code
```

### 5. Unlimited Flexibility Through Molecules

**Bonus activities can have ANY molecules:**
```sql
-- Core bonus molecules
parent_activity_id
bonus_rule_id

-- Optional bonus molecules (add anytime)
promotion_code
campaign_id
awarded_by_csr
award_reason
override_expiration
special_instructions
```

**Traditional bonus table:**
```sql
CREATE TABLE activity_bonus (
  activity_bonus_id SERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  bonus_id INTEGER NOT NULL,
  bonus_points INTEGER NOT NULL,
  created_at TIMESTAMP
  -- Want more fields? Schema change + deployment!
);
```

### 6. Template-Driven Display

**Display format is configuration:**
```sql
-- Efficient template
Line 1: [M,origin,"Code"] [T,"→"] [M,destination,"Code"]

-- Verbose template
Line 1: [T,"From: "] [M,origin,"Description"]
Line 2: [T,"To: "] [M,destination,"Description"]
```

**Switch templates without code change. A/B test displays.**

### 7. Bonus Engine Is Industry-Agnostic

**Traditional bonus rule:**
```javascript
if (activity.fare_class === 'F') {
  bonus = baseMiles * 0.50;
} else if (activity.hotel_room_type === 'Suite') {
  bonus = basePoints * 0.75;
}
```

**Molecule-based bonus rule:**
```sql
-- Stored in database
SELECT bonus_amount
FROM bonus
WHERE molecule_key = $1  -- 'fare_class' or 'room_type'
  AND molecule_value = $2  -- 'F' or 'Suite'
  AND activity_date BETWEEN start_date AND end_date;
```

**Bonus engine doesn't know about fare classes or room types. Just evaluates molecules against rules.**

---

## Comparison to Traditional Approaches

### Hardcoded Columns Approach

**Traditional:**
```sql
CREATE TABLE flight_activity (
  activity_id BIGINT,
  carrier_code VARCHAR(2),
  origin_airport VARCHAR(3),
  destination_airport VARCHAR(3),
  fare_class VARCHAR(1),
  flight_number VARCHAR(10),
  ...
);

-- Add new field? Schema change!
ALTER TABLE flight_activity ADD COLUMN baggage_weight INTEGER;
```

**Molecules:**
```sql
CREATE TABLE activity_detail (
  activity_id BIGINT,
  molecule_id INTEGER,
  v_ref_id BIGINT
);

-- Add new molecule? Just configuration!
INSERT INTO molecule_def ...
```

| Aspect | Hardcoded Columns | Molecules |
|--------|------------------|-----------|
| Add field | Schema change + deployment | Configuration only |
| Multi-industry | Separate tables per industry | One table for all |
| Label changes | Code change + deployment | Configuration update |
| Bonus rules | If/else in code | Data-driven rules |
| Documentation | Separate wiki/docs | Self-documenting |

### JSON/JSONB Approach

**JSON storage:**
```sql
CREATE TABLE activity (
  activity_id BIGINT,
  details JSONB  -- Everything in here
);

INSERT INTO activity (activity_id, details) VALUES
(1, '{"carrier":"DL","origin":"MSP","destination":"BOS"}');
```

**Problems:**
- ❌ No schema validation
- ❌ No referential integrity
- ❌ Hard to query efficiently
- ❌ No type safety
- ❌ No metadata about fields

**Molecules:**
```sql
-- Typed, validated, with metadata
molecule_def describes what each field means
molecule_value_lookup enforces valid lookups
Foreign keys maintain integrity
Indexes optimize queries
```

| Aspect | JSON/JSONB | Molecules |
|--------|-----------|-----------|
| Schema validation | None | Strong |
| Referential integrity | None | Foreign keys |
| Query performance | Slower (JSON ops) | Faster (indexes) |
| Type safety | Weak | Strong |
| Metadata | None | Rich |

### Entity-Attribute-Value (EAV) Approach

**Classic EAV:**
```sql
CREATE TABLE entity_attribute (
  entity_id BIGINT,
  attribute_name VARCHAR(100),
  attribute_value TEXT
);

-- Everything is TEXT
```

**Problems:**
- ❌ No type information
- ❌ No referential integrity
- ❌ Hard to query
- ❌ No metadata
- ❌ Poor performance

**Molecules are "EAV done right":**
- ✅ Typed (lookup, list, scalar with subtypes)
- ✅ Referential integrity (foreign keys)
- ✅ Rich metadata (molecule_def)
- ✅ Performance optimized (integer pointers)
- ✅ Universal encode/decode functions

---

## Implementation Patterns

### Pattern 1: Creating Molecules at Tenant Setup

```javascript
async function setupAirlineTenant(tenantId) {
  // Define core activity molecules
  await createMolecule(tenantId, {
    molecule_key: 'carrier',
    label: 'Carrier Code',
    context: 'activity',
    value_kind: 'lookup',
    lookup_table_key: 'airline'
  });
  
  await createMolecule(tenantId, {
    molecule_key: 'origin',
    label: 'Origin Airport',
    context: 'activity',
    value_kind: 'lookup',
    lookup_table_key: 'airport'
  });
  
  await createMolecule(tenantId, {
    molecule_key: 'fare_class',
    label: 'Fare Class',
    context: 'activity',
    value_kind: 'list'
  });
  
  // Add fare class values
  await addListValue(tenantId, 'fare_class', 'F', 'First Class');
  await addListValue(tenantId, 'fare_class', 'J', 'Business Class');
  await addListValue(tenantId, 'fare_class', 'Y', 'Economy Class');
}
```

### Pattern 2: Form-Driven Activity Creation

```javascript
async function createActivityFromForm(formData) {
  // Create base activity
  const activityId = await createActivity({
    member_id: formData.member_id,
    activity_date: formData.activity_date,
    activity_type: 'B',
    point_amount: formData.point_amount
  });
  
  // Encode and store each molecule
  for (const [moleculeKey, value] of Object.entries(formData.molecules)) {
    if (value) {  // Skip empty fields
      const vRefId = await encodeMolecule(tenantId, moleculeKey, value);
      await insertActivityDetail(activityId, moleculeKey, vRefId);
    }
  }
  
  return activityId;
}

// Usage
await createActivityFromForm({
  member_id: 2153442807,
  activity_date: '2025-11-07',
  point_amount: 1500,
  molecules: {
    carrier: 'DL',
    origin: 'MSP',
    destination: 'BOS',
    fare_class: 'F',
    flight_number: 'DL1234'
  }
});
```

### Pattern 3: Bulk Decode for Activity List

```javascript
async function loadActivitiesWithMolecules(memberId) {
  // Load activities
  const activities = await getActivities(memberId);
  
  // Load ALL molecules for ALL activities in one query
  const allMolecules = await query(`
    SELECT 
      ad.activity_id,
      md.molecule_key,
      md.value_kind,
      md.scalar_type,
      ad.v_ref_id
    FROM activity_detail ad
    JOIN molecule_def md ON ad.molecule_id = md.molecule_id
    WHERE ad.activity_id = ANY($1)
  `, [activities.map(a => a.activity_id)]);
  
  // Group by activity
  const moleculesByActivity = groupBy(allMolecules, 'activity_id');
  
  // Batch decode by type
  const lookupIds = allMolecules.filter(m => m.value_kind === 'lookup');
  const listIds = allMolecules.filter(m => m.value_kind === 'list');
  const textIds = allMolecules.filter(m => m.scalar_type === 'text');
  
  // Decode in batches
  const decodedLookups = await batchDecodeLookups(lookupIds);
  const decodedLists = await batchDecodeLists(listIds);
  const decodedTexts = await batchDecodeTexts(textIds);
  
  // Merge decoded values back to activities
  for (const activity of activities) {
    activity.molecules = mergeDe codedMolecules(
      moleculesByActivity[activity.activity_id],
      decodedLookups,
      decodedLists,
      decodedTexts
    );
  }
  
  return activities;
}
```

### Pattern 4: Cached Molecule Definitions

```javascript
// Cache molecule definitions at startup
const moleculeCache = new Map();

async function getMolecule(tenantId, moleculeKey) {
  const cacheKey = `${tenantId}:${moleculeKey}`;
  
  if (!moleculeCache.has(cacheKey)) {
    const molecule = await query(`
      SELECT * FROM molecule_def
      WHERE tenant_id = $1 AND molecule_key = $2
    `, [tenantId, moleculeKey]);
    
    moleculeCache.set(cacheKey, molecule);
  }
  
  return moleculeCache.get(cacheKey);
}

// Clear cache when molecule definitions change
async function updateMolecule(tenantId, moleculeKey, updates) {
  await query(`UPDATE molecule_def SET ... WHERE ...`);
  moleculeCache.delete(`${tenantId}:${moleculeKey}`);
}
```

---

## Future Extensions

### Embedded Lists

**Concept:** Store categorized lists in molecules

```sql
molecule_key: 'system_parameters'
value_kind: 'embedded_list'

-- Store lists like:
{
  'retro_days': 90,
  'max_accrual_per_day': 50000,
  'default_expiration_months': 12
}
```

**Use case:** Tenant configuration stored as molecules

### Computed Molecules

**Concept:** Molecules that derive from other molecules

```sql
molecule_key: 'total_revenue'
value_kind: 'computed'
formula: 'nights * room_rate'
```

**Use case:** Avoid storing redundant data

### Molecule Versions

**Concept:** Track molecule definition changes over time

```sql
molecule_def_version (
  version_id SERIAL,
  molecule_id INTEGER,
  label VARCHAR(100),
  valid_from DATE,
  valid_to DATE
)
```

**Use case:** Historical queries use definitions from that time period

### Molecule Constraints

**Concept:** Validation rules in molecule_def

```sql
molecule_def:
  min_value: 0
  max_value: 999999
  regex_pattern: '^[A-Z]{2}\d{4}$'
  required: true
```

**Use case:** Enforce data quality at molecule level

---

## Best Practices

### DO: Cache Molecule Definitions
```javascript
// Load once, use many times
const carrierMolecule = await getMolecule('carrier');  // Cache this

// Don't reload on every encode
for (const activity of activities) {
  await encodeMolecule('carrier', activity.carrier);  // Uses cached def
}
```

### DO: Batch Decode Operations
```javascript
// Load all molecules for 100 activities
const allMolecules = await loadMoleculesForActivities(activityIds);

// Decode in batches by type
const decoded = await batchDecode(allMolecules);

// Not: Loop through activities one at a time
```

### DO: Use Transactions for Activity Creation
```javascript
await db.transaction(async (trx) => {
  const activityId = await createActivity(data, trx);
  await insertActivityDetails(activityId, molecules, trx);
  await createPointLot(activityId, trx);
  // If any fails, all rolls back
});
```

### DON'T: Query Molecules One at a Time
```javascript
// ❌ BAD: N+1 queries
for (const molecule of molecules) {
  const value = await decodeMolecule(molecule.key, molecule.v_ref_id);
}

// ✅ GOOD: Batch query
const values = await batchDecodeMolecules(molecules);
```

### DON'T: Hardcode Molecule IDs
```javascript
// ❌ BAD: Brittle
const carrierId = 1;  // What if this changes?

// ✅ GOOD: Look up by key
const carrierId = await getMoleculeId('carrier');
```

### DON'T: Store Molecule Values Directly in Application
```javascript
// ❌ BAD: Duplicates database state
const fareClasses = ['F', 'J', 'Y'];  // Hardcoded

// ✅ GOOD: Load from database
const fareClasses = await getListValues('fare_class');
```

---

## Conclusion

The molecule system is the foundation that makes this loyalty platform truly universal. By abstracting all domain-specific data into typed, configurable "molecules," one codebase can serve airlines, hotels, credit cards, retail, and any future industry without code changes.

**Key Principles:**

✅ **Industry-agnostic** - One system for all  
✅ **Data-driven** - Configuration over code  
✅ **Self-documenting** - Metadata describes itself  
✅ **Flexible** - Add fields without schema changes  
✅ **Type-safe** - lookup/list/scalar with subtypes  
✅ **Performance-optimized** - Integer pointers, text deduplication  
✅ **Universal** - encode/decode works for all types  

**The molecule abstraction is what makes "everything is molecules" not just a slogan, but an architectural reality.**

---

**Status:** Core production architecture  
**Stability:** High - foundational system  
**Extensibility:** Unlimited - add molecules via configuration  
**Recommendation:** Preserve and protect - this is the secret sauce
