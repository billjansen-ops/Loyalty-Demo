-- Point Type Phase 2: Simplify structure, add FKs to source tables
-- Run after point_type_schema.sql has been executed

-- 1. Drop the routing rule table (not needed - FKs on source tables instead)
DROP TABLE IF EXISTS point_routing_rule;

-- 2. Clean up point_type: remove expiration fields, rename is_active to status
ALTER TABLE point_type DROP COLUMN IF EXISTS expiration_mode;
ALTER TABLE point_type DROP COLUMN IF EXISTS expiration_days;
ALTER TABLE point_type DROP COLUMN IF EXISTS expiration_date;
ALTER TABLE point_type DROP COLUMN IF EXISTS is_default;
ALTER TABLE point_type RENAME COLUMN is_active TO status;

-- 3. Add point_type_id to source tables (NULL = use tenant default)
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS point_type_id INTEGER REFERENCES point_type(point_type_id);
ALTER TABLE partner ADD COLUMN IF NOT EXISTS point_type_id INTEGER REFERENCES point_type(point_type_id);
ALTER TABLE promotion ADD COLUMN IF NOT EXISTS point_type_id INTEGER REFERENCES point_type(point_type_id);
ALTER TABLE bonus ADD COLUMN IF NOT EXISTS point_type_id INTEGER REFERENCES point_type(point_type_id);
ALTER TABLE adjustment ADD COLUMN IF NOT EXISTS point_type_id INTEGER REFERENCES point_type(point_type_id);

-- 4. Add point_type_id to point_expiration_rule (links expiration buckets to point types)
ALTER TABLE point_expiration_rule ADD COLUMN IF NOT EXISTS point_type_id INTEGER REFERENCES point_type(point_type_id);

-- 5. Set existing expiration rules to default point type (BASE)
UPDATE point_expiration_rule per
SET point_type_id = pt.point_type_id
FROM point_type pt
WHERE per.tenant_id = pt.tenant_id
  AND pt.point_type_code = 'BASE'
  AND per.point_type_id IS NULL;

-- 6. Create index for expiration rule lookups by point type
CREATE INDEX IF NOT EXISTS idx_expiration_rule_point_type ON point_expiration_rule(point_type_id);
