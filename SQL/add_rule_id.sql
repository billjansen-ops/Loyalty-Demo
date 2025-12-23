-- Add numeric rule_id to point_expiration_rule
ALTER TABLE point_expiration_rule ADD COLUMN rule_id SERIAL UNIQUE;

-- Verify
SELECT rule_id, rule_key, expiration_date FROM point_expiration_rule ORDER BY rule_id;
