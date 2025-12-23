-- Clean Up Script for Fresh Promotion Testing
-- Removes all activities and promotion enrollment data for clean testing

BEGIN;

-- Show what will be deleted
\echo '=== Current State Before Deletion ==='
SELECT 'Activities' as table_name, COUNT(*) as count FROM activity
UNION ALL
SELECT 'Activity Details', COUNT(*) FROM activity_detail
UNION ALL
SELECT 'Activity Bonuses', COUNT(*) FROM activity_bonus
UNION ALL
SELECT 'Member Promotions', COUNT(*) FROM member_promotion
UNION ALL
SELECT 'Member Promotion Details', COUNT(*) FROM member_promotion_detail
UNION ALL
SELECT 'Point Lots', COUNT(*) FROM point_lot
UNION ALL
SELECT 'Redemption Details', COUNT(*) FROM redemption_detail;

\echo ''
\echo '=== Deleting Data ==='

-- 1. Delete redemption details (references activities)
DELETE FROM redemption_detail;
\echo '✓ Deleted redemption_detail records'

-- 2. Delete member promotion details (references activities and member_promotions)
DELETE FROM member_promotion_detail;
\echo '✓ Deleted member_promotion_detail records'

-- 3. Delete activity bonuses (references activities)
DELETE FROM activity_bonus;
\echo '✓ Deleted activity_bonus records'

-- 4. Delete activity details (references activities)
DELETE FROM activity_detail;
\echo '✓ Deleted activity_detail records'

-- 5. Delete activities
DELETE FROM activity;
\echo '✓ Deleted activity records'

-- 6. Delete member promotions (no longer referenced)
DELETE FROM member_promotion;
\echo '✓ Deleted member_promotion records'

-- 7. Delete point lots (no longer referenced by activities)
DELETE FROM point_lot;
\echo '✓ Deleted point_lot records'

-- Reset sequences to start fresh
ALTER SEQUENCE activity_activity_id_seq RESTART WITH 1;
ALTER SEQUENCE activity_bonus_activity_bonus_id_seq RESTART WITH 1;
ALTER SEQUENCE point_lot_lot_id_seq RESTART WITH 1;
ALTER SEQUENCE member_promotion_member_promotion_id_seq RESTART WITH 1;
ALTER SEQUENCE member_promotion_detail_detail_id_seq RESTART WITH 1;
ALTER SEQUENCE redemption_detail_redemption_detail_id_seq RESTART WITH 1;
\echo '✓ Reset sequences'

\echo ''
\echo '=== Final State ==='
SELECT 'Activities' as table_name, COUNT(*) as count FROM activity
UNION ALL
SELECT 'Activity Details', COUNT(*) FROM activity_detail
UNION ALL
SELECT 'Activity Bonuses', COUNT(*) FROM activity_bonus
UNION ALL
SELECT 'Member Promotions', COUNT(*) FROM member_promotion
UNION ALL
SELECT 'Member Promotion Details', COUNT(*) FROM member_promotion_detail
UNION ALL
SELECT 'Point Lots', COUNT(*) FROM point_lot
UNION ALL
SELECT 'Redemption Details', COUNT(*) FROM redemption_detail;

\echo ''
\echo '=== CLEANUP COMPLETE ==='
\echo 'All transactional data deleted. Master data (members, promotions, bonuses, etc.) preserved.'
\echo 'Ready for fresh testing!'

COMMIT;
