-- ============================================================================
-- TOKEN SUPPORT - Schema Changes (REVISED)
-- ============================================================================
-- Expand adjustment_type to include T for Token
-- Tokens are zero-point countable adjustments
-- ============================================================================

-- Step 1: Drop existing constraints
ALTER TABLE adjustment DROP CONSTRAINT IF EXISTS adjustment_adjustment_type_check;
ALTER TABLE adjustment DROP CONSTRAINT IF EXISTS adjustment_fixed_points_check;

-- Step 2: Add expanded constraint for adjustment_type (F/V/T)
ALTER TABLE adjustment ADD CONSTRAINT adjustment_adjustment_type_check 
  CHECK (adjustment_type IN ('F', 'V', 'T'));

-- Step 3: Add constraint for fixed_points based on type
-- F = must have fixed_points > 0
-- V = must have fixed_points NULL
-- T = must have fixed_points = 0 or NULL
ALTER TABLE adjustment ADD CONSTRAINT adjustment_fixed_points_check 
  CHECK (
    (adjustment_type = 'F' AND fixed_points IS NOT NULL AND fixed_points > 0) OR
    (adjustment_type = 'V' AND fixed_points IS NULL) OR
    (adjustment_type = 'T' AND (fixed_points IS NULL OR fixed_points = 0))
  );

-- Step 4: Update comment
COMMENT ON COLUMN adjustment.adjustment_type IS 'F=Fixed amount, V=Variable amount, T=Token (zero-point countable)';

-- Verify
SELECT adjustment_id, adjustment_code, adjustment_name, adjustment_type, fixed_points
FROM adjustment LIMIT 5;
