-- Fix point_expiration_rule to allow same rule_key across different tenants
-- Currently rule_key is the primary key, but it should be unique per tenant

-- Step 1: Drop the existing primary key constraint
ALTER TABLE point_expiration_rule DROP CONSTRAINT point_expiration_rule_pkey;

-- Step 2: Add rule_id as auto-increment primary key if it doesn't exist
-- Check if rule_id exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'point_expiration_rule' AND column_name = 'rule_id') THEN
    ALTER TABLE point_expiration_rule ADD COLUMN rule_id SERIAL PRIMARY KEY;
  ELSE
    -- rule_id exists, make it the primary key
    ALTER TABLE point_expiration_rule ADD PRIMARY KEY (rule_id);
  END IF;
END $$;

-- Step 3: Add unique constraint on (tenant_id, rule_key) instead
ALTER TABLE point_expiration_rule ADD CONSTRAINT point_expiration_rule_tenant_key UNIQUE (tenant_id, rule_key);

-- Verify
\d point_expiration_rule
