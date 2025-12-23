-- Add can_be_promotion_counter to molecule_def
-- This flag indicates if a numeric molecule can be used as a promotion counter
ALTER TABLE molecule_def
ADD COLUMN can_be_promotion_counter boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN molecule_def.can_be_promotion_counter IS 
'Indicates if this numeric molecule can be summed for promotion goals (e.g., MQD=true, flight_number=false)';

-- Add counter_molecule_id to promotion
-- When count_type='molecules', this specifies which molecule to sum
ALTER TABLE promotion
ADD COLUMN counter_molecule_id integer;

COMMENT ON COLUMN promotion.counter_molecule_id IS 
'FK to molecule_def.molecule_id - specifies which molecule to count when count_type=''molecules''';

-- Add foreign key constraint
ALTER TABLE promotion
ADD CONSTRAINT promotion_counter_molecule_fk 
FOREIGN KEY (counter_molecule_id) 
REFERENCES molecule_def(molecule_id);

-- Drop old count_type constraint that had 'mqd' hardcoded
ALTER TABLE promotion
DROP CONSTRAINT promotion_count_type_check;

-- Add new count_type constraint with 'molecules' as generic option
ALTER TABLE promotion
ADD CONSTRAINT promotion_count_type_check 
CHECK (count_type IN ('flights', 'miles', 'enrollments', 'molecules'));

-- Add constraint: if count_type='molecules', counter_molecule_id must be set
ALTER TABLE promotion
ADD CONSTRAINT promotion_molecule_counter_required
CHECK (
  (count_type = 'molecules' AND counter_molecule_id IS NOT NULL) OR
  (count_type != 'molecules' AND counter_molecule_id IS NULL)
);

-- Set can_be_promotion_counter=true for MQD if it exists
UPDATE molecule_def
SET can_be_promotion_counter = true
WHERE molecule_key = 'mqd' AND scalar_type = 'numeric';

-- Verification queries
SELECT 
  molecule_key, 
  label, 
  scalar_type, 
  can_be_promotion_counter
FROM molecule_def
WHERE scalar_type = 'numeric' AND context = 'activity'
ORDER BY molecule_key;

SELECT 
  promotion_code,
  count_type,
  counter_molecule_id,
  goal_amount
FROM promotion
ORDER BY promotion_id;
