-- Add column_order to molecule_value_lookup for multi-column molecule support
-- All existing rows get column_order=1 (they are all single-column molecules)
-- New multi-column molecules can have different lookup configs per column

ALTER TABLE molecule_value_lookup ADD COLUMN IF NOT EXISTS column_order INTEGER DEFAULT 1;

-- Verify
SELECT lookup_id, molecule_id, table_name, column_order 
FROM molecule_value_lookup 
ORDER BY molecule_id, column_order;
