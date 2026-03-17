-- ============================================================
-- COMPLIANCE RESULT TABLE
-- Session 82 — March 9, 2026
-- Stores the detail of each compliance event
-- Accrual activity links here via COMP_RESULT molecule
-- ============================================================

CREATE TABLE compliance_result (
    link INTEGER NOT NULL PRIMARY KEY,
    member_compliance_id INTEGER NOT NULL REFERENCES member_compliance(member_compliance_id),
    status_id INTEGER NOT NULL REFERENCES compliance_item_status(status_id),
    result_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    tenant_id SMALLINT NOT NULL
);

-- Register in link_tank
INSERT INTO link_tank (table_key, current_value)
VALUES ('compliance_result', -2147483648)
ON CONFLICT (table_key) DO NOTHING;

-- Indexes
CREATE INDEX idx_compliance_result_member ON compliance_result(member_compliance_id);
CREATE INDEX idx_compliance_result_tenant ON compliance_result(tenant_id);
CREATE INDEX idx_compliance_result_date ON compliance_result(result_date);
