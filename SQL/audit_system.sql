-- Audit System Tables
-- Run: psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/audit_system.sql

-- ============================================================================
-- DATE/TIME HELPER FUNCTIONS (must be created first)
-- 4-byte INTEGER storing 10-second blocks since 1959-12-03 00:00:00
-- ============================================================================

-- Convert TIMESTAMPTZ to audit integer (10-second blocks since epoch)
CREATE OR REPLACE FUNCTION timestamp_to_audit_ts(ts TIMESTAMPTZ) 
RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN FLOOR(EXTRACT(EPOCH FROM (ts - TIMESTAMPTZ '1959-12-03 00:00:00+00')) / 10)::INTEGER;
END;
$$;

-- Convert audit integer back to TIMESTAMPTZ
CREATE OR REPLACE FUNCTION audit_ts_to_timestamp(audit_ts INTEGER) 
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN TIMESTAMPTZ '1959-12-03 00:00:00+00' + (audit_ts * INTERVAL '10 seconds');
END;
$$;

-- Get current time as audit integer
CREATE OR REPLACE FUNCTION current_audit_ts() 
RETURNS INTEGER
LANGUAGE SQL STABLE AS $$
  SELECT timestamp_to_audit_ts(NOW());
$$;

COMMENT ON FUNCTION timestamp_to_audit_ts IS 'Convert timestamp to 4-byte audit format (10-sec blocks since 1959-12-03)';
COMMENT ON FUNCTION audit_ts_to_timestamp IS 'Convert 4-byte audit format back to timestamp';
COMMENT ON FUNCTION current_audit_ts IS 'Get current time in audit format';

-- ============================================================================
-- ENTITY TYPE REGISTRY
-- Maps table names to 1-byte codes, routes to correct audit_log table by key size
-- Codes assigned dynamically by helper (like link_tank)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_entity_type (
  entity_code CHAR(1) PRIMARY KEY,
  table_name VARCHAR(50) UNIQUE NOT NULL,
  key_size CHAR(1) NOT NULL CHECK (key_size IN ('1', '2', '3', '4', '5')),
  description VARCHAR(100),
  created_at INTEGER DEFAULT current_audit_ts()
);

COMMENT ON TABLE audit_entity_type IS 'Registry of audited entities. Entity codes assigned dynamically like link_tank.';

-- ============================================================================
-- AUDIT LOG TABLES
-- One table per key size, matching molecule storage pattern
-- ============================================================================

-- 1-byte keys (future use)
CREATE TABLE IF NOT EXISTS audit_log_1 (
  audit_id BIGSERIAL PRIMARY KEY,
  tenant_id SMALLINT REFERENCES tenant(tenant_id),
  user_id INTEGER REFERENCES platform_user(user_id),
  action_ts INTEGER NOT NULL DEFAULT current_audit_ts(),
  entity_code CHAR(1) NOT NULL REFERENCES audit_entity_type(entity_code),
  entity_key CHAR(1) NOT NULL,
  action CHAR(1) NOT NULL CHECK (action IN ('A', 'D', 'E')),
  snapshot JSONB
);

-- 2-byte keys (SMALLINT - lookup tables)
CREATE TABLE IF NOT EXISTS audit_log_2 (
  audit_id BIGSERIAL PRIMARY KEY,
  tenant_id SMALLINT REFERENCES tenant(tenant_id),
  user_id INTEGER REFERENCES platform_user(user_id),
  action_ts INTEGER NOT NULL DEFAULT current_audit_ts(),
  entity_code CHAR(1) NOT NULL REFERENCES audit_entity_type(entity_code),
  entity_key SMALLINT NOT NULL,
  action CHAR(1) NOT NULL CHECK (action IN ('A', 'D', 'E')),
  snapshot JSONB
);

-- 3-byte keys (future use)
CREATE TABLE IF NOT EXISTS audit_log_3 (
  audit_id BIGSERIAL PRIMARY KEY,
  tenant_id SMALLINT REFERENCES tenant(tenant_id),
  user_id INTEGER REFERENCES platform_user(user_id),
  action_ts INTEGER NOT NULL DEFAULT current_audit_ts(),
  entity_code CHAR(1) NOT NULL REFERENCES audit_entity_type(entity_code),
  entity_key CHAR(3) NOT NULL,
  action CHAR(1) NOT NULL CHECK (action IN ('A', 'D', 'E')),
  snapshot JSONB
);

-- 4-byte keys (INTEGER - platform_user, etc.)
CREATE TABLE IF NOT EXISTS audit_log_4 (
  audit_id BIGSERIAL PRIMARY KEY,
  tenant_id SMALLINT REFERENCES tenant(tenant_id),
  user_id INTEGER REFERENCES platform_user(user_id),
  action_ts INTEGER NOT NULL DEFAULT current_audit_ts(),
  entity_code CHAR(1) NOT NULL REFERENCES audit_entity_type(entity_code),
  entity_key INTEGER NOT NULL,
  action CHAR(1) NOT NULL CHECK (action IN ('A', 'D', 'E')),
  snapshot JSONB
);

-- 5-byte keys (CHAR(5) - activities, members via link)
CREATE TABLE IF NOT EXISTS audit_log_5 (
  audit_id BIGSERIAL PRIMARY KEY,
  tenant_id SMALLINT REFERENCES tenant(tenant_id),
  user_id INTEGER REFERENCES platform_user(user_id),
  action_ts INTEGER NOT NULL DEFAULT current_audit_ts(),
  entity_code CHAR(1) NOT NULL REFERENCES audit_entity_type(entity_code),
  entity_key CHAR(5) NOT NULL,
  action CHAR(1) NOT NULL CHECK (action IN ('A', 'D', 'E')),
  snapshot JSONB
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Entity lookups (find all audit entries for a specific record)
CREATE INDEX IF NOT EXISTS idx_audit_log_1_entity ON audit_log_1(entity_code, entity_key);
CREATE INDEX IF NOT EXISTS idx_audit_log_2_entity ON audit_log_2(entity_code, entity_key);
CREATE INDEX IF NOT EXISTS idx_audit_log_3_entity ON audit_log_3(entity_code, entity_key);
CREATE INDEX IF NOT EXISTS idx_audit_log_4_entity ON audit_log_4(entity_code, entity_key);
CREATE INDEX IF NOT EXISTS idx_audit_log_5_entity ON audit_log_5(entity_code, entity_key);

-- User activity (find all actions by a specific user)
CREATE INDEX IF NOT EXISTS idx_audit_log_1_user ON audit_log_1(user_id, action_ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_2_user ON audit_log_2(user_id, action_ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_3_user ON audit_log_3(user_id, action_ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_4_user ON audit_log_4(user_id, action_ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_5_user ON audit_log_5(user_id, action_ts);

-- Tenant activity (find all actions within a tenant)
CREATE INDEX IF NOT EXISTS idx_audit_log_1_tenant ON audit_log_1(tenant_id, action_ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_2_tenant ON audit_log_2(tenant_id, action_ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_3_tenant ON audit_log_3(tenant_id, action_ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_4_tenant ON audit_log_4(tenant_id, action_ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_5_tenant ON audit_log_5(tenant_id, action_ts);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN audit_log_5.action IS 'A=Add, D=Delete, E=Edit';
COMMENT ON COLUMN audit_log_5.snapshot IS 'NULL for adds, entity state before delete/edit';
COMMENT ON COLUMN audit_log_5.action_ts IS '10-second blocks since 1959-12-03 (4-byte datetime)';
