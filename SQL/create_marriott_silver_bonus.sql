-- Marriott Silver Elite Tier Bonus
-- Date: 2025-12-29
-- Tenant ID 3 = Marriott

DO $$
DECLARE
  v_silver_tier_id INTEGER;
BEGIN
  -- Get Silver Elite tier_id
  SELECT tier_id INTO v_silver_tier_id 
  FROM tier_definition 
  WHERE tenant_id = 3 AND tier_code = 'S';
  
  IF v_silver_tier_id IS NULL THEN
    RAISE EXCEPTION 'Silver Elite tier not found for tenant 3';
  END IF;
  
  -- Insert the bonus
  INSERT INTO bonus (
    tenant_id,
    bonus_code,
    bonus_description,
    start_date,
    end_date,
    is_active,
    bonus_type,
    bonus_amount,
    required_tier_id
  ) VALUES (
    3,                          -- tenant_id
    'SILVER10',                 -- bonus_code
    'Silver Elite 10% Bonus',   -- bonus_description
    '2025-01-01',               -- start_date
    NULL,                       -- end_date (ongoing)
    true,                       -- is_active
    'percent',                  -- bonus_type
    10,                         -- bonus_amount (10%)
    v_silver_tier_id            -- required_tier_id
  );
  
  RAISE NOTICE 'Created Silver Elite bonus with tier_id: %', v_silver_tier_id;
END $$;

-- Verify
SELECT b.bonus_code, b.bonus_description, b.bonus_type, b.bonus_amount,
       t.tier_description as required_tier
FROM bonus b
LEFT JOIN tier_definition t ON t.tier_id = b.required_tier_id
WHERE b.tenant_id = 3;
