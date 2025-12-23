-- Redemption Detail Table
-- Tracks which point lots were used for each redemption activity

CREATE TABLE redemption_detail (
    redemption_detail_id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(activity_id) ON DELETE CASCADE,
    lot_id BIGINT NOT NULL REFERENCES point_lot(lot_id),
    points_used INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quickly finding all lots used in a redemption
CREATE INDEX redemption_detail_activity_idx ON redemption_detail(activity_id);

-- Index for finding all redemptions that used a specific lot
CREATE INDEX redemption_detail_lot_idx ON redemption_detail(lot_id);

COMMENT ON TABLE redemption_detail IS 'Junction table showing which point lots funded each redemption activity';
COMMENT ON COLUMN redemption_detail.activity_id IS 'The redemption activity record';
COMMENT ON COLUMN redemption_detail.lot_id IS 'The point lot (bucket) points were taken from';
COMMENT ON COLUMN redemption_detail.points_used IS 'How many points were taken from this lot for this redemption';
