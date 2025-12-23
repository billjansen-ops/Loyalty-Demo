-- Remove required_tier_id column from bonus table
-- This field is obsolete - tier checking is now done via functional molecules
-- Date: 2025-11-14

ALTER TABLE bonus DROP COLUMN IF EXISTS required_tier_id;

-- Verify
\d bonus
