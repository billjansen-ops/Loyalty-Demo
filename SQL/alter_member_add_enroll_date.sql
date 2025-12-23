-- Add enroll_date column to member table
-- Uses SMALLINT (2 bytes) storing days since 1959-12-03 (Bill epoch)
-- Dec 3, 2025 = 24107

ALTER TABLE member ADD COLUMN enroll_date SMALLINT;

COMMENT ON COLUMN member.enroll_date IS 'Enrollment date as days since 1959-12-03';

-- Set all existing members to Dec 3, 2025 (24107)
UPDATE member SET enroll_date = 24107;

-- Verify
SELECT membership_number, fname, lname, enroll_date 
FROM member 
LIMIT 5;
