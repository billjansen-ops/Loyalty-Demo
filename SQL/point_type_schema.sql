-- Point Types (Buckets) - behavioral containers for points
-- Phase 1: Foundation with default bucket per tenant

CREATE TABLE point_type (
    point_type_id SERIAL PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    point_type_code VARCHAR(20) NOT NULL,
    point_type_name VARCHAR(50) NOT NULL,
    
    -- Expiration policy (Phase 2 - for now we use existing point_expiration_rule)
    expiration_mode VARCHAR(20) NOT NULL DEFAULT 'legacy',  -- 'legacy', 'never', 'days', 'fixed_date'
    expiration_days INTEGER,
    expiration_date DATE,
    
    -- Redemption hints (used by redemption selection strategy)
    redemption_priority SMALLINT DEFAULT 50,
    is_restricted BOOLEAN DEFAULT FALSE,
    
    -- Display
    display_order SMALLINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, point_type_code)
);

-- Point Routing Rules - determines which bucket receives points
CREATE TABLE point_routing_rule (
    rule_id SERIAL PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    point_type_id INTEGER NOT NULL REFERENCES point_type(point_type_id),
    
    priority SMALLINT NOT NULL,
    rule_name VARCHAR(50) NOT NULL,
    
    -- Match criteria (NULL = don't care)
    match_accrual_type VARCHAR(20),
    match_promotion_id INTEGER,
    match_bonus_id INTEGER,
    match_partner_id INTEGER,
    match_adjustment_id INTEGER,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, priority)
);

-- Indexes
CREATE INDEX idx_point_type_tenant ON point_type(tenant_id);
CREATE INDEX idx_point_type_default ON point_type(tenant_id, is_default) WHERE is_default = TRUE;
CREATE INDEX idx_point_routing_rule_tenant ON point_routing_rule(tenant_id, priority DESC);

-- Bootstrap: Create default point type for each existing tenant
INSERT INTO point_type (tenant_id, point_type_code, point_type_name, expiration_mode, is_default)
SELECT tenant_id, 'BASE', 'Base Points', 'legacy', TRUE
FROM tenant
WHERE is_active = TRUE;

-- Bootstrap: Create default routing rule for each tenant (priority 0 = lowest, catches all)
INSERT INTO point_routing_rule (tenant_id, point_type_id, priority, rule_name)
SELECT pt.tenant_id, pt.point_type_id, 0, 'Default'
FROM point_type pt
WHERE pt.is_default = TRUE;
