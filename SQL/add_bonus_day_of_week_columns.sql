-- Add day-of-week filtering columns to bonus table
-- All default to TRUE so existing bonuses continue to apply on all days

ALTER TABLE bonus
ADD COLUMN apply_sunday BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN apply_monday BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN apply_tuesday BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN apply_wednesday BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN apply_thursday BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN apply_friday BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN apply_saturday BOOLEAN NOT NULL DEFAULT TRUE;

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'bonus' 
AND column_name LIKE 'apply_%'
ORDER BY column_name;