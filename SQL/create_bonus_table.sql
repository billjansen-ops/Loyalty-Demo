-- Loyalty Platform - Bonus Rules Table
-- The Secret Sauce! Defines how extra miles/points are earned

CREATE TABLE IF NOT EXISTS bonus (
    bonus_id SERIAL PRIMARY KEY,
    bonus_code VARCHAR(10) NOT NULL UNIQUE,
    bonus_description VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    bonus_type VARCHAR(10) NOT NULL CHECK (bonus_type IN ('fixed', 'percent')),
    bonus_amount INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bonus_code ON bonus(bonus_code);
CREATE INDEX idx_bonus_active ON bonus(is_active);
CREATE INDEX idx_bonus_dates ON bonus(start_date, end_date);

COMMENT ON TABLE bonus IS 'Defines bonus rules for earning extra miles/points';
COMMENT ON COLUMN bonus.bonus_code IS 'Unique code identifier (e.g., GOLD_10PCT, DBL_MILES)';
COMMENT ON COLUMN bonus.bonus_description IS 'Human-readable description shown to members';
COMMENT ON COLUMN bonus.bonus_type IS 'fixed = flat amount, percent = percentage of base';
COMMENT ON COLUMN bonus.bonus_amount IS 'If percent: 10 = 10%. If fixed: 500 = 500 miles';

-- Sample bonus data
INSERT INTO bonus (bonus_code, bonus_description, start_date, end_date, bonus_type, bonus_amount, is_active) VALUES
    ('GOLD_10', 'Gold Tier 10% Uplift', '2025-01-01', NULL, 'percent', 10, true),
    ('PLAT_25', 'Platinum Tier 25% Uplift', '2025-01-01', NULL, 'percent', 25, true),
    ('DBL_TUES', 'Double Miles Tuesday', '2025-01-01', '2025-12-31', 'percent', 100, true),
    ('WELCOME', 'Welcome Bonus', '2025-01-01', '2025-03-31', 'fixed', 500, true),
    ('FIRST_50', 'First Class 50% Bonus', '2025-01-01', NULL, 'percent', 50, true)
ON CONFLICT (bonus_code) DO NOTHING;

-- Verify data
SELECT 'Bonuses created:' as message, COUNT(*) as count FROM bonus;

SELECT 
    bonus_code,
    bonus_description,
    bonus_type,
    bonus_amount,
    CASE 
        WHEN bonus_type = 'percent' THEN bonus_amount || '%'
        ELSE bonus_amount || ' miles'
    END as display_value
FROM bonus
ORDER BY bonus_code;
