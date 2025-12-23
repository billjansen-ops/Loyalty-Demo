# Molecule Edit Page - Installation Guide

## What We Built

**New Page:** `admin_molecule_edit.html`
**Updated:** `admin_molecules.html` (Edit button now navigates to detail page)

## Features

### For Simple Text Values (e.g., currency_label_singular):
```
┌────────────────────────────────────┐
│ Edit: Currency Label (Singular)   │
├────────────────────────────────────┤
│ Molecule Definition (read-only)   │
│ - Key: currency_label_singular    │
│ - Label: Currency Label (Singular)│
│ - Context: tenant                  │
│ - Value Kind: scalar               │
├────────────────────────────────────┤
│ Value Editor                       │
│ Currency Label (Singular)          │
│ [mile________________]             │
│                                    │
│ [← Back]  [Save Changes]           │
└────────────────────────────────────┘
```

### For List Values (e.g., fare_class):
```
┌────────────────────────────────────┐
│ Edit: Fare Class                   │
├────────────────────────────────────┤
│ Molecule Definition (read-only)   │
│ - Key: fare_class                  │
│ - Label: Fare Class                │
│ - Context: activity                │
│ - Value Kind: list                 │
├────────────────────────────────────┤
│ Value Editor                       │
│ List Options      [+ Add Option]   │
│                                    │
│ ┌──────────────────────────────┐   │
│ │ F   First Class   [Edit] [X] │   │
│ │ C   Business      [Edit] [X] │   │
│ │ Y   Economy       [Edit] [X] │   │
│ └──────────────────────────────┘   │
│                                    │
│ [← Back]  [Save Changes]           │
└────────────────────────────────────┘
```

### For Lookup Values (e.g., origin):
```
┌────────────────────────────────────┐
│ Edit: Origin                       │
├────────────────────────────────────┤
│ Molecule Definition (read-only)   │
│ - Key: origin                      │
│ - Label: Origin                    │
│ - Context: activity                │
│ - Value Kind: lookup               │
├────────────────────────────────────┤
│ Value Editor                       │
│ This molecule references the       │
│ airport table. Values are stored   │
│ in activity_detail.                │
│                                    │
│ [← Back]                           │
└────────────────────────────────────┘
```

## Installation

```bash
cp ~/Downloads/admin_molecule_edit.html ~/Projects/Loyalty-Demo/
cp ~/Downloads/admin_molecules.html ~/Projects/Loyalty-Demo/
```

## How to Test

1. Open http://localhost:3000/admin_molecules.html
2. Click "Edit" on **currency_label_singular**
3. Should see edit page with "mile" in the value field
4. Change to "kilometer"
5. Click "Save Changes" (shows alert - API not built yet)

OR

1. Click "Edit" on **fare_class**  
2. Should see list with F, C, Y options
3. Click "Edit" on one
4. Modify it in the modal
5. Click "+ Add Option" to add new ones

## Current State

**✅ UI Complete:**
- Edit page loads
- Shows molecule definition (read-only header)
- Shows appropriate editor based on type
- List editor has add/edit/delete
- Mock data displays correctly

**🚧 Not Yet Built:**
- Backend API endpoints
- Real data loading
- Actual save functionality

## Next Steps

Once you test the UI and confirm it looks right:

1. Build getter functions in `server_db_api.js`:
   - `getMoleculeById(moleculeId)`
   - `getMoleculeValue(moleculeId, tenantId)`
   - `getMoleculeListValues(moleculeId, tenantId)`

2. Build API endpoints in `server.js`:
   - `GET /v1/molecules/:id`
   - `GET /v1/molecules/:id/value?tenant_id=X`
   - `PUT /v1/molecules/:id/value`
   - `GET /v1/molecules/:id/values?tenant_id=X`
   - `POST /v1/molecules/:id/values`
   - `PUT /v1/molecules/:id/values/:valueId`
   - `DELETE /v1/molecules/:id/values/:valueId`

3. Replace mock data with real API calls

## Mock Data Available

The page has mock data for testing:
- currency_label_singular = "mile"
- retro_days_allowed = 365
- fare_class = F, C, Y options
- origin = lookup to airport

## Pattern Match

This follows the EXACT same pattern as:
- `admin_bonus_edit.html` (top = definition, bottom = rules)
- `admin_carrier_edit.html` (top = info, bottom = actions)
- `admin_tier_edit.html` (top = tier info, bottom = benefits)

**Top section:** Definition (what it is)
**Bottom section:** Values (what it contains)

---

Test the UI first, then we'll build the backend!
