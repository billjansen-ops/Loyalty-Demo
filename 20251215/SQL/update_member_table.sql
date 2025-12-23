-- Migration: Update member table with proper profile fields
-- Date: 2025-11-13
-- Purpose: Replace generic 'name' field with detailed profile information

-- Step 1: Add new columns
ALTER TABLE member
ADD COLUMN fname VARCHAR(50),
ADD COLUMN lname VARCHAR(50),
ADD COLUMN middle_initial CHAR(1),
ADD COLUMN address1 VARCHAR(100),
ADD COLUMN address2 VARCHAR(100),
ADD COLUMN city VARCHAR(50),
ADD COLUMN state VARCHAR(50),
ADD COLUMN zip VARCHAR(20),
ADD COLUMN phone VARCHAR(20),
ADD COLUMN email VARCHAR(100),
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Step 2: Migrate existing 'name' data to fname/lname
-- (This assumes names are in "FirstName LastName" format)
UPDATE member
SET 
  fname = SPLIT_PART(name, ' ', 1),
  lname = CASE 
    WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE ''
  END
WHERE name IS NOT NULL;

-- Step 3: Drop the old 'name' column
ALTER TABLE member DROP COLUMN name;

-- Step 4: Change member_id from BIGINT to VARCHAR(16)
-- This is a more complex change since member_id is likely a foreign key

-- First, we need to alter member_tier to match
ALTER TABLE member_tier 
ALTER COLUMN member_id TYPE VARCHAR(16);

-- Now alter the member table
ALTER TABLE member 
ALTER COLUMN member_id TYPE VARCHAR(16);

-- Step 5: Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_member_email ON member(email);
CREATE INDEX IF NOT EXISTS idx_member_lname ON member(lname);
CREATE INDEX IF NOT EXISTS idx_member_phone ON member(phone);

-- Step 6: Add comments
COMMENT ON COLUMN member.fname IS 'Member first name';
COMMENT ON COLUMN member.lname IS 'Member last name';
COMMENT ON COLUMN member.middle_initial IS 'Member middle initial';
COMMENT ON COLUMN member.email IS 'Member email address';
COMMENT ON COLUMN member.phone IS 'Member phone number';
COMMENT ON COLUMN member.is_active IS 'Whether member account is active';

-- Done!
