-- Flag molecules: storage_size = '0' for presence-only tagging
-- Run: psql -d loyalty -f sql/flag_molecules.sql

-- ============================================================================
-- 5_data_0: Flag molecule storage (no value column, presence = true)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "5_data_0" (
  p_link CHARACTER(5) NOT NULL COLLATE "C",
  molecule_id INTEGER NOT NULL,
  attaches_to CHARACTER(1) NOT NULL,
  PRIMARY KEY (p_link, molecule_id, attaches_to)
);

-- Index for finding all flags on an entity
CREATE INDEX IF NOT EXISTS idx_5_data_0_plink ON "5_data_0" (p_link, attaches_to);

-- Index for finding all entities with a specific flag
CREATE INDEX IF NOT EXISTS idx_5_data_0_molecule ON "5_data_0" (molecule_id, attaches_to);

-- ============================================================================
-- Fix molecule_id sequence if out of sync
-- ============================================================================
SELECT setval('molecule_def_molecule_id_seq', COALESCE((SELECT MAX(molecule_id) FROM molecule_def), 0) + 1, false);

-- ============================================================================
-- is_deleted molecule: Seed for each existing tenant
-- ============================================================================
INSERT INTO molecule_def (
  molecule_key, label, tenant_id, context, attaches_to,
  molecule_type, value_kind, storage_size,
  is_static, is_permanent, is_required, is_active, system_required,
  description
)
SELECT 
  'is_deleted', 'Deleted', tenant_id, 'system', 'AM',
  'D', 'value', '0',
  false, true, false, true, true,
  'Flag indicating soft-deleted record'
FROM tenant
WHERE NOT EXISTS (
  SELECT 1 FROM molecule_def 
  WHERE molecule_key = 'is_deleted' AND molecule_def.tenant_id = tenant.tenant_id
);

-- Verify
SELECT tenant_id, molecule_id, molecule_key, storage_size, attaches_to 
FROM molecule_def 
WHERE molecule_key = 'is_deleted'
ORDER BY tenant_id;
