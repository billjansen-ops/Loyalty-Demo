-- Adjustment Table
-- Used for manual point adjustments (customer service, promotional credits, corrections)
-- Author: Claude
-- Date: 2025-11-18

CREATE TABLE IF NOT EXISTS adjustment (
    adjustment_id SERIAL PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    adjustment_code VARCHAR(20) NOT NULL,
    adjustment_name VARCHAR(100) NOT NULL,
    adjustment_type CHAR(1) NOT NULL CHECK (adjustment_type IN ('F', 'V')),
    fixed_points INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT adjustment_tenant_code_uq UNIQUE (tenant_id, adjustment_code),
    CONSTRAINT adjustment_fixed_points_check CHECK (
        (adjustment_type = 'F' AND fixed_points IS NOT NULL AND fixed_points > 0) OR
        (adjustment_type = 'V' AND fixed_points IS NULL)
    )
);

COMMENT ON TABLE adjustment IS 'Manual point adjustments for customer service and corrections';
COMMENT ON COLUMN adjustment.adjustment_type IS 'F=Fixed amount, V=Variable amount entered by CSR';
COMMENT ON COLUMN adjustment.fixed_points IS 'Preset points for Fixed type adjustments';

-- Sample data for Delta Air Lines (tenant_id = 1)
INSERT INTO adjustment (tenant_id, adjustment_code, adjustment_name, adjustment_type, fixed_points, is_active) VALUES
(1, 'CS-500', 'Customer Service Credit - 500', 'F', 500, true),
(1, 'CS-1000', 'Customer Service Credit - 1000', 'F', 1000, true),
(1, 'CS-2500', 'Customer Service Credit - 2500', 'F', 2500, true),
(1, 'CS-VAR', 'Customer Service Credit - Variable', 'V', NULL, true),
(1, 'PROMO', 'Promotional Credit', 'V', NULL, true),
(1, 'CORRECT', 'Points Correction', 'V', NULL, true),
(1, 'GOODWILL', 'Goodwill Gesture - 1000', 'F', 1000, true);

-- Verify data
SELECT 
    adjustment_id,
    adjustment_code,
    adjustment_name,
    adjustment_type,
    fixed_points,
    is_active
FROM adjustment
WHERE tenant_id = 1
ORDER BY adjustment_code;
