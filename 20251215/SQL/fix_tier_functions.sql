-- Fix tier lookup functions - ensure they accept BIGINT
-- Date: 2025-11-13

-- Drop the old VARCHAR versions
DROP FUNCTION IF EXISTS get_member_current_tier(character varying);
DROP FUNCTION IF EXISTS get_member_tier_on_date(character varying, date);

-- Recreate with BIGINT parameter
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

-- Verify
\df get_member_current_tier
\df get_member_tier_on_date
