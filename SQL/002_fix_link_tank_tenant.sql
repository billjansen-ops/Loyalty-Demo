-- Fix link_tank to be tenant-scoped
-- Run this if you already ran 001_link_tank.sql

-- Drop old table and index
DROP TABLE IF EXISTS link_tank;
DROP INDEX IF EXISTS idx_member_link;

-- Create new tenant-scoped link_tank
CREATE TABLE link_tank (
  tenant_id SMALLINT NOT NULL,
  table_key VARCHAR(30) NOT NULL,
  link_bytes SMALLINT NOT NULL,
  next_link BIGINT NOT NULL,
  PRIMARY KEY (tenant_id, table_key)
);

COMMENT ON TABLE link_tank IS 'Central registry managing all primary keys with right-sized storage (per tenant)';

-- Create new index with tenant_id
CREATE INDEX IF NOT EXISTS idx_member_tenant_link ON member(tenant_id, link);

-- Prime link_tank from existing members (per tenant)
INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
SELECT tenant_id, 'member', 5, COALESCE(MAX(member_id), 0) + 1
FROM member
GROUP BY tenant_id;
