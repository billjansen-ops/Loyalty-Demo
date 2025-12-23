-- Add lookup metadata for partner molecules
-- This tells decodeMolecule how to query the partner and partner_program tables

-- Get the molecule_ids for partner and partner_program
DO $$
DECLARE
    partner_mol_id INTEGER;
    program_mol_id INTEGER;
BEGIN
    -- Get molecule_ids
    SELECT molecule_id INTO partner_mol_id 
    FROM molecule_def 
    WHERE molecule_key = 'partner' AND tenant_id = 1;
    
    SELECT molecule_id INTO program_mol_id 
    FROM molecule_def 
    WHERE molecule_key = 'partner_program' AND tenant_id = 1;
    
    -- Insert lookup metadata for partner molecule
    INSERT INTO molecule_value_lookup (
        molecule_id,
        table_name,
        id_column,
        code_column,
        label_column,
        is_tenant_specific
    ) VALUES (
        partner_mol_id,
        'partner',
        'partner_id',
        'partner_code',
        'partner_name',
        true
    );
    
    RAISE NOTICE 'Added lookup metadata for partner (molecule_id: %)', partner_mol_id;
    
    -- Insert lookup metadata for partner_program molecule
    INSERT INTO molecule_value_lookup (
        molecule_id,
        table_name,
        id_column,
        code_column,
        label_column,
        is_tenant_specific
    ) VALUES (
        program_mol_id,
        'partner_program',
        'program_id',
        'program_code',
        'program_name',
        true
    );
    
    RAISE NOTICE 'Added lookup metadata for partner_program (molecule_id: %)', program_mol_id;
END $$;

-- Verify the metadata was added
SELECT 
    md.molecule_id,
    md.molecule_key,
    mvl.table_name,
    mvl.id_column,
    mvl.code_column,
    mvl.is_tenant_specific
FROM molecule_def md
JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
WHERE md.molecule_key IN ('partner', 'partner_program')
ORDER BY md.molecule_key;
