-- Remove timestamp columns from molecule_value_list
ALTER TABLE molecule_value_list DROP COLUMN IF EXISTS created_at;
ALTER TABLE molecule_value_list DROP COLUMN IF EXISTS updated_at;
