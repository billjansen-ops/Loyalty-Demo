-- Cleanup Script: Fix member data and remove timestamp columns
-- Date: 2025-11-13

-- Step 1: Clean up member 2153442807's data
UPDATE member
SET 
  middle_initial = NULL,
  address1 = NULL,
  address2 = NULL,
  city = NULL,
  state = NULL,
  zip = NULL,
  phone = NULL,
  email = NULL
WHERE member_id = '2153442807';

-- Verify the update
SELECT member_id, fname, lname, middle_initial, email, phone, city
FROM member
WHERE member_id = '2153442807';

-- Step 2: Drop the timestamp columns
ALTER TABLE member 
DROP COLUMN IF EXISTS created_at,
DROP COLUMN IF EXISTS updated_at;

-- Step 3: Verify columns are gone
\d member
