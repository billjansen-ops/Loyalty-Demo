-- Migration: Create new molecule storage tables
-- Date: 2025-12-02

-- ===========================================
-- ACTIVITY DETAIL TABLES (base 1-5)
-- ===========================================

-- activity_detail_1: CHAR(1) values (127 max)
CREATE TABLE activity_detail_1 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_1 CHAR(1)
);
CREATE INDEX idx_activity_detail_1_plink ON activity_detail_1(p_link);
CREATE INDEX idx_activity_detail_1_mol ON activity_detail_1(p_link, molecule_id);

-- activity_detail_2: SMALLINT values (65K max)
CREATE TABLE activity_detail_2 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_2 SMALLINT
);
CREATE INDEX idx_activity_detail_2_plink ON activity_detail_2(p_link);
CREATE INDEX idx_activity_detail_2_mol ON activity_detail_2(p_link, molecule_id);

-- activity_detail_3: CHAR(3) values (2M max)
CREATE TABLE activity_detail_3 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_3 CHAR(3)
);
CREATE INDEX idx_activity_detail_3_plink ON activity_detail_3(p_link);
CREATE INDEX idx_activity_detail_3_mol ON activity_detail_3(p_link, molecule_id);

-- activity_detail_4: INTEGER values (4B max)
CREATE TABLE activity_detail_4 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_4 INTEGER
);
CREATE INDEX idx_activity_detail_4_plink ON activity_detail_4(p_link);
CREATE INDEX idx_activity_detail_4_mol ON activity_detail_4(p_link, molecule_id);

-- activity_detail_5: CHAR(5) values (33B max)
CREATE TABLE activity_detail_5 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_5 CHAR(5)
);
CREATE INDEX idx_activity_detail_5_plink ON activity_detail_5(p_link);
CREATE INDEX idx_activity_detail_5_mol ON activity_detail_5(p_link, molecule_id);

-- activity_detail_54: CHAR(5) + INTEGER (member_points)
CREATE TABLE activity_detail_54 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_5 CHAR(5),
  col_4 INTEGER
);
CREATE INDEX idx_activity_detail_54_plink ON activity_detail_54(p_link);
CREATE INDEX idx_activity_detail_54_mol ON activity_detail_54(p_link, molecule_id);

-- ===========================================
-- MEMBER DETAIL TABLES (base 1-5)
-- ===========================================

-- member_detail_1: CHAR(1) values
CREATE TABLE member_detail_1 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_1 CHAR(1)
);
CREATE INDEX idx_member_detail_1_plink ON member_detail_1(p_link);
CREATE INDEX idx_member_detail_1_mol ON member_detail_1(p_link, molecule_id);

-- member_detail_2: SMALLINT values
CREATE TABLE member_detail_2 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_2 SMALLINT
);
CREATE INDEX idx_member_detail_2_plink ON member_detail_2(p_link);
CREATE INDEX idx_member_detail_2_mol ON member_detail_2(p_link, molecule_id);

-- member_detail_3: CHAR(3) values
CREATE TABLE member_detail_3 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_3 CHAR(3)
);
CREATE INDEX idx_member_detail_3_plink ON member_detail_3(p_link);
CREATE INDEX idx_member_detail_3_mol ON member_detail_3(p_link, molecule_id);

-- member_detail_4: INTEGER values
CREATE TABLE member_detail_4 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_4 INTEGER
);
CREATE INDEX idx_member_detail_4_plink ON member_detail_4(p_link);
CREATE INDEX idx_member_detail_4_mol ON member_detail_4(p_link, molecule_id);

-- member_detail_5: CHAR(5) values
CREATE TABLE member_detail_5 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_5 CHAR(5)
);
CREATE INDEX idx_member_detail_5_plink ON member_detail_5(p_link);
CREATE INDEX idx_member_detail_5_mol ON member_detail_5(p_link, molecule_id);

-- member_detail_2244: SMALLINT + SMALLINT + INTEGER + INTEGER (member_point_bucket)
CREATE TABLE member_detail_2244 (
  p_link CHAR(5) NOT NULL,
  molecule_id INTEGER NOT NULL,
  col_2a SMALLINT,
  col_2b SMALLINT,
  col_4a INTEGER,
  col_4b INTEGER
);
CREATE INDEX idx_member_detail_2244_plink ON member_detail_2244(p_link);
CREATE INDEX idx_member_detail_2244_mol ON member_detail_2244(p_link, molecule_id);
