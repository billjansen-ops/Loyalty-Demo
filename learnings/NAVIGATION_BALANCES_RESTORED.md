# Navigation & Balances RESTORED!

## What Was Broken

### 1. ❌ Incomplete Navigation
**Before (broken):**
- Search, Activity, Balances, Profile (only 4 items)
- Linked to non-existent `balances.html`

**After (restored):**
- Search, Profile, Activity, Point Summary, Promotions, Aliases, Tiers, Communications (8 items)
- Links to existing `point-summary.html`

### 2. ❌ Wrong Endpoint
**Before:**
```javascript
{ label: 'Balances', href: 'balances.html' }  // ❌ Doesn't exist
```

**After:**
```javascript
{ label: 'Point Summary', href: 'point-summary.html' }  // ✅ Exists and works
```

### 3. ❌ Balances Endpoint Querying Wrong Table
**Before:**
```sql
SELECT point_type, balance 
FROM member_balances  -- ❌ Table doesn't exist
WHERE member_id = $1
```

**After:**
```sql
SELECT 
  point_type,
  COALESCE(SUM(qty), 0) as balance
FROM point_lot  -- ✅ Correct table
WHERE member_id = $1
  AND (expires_at IS NULL OR expires_at >= today)
GROUP BY point_type
```

## Full Navigation Restored

### CSR Console Menu:
1. 🔍 **Search** → csr.html
2. 👤 **Profile** → profile.html
3. 📊 **Activity** → activity.html
4. 💰 **Point Summary** → point-summary.html ✅ FIXED
5. 🎁 **Promotions** → promotions.html
6. 👥 **Aliases** → aliases.html
7. ⭐ **Tiers** → tier.html
8. 📧 **Communications** → communications.html

### Admin Menu:
1. 📊 **Overview** → admin.html
2. 🎁 **Bonuses** → admin_bonuses.html
3. ✈️ **Carriers** → admin_carriers.html
4. ⭐ **Tiers** → admin_tiers.html
5. 🌍 **Airports** → admin_airports.html

### Main Menu:
1. 👤 **CSR** → csr.html
2. ⚙️ **Admin** → admin.html ✅ RESTORED
3. 🏠 **Home** → menu.html

## How Balances Work Now

### Query Logic:
```sql
-- Get available points (unexpired only)
SELECT 
  point_type,
  COALESCE(SUM(qty), 0) as balance
FROM point_lot
WHERE member_id = $1
  AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
GROUP BY point_type
```

### Returns:
```json
{
  "ok": true,
  "balances": {
    "miles": 5000,
    "tier_credits": 0
  }
}
```

### Used By:
- `activity.html` → Shows balances at top of page
- `point-summary.html` → Shows detailed bucket breakdown

## Installation

```bash
# Copy fixed files
cp ~/Downloads/lp-nav.js ~/Projects/Loyalty-Demo/
cp ~/Downloads/server_db_api.js ~/Projects/Loyalty-Demo/

# Restart server
cd ~/Projects/Loyalty-Demo
./bootstrap/start.sh
```

## Test

1. **Navigate to any CSR page**
   - Check sidebar → should see ALL 8 menu items
   
2. **Click "Point Summary"**
   - Should go to `point-summary.html` (not `balances.html`)
   - Should load buckets properly
   
3. **Go to Activity page**
   - Balances section at top should load
   - Should show available points from `point_lot` table

## What's Still Missing

**Point lot creation when activity is added!**

Currently:
- ✅ Activity created
- ✅ Molecules created
- ❌ **Point lot NOT created** → balance stays at 0

**Next step:** Update POST activity endpoint to:
1. Look up expiration rule
2. Create/update point_lot record
3. Link activity to lot

**But navigation is now fully restored!** 🎉
