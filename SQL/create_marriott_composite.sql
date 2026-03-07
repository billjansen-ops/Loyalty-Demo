-- Marriott Hotel Stay Composite Definition
-- Date: 2025-12-29
-- Tenant ID 3 = Marriott

-- First, get the next available composite link
-- Using negative numbers to match existing pattern
DO $$
DECLARE
  v_composite_link SMALLINT;
  v_detail_link SMALLINT;
  v_molecule_id INTEGER;
BEGIN
  -- Get next composite link (more negative than existing)
  SELECT COALESCE(MIN(link), 0) - 1 INTO v_composite_link FROM composite;
  
  -- Insert main composite record for Hotel Stay
  INSERT INTO composite (link, tenant_id, composite_type, description, validate_function)
  VALUES (v_composite_link, 3, 'A', 'Hotel Stay Entry', NULL);
  
  RAISE NOTICE 'Created composite link: %', v_composite_link;
  
  -- Get starting detail link
  SELECT COALESCE(MIN(link), 0) - 1 INTO v_detail_link FROM composite_detail;
  
  -- Add brand molecule (required, not calculated, sort 1)
  SELECT molecule_id INTO v_molecule_id FROM molecule_def WHERE tenant_id = 3 AND molecule_key = 'brand';
  IF v_molecule_id IS NOT NULL THEN
    INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
    VALUES (v_detail_link, v_composite_link, v_molecule_id, true, false, NULL, 1);
    v_detail_link := v_detail_link - 1;
    RAISE NOTICE 'Added brand molecule_id: %', v_molecule_id;
  END IF;
  
  -- Add property molecule (required, not calculated, sort 2)
  SELECT molecule_id INTO v_molecule_id FROM molecule_def WHERE tenant_id = 3 AND molecule_key = 'property';
  IF v_molecule_id IS NOT NULL THEN
    INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
    VALUES (v_detail_link, v_composite_link, v_molecule_id, true, false, NULL, 2);
    v_detail_link := v_detail_link - 1;
    RAISE NOTICE 'Added property molecule_id: %', v_molecule_id;
  END IF;
  
  -- Add nights molecule (required, not calculated, sort 3)
  SELECT molecule_id INTO v_molecule_id FROM molecule_def WHERE tenant_id = 3 AND molecule_key = 'nights';
  IF v_molecule_id IS NOT NULL THEN
    INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
    VALUES (v_detail_link, v_composite_link, v_molecule_id, true, false, NULL, 3);
    v_detail_link := v_detail_link - 1;
    RAISE NOTICE 'Added nights molecule_id: %', v_molecule_id;
  END IF;
  
  -- Add eligible_spend molecule (required, not calculated, sort 4)
  SELECT molecule_id INTO v_molecule_id FROM molecule_def WHERE tenant_id = 3 AND molecule_key = 'eligible_spend';
  IF v_molecule_id IS NOT NULL THEN
    INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
    VALUES (v_detail_link, v_composite_link, v_molecule_id, true, false, NULL, 4);
    v_detail_link := v_detail_link - 1;
    RAISE NOTICE 'Added eligible_spend molecule_id: %', v_molecule_id;
  END IF;
  
  -- Add folio molecule (not required, not calculated, sort 5)
  SELECT molecule_id INTO v_molecule_id FROM molecule_def WHERE tenant_id = 3 AND molecule_key = 'folio';
  IF v_molecule_id IS NOT NULL THEN
    INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
    VALUES (v_detail_link, v_composite_link, v_molecule_id, false, false, NULL, 5);
    v_detail_link := v_detail_link - 1;
    RAISE NOTICE 'Added folio molecule_id: %', v_molecule_id;
  END IF;
  
  -- Add member_points molecule (required, calculated by calculateHotelPoints, sort 100)
  SELECT molecule_id INTO v_molecule_id FROM molecule_def WHERE tenant_id = 3 AND molecule_key = 'member_points';
  IF v_molecule_id IS NOT NULL THEN
    INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
    VALUES (v_detail_link, v_composite_link, v_molecule_id, true, true, 'calculateHotelPoints', 100);
    RAISE NOTICE 'Added member_points molecule_id: % with calculateHotelPoints', v_molecule_id;
  ELSE
    RAISE WARNING 'member_points molecule not found for tenant 3 - may need to clone from tenant 1';
  END IF;
  
END $$;

-- Verify
SELECT c.link, c.tenant_id, c.composite_type, c.description,
       cd.sort_order, m.molecule_key, cd.is_required, cd.is_calculated, cd.calc_function
FROM composite c
JOIN composite_detail cd ON cd.p_link = c.link
JOIN molecule_def m ON m.molecule_id = cd.molecule_id
WHERE c.tenant_id = 3
ORDER BY c.composite_type, cd.sort_order;
