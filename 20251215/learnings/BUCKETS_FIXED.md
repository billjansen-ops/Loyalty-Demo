# Buckets Endpoint Fixed - No More Mock Data!

## The Problem

**Buckets endpoint was returning MOCK DATA even when database was empty:**

```json
{
  "buckets": [
    {"expiry_date":"2026-03-31","accrued":12000,"redeemed":3000},
    {"expiry_date":"2025-12-31","accrued":8000,"redeemed":5000},
    ...
  ]
}
```

**Why?** The endpoint was querying `member_point_bucket` table which **doesn't exist!**

```sql
SELECT expiry_date, accrued, redeemed
FROM member_point_bucket  -- ❌ Table doesn't exist!
WHERE member_id = $1
```

When the query failed, it fell back to mock data.

## The Solution

**Fixed to query `point_lot` table (the actual table):**

```sql
SELECT 
  COALESCE(expires_at, DATE '9999-12-31') AS expiry_date,
  COALESCE(SUM(qty), 0) AS accrued,
  0 AS redeemed
FROM point_lot  -- ✅ Correct table!
WHERE member_id = $1
GROUP BY expires_at
ORDER BY expires_at NULLS LAST
```

## Key Changes:

### 1. ✅ Correct Table
**Before:** `member_point_bucket` (doesn't exist)  
**After:** `point_lot` (exists)

### 2. ✅ Correct Columns
**Before:** `expiry_date`, `accrued`, `redeemed`  
**After:** `expires_at`, `qty`, (redeemed=0)

### 3. ✅ Empty Array Instead of Mock
**Before:** Returns fake data when empty  
**After:** Returns empty buckets array

```json
{
  "ok": true,
  "buckets": []
}
```

## How Point Lot Works

**Lot-based system (not aggregated buckets):**

```
lot_id | member_id | point_type | qty  | expires_at | source
-------|-----------|------------|------|------------|--------
1      | 2153...   | miles      | 1000 | 2026-07-31 | activity_16
2      | 2153...   | miles      | 500  | 2026-08-31 | activity_17
```

**Aggregated for display:**
```json
{
  "buckets": [
    {"expiry_date": "2026-07-31", "accrued": 1000, "redeemed": 0},
    {"expiry_date": "2026-08-31", "accrued": 500, "redeemed": 0}
  ]
}
```

## Installation

```bash
cp ~/Downloads/server_db_api.js ~/Projects/Loyalty-Demo/
cd ~/Projects/Loyalty-Demo
./bootstrap/start.sh
```

## Test

```bash
# Should return empty buckets (not mock data)
curl "http://localhost:4001/v1/member/2153442807/buckets"
```

**Expected:**
```json
{
  "ok": true,
  "member_id": "2153442807",
  "point_type": "base_miles",
  "today": "2025-11-02",
  "buckets": []
}
```

**Refresh point-summary.html** - should show empty table with totals of 0!

## Next Step

**When activity is created, we need to:**
1. Look up expiration rule
2. Create point_lot record
3. Then buckets will show real data!

**But no more fake mock data!** ✅
