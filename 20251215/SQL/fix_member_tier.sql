-- Fix member_tier table
-- Date: 2025-11-13
-- Purpose: Convert member_id to BIGINT and remove timestamp columns

-- Delete bad test data (member_id = 'null' string)
DELETE FROM member_tier WHERE member_id = 'null';

-- Drop any foreign key constraints on member_tier
ALTER TABLE member_tier DROP CONSTRAINT IF EXISTS member_tier_member_id_fkey;
ALTER TABLE member_tier DROP CONSTRAINT IF EXISTS fk_member_tier_member;

-- Convert member_id from VARCHAR(16) to BIGINT
ALTER TABLE member_tier ALTER COLUMN member_id TYPE BIGINT USING member_id::BIGINT;

-- Remove timestamp columns
ALTER TABLE member_tier DROP COLUMN IF EXISTS created_at;
ALTER TABLE member_tier DROP COLUMN IF EXISTS updated_at;

-- Recreate foreign key constraint to member table
ALTER TABLE member_tier 
  ADD CONSTRAINT fk_member_tier_member 
  FOREIGN KEY (member_id) REFERENCES member(member_id);

-- Update tier lookup functions to accept BIGINT instead of VARCHAR
CREATE OR REPLACE FUNCTION public.get_member_current_tier(p_member_id BIGINT) 
RETURNS TABLE(tier_code character varying, tier_description character varying, tier_ranking integer)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_member_tier_on_date(p_member_id, CURRENT_DATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_tier_on_date(p_member_id BIGINT, p_date date DEFAULT CURRENT_DATE) 
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
    WHERE mt.member_id = p_member_id
      AND mt.start_date <= p_date
      AND (mt.end_date IS NULL OR mt.end_date >= p_date)
    ORDER BY td.tier_ranking DESC
    LIMIT 1;
END;
$$;

-- Verification
\d member_tier
