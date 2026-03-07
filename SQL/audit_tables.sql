-- Audit system tables
-- Run: psql -d loyalty -f sql/audit_tables.sql

-- ============================================================================
-- audit_entity_type: Registry of auditable tables (one per table per tenant)
-- ============================================================================
DROP TABLE IF EXISTS audit_log_1, audit_log_2, audit_log_3, audit_log_4, audit_log_5 CASCADE;
DROP TABLE IF EXISTS audit_entity_type CASCADE;

CREATE TABLE audit_entity_type (
  link CHAR(1) NOT NULL,           -- 1-byte PK
  tenant_id SMALLINT NOT NULL,     -- tenant isolation
  table_name VARCHAR(64) NOT NULL, -- table being audited
  key_size CHAR(1) NOT NULL,       -- '1', '2', '3', '4', '5'
  description VARCHAR(255),
  PRIMARY KEY (link),
  UNIQUE (tenant_id, table_name)
);

-- ============================================================================
-- audit_log_* tables: Actual audit entries (split by entity_key size)
-- ============================================================================

-- 1-byte entity keys
CREATE TABLE audit_log_1 (
  link INTEGER NOT NULL,           -- 4-byte PK
  p_link CHAR(1) NOT NULL,         -- FK to audit_entity_type
  entity_key CHAR(1) NOT NULL,     -- link of record changed
  user_link SMALLINT,              -- FK to platform_user (null for system)
  action CHAR(1) NOT NULL,         -- 'A', 'E', 'D'
  changes JSONB,                   -- diff only
  audit_ts INTEGER NOT NULL,       -- compressed timestamp
  PRIMARY KEY (link),
  FOREIGN KEY (p_link) REFERENCES audit_entity_type(link)
);

-- 2-byte entity keys (SMALLINT)
CREATE TABLE audit_log_2 (
  link INTEGER NOT NULL,
  p_link CHAR(1) NOT NULL,
  entity_key SMALLINT NOT NULL,
  user_link SMALLINT,
  action CHAR(1) NOT NULL,
  changes JSONB,
  audit_ts INTEGER NOT NULL,
  PRIMARY KEY (link),
  FOREIGN KEY (p_link) REFERENCES audit_entity_type(link)
);

-- 3-byte entity keys (CHAR(3))
CREATE TABLE audit_log_3 (
  link INTEGER NOT NULL,
  p_link CHAR(1) NOT NULL,
  entity_key CHAR(3) NOT NULL,
  user_link SMALLINT,
  action CHAR(1) NOT NULL,
  changes JSONB,
  audit_ts INTEGER NOT NULL,
  PRIMARY KEY (link),
  FOREIGN KEY (p_link) REFERENCES audit_entity_type(link)
);

-- 4-byte entity keys (INTEGER)
CREATE TABLE audit_log_4 (
  link INTEGER NOT NULL,
  p_link CHAR(1) NOT NULL,
  entity_key INTEGER NOT NULL,
  user_link SMALLINT,
  action CHAR(1) NOT NULL,
  changes JSONB,
  audit_ts INTEGER NOT NULL,
  PRIMARY KEY (link),
  FOREIGN KEY (p_link) REFERENCES audit_entity_type(link)
);

-- 5-byte entity keys (CHAR(5))
CREATE TABLE audit_log_5 (
  link INTEGER NOT NULL,
  p_link CHAR(1) NOT NULL,
  entity_key CHAR(5) NOT NULL,
  user_link SMALLINT,
  action CHAR(1) NOT NULL,
  changes JSONB,
  audit_ts INTEGER NOT NULL,
  PRIMARY KEY (link),
  FOREIGN KEY (p_link) REFERENCES audit_entity_type(link)
);

-- Indexes for common queries
CREATE INDEX idx_audit_log_1_entity ON audit_log_1(p_link, entity_key);
CREATE INDEX idx_audit_log_1_ts ON audit_log_1(audit_ts);
CREATE INDEX idx_audit_log_2_entity ON audit_log_2(p_link, entity_key);
CREATE INDEX idx_audit_log_2_ts ON audit_log_2(audit_ts);
CREATE INDEX idx_audit_log_3_entity ON audit_log_3(p_link, entity_key);
CREATE INDEX idx_audit_log_3_ts ON audit_log_3(audit_ts);
CREATE INDEX idx_audit_log_4_entity ON audit_log_4(p_link, entity_key);
CREATE INDEX idx_audit_log_4_ts ON audit_log_4(audit_ts);
CREATE INDEX idx_audit_log_5_entity ON audit_log_5(p_link, entity_key);
CREATE INDEX idx_audit_log_5_ts ON audit_log_5(audit_ts);

-- ============================================================================
-- Add link column to platform_user
-- ============================================================================
ALTER TABLE platform_user ADD COLUMN IF NOT EXISTS link SMALLINT;

-- Backfill existing users with sequential links
DO $$
DECLARE
  r RECORD;
  counter SMALLINT := -32768;
BEGIN
  FOR r IN SELECT user_id FROM platform_user ORDER BY user_id LOOP
    UPDATE platform_user SET link = counter WHERE user_id = r.user_id;
    counter := counter + 1;
  END LOOP;
END $$;

-- Make link NOT NULL and unique after backfill
ALTER TABLE platform_user ALTER COLUMN link SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_user_link ON platform_user(link);

SELECT 'Audit tables created successfully' as status;
