-- Add promotion tracking columns to member_tier table
-- Date: 2025-11-22

-- Add member_promotion_id - which promotion created this tier record
ALTER TABLE member_tier
  ADD COLUMN member_promotion_id BIGINT REFERENCES member_promotion(member_promotion_id);

-- Add qualified_by_promotion_id - which promotion actually triggered the tier award (self or parallel)
ALTER TABLE member_tier
  ADD COLUMN qualified_by_promotion_id BIGINT REFERENCES member_promotion(member_promotion_id);

-- Add comment explaining the columns
COMMENT ON COLUMN member_tier.member_promotion_id IS 
  'The promotion that created this tier record';

COMMENT ON COLUMN member_tier.qualified_by_promotion_id IS 
  'The promotion that triggered tier qualification. Usually same as member_promotion_id, but can point to a parallel promotion that qualified first';

-- Verification query
SELECT 'member_tier columns:' as table_name;
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'member_tier' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
