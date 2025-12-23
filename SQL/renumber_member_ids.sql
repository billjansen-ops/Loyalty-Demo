-- Renumber member_id starting at 1 while preserving all data

BEGIN;

-- Create mapping of old to new member_id
CREATE TEMP TABLE member_id_map AS
SELECT member_id as old_id, 
       ROW_NUMBER() OVER (ORDER BY member_id) as new_id
FROM member;

-- Show mapping
SELECT * FROM member_id_map;

-- Step 1: Insert new member rows with new IDs (copies of existing rows)
INSERT INTO member (member_id, tenant_id, fname, lname, middle_initial, address1, address2, city, state, zip, phone, email, is_active, membership_number, zip_plus4)
SELECT m.new_id, mem.tenant_id, mem.fname, mem.lname, mem.middle_initial, mem.address1, mem.address2, mem.city, mem.state, mem.zip, mem.phone, mem.email, mem.is_active, mem.membership_number, mem.zip_plus4
FROM member mem
JOIN member_id_map m ON mem.member_id = m.old_id;

-- Step 2: Update child tables to point to new IDs
UPDATE activity SET member_id = m.new_id FROM member_id_map m WHERE activity.member_id = m.old_id;
UPDATE member_tier SET member_id = m.new_id FROM member_id_map m WHERE member_tier.member_id = m.old_id;
UPDATE member_promotion SET member_id = m.new_id FROM member_id_map m WHERE member_promotion.member_id = m.old_id;
UPDATE molecule_value_list SET context_id = m.new_id 
FROM member_id_map m 
WHERE molecule_value_list.context_id = m.old_id 
  AND molecule_id IN (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'member_point_bucket');

-- Step 3: Delete old member rows
DELETE FROM member WHERE member_id IN (SELECT old_id FROM member_id_map);

-- Verify
SELECT member_id, membership_number, fname, lname FROM member ORDER BY member_id;

COMMIT;
