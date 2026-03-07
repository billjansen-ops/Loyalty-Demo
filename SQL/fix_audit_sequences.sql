-- Fix audit_field and audit_change ID generation
-- Using sequences instead of link_tank for these system tables

-- Create sequence for audit_field (SMALLINT, start at 1)
CREATE SEQUENCE IF NOT EXISTS audit_field_link_seq AS SMALLINT START WITH 1;

-- Create sequence for audit_change (INTEGER, start at 1)
CREATE SEQUENCE IF NOT EXISTS audit_change_link_seq AS INTEGER START WITH 1;

-- Set default values on the columns
ALTER TABLE audit_field ALTER COLUMN link SET DEFAULT nextval('audit_field_link_seq');
ALTER TABLE audit_change ALTER COLUMN link SET DEFAULT nextval('audit_change_link_seq');

-- Verify
SELECT 'audit_field_link_seq' as seq, last_value FROM audit_field_link_seq
UNION ALL
SELECT 'audit_change_link_seq' as seq, last_value FROM audit_change_link_seq;
