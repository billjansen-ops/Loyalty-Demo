-- Check the activity table schema to ensure we're using correct column names

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'activity'
ORDER BY ordinal_position;
