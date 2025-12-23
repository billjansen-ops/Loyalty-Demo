-- =====================================================
-- TIER MANAGEMENT SCHEMA
-- =====================================================
-- Two-table design:
-- 1. tier_definition: What tiers exist (Gold, Silver, etc.)
-- 2. member_tier: History of each member's tier assignments
-- =====================================================

-- TIER DEFINITION TABLE
-- Defines available tiers in the program
-- Can be in public schema (shared) or per-tenant schema
CREATE TABLE IF NOT EXISTS tier_definition (
    tier_id SERIAL PRIMARY KEY,
    tier_code VARCHAR(10) NOT NULL UNIQUE,  -- e.g., 'G', 'S', 'P'
    tier_description VARCHAR(30) NOT NULL,   -- e.g., 'Gold', 'Silver', 'Platinum'
    tier_ranking INTEGER NOT NULL,           -- Higher number = higher tier (5=Platinum, 3=Gold, 1=Basic)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_tier_def_code ON tier_definition(tier_code);
CREATE INDEX IF NOT EXISTS idx_tier_def_ranking ON tier_definition(tier_ranking);

-- MEMBER TIER TABLE
-- Tracks tier history for each member
-- Multiple overlapping periods allowed (for retro-credit scenarios)
CREATE TABLE IF NOT EXISTS member_tier (
    member_tier_id SERIAL PRIMARY KEY,
    member_id VARCHAR(50) NOT NULL,
    tier_id INTEGER NOT NULL REFERENCES tier_definition(tier_id),
    start_date DATE NOT NULL,
    end_date DATE,  -- NULL = current/ongoing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Indexes for queries
CREATE INDEX IF NOT EXISTS idx_member_tier_member ON member_tier(member_id);
CREATE INDEX IF NOT EXISTS idx_member_tier_dates ON member_tier(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_member_tier_member_dates ON member_tier(member_id, start_date, end_date);

-- =====================================================
-- SEED DATA: Default Tier Definitions
-- =====================================================
INSERT INTO tier_definition (tier_code, tier_description, tier_ranking) VALUES
    ('B', 'Basic', 1),
    ('S', 'Silver', 3),
    ('G', 'Gold', 5),
    ('P', 'Platinum', 7)
ON CONFLICT (tier_code) DO NOTHING;

-- =====================================================
-- FUNCTION: Get Member's Tier on Specific Date
-- =====================================================
-- Returns the highest ranking tier for a member on a given date
-- Handles overlapping periods by taking the highest tier
-- Used throughout the system for tier-based logic
CREATE OR REPLACE FUNCTION get_member_tier_on_date(
    p_member_id VARCHAR(50),
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    tier_code VARCHAR(10),
    tier_description VARCHAR(30),
    tier_ranking INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        td.tier_code,
        td.tier_description,
        td.tier_ranking
    FROM member_tier mt
    JOIN tier_definition td ON mt.tier_id = td.tier_id
    WHERE mt.member_id = p_member_id
      AND mt.start_date <= p_date
      AND (mt.end_date IS NULL OR mt.end_date >= p_date)
    ORDER BY td.tier_ranking DESC  -- Highest tier first
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Get Member's Current Tier
-- =====================================================
-- Convenience wrapper for current date
CREATE OR REPLACE FUNCTION get_member_current_tier(
    p_member_id VARCHAR(50)
)
RETURNS TABLE (
    tier_code VARCHAR(10),
    tier_description VARCHAR(30),
    tier_ranking INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_member_tier_on_date(p_member_id, CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA: Test Member Tiers
-- =====================================================
-- Uncomment to insert sample data for testing
/*
-- Member 2153442807: Gold tier with history
INSERT INTO member_tier (member_id, tier_id, start_date, end_date) VALUES
    ('2153442807', (SELECT tier_id FROM tier_definition WHERE tier_code = 'B'), '2023-01-01', '2023-12-31'),
    ('2153442807', (SELECT tier_id FROM tier_definition WHERE tier_code = 'S'), '2024-01-01', '2024-06-30'),
    ('2153442807', (SELECT tier_id FROM tier_definition WHERE tier_code = 'G'), '2024-07-01', NULL);

-- Member 1001: Platinum with overlapping period (retro-credit scenario)
INSERT INTO member_tier (member_id, tier_id, start_date, end_date) VALUES
    ('1001', (SELECT tier_id FROM tier_definition WHERE tier_code = 'S'), '2024-01-01', '2024-12-31'),
    ('1001', (SELECT tier_id FROM tier_definition WHERE tier_code = 'P'), '2024-06-01', NULL);  -- Overlap: both Silver and Platinum from June-Dec
*/

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================
-- Get member's current tier:
-- SELECT * FROM get_member_current_tier('2153442807');

-- Get member's tier on specific date (for retro-credit):
-- SELECT * FROM get_member_tier_on_date('2153442807', '2024-06-15');

-- Get all tier history for a member:
-- SELECT 
--     mt.member_tier_id,
--     mt.member_id,
--     td.tier_code,
--     td.tier_description,
--     td.tier_ranking,
--     mt.start_date,
--     mt.end_date
-- FROM member_tier mt
-- JOIN tier_definition td ON mt.tier_id = td.tier_id
-- WHERE mt.member_id = '2153442807'
-- ORDER BY mt.start_date DESC;
