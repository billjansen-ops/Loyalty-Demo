-- Wipe All Activity/Accrual Data - Keep Configuration
-- This removes all transactional data but preserves configuration
-- Run with: psql loyalty_platform -f wipe_data.sql

BEGIN;

-- 1. Delete bonuses awarded to activities
DELETE FROM activity_bonus;
RAISE NOTICE 'Deleted activity bonuses';

-- 2. Delete activity molecule details
DELETE FROM activity_detail;
RAISE NOTICE 'Deleted activity details';

-- 3. Delete activities
DELETE FROM activity;
RAISE NOTICE 'Deleted activities';

-- 4. Delete point lots (accruals)
DELETE FROM point_lot;
RAISE NOTICE 'Deleted point lots';

-- 5. Reset member balance to zero
UPDATE member_balance SET balance = 0;
RAISE NOTICE 'Reset member balances to zero';

-- 6. Reset sequences so IDs start from 1
ALTER SEQUENCE activity_activity_id_seq RESTART WITH 1;
ALTER SEQUENCE activity_bonus_activity_bonus_id_seq RESTART WITH 1;
ALTER SEQUENCE point_lot_lot_id_seq RESTART WITH 1;
RAISE NOTICE 'Reset ID sequences';

-- Verify everything is clean
SELECT 'Activities' as table_name, COUNT(*) as count FROM activity
UNION ALL
SELECT 'Activity Details', COUNT(*) FROM activity_detail
UNION ALL
SELECT 'Activity Bonuses', COUNT(*) FROM activity_bonus
UNION ALL
SELECT 'Point Lots', COUNT(*) FROM point_lot
UNION ALL
SELECT 'Member Balance Total', COALESCE(SUM(balance), 0) FROM member_balance;

-- Show what's preserved
SELECT '=== PRESERVED CONFIGURATION ===' as separator;

SELECT 'Molecules' as config, COUNT(*) as count FROM molecule_def
UNION ALL
SELECT 'Bonuses', COUNT(*) FROM bonus
UNION ALL
SELECT 'Display Templates', COUNT(*) FROM display_template
UNION ALL
SELECT 'Members', COUNT(*) FROM member
UNION ALL
SELECT 'Airports', COUNT(*) FROM airport
UNION ALL
SELECT 'Carriers', COUNT(*) FROM carrier;

COMMIT;

RAISE NOTICE 'Wipe complete! All transactional data deleted, configuration preserved.';
