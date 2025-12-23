-- Add molecule_types category to sysparm embedded list
-- These are the valid molecule type options for the admin UI

-- First, increase code column size to accommodate longer type names
ALTER TABLE molecule_value_embedded_list ALTER COLUMN code TYPE VARCHAR(50);

-- Now insert molecule types
INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order)
VALUES 
  -- Molecule types
  (16, 1, 'molecule_types', 'scalar-text', 'Single Value - Text', 10),
  (16, 1, 'molecule_types', 'scalar-numeric', 'Single Value - Numeric', 20),
  (16, 1, 'molecule_types', 'scalar-date', 'Single Value - Date', 30),
  (16, 1, 'molecule_types', 'scalar-boolean', 'Single Value - Boolean', 40),
  (16, 1, 'molecule_types', 'list', 'List', 50),
  (16, 1, 'molecule_types', 'embedded_list', 'Embedded List (Categorized)', 60),
  (16, 1, 'molecule_types', 'lookup', 'Lookup', 70);
