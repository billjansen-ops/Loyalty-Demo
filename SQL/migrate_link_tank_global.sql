-- Migration: Remove tenant_id from link_tank
-- Date: 2025-12-29
-- Reason: Links must be globally unique across all tenants, not per-tenant
--
-- This migration:
-- 1. Creates new link_tank structure with table_key as sole PK
-- 2. Consolidates existing rows by taking MAX(next_link) per table_key
-- 3. Drops old table and renames new one

BEGIN;

-- Step 1: Create new table structure
CREATE TABLE link_tank_new (
    table_key character varying(30) NOT NULL PRIMARY KEY,
    link_bytes smallint NOT NULL,
    next_link bigint NOT NULL
);

COMMENT ON TABLE link_tank_new IS 'Central registry managing all primary keys with right-sized storage (global)';

-- Step 2: Consolidate - for each table_key, take the MAX(next_link)
-- This ensures no collisions with existing data
INSERT INTO link_tank_new (table_key, link_bytes, next_link)
SELECT table_key, MAX(link_bytes), MAX(next_link)
FROM link_tank
GROUP BY table_key;

-- Step 3: Drop old, rename new
DROP TABLE link_tank;
ALTER TABLE link_tank_new RENAME TO link_tank;

COMMIT;

-- Verify
SELECT * FROM link_tank ORDER BY table_key;
