-- Create State Molecule
-- Context: tenant (used across members, partners, etc.)
-- Type: Dynamic/Lookup Internal (pre-defined list of states)

-- Step 1: Insert molecule definition
INSERT INTO molecule_def (
  molecule_key, 
  label, 
  description, 
  context, 
  value_kind, 
  tenant_id, 
  is_permanent
) VALUES (
  'state',
  'State/Province',
  'US states and territories',
  'tenant',
  'list',
  1,
  false
);

-- Step 2: Insert US state values
-- text_value = code (MN), display_label = full name (Minnesota)
INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order)
SELECT 
  (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'state' AND tenant_id = 1),
  code,
  name,
  ROW_NUMBER() OVER (ORDER BY name)
FROM (VALUES
  ('AL', 'Alabama'),
  ('AK', 'Alaska'),
  ('AZ', 'Arizona'),
  ('AR', 'Arkansas'),
  ('CA', 'California'),
  ('CO', 'Colorado'),
  ('CT', 'Connecticut'),
  ('DE', 'Delaware'),
  ('FL', 'Florida'),
  ('GA', 'Georgia'),
  ('HI', 'Hawaii'),
  ('ID', 'Idaho'),
  ('IL', 'Illinois'),
  ('IN', 'Indiana'),
  ('IA', 'Iowa'),
  ('KS', 'Kansas'),
  ('KY', 'Kentucky'),
  ('LA', 'Louisiana'),
  ('ME', 'Maine'),
  ('MD', 'Maryland'),
  ('MA', 'Massachusetts'),
  ('MI', 'Michigan'),
  ('MN', 'Minnesota'),
  ('MS', 'Mississippi'),
  ('MO', 'Missouri'),
  ('MT', 'Montana'),
  ('NE', 'Nebraska'),
  ('NV', 'Nevada'),
  ('NH', 'New Hampshire'),
  ('NJ', 'New Jersey'),
  ('NM', 'New Mexico'),
  ('NY', 'New York'),
  ('NC', 'North Carolina'),
  ('ND', 'North Dakota'),
  ('OH', 'Ohio'),
  ('OK', 'Oklahoma'),
  ('OR', 'Oregon'),
  ('PA', 'Pennsylvania'),
  ('RI', 'Rhode Island'),
  ('SC', 'South Carolina'),
  ('SD', 'South Dakota'),
  ('TN', 'Tennessee'),
  ('TX', 'Texas'),
  ('UT', 'Utah'),
  ('VT', 'Vermont'),
  ('VA', 'Virginia'),
  ('WA', 'Washington'),
  ('WV', 'West Virginia'),
  ('WI', 'Wisconsin'),
  ('WY', 'Wyoming'),
  ('DC', 'District of Columbia')
) AS states(code, name);

-- Verify the inserts
SELECT 
  md.molecule_key,
  md.label,
  md.context,
  COUNT(mvt.value_id) as value_count
FROM molecule_def md
LEFT JOIN molecule_value_text mvt ON md.molecule_id = mvt.molecule_id
WHERE md.molecule_key = 'state'
GROUP BY md.molecule_key, md.label, md.context;
