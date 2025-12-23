-- RESET TEST DATA
-- Run this to clear all member activity and point data

-- 1. Clear activity molecule data (all detail tables)
DELETE FROM activity_detail_1;
DELETE FROM activity_detail_2;
DELETE FROM activity_detail_3;
DELETE FROM activity_detail_4;
DELETE FROM activity_detail_5;
DELETE FROM activity_detail_54;
DELETE FROM activity_detail;

-- 2. Clear activities
DELETE FROM activity;

-- 3. Clear member point buckets
DELETE FROM member_detail_2244;

-- 4. Clear member promotions
DELETE FROM member_promotion_detail;
DELETE FROM member_promotion;

-- 5. Reset sequences
ALTER SEQUENCE activity_activity_id_seq RESTART WITH 1;
ALTER SEQUENCE member_promotion_member_promotion_id_seq RESTART WITH 1;

-- Verify
SELECT 'activity' as table_name, count(*) as rows FROM activity
UNION ALL SELECT 'member_detail_2244', count(*) FROM member_detail_2244
UNION ALL SELECT 'member_promotion', count(*) FROM member_promotion
UNION ALL SELECT 'member_promotion_detail', count(*) FROM member_promotion_detail;
