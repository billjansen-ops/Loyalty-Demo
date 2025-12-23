-- Add activity comment support for adjustments
-- Date: 2025-12-18

-- 1. Add comment_mode column to adjustment_definition
-- Values: 'none', 'optional', 'required'
ALTER TABLE adjustment_definition 
ADD COLUMN IF NOT EXISTS comment_mode VARCHAR(10) DEFAULT 'none';

-- 2. Update all existing adjustment rules to 'none'
UPDATE adjustment_definition SET comment_mode = 'none' WHERE comment_mode IS NULL;

-- 3. Create activity_comment molecule definition (non-indexed)
-- This is a generic comment that can attach to any activity type
INSERT INTO molecule_definition (
    tenant_id,
    molecule_name,
    molecule_key,
    data_type,
    is_indexed,
    applies_to,
    display_order,
    is_active
) 
SELECT 
    t.tenant_id,
    'Activity Comment',
    'activity_comment',
    'text',
    false,           -- non-indexed
    'activity',
    900,             -- high display order, shows at end
    true
FROM tenant t
WHERE NOT EXISTS (
    SELECT 1 FROM molecule_definition md 
    WHERE md.tenant_id = t.tenant_id 
    AND md.molecule_key = 'activity_comment'
)
ON CONFLICT DO NOTHING;

-- Verify
SELECT 'adjustment_definition comment_mode:' as check_type;
SELECT adjustment_code, adjustment_name, comment_mode 
FROM adjustment_definition 
ORDER BY tenant_id, adjustment_code;

SELECT 'activity_comment molecule:' as check_type;
SELECT tenant_id, molecule_name, molecule_key, is_indexed, applies_to 
FROM molecule_definition 
WHERE molecule_key = 'activity_comment';
