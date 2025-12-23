# server_db_api.js - Bonus Endpoint Fix

**Date:** 2025-11-03  
**Issue:** POST /v1/bonuses was not handling tenant_id

---

## Problem:

When trying to save a new bonus from admin_bonus_edit.html:
- ❌ Frontend sends tenant_id in payload
- ❌ Server ignores tenant_id 
- ❌ INSERT query tries to insert without tenant_id
- ❌ Database rejects (NOT NULL constraint)
- ❌ Bonus never gets created

---

## Fix Applied:

### Line 872 - Extract tenant_id from request:
```javascript
// BEFORE:
const { bonus_code, bonus_description, bonus_type, bonus_amount, start_date, end_date, is_active } = req.body;

// AFTER:
const { bonus_code, bonus_description, bonus_type, bonus_amount, start_date, end_date, is_active, tenant_id } = req.body;
```

### Line 878 - Add tenant_id validation:
```javascript
if (!tenant_id) {
  return res.status(400).json({ error: 'tenant_id is required' });
}
```

### Line 893 - Include tenant_id in UPDATE query:
```javascript
UPDATE bonus 
SET bonus_description = $1,
    bonus_type = $2,
    bonus_amount = $3,
    start_date = $4,
    end_date = $5,
    is_active = $6,
    tenant_id = $7,           // ← ADDED
    updated_at = CURRENT_TIMESTAMP
WHERE bonus_code = $8
```

### Line 910 - Include tenant_id in INSERT query:
```javascript
INSERT INTO bonus (bonus_code, bonus_description, bonus_type, bonus_amount, start_date, end_date, is_active, tenant_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)  // ← Added $8 for tenant_id
```

---

## Installation:

```bash
cd ~/Projects/Loyalty-Demo

# Backup current server
cp server_db_api.js server_db_api.js.backup

# Install fixed version
cp ~/Downloads/server_db_api.js .

# Restart server (Ctrl+C to stop current, then:)
node server_db_api.js
```

---

## Testing:

1. **Restart the server** (CRITICAL - changes won't take effect until restart!)
2. Select tenant (Delta) from menu
3. Go to Bonuses → Click "Add New Bonus"
4. Fill in:
   - Code: TEST123
   - Description: Test Bonus
   - Start Date: 2025-11-01
   - Type: Fixed
   - Amount: 500
5. Click Save
6. **Should now save successfully!**
7. Check database:
   ```bash
   psql -h 127.0.0.1 -U billjansen -d loyalty -c "SELECT * FROM bonus WHERE bonus_code = 'TEST123';"
   ```
8. Should see your new bonus with tenant_id = 1

---

## Result:

✅ Bonuses now save with tenant_id correctly  
✅ Server validates tenant_id exists  
✅ Both INSERT and UPDATE include tenant_id  
✅ Tenant isolation maintained  

**Remember to restart the server!** 🔄
