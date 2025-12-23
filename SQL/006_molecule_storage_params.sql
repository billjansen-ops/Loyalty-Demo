-- Migration: Add storage parameters to molecule_def
-- Date: 2025-12-02

-- ===========================================
-- ADD COLUMNS TO molecule_def
-- ===========================================

ALTER TABLE molecule_def ADD COLUMN storage_size SMALLINT;
ALTER TABLE molecule_def ADD COLUMN value_type VARCHAR(10);
ALTER TABLE molecule_def ADD COLUMN storage_table VARCHAR(30);

-- ===========================================
-- UPDATE ACTIVITY-CONTEXT MOLECULES
-- ===========================================

-- carrier: 2-byte key to carrier table
UPDATE molecule_def SET storage_size = 2, value_type = 'key', storage_table = 'activity_detail_2'
WHERE molecule_key = 'carrier' AND tenant_id = 1;

-- destination: 2-byte key to airport table
UPDATE molecule_def SET storage_size = 2, value_type = 'key', storage_table = 'activity_detail_2'
WHERE molecule_key = 'destination' AND tenant_id = 1;

-- origin: 2-byte key to airport table
UPDATE molecule_def SET storage_size = 2, value_type = 'key', storage_table = 'activity_detail_2'
WHERE molecule_key = 'origin' AND tenant_id = 1;

-- fare_class: 1-byte key (internal list, <50 values)
UPDATE molecule_def SET storage_size = 1, value_type = 'key', storage_table = 'activity_detail_1'
WHERE molecule_key = 'fare_class' AND tenant_id = 1;

-- flight_number: 2-byte code (0-9999)
UPDATE molecule_def SET storage_size = 2, value_type = 'code', storage_table = 'activity_detail_2'
WHERE molecule_key = 'flight_number' AND tenant_id = 1;

-- mqd: 4-byte numeric (dollar amounts)
UPDATE molecule_def SET storage_size = 4, value_type = 'numeric', storage_table = 'activity_detail_4'
WHERE molecule_key = 'mqd' AND tenant_id = 1;

-- bonus_activity_id: 5-byte link to activity.link
UPDATE molecule_def SET storage_size = 5, value_type = 'link', storage_table = 'activity_detail_5'
WHERE molecule_key = 'bonus_activity_id' AND tenant_id = 1;

-- bonus_rule_id: 2-byte key to bonus table
UPDATE molecule_def SET storage_size = 2, value_type = 'key', storage_table = 'activity_detail_2'
WHERE molecule_key = 'bonus_rule_id' AND tenant_id = 1;

-- partner: 2-byte key to partner table
UPDATE molecule_def SET storage_size = 2, value_type = 'key', storage_table = 'activity_detail_2'
WHERE molecule_key = 'partner' AND tenant_id = 1;

-- partner_program: 2-byte key to partner_program table
UPDATE molecule_def SET storage_size = 2, value_type = 'key', storage_table = 'activity_detail_2'
WHERE molecule_key = 'partner_program' AND tenant_id = 1;

-- adjustment: 2-byte key to adjustment table
UPDATE molecule_def SET storage_size = 2, value_type = 'key', storage_table = 'activity_detail_2'
WHERE molecule_key = 'adjustment' AND tenant_id = 1;

-- member_promotion: 4-byte key (many enrollments possible)
UPDATE molecule_def SET storage_size = 4, value_type = 'key', storage_table = 'activity_detail_4'
WHERE molecule_key = 'member_promotion' AND tenant_id = 1;

-- promotion: 2-byte key to promotion table
UPDATE molecule_def SET storage_size = 2, value_type = 'key', storage_table = 'activity_detail_2'
WHERE molecule_key = 'promotion' AND tenant_id = 1;

-- redemption_type: 2-byte key to redemption_rule table
UPDATE molecule_def SET storage_size = 2, value_type = 'key', storage_table = 'activity_detail_2'
WHERE molecule_key = 'redemption_type' AND tenant_id = 1;

-- member_points: composite (bucket_link CHAR(5) + amount INTEGER)
UPDATE molecule_def SET storage_size = 54, value_type = 'composite', storage_table = 'activity_detail_54'
WHERE molecule_key = 'member_points' AND tenant_id = 1;

-- ===========================================
-- UPDATE MEMBER-CONTEXT MOLECULES
-- ===========================================

-- member_point_bucket: composite (rule_id + expire_date + accrued + redeemed)
UPDATE molecule_def SET storage_size = 2244, value_type = 'composite', storage_table = 'member_detail_2244'
WHERE molecule_key = 'member_point_bucket' AND tenant_id = 1;

-- tier: 1-byte key (<10 tier levels)
UPDATE molecule_def SET storage_size = 1, value_type = 'key', storage_table = 'member_detail_1'
WHERE molecule_key = 'tier' AND tenant_id = 1;

-- ===========================================
-- VERIFY
-- ===========================================
-- SELECT molecule_key, storage_size, value_type, storage_table FROM molecule_def WHERE storage_size IS NOT NULL ORDER BY molecule_key;
