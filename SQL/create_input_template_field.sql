-- Create input_template_field table
-- Replaces template_string text column with proper normalized structure

CREATE TABLE IF NOT EXISTS input_template_field (
  field_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES input_template(template_id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,           -- which row (10, 20, 30...)
  molecule_key VARCHAR(50) NOT NULL,     -- which molecule
  start_position SMALLINT NOT NULL,      -- 1-100 grid position
  display_width SMALLINT NOT NULL,       -- 1-100 columns on grid
  field_width SMALLINT,                  -- character width for input (NULL = auto from molecule)
  enterable CHAR(1) NOT NULL DEFAULT 'Y', -- Y/N
  system_generated VARCHAR(100),         -- function name or NULL
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_label VARCHAR(100),            -- override label or NULL (uses molecule label)
  sort_order SMALLINT NOT NULL           -- order within row (for fields on same row)
);

COMMENT ON TABLE input_template_field IS 'Individual fields within an input template - one row per field';
COMMENT ON COLUMN input_template_field.row_number IS 'Layout row (10, 20, 30...) - fields with same row_number appear on same line';
COMMENT ON COLUMN input_template_field.start_position IS 'Start column on 100-column grid (1-100)';
COMMENT ON COLUMN input_template_field.display_width IS 'Width in columns on 100-column grid (1-100)';
COMMENT ON COLUMN input_template_field.field_width IS 'Character width for input box (NULL = auto-size based on molecule)';
COMMENT ON COLUMN input_template_field.enterable IS 'Y = CSR can edit, N = system-generated read-only';
COMMENT ON COLUMN input_template_field.system_generated IS 'Function name that calculates value (e.g., selectAircraftType)';
COMMENT ON COLUMN input_template_field.display_label IS 'Override label (NULL = use molecule label)';
COMMENT ON COLUMN input_template_field.sort_order IS 'Order within row for fields on same row_number';

CREATE INDEX idx_input_template_field_template ON input_template_field(template_id);
CREATE INDEX idx_input_template_field_layout ON input_template_field(template_id, row_number, sort_order);

-- Migrate existing data from template_string format
-- Current format: [M,carrier,"third",R],[M,flight_number,"third",O],[M,fare_class,"third",R,"Class"]
-- "third" = 33%, "half" = 50%, "full" = 100%

-- Template 1 (Flight Entry) - Row 10: carrier, flight_number, fare_class (33% each)
INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
VALUES 
  (1, 10, 'carrier', 1, 33, NULL, 'Y', true, NULL, 1),
  (1, 10, 'flight_number', 34, 33, 4, 'Y', false, NULL, 2),
  (1, 10, 'fare_class', 67, 34, NULL, 'Y', true, 'Class', 3);

-- Template 1 (Flight Entry) - Row 20: origin, destination (50% each)
INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
VALUES 
  (1, 20, 'origin', 1, 50, NULL, 'Y', true, NULL, 1),
  (1, 20, 'destination', 51, 50, NULL, 'Y', true, NULL, 2);

-- Template 1 (Flight Entry) - Row 30: mqd, aircraft_type (50%, 50%)
INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, system_generated, is_required, display_label, sort_order)
VALUES 
  (1, 30, 'mqd', 1, 50, NULL, 'Y', NULL, true, 'MQD''s', 1),
  (1, 30, 'aircraft_type', 51, 50, NULL, 'N', 'selectAircraftType', false, NULL, 2);

-- Template 2 (Partner Activity Entry) - Row 10: partner, partner_program (50% each)
INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
VALUES 
  (2, 10, 'partner', 1, 50, NULL, 'Y', true, NULL, 1),
  (2, 10, 'partner_program', 51, 50, NULL, 'Y', true, NULL, 2);

-- Template 2 (Partner Activity Entry) - Row 20: base_miles (50%)
INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
VALUES 
  (2, 20, 'base_miles', 1, 50, NULL, 'Y', true, NULL, 1);

-- Template 3 (Adjustment Entry) - Row 10: adjustment (50%)
INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
VALUES 
  (3, 10, 'adjustment', 1, 50, NULL, 'Y', true, NULL, 1);

-- Template 3 (Adjustment Entry) - Row 20: base_miles (50%)
INSERT INTO input_template_field (template_id, row_number, molecule_key, start_position, display_width, field_width, enterable, is_required, display_label, sort_order)
VALUES 
  (3, 20, 'base_miles', 1, 50, NULL, 'Y', true, NULL, 1);

-- Verify migration
SELECT 
  t.template_name,
  f.row_number,
  f.molecule_key,
  f.start_position,
  f.display_width,
  f.enterable,
  f.system_generated,
  f.display_label
FROM input_template_field f
JOIN input_template t ON f.template_id = t.template_id
ORDER BY t.template_id, f.row_number, f.sort_order;
