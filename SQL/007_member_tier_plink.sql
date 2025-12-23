-- Migration 007: Add p_link to member_tier
-- Date: 2025-12-04
-- Purpose: Replace member_id FK with p_link → member.link

-- Step 1: Add p_link column
ALTER TABLE member_tier ADD COLUMN p_link CHARACTER(5);

-- Step 2: Populate from existing member_id → member.link
UPDATE member_tier mt
SET p_link = m.link
FROM member m
WHERE mt.member_id = m.member_id;

-- Step 3: Verify population
SELECT 
  mt.member_tier_id,
  mt.member_id,
  mt.p_link,
  m.link as member_link,
  (mt.p_link = m.link) as match
FROM member_tier mt
JOIN member m ON mt.member_id = m.member_id;

-- Step 4: Add index on p_link (replaces member_id index)
CREATE INDEX idx_member_tier_plink ON member_tier(p_link);

-- NOTE: Do NOT drop member_id until code is updated
-- ALTER TABLE member_tier DROP COLUMN member_id;  -- LATER
