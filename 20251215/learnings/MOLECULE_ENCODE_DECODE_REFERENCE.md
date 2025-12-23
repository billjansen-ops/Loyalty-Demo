# Molecule Encode/Decode Quick Reference

## 🎯 The Two Universal Functions

```javascript
encodeMolecule(tenantId, moleculeKey, value) → integer
decodeMolecule(tenantId, moleculeKey, integer) → value
```

**Application code never needs to know which table, which type, or how to join!**

---

## 📊 Molecule Type Handling Matrix

| Molecule Type | Example | Storage | encode() Logic | decode() Logic |
|---------------|---------|---------|----------------|----------------|
| **LOOKUP → Foreign Table** | origin='MSP' | airport_id=17 | Query `airport` WHERE code='MSP' | Query `airport` WHERE id=17 |
| **LIST → Value Set** | fare_class='C' | value_id=42 | Query `molecule_value_text` WHERE value='C' | Query `molecule_value_text` WHERE id=42 |
| **SCALAR Numeric** | flight_number=1247 | 1247 | Return value as-is | Return id as-is |
| **SCALAR Text** | confirmation='ABC' | text_id=1 | Upsert `molecule_text_pool`, +usage_count | Query `molecule_text_pool` WHERE id=1 |
| **SCALAR Date** | activity_date | TBD | Not yet implemented | Not yet implemented |
| **SCALAR Boolean** | is_confirmed | TBD | Not yet implemented | Not yet implemented |

---

## 🔍 Examples by Molecule

### Flight Activity Molecules

| Molecule | Type | Value Example | Encoded Storage | Where It Points |
|----------|------|---------------|-----------------|-----------------|
| carrier | LOOKUP | 'DL' | carrier_id=7 | carrier table |
| origin | LOOKUP | 'MSP' | airport_id=17 | airport table |
| destination | LOOKUP | 'LAX' | airport_id=89 | airport table |
| fare_class | LIST | 'C' | value_id=42 | molecule_value_text |
| flight_number | NUMERIC | 1247 | 1247 | Direct value |
| confirmation_code | TEXT | 'ABC123' | text_id=1 | molecule_text_pool |

### Hotel Activity Molecules (Future)

| Molecule | Type | Value Example | Encoded Storage | Where It Points |
|----------|------|---------------|-----------------|-----------------|
| hotel_brand | LOOKUP | 'MARRIOTT' | brand_id=5 | hotel_brand table |
| property | LOOKUP | 'JW001' | property_id=123 | hotel_property table |
| room_nights | NUMERIC | 3 | 3 | Direct value |
| special_request | TEXT | 'Late checkout' | text_id=7 | molecule_text_pool |

---

## 💾 Child Record Structure

### BEFORE (Broken - Mixed Types):
```javascript
activity_flight {
  activity_id: 1234,
  carrier: "DL",              // ❌ STRING (18 bytes)
  origin: "MSP",              // ❌ STRING (12 bytes)
  destination: "LAX",         // ❌ STRING (12 bytes)
  fare_class: "C",            // ❌ STRING (2 bytes)
  flight_number: 1247         // ✅ INTEGER (4 bytes)
}
// Total: ~48 bytes
```

### AFTER (Fixed - Pure Integers):
```javascript
activity_flight {
  activity_id: 1234,          // INTEGER
  carrier_id: 7,              // INTEGER (4 bytes)
  origin_id: 17,              // INTEGER (4 bytes)
  destination_id: 89,         // INTEGER (4 bytes)
  fare_class_id: 42,          // INTEGER (4 bytes)
  flight_number: 1247,        // INTEGER (4 bytes)
  confirmation_code_id: 1     // INTEGER (4 bytes)
}
// Total: ~28 bytes (42% smaller!)
```

**Benefits:**
- ✅ Pure integers = cache-friendly
- ✅ Fast joins (integer indexes)
- ✅ Smaller storage
- ✅ Text deduplication
- ✅ Uniform handling

---

## 🎨 Text Pool Deduplication in Action

### First Entry:
```javascript
encodeMolecule(1, 'confirmation_code', 'ABC123')
→ Inserts into molecule_text_pool
→ Returns text_id = 1
```

**molecule_text_pool table:**
```
text_id | text_value | usage_count
--------|------------|-------------
1       | ABC123     | 1
```

### Second Entry (Same Text):
```javascript
encodeMolecule(1, 'confirmation_code', 'ABC123')
→ Finds existing text_id = 1
→ Increments usage_count to 2
→ Returns text_id = 1
```

**molecule_text_pool table:**
```
text_id | text_value | usage_count
--------|------------|-------------
1       | ABC123     | 2
```

### 1000 Flights Later:
```
text_id | text_value | usage_count
--------|------------|-------------
1       | ABC123     | 1000
```

**Storage saved:** 999 duplicate strings eliminated! Only 1 copy stored.

---

## 🔧 Adding New Molecule Types

### Step 1: Define in molecule_def
```sql
INSERT INTO molecule_def (
  tenant_id, molecule_key, label, 
  context, value_kind, scalar_type, lookup_table_key
) VALUES (
  1, 'hotel_brand', 'Hotel Brand',
  'activity', 'lookup', null, 'hotel_brand'
);
```

### Step 2: Update tableMap in encode/decode functions
```javascript
const tableMap = {
  'carrier': { table: 'carrier', column: 'carrier_code' },
  'airport': { table: 'airport', column: 'airport_code' },
  'hotel_brand': { table: 'hotel_brand', column: 'brand_code' }, // ← Add this
};
```

### Step 3: Use it!
```javascript
const brandId = await encodeMolecule(1, 'hotel_brand', 'MARRIOTT');
// Works immediately! No other code changes needed.
```

---

## 🚀 Why This Is Brilliant

1. **Universal Abstraction**
   - Add 100 new molecule types
   - Zero changes to application code
   - Just update molecule_def and tableMap

2. **Performance**
   - All integers = cache-friendly
   - Fast joins on integer FKs
   - Text deduplication = space savings

3. **Maintainability**
   - Two functions handle everything
   - No scattered if/else logic
   - Single source of truth

4. **Flexibility**
   - Support any industry (airline, hotel, retail)
   - Easy to add new lookup tables
   - Text pool handles free-form data

5. **Analytics**
   - usage_count tracks text patterns
   - Spot duplicates and typos
   - Optimize frequently-used values

---

## 🎯 Testing Checklist

- [ ] LOOKUP molecule: origin → airport table (round trip works)
- [ ] LIST molecule: fare_class → molecule_value_text (round trip works)
- [ ] NUMERIC scalar: flight_number passes through unchanged
- [ ] TEXT scalar: confirmation_code uses text pool with deduplication
- [ ] Duplicate text increments usage_count
- [ ] All functions throw proper errors for invalid inputs
- [ ] Server restarts cleanly
- [ ] All existing pages still work (haven't broken anything)

---

**Once all tests pass → Move to Phase 2: UI Integration!**
