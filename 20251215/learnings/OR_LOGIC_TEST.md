# OR LOGIC TEST - Multi-Line Failures! 🎯

## The Rule (After Running SQL):

**Fly on Delta OR Fly into Boston**

Either one passes → Bonus awarded!

## Installation:

### Step 1: Update SQL
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -f ~/Projects/Loyalty-Demo/sql/change_to_or_logic.sql
```

### Step 2: Update Server
```bash
cp ~/Downloads/server_db_api.js ~/Projects/Loyalty-Demo/
cd ~/Projects/Loyalty-Demo
./bootstrap/start.sh
```

## Test Scenarios:

### Test 1: Passes Delta (SHOULD PASS)
- Date: 11/05/2025
- Carrier: **DL** ✅
- Destination: **LAX** ❌
- Expected: ✅ **PASS!** (one criterion met)

### Test 2: Passes Boston (SHOULD PASS)
- Date: 11/05/2025
- Carrier: **UA** ❌
- Destination: **BOS** ✅
- Expected: ✅ **PASS!** (one criterion met)

### Test 3: Passes Both (SHOULD PASS)
- Date: 11/05/2025
- Carrier: **DL** ✅
- Destination: **BOS** ✅
- Expected: ✅ **PASS!** (both criteria met)

### Test 4: Fails Both (SHOULD FAIL WITH BOTH REASONS)
- Date: 11/05/2025
- Carrier: **UA** ❌
- Destination: **LAX** ❌
- Expected:
```
❌ FAIL
Reason: Fly on Delta - Failed
        Fly into Boston - Failed
```

## Server Console Output:

### Passes One (DL + LAX):
```
🧪 Testing rule for bonus: BILLSTEST
   → Found 2 criteria to evaluate
   → Checking: Fly on Delta
   ✓ Criterion passed
   → Checking: Fly into Boston
   ❌ Criterion failed: Fly into Boston
   ✅ PASS: At least one criterion passed (OR logic)
```

### Fails Both (UA + LAX):
```
🧪 Testing rule for bonus: BILLSTEST
   → Found 2 criteria to evaluate
   → Checking: Fly on Delta
   ❌ Criterion failed: Fly on Delta
   → Checking: Fly into Boston
   ❌ Criterion failed: Fly into Boston
   ❌ FAIL: All criteria failed (OR logic)
```

## What This Proves:

✅ OR logic works  
✅ Short-circuit on first PASS  
✅ Collect all failures if none pass  
✅ Multi-line failure messages  
✅ Clear diagnostic output  

**The rules engine handles complex logic!** 🚀
