-- Add tenant_id to bonus table

-- Step 1: Add the column (nullable for now)
ALTER TABLE bonus ADD COLUMN tenant_id INTEGER REFERENCES tenant(tenant_id);

-- Step 2: Assign all existing bonuses to Delta (tenant_id = 1)
UPDATE bonus SET tenant_id = 1 WHERE tenant_id IS NULL;

-- Step 3: Make it required going forward
ALTER TABLE bonus ALTER COLUMN tenant_id SET NOT NULL;

-- Step 4: Add index for performance
CREATE INDEX idx_bonus_tenant ON bonus(tenant_id);

-- Step 5: Verify
SELECT bonus_id, tenant_id, bonus_code, bonus_description 
FROM bonus 
ORDER BY tenant_id, bonus_id;
