-- Marriott Tier Promotions (remaining 9)
-- Date: 2025-12-29
-- Tenant ID 3 = Marriott

DO $$
DECLARE
  v_nights_molecule_id INTEGER;
  v_gold_tier_id INTEGER;
  v_platinum_tier_id INTEGER;
  v_titanium_tier_id INTEGER;
  v_ambassador_tier_id INTEGER;
  v_silver_tier_id INTEGER;
BEGIN
  -- Get nights molecule_id for Marriott
  SELECT molecule_id INTO v_nights_molecule_id 
  FROM molecule_def 
  WHERE tenant_id = 3 AND molecule_key = 'nights';
  
  IF v_nights_molecule_id IS NULL THEN
    RAISE EXCEPTION 'nights molecule not found for tenant 3';
  END IF;
  
  -- Get tier IDs
  SELECT tier_id INTO v_silver_tier_id FROM tier_definition WHERE tenant_id = 3 AND tier_code = 'S';
  SELECT tier_id INTO v_gold_tier_id FROM tier_definition WHERE tenant_id = 3 AND tier_code = 'G';
  SELECT tier_id INTO v_platinum_tier_id FROM tier_definition WHERE tenant_id = 3 AND tier_code = 'P';
  SELECT tier_id INTO v_titanium_tier_id FROM tier_definition WHERE tenant_id = 3 AND tier_code = 'T';
  SELECT tier_id INTO v_ambassador_tier_id FROM tier_definition WHERE tenant_id = 3 AND tier_code = 'A';
  
  -- =====================================================
  -- 2025 PROGRAM (expires 12/31/2026)
  -- =====================================================
  
  -- Gold Elite 2025 - 25 nights
  INSERT INTO promotion (
    tenant_id, promotion_code, promotion_name, promotion_description,
    start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
    count_type, counter_molecule_id, goal_amount,
    reward_type, reward_tier_id, duration_type, duration_end_date
  ) VALUES (
    3, 'GOLD25', 'Gold Elite 2025', 'Earn Gold Elite status with 25 qualifying nights in 2025',
    '2025-01-01', '2025-12-31', true, 'A', false,
    'molecules', v_nights_molecule_id, 25,
    'tier', v_gold_tier_id, 'calendar', '2026-12-31'
  );
  
  -- Platinum Elite 2025 - 50 nights
  INSERT INTO promotion (
    tenant_id, promotion_code, promotion_name, promotion_description,
    start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
    count_type, counter_molecule_id, goal_amount,
    reward_type, reward_tier_id, duration_type, duration_end_date
  ) VALUES (
    3, 'PLAT25', 'Platinum Elite 2025', 'Earn Platinum Elite status with 50 qualifying nights in 2025',
    '2025-01-01', '2025-12-31', true, 'A', false,
    'molecules', v_nights_molecule_id, 50,
    'tier', v_platinum_tier_id, 'calendar', '2026-12-31'
  );
  
  -- Titanium Elite 2025 - 75 nights
  INSERT INTO promotion (
    tenant_id, promotion_code, promotion_name, promotion_description,
    start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
    count_type, counter_molecule_id, goal_amount,
    reward_type, reward_tier_id, duration_type, duration_end_date
  ) VALUES (
    3, 'TITAN25', 'Titanium Elite 2025', 'Earn Titanium Elite status with 75 qualifying nights in 2025',
    '2025-01-01', '2025-12-31', true, 'A', false,
    'molecules', v_nights_molecule_id, 75,
    'tier', v_titanium_tier_id, 'calendar', '2026-12-31'
  );
  
  -- Ambassador Elite 2025 - 100 nights
  INSERT INTO promotion (
    tenant_id, promotion_code, promotion_name, promotion_description,
    start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
    count_type, counter_molecule_id, goal_amount,
    reward_type, reward_tier_id, duration_type, duration_end_date
  ) VALUES (
    3, 'AMBAS25', 'Ambassador Elite 2025', 'Earn Ambassador Elite status with 100 qualifying nights in 2025',
    '2025-01-01', '2025-12-31', true, 'A', false,
    'molecules', v_nights_molecule_id, 100,
    'tier', v_ambassador_tier_id, 'calendar', '2026-12-31'
  );
  
  -- =====================================================
  -- 2026 PROGRAM (expires 12/31/2027)
  -- =====================================================
  
  -- Silver Elite 2026 - 10 nights
  INSERT INTO promotion (
    tenant_id, promotion_code, promotion_name, promotion_description,
    start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
    count_type, counter_molecule_id, goal_amount,
    reward_type, reward_tier_id, duration_type, duration_end_date
  ) VALUES (
    3, 'SILVER26', 'Silver Elite 2026', 'Earn Silver Elite status with 10 qualifying nights in 2026',
    '2026-01-01', '2026-12-31', true, 'A', false,
    'molecules', v_nights_molecule_id, 10,
    'tier', v_silver_tier_id, 'calendar', '2027-12-31'
  );
  
  -- Gold Elite 2026 - 25 nights
  INSERT INTO promotion (
    tenant_id, promotion_code, promotion_name, promotion_description,
    start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
    count_type, counter_molecule_id, goal_amount,
    reward_type, reward_tier_id, duration_type, duration_end_date
  ) VALUES (
    3, 'GOLD26', 'Gold Elite 2026', 'Earn Gold Elite status with 25 qualifying nights in 2026',
    '2026-01-01', '2026-12-31', true, 'A', false,
    'molecules', v_nights_molecule_id, 25,
    'tier', v_gold_tier_id, 'calendar', '2027-12-31'
  );
  
  -- Platinum Elite 2026 - 50 nights
  INSERT INTO promotion (
    tenant_id, promotion_code, promotion_name, promotion_description,
    start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
    count_type, counter_molecule_id, goal_amount,
    reward_type, reward_tier_id, duration_type, duration_end_date
  ) VALUES (
    3, 'PLAT26', 'Platinum Elite 2026', 'Earn Platinum Elite status with 50 qualifying nights in 2026',
    '2026-01-01', '2026-12-31', true, 'A', false,
    'molecules', v_nights_molecule_id, 50,
    'tier', v_platinum_tier_id, 'calendar', '2027-12-31'
  );
  
  -- Titanium Elite 2026 - 75 nights
  INSERT INTO promotion (
    tenant_id, promotion_code, promotion_name, promotion_description,
    start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
    count_type, counter_molecule_id, goal_amount,
    reward_type, reward_tier_id, duration_type, duration_end_date
  ) VALUES (
    3, 'TITAN26', 'Titanium Elite 2026', 'Earn Titanium Elite status with 75 qualifying nights in 2026',
    '2026-01-01', '2026-12-31', true, 'A', false,
    'molecules', v_nights_molecule_id, 75,
    'tier', v_titanium_tier_id, 'calendar', '2027-12-31'
  );
  
  -- Ambassador Elite 2026 - 100 nights
  INSERT INTO promotion (
    tenant_id, promotion_code, promotion_name, promotion_description,
    start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
    count_type, counter_molecule_id, goal_amount,
    reward_type, reward_tier_id, duration_type, duration_end_date
  ) VALUES (
    3, 'AMBAS26', 'Ambassador Elite 2026', 'Earn Ambassador Elite status with 100 qualifying nights in 2026',
    '2026-01-01', '2026-12-31', true, 'A', false,
    'molecules', v_nights_molecule_id, 100,
    'tier', v_ambassador_tier_id, 'calendar', '2027-12-31'
  );
  
  RAISE NOTICE 'Created 9 tier promotions for Marriott';
END $$;

-- Verify
SELECT promotion_code, promotion_name, goal_amount, 
       (SELECT tier_description FROM tier_definition WHERE tier_id = reward_tier_id) as reward_tier,
       duration_end_date
FROM promotion
WHERE tenant_id = 3
ORDER BY end_date, goal_amount;
