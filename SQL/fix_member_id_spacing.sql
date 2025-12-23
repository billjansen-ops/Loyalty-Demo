-- Diagnostic and Fix Script for Member ID Spacing Issues
-- Run this to check and fix any padding/spacing problems after VARCHAR conversion

-- 1. Check all member IDs with their lengths and visible brackets
SELECT 
  member_id,
  LENGTH(member_id) as id_length,
  CONCAT('[', member_id, ']') as with_brackets,
  fname,
  lname
FROM member
ORDER BY member_id;

-- 2. Find member IDs with leading or trailing spaces
SELECT 
  member_id,
  LENGTH(member_id) as id_length,
  LENGTH(TRIM(member_id)) as trimmed_length,
  fname
FROM member
WHERE member_id != TRIM(member_id);

-- 3. Search for a specific member ID (like 2153442807) with any spacing
SELECT 
  member_id,
  LENGTH(member_id) as id_length,
  CONCAT('[', member_id, ']') as with_brackets,
  fname,
  lname
FROM member
WHERE member_id LIKE '%2153442807%';

-- 4. FIX: Remove all leading/trailing spaces from member_id
UPDATE member 
SET member_id = TRIM(member_id)
WHERE member_id != TRIM(member_id);

-- 5. FIX: Also trim member_id in member_tier table
UPDATE member_tier 
SET member_id = TRIM(member_id)
WHERE member_id != TRIM(member_id);

-- 6. Verify fix - should return 0 rows
SELECT 
  member_id,
  LENGTH(member_id) as id_length
FROM member
WHERE member_id != TRIM(member_id);
