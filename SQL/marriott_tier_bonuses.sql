-- Marriott Tier Bonuses
-- tenant_id = 3 (Marriott)
-- User will add criteria to each bonus after creation

-- GOLD25 - 25% bonus for Gold Elite members
INSERT INTO bonus (
    tenant_id, bonus_code, bonus_description, bonus_type, bonus_amount,
    start_date, end_date, is_active,
    apply_sunday, apply_monday, apply_tuesday, apply_wednesday, 
    apply_thursday, apply_friday, apply_saturday
) VALUES (
    3, 'GOLD25', 'Gold Elite 25% Bonus Points', 'percent', 25,
    '2025-01-01', '2025-12-31', true,
    true, true, true, true, true, true, true
)
ON CONFLICT (tenant_id, bonus_code) DO UPDATE SET
    bonus_description = EXCLUDED.bonus_description,
    bonus_type = EXCLUDED.bonus_type,
    bonus_amount = EXCLUDED.bonus_amount,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    is_active = EXCLUDED.is_active;

-- PLAT50 - 50% bonus for Platinum Elite members
INSERT INTO bonus (
    tenant_id, bonus_code, bonus_description, bonus_type, bonus_amount,
    start_date, end_date, is_active,
    apply_sunday, apply_monday, apply_tuesday, apply_wednesday, 
    apply_thursday, apply_friday, apply_saturday
) VALUES (
    3, 'PLAT50', 'Platinum Elite 50% Bonus', 'percent', 50,
    '2025-01-01', '2025-12-31', true,
    true, true, true, true, true, true, true
)
ON CONFLICT (tenant_id, bonus_code) DO UPDATE SET
    bonus_description = EXCLUDED.bonus_description,
    bonus_type = EXCLUDED.bonus_type,
    bonus_amount = EXCLUDED.bonus_amount,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    is_active = EXCLUDED.is_active;

-- TITAN75 - 75% bonus for Titanium Elite members
INSERT INTO bonus (
    tenant_id, bonus_code, bonus_description, bonus_type, bonus_amount,
    start_date, end_date, is_active,
    apply_sunday, apply_monday, apply_tuesday, apply_wednesday, 
    apply_thursday, apply_friday, apply_saturday
) VALUES (
    3, 'TITAN75', 'Titanium Elite 75% Bonus', 'percent', 75,
    '2025-01-01', '2025-12-31', true,
    true, true, true, true, true, true, true
)
ON CONFLICT (tenant_id, bonus_code) DO UPDATE SET
    bonus_description = EXCLUDED.bonus_description,
    bonus_type = EXCLUDED.bonus_type,
    bonus_amount = EXCLUDED.bonus_amount,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    is_active = EXCLUDED.is_active;

-- AMB75 - 75% bonus for Ambassador Elite members
INSERT INTO bonus (
    tenant_id, bonus_code, bonus_description, bonus_type, bonus_amount,
    start_date, end_date, is_active,
    apply_sunday, apply_monday, apply_tuesday, apply_wednesday, 
    apply_thursday, apply_friday, apply_saturday
) VALUES (
    3, 'AMB75', 'Ambassador Elite 75% Bonus', 'percent', 75,
    '2025-01-01', '2025-12-31', true,
    true, true, true, true, true, true, true
)
ON CONFLICT (tenant_id, bonus_code) DO UPDATE SET
    bonus_description = EXCLUDED.bonus_description,
    bonus_type = EXCLUDED.bonus_type,
    bonus_amount = EXCLUDED.bonus_amount,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    is_active = EXCLUDED.is_active;

-- Verify the bonuses were created
SELECT bonus_id, bonus_code, bonus_description, bonus_type, bonus_amount
FROM bonus 
WHERE tenant_id = 3 
ORDER BY bonus_amount;
