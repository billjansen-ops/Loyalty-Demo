-- Setup member_number counter in link_tank
-- Run after migration to sysparm is complete

-- Step 1: Create sysparms for membership number config (if not exists)
INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
VALUES (1, 'check_digit_algorithm', 'text', 'Algorithm for membership number check digit: luhn, mod10, or none')
ON CONFLICT (tenant_id, sysparm_key) DO NOTHING;

INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
VALUES (1, 'member_number_length', 'numeric', 'Total length of membership number (pads with zeros)')
ON CONFLICT (tenant_id, sysparm_key) DO NOTHING;

-- Set default values
INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, NULL, NULL, 'none', 0 FROM sysparm 
WHERE sysparm_key = 'check_digit_algorithm' AND tenant_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
SELECT sysparm_id, NULL, NULL, '10', 0 FROM sysparm 
WHERE sysparm_key = 'member_number_length' AND tenant_id = 1
ON CONFLICT DO NOTHING;

-- Step 2: Check current state

-- The offset is already in sysparm: membership_number_offset = 2153442000
-- We need to calculate: counter = last_member_number - offset

-- Check highest existing membership_number in member table
SELECT MAX(CAST(membership_number AS BIGINT)) as highest_member_number FROM member WHERE tenant_id = 1;

-- Get the offset we set
SELECT value as offset FROM sysparm_detail sd
JOIN sysparm s ON sd.sysparm_id = s.sysparm_id
WHERE s.sysparm_key = 'membership_number_offset' AND s.tenant_id = 1;

-- Step 3: Insert member_number into link_tank
-- Replace COUNTER_VALUE with: highest_member_number - offset + 1
-- Example: if highest = 2153442807 and offset = 2153442000, counter = 808

INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
VALUES (1, 'member_number', 4, 17);  -- <-- ADJUST based on your data (current members + 1)

-- Verify
SELECT * FROM link_tank WHERE table_key = 'member_number';
SELECT * FROM sysparm s JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id 
WHERE s.sysparm_key IN ('membership_number_offset', 'check_digit_algorithm', 'member_number_length') 
AND s.tenant_id = 1;
