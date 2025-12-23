-- ============================================================
-- ADD MISSING MOLECULES TO molecule_def
-- ============================================================

-- Origin (if not already added)
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  lookup_table_key
) VALUES (
  'origin',
  'Origin',
  'lookup',
  'airport'
) ON CONFLICT (molecule_key) DO NOTHING;

-- Fare Class (list type with valid values F, Y, C)
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  scalar_type
) VALUES (
  'fare_class',
  'Fare Class',
  'list',
  'string'
) ON CONFLICT (molecule_key) DO NOTHING;

-- Flight Number (scalar - just entered)
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  scalar_type
) VALUES (
  'flight_number',
  'Flight Number',
  'scalar',
  'string'
) ON CONFLICT (molecule_key) DO NOTHING;

-- Verify all Activity molecules are present
SELECT molecule_key, label, value_kind, lookup_table_key, scalar_type
FROM molecule_def
WHERE molecule_key IN ('carrier', 'origin', 'destination', 'fare_class', 'flight_number')
ORDER BY molecule_key;
