-- Fix Marriott (tenant_id=3) activity processing settings to match Delta's format
-- Delta format: sysparm_key='activity_processing', category='A', code='calc_function'/'points_mode'

-- First, delete the incorrectly formatted entries we created
DELETE FROM sysparm_detail sd
USING sysparm s
WHERE sd.sysparm_id = s.sysparm_id
  AND s.tenant_id = 3
  AND s.sysparm_key IN ('calc_function', 'points_mode');

DELETE FROM sysparm
WHERE tenant_id = 3
  AND sysparm_key IN ('calc_function', 'points_mode');

-- Now create in the correct format (matching Delta)
-- First ensure activity_processing sysparm exists for tenant 3
DO $$
DECLARE
  v_sysparm_id INT;
BEGIN
  SELECT sysparm_id INTO v_sysparm_id
  FROM sysparm 
  WHERE tenant_id = 3 AND sysparm_key = 'activity_processing';
  
  IF v_sysparm_id IS NULL THEN
    INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
    VALUES (3, 'activity_processing', 'text', 'Activity type processing settings')
    RETURNING sysparm_id INTO v_sysparm_id;
    RAISE NOTICE 'Created activity_processing sysparm for Marriott (id=%)', v_sysparm_id;
  ELSE
    RAISE NOTICE 'activity_processing sysparm already exists for Marriott (id=%)', v_sysparm_id;
  END IF;
  
  -- Add calc_function for activity type A
  DELETE FROM sysparm_detail WHERE sysparm_id = v_sysparm_id AND category = 'A' AND code = 'calc_function';
  INSERT INTO sysparm_detail (sysparm_id, category, code, value)
  VALUES (v_sysparm_id, 'A', 'calc_function', 'calculateHotelPoints');
  RAISE NOTICE 'Added calc_function=calculateHotelPoints for activity type A';
  
  -- Add points_mode for activity type A
  DELETE FROM sysparm_detail WHERE sysparm_id = v_sysparm_id AND category = 'A' AND code = 'points_mode';
  INSERT INTO sysparm_detail (sysparm_id, category, code, value)
  VALUES (v_sysparm_id, 'A', 'points_mode', 'calculated');
  RAISE NOTICE 'Added points_mode=calculated for activity type A';
END $$;

-- Verify - show both Delta and Marriott settings
SELECT s.tenant_id, s.sysparm_key, sd.category, sd.code, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.sysparm_key = 'activity_processing'
  AND sd.category = 'A'
ORDER BY s.tenant_id, sd.code;
