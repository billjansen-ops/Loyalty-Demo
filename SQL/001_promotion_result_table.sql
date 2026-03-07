-- ============================================================================
-- PROMOTION RESULT TABLE - Schema Change
-- ============================================================================
-- Creates promotion_result table for 0-n results per promotion
-- Migrates existing reward data from promotion table columns
-- ============================================================================

-- Step 1: Create the promotion_result table
CREATE TABLE IF NOT EXISTS promotion_result (
    promotion_result_id SERIAL PRIMARY KEY,
    promotion_id INTEGER NOT NULL REFERENCES promotion(promotion_id) ON DELETE CASCADE,
    tenant_id SMALLINT NOT NULL,
    result_type VARCHAR(20) NOT NULL CHECK (result_type IN ('points', 'tier', 'external', 'enroll', 'token', 'badge')),
    result_amount INTEGER,           -- points amount, or quantity for tokens/external
    result_reference_id INTEGER,     -- tier_id, promotion_id, or adjustment_id depending on type
    result_description VARCHAR(200), -- for external rewards
    duration_type VARCHAR(10) CHECK (duration_type IS NULL OR duration_type IN ('calendar', 'virtual')),
    duration_end_date DATE,          -- for tier with calendar duration
    duration_days INTEGER,           -- for tier with virtual duration
    sort_order SMALLINT DEFAULT 0,
    CONSTRAINT valid_result_duration CHECK (
        (duration_type = 'calendar' AND duration_end_date IS NOT NULL AND duration_days IS NULL) OR
        (duration_type = 'virtual' AND duration_days IS NOT NULL AND duration_end_date IS NULL) OR
        (duration_type IS NULL AND duration_end_date IS NULL AND duration_days IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_promotion_result_promotion ON promotion_result(promotion_id);

COMMENT ON TABLE promotion_result IS 'Results (rewards) awarded when a promotion qualifies - supports 0-n results per promotion';
COMMENT ON COLUMN promotion_result.result_type IS 'points, tier, external, enroll, token, badge';
COMMENT ON COLUMN promotion_result.result_amount IS 'Point amount for points type; quantity for tokens/external';
COMMENT ON COLUMN promotion_result.result_reference_id IS 'tier_id for tier, promotion_id for enroll, adjustment_id for token, badge_id for badge';
COMMENT ON COLUMN promotion_result.result_description IS 'Description for external rewards (e.g., Free Upgrade Coupon)';

-- Step 2: Migrate existing data from promotion table
-- Points rewards
INSERT INTO promotion_result (promotion_id, tenant_id, result_type, result_amount, sort_order)
SELECT promotion_id, tenant_id, 'points', reward_amount::INTEGER, 0
FROM promotion
WHERE reward_type = 'points' AND reward_amount IS NOT NULL;

-- Tier rewards
INSERT INTO promotion_result (promotion_id, tenant_id, result_type, result_reference_id, duration_type, duration_end_date, duration_days, sort_order)
SELECT promotion_id, tenant_id, 'tier', reward_tier_id, duration_type, duration_end_date, duration_days, 0
FROM promotion
WHERE reward_type = 'tier' AND reward_tier_id IS NOT NULL;

-- Enroll promotion rewards
INSERT INTO promotion_result (promotion_id, tenant_id, result_type, result_reference_id, sort_order)
SELECT promotion_id, tenant_id, 'enroll', reward_promotion_id, 0
FROM promotion
WHERE reward_type = 'enroll_promotion' AND reward_promotion_id IS NOT NULL;

-- External rewards (text description)
-- Note: Current schema doesn't have external reward text stored, so nothing to migrate
-- INSERT INTO promotion_result (promotion_id, tenant_id, result_type, result_description, sort_order)
-- SELECT promotion_id, tenant_id, 'external', external_reward_text, 0
-- FROM promotion
-- WHERE reward_type = 'external';

-- Step 3: Verify migration
SELECT 'Promotions with rewards:' as status, COUNT(DISTINCT promotion_id) as count FROM promotion WHERE reward_type IS NOT NULL;
SELECT 'Migrated results:' as status, COUNT(*) as count FROM promotion_result;
SELECT result_type, COUNT(*) as count FROM promotion_result GROUP BY result_type ORDER BY result_type;

-- ============================================================================
-- DO NOT RUN YET - Phase 2: Drop old columns (after server code updated)
-- ============================================================================
-- ALTER TABLE promotion DROP CONSTRAINT promotion_check;
-- ALTER TABLE promotion DROP CONSTRAINT promotion_reward_type_check;
-- ALTER TABLE promotion DROP CONSTRAINT valid_enroll_promotion_reward;
-- ALTER TABLE promotion DROP CONSTRAINT valid_tier_reward;
-- ALTER TABLE promotion DROP COLUMN reward_type;
-- ALTER TABLE promotion DROP COLUMN reward_amount;
-- ALTER TABLE promotion DROP COLUMN reward_tier_id;
-- ALTER TABLE promotion DROP COLUMN reward_promotion_id;
-- Note: Keep duration_type, duration_end_date, duration_days on promotion table 
-- as fallback, or move entirely to promotion_result
-- ============================================================================
