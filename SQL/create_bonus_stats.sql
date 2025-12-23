-- Bonus Statistics Table
-- Tracks daily bonus issuance for fast reporting
-- Created: 2025-12-10

CREATE TABLE IF NOT EXISTS bonus_stats (
  bonus_id INTEGER NOT NULL REFERENCES bonus(bonus_id),
  tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
  stat_date SMALLINT NOT NULL,  -- Days since 1959-12-03 (Bill epoch)
  issued_count INTEGER NOT NULL DEFAULT 0,
  points_total BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (bonus_id, tenant_id, stat_date)
);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_bonus_stats_tenant_date 
  ON bonus_stats(tenant_id, stat_date);

-- Index for bonus lookups
CREATE INDEX IF NOT EXISTS idx_bonus_stats_bonus 
  ON bonus_stats(bonus_id, stat_date);

COMMENT ON TABLE bonus_stats IS 'Daily bonus issuance statistics for reporting';
COMMENT ON COLUMN bonus_stats.stat_date IS 'Days since 1959-12-03 (use date_to_molecule_int/molecule_int_to_date)';
COMMENT ON COLUMN bonus_stats.issued_count IS 'Number of times bonus was awarded on this date';
COMMENT ON COLUMN bonus_stats.points_total IS 'Total points awarded from this bonus on this date';
