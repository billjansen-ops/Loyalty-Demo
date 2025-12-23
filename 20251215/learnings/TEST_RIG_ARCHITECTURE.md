# Test Rig Updated - Bonus Code & Failure Reasons

## Changes Made:

### 1. Bonus Code (Not ID)
**Changed from:**
- Bonus ID (editable number field)

**Changed to:**
- Bonus Code (read-only text field, grayed out)
- Passed via URL from admin screen
- Example: `test-rule.html?bonusCode=TEST_BONUS`

### 2. Failure Reasons Display
**Pass:**
```
✅ PASS!
```

**Fail with Reason:**
```
❌ FAIL
Reason: Date Range
```

or

```
❌ FAIL
Reason: Must travel on Delta
```

## The Evaluation Architecture:

### Step 1: Test Header (Fixed Criteria)
**Hardcoded checks:**
- Is bonus active? (is_active = true)
- Is activity date in range? (start_date <= activity_date <= end_date)

**Failure reasons:**
- "Not Active"
- "Date Range"

### Step 2: Test Criteria (Flexible Rules)
**Dynamic checks from rule_criteria table:**
- Each criterion has a description (label)
- Example: "Must travel on Delta", "Must fly to NYC area"

**Failure reason:**
- Uses the criterion's label/description

### Production Flow (When Adding Activity):
```javascript
for each active bonus {
  // Test header first
  if (!testBonusHeader(bonus, activity_date)) {
    continue; // Skip to next bonus
  }
  
  // Test criteria (same engine as test rig!)
  if (!evaluateCriteria(bonus.rule_id, activity_data)) {
    continue; // Skip to next bonus
  }
  
  // Award bonus
  awardBonus(activity_id, bonus);
}
```

### Test Rig Flow:
```javascript
// Test header
headerResult = testBonusHeader(bonus, activity_date);
if (!headerResult.pass) {
  return {
    pass: false,
    reason: headerResult.reason // "Date Range" or "Not Active"
  };
}

// Test criteria (SAME ENGINE)
criteriaResult = evaluateCriteria(bonus.rule_id, activity_data);
if (!criteriaResult.pass) {
  return {
    pass: false,
    reason: criteriaResult.failedCriterion.label // "Must travel on Delta"
  };
}

return { pass: true };
```

## API Endpoint:

```
POST /v1/test-rule/{bonusCode}

Request Body:
{
  "member_id": "2153442807",
  "activity_date": "2025-11-05",
  "carrier": "DL",
  "origin": "MSP",
  "destination": "BOS",
  "fare_class": "Y",
  "base_miles": 1000
}

Response (Pass):
{
  "pass": true
}

Response (Fail - Header):
{
  "pass": false,
  "reason": "Date Range"
}

Response (Fail - Criteria):
{
  "pass": false,
  "reason": "Must travel on Delta"
}
```

## Example Test Scenarios:

### Scenario 1: Date Outside Range
**Input:**
- Bonus: TEST_BONUS (active 11/1-11/15)
- Activity Date: 10/31/2025

**Result:**
```
❌ FAIL
Reason: Date Range
```

### Scenario 2: Bonus Not Active
**Input:**
- Bonus: OLD_BONUS (is_active = false)
- Activity Date: 11/5/2025

**Result:**
```
❌ FAIL
Reason: Not Active
```

### Scenario 3: Wrong Carrier
**Input:**
- Bonus: TEST_BONUS with criteria "Must travel on Delta" (carrier=DL)
- Activity: Carrier UA

**Result:**
```
❌ FAIL
Reason: Must travel on Delta
```

### Scenario 4: Everything Matches
**Input:**
- Bonus: TEST_BONUS (active 11/1-11/15)
- Activity Date: 11/5/2025
- Carrier: DL

**Result:**
```
✅ PASS!
```

## Installation:

```bash
cp ~/Downloads/admin_bonuses.html ~/Projects/Loyalty-Demo/
cp ~/Downloads/test-rule.html ~/Projects/Loyalty-Demo/
```

## What's Next:

1. Create `rule_criteria` table
2. Build `/v1/test-rule/{bonusCode}` endpoint
3. Implement `testBonusHeader()` function
4. Implement `evaluateCriteria()` function (reusable!)
5. Test with real data

**The architecture is solid - let's build it!** 🚀
