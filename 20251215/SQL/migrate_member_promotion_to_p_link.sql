-- Migration: member_promotion - replace member_id with p_link, drop unused link
-- Date: 2025-12-07
-- Backup: server_db_api.js.backup_member_promo_refactor

-- Step 1: Verify p_link is already populated
SELECT COUNT(*) as total_rows,
       COUNT(p_link) as rows_with_p_link,
       COUNT(member_id) as rows_with_member_id
FROM member_promotion;

-- Step 2: If p_link is NULL, populate it from member table
UPDATE member_promotion mp
SET p_link = m.link
FROM member m
WHERE mp.member_id = m.member_id
  AND mp.p_link IS NULL;

-- Step 3: Verify all rows now have p_link
SELECT COUNT(*) as rows_missing_p_link
FROM member_promotion
WHERE p_link IS NULL;

-- Step 4: Drop the member_id column
ALTER TABLE member_promotion DROP COLUMN member_id;

-- Step 5: Drop the link column (not using it - keeping member_promotion_id as PK)
ALTER TABLE member_promotion DROP COLUMN IF EXISTS link;

-- Step 6: Make p_link NOT NULL (if not already)
ALTER TABLE member_promotion ALTER COLUMN p_link SET NOT NULL;

-- Step 7: Add index on p_link for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_member_promotion_p_link ON member_promotion(p_link);

-- Step 8: Verify final structure
\d member_promotion
