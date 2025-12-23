-- ============================================================
-- CRITERIA RULES - SIMPLE ROLLBACK
-- Purpose: Clear BILLSTEST rule data for next iteration
-- Keeps tables intact, just clears the rule
-- ============================================================

-- Delete criteria for rule_id = 1 (BILLSTEST)
DELETE FROM rule_criteria WHERE rule_id = 1;

-- Delete the rule itself
DELETE FROM rule WHERE rule_id = 1;

-- Unlink BILLSTEST from rule
UPDATE bonus SET rule_id = NULL WHERE bonus_code = 'BILLSTEST';

-- Verification
SELECT 'Rule data cleared for BILLSTEST!' as status;

SELECT 'Bonus status:' as info, 
       bonus_code, rule_id 
FROM bonus 
WHERE bonus_code = 'BILLSTEST';

SELECT 'Remaining criteria:' as info, 
       COUNT(*) as count 
FROM rule_criteria;
