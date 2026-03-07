-- Add score_function column to survey table
-- When not null, survey submit triggers scoring and accrual creation
-- Value is the function name exported from tenant scoring module
-- e.g., 'scorePPSI' or 'scoreProviderPulse'

ALTER TABLE survey ADD COLUMN IF NOT EXISTS score_function VARCHAR(100);

COMMENT ON COLUMN survey.score_function IS 'Function name in tenant scoring module. Null = no accrual on submit.';
