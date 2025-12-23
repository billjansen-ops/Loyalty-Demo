-- Activity Bonus Table
-- Tracks which bonuses were awarded to which activities

CREATE TABLE IF NOT EXISTS activity_bonus (
    activity_bonus_id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(activity_id),
    bonus_id INTEGER NOT NULL REFERENCES bonus(bonus_id),
    bonus_points INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_activity_bonus UNIQUE(activity_id, bonus_id)
);

CREATE INDEX idx_activity_bonus_activity ON activity_bonus(activity_id);
CREATE INDEX idx_activity_bonus_bonus ON activity_bonus(bonus_id);

COMMENT ON TABLE activity_bonus IS 'Records which bonuses were awarded to specific activities';
COMMENT ON COLUMN activity_bonus.bonus_points IS 'Calculated bonus points awarded (not the base points)';

-- Verify
SELECT 'activity_bonus table created' as message;
