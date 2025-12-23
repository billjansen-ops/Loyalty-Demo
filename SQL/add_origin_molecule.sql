-- Add missing origin molecule to molecule_def
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

-- Verify
SELECT molecule_key, label, value_kind, lookup_table_key 
FROM molecule_def 
WHERE molecule_key IN ('carrier', 'origin', 'destination')
ORDER BY molecule_key;
