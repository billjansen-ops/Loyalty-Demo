# Hardcoded Issues Analysis - November 5, 2025

## Summary
Found multiple locations where logic is hardcoded instead of being data-driven. These violate the core architectural principle: "Data drives behavior, not hardcoded logic."

---

## ✅ FIXED Issues

### 1. encodeMolecule - Hardcoded tableMap (Line 1852-1856)
**Status:** FIXED

**Original Code:**
```javascript
const tableMap = {
  'carrier': { table: 'carrier', column: 'carrier_code' },
  'airport': { table: 'airport', column: 'airport_code' },
  'hotel_brand': { table: 'hotel_brand', column: 'brand_code' },
};
```

**Problem:** 
- Adding new lookup molecules requires code changes
- Defeats the purpose of molecule abstraction
- Not industry-agnostic

**Solution Implemented:**
```javascript
// Read metadata from molecule_value_lookup (data-driven approach)
const metadataQuery = `
  SELECT table_name, id_column, code_column
  FROM molecule_value_lookup
  WHERE molecule_id = $1
`;
```

**Impact:** Now adding new lookup molecules only requires database inserts, zero code changes.

---

### 2. decodeMolecule - Hardcoded tableMap (Line 2000-2004)
**Status:** FIXED

**Original Code:**
```javascript
const tableMap = {
  'carrier': { table: 'carrier', column: 'carrier_code', idColumn: 'carrier_id' },
  'airport': { table: 'airport', column: 'airport_code', idColumn: 'airport_id' },
  'hotel_brand': { table: 'hotel_brand', column: 'brand_code', idColumn: 'brand_id' },
};
```

**Problem:** Same as encodeMolecule - hardcoded table mappings

**Solution Implemented:** Same data-driven approach reading from molecule_value_lookup

---

## ❌ UNFIXED Issues (Require Analysis)

### 3. activityMolecules - Hardcoded List (Line 1348)
**Status:** NOT YET FIXED

**Location:** Rule criteria retrieval endpoint

**Code:**
```javascript
const activityMolecules = ['carrier', 'origin', 'destination', 'fare_class', 'flight_number'];
const source = activityMolecules.includes(row.molecule_key.toLowerCase()) ? 'Activity' : 'Member';
```

**Problem:** 
- Hardcodes which molecules belong to Activity vs Member
- Adding new activity molecules requires code change
- Should read from molecule_def.context field

**Suggested Solution:**
Read from molecule_def where context='activity' or context='member'

**Priority:** Medium - Affects UI display logic but doesn't break functionality

---

### 4. Activity Query - Hardcoded JOIN List (Lines 494-501)
**Status:** NOT YET FIXED

**Location:** Member activity retrieval query

**Code:**
```sql
LEFT JOIN activity_detail carrier_detail ON a.activity_id = carrier_detail.activity_id AND carrier_detail.k = 'carrier'
LEFT JOIN carriers carrier ON carrier_detail.v_ref_id = carrier.carrier_id
LEFT JOIN activity_detail origin_detail ON a.activity_id = origin_detail.activity_id AND origin_detail.k = 'origin'
LEFT JOIN airports origin ON origin_detail.v_ref_id = origin.airport_id
LEFT JOIN activity_detail dest_detail ON a.activity_id = dest_detail.activity_id AND dest_detail.k = 'destination'
LEFT JOIN airports dest ON dest_detail.v_ref_id = dest.airport_id
LEFT JOIN activity_detail flight_detail ON a.activity_id = flight_detail.activity_id AND flight_detail.k = 'flight_number'
LEFT JOIN activity_detail fare_detail ON a.activity_id = fare_detail.activity_id AND fare_detail.k = 'fare_class'
```

**Problem:**
- Hardcodes specific molecules to retrieve
- Hardcodes which tables to join
- Adding new molecules requires SQL modification
- Not industry-agnostic

**Suggested Solution:**
Two approaches:
1. **Simple:** Retrieve all activity_detail rows, decode in application layer
2. **Advanced:** Dynamic SQL generation based on molecule_def for the tenant

**Priority:** Medium - This is display logic, not core business logic

**Note:** This might be acceptable hardcoding for performance reasons (avoids N+1 queries), but should be reconsidered if we add many new molecule types.

---

### 5. Test Data Script - Hardcoded Molecule Inserts (Line 3144-3146)
**Status:** NOT YET FIXED

**Location:** Test activity creation script

**Code:**
```javascript
const detailInserts = [
  { k: 'carrier', v_ref_id: carrierId, raw: carrier.toUpperCase() },
  { k: 'origin', v_ref_id: originId, raw: origin.toUpperCase() },
  { k: 'destination', v_ref_id: destId, raw: destination.toUpperCase() }
];
```

**Problem:**
- Hardcodes which molecules to insert for test activities
- Test script is airline-specific

**Suggested Solution:**
This is test/demo code - might be acceptable to leave hardcoded since it's not production logic

**Priority:** Low - Test code, not production

---

## 🎯 Priority Assessment

### High Priority (Block Production)
- ✅ encodeMolecule tableMap - FIXED
- ✅ decodeMolecule tableMap - FIXED

### Medium Priority (Limit Flexibility)
- ❌ activityMolecules hardcoded list (Line 1348)
- ❌ Activity query hardcoded JOINs (Lines 494-501)

### Low Priority (Test/Demo Code)
- ❌ Test data script hardcoded molecules (Line 3144)

---

## 📋 Recommendations

### Immediate Actions
1. ✅ Fix encode/decode functions - COMPLETE
2. Test encode/decode with curl commands
3. Verify molecule_value_lookup has required data

### Short Term
1. Fix activityMolecules list - read from molecule_def.context
2. Consider activity query approach (simple vs advanced)

### Long Term
1. Review all SQL queries for hardcoded molecule references
2. Consider dynamic query generation for complex joins
3. Document acceptable vs unacceptable hardcoding patterns

---

## 💡 Architectural Principle Reminder

**From SECRET_SAUCE:**
> "The test of elegance: Adding a new industry, new data type, or new feature should only require database inserts, not code changes."

**Current Status:**
- ✅ encode/decode: Now pass the test (database inserts only)
- ❌ Activity queries: Fail the test (require code changes)
- ❌ Criteria source logic: Fails the test (require code changes)

---

## 🔍 How to Find More Issues

Search patterns to identify hardcoded logic:
```bash
# Find hardcoded molecule keys
grep -n "'carrier'\|'origin'\|'destination'\|'fare_class'" server_db_api.js

# Find hardcoded table names
grep -n "'carriers'\|'airports'\|'hotel_brand'" server_db_api.js

# Find hardcoded molecule lists
grep -n "\['carrier'" server_db_api.js
```

---

**Analysis Date:** November 5, 2025
**Analyzed By:** Claude (Session Nov 5 Evening)
**Critical Issues Fixed:** 2 of 2
**Non-Critical Issues Remaining:** 3 identified
