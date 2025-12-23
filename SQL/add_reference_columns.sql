-- Add reference type support to molecule_def
-- 2025-11-13: Add columns for Reference molecules (direct_field and function types)

ALTER TABLE molecule_def 
ADD COLUMN ref_table_name TEXT,
ADD COLUMN ref_field_name TEXT,
ADD COLUMN ref_function_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN molecule_def.ref_table_name IS 'For reference/direct_field: table to query (e.g., member, activity)';
COMMENT ON COLUMN molecule_def.ref_field_name IS 'For reference/direct_field: field to retrieve (e.g., fname, activity_date)';
COMMENT ON COLUMN molecule_def.ref_function_name IS 'For reference/function: stored function to call (e.g., get_member_tier_on_date)';

-- Verification query
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'molecule_def' 
    AND column_name IN ('ref_table_name', 'ref_field_name', 'ref_function_name')
ORDER BY column_name;
