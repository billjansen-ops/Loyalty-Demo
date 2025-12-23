# Reference Molecules in Bonus Engine - COMPLETE

## Overview
The bonus engine now fully supports Reference molecules in rule criteria. This means bonus rules can check member profile data (like first name, last name, email, etc.) when evaluating whether to apply a bonus.

## What Changed

### 1. Updated `getMoleculeValue()` Function

**Location:** `server_db_api.js` line ~4886

**Before:** Only handled scalar molecules (text/numeric values from `molecule_value_text` and `molecule_value_numeric`)

**After:** Now handles three types:
- **Scalar** - Static values (existing behavior)
- **Reference** - Dynamic lookups from database tables
- **Function** - Placeholder for future function calls

**New signature:**
```javascript
async function getMoleculeValue(tenantId, moleculeKey, context = {})
```

**Context object structure:**
```javascript
{
  member_id: '2153442807',  // Required for member table references
  // Future: activity_id, program_id, etc.
}
```

**How it works for Reference molecules:**
1. Query `molecule_def` to get `ref_table_name` and `ref_field_name`
2. If table is `member` and context has `member_id`, dynamically query that table/field
3. Return the resolved value for comparison

**Example:**
```javascript
// Molecule: member_fname (references member.fname)
const context = { member_id: '2153442807' };
const value = await getMoleculeValue(1, 'member_fname', context);
// Returns: "Bill"
```

### 2. Added Reference Support to Bonus Evaluation

**Location:** `server_db_api.js` `evaluateBonuses()` function, line ~4634

**When evaluating criteria:**
- Detects `value_kind = 'reference'`
- Gets member_id from activity record
- Passes it as context to `getMoleculeValue()`
- Compares resolved value against criterion value
- Supports `equals` and `contains` operators

**Logging:**
```
→ Resolving reference molecule: member_fname
→ Resolved value: Bill
✅ PASS: Bill === Bill
```

### 3. Added Reference Support to Test Rule Endpoint

**Location:** `server_db_api.js` `POST /v1/test-rule/:bonusCode`, line ~1669

**Changes:**
- Added new `else if` case for `moleculeDef.value_kind === 'reference'`
- Requires `member_id` in request body for testing reference molecules
- Resolves the reference and compares
- Supports `equals` and `contains` operators

**Test request example:**
```json
POST /v1/test-rule/BONUS001
{
  "member_id": "2153442807",  // <-- New! Required for reference molecules
  "activity_date": "2024-11-01",
  "carrier": "AA",
  "origin": "MSP"
}
```

## Supported Operators

For Reference molecules in criteria:
- ✅ **equals** / **=** - Exact match
- ✅ **contains** - Substring match (case-insensitive)
- 🚧 **starts_with** - Coming soon
- 🚧 **ends_with** - Coming soon
- 🚧 **regex** - Coming soon

## How to Use

### Create a Reference Molecule

1. Go to `admin_molecules.html`
2. Click "+ Create Molecule"
3. Fill in:
   - **Key**: `member_fname`
   - **Label**: `Member First Name`
   - **Context**: `Member` or `System`
   - **Type**: `Reference`
   - **Subtype**: `Direct Field`
   - **Table Name**: `member`
   - **Field Name**: `fname`
4. Save

### Create a Bonus Rule Using Reference

1. Go to `admin_rules.html`
2. Create a rule with criteria:
   - **Molecule**: `member_fname`
   - **Operator**: `equals`
   - **Value**: `Bill`
3. Save rule

### Apply to Bonus

1. Go to `admin_bonuses.html`
2. Create/edit a bonus
3. Select the rule you just created
4. Save

### Test It

**Option A: Via Test Rule Page**
1. Go to bonus test page
2. Enter `member_id` in the test data
3. Test the rule

**Option B: Via Activity Creation**
1. Create an activity for a member with fname = "Bill"
2. Bonus engine will automatically evaluate
3. If criteria match, bonus applies

## Current Limitations

### Only Member Table Supported
Currently, Reference molecules only work for the `member` table. To add support for other tables:

```javascript
// In getMoleculeValue()
if (tableName === 'member' && context.member_id) {
  // ... existing code
} else if (tableName === 'activity' && context.activity_id) {
  const refQuery = `SELECT ${fieldName} FROM ${tableName} WHERE activity_id = $1`;
  const refResult = await dbClient.query(refQuery, [context.activity_id]);
  // ...
}
```

### Function References Not Implemented
Reference molecules with `ref_function_name` return `null`. To implement:

