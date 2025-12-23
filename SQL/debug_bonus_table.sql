-- Check bonus table structure
\d bonus

-- Check if tenant_id column exists and its type
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bonus'
ORDER BY ordinal_position;

-- Check for any existing bonuses
SELECT bonus_id, bonus_code, bonus_description, tenant_id, created_at
FROM bonus
ORDER BY created_at DESC
LIMIT 10;

-- Count bonuses by tenant
SELECT tenant_id, COUNT(*) as bonus_count
FROM bonus
GROUP BY tenant_id;
