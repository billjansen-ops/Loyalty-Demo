-- ============================================================
-- COMPLIANCE TABLES — Stream B
-- Session 82 — March 9, 2026
-- ============================================================

-- 1. Compliance Item Catalog (per-tenant)
CREATE TABLE compliance_item (
    compliance_item_id SERIAL PRIMARY KEY,
    tenant_id SMALLINT NOT NULL,
    item_code VARCHAR(20) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    weight DECIMAL(4,2) NOT NULL DEFAULT 0,
    status VARCHAR(10) NOT NULL DEFAULT 'active',
    UNIQUE (tenant_id, item_code)
);

-- 2. Valid Result Statuses per Compliance Item
CREATE TABLE compliance_item_status (
    status_id SERIAL PRIMARY KEY,
    compliance_item_id INTEGER NOT NULL REFERENCES compliance_item(compliance_item_id),
    status_code VARCHAR(20) NOT NULL,
    score SMALLINT NOT NULL DEFAULT 0,
    is_sentinel BOOLEAN NOT NULL DEFAULT false,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    UNIQUE (compliance_item_id, status_code)
);

-- 3. Per-Member Compliance Configuration
CREATE TABLE member_compliance (
    member_compliance_id SERIAL PRIMARY KEY,
    member_link CHAR(5) NOT NULL,
    compliance_item_id INTEGER NOT NULL REFERENCES compliance_item(compliance_item_id),
    cadence VARCHAR(10) NOT NULL DEFAULT 'monthly',
    status VARCHAR(10) NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tenant_id SMALLINT NOT NULL,
    UNIQUE (member_link, compliance_item_id)
);

-- Indexes
CREATE INDEX idx_member_compliance_member ON member_compliance(member_link);
CREATE INDEX idx_member_compliance_tenant ON member_compliance(tenant_id);
CREATE INDEX idx_compliance_item_tenant ON compliance_item(tenant_id);
