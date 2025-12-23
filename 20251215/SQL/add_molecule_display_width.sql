-- Add display_width to molecule_def
-- Controls how wide input fields should be rendered (in bytes/characters)
-- NULL means use default width based on value_kind

ALTER TABLE molecule_def ADD COLUMN IF NOT EXISTS display_width SMALLINT;

COMMENT ON COLUMN molecule_def.display_width IS 'Width in bytes for input fields. NULL uses default.';

-- Set reasonable defaults for existing molecules
UPDATE molecule_def SET display_width = 3 WHERE molecule_key = 'carrier';
UPDATE molecule_def SET display_width = 4 WHERE molecule_key = 'flight_number';
UPDATE molecule_def SET display_width = 2 WHERE molecule_key = 'fare_class';
UPDATE molecule_def SET display_width = 4 WHERE molecule_key = 'origin';
UPDATE molecule_def SET display_width = 4 WHERE molecule_key = 'destination';
UPDATE molecule_def SET display_width = 8 WHERE molecule_key = 'mqd';
UPDATE molecule_def SET display_width = 10 WHERE molecule_key = 'base_miles';
