-- Add goal_amount to member_promotion table
-- Date: 2025-11-22
-- Locks in the goal at enrollment time, independent of future promotion rule changes

ALTER TABLE member_promotion
  ADD COLUMN goal_amount NUMERIC NOT NULL DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN member_promotion.goal_amount IS 
  'Goal amount locked in at enrollment time. Copied from promotion.goal_amount when member enrolls. Prevents retroactive changes if promotion rule is modified.';

-- Verification query
SELECT 'member_promotion columns:' as table_name;
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'member_promotion' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
