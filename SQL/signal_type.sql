-- SIGNAL molecule and signal_type lookup table
-- Created: Session 83b, March 10, 2026
-- Core Pointer enhancement — any tenant can define signals

CREATE TABLE signal_type (
    signal_type_id SERIAL PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    signal_code VARCHAR(30) NOT NULL,
    signal_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(tenant_id, signal_code)
);

COMMENT ON TABLE signal_type IS 'Lookup table for the SIGNAL molecule. Each row is a possible signal value that scoring functions can attach to accruals.';

-- Seed: Wisconsin PHP signal types
INSERT INTO signal_type (tenant_id, signal_code, signal_name, description) VALUES
  (5, 'SENTINEL_POSITIVE', 'Sentinel — Confirmed Positive', 'Confirmed positive drug test (GC/MS)'),
  (5, 'SENTINEL_REFUSED', 'Sentinel — Refused/Tampered', 'Specimen refused or tampered'),
  (5, 'SENTINEL_SUSPENDED', 'Sentinel — Program Suspension', 'Program suspension or probation'),
  (5, 'PPII_RED', 'PPII Red Threshold', 'Composite score entered Red range (75-100)'),
  (5, 'PPII_ORANGE', 'PPII Orange Threshold', 'Composite score entered Orange range (55-74)'),
  (5, 'PPII_YELLOW', 'PPII Yellow Threshold', 'Composite score entered Yellow range (35-54)'),
  (5, 'PULSE_Q3', 'Pulse Question Score 3', 'Provider Pulse individual question scored 3 (Significant concern)'),
  (5, 'STABILITY_IMMEDIATE', 'Stability Alert — Immediate', 'Provider Stability Alert: Immediate stabilization recommended'),
  (5, 'STABILITY_EMERGING', 'Stability Alert — Emerging', 'Provider Stability Alert: Emerging instability concern'),
  (5, 'MISSED_SURVEY', 'Missed Survey (MEDS)', 'No PPSI survey submitted within expected window'),
  (5, 'PPII_TREND_UP', 'PPII Upward Trend', '3-week upward trend slope > +5'),
  (5, 'PPII_SPIKE', 'PPII Sudden Spike', 'Week-over-week increase >= +12');
