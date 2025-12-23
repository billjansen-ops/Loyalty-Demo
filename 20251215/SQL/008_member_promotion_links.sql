-- Migration 008: Add link/p_link to member_promotion and member_promotion_detail
-- Date: 2025-12-04
-- Purpose: Replace BIGINT FKs with link/p_link architecture
-- 
-- USAGE:
--   1. Run this SQL: psql -d loyalty -f 008_member_promotion_links.sql
--   2. Run backfill: node backfill_member_promotion_link.js

-- ============================================
-- MEMBER_PROMOTION
-- ============================================
-- Step 1a: Add link (PK) and p_link (→ member.link)
ALTER TABLE member_promotion ADD COLUMN link CHARACTER(5);
ALTER TABLE member_promotion ADD COLUMN p_link CHARACTER(5);

-- Step 1b: Add indexes
CREATE INDEX idx_member_promotion_link ON member_promotion(link);
CREATE INDEX idx_member_promotion_plink ON member_promotion(p_link);

-- ============================================
-- MEMBER_PROMOTION_DETAIL
-- ============================================
-- Step 2a: Add p_link (→ member_promotion.link) and activity_link (→ activity.link)
ALTER TABLE member_promotion_detail ADD COLUMN p_link CHARACTER(5);
ALTER TABLE member_promotion_detail ADD COLUMN activity_link CHARACTER(5);

-- Step 2b: Add indexes
CREATE INDEX idx_member_promotion_detail_plink ON member_promotion_detail(p_link);
CREATE INDEX idx_member_promotion_detail_activity_link ON member_promotion_detail(activity_link);

-- NOTE: Run backfill_member_promotion_link.js to populate all link columns
-- NOTE: Do NOT drop old columns until code is updated
