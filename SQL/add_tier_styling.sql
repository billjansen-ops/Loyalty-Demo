-- Add styling columns to tier_definition
-- Run this against your database to add tier badge styling support

ALTER TABLE tier_definition
ADD COLUMN IF NOT EXISTS badge_color VARCHAR(7) DEFAULT '#6b7280',
ADD COLUMN IF NOT EXISTS text_color VARCHAR(7) DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN tier_definition.badge_color IS 'Hex color for tier badge background (e.g., #FFD700 for Gold)';
COMMENT ON COLUMN tier_definition.text_color IS 'Hex color for text on badge (e.g., #ffffff for white)';
COMMENT ON COLUMN tier_definition.icon IS 'Optional emoji or short icon text for tier (e.g., 💎)';

-- Update Delta tiers with sample colors
UPDATE tier_definition SET badge_color = '#9ca3af', text_color = '#ffffff', icon = NULL WHERE tier_code = 'B' AND tenant_id = 1;
UPDATE tier_definition SET badge_color = '#94a3b8', text_color = '#ffffff', icon = '🥈' WHERE tier_code = 'S' AND tenant_id = 1;
UPDATE tier_definition SET badge_color = '#fbbf24', text_color = '#1f2937', icon = '🥇' WHERE tier_code = 'G' AND tenant_id = 1;
UPDATE tier_definition SET badge_color = '#a1a1aa', text_color = '#1f2937', icon = '💠' WHERE tier_code = 'P' AND tenant_id = 1;
UPDATE tier_definition SET badge_color = '#0ea5e9', text_color = '#ffffff', icon = '💎' WHERE tier_code = 'D' AND tenant_id = 1;
