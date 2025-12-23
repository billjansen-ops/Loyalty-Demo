-- Add bonus molecules for type N activity processing
-- Run with: psql -f SQL/add_bonus_molecules.sql

-- bonus_activity_id: Links parent activity to its bonus activities
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  scalar_type,
  tenant_id,
  context,
  is_static,
  is_permanent,
  is_required,
  is_active,
  description
) VALUES (
  'bonus_activity_id',
  'Bonus Activity',
  'scalar',
  'numeric',
  1,
  'activity',
  false,
  true,
  false,
  true,
  'Required for bonus processing - links parent activity to bonus activities'
);

-- bonus_rule_id: Links bonus activity (type N) to the bonus rule that awarded it
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  scalar_type,
  tenant_id,
  context,
  is_static,
  is_permanent,
  is_required,
  is_active,
  description
) VALUES (
  'bonus_rule_id',
  'Bonus Rule',
  'scalar',
  'numeric',
  1,
  'activity',
  false,
  true,
  false,
  true,
  'Required for bonus processing - links bonus activity to the rule that awarded it'
);

-- Verify
SELECT molecule_id, molecule_key, label, is_permanent 
FROM molecule_def 
WHERE molecule_key IN ('bonus_activity_id', 'bonus_rule_id')
ORDER BY molecule_key;
