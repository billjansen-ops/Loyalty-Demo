BEGIN;

-- 1. Allow per-tenant sequences in the link_tank table
ALTER TABLE link_tank DROP CONSTRAINT IF EXISTS link_tank_pkey;
ALTER TABLE link_tank ADD PRIMARY KEY (tenant_id, key_type);

-- 2. Seed Delta (Tenant 1)
INSERT INTO link_tank (tenant_id, key_type, last_value) 
VALUES (1, 'membership_number', 100004)
ON CONFLICT (tenant_id, key_type) DO UPDATE SET last_value = EXCLUDED.last_value;

-- 3. Seed Marriott (Tenant 2)
INSERT INTO link_tank (tenant_id, key_type, last_value) 
VALUES (2, 'membership_number', 200002)
ON CONFLICT (tenant_id, key_type) DO UPDATE SET last_value = EXCLUDED.last_value;

COMMIT;