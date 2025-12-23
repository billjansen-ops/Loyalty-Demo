-- Add auto-increment sequence for member_id

-- Create sequence starting after current max
CREATE SEQUENCE IF NOT EXISTS member_member_id_seq;
SELECT setval('member_member_id_seq', COALESCE((SELECT MAX(member_id) FROM member), 0));

-- Set default for member_id column
ALTER TABLE member ALTER COLUMN member_id SET DEFAULT nextval('member_member_id_seq');

-- Verify
SELECT currval('member_member_id_seq') as current_value;
\d member
