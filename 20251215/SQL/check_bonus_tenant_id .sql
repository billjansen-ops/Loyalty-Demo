-- Check if bonus table has tenant_id column
-- Run this first to see what needs to be added

\d bonus

-- If tenant_id column is missing, run this:
-- (Uncomment the lines below if needed)

-- ALTER TABLE bonus ADD COLUMN tenant_id INTEGER REFERENCES tenant(tenant_id);

-- Assign all existing bonuses to Delta (tenant_id = 1)
-- UPDATE bonus SET tenant_id = 1 WHERE tenant_id IS NULL;

-- Make it required going forward
-- ALTER TABLE bonus ALTER COLUMN tenant_id SET NOT NULL;

-- Add index for performance
-- CREATE INDEX idx_bonus_tenant ON bonus(tenant_id);

-- Verify
-- SELECT bonus_id, tenant_id, bonus_code FROM bonus ORDER BY bonus_id;
