-- Normalized audit change tracking
-- Run: psql -d loyalty -f sql/audit_change_tables.sql

-- Clear bad audit data
TRUNCATE audit_log_1, audit_log_2, audit_log_3, audit_log_4, audit_log_5;

-- ============================================================================
-- audit_field: Registry of table+field combinations (2-byte code)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_field (
  link SMALLINT PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  UNIQUE (table_name, field_name)
);

-- ============================================================================
-- audit_change: Individual field changes for edits
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_change (
  link INTEGER PRIMARY KEY,
  p_link INTEGER NOT NULL,          -- FK to audit_log_*.link
  key_size CHAR(1) NOT NULL,        -- which audit_log table ('1','2','3','4','5')
  field_link SMALLINT NOT NULL REFERENCES audit_field(link),
  old_value VARCHAR(500)            -- what it was before
);

CREATE INDEX IF NOT EXISTS idx_audit_change_p_link ON audit_change(p_link, key_size);

-- Initialize link_tank entries
INSERT INTO link_tank (table_key, next_link)
VALUES ('audit_field', 1)
ON CONFLICT (table_key) DO NOTHING;

INSERT INTO link_tank (table_key, next_link)
VALUES ('audit_change', 1)
ON CONFLICT (table_key) DO NOTHING;

-- Verify
SELECT 'audit_field' as table_name, COUNT(*) as rows FROM audit_field
UNION ALL
SELECT 'audit_change', COUNT(*) FROM audit_change;
