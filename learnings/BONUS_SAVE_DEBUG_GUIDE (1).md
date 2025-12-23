# Bonus Save Debugging Guide

## Changes Made

### 1. Updated server_db_api.js with Comprehensive Logging

Added extensive console.log statements throughout POST /v1/bonuses endpoint:

**What's logged:**
- Incoming request body (full payload)
- Extracted values (each field individually)
- Validation results
- Whether UPDATE or INSERT path is taken
- SQL query parameters
- Database operation results
- Detailed error information

**Benefits:**
- Will immediately show if endpoint is being called
- Shows exact payload received
- Shows which branch (update vs insert) executes
- Shows actual values being sent to database
- Shows any database errors

### 2. Fixed admin_bonus_edit.html Error Handling

**Problem:** The fetch call wasn't checking `res.ok` before parsing JSON
**Result:** Even failed saves showed "success" message

**Fix:** Added proper error handling:
```javascript
.then(res => {
  if (!res.ok) {
    return res.json().then(err => {
      throw new Error(err.error || 'Save failed');
    });
  }
  return res.json();
})
```

Now errors will properly trigger the catch block and show real error messages.

---

## Installation Instructions

```bash
cd ~/Projects/Loyalty-Demo

# Backup current files (just in case)
cp server_db_api.js server_db_api.js.backup
cp admin_bonus_edit.html admin_bonus_edit.html.backup

# Install updated files
cp ~/Downloads/server_db_api.js .
cp ~/Downloads/admin_bonus_edit.html .

# CRITICAL: Restart the server
# Press Ctrl+C to stop current server, then:
node server_db_api.js

# In another terminal, check database structure
psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/debug_bonus_table.sql
```

---

## Testing Procedure

### Step 1: Clear Browser Console
- Open browser DevTools (F12)
- Go to Console tab
- Clear all messages

### Step 2: Check Tenant Selection
- Go to http://localhost:4001/menu.html
- Select a tenant (e.g., Delta)
- Verify tenant indicator appears at top of page

### Step 3: Try Creating a Simple Bonus

**Go to:** http://localhost:4001/admin_bonus_edit.html

**Fill in minimal fields:**
- Bonus Code: TEST001
- Description: Test Bonus
- Type: percentage
- Amount: 50
- Start Date: 2025-11-01
- Status: active

**Click Save**

### Step 4: Check Server Console

Look for this output sequence:
```
=== POST /v1/bonuses called ===
Request body: {
  "bonus_code": "TEST001",
  "bonus_description": "Test Bonus",
  ...
  "tenant_id": 1
}
Extracted values: { bonus_code: 'TEST001', ... tenant_id: 1 }
Validation passed, checking if bonus exists...
Existing bonus check result: NOT FOUND - will INSERT
Inserting new bonus: TEST001
Insert params: [ 'TEST001', 'Test Bonus', 'percentage', 50, '2025-11-01', null, true, 1 ]
Insert successful, rows returned: 1
New bonus: { bonus_id: 123, bonus_code: 'TEST001', ... }
```

### Step 5: Check Browser Console

Should see:
```
Bonus saved: { message: 'Bonus created', bonus: {...} }
```

And alert: "Bonus saved successfully!"

### Step 6: Verify in Database

```bash
psql -h 127.0.0.1 -U billjansen -d loyalty
```

```sql
SELECT * FROM bonus WHERE bonus_code = 'TEST001';
```

Should show your new bonus with tenant_id populated.

---

## Common Issues & Solutions

### Issue 1: "tenant_id is required" Error

**Symptom:** Alert shows "Failed to save bonus: tenant_id is required"
**Cause:** No tenant selected in sessionStorage
**Fix:** 
1. Go to menu.html
2. Click on a tenant to select it
3. Try saving again

### Issue 2: Server Not Receiving Request

**Symptom:** No console output in server terminal
**Cause:** Server not running or wrong port
**Check:**
- Server is running (you should see "Server running on port 4001")
- URL is http://localhost:4001/v1/bonuses
- No browser CORS errors

### Issue 3: "Database not connected" Error

**Symptom:** Alert shows "Failed to save bonus: Database not connected"
**Cause:** dbClient is null
**Fix:**
1. Check server startup logs
2. Verify PostgreSQL is running: `pg_isready -h 127.0.0.1`
3. Check database connection parameters in server_db_api.js

### Issue 4: Column Does Not Exist

**Symptom:** Error: 'column "tenant_id" does not exist'
**Cause:** bonus table missing tenant_id column
**Fix:**
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty
```
```sql
ALTER TABLE bonus ADD COLUMN tenant_id INTEGER;
```

### Issue 5: Silent Failure (No Error, No Record)

**Symptom:** 
- Frontend shows success
- Server logs show "Insert successful"
- But record not in database

**Possible Causes:**
1. Transaction not committed (auto-commit should be on)
2. Wrong database/table being queried
3. Insert to temp table instead of real table

**Debug:**
1. Check RETURNING clause returns data
2. Verify you're querying correct database
3. Add transaction logging

---

## What to Look For

✅ **Success Indicators:**
- Server logs show all expected output
- Browser console shows success message
- Database query returns the new record
- Record has correct tenant_id

❌ **Failure Indicators:**
- Missing server logs = endpoint not called
- "tenant_id is required" = frontend not sending tenant_id
- "Column does not exist" = schema issue
- Silent failure = transaction or connection issue

---

## Next Steps if Still Failing

1. **Verify table structure:**
   ```sql
   \d bonus
   ```
   Should show tenant_id column

2. **Check for triggers:**
   ```sql
   SELECT tgname FROM pg_trigger WHERE tgrelid = 'bonus'::regclass;
   ```
   Any triggers could be interfering

3. **Test direct INSERT:**
   ```sql
   INSERT INTO bonus (bonus_code, bonus_description, bonus_type, 
                      bonus_amount, start_date, tenant_id)
   VALUES ('DIRECT_TEST', 'Direct Insert Test', 'percentage', 
           100, '2025-11-01', 1);
   
   SELECT * FROM bonus WHERE bonus_code = 'DIRECT_TEST';
   ```

4. **Check server connection:**
   - Verify server is connected to correct database
   - Check database name in connection string
   - Verify user has INSERT permissions

---

## Summary

**What was fixed:**
1. Server now has extensive logging throughout save process
2. Frontend now properly detects and reports server errors

**What to expect:**
- Clear visibility into what's happening at each step
- Real error messages instead of false success
- Ability to pinpoint exact failure point

**Time to test:**
Follow the testing procedure above and report back what you see in:
1. Server console output
2. Browser console output
3. Database query results

This will tell us exactly where the process is breaking down!
