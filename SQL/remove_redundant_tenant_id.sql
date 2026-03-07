-- Remove redundant tenant_id from child tables
-- These tables inherit tenant context from their parent via foreign key
-- Run: psql -U postgres -d loyalty -f sql/remove_redundant_tenant_id.sql

-- ============================================================================
-- bonus_stats: tenant_id derives from bonus_id → bonus.tenant_id
-- ============================================================================
ALTER TABLE bonus_stats DROP CONSTRAINT IF EXISTS bonus_stats_bonus_id_tenant_id_stat_date_key;
ALTER TABLE bonus_stats DROP CONSTRAINT IF EXISTS bonus_stats_pkey;
ALTER TABLE bonus_stats DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE bonus_stats ADD CONSTRAINT bonus_stats_pkey PRIMARY KEY (bonus_id, stat_date);

-- ============================================================================
-- promotion_stats: tenant_id derives from promotion_id → promotion.tenant_id
-- ============================================================================
ALTER TABLE promotion_stats DROP CONSTRAINT IF EXISTS promotion_stats_promotion_id_tenant_id_stat_date_key;
ALTER TABLE promotion_stats DROP CONSTRAINT IF EXISTS promotion_stats_pkey;
ALTER TABLE promotion_stats DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE promotion_stats ADD CONSTRAINT promotion_stats_pkey PRIMARY KEY (promotion_id, stat_date);

-- ============================================================================
-- redemption_stats: tenant_id derives from redemption_id → redemption_rule.tenant_id
-- ============================================================================
ALTER TABLE redemption_stats DROP CONSTRAINT IF EXISTS redemption_stats_redemption_id_tenant_id_stat_date_key;
ALTER TABLE redemption_stats DROP CONSTRAINT IF EXISTS redemption_stats_pkey;
ALTER TABLE redemption_stats DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE redemption_stats ADD CONSTRAINT redemption_stats_pkey PRIMARY KEY (redemption_id, stat_date);

-- ============================================================================
-- partner_program: tenant_id derives from partner_id → partner.tenant_id
-- ============================================================================
ALTER TABLE partner_program DROP COLUMN IF EXISTS tenant_id;

-- Done
SELECT 'Schema update complete - redundant tenant_id columns removed' as status;
