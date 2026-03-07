-- Remove is_restricted column from point_type (not needed - redemption rules handle this)
ALTER TABLE point_type DROP COLUMN IF EXISTS is_restricted;
