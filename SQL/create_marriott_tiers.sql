-- Marriott Bonvoy Tier Definitions
-- Date: 2025-12-29
-- Tenant ID 3 = Marriott

-- Marriott Bonvoy Tiers:
-- Member (base) - 0 nights
-- Silver Elite - 10 nights
-- Gold Elite - 25 nights  
-- Platinum Elite - 50 nights
-- Titanium Elite - 75 nights
-- Ambassador Elite - 100 nights + $23K spend

INSERT INTO tier_definition (tier_id, tier_code, tier_description, tier_ranking, is_active, tenant_id, badge_color, text_color, icon)
SELECT COALESCE(MAX(tier_id), 0) + 1, 'M', 'Member', 1, true, 3, '#6b7280', '#ffffff', '👤'
FROM tier_definition;

INSERT INTO tier_definition (tier_id, tier_code, tier_description, tier_ranking, is_active, tenant_id, badge_color, text_color, icon)
SELECT COALESCE(MAX(tier_id), 0) + 1, 'S', 'Silver Elite', 10, true, 3, '#94a3b8', '#ffffff', '🥈'
FROM tier_definition;

INSERT INTO tier_definition (tier_id, tier_code, tier_description, tier_ranking, is_active, tenant_id, badge_color, text_color, icon)
SELECT COALESCE(MAX(tier_id), 0) + 1, 'G', 'Gold Elite', 25, true, 3, '#fbbf24', '#1f2937', '🥇'
FROM tier_definition;

INSERT INTO tier_definition (tier_id, tier_code, tier_description, tier_ranking, is_active, tenant_id, badge_color, text_color, icon)
SELECT COALESCE(MAX(tier_id), 0) + 1, 'P', 'Platinum Elite', 50, true, 3, '#e5e7eb', '#1f2937', '💠'
FROM tier_definition;

INSERT INTO tier_definition (tier_id, tier_code, tier_description, tier_ranking, is_active, tenant_id, badge_color, text_color, icon)
SELECT COALESCE(MAX(tier_id), 0) + 1, 'T', 'Titanium Elite', 75, true, 3, '#374151', '#ffffff', '⚡'
FROM tier_definition;

INSERT INTO tier_definition (tier_id, tier_code, tier_description, tier_ranking, is_active, tenant_id, badge_color, text_color, icon)
SELECT COALESCE(MAX(tier_id), 0) + 1, 'A', 'Ambassador Elite', 100, true, 3, '#7c2d12', '#ffffff', '👑'
FROM tier_definition;

-- Verify
SELECT tier_id, tier_code, tier_description, tier_ranking, badge_color, icon
FROM tier_definition
WHERE tenant_id = 3
ORDER BY tier_ranking;
