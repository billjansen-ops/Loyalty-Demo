-- ============================================================
-- CRITERIA RULES - SQL Script v1
-- Purpose: Create criteria system and test with BILLSTEST
-- Test Rule: "Must travel on Delta" (carrier = DL)
-- ============================================================

-- Step 1: Create rule table (generic, reusable for bonus/promo/etc)
CREATE TABLE IF NOT EXISTS rule (
  rule_id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Create rule_criteria table (no groups yet, just flat criteria)
CREATE TABLE IF NOT EXISTS rule_criteria (
  criteria_id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES rule(rule_id) ON DELETE CASCADE,
  molecule_key TEXT NOT NULL,           -- e.g., 'carrier', 'origin', 'destination'
  operator TEXT NOT NULL,                -- e.g., 'equals', 'in', '>', '<'
  value JSONB NOT NULL,                  -- flexible storage: "DL" or ["DL","UA"]
  label TEXT NOT NULL,                   -- for diagnostics: "Must travel on Delta"
  joiner TEXT,                           -- 'AND' or 'OR' (joins to NEXT criteria)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Add rule_id column to bonus table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bonus' AND column_name = 'rule_id'
  ) THEN
    ALTER TABLE bonus ADD COLUMN rule_id INTEGER REFERENCES rule(rule_id);
  END IF;
END $$;

-- Step 4: Create a rule for BILLSTEST bonus
INSERT INTO rule (rule_id) VALUES (1)
ON CONFLICT (rule_id) DO NOTHING;

-- Step 5: Link BILLSTEST bonus to rule_id = 1
UPDATE bonus 
SET rule_id = 1 
WHERE bonus_code = 'BILLSTEST';

-- Step 6: Add criterion: "Must travel on Delta" (carrier = DL)
INSERT INTO rule_criteria (
  rule_id,
  molecule_key,
  operator,
  value,
  label,
  joiner,
  sort_order
) VALUES (
  1,                    -- rule_id for BILLSTEST
  'carrier',            -- molecule we're checking
  'equals',             -- operator
  '"DL"'::jsonb,        -- value (JSON string)
  'Must travel on Delta',  -- diagnostic label
  NULL,                 -- no joiner (only one criterion)
  1                     -- sort order
)
ON CONFLICT DO NOTHING;

-- Verification queries
SELECT 'Tables created successfully!' as status;

SELECT 'Bonus BILLSTEST linked to rule:' as info, 
       bonus_code, rule_id 
FROM bonus 
WHERE bonus_code = 'BILLSTEST';

SELECT 'Rule criteria:' as info,
       criteria_id, molecule_key, operator, value, label
FROM rule_criteria
WHERE rule_id = 1;
