-- Deactivate old molecules that are now in sysparm
-- These were replaced by sysparm values: retro/days_allowed and tier/max_qualification_days

-- Deactivate retro_days_allowed
UPDATE molecule_def
SET is_active = false, 
    is_permanent = false,
    updated_at = NOW()
WHERE molecule_key = 'retro_days_allowed'
  AND tenant_id = 1;

-- Deactivate max_tier_qualification_days
UPDATE molecule_def
SET is_active = false,
    is_permanent = false,
    updated_at = NOW()
WHERE molecule_key = 'max_tier_qualification_days'
  AND tenant_id = 1;

-- Verify they're deactivated
SELECT 
    molecule_key,
    is_active,
    is_permanent,
    context
FROM molecule_def
WHERE molecule_key IN ('retro_days_allowed', 'max_tier_qualification_days')
  AND tenant_id = 1;
