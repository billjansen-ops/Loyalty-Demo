-- Add lookup configurations for origin and destination molecules
-- Both reference the airports table
-- Date: 2025-11-04

-- Insert configuration for origin molecule
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
    'airports',
    'airport_id',
    'code',
    'name',
    'admin_airports.html',
    'Airport values are maintained in the <a href="admin_airports.html">Airport Management</a> page.'
FROM molecule_def
WHERE molecule_key = 'origin'
AND tenant_id = 1;  -- Adjust tenant_id as needed

-- Insert configuration for destination molecule
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
    'airports',
    'airport_id',
    'code',
    'name',
    'admin_airports.html',
    'Airport values are maintained in the <a href="admin_airports.html">Airport Management</a> page.'
FROM molecule_def
WHERE molecule_key = 'destination'
AND tenant_id = 1;  -- Adjust tenant_id as needed

-- Verify the inserts
SELECT 
    l.lookup_id,
    m.molecule_key,
    m.label,
    l.table_name,
    l.id_column,
    l.code_column,
    l.label_column
FROM molecule_value_lookup l
JOIN molecule_def m ON l.molecule_id = m.molecule_id
ORDER BY m.molecule_key;
