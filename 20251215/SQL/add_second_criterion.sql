-- ============================================================
-- ADD SECOND CRITERION: Destination = BOS
-- Rule: Must fly Delta AND Must travel to Boston
-- ============================================================

-- Step 1: Add destination molecule to molecule_def
INSERT INTO molecule_def (
  molecule_key,
  label,
  value_kind,
  lookup_table_key
) VALUES (
  'destination',
  'Destination',
  'lookup',
  'airport'
) ON CONFLICT (molecule_key) DO NOTHING;

-- Step 2: Update first criterion to have AND joiner
UPDATE rule_criteria
SET joiner = 'AND'
WHERE rule_id = 1 AND molecule_key = 'carrier';

-- Step 3: Add second criterion (destination = BOS)
INSERT INTO rule_criteria (
  rule_id,
  molecule_key,
  operator,
  value,
  label,
  joiner,
  sort_order
) VALUES (
  1,                          -- rule_id for BILLSTEST
  'destination',              -- molecule we're checking
  'equals',                   -- operator
  '"BOS"'::jsonb,            -- value (JSON string)
  'Must travel to Boston',   -- diagnostic label
  NULL,                       -- no joiner (last criterion)
  2                           -- sort order
) ON CONFLICT DO NOTHING;

-- Verification
SELECT 'Criteria for BILLSTEST:' as info;
SELECT 
  criteria_id, 
  molecule_key, 
  operator, 
  value, 
  label,
  joiner,
  sort_order
FROM rule_criteria
WHERE rule_id = 1
ORDER BY sort_order;
