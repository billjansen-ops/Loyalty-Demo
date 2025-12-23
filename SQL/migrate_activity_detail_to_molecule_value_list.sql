-- Migration: Move activity_detail data to molecule_value_list
-- Date: 2025-11-29
-- 
-- This migrates all activity molecule data from the old activity_detail table
-- to the unified molecule_value_list table.
--
-- activity_detail columns: activity_id, molecule_id, v_ref_id
-- molecule_value_list columns: molecule_id, context_id, row_num, col, value

-- Step 1: Check current counts
SELECT 'activity_detail rows' as source, COUNT(*) as count FROM activity_detail
UNION ALL
SELECT 'molecule_value_list rows (activity context)', COUNT(*) 
FROM molecule_value_list mvl
JOIN molecule_def md ON mvl.molecule_id = md.molecule_id
WHERE md.context = 'activity';

-- Step 2: Migrate activity_detail to molecule_value_list
-- Each activity_detail row becomes one molecule_value_list row with:
--   context_id = activity_id
--   row_num = 1 (single value per molecule per activity)
--   col = 'A' (primary value column)
--   value = v_ref_id (the reference value)

INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value)
SELECT 
  ad.molecule_id,
  ad.activity_id as context_id,
  1 as row_num,
  'A' as col,
  ad.v_ref_id as value
FROM activity_detail ad
WHERE NOT EXISTS (
  SELECT 1 FROM molecule_value_list mvl
  WHERE mvl.molecule_id = ad.molecule_id 
    AND mvl.context_id = ad.activity_id
    AND mvl.row_num = 1
    AND mvl.col = 'A'
);

-- Step 3: Verify migration
SELECT 'activity_detail rows' as source, COUNT(*) as count FROM activity_detail
UNION ALL
SELECT 'molecule_value_list rows (activity context)', COUNT(*) 
FROM molecule_value_list mvl
JOIN molecule_def md ON mvl.molecule_id = md.molecule_id
WHERE md.context = 'activity';

-- Step 4: Verify data integrity - spot check a few activities
SELECT 
  ad.activity_id,
  md.molecule_key,
  ad.v_ref_id as old_value,
  mvl.value as new_value,
  CASE WHEN ad.v_ref_id::text = mvl.value::text THEN 'MATCH' ELSE 'MISMATCH' END as status
FROM activity_detail ad
JOIN molecule_def md ON ad.molecule_id = md.molecule_id
JOIN molecule_value_list mvl ON mvl.molecule_id = ad.molecule_id 
  AND mvl.context_id = ad.activity_id 
  AND mvl.col = 'A'
LIMIT 20;

-- Optional Step 5: Once verified, you can rename/archive the old table
-- ALTER TABLE activity_detail RENAME TO activity_detail_archive;

-- Optional Step 6: Or drop it entirely (only after thorough testing!)
-- DROP TABLE activity_detail;
