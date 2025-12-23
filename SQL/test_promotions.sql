-- ============================================================================
-- TEST PROMOTIONS FOR INITIAL TESTING
-- ============================================================================

-- Test Promotion 1: Simple "Fly 3, Get 5K Miles"
INSERT INTO promotion (
    tenant_id,
    promotion_code,
    promotion_name,
    promotion_description,
    start_date,
    end_date,
    is_active,
    enrollment_type,
    allow_member_enrollment,
    rule_id,
    count_type,
    goal_amount,
    reward_type,
    reward_amount,
    reward_tier_id,
    reward_promotion_id,
    process_limit_count,
    duration_type,
    duration_end_date,
    duration_days
) VALUES (
    1, -- tenant_id
    'FLY3-5K',
    'Fly 3 Flights, Get 5,000 Miles',
    'Take 3 qualifying flights and receive a bonus of 5,000 miles',
    '2025-01-01',
    '2025-12-31',
    true,
    'A', -- Auto-enroll
    false,
    NULL, -- No criteria - all flights qualify
    'flights', -- Count activities
    3, -- Goal: 3 flights
    'points', -- Reward: miles/points
    5000, -- 5,000 miles
    NULL,
    NULL,
    NULL, -- Unlimited repeats
    NULL,
    NULL,
    NULL
);

-- Test Promotion 2: "Earn 20K Miles for Silver Tier"
INSERT INTO promotion (
    tenant_id,
    promotion_code,
    promotion_name,
    promotion_description,
    start_date,
    end_date,
    is_active,
    enrollment_type,
    allow_member_enrollment,
    rule_id,
    count_type,
    goal_amount,
    reward_type,
    reward_amount,
    reward_tier_id,
    reward_promotion_id,
    process_limit_count,
    duration_type,
    duration_end_date,
    duration_days
) VALUES (
    1,
    'SILVER-20K',
    'Silver Tier - 20K Miles',
    'Earn 20,000 miles to achieve Silver tier status',
    '2025-01-01',
    '2025-12-31',
    true,
    'A', -- Auto-enroll
    false,
    NULL,
    'miles', -- Count miles
    20000,
    'tier', -- Reward: tier
    NULL,
    2, -- Silver tier (tier_id=2)
    NULL,
    1, -- Single completion
    'calendar',
    '2025-12-31', -- Valid through end of year
    NULL
);

-- Test Promotion 3: "Restricted VIP - Fly 1 Get Diamond"
INSERT INTO promotion (
    tenant_id,
    promotion_code,
    promotion_name,
    promotion_description,
    start_date,
    end_date,
    is_active,
    enrollment_type,
    allow_member_enrollment,
    rule_id,
    count_type,
    goal_amount,
    reward_type,
    reward_amount,
    reward_tier_id,
    reward_promotion_id,
    process_limit_count,
    duration_type,
    duration_end_date,
    duration_days
) VALUES (
    1,
    'VIP-DIAMOND',
    'VIP Diamond Winback',
    'Exclusive offer: Take one flight to reclaim Diamond status',
    '2025-11-01',
    '2025-12-31',
    true,
    'R', -- Restricted
    false,
    NULL,
    'flights',
    1,
    'tier',
    NULL,
    4, -- Diamond tier (tier_id=4)
    NULL,
    1,
    'calendar',
    '2026-01-31', -- Valid for 2 months
    NULL
);

-- Verification queries
SELECT 
    promotion_id,
    promotion_code,
    promotion_name,
    count_type,
    goal_amount,
    reward_type,
    reward_amount,
    reward_tier_id,
    enrollment_type
FROM promotion
ORDER BY promotion_id;

SELECT 
    promotion_id,
    promotion_code,
    CASE 
        WHEN reward_type = 'points' THEN CONCAT('Earn ', goal_amount, ' ', count_type, ' → Get ', reward_amount, ' miles')
        WHEN reward_type = 'tier' THEN CONCAT('Earn ', goal_amount, ' ', count_type, ' → Tier ', reward_tier_id)
        ELSE CONCAT('Earn ', goal_amount, ' ', count_type, ' → ', reward_type)
    END as description
FROM promotion
ORDER BY promotion_id;
