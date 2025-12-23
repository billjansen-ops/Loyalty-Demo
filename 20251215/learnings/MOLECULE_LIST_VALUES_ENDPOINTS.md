# Molecule List Values - Endpoints Added

## Problem
When adding carriers (DL, AA, NW) to the carrier molecule, they weren't saving. The endpoints to manage list values didn't exist yet.

## Solution
Added three new endpoints to server_db_api.js:

### 1. POST /v1/molecules/:id/values
**Purpose:** Add a new option to a list molecule

**Request Body:**
```json
{
  "tenant_id": 1,
  "value": "DL",
  "label": "Delta Air Lines"
}
```

**Response:**
```json
{
  "value_id": 123,
  "value": "DL",
  "label": "Delta Air Lines",
  "sort_order": 1
}
```

### 2. PUT /v1/molecules/:id/values/:valueId
**Purpose:** Update an existing list option

**Request Body:**
```json
{
  "tenant_id": 1,
  "value": "DL",
  "label": "Delta Air Lines",
  "sort_order": 1
}
```

### 3. DELETE /v1/molecules/:id/values/:valueId
**Purpose:** Delete a list option

**Query Parameter:** `?tenant_id=1`

**Response:**
```json
{
  "message": "Value deleted",
  "value_id": 123
}
```

## Files Modified

### server_db_api.js
- Added 3 endpoints (POST, PUT, DELETE) for managing list values
- Inserted after line 1983, before bonus engine section

### admin_molecule_edit.html  
- Updated `saveValue()` function to call real API (was mock data)
- Updated `deleteValue()` function to call real API (was mock data)
- Both functions now reload values from server after save/delete

## How to Install

1. Stop server if running
2. Copy files:
   ```bash
   cp server_db_api.js ~/Projects/Loyalty-Demo/
   cp admin_molecule_edit.html ~/Projects/Loyalty-Demo/
   ```
3. Restart server:
   ```bash
   cd ~/Projects/Loyalty-Demo
   node server_db_api.js
   ```

## Testing

1. Go to admin_molecule_edit.html?id=<carrier_molecule_id>
2. Click "+ Add Option"
3. Enter:
   - Code: DL
   - Label: Delta Air Lines
4. Save
5. Refresh page - DL should still be there
6. Add AA, NW the same way

## Next Steps

Once carrier values are saved:
1. Update bonus_test.html to load carriers from molecule (dropdown instead of text input)
2. Change carrier label to be dynamic from molecule
3. Test in test rig
