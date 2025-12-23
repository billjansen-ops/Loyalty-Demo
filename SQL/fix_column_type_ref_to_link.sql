-- Fix molecule_column_def: CHAR(5) FK columns should be 'link' not 'ref'
-- 'ref' = offset encoding for max positive range (like flight_number)
-- 'link' = raw pass-through for FK lookups

-- member_points column A (bucket link)
UPDATE molecule_column_def 
SET column_type = 'link'
WHERE molecule_id = 42 AND column_name = 'A';

-- bonus_activity_id column A (activity link)
UPDATE molecule_column_def 
SET column_type = 'link'
WHERE molecule_id = 38 AND column_name = 'A';

-- Verify
SELECT mcd.molecule_id, md.molecule_key, mcd.column_name, mcd.column_type, md.storage_size
FROM molecule_column_def mcd
JOIN molecule_def md ON mcd.molecule_id = md.molecule_id
WHERE mcd.molecule_id IN (42, 38);
