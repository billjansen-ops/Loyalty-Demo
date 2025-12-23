-- Create Member Input Template
-- Template for member profile molecules (shown on profile.html)
-- Run from: ~/Projects/Loyalty-Demo
-- psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/create_member_input_template.sql

-- First check if PASSPORT molecule exists
SELECT molecule_id, molecule_key, label, storage_size, value_type, value_kind
FROM molecule_def 
WHERE molecule_key = 'PASSPORT' AND tenant_id = 1;

-- Create the template header (activity_type = 'M' for Member)
DO $$
DECLARE
  v_template_id INTEGER;
BEGIN
  -- Check if template exists
  SELECT template_id INTO v_template_id
  FROM input_template
  WHERE tenant_id = 1 AND activity_type = 'M';
  
  IF v_template_id IS NULL THEN
    -- Create new template (let identity column auto-generate)
    INSERT INTO input_template (tenant_id, template_name, activity_type, is_active)
    VALUES (1, 'Member Profile Attributes', 'M', true)
    RETURNING template_id INTO v_template_id;
    
    RAISE NOTICE 'Created template_id: %', v_template_id;
  ELSE
    -- Update existing
    UPDATE input_template 
    SET template_name = 'Member Profile Attributes', is_active = true
    WHERE template_id = v_template_id;
    
    RAISE NOTICE 'Updated existing template_id: %', v_template_id;
  END IF;
  
  -- Add PASSPORT field if not exists
  IF NOT EXISTS (
    SELECT 1 FROM input_template_field 
    WHERE template_id = v_template_id AND molecule_key = 'PASSPORT'
  ) THEN
    INSERT INTO input_template_field (
      template_id, row_number, molecule_key, start_position, 
      display_width, field_width, enterable, is_required, display_label, sort_order
    ) VALUES (
      v_template_id,
      10,              -- row_number
      'PASSPORT',      -- molecule_key
      1,               -- start_position (1-100 grid)
      50,              -- display_width (half width)
      20,              -- field_width (chars)
      'Y',             -- enterable
      false,           -- is_required
      'Passport Number', -- display_label
      1                -- sort_order
    );
    RAISE NOTICE 'Added PASSPORT field';
  END IF;
  
END $$;

-- Verify
SELECT t.template_id, t.template_name, t.activity_type, t.is_active,
       f.field_id, f.molecule_key, f.row_number, f.start_position, f.display_width, f.display_label
FROM input_template t
LEFT JOIN input_template_field f ON t.template_id = f.template_id
WHERE t.tenant_id = 1 AND t.activity_type = 'M'
ORDER BY f.row_number, f.sort_order;
