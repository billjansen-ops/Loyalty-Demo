-- Add quantity_available to redemption_rule
-- Run against: loyalty, loyaltytest, loyaltybackup
-- NULL = unlimited, integer = finite pool (decremented on each redemption)

\c loyalty
ALTER TABLE redemption_rule ADD COLUMN IF NOT EXISTS quantity_available INTEGER DEFAULT NULL;
COMMENT ON COLUMN redemption_rule.quantity_available IS 'Optional inventory limit. NULL=unlimited. Decremented by 1 on each successful redemption. SELECT FOR UPDATE used to prevent overselling.';

\c loyaltytest
ALTER TABLE redemption_rule ADD COLUMN IF NOT EXISTS quantity_available INTEGER DEFAULT NULL;
COMMENT ON COLUMN redemption_rule.quantity_available IS 'Optional inventory limit. NULL=unlimited. Decremented by 1 on each successful redemption. SELECT FOR UPDATE used to prevent overselling.';

\c loyaltybackup
ALTER TABLE redemption_rule ADD COLUMN IF NOT EXISTS quantity_available INTEGER DEFAULT NULL;
COMMENT ON COLUMN redemption_rule.quantity_available IS 'Optional inventory limit. NULL=unlimited. Decremented by 1 on each successful redemption. SELECT FOR UPDATE used to prevent overselling.';
