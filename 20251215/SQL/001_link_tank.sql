-- Link Tank Migration - DDL Only
-- Backfill must be done via server-side JavaScript

-- 1. Create link_tank table (tenant-scoped)
CREATE TABLE IF NOT EXISTS link_tank (
  tenant_id SMALLINT NOT NULL,
  table_key VARCHAR(30) NOT NULL,
  link_bytes SMALLINT NOT NULL,
  next_link BIGINT NOT NULL,
  PRIMARY KEY (tenant_id, table_key)
);

COMMENT ON TABLE link_tank IS 'Central registry managing all primary keys with right-sized storage (per tenant)';

-- 2. Add link column to member table
ALTER TABLE member ADD COLUMN IF NOT EXISTS link CHARACTER(5);

-- 3. Create index on link (includes tenant_id for multi-tenant queries)
CREATE INDEX IF NOT EXISTS idx_member_tenant_link ON member(tenant_id, link);
