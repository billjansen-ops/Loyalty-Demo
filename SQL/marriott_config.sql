-- Configure Marriott (tenant_id=3) labels
-- This sets the activity type to "Stay" (hotels) instead of "Flight" (airlines)

-- First check if sysparm exists for activity_type_label
DO $$
DECLARE
  v_sysparm_id INT;
BEGIN
  -- Check if activity_type_label sysparm exists for Marriott
  SELECT sysparm_id INTO v_sysparm_id
  FROM sysparm 
  WHERE tenant_id = 3 AND sysparm_key = 'activity_type_label';
  
  IF v_sysparm_id IS NULL THEN
    -- Create sysparm and detail
    INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
    VALUES (3, 'activity_type_label', 'text', 'Label for primary activity type')
    RETURNING sysparm_id INTO v_sysparm_id;
    
    INSERT INTO sysparm_detail (sysparm_id, category, code, value)
    VALUES (v_sysparm_id, 'default', 'default', 'Stay');
    
    RAISE NOTICE 'Created activity_type_label sysparm for Marriott with value "Stay"';
  ELSE
    -- Update existing detail
    UPDATE sysparm_detail 
    SET value = 'Stay'
    WHERE sysparm_id = v_sysparm_id AND category = 'default' AND code = 'default';
    
    IF NOT FOUND THEN
      INSERT INTO sysparm_detail (sysparm_id, category, code, value)
      VALUES (v_sysparm_id, 'default', 'default', 'Stay');
    END IF;
    
    RAISE NOTICE 'Updated activity_type_label for Marriott to "Stay"';
  END IF;
END $$;

-- Also ensure currency_label is set for Marriott (Points, not Miles)
DO $$
DECLARE
  v_sysparm_id INT;
BEGIN
  SELECT sysparm_id INTO v_sysparm_id
  FROM sysparm 
  WHERE tenant_id = 3 AND sysparm_key = 'currency_label';
  
  IF v_sysparm_id IS NULL THEN
    INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
    VALUES (3, 'currency_label', 'text', 'Label for loyalty currency')
    RETURNING sysparm_id INTO v_sysparm_id;
    
    INSERT INTO sysparm_detail (sysparm_id, category, code, value)
    VALUES (v_sysparm_id, 'default', 'default', 'Points');
    
    RAISE NOTICE 'Created currency_label sysparm for Marriott with value "Points"';
  END IF;
END $$;

-- Configure brand molecule for Marriott if not exists
DO $$
DECLARE
  v_molecule_id INT;
BEGIN
  SELECT molecule_id INTO v_molecule_id
  FROM molecule_def 
  WHERE tenant_id = 3 AND molecule_key = 'brand';
  
  IF v_molecule_id IS NULL THEN
    INSERT INTO molecule_def (tenant_id, molecule_key, label, value_kind, scalar_type, source, is_active)
    VALUES (3, 'brand', 'Brand', 'lookup', 'string', 'Activity', true)
    RETURNING molecule_id INTO v_molecule_id;
    
    -- Configure lookup to brand table
    INSERT INTO molecule_value_lookup (molecule_id, tenant_id, table_name, id_column, code_column, label_column)
    VALUES (v_molecule_id, 3, 'brand', 'brand_id', 'code', 'name');
    
    RAISE NOTICE 'Created brand molecule for Marriott (molecule_id=%)', v_molecule_id;
  ELSE
    RAISE NOTICE 'Brand molecule already exists for Marriott (molecule_id=%)', v_molecule_id;
  END IF;
END $$;

-- Configure property molecule for Marriott if not exists
DO $$
DECLARE
  v_molecule_id INT;
BEGIN
  SELECT molecule_id INTO v_molecule_id
  FROM molecule_def 
  WHERE tenant_id = 3 AND molecule_key = 'property';
  
  IF v_molecule_id IS NULL THEN
    INSERT INTO molecule_def (tenant_id, molecule_key, label, value_kind, scalar_type, source, is_active)
    VALUES (3, 'property', 'Property', 'lookup', 'string', 'Activity', true)
    RETURNING molecule_id INTO v_molecule_id;
    
    -- Configure lookup to property table
    INSERT INTO molecule_value_lookup (molecule_id, tenant_id, table_name, id_column, code_column, label_column)
    VALUES (v_molecule_id, 3, 'property', 'property_id', 'code', 'name');
    
    RAISE NOTICE 'Created property molecule for Marriott (molecule_id=%)', v_molecule_id;
  ELSE
    RAISE NOTICE 'Property molecule already exists for Marriott (molecule_id=%)', v_molecule_id;
  END IF;
END $$;

-- Verify the configuration
SELECT 'Sysparm Labels' as config_type, s.tenant_id, s.sysparm_key as key, sd.value
FROM sysparm s
JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
WHERE s.tenant_id = 3 
  AND s.sysparm_key IN ('activity_type_label', 'currency_label')
UNION ALL
SELECT 'Molecule Defs' as config_type, tenant_id, molecule_key as key, value_kind as value
FROM molecule_def
WHERE tenant_id = 3 AND molecule_key IN ('brand', 'property')
ORDER BY 1, 3;
