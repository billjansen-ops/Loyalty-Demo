-- migrate_to_unified_data_tables.sql
-- Converts activity_detail_* and member_detail_* to unified 5_data_* pattern
-- Date: 2025-12-06

BEGIN;

-- ============================================================
-- STEP 1: Add attaches_to column to activity_detail tables
-- ============================================================

ALTER TABLE activity_detail_1 ADD COLUMN attaches_to CHAR(1) NOT NULL DEFAULT 'A';
ALTER TABLE activity_detail_2 ADD COLUMN attaches_to CHAR(1) NOT NULL DEFAULT 'A';
ALTER TABLE activity_detail_3 ADD COLUMN attaches_to CHAR(1) NOT NULL DEFAULT 'A';
ALTER TABLE activity_detail_4 ADD COLUMN attaches_to CHAR(1) NOT NULL DEFAULT 'A';
ALTER TABLE activity_detail_5 ADD COLUMN attaches_to CHAR(1) NOT NULL DEFAULT 'A';
ALTER TABLE activity_detail_54 ADD COLUMN attaches_to CHAR(1) NOT NULL DEFAULT 'A';

-- ============================================================
-- STEP 2: Rename activity_detail tables to 5_data_*
-- ============================================================

ALTER TABLE activity_detail_1 RENAME TO "5_data_1";
ALTER TABLE activity_detail_2 RENAME TO "5_data_2";
ALTER TABLE activity_detail_3 RENAME TO "5_data_3";
ALTER TABLE activity_detail_4 RENAME TO "5_data_4";
ALTER TABLE activity_detail_5 RENAME TO "5_data_5";
ALTER TABLE activity_detail_54 RENAME TO "5_data_54";

-- ============================================================
-- STEP 3: Rename indexes to match new table names
-- ============================================================

ALTER INDEX idx_activity_detail_1_mol RENAME TO idx_5_data_1_mol;
ALTER INDEX idx_activity_detail_1_plink RENAME TO idx_5_data_1_plink;
ALTER INDEX idx_activity_detail_2_mol RENAME TO idx_5_data_2_mol;
ALTER INDEX idx_activity_detail_2_plink RENAME TO idx_5_data_2_plink;
ALTER INDEX idx_activity_detail_3_mol RENAME TO idx_5_data_3_mol;
ALTER INDEX idx_activity_detail_3_plink RENAME TO idx_5_data_3_plink;
ALTER INDEX idx_activity_detail_4_mol RENAME TO idx_5_data_4_mol;
ALTER INDEX idx_activity_detail_4_plink RENAME TO idx_5_data_4_plink;
ALTER INDEX idx_activity_detail_5_mol RENAME TO idx_5_data_5_mol;
ALTER INDEX idx_activity_detail_5_plink RENAME TO idx_5_data_5_plink;
ALTER INDEX idx_activity_detail_54_mol RENAME TO idx_5_data_54_mol;
ALTER INDEX idx_activity_detail_54_plink RENAME TO idx_5_data_54_plink;

-- ============================================================
-- STEP 4: Create 5_data_2244 and migrate member data
-- ============================================================

CREATE TABLE "5_data_2244" (
    p_link character(5) NOT NULL,
    attaches_to CHAR(1) NOT NULL DEFAULT 'M',
    molecule_id integer NOT NULL,
    n1 smallint,
    n2 smallint,
    n3 integer,
    n4 integer,
    detail_id bigint GENERATED ALWAYS AS IDENTITY
);

-- Migrate data from member_detail_2244
INSERT INTO "5_data_2244" (p_link, attaches_to, molecule_id, n1, n2, n3, n4)
SELECT p_link, 'M', molecule_id, n1, n2, n3, n4
FROM member_detail_2244;

-- Create indexes on new table
CREATE INDEX idx_5_data_2244_mol ON "5_data_2244" USING btree (p_link, molecule_id);
CREATE INDEX idx_5_data_2244_plink ON "5_data_2244" USING btree (p_link);
CREATE INDEX idx_5_data_2244_attaches ON "5_data_2244" USING btree (attaches_to, p_link);

-- ============================================================
-- STEP 5: Add attaches_to index to other tables
-- ============================================================

CREATE INDEX idx_5_data_1_attaches ON "5_data_1" USING btree (attaches_to, p_link);
CREATE INDEX idx_5_data_2_attaches ON "5_data_2" USING btree (attaches_to, p_link);
CREATE INDEX idx_5_data_3_attaches ON "5_data_3" USING btree (attaches_to, p_link);
CREATE INDEX idx_5_data_4_attaches ON "5_data_4" USING btree (attaches_to, p_link);
CREATE INDEX idx_5_data_5_attaches ON "5_data_5" USING btree (attaches_to, p_link);
CREATE INDEX idx_5_data_54_attaches ON "5_data_54" USING btree (attaches_to, p_link);

-- ============================================================
-- STEP 6: Update molecule_def - add attaches_to column
-- ============================================================

ALTER TABLE molecule_def ADD COLUMN attaches_to VARCHAR(10);

-- Populate from context
UPDATE molecule_def SET attaches_to = 'A' WHERE context = 'activity';
UPDATE molecule_def SET attaches_to = 'M' WHERE context = 'member';
UPDATE molecule_def SET attaches_to = 'S' WHERE context IN ('system', 'tenant', 'program');

-- ============================================================
-- STEP 7: Drop old tables (empty member_detail_* and old activity_detail)
-- ============================================================

DROP TABLE IF EXISTS member_detail_1;
DROP TABLE IF EXISTS member_detail_2;
DROP TABLE IF EXISTS member_detail_3;
DROP TABLE IF EXISTS member_detail_4;
DROP TABLE IF EXISTS member_detail_5;
DROP TABLE IF EXISTS member_detail_2244;
DROP TABLE IF EXISTS activity_detail;

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

SELECT '5_data_1' as table_name, COUNT(*) as rows FROM "5_data_1"
UNION ALL SELECT '5_data_2', COUNT(*) FROM "5_data_2"
UNION ALL SELECT '5_data_3', COUNT(*) FROM "5_data_3"
UNION ALL SELECT '5_data_4', COUNT(*) FROM "5_data_4"
UNION ALL SELECT '5_data_5', COUNT(*) FROM "5_data_5"
UNION ALL SELECT '5_data_54', COUNT(*) FROM "5_data_54"
UNION ALL SELECT '5_data_2244', COUNT(*) FROM "5_data_2244";

SELECT attaches_to, COUNT(*) FROM molecule_def GROUP BY attaches_to;
