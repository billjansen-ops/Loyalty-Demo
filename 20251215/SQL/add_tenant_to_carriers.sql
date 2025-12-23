-- ============================================================
-- ADD tenant_id TO carriers TABLE
-- Run: psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/add_tenant_to_carriers.sql
-- ============================================================

\echo ''
\echo '📋 Adding tenant_id to carriers table...'
\echo ''

-- Add the column (allows NULL temporarily)
ALTER TABLE carriers ADD COLUMN tenant_id INTEGER;

-- Add foreign key constraint
ALTER TABLE carriers ADD CONSTRAINT carriers_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

\echo '✅ Column added'
\echo ''

-- Assign existing carriers to Delta (tenant_id = 1)
\echo '📝 Assigning existing carriers to tenant_id = 1 (Delta)...'
UPDATE carriers SET tenant_id = 1 WHERE tenant_id IS NULL;

\echo '✅ Existing carriers assigned'
\echo ''

-- Make it required going forward
ALTER TABLE carriers ALTER COLUMN tenant_id SET NOT NULL;

\echo '✅ Column set to NOT NULL'
\echo ''

-- Add index for filtering by tenant
CREATE INDEX idx_carriers_tenant ON carriers(tenant_id);

\echo '✅ Index created'
\echo ''

-- Verify the change
\echo '📊 Updated carriers table structure:'
\echo ''
\d carriers

\echo ''
\echo '📋 Sample carrier data with tenant_id:'
\echo ''
SELECT carrier_id, code, name, tenant_id FROM carriers ORDER BY code LIMIT 10;

\echo ''
\echo '✅ SUCCESS! tenant_id added to carriers table'
\echo ''
