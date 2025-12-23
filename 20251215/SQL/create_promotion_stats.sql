-- Promotion statistics table for daily tracking
-- Mirrors bonus_stats pattern

CREATE TABLE promotion_stats (
    promotion_id INTEGER NOT NULL,
    tenant_id SMALLINT NOT NULL,
    stat_date SMALLINT NOT NULL,
    enrolled_count INTEGER DEFAULT 0 NOT NULL,
    qualified_count INTEGER DEFAULT 0 NOT NULL,
    points_total BIGINT DEFAULT 0 NOT NULL,
    PRIMARY KEY (promotion_id, tenant_id, stat_date)
);

COMMENT ON TABLE promotion_stats IS 'Daily promotion statistics for reporting';
COMMENT ON COLUMN promotion_stats.stat_date IS 'Date as SMALLINT using date_to_molecule_int()';
COMMENT ON COLUMN promotion_stats.enrolled_count IS 'Number of enrollments on this date';
COMMENT ON COLUMN promotion_stats.qualified_count IS 'Number of qualifications on this date';
COMMENT ON COLUMN promotion_stats.points_total IS 'Total points issued for qualification rewards on this date';

-- Index for efficient date range queries
CREATE INDEX idx_promotion_stats_date ON promotion_stats (tenant_id, stat_date);

-- Verify
SELECT 'promotion_stats table created' as status;
