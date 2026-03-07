-- Fix Marriott folio molecule
-- Following Delta's PASSPORT pattern for non-indexed text

UPDATE molecule_def
SET storage_size = '4', 
    value_type = 'key', 
    value_kind = 'value', 
    scalar_type = 'text_direct'
WHERE tenant_id = 3 AND molecule_key = 'folio';

-- Verify
SELECT molecule_id, molecule_key, storage_size, value_type, value_kind, scalar_type
FROM molecule_def
WHERE tenant_id = 3 AND molecule_key = 'folio';
