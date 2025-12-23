-- Migration: Add dynamic_list molecule support
-- Date: 2025-11-29

-- Add new columns to molecule_def
ALTER TABLE molecule_def 
ADD COLUMN IF NOT EXISTS list_context VARCHAR(20),
ADD COLUMN IF NOT EXISTS system_required BOOLEAN DEFAULT false;

COMMENT ON COLUMN molecule_def.list_context IS 'For dynamic_list: member or activity (which detail_list table stores the data)';
COMMENT ON COLUMN molecule_def.system_required IS 'Core platform molecule - cannot be deleted';

-- Create molecule_column_def table for defining what v1-v6 mean
CREATE TABLE IF NOT EXISTS molecule_column_def (
    column_def_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id) ON DELETE CASCADE,
    column_name VARCHAR(10) NOT NULL,  -- v1, v2, v3, v4, v5, v6
    column_type VARCHAR(20) NOT NULL,  -- ref, numeric, date, text
    column_order SMALLINT NOT NULL,
    description VARCHAR(255),
    UNIQUE(molecule_id, column_name)
);

COMMENT ON TABLE molecule_column_def IS 'Defines the meaning of generic columns (v1-v6) for dynamic_list molecules';
COMMENT ON COLUMN molecule_column_def.column_name IS 'Which generic column: v1, v2, v3, v4, v5, or v6';
COMMENT ON COLUMN molecule_column_def.column_type IS 'Data type: ref (BIGINT pointer), numeric, date, text';

-- Create member_detail_list table (replaces point_lot, member_promotion, member_tier, etc.)
CREATE TABLE IF NOT EXISTS member_detail_list (
    detail_list_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES member(member_id),
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    v1 BIGINT,         -- Generic column 1 (meaning defined by molecule)
    v2 BIGINT,         -- Generic column 2
    v3 NUMERIC,        -- Generic column 3
    v4 NUMERIC,        -- Generic column 4
    v5 DATE,           -- Generic column 5
    v6 DATE,           -- Generic column 6
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mdl_member ON member_detail_list(member_id);
CREATE INDEX IF NOT EXISTS idx_mdl_member_molecule ON member_detail_list(member_id, molecule_id);
CREATE INDEX IF NOT EXISTS idx_mdl_expire ON member_detail_list(v5) WHERE v5 IS NOT NULL;

COMMENT ON TABLE member_detail_list IS 'Multi-row member state: point buckets, promo enrollments, tier status, etc.';

-- Create activity_detail_list table (replaces redemption_detail, member_promotion_detail, activity.point_amount/lot_id)
CREATE TABLE IF NOT EXISTS activity_detail_list (
    detail_list_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(activity_id),
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    v1 BIGINT,         -- Generic column 1 (typically bucket_id pointer)
    v2 NUMERIC,        -- Generic column 2 (typically amount)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adl_activity ON activity_detail_list(activity_id);
CREATE INDEX IF NOT EXISTS idx_adl_bucket ON activity_detail_list(v1);

COMMENT ON TABLE activity_detail_list IS 'Multi-row activity relationships: points earned/redeemed, promo contributions, etc.';
