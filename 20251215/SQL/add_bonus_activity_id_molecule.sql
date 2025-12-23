-- Add bonus_activity_id molecule for bonus processing
-- This molecule links parent activities to their bonus activities (type N)

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

-- Verify
SELECT molecule_id, molecule_key, label, is_permanent 
FROM molecule_def 
WHERE molecule_key = 'bonus_activity_id';
