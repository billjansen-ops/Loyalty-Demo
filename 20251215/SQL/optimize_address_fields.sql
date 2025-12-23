-- Migration: Optimize address fields in member table
-- Changes:
--   1. state: varchar(50) → char(2) for US state codes
--   2. zip: varchar(20) → char(5) for 5-digit ZIP codes  
--   3. Add zip_plus4: char(4) for ZIP+4 extension

-- Step 1: Add zip_plus4 column
ALTER TABLE member 
ADD COLUMN zip_plus4 char(4);

-- Step 2: Change state to char(2)
ALTER TABLE member 
ALTER COLUMN state TYPE char(2);

-- Step 3: Change zip to char(5)
-- Note: This assumes zip field is currently named 'zip' 
-- If it's 'postal_code', adjust accordingly
ALTER TABLE member 
ALTER COLUMN zip TYPE char(5);

-- Verify changes
SELECT 
  column_name, 
  data_type, 
  character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'member' 
  AND column_name IN ('state', 'zip', 'zip_plus4')
ORDER BY column_name;
