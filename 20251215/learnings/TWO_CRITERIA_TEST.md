# TWO CRITERIA TEST! 🎯

## The Rule (After Running SQL):

**Criterion 1:** Carrier = DL ("Must travel on Delta")  
**AND**  
**Criterion 2:** Destination = BOS ("Must travel to Boston")

**BOTH must pass to get the bonus!**

## Installation:

```bash
# Copy SQL to your sql folder
cp ~/Downloads/add_second_criterion.sql ~/Projects/Loyalty-Demo/sql/

# Run it
psql -h 127.0.0.1 -U billjansen -d loyalty -f ~/Projects/Loyalty-Demo/sql/add_second_criterion.sql
```

## Test Scenarios:

### Test 1: Both Match (SHOULD PASS)
- Date: 11/05/2025
- Carrier: **DL** ✅
- Destination: **BOS** ✅
- Expected: ✅ **PASS!**

### Test 2: Wrong Carrier (SHOULD FAIL)
- Date: 11/05/2025
- Carrier: **UA** ❌
- Destination: **BOS** ✅
- Expected: ❌ **FAIL - Reason: Must travel on Delta**

### Test 3: Wrong Destination (SHOULD FAIL)
- Date: 11/05/2025
- Carrier: **DL** ✅
- Destination: **LAX** ❌
- Expected: ❌ **FAIL - Reason: Must travel to Boston**

### Test 4: Both Wrong (SHOULD FAIL)
- Date: 11/05/2025
- Carrier: **UA** ❌
- Destination: **LAX** ❌
- Expected: ❌ **FAIL - Reason: Must travel on Delta**
*(Fails on first criterion, never checks second)*

## Server Console Output:

### Both Match (Pass):
```
🧪 Testing rule for bonus: BILLSTEST
   → Found 2 criteria to evaluate
   → Checking: Must travel on Delta
   ✓ Criterion passed
   → Checking: Must travel to Boston
   ✓ Criterion passed
   ✅ PASS: All header checks and criteria passed!
```

### Wrong Destination (Fail):
```
🧪 Testing rule for bonus: BILLSTEST
   → Found 2 criteria to evaluate
   → Checking: Must travel on Delta
   ✓ Criterion passed
   → Checking: Must travel to Boston
   → Activity has destination: "LAX"
   ❌ FAIL: Must travel to Boston
```

## What This Proves:

✅ Multiple criteria work  
✅ AND logic works  
✅ Fails with correct reason  
✅ Evaluation stops at first failure  

**This is the REAL rules engine!** 🚀
