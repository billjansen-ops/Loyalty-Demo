-- Create molecule_value_lookup table for external table configuration
-- Date: 2025-11-04

CREATE TABLE molecule_value_lookup (
    lookup_id SERIAL PRIMARY KEY,
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    table_name TEXT NOT NULL,
    id_column TEXT NOT NULL,
    code_column TEXT NOT NULL,
    label_column TEXT NOT NULL,
    maintenance_page TEXT,
    maintenance_description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE molecule_value_lookup IS 'Configuration for molecules that reference external lookup tables';
COMMENT ON COLUMN molecule_value_lookup.table_name IS 'Name of the external table (e.g., carriers, airports)';
COMMENT ON COLUMN molecule_value_lookup.id_column IS 'Primary key column name in external table (e.g., carrier_id)';
COMMENT ON COLUMN molecule_value_lookup.code_column IS 'Code/key column name (e.g., code)';
COMMENT ON COLUMN molecule_value_lookup.label_column IS 'Display label column name (e.g., name)';
COMMENT ON COLUMN molecule_value_lookup.maintenance_page IS 'URL to maintenance page (e.g., admin_carriers.html)';
COMMENT ON COLUMN molecule_value_lookup.maintenance_description IS 'Text to display to user about where to maintain values';

-- Insert configuration for carrier molecule
INSERT INTO molecule_value_lookup (
    molecule_id,
    table_name,
    id_column,
    code_column,
    label_column,
    maintenance_page,
    maintenance_description
)
SELECT 
    molecule_id,
    'carriers',
    'carrier_id',
    'code',
    'name',
    'admin_carriers.html',
    'Carrier values are maintained in the <a href="admin_carriers.html">Carrier Management</a> page.'
FROM molecule_def
WHERE molecule_key = 'carrier'
AND tenant_id = 1;  -- Adjust tenant_id as needed

-- Verify the insert
SELECT 
    l.lookup_id,
    m.molecule_key,
    m.label,
    l.table_name,
    l.id_column,
    l.code_column,
    l.label_column,
    l.maintenance_page
FROM molecule_value_lookup l
JOIN molecule_def m ON l.molecule_id = m.molecule_id;
