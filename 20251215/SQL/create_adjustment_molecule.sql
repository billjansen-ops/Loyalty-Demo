-- Create adjustment molecule and lookup metadata
-- Author: Claude
-- Date: 2025-11-18

-- Get next available molecule_id
DO $$
DECLARE
    next_mol_id INTEGER;
BEGIN
    SELECT COALESCE(MAX(molecule_id), 0) + 1 INTO next_mol_id FROM molecule_def;

    -- Insert adjustment molecule
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
        decimal_places
    ) VALUES (
        'adjustment',
        'Adjustment',
        'lookup',
        NULL,
        'adjustment',
        NOW(),
        1,
        'program',
        false,
        false,
        false,
        true,
        'Manual point adjustment for customer service and corrections',
        52,
        NOW(),
        next_mol_id,
        0
    );

    RAISE NOTICE 'Created adjustment molecule with ID: %', next_mol_id;

    -- Insert lookup metadata for adjustment molecule
    INSERT INTO molecule_value_lookup (
        molecule_id,
        table_name,
        id_column,
        code_column,
        label_column,
        is_tenant_specific
    ) VALUES (
        next_mol_id,
        'adjustment',
        'adjustment_id',
        'adjustment_code',
        'adjustment_name',
        true
    );

    RAISE NOTICE 'Added lookup metadata for adjustment molecule';
END $$;

-- Verify the molecule was created
SELECT 
    md.molecule_id,
    md.molecule_key,
    md.label,
    md.value_kind,
    md.lookup_table_key,
    mvl.table_name,
    mvl.code_column,
    mvl.label_column
FROM molecule_def md
LEFT JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
WHERE md.molecule_key = 'adjustment'
ORDER BY md.molecule_key;
