-- Remove the last_member_number molecule (no longer used - counter comes from link_tank)
-- Run this against the loyalty database

-- Delete any stored values first
DELETE FROM "5_data_54" WHERE molecule_id IN (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'last_member_number');

-- Delete the molecule definition
DELETE FROM molecule_def WHERE molecule_key = 'last_member_number';

-- Verify
SELECT 'Deleted last_member_number molecule' as status;
