-- ============================================================
-- ADD tenant_id TO bonus TABLE
-- Run: psql -h 127.0.0.1 -U billjansen -d loyalty -f add_tenant_to_bonus.sql
-- ============================================================

\echo ''
\echo '📋 Adding tenant_id to bonus table...'
\echo ''

-- Add the column (allows NULL temporarily)
ALTER TABLE bonus ADD COLUMN tenant_id INTEGER;

-- Add foreign key constraint
ALTER TABLE bonus ADD CONSTRAINT bonus_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

\echo '✅ Column added'
\echo ''

-- Assign existing bonuses to Delta (tenant_id = 1)
\echo '📝 Assigning existing bonuses to tenant_id = 1 (Delta)...'
UPDATE bonus SET tenant_id = 1 WHERE tenant_id IS NULL;

\echo '✅ Existing bonuses assigned'
\echo ''

-- Make it required going forward
ALTER TABLE bonus ALTER COLUMN tenant_id SET NOT NULL;

\echo '✅ Column set to NOT NULL'
\echo ''

-- Add index for filtering by tenant
CREATE INDEX idx_bonus_tenant ON bonus(tenant_id);

\echo '✅ Index created'
\echo ''

-- Verify the change
\echo '📊 Updated bonus table structure:'
\echo ''
\d bonus

\echo ''
\echo '✅ SUCCESS! tenant_id added to bonus table'
\echo ''
