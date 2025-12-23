# Test Bonus Rule Rig - READY!

## What I Built

**test-rule.html** - A test interface that looks exactly like Add Flight but tests rules instead of saving activities.

### Features:

**Form Fields:**
- Activity Date
- Carrier Code
- Origin
- Destination  
- Fare Class (optional)
- Base Miles

**Test Button:**
- "🧪 Test Rule!" 
- Sends data to `/v1/test-rule/1` endpoint (testing bonus_id=1)

**Results Display:**
- ✅ **PASS** - Green box with checkmark
- ❌ **FAIL** - Red box with X
- Shows diagnostic message (when we add that)

## Installation

```bash
cp ~/Downloads/test-rule.html ~/Projects/Loyalty-Demo/
```

**Access at:**
```
http://localhost:4001/test-rule.html
```

## Next Steps

**1. Create Database Tables:**
```sql
-- Generic rule table
CREATE TABLE rule (
  rule_id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Link bonus to rule
ALTER TABLE bonus ADD COLUMN rule_id INTEGER REFERENCES rule(rule_id);

-- Criteria groups (optional grouping)
CREATE TABLE rule_criteria_group (
  group_id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES rule(rule_id) ON DELETE CASCADE,
  label TEXT,
  joiner TEXT, -- AND/OR to next group
  sort_order INTEGER
);

-- Individual criteria
CREATE TABLE rule_criteria (
  criteria_id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES rule(rule_id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES rule_criteria_group(group_id) ON DELETE CASCADE,
  molecule_key TEXT, -- carrier, origin, dest, etc
  operator TEXT, -- equals, in, >, <, etc
  value JSONB, -- flexible storage
  label TEXT, -- for CSR diagnostics
  joiner TEXT, -- AND/OR to next criteria
  sort_order INTEGER
);
```

**2. Insert Test Rule: "Fly Delta"**
```sql
-- Create rule
INSERT INTO rule (rule_id) VALUES (1);

-- Link to bonus
UPDATE bonus SET rule_id = 1 WHERE bonus_id = 1;

-- Create single criteria: carrier = DL
INSERT INTO rule_criteria (
  rule_id,
  group_id,
  molecule_key,
  operator,
  value,
  label,
  joiner,
  sort_order
) VALUES (
  1,
  NULL, -- no group needed
  'carrier',
  'equals',
  '"DL"'::jsonb,
  'Fly Delta',
  NULL, -- no joiner (only one criteria)
  1
);
```

**3. Build Evaluation Endpoint:**
```javascript
// POST /v1/test-rule/:ruleId
// Takes activity data, evaluates rule, returns PASS/FAIL
```

## Test Flow

**User enters:**
- Date: 11/5/2025
- Carrier: DL
- Origin: MSP
- Destination: BOS
- Base Miles: 1000

**Clicks "Test Rule!"**

**Backend:**
1. Loads rule_id=1 criteria
2. Finds: carrier must equal 'DL'
3. Checks: user entered 'DL'
4. Returns: `{"pass": true, "message": "All criteria matched"}`

**UI shows:**
✅ PASS - Rule Matched!

## What's Next?

After we prove the evaluation engine works with simple rules, we'll:
1. Add criteria groups
2. Add complex joiners (AND/OR)
3. Add diagnostic messages ("Failed: Fly Delta - carrier was UA")
4. Build the rules UI

**Ready to create the database tables and evaluation endpoint!** 🚀
