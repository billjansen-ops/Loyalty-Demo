-- Marriott Silver Elite 2025 Tier Promotion
-- Date: 2025-12-29
-- Tenant ID 3 = Marriott

-- This promotion:
-- - Counts nights molecule
-- - Goal: 10 nights
-- - Rewards: Silver Elite tier
-- - Tier expires: 2026-12-31

DO $$
DECLARE
  v_nights_molecule_id INTEGER;
  v_silver_tier_id INTEGER;
BEGIN
  -- Get nights molecule_id for Marriott
  SELECT molecule_id INTO v_nights_molecule_id 
  FROM molecule_def 
  WHERE tenant_id = 3 AND molecule_key = 'nights';
  
  IF v_nights_molecule_id IS NULL THEN
    RAISE EXCEPTION 'nights molecule not found for tenant 3';
  END IF;
  
  -- Get Silver Elite tier_id for Marriott
  SELECT tier_id INTO v_silver_tier_id 
  FROM tier_definition 
  WHERE tenant_id = 3 AND tier_code = 'S';
  
  IF v_silver_tier_id IS NULL THEN
    RAISE EXCEPTION 'Silver Elite tier not found for tenant 3';
  END IF;
  
  -- Insert the promotion
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
    count_type,
    counter_molecule_id,
    goal_amount,
    reward_type,
    reward_tier_id,
    duration_type,
    duration_end_date
  ) VALUES (
    3,                          -- tenant_id
    'SILVER25',                 -- promotion_code
    'Silver Elite 2025',        -- promotion_name
    'Earn Silver Elite status with 10 qualifying nights in 2025',
    '2025-01-01',               -- start_date
    '2025-12-31',               -- end_date
    true,                       -- is_active
    'A',                        -- enrollment_type (A=automatic)
    false,                      -- allow_member_enrollment
    'molecules',                -- count_type
    v_nights_molecule_id,       -- counter_molecule_id
    10,                         -- goal_amount (10 nights)
    'tier',                     -- reward_type
    v_silver_tier_id,           -- reward_tier_id
    'calendar',                 -- duration_type
    '2026-12-31'                -- duration_end_date
  );
  
  RAISE NOTICE 'Created Silver Elite 2025 promotion with nights molecule_id: %, tier_id: %', v_nights_molecule_id, v_silver_tier_id;
END $$;

-- Verify
SELECT promotion_id, promotion_code, promotion_name, goal_amount, reward_type, duration_end_date
FROM promotion
WHERE tenant_id = 3;
