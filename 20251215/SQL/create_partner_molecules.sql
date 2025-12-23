-- Add partner and partner_program molecules
-- Author: Claude
-- Date: 2025-11-17

-- First, add parent_molecule_key and parent_fk_field columns to molecule_def if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='molecule_def' AND column_name='parent_molecule_key') THEN
        ALTER TABLE molecule_def ADD COLUMN parent_molecule_key VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='molecule_def' AND column_name='parent_fk_field') THEN
        ALTER TABLE molecule_def ADD COLUMN parent_fk_field VARCHAR(50);
    END IF;
END $$;

-- Add comments for new columns
COMMENT ON COLUMN molecule_def.parent_molecule_key IS 'For hierarchical molecules: key of parent molecule (e.g., partner_program has parent partner)';
COMMENT ON COLUMN molecule_def.parent_fk_field IS 'For hierarchical molecules: foreign key field name in lookup table (e.g., partner_id)';

-- Get next molecule_id values
DO $$
DECLARE
    next_partner_id INTEGER;
    next_program_id INTEGER;
BEGIN
    -- Get next available molecule_id
    SELECT COALESCE(MAX(molecule_id), 0) + 1 INTO next_partner_id FROM molecule_def;
    next_program_id := next_partner_id + 1;

    -- Insert partner molecule (standard lookup, no parent)
    INSERT INTO molecule_def (
        molecule_key,
        label,
        value_kind,
        scalar_type,
        lookup_table_key,
        created_at,
        tenant_id,
        context,
        is_static,
        is_permanent,
        is_required,
        is_active,
        description,
        display_order,
        updated_at,
        molecule_id,
        decimal_places,
        parent_molecule_key,
        parent_fk_field
    ) VALUES (
        'partner',
        'Partner',
        'lookup',
        NULL,
        'partner',
        NOW(),
        1,
        'program',
        false,
        false,
        false,
        true,
        'Earning partner for non-core activities (car rental, hotels, credit cards)',
        50,
        NOW(),
        next_partner_id,
        0,
        NULL,  -- No parent
        NULL
    );

    -- Insert partner_program molecule (lookup with hierarchical metadata)
    INSERT INTO molecule_def (
        molecule_key,
        label,
        value_kind,
        scalar_type,
        lookup_table_key,
        created_at,
        tenant_id,
        context,
        is_static,
        is_permanent,
        is_required,
        is_active,
        description,
        display_order,
        updated_at,
        molecule_id,
        decimal_places,
        parent_molecule_key,
        parent_fk_field
    ) VALUES (
        'partner_program',
        'Partner Program',
        'lookup',
        NULL,
        'partner_program',
        NOW(),
        1,
        'program',
        false,
        false,
        false,
        true,
        'Specific earning program within a partner (e.g., Hertz Luxury Cars, Marriott Gold)',
        51,
        NOW(),
        next_program_id,
        0,
        'partner',      -- THIS IS THE KEY: declares parent relationship
        'partner_id'    -- THIS IS THE KEY: foreign key field to filter by
    );

    RAISE NOTICE 'Created partner molecule with ID: %', next_partner_id;
    RAISE NOTICE 'Created partner_program molecule with ID: %', next_program_id;
END $$;

-- Verify the molecules were created
SELECT 
    molecule_id,
    molecule_key,
    label,
    value_kind,
    lookup_table_key,
    parent_molecule_key,
    parent_fk_field
FROM molecule_def
WHERE molecule_key IN ('partner', 'partner_program')
ORDER BY molecule_key;
