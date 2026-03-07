-- Add parameter value columns to rule_criteria
-- These store the parameter values for reference molecules that accept parameters
-- (e.g., member_badge_on_date with param1_value = 'MILLION_MILER')

ALTER TABLE rule_criteria ADD COLUMN IF NOT EXISTS param1_value varchar(64);
ALTER TABLE rule_criteria ADD COLUMN IF NOT EXISTS param2_value varchar(64);
ALTER TABLE rule_criteria ADD COLUMN IF NOT EXISTS param3_value varchar(64);
ALTER TABLE rule_criteria ADD COLUMN IF NOT EXISTS param4_value varchar(64);
