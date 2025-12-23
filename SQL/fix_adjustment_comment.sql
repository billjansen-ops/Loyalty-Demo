-- CORRECTED: Add activity comment support for adjustments
-- Date: 2025-12-18
-- Previous script used wrong table name (adjustment_definition instead of adjustment)

-- 1. Add comment_mode column to adjustment table
-- Values: 'none', 'optional', 'required'
ALTER TABLE adjustment 
ADD COLUMN IF NOT EXISTS comment_mode VARCHAR(10) DEFAULT 'none';

-- 2. Update all existing adjustment rules to 'none'
UPDATE adjustment SET comment_mode = 'none' WHERE comment_mode IS NULL;

-- 3. Verify
SELECT adjustment_code, adjustment_name, comment_mode 
FROM adjustment 
ORDER BY tenant_id, adjustment_code;
