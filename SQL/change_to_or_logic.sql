-- ============================================================
-- CHANGE RULE TO OR LOGIC
-- Rule: Must fly Delta OR Must travel to Boston
-- ============================================================

-- Change the joiner from AND to OR
UPDATE rule_criteria
SET joiner = 'OR'
WHERE rule_id = 1 AND molecule_key = 'carrier';

-- Update labels for clarity
UPDATE rule_criteria
SET label = 'Fly on Delta'
WHERE rule_id = 1 AND molecule_key = 'carrier';

UPDATE rule_criteria
SET label = 'Fly into Boston'
WHERE rule_id = 1 AND molecule_key = 'destination';

-- Verification
SELECT 'Updated criteria for BILLSTEST:' as info;
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
