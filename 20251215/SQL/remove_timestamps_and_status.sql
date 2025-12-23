-- Remove created_at, updated_at, and status columns from promotion tables
-- Date: 2025-11-22

-- Remove created_at and updated_at from promotion table
ALTER TABLE promotion 
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;

-- Remove created_at and status from member_promotion table
ALTER TABLE member_promotion 
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS status;

-- Drop the status-related constraints that will become invalid
ALTER TABLE member_promotion 
  DROP CONSTRAINT IF EXISTS member_promotion_status_check,
  DROP CONSTRAINT IF EXISTS valid_member_promotion_status;

-- Remove created_at from member_promotion_detail table
ALTER TABLE member_promotion_detail 
  DROP COLUMN IF EXISTS created_at;

-- Verification queries
SELECT 'promotion columns:' as table_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'promotion' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'member_promotion columns:' as table_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'member_promotion' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'member_promotion_detail columns:' as table_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'member_promotion_detail' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
