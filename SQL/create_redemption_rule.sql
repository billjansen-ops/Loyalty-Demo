-- Create redemption_rule table
-- Defines redemption options for loyalty program (what members can redeem points for)

CREATE TABLE IF NOT EXISTS redemption_rule (
  rule_id SERIAL PRIMARY KEY,
  tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
  redemption_code VARCHAR(50) NOT NULL,
  redemption_desc TEXT NOT NULL,
  redemption_type CHAR(1) NOT NULL CHECK (redemption_type IN ('F', 'V')),
  -- F = Fixed point amount, V = Variable point amount
  points_required INTEGER, -- Required for Fixed type, NULL for Variable
  start_date DATE,
  end_date DATE,
  status CHAR(1) NOT NULL DEFAULT 'A' CHECK (status IN ('A', 'I')),
  -- A = Active, I = Inactive
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT uk_redemption_rule_tenant_code UNIQUE (tenant_id, redemption_code),
  CONSTRAINT chk_fixed_points CHECK (
    (redemption_type = 'F' AND points_required IS NOT NULL) OR
    (redemption_type = 'V' AND points_required IS NULL)
  )
);

CREATE INDEX idx_redemption_rule_tenant ON redemption_rule(tenant_id);
CREATE INDEX idx_redemption_rule_status ON redemption_rule(tenant_id, status);
CREATE INDEX idx_redemption_rule_dates ON redemption_rule(tenant_id, start_date, end_date);

COMMENT ON TABLE redemption_rule IS 'Defines redemption options available to members';
COMMENT ON COLUMN redemption_rule.redemption_type IS 'F=Fixed points, V=Variable points';
COMMENT ON COLUMN redemption_rule.points_required IS 'Points needed for fixed redemptions, NULL for variable';
COMMENT ON COLUMN redemption_rule.status IS 'A=Active, I=Inactive';
