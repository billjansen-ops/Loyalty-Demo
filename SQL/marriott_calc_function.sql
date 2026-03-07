-- Configure Marriott (tenant_id=3) to use calculateHotelPoints for activity type A
-- This is similar to how Delta uses calculateFlightMiles

-- First check current config
SELECT s.tenant_id, s.sysparm_key, sd.category, sd.code, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.tenant_id = 3 AND s.sysparm_key IN ('points_mode', 'calc_function')
ORDER BY s.sysparm_key, sd.category;

-- Add points_mode = 'calculated' for activity type 'A'
DO $$
DECLARE
  v_sysparm_id INT;
BEGIN
  SELECT sysparm_id INTO v_sysparm_id
  FROM sysparm 
  WHERE tenant_id = 3 AND sysparm_key = 'points_mode';
  
  IF v_sysparm_id IS NULL THEN
    INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
    VALUES (3, 'points_mode', 'text', 'How points are determined: manual or calculated')
    RETURNING sysparm_id INTO v_sysparm_id;
  END IF;
  
  -- Delete any existing 'A' entry and add new one
  DELETE FROM sysparm_detail WHERE sysparm_id = v_sysparm_id AND category = 'activity_processing' AND code = 'A';
  INSERT INTO sysparm_detail (sysparm_id, category, code, value)
  VALUES (v_sysparm_id, 'activity_processing', 'A', 'calculated');
  
  RAISE NOTICE 'Set points_mode = calculated for Marriott activity type A';
END $$;

-- Add calc_function = 'calculateHotelPoints' for activity type 'A'
DO $$
DECLARE
  v_sysparm_id INT;
BEGIN
  SELECT sysparm_id INTO v_sysparm_id
  FROM sysparm 
  WHERE tenant_id = 3 AND sysparm_key = 'calc_function';
  
  IF v_sysparm_id IS NULL THEN
    INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
    VALUES (3, 'calc_function', 'text', 'Function name to calculate points')
    RETURNING sysparm_id INTO v_sysparm_id;
  END IF;
  
  -- Delete any existing 'A' entry and add new one
  DELETE FROM sysparm_detail WHERE sysparm_id = v_sysparm_id AND category = 'activity_processing' AND code = 'A';
  INSERT INTO sysparm_detail (sysparm_id, category, code, value)
  VALUES (v_sysparm_id, 'activity_processing', 'A', 'calculateHotelPoints');
  
  RAISE NOTICE 'Set calc_function = calculateHotelPoints for Marriott activity type A';
END $$;

-- Verify
SELECT s.tenant_id, s.sysparm_key, sd.category, sd.code, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.tenant_id = 3 AND s.sysparm_key IN ('points_mode', 'calc_function')
ORDER BY s.sysparm_key, sd.category;
