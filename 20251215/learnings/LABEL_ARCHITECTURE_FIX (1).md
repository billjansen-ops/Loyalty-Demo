# Label Architecture & Add Activity Fix

## What Was Done

### 1. ✅ Created `add_activity.html` (Generic, Label-Driven)
**Replaces:** hardcoded `add_flight.html`

**Key Features:**
- Uses tenant label system: `activity.type.flight`
  - Airlines: "Flight"
  - Hotels: "Stay"
  - Retail: "Transaction"
- Page title dynamically updates: "Add {Flight/Stay/Transaction}"
- Points label: "Base {Miles/Points/Credits}"
- Same form works for ALL industries

### 2. ✅ Updated `activity.html` 
**Changed link from:**
```html
<a href="add_flight.html?memberId=...">Add Flight</a>
```

**To:**
```html
<a href="add_activity.html?memberId=...">Add Flight</a>
```

## Tenant Label Architecture

### How It Works

Each tenant has a label registry in their schema:

```sql
CREATE TABLE t_airline.label (
  label_key   text PRIMARY KEY,  -- e.g. 'activity.type.flight'
  display_en  text NOT NULL,     -- e.g. 'Flight'
  display_fr  text,              -- multilingual optional
  updated_at  timestamptz default now()
);
```

### Examples by Industry

**Airline (t_airline.label):**
```
label_key: activity.type.flight → display_en: "Flight"
label_key: points.label          → display_en: "Miles"
```

**Hotel (t_hotel.label):**
```
label_key: activity.type.flight → display_en: "Stay"
label_key: points.label          → display_en: "Points"
```

**Retail (t_retail.label):**
```
label_key: activity.type.flight → display_en: "Transaction"
label_key: points.label          → display_en: "Rewards"
```

### At Runtime

1. **User logs in** → API identifies tenant from JWT/session
2. **API loads labels** from `t_{tenantkey}.label` table
3. **Returns JSON** to frontend:
```json
{
  "activity.type.flight": "Flight",
  "points.label": "Miles",
  "member.tier.gold": "Gold Elite"
}
```
4. **UI renders** using labels:
   - "Add Flight" → "Add Stay" (hotels)
   - "Base Miles" → "Base Points" (hotels)

## Current Implementation

### add_activity.html
```javascript
// Tenant labels (will be loaded from API)
let tenantLabels = {
  'activity.type.flight': 'Flight', // Default, will be overridden
  'points.label': 'Miles' // Default
};

// Update page title with tenant label
const activityTypeLabel = tenantLabels['activity.type.flight'];
document.getElementById('pageTitle').textContent = `Add ${activityTypeLabel}`;
```

### TODO: API Endpoint Needed

**Create endpoint to fetch tenant labels:**
```
GET /v1/tenant/labels
```

**Returns:**
```json
{
  "activity.type.flight": "Flight",
  "points.label": "Miles",
  "member.tier.gold": "Gold",
  "member.tier.platinum": "Platinum"
}
```

**Then update add_activity.html:**
```javascript
async function loadTenantLabels() {
  const response = await fetch(`${API_BASE}/v1/tenant/labels`);
  tenantLabels = await response.json();
  
  // Update UI with tenant-specific labels
  updateLabels();
}
```

## Why This Matters

### Multi-Industry Platform
✅ **Same codebase** for airlines, hotels, retail, ride-share
✅ **Different branding** per tenant (Flight → Stay → Ride → Transaction)
✅ **Editable labels** without code changes
✅ **Multilingual support** (display_en, display_fr, display_es)

### Benefits
1. **Flexibility:** Launch new industry in hours, not weeks
2. **Maintainability:** One UI codebase for all tenants
3. **Scalability:** Add 100 hotel tenants without touching code
4. **Localization:** Easy to add new languages per tenant

## Files Changed

1. **add_activity.html** (NEW)
   - Generic activity form
   - Label-driven UI
   - Works for any industry

2. **activity.html** (UPDATED)
   - Link changed: add_flight.html → add_activity.html
   - Dropdown menu updated
   - Real bonus data (from previous fix)

## Installation

```bash
cp ~/Downloads/add_activity.html ~/Projects/Loyalty-Demo/
cp ~/Downloads/activity.html ~/Projects/Loyalty-Demo/
```

## Testing

1. Click "Add Activity" button
2. Select "Add Flight" from dropdown
3. Should go to `add_activity.html` (NOT csr.html)
4. Form should display "Add Flight" (or "Add Stay" for hotels)
5. Fill in activity details and save

## Next Steps

1. ✅ Delete add_flight.html if it exists (should not exist)
2. ⚠️ Create `/v1/tenant/labels` API endpoint
3. ⚠️ Update add_activity.html to load labels from API
4. ⚠️ Update activity.html dropdown to use tenant label ("Add Flight" → "Add {label}")

**The foundation is in place for true multi-tenant, multi-industry flexibility!** 🎯
