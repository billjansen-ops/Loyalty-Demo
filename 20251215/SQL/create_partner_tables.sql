-- Create partner and partner_program tables
-- Author: Claude
-- Date: 2025-11-17

-- Partner table - Organizations that offer earning opportunities
CREATE TABLE partner (
    partner_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL,
    partner_code VARCHAR(20) NOT NULL,
    partner_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT uk_partner_code UNIQUE (tenant_id, partner_code)
);

-- Partner program table - Specific earning programs within a partner
CREATE TABLE partner_program (
    program_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    partner_id INTEGER NOT NULL,
    tenant_id SMALLINT NOT NULL,
    program_code VARCHAR(20) NOT NULL,
    program_name VARCHAR(100) NOT NULL,
    earning_type CHAR(1) NOT NULL CHECK (earning_type IN ('F', 'V')),
    fixed_points BIGINT,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT fk_partner FOREIGN KEY (partner_id) REFERENCES partner(partner_id),
    CONSTRAINT uk_program_code UNIQUE (tenant_id, program_code),
    CONSTRAINT chk_fixed_points CHECK (
        (earning_type = 'F' AND fixed_points IS NOT NULL) OR
        (earning_type = 'V' AND fixed_points IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_partner_tenant ON partner(tenant_id);
CREATE INDEX idx_partner_program_tenant ON partner_program(tenant_id);
CREATE INDEX idx_partner_program_partner ON partner_program(partner_id);

-- Sample data for Delta (tenant_id = 1)
INSERT INTO partner (tenant_id, partner_code, partner_name, is_active)
VALUES 
    (1, 'HERTZ', 'Hertz Rent A Car', true),
    (1, 'MARRIOTT', 'Marriott Hotels', true),
    (1, 'AMEX', 'American Express', true);

-- Sample programs
INSERT INTO partner_program (partner_id, tenant_id, program_code, program_name, earning_type, fixed_points, is_active)
VALUES
    -- Hertz programs (partner_id will be 1)
    (1, 1, 'HERTZ-LUX', 'Luxury Car Rental', 'F', 500, true),
    (1, 1, 'HERTZ-ECO', 'Economy Car Rental', 'F', 250, true),
    (1, 1, 'HERTZ-TRUCK', 'Truck Rental', 'F', 300, true),
    
    -- Marriott programs (partner_id will be 2)
    (2, 1, 'MAR-GOLD', 'Bonvoy Gold Stays', 'F', 1000, true),
    (2, 1, 'MAR-PLAT', 'Bonvoy Platinum Stays', 'F', 1500, true),
    
    -- Amex programs (partner_id will be 3)
    (3, 1, 'AMEX-PLAT', 'Platinum Card Spend', 'V', NULL, true),
    (3, 1, 'AMEX-GOLD', 'Gold Card Spend', 'V', NULL, true);

-- Verification queries
SELECT 'Partners created:' as status;
SELECT partner_id, partner_code, partner_name FROM partner;

SELECT 'Partner Programs created:' as status;
SELECT pp.program_id, p.partner_name, pp.program_name, pp.earning_type, pp.fixed_points
FROM partner_program pp
JOIN partner p ON pp.partner_id = p.partner_id
ORDER BY p.partner_name, pp.program_name;
