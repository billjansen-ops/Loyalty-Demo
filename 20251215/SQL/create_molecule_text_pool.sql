-- ============================================================================
-- MOLECULE TEXT POOL MIGRATION
-- ============================================================================
-- Creates the text pooling table for efficient text molecule storage
-- Enables deduplication and pure-integer child records
-- ============================================================================

-- Create the text pool table
CREATE TABLE IF NOT EXISTS molecule_text_pool (
  text_id SERIAL PRIMARY KEY,
  text_value VARCHAR(1000) NOT NULL,
  usage_count INTEGER DEFAULT 1,
  first_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index for deduplication and fast encode lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_text_pool_value 
ON molecule_text_pool(text_value);

-- Add decimal_places to molecule_def for numeric precision
ALTER TABLE molecule_def 
ADD COLUMN IF NOT EXISTS decimal_places SMALLINT DEFAULT 0;

-- Add comments for documentation
COMMENT ON TABLE molecule_text_pool IS 'Deduplicated text storage pool for text-type molecules';
COMMENT ON COLUMN molecule_text_pool.text_id IS 'Integer ID stored in child records - keeps records pure integers';
COMMENT ON COLUMN molecule_text_pool.text_value IS 'Actual text value (max 1000 chars, database-portable)';
COMMENT ON COLUMN molecule_text_pool.usage_count IS 'Number of times this text is referenced - for analytics';
COMMENT ON COLUMN molecule_text_pool.first_used IS 'When this text value was first stored';
COMMENT ON COLUMN molecule_def.decimal_places IS 'Number of decimal places for numeric molecules (0 for integers, 2 for currency, etc.)';

-- Verify the creation
SELECT 'molecule_text_pool table created' as status;
SELECT COUNT(*) as existing_text_entries FROM molecule_text_pool;
