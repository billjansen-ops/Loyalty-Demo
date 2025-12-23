# 🎁 BONUS ENGINE - TESTING GUIDE

## What We Built

The **Bonus Engine** that evaluates ACTIVE bonuses when activities are created!

## Key Features

✅ **Only processes ACTIVE bonuses** (is_active = true)
✅ **Checks date ranges** - Activity date must be between start_date and end_date
✅ **Supports both types:**
   - **Percent:** Calculates % of base miles
   - **Fixed:** Awards flat amount
✅ **Creates bonus_accrual records** - Tracks which bonuses were awarded
✅ **Console logging** - See exactly what the engine is doing

## Installation

### 1. Create bonus_accrual table
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -f ~/Downloads/create_bonus_accrual_table.sql
```

### 2. Update server
```bash
cp ~/Downloads/server_db_api.js ~/Projects/Loyalty-Demo/
cd ~/Projects/Loyalty-Demo
./bootstrap/start.sh
```

## Testing the Engine

### Current Setup
- **Bonus:** "bills test bonus"
- **Date Range:** 11/1/25 to 11/15/25
- **Status:** Active
- **Type:** (percent or fixed - engine will discover this!)
- **Amount:** (engine will discover this!)

### Test Plan

**Flight A - INSIDE date range (11/5/25):**
1. Add flight with activity_date = 11/5/25
2. Note the activity_id (e.g., 12345)
3. Trigger bonus engine:
   ```bash
   curl -X POST http://localhost:4001/v1/activities/12345/evaluate-bonuses
   ```
4. Expected: Bonus awarded! ✅

**Flight B - OUTSIDE date range (11/20/25):**
1. Add flight with activity_date = 11/20/25
2. Note the activity_id (e.g., 12346)
3. Trigger bonus engine:
   ```bash
   curl -X POST http://localhost:4001/v1/activities/12346/evaluate-bonuses
   ```
4. Expected: No bonus (date outside range) ❌

### Check the Results

**See what bonuses were awarded:**
```bash
curl http://localhost:4001/v1/activities/12345/bonuses
```

**Watch the server console** - It logs everything:
```
🎁 BONUS ENGINE: Evaluating bonuses for activity 12345
   Activity Date: 2025-11-05, Base Miles: 1200
   Found 1 ACTIVE bonuses to evaluate

   → Checking bonus: BILLSTEST (bills test bonus)
      Type: percent, Amount: 50
      Date Range: 2025-11-01 to 2025-11-15
      ✅ PASS - Activity date within range!
      💰 Calculating: 1200 × 50% = 600 miles
      ✨ AWARDED: 600 bonus miles!

🎁 BONUS ENGINE: Complete! Awarded 1 bonuses
```

## How It Works

1. **Query ACTIVE bonuses only**
   ```sql
   WHERE is_active = true
   ```

2. **For each active bonus:**
   - Check if activity_date is between start_date and end_date
   - If NO → Skip to next bonus
   - If YES → Calculate bonus miles

3. **Calculate based on type:**
   - **percent:** `base_miles × (bonus_amount / 100)`
   - **fixed:** `bonus_amount`

4. **Create bonus_accrual record**
   - Links activity to bonus
   - Records calculated bonus_miles

5. **Update member balance** (future step)

## Next Steps

Once this basic date-range engine works, we'll add:
- **Dynamic Rules** - Complex conditions (tier, carrier, route, etc.)
- **Automatic triggering** - Engine runs when flight is added
- **Balance updates** - Actually credit the bonus miles
- **Activity page display** - Show which bonuses were applied

## The Secret Sauce Awaits! 🚀

This is just the foundation. The REAL power comes when we add the rules engine...
