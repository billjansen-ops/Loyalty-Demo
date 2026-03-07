-- Configure molecule_value_lookup for brand and property (Marriott tenant_id=3)

-- Get the molecule_ids
SELECT molecule_id, molecule_key FROM molecule_def 
WHERE tenant_id = 3 AND molecule_key IN ('brand', 'property');

-- Add lookup config for brand (molecule_id=80)
INSERT INTO molecule_value_lookup (molecule_id, table_name, id_column, code_column, label_column)
VALUES (80, 'brand', 'brand_id', 'code', 'name');

-- Add lookup config for property (molecule_id=73)
INSERT INTO molecule_value_lookup (molecule_id, table_name, id_column, code_column, label_column)
VALUES (73, 'property', 'property_id', 'code', 'name');

-- Verify
SELECT md.molecule_key, mvl.table_name, mvl.id_column, mvl.code_column, mvl.label_column
FROM molecule_def md
JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
WHERE md.tenant_id = 3 AND md.molecule_key IN ('brand', 'property');
