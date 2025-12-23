-- Add tenant_id to point_expiration_rule
ALTER TABLE point_expiration_rule ADD COLUMN tenant_id INTEGER REFERENCES tenant(tenant_id);

-- Set existing rules to tenant 1
UPDATE point_expiration_rule SET tenant_id = 1;

-- Make tenant_id NOT NULL
ALTER TABLE point_expiration_rule ALTER COLUMN tenant_id SET NOT NULL;

-- Add index
CREATE INDEX idx_expiration_rule_tenant ON point_expiration_rule(tenant_id);

-- Verify
SELECT * FROM point_expiration_rule ORDER BY tenant_id, start_date;
