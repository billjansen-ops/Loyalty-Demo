-- Create molecule_def table
CREATE TABLE IF NOT EXISTS molecule_def (
  molecule_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value_kind TEXT NOT NULL,  -- 'scalar', 'list', 'lookup'
  scalar_type TEXT,           -- 'number', 'text', 'date', 'boolean'
  lookup_table_key TEXT,      -- 'carrier', 'airport', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert carrier molecule definition
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  lookup_table_key
) VALUES (
  'carrier',
  'Carrier Code',
  'lookup',
  'carrier'
) ON CONFLICT (molecule_key) DO NOTHING;

-- Verify
SELECT 'Molecule definition created:' as info, * FROM molecule_def WHERE molecule_key = 'carrier';
