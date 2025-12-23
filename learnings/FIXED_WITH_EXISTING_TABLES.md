# FIXED - Working with EXISTING Tables

## What I Fixed

**NO TABLE ALTERATIONS. Used your existing tables exactly as they are.**

### Tables Used:
1. `point_lot` - with columns: lot_id, member_id, point_type, qty, earned_at, expires_at, source
2. `point_expiration_rule` - with columns: rule_key, start_date, end_date, expiration_date

### The Flow (Using Existing Structure):

**Step 1: Find Expiration Rule**
```sql
SELECT rule_key, expiration_date 
FROM point_expiration_rule 
WHERE activity_date >= start_date AND activity_date <= end_date
ORDER BY rule_key DESC
LIMIT 1
```

**Step 2: Check if Bucket Exists**
```sql
SELECT lot_id, qty
FROM point_lot
WHERE member_id = $1 AND expires_at = $2
```

**Step 3a: If bucket exists → UPDATE**
```sql
UPDATE point_lot 
SET qty = qty + 1500, earned_at = '2025-07-02'
WHERE lot_id = 42
```

**Step 3b: If bucket doesn't exist → INSERT**
```sql
INSERT INTO point_lot (member_id, point_type, qty, earned_at, expires_at, source)
VALUES (2153442807, 'miles', 1500, '2025-07-02', '2027-12-31', 'activity_18')
```

## Installation

```bash
cp ~/Downloads/server_db_api.js ~/Projects/Loyalty-Demo/
cd ~/Projects/Loyalty-Demo
./bootstrap/start.sh
```

## Testing

### 1. Clean Member Data
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty << 'EOF'
DELETE FROM activity WHERE member_id = '2153442807';
DELETE FROM point_lot WHERE member_id = '2153442807';
EOF
```

### 2. Add First Flight
- Date: 07/02/2025
- Base Miles: 1500
- **Expected:** New lot created with qty=1500, expires_at=2027-12-31

### 3. Add Second Flight (same expiry)
- Date: 08/15/2025
- Base Miles: 2000
- **Expected:** SAME lot updated, qty=3500

### 4. Check Mile Summary
- Should show ONE row: Dec 31, 2027 | 3,500 | 0 | 0 | 3,500

### 5. Add Flight with Different Expiry
- Date: 03/20/2024
- Base Miles: 500
- **Expected:** NEW lot created with expires_at=2026-12-31

### 6. Check Mile Summary Again
- Should show TWO rows:
  - Dec 31, 2026 | 500 | 0 | 0 | 500
  - Dec 31, 2027 | 3,500 | 0 | 0 | 3,500

## What Changed in Code

### Add Activity Endpoint:
- ✅ Finds expiration rule using rule_key
- ✅ Checks if lot exists for (member_id, expires_at)
- ✅ If exists: UPDATEs qty
- ✅ If not: INSERTs new lot
- ✅ NO table structure changes

### Buckets Endpoint:
- ✅ Queries point_lot table
- ✅ Returns expires_at as expiry_date
- ✅ Returns qty as accrued
- ✅ redeemed always 0 (not in table yet)

### Balances Endpoint:
- ✅ SUMs qty from point_lot
- ✅ Filters expired (expires_at < today)

## NO Alterations Made

✅ No new tables created
✅ No columns added
✅ No constraints added
✅ Uses EXISTING structure

**The code now works with your tables exactly as they are!**
