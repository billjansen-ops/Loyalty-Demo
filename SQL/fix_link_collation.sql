-- Fix link/p_link column collation for proper byte-order sorting
-- Run this script 3 times, once per database:
--   psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/fix_link_collation.sql
--   psql -h 127.0.0.1 -U billjansen -d loyaltytest -f SQL/fix_link_collation.sql
--   psql -h 127.0.0.1 -U billjansen -d loyaltybackup -f SQL/fix_link_collation.sql

\echo '=== Fixing link/p_link collation to "C" for byte-order sorting ==='
\echo ''

-- 5_data tables (all have p_link CHAR(5))
\echo 'Fixing 5_data_1...'
ALTER TABLE "5_data_1" ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

\echo 'Fixing 5_data_2...'
ALTER TABLE "5_data_2" ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

\echo 'Fixing 5_data_2244...'
ALTER TABLE "5_data_2244" ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

\echo 'Fixing 5_data_3...'
ALTER TABLE "5_data_3" ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

\echo 'Fixing 5_data_4...'
ALTER TABLE "5_data_4" ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

\echo 'Fixing 5_data_5...'
ALTER TABLE "5_data_5" ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

\echo 'Fixing 5_data_54...'
ALTER TABLE "5_data_54" ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

-- activity table
\echo 'Fixing activity...'
ALTER TABLE activity ALTER COLUMN link TYPE CHAR(5) COLLATE "C";
ALTER TABLE activity ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

-- member table
\echo 'Fixing member...'
ALTER TABLE member ALTER COLUMN link TYPE CHAR(5) COLLATE "C";

-- member_point_bucket table
\echo 'Fixing member_point_bucket...'
ALTER TABLE member_point_bucket ALTER COLUMN link TYPE CHAR(5) COLLATE "C";
ALTER TABLE member_point_bucket ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

-- member_promotion table
\echo 'Fixing member_promotion...'
ALTER TABLE member_promotion ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

-- member_promotion_detail table
\echo 'Fixing member_promotion_detail...'
ALTER TABLE member_promotion_detail ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

-- member_tier table
\echo 'Fixing member_tier...'
ALTER TABLE member_tier ALTER COLUMN p_link TYPE CHAR(5) COLLATE "C";

-- molecule_value_embedded_list table (CHAR(1))
\echo 'Fixing molecule_value_embedded_list...'
ALTER TABLE molecule_value_embedded_list ALTER COLUMN link TYPE CHAR(1) COLLATE "C";

\echo ''
\echo '=== Reindexing tables ==='

\echo 'Reindexing 5_data tables...'
REINDEX TABLE "5_data_1";
REINDEX TABLE "5_data_2";
REINDEX TABLE "5_data_2244";
REINDEX TABLE "5_data_3";
REINDEX TABLE "5_data_4";
REINDEX TABLE "5_data_5";
REINDEX TABLE "5_data_54";

\echo 'Reindexing activity...'
REINDEX TABLE activity;

\echo 'Reindexing member...'
REINDEX TABLE member;

\echo 'Reindexing member_point_bucket...'
REINDEX TABLE member_point_bucket;

\echo 'Reindexing member_promotion...'
REINDEX TABLE member_promotion;

\echo 'Reindexing member_promotion_detail...'
REINDEX TABLE member_promotion_detail;

\echo 'Reindexing member_tier...'
REINDEX TABLE member_tier;

\echo 'Reindexing molecule_value_embedded_list...'
REINDEX TABLE molecule_value_embedded_list;

\echo ''
\echo '=== Done! ==='
