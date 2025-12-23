# Display Template Activity Type Updates
**Date:** November 10, 2025
**Changes:** Added activity_type support to display templates

---

## Summary

Updated the display template system to support different templates per activity type ('A', 'R', etc.). Activity types are sourced from the `activity_display` molecule (the source of truth).

---

## Database Changes

### SQL Script: `add_activity_type_to_display_template.sql`
- Added `activity_type` column (CHAR(1), defaults to 'A')
- Set existing templates to activity_type='A'
- Created unique constraint: only ONE active template per tenant/activity_type/template_type combo

**Result:** Each activity type can now have its own set of efficient and verbose templates.

---

## API Changes (server_db_api.js)

### GET /v1/display-templates
- Now returns `activity_type` in results
- Ordered by activity_type, template_type, is_active, template_name

### GET /v1/display-templates/:id
- Now returns `activity_type` field

### POST /v1/display-templates
- Now requires `activity_type` in request body
- Validates activity_type is provided
- Saves activity_type to database

### PUT /v1/display-templates/:id
- Now requires `activity_type` in request body
- Updates activity_type in database

### POST /v1/display-templates/:id/activate
- Now considers BOTH template_type AND activity_type when deactivating others
- Ensures only one active template per activity_type/template_type combo per tenant

---

## UI Changes

### List Page (admin_activity_display_templates.html)

**Added:**
- "Activity Type" column in table
- Loads activity type labels from `activity_display` molecule
- Displays human-readable activity type labels (e.g., "Flight" instead of "A")
- Updated activate confirmation to show activity type

**Updated:**
- Table now shows: Name | Activity Type | Type | Status | Lines | Actions
- Colspan updated from 5 to 6 for loading/empty states

### Edit Page (admin_activity_display_template_edit.html)

**Added:**
- Activity Type dropdown (between Name and Type fields)
- Populated from `activity_display` molecule categories
- Shows labels from molecule (e.g., "Flight" for 'A')
- Validation: activity_type is required
- Loads activity_type when editing existing template
- Sends activity_type when saving

**Updated:**
- Form row now has 3 fields: Name | Activity Type | Type
- Initialization calls `loadActivityTypes()` to populate dropdown

---

## How It Works

1. **Source of Truth:** Activity types come from `activity_display` molecule
   - Categories in molecule define valid activity types
   - Labels in molecule provide display text

2. **Template Organization:**
   - Each activity type ('A', 'R', etc.) has its own templates
   - Each activity type has an efficient template and verbose template
   - Only one template per type can be active at a time

3. **Example Templates:**
   - Activity 'A' Efficient: Shows flight details compactly
   - Activity 'A' Verbose: Shows flight details with full descriptions
   - Activity 'R' Efficient: Shows redemption type compactly
   - Activity 'R' Verbose: Shows redemption details with breakdown

---

## Testing Checklist

- [ ] SQL script runs without errors
- [ ] List page shows activity type column
- [ ] Activity type labels display correctly (from molecule)
- [ ] Edit page shows activity type dropdown
- [ ] Dropdown populated from molecule
- [ ] Can create new template with activity_type
- [ ] Can edit existing template and see activity_type loaded
- [ ] Activate works correctly (only deactivates same activity_type)
- [ ] Cannot have multiple active templates for same activity_type/template_type

---

## Files Changed

1. `sql/add_activity_type_to_display_template.sql` (NEW)
2. `server_db_api.js` (5 endpoints updated)
3. `admin_activity_display_templates.html` (list page)
4. `admin_activity_display_template_edit.html` (edit page)

---

## Next Steps

1. Run SQL script
2. Copy updated files to project directory
3. Restart server
4. Test creating templates for different activity types
5. Create redemption ('R') templates with appropriate molecules
