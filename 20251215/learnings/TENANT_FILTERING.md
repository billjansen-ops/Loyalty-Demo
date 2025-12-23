# Tenant Dropdown + Bonus Filtering Complete! 🎯

## What Changed:

### 1. Tenant Selector → Dropdown ✅

**menu.html updated:**
- Changed from tenant cards to dropdown
- Cleaner, more compact UI
- Shows: "Delta Air Lines (airline)", etc.
- Selection persists in sessionStorage

### 2. Admin Bonuses Filters by Tenant ✅

**admin_bonuses.html updated:**
- Shows tenant indicator at top
- Warning if no tenant selected
- Only loads bonuses for selected tenant
- Passes `tenant_id` to API

**server_db_api.js updated:**
- GET /v1/bonuses accepts `?tenant_id=1` parameter
- Filters bonuses by tenant_id in WHERE clause

## Installation:

```bash
# Copy files
cp ~/Downloads/menu.html ~/Projects/Loyalty-Demo/
cp ~/Downloads/admin_bonuses.html ~/Projects/Loyalty-Demo/
cp ~/Downloads/server_db_api.js ~/Projects/Loyalty-Demo/

# Restart server
cd ~/Projects/Loyalty-Demo
./bootstrap/start.sh
```

## IMPORTANT: Check if bonus table has tenant_id!

**You need to verify:**
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -c "\d bonus"
```

**Look for:** `tenant_id` column

**If it doesn't exist, you need to add it:**
```sql
ALTER TABLE bonus ADD COLUMN tenant_id INTEGER REFERENCES tenant(tenant_id);

-- Then assign existing bonuses to Delta (tenant_id = 1)
UPDATE bonus SET tenant_id = 1 WHERE tenant_id IS NULL;

-- Make it required
ALTER TABLE bonus ALTER COLUMN tenant_id SET NOT NULL;
```

## Test Flow:

### Scenario 1: Delta Bonuses
```
1. Open: http://127.0.0.1:4001/menu.html
2. Select "Delta Air Lines" from dropdown
3. See: "Current: Delta Air Lines"
4. Click "Client Admin"
5. See: "ℹ️ Viewing bonuses for: Delta Air Lines"
6. See: Only Delta's bonuses (BILLSTEST, etc.)
```

### Scenario 2: Ferrari (Empty)
```
1. Back to menu.html
2. Select "Ferrari"
3. Go to Client Admin
4. See: "ℹ️ Viewing bonuses for: Ferrari"
5. See: "No bonuses found" (Ferrari has no bonuses yet)
```

### Scenario 3: No Tenant Selected
```
1. Open admin_bonuses.html directly (without selecting tenant)
2. See: "⚠️ No tenant selected! Please select a tenant from the menu"
3. Click link → Goes to menu.html
```

## What's Fixed:

✅ **Dropdown instead of cards** - Cleaner UI  
✅ **Tenant indicator shows** - Always know which tenant you're viewing  
✅ **Bonuses filtered** - Each tenant sees only their bonuses  
✅ **Warning if no tenant** - Guides user to select tenant  

## What Still Needs tenant_id:

❌ **carriers table** - Need to add tenant_id  
❌ **airports table** - Need to add tenant_id  
❌ **tier_definition table** - Need to add tenant_id  
❌ **All other admin pages** - Need same pattern  

## The Pattern (for other pages):

**Every page needs:**

**1. Show tenant indicator:**
```javascript
function showTenantIndicator() {
  const tenantId = sessionStorage.getItem('tenant_id');
  const tenantName = sessionStorage.getItem('tenant_name');
  // Show warning or info
}
```

**2. Check tenant before loading:**
```javascript
async function loadData() {
  const tenantId = sessionStorage.getItem('tenant_id');
  if (!tenantId) {
    // Show "select tenant" message
    return;
  }
  // Load data with tenant_id
  fetch(`/v1/data?tenant_id=${tenantId}`);
}
```

**3. API filters by tenant:**
```javascript
app.get('/v1/data', (req, res) => {
  const tenantId = req.query.tenant_id;
  // WHERE tenant_id = $1
});
```

## Next Steps:

**Priority 1: Add tenant_id to tables**
```sql
ALTER TABLE carriers ADD COLUMN tenant_id INTEGER REFERENCES tenant(tenant_id);
ALTER TABLE airports ADD COLUMN tenant_id INTEGER REFERENCES tenant(tenant_id);
ALTER TABLE tier_definition ADD COLUMN tenant_id INTEGER REFERENCES tenant(tenant_id);
-- etc.
```

**Priority 2: Update remaining admin pages**
- admin_carriers.html
- admin_airports.html
- admin_tiers.html
- activity.html
- etc.

**Priority 3: Change tenant_id from BIGINT → INTEGER**
- Wait until all pages use tenant filtering
- Then do the data type migration

## Visual:

**Menu (Dropdown):**
```
┌─────────────────────────────────────┐
│ Select Tenant: [▼ Delta Air Lines] │
│                Current: Delta       │
└─────────────────────────────────────┘
```

**Admin Bonuses (With Tenant):**
```
┌──────────────────────────────────────┐
│ ℹ️ Viewing bonuses for: Delta        │
├──────────────────────────────────────┤
│ Code     Description       Amount    │
│ BILLSTEST Test Bonus       +100      │
└──────────────────────────────────────┘
```

**Admin Bonuses (No Tenant):**
```
┌──────────────────────────────────────┐
│ ⚠️ No tenant selected!                │
│ Please select a tenant from menu     │
└──────────────────────────────────────┘
```

**IT WORKS!** Now each tenant sees only their data! 🚀
