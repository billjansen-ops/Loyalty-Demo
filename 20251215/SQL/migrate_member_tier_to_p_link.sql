-- Migration: member_tier - replace member_id with p_link
-- Date: 2025-12-07
-- Backup: server_db_api.js.backup_member_tier_refactor

-- Step 1: Verify p_link is already populated
SELECT COUNT(*) as total_rows,
       COUNT(p_link) as rows_with_p_link,
       COUNT(member_id) as rows_with_member_id
FROM member_tier;

-- Step 2: If p_link is NULL, populate it from member table
UPDATE member_tier mt
SET p_link = m.link
FROM member m
WHERE mt.member_id = m.member_id
  AND mt.p_link IS NULL;

-- Step 3: Verify all rows now have p_link
SELECT COUNT(*) as rows_missing_p_link
FROM member_tier
WHERE p_link IS NULL;

-- Step 4: Drop the member_id column
ALTER TABLE member_tier DROP COLUMN member_id;

-- Step 5: Make p_link NOT NULL
ALTER TABLE member_tier ALTER COLUMN p_link SET NOT NULL;

-- Step 6: Add index on p_link for performance
CREATE INDEX IF NOT EXISTS idx_member_tier_p_link ON member_tier(p_link);

-- Step 7: Update the get_member_tier_on_date function
DROP FUNCTION IF EXISTS get_member_tier_on_date(bigint, date);

CREATE OR REPLACE FUNCTION get_member_tier_on_date(p_link char(5), p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(tier_code character varying, tier_description character varying, tier_ranking integer)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        td.tier_code,
        td.tier_description,
        td.tier_ranking
    FROM member_tier mt
    JOIN tier_definition td ON mt.tier_id = td.tier_id
    WHERE mt.p_link = get_member_tier_on_date.p_link
      AND mt.start_date <= p_date
      AND (mt.end_date IS NULL OR mt.end_date >= p_date)
    ORDER BY td.tier_ranking DESC
    LIMIT 1;
END;
$$;

-- Step 8: Update get_member_current_tier to use new function signature
DROP FUNCTION IF EXISTS get_member_current_tier(bigint);

CREATE OR REPLACE FUNCTION get_member_current_tier(p_link char(5))
RETURNS TABLE(tier_code character varying, tier_description character varying, tier_ranking integer)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_member_tier_on_date(p_link, CURRENT_DATE);
END;
$$;

-- Step 9: Verify final structure
\d member_tier
