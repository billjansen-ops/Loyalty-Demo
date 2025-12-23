-- Migration: Rename molecule storage columns to consistent N/C convention
-- Date: 2025-12-03
-- 
-- Convention:
--   N1, N2, N3... = Numeric columns (SMALLINT for 2-byte, INTEGER for 4-byte)
--   C1, C2, C3... = Character columns (CHAR(1), CHAR(3), CHAR(5))
--
-- Pattern string determines column order and types:
--   "2" → N1 (SMALLINT)
--   "4" → N1 (INTEGER)  
--   "5" → C1 (CHAR(5))
--   "54" → C1 (CHAR(5)), N1 (INTEGER)
--   "2244" → N1 (SMALLINT), N2 (SMALLINT), N3 (INTEGER), N4 (INTEGER)

BEGIN;

-- ============================================
-- Activity Detail Tables (Single Column)
-- ============================================

-- activity_detail_1: CHAR(1) → C1
ALTER TABLE activity_detail_1 RENAME COLUMN col_1 TO C1;

-- activity_detail_2: SMALLINT → N1
ALTER TABLE activity_detail_2 RENAME COLUMN col_2 TO N1;

-- activity_detail_3: CHAR(3) → C1
ALTER TABLE activity_detail_3 RENAME COLUMN col_3 TO C1;

-- activity_detail_4: INTEGER → N1
ALTER TABLE activity_detail_4 RENAME COLUMN col_4 TO N1;

-- activity_detail_5: CHAR(5) → C1
ALTER TABLE activity_detail_5 RENAME COLUMN col_5 TO C1;

-- ============================================
-- Activity Detail Tables (Composite)
-- ============================================

-- activity_detail_54: CHAR(5) + INTEGER → C1, N1
ALTER TABLE activity_detail_54 RENAME COLUMN col_5 TO C1;
ALTER TABLE activity_detail_54 RENAME COLUMN col_4 TO N1;

-- ============================================
-- Member Detail Tables (Single Column)
-- ============================================

-- member_detail_1: CHAR(1) → C1
ALTER TABLE member_detail_1 RENAME COLUMN col_1 TO C1;

-- member_detail_2: SMALLINT → N1
ALTER TABLE member_detail_2 RENAME COLUMN col_2 TO N1;

-- member_detail_3: CHAR(3) → C1
ALTER TABLE member_detail_3 RENAME COLUMN col_3 TO C1;

-- member_detail_4: INTEGER → N1
ALTER TABLE member_detail_4 RENAME COLUMN col_4 TO N1;

-- member_detail_5: CHAR(5) → C1
ALTER TABLE member_detail_5 RENAME COLUMN col_5 TO C1;

-- ============================================
-- Member Detail Tables (Composite)
-- ============================================

-- member_detail_2244: 2+2+4+4 → N1, N2, N3, N4
ALTER TABLE member_detail_2244 RENAME COLUMN col_2a TO N1;
ALTER TABLE member_detail_2244 RENAME COLUMN col_2b TO N2;
ALTER TABLE member_detail_2244 RENAME COLUMN col_4a TO N3;
ALTER TABLE member_detail_2244 RENAME COLUMN col_4b TO N4;

-- ============================================
-- Drop storage_table from molecule_def
-- (Table name now derived from context + storage_size)
-- ============================================

ALTER TABLE molecule_def DROP COLUMN IF EXISTS storage_table;

COMMIT;

-- Verification queries
SELECT 'activity_detail_1' as table_name, column_name 
FROM information_schema.columns 
WHERE table_name = 'activity_detail_1' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'activity_detail_54' as table_name, column_name 
FROM information_schema.columns 
WHERE table_name = 'activity_detail_54' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'member_detail_2244' as table_name, column_name 
FROM information_schema.columns 
WHERE table_name = 'member_detail_2244' AND table_schema = 'public'
ORDER BY ordinal_position;
