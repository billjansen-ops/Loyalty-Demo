-- Redemption statistics table for daily tracking
-- Mirrors bonus_stats pattern

CREATE TABLE redemption_stats (
    redemption_id INTEGER NOT NULL,
    tenant_id SMALLINT NOT NULL,
    stat_date SMALLINT NOT NULL,
    redeemed_count INTEGER DEFAULT 0 NOT NULL,
    points_total BIGINT DEFAULT 0 NOT NULL,
    PRIMARY KEY (redemption_id, tenant_id, stat_date)
);

COMMENT ON TABLE redemption_stats IS 'Daily redemption statistics for reporting';
COMMENT ON COLUMN redemption_stats.stat_date IS 'Date as SMALLINT using date_to_molecule_int()';
COMMENT ON COLUMN redemption_stats.redeemed_count IS 'Number of redemptions on this date';
COMMENT ON COLUMN redemption_stats.points_total IS 'Total points redeemed on this date';

-- Index for efficient date range queries
CREATE INDEX idx_redemption_stats_date ON redemption_stats (tenant_id, stat_date);

-- Verify
SELECT 'redemption_stats table created' as status;
