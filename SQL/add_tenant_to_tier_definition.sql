-- ============================================================
-- ADD tenant_id TO tier_definition TABLE
-- Run: psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/add_tenant_to_tier_definition.sql
-- ============================================================

\echo ''
\echo '📋 Adding tenant_id to tier_definition table...'
\echo ''

-- Add the column (allows NULL temporarily)
ALTER TABLE tier_definition ADD COLUMN tenant_id INTEGER;

-- Add foreign key constraint
ALTER TABLE tier_definition ADD CONSTRAINT tier_definition_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

\echo '✅ Column added'
\echo ''

-- Assign existing tiers to Delta (tenant_id = 1)
\echo '📝 Assigning existing tiers to tenant_id = 1 (Delta)...'
UPDATE tier_definition SET tenant_id = 1 WHERE tenant_id IS NULL;

\echo '✅ Existing tiers assigned'
\echo ''

-- Make it required going forward
ALTER TABLE tier_definition ALTER COLUMN tenant_id SET NOT NULL;

\echo '✅ Column set to NOT NULL'
\echo ''

-- Add index for filtering by tenant
CREATE INDEX idx_tier_definition_tenant ON tier_definition(tenant_id);

\echo '✅ Index created'
\echo ''

-- Verify the change
\echo '📊 Updated tier_definition table structure:'
\echo ''
\d tier_definition

\echo ''
\echo '📋 Sample tier data with tenant_id:'
\echo ''
SELECT tier_id, tier_code, tier_description, tier_ranking, tenant_id FROM tier_definition ORDER BY tier_ranking DESC;

\echo ''
\echo '✅ SUCCESS! tenant_id added to tier_definition table'
\echo ''
