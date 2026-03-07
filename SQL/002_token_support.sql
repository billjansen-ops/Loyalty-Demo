-- ============================================================================
-- TOKEN SUPPORT - Schema Changes
-- ============================================================================
-- Adds adjustment_type column to distinguish adjustments from tokens
-- Adds counter_token_adjustment_id to promotion for token counting
-- Updates count_type constraint to include 'tokens'
-- ============================================================================

-- Step 1: Add adjustment_type column to adjustment table
ALTER TABLE adjustment ADD COLUMN IF NOT EXISTS adjustment_type CHAR(1) DEFAULT 'A'
  CHECK (adjustment_type IN ('A', 'T'));

COMMENT ON COLUMN adjustment.adjustment_type IS 'A=Adjustment (points), T=Token (countable, zero-point)';

-- Step 2: Add counter_token_adjustment_id to promotion table
ALTER TABLE promotion ADD COLUMN IF NOT EXISTS counter_token_adjustment_id INTEGER
  REFERENCES adjustment(adjustment_id);

COMMENT ON COLUMN promotion.counter_token_adjustment_id IS 'For count_type=tokens, which token adjustment to count';

-- Step 3: Update count_type constraint to include 'tokens'
ALTER TABLE promotion DROP CONSTRAINT IF EXISTS promotion_count_type_check;
ALTER TABLE promotion ADD CONSTRAINT promotion_count_type_check 
  CHECK (count_type IN ('flights', 'miles', 'enrollments', 'molecules', 'tokens'));

-- Step 4: Add constraint for token counter (similar to molecule counter)
ALTER TABLE promotion ADD CONSTRAINT promotion_token_counter_required 
  CHECK (
    ((count_type = 'tokens' AND counter_token_adjustment_id IS NOT NULL) OR
     (count_type != 'tokens' AND counter_token_adjustment_id IS NULL))
  );

-- Step 5: Verify changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'adjustment' AND column_name = 'adjustment_type';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'promotion' AND column_name = 'counter_token_adjustment_id';

\d promotion
