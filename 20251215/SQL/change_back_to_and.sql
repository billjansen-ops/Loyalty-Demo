-- ============================================================
-- CHANGE BACK TO AND LOGIC
-- Rule: Must fly Delta AND Must travel to Boston
-- ============================================================

-- Change the joiner from OR back to AND
UPDATE rule_criteria
SET joiner = 'AND'
WHERE rule_id = 1 AND molecule_key = 'carrier';

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