```javascript
if (row.ref_function_name) {
  // Call the function with appropriate parameters
  const funcQuery = `SELECT ${row.ref_function_name}($1, $2)`;
  const result = await dbClient.query(funcQuery, [context.member_id, context.activity_date]);
  return result.rows[0][row.ref_function_name];
}
```

### No Context Validation
The code assumes member_id exists in context when needed. Should add:

```javascript
if (tableName === 'member' && !context.member_id) {
  throw new Error(`Reference molecule ${moleculeKey} requires member_id in context`);
}
```

## Testing Scenarios

### Scenario 1: Exact Match on First Name
**Setup:**
- Molecule: `member_fname` → `member.fname`
- Rule: `member_fname equals "Bill"`
- Member: Bill Jansen (fname = "Bill")

**Result:** ✅ Bonus applies

### Scenario 2: Contains Match on Email
**Setup:**
- Molecule: `member_email` → `member.email`
- Rule: `member_email contains "@anthropic.com"`
- Member: bill@anthropic.com

**Result:** ✅ Bonus applies

### Scenario 3: No Match
**Setup:**
- Molecule: `member_fname` → `member.fname`
- Rule: `member_fname equals "John"`
- Member: Bill Jansen (fname = "Bill")

**Result:** ❌ Bonus does NOT apply

### Scenario 4: Multiple Criteria (AND logic)
**Setup:**
- Rule Criteria:
  1. `member_fname equals "Bill"` (AND)
  2. `carrier equals "AA"`
- Member: Bill Jansen, Activity: Carrier=AA

**Result:** ✅ Both criteria pass, bonus applies

### Scenario 5: Multiple Criteria (OR logic)
**Setup:**
- Rule Criteria:
  1. `member_fname equals "Bill"` (OR)
  2. `member_fname equals "John"`
- Member: Bill Jansen

**Result:** ✅ First criterion passes, bonus applies

## Console Logging

When a Reference molecule is evaluated, you'll see:

```
🎁 BONUS ENGINE: Evaluating bonuses for activity 123
   → Checking bonus: WELCOME_BILL
      → Checking criteria for rule_id: 5
      → Found 1 criteria to check
         → Resolving reference molecule: member_fname
         → Resolved value: Bill
         ✅ PASS: Bill === Bill
      ✅ PASS - All criteria matched!
💰 APPLYING BONUS: WELCOME_BILL to activity 123
```

## Database Schema

Reference molecules use these fields in `molecule_def`:

```sql
CREATE TABLE molecule_def (
  molecule_id SERIAL PRIMARY KEY,
  value_kind VARCHAR(20),      -- 'reference' for these
  ref_table_name VARCHAR(64),   -- e.g., 'member'
  ref_field_name VARCHAR(64),   -- e.g., 'fname'
  ref_function_name VARCHAR(64) -- e.g., 'get_member_tier'
);
```

No additional child tables needed for Reference molecules (unlike Scalar which uses `molecule_value_text`).

## Performance Considerations

Each Reference molecule in a criterion requires an additional database query:
- Scalar molecule: 0 extra queries (values pre-stored)
- Reference molecule: 1 extra query per criterion evaluation

For a bonus with 3 reference criteria evaluated against 100 activities:
- 300 total reference lookups
- Mitigated by PostgreSQL's query performance
- Consider adding caching for high-volume scenarios

## Future Enhancements

1. **Caching**: Cache resolved reference values for the duration of bonus evaluation
2. **More operators**: Add `>`, `<`, `>=`, `<=`, `between`, `in`, `not in`
3. **More tables**: Support activity, program, tenant table references
4. **Function support**: Execute stored functions with parameters
5. **Nested references**: Reference molecules that reference other molecules
6. **Validation**: Check that ref_table_name/ref_field_name exist before saving

## Files Modified

- `server_db_api.js`:
  - Updated `getMoleculeValue()` function
  - Updated `evaluateBonuses()` function
  - Updated `POST /v1/test-rule/:bonusCode` endpoint

## Breaking Changes

None! This is backward compatible:
- Existing scalar molecules work exactly as before
- Only adds new functionality for reference molecules
- Default context = {} means no context, which is safe

## Summary

✅ Reference molecules now work in bonus criteria  
✅ Bonus engine resolves member profile data dynamically  
✅ Test rule endpoint supports reference molecules  
✅ Supports equals and contains operators  
✅ Full logging for debugging  
✅ Backward compatible with existing molecules  

**Example Use Cases:**
- Welcome bonuses for specific member names
- Birthday bonuses based on date of birth
- VIP bonuses for members with certain email domains
- Location-based bonuses using member address
- Tenure bonuses based on member.created_at
