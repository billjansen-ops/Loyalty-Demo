# Program Molecules UI Installation Guide

## What Was Created

**New Page:**
- `admin_molecules.html` - Full molecule management interface

**Updated Files:**
- `admin.html` - Added "Program Molecules" card at top
- `lp-nav.js` - Added "Program Molecules" to left navigation (second item, after Overview)

## Installation

```bash
# Copy all three files to your project
cp ~/Downloads/admin_molecules.html ~/Projects/Loyalty-Demo/
cp ~/Downloads/admin.html ~/Projects/Loyalty-Demo/
cp ~/Downloads/lp-nav.js ~/Projects/Loyalty-Demo/
```

## Features of admin_molecules.html

### View & Filter
- Table showing all molecules with key properties
- Filter by Context (Activity, Member, Tenant)
- Filter by Type (Static config vs Transactional)
- Badges for easy visual identification:
  - Context: activity (blue), member (yellow), tenant (green)
  - Type: static (purple), transactional (pink)
  - Kind: scalar, list, lookup

### Add/Edit Molecules
- Modal form for creating/editing molecule definitions
- Fields:
  - Molecule Key (unique identifier)
  - Label (display name)
  - Context (activity/member/tenant)
  - Value Kind (scalar/list/lookup)
  - Data Type (text/numeric/date/boolean)
  - Description (help text)
  - Flags: Static, Permanent, Required
  - Display Order (for UI sorting)

### Smart Form Behavior
- When "lookup" is selected, shows lookup table field
- When "scalar" or "list" is selected, shows data type dropdown
- Permanent molecules can't have their key edited
- Permanent molecules can't be deleted

### Actions
- Edit - Modify molecule definition
- Delete - Remove molecule (disabled for permanent ones)
- Values - Manage list options (for list-type molecules)

## What It Looks Like

**Navigation:**
```
CLIENT ADMIN
├─ 📊 Overview
├─ 🧬 Program Molecules  ← NEW!
├─ 🎁 Bonuses
├─ ✈️ Carriers
├─ ⭐ Tiers
└─ 🌍 Airports
```

**Admin Overview Page:**
```
┌─────────────────────────────────┐
│ 📊 Program Molecules            │
│ Define configurable attributes  │
│ for activities, members, and    │
│ tenant settings - the           │
│ foundation of your program      │
│ [Manage Molecules →]            │
└─────────────────────────────────┘
```

## Current State

**Mock Data:**
The page currently displays mock molecules since the API endpoints don't exist yet:
- currency_label_singular (tenant, static, scalar text)
- retro_days_allowed (tenant, static, scalar numeric)
- fare_class (activity, transactional, list text)
- origin (activity, transactional, lookup to airport)

**API Integration:**
Once we build the API endpoints, the page will:
- Fetch real molecules from `/v1/molecules?tenant_id=X`
- Save molecules via POST `/v1/molecules`
- Update molecules via PUT `/v1/molecules/:id`
- Delete molecules via DELETE `/v1/molecules/:id`

## Next Steps

### Phase 1: Test the UI ✅
1. Open http://localhost:3000/admin.html
2. Click "Program Molecules" card or nav link
3. See mock molecules displayed
4. Try filtering by context and type
5. Click "Add Molecule" to see the form

### Phase 2: Build API Endpoints (Next)
1. Create molecule getter functions in server_db_api.js
2. Create REST API endpoints:
   - GET `/v1/molecules` - list all molecules for tenant
   - GET `/v1/molecules/:id` - get one molecule
   - POST `/v1/molecules` - create molecule
   - PUT `/v1/molecules/:id` - update molecule
   - DELETE `/v1/molecules/:id` - delete molecule
3. Update admin_molecules.html to use real API instead of mocks

### Phase 3: Manage List Values (Later)
Create `admin_molecule_values.html` to manage the child values for list-type molecules (like F, Y, C for fare_class).

## Testing Checklist

- [ ] Page loads without errors
- [ ] Mock molecules display in table
- [ ] Context filter works
- [ ] Type filter works
- [ ] "Add Molecule" button opens modal
- [ ] Modal form has all fields
- [ ] Value Kind changes show/hide appropriate fields
- [ ] Cancel button closes modal
- [ ] Save shows error (expected - no API yet)
- [ ] Edit button opens modal with populated data
- [ ] Delete button disabled for permanent molecules
- [ ] Navigation shows Program Molecules in correct position
- [ ] Admin overview card appears at top

## File Locations

```
~/Projects/Loyalty-Demo/
├── admin_molecules.html       # NEW - Molecule management page
├── admin.html                 # UPDATED - Added molecule card
├── lp-nav.js                  # UPDATED - Added molecule nav item
└── SQL/
    ├── molecule_system_migration.sql    # Already ran
    └── molecule_sample_data.sql         # Already ran
```

## Notes

- The icon used is 🧬 (DNA) to represent molecules
- Page follows existing design patterns from other admin pages
- Responsive layout using Tailwind CSS
- Works with existing tenant selector
- Mock data will be replaced with real API calls

---

**Next:** Build the API endpoints to make this functional!
