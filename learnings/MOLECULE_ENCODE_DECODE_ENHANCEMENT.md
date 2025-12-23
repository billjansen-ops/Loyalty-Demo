# Molecule Encode/Decode Enhancement - 4th Parameter

## Overview

Added optional 4th parameter to `encodeMolecule` and `decodeMolecule` functions to enable bidirectional conversion between text codes and display labels for list-type molecules.

## Use Case: State Dropdown with Efficient Storage

**Problem:** 
- UI dropdown shows "Minnesota", "California", etc.
- Database should store efficient 2-char codes: "MN", "CA"
- Bonus rules need to compare codes: "MN" = "MN"

**Solution:**
- State molecule stores: text_value="MN", display_label="Minnesota"
- Profile form calls: `encodeMolecule(1, 'state', 'Minnesota', true)` → returns "MN"
- Store "MN" in `member.state` (char(2) field)
- Reference molecule reads "MN" from database
- Bonus rule compares: member_state = "MN" ✓

## Function Signatures

### encodeMolecule

```javascript
async function encodeMolecule(tenantId, moleculeKey, value, returnTextValue = false)
```

**Parameters:**
- `tenantId` (number) - Tenant ID (e.g., 1)
- `moleculeKey` (string) - Molecule key (e.g., 'state')
- `value` (any) - Input value to encode
- `returnTextValue` (boolean, optional) - Default: false

**Behavior for list-type molecules:**

| returnTextValue | Matches On     | Returns       | Example                                    |
|-----------------|----------------|---------------|--------------------------------------------|
| false (default) | text_value     | value_id      | encodeMolecule(1, 'state', 'MN') → 27      |
| true            | display_label  | text_value    | encodeMolecule(1, 'state', 'Minnesota', true) → 'MN' |

**Non-list molecules:** returnTextValue parameter is ignored (no effect)

### decodeMolecule

```javascript
async function decodeMolecule(tenantId, moleculeKey, inputValue, returnDisplayLabel = false)
```

**Parameters:**
- `tenantId` (number) - Tenant ID (e.g., 1)
- `moleculeKey` (string) - Molecule key (e.g., 'state')
- `inputValue` (number|string) - Value to decode (number when returnDisplayLabel=false, string when true)
- `returnDisplayLabel` (boolean, optional) - Default: false

**Behavior for list-type molecules:**

| returnDisplayLabel | Matches On     | Returns        | Example                                      |
|--------------------|----------------|----------------|----------------------------------------------|
| false (default)    | value_id       | text_value     | decodeMolecule(1, 'state', 27) → 'MN'        |
| true               | text_value     | display_label  | decodeMolecule(1, 'state', 'MN', true) → 'Minnesota' |

**Non-list molecules:** returnDisplayLabel parameter is ignored (no effect)

## API Endpoints

### GET /v1/molecules/encode

**Query Parameters:**
- `tenant_id` (required) - Tenant ID
- `key` (required) - Molecule key
- `value` (required) - Value to encode
- `return_text` (optional) - Set to "true" to return text_value instead of value_id

**Examples:**
```
# Normal usage - returns value_id
GET /v1/molecules/encode?tenant_id=1&key=state&value=MN
Response: { "molecule_key": "state", "input_value": "MN", "encoded_id": 27 }

# With return_text=true - returns text_value
GET /v1/molecules/encode?tenant_id=1&key=state&value=Minnesota&return_text=true
Response: { "molecule_key": "state", "input_value": "Minnesota", "encoded_id": "MN" }
```

### GET /v1/molecules/decode

**Query Parameters:**
- `tenant_id` (required) - Tenant ID
- `key` (required) - Molecule key
- `id` (required) - Value to decode (number or string depending on return_display)
- `return_display` (optional) - Set to "true" to return display_label instead of text_value

**Examples:**
```
# Normal usage - returns text_value
GET /v1/molecules/decode?tenant_id=1&key=state&id=27
Response: { "molecule_key": "state", "input_id": 27, "decoded_value": "MN" }

# With return_display=true - returns display_label
GET /v1/molecules/decode?tenant_id=1&key=state&id=MN&return_display=true
Response: { "molecule_key": "state", "input_id": "MN", "decoded_value": "Minnesota" }
```

## Code Changes

### molecule_encode_decode.js

**encodeMolecule:**
- Added 4th parameter: `returnTextValue = false`
- For list type molecules:
  - When false: Match on `text_value`, return `value_id` (existing behavior)
  - When true: Match on `display_label`, return `text_value` (NEW)
- Renamed variable `id` to `inputValue` for clarity

**decodeMolecule:**
- Added 4th parameter: `returnDisplayLabel = false`
- Renamed parameter `id` to `inputValue` (can now be string or number)
- For list type molecules:
  - When false: Match on `value_id`, return `text_value` (existing behavior)
  - When true: Match on `text_value`, return `display_label` (NEW)
- Fixed bug: Changed `SELECT value` to `SELECT text_value` (correct column name)

### server_db_api.js

**Encode endpoint:**
- Added `return_text` query parameter
- Passes boolean to encodeMolecule function

**Decode endpoint:**
- Added `return_display` query parameter
- Handles inputValue as string or number based on parameter
- Passes boolean to decodeMolecule function

## Backwards Compatibility

✅ **100% backwards compatible**

All existing code using 3-parameter calls works exactly as before:
- `encodeMolecule(1, 'state', 'MN')` → returns value_id (number)
- `decodeMolecule(1, 'state', 27)` → returns text_value (string)

The 4th parameter is optional with safe defaults.

## Testing

### Test encodeMolecule with return_text=true

**Setup:** State molecule with MN/Minnesota in database

**Test:**
```javascript
const code = await encodeMolecule(1, 'state', 'Minnesota', true);
console.log(code); // Should print: "MN"
```

**Or via API:**
```bash
curl "http://localhost:4001/v1/molecules/encode?tenant_id=1&key=state&value=Minnesota&return_text=true"
```

### Test decodeMolecule with return_display=true

**Test:**
```javascript
const name = await decodeMolecule(1, 'state', 'MN', true);
console.log(name); // Should print: "Minnesota"
```

**Or via API:**
```bash
curl "http://localhost:4001/v1/molecules/decode?tenant_id=1&key=state&id=MN&return_display=true"
```

## Files Changed

1. `/molecule_encode_decode.js` - Core encode/decode functions
2. `/server_db_api.js` - API endpoints

## Next Steps

1. Deploy updated files
2. Test with state molecule
3. Implement state dropdown in profile page using new functionality
4. Create reference molecule for member_state to enable bonus rule comparisons
