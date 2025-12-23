-- Schema changes for embedded_list molecule type
-- Purpose: Support categorized lists within a single molecule (e.g., system parameters)

-- Step 1: Create table for embedded list values
CREATE TABLE molecule_value_embedded_list (
    embedded_value_id SERIAL PRIMARY KEY,
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id) ON DELETE CASCADE,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    category VARCHAR(50) NOT NULL,              -- Subcategory key (e.g., 'redemption_type')
    code VARCHAR(10) NOT NULL,                  -- Value code (e.g., 'F', 'V')
    description TEXT NOT NULL,                  -- Human-readable description
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    
    -- Ensure unique codes within category within molecule
    UNIQUE(molecule_id, tenant_id, category, code)
);

-- Index for fast lookups
CREATE INDEX idx_molecule_value_embedded_list_lookup 
    ON molecule_value_embedded_list(molecule_id, tenant_id, category, is_active);

-- Table comment
COMMENT ON TABLE molecule_value_embedded_list IS 'Storage for embedded list molecules - categorized lists within a single molecule (e.g., system parameters with multiple subcategories)';

-- Column comments
COMMENT ON COLUMN molecule_value_embedded_list.category IS 'Subcategory key within the molecule (e.g., redemption_type, activity_type)';
COMMENT ON COLUMN molecule_value_embedded_list.code IS 'Short code for the value (e.g., F, V, A, P, R, X)';
COMMENT ON COLUMN molecule_value_embedded_list.description IS 'Human-readable description of the value';
COMMENT ON COLUMN molecule_value_embedded_list.sort_order IS 'Display order for UI dropdowns and lists';

-- Step 2: Create sysparm molecule
INSERT INTO molecule_def (tenant_id, molecule_key, label, value_kind, scalar_type)
VALUES (1, 'sysparm', 'System Parameters', 'embedded_list', NULL);

-- Get the molecule_id for sysparm (will be used in next insert)
-- Assuming it gets molecule_id = 6 (adjust if different)

-- Step 3: Insert system parameter values
INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order)
VALUES 
  -- Redemption types
  (6, 1, 'redemption_type', 'F', 'Fixed Point Redemption', 10),
  (6, 1, 'redemption_type', 'V', 'Variable Point Redemption', 20),
  
  -- Activity types
  (6, 1, 'activity_type', 'A', 'Base Activity', 10),
  (6, 1, 'activity_type', 'P', 'Partner Activity', 20),
  (6, 1, 'activity_type', 'R', 'Redemption', 30),
  (6, 1, 'activity_type', 'X', 'Adjustment', 40),
  
  -- Redemption status
  (6, 1, 'redemption_status', 'A', 'Active', 10),
  (6, 1, 'redemption_status', 'I', 'Inactive', 20);

-- Step 4: Create redemption_rule table
CREATE TABLE redemption_rule (
    redemption_id SERIAL PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    redemption_code VARCHAR(20) NOT NULL,
    redemption_description TEXT NOT NULL,
    status CHAR(1) NOT NULL DEFAULT 'A',
    start_date DATE NOT NULL,
    end_date DATE,
    redemption_type CHAR(1) NOT NULL,           -- 'F' = Fixed, 'V' = Variable
    points_required INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    
    -- Ensure unique codes per tenant
    UNIQUE(tenant_id, redemption_code)
);

-- Table comment
COMMENT ON TABLE redemption_rule IS 'Redemption catalog defining fixed and variable point redemptions available to members';

-- Column comments
COMMENT ON COLUMN redemption_rule.status IS 'Redemption status. Valid values: getMoleculeValues(tenantId, ''sysparm'', ''redemption_status'')';
COMMENT ON COLUMN redemption_rule.redemption_type IS 'Redemption points type: F=Fixed points, V=Variable points. Valid values: getMoleculeValues(tenantId, ''sysparm'', ''redemption_type'')';
COMMENT ON COLUMN redemption_rule.points_required IS 'Points required for redemption (fixed amount for type F, base/minimum for type V)';
COMMENT ON COLUMN redemption_rule.start_date IS 'Date when redemption becomes available';
COMMENT ON COLUMN redemption_rule.end_date IS 'Date when redemption expires (NULL = no expiration)';

-- Index for active redemptions by date range
CREATE INDEX idx_redemption_rule_active 
    ON redemption_rule(tenant_id, status, start_date, end_date);

-- Index for code lookups
CREATE INDEX idx_redemption_rule_code 
    ON redemption_rule(tenant_id, redemption_code);
