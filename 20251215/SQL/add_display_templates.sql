-- Migration: Add Display Template tables and molecule
-- Date: 2025-11-06
-- Purpose: Create infrastructure for Activity Display Templates

-- =====================================================
-- STEP 1: Create display_template table
-- =====================================================
CREATE TABLE display_template (
  template_id SERIAL PRIMARY KEY,
  tenant_id SMALLINT NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_type CHAR(1) NOT NULL CHECK (template_type IN ('V', 'E')),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_display_template_tenant ON display_template(tenant_id);
CREATE INDEX idx_display_template_active ON display_template(tenant_id, is_active);

COMMENT ON TABLE display_template IS 'Activity Display Templates - defines how activities display in CSR pages';
COMMENT ON COLUMN display_template.template_type IS 'V=Verbose, E=Efficient (from display_template_type molecule)';
COMMENT ON COLUMN display_template.is_active IS 'Only 1 active V and 1 active E allowed per tenant (enforced in code)';

-- =====================================================
-- STEP 2: Create display_template_line table
-- =====================================================
CREATE TABLE display_template_line (
  line_id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL,
  line_number INTEGER NOT NULL,
  template_string TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES display_template(template_id) ON DELETE CASCADE
);

CREATE INDEX idx_display_template_line_template ON display_template_line(template_id);
CREATE INDEX idx_display_template_line_order ON display_template_line(template_id, line_number);

COMMENT ON TABLE display_template_line IS 'Individual lines within a display template';
COMMENT ON COLUMN display_template_line.template_string IS 'Template syntax: [M,molecule_key,"format",max_length],[T,"text"]';
COMMENT ON COLUMN display_template_line.line_number IS 'Order of lines (10, 20, 30...) - used for display ordering';

-- =====================================================
-- STEP 3: Create display_template_type molecule
-- =====================================================

-- Get the next molecule_id
DO $$
DECLARE
  new_molecule_id INTEGER;
  tenant_id_val SMALLINT := 1;
BEGIN
  -- Insert molecule definition
  INSERT INTO molecule_def (
    tenant_id,
    molecule_key,
    label,
    value_kind,
    scalar_type,
    context,
    sort_order
  ) VALUES (
    tenant_id_val,
    'display_template_type',
    'Display Template Type',
    'list',
    NULL,
    'template',
    999
  ) RETURNING molecule_id INTO new_molecule_id;

  -- Insert list values
  INSERT INTO molecule_value_list (tenant_id, molecule_id, code_value, display_label, sort_order) VALUES
    (tenant_id_val, new_molecule_id, 'V', 'Verbose', 10),
    (tenant_id_val, new_molecule_id, 'E', 'Efficient', 20);

  RAISE NOTICE 'Created molecule_id % for display_template_type', new_molecule_id;
END $$;

-- =====================================================
-- STEP 4: Create default templates for tenant 1
-- =====================================================

-- Default Verbose Template
INSERT INTO display_template (tenant_id, template_name, template_type, is_active)
VALUES (1, 'Default Verbose', 'V', TRUE)
RETURNING template_id;

-- Get the template_id for verbose
DO $$
DECLARE
  verbose_template_id INTEGER;
  efficient_template_id INTEGER;
BEGIN
  -- Get verbose template id
  SELECT template_id INTO verbose_template_id
  FROM display_template
  WHERE tenant_id = 1 AND template_type = 'V' AND template_name = 'Default Verbose';

  -- Add verbose template lines
  INSERT INTO display_template_line (template_id, line_number, template_string) VALUES
    (verbose_template_id, 10, '[M,origin,"Code"],[T," to "],[M,destination,"Code"]'),
    (verbose_template_id, 20, '[M,carrier,"Description",20],[T," • "],[M,flight_number,"Code"]'),
    (verbose_template_id, 30, '[M,fare_class,"Description"]');

  -- Create efficient template
  INSERT INTO display_template (tenant_id, template_name, template_type, is_active)
  VALUES (1, 'Default Efficient', 'E', TRUE)
  RETURNING template_id INTO efficient_template_id;

  -- Add efficient template lines
  INSERT INTO display_template_line (template_id, line_number, template_string) VALUES
    (efficient_template_id, 10, '[M,origin,"Code"],[T," • "],[M,destination,"Code"],[T," • "],[M,carrier,"Code"],[T," • "],[M,fare_class,"Code"]');

  RAISE NOTICE 'Created default templates: verbose=%, efficient=%', verbose_template_id, efficient_template_id;
END $$;

-- =====================================================
-- Verification queries
-- =====================================================
-- SELECT * FROM display_template;
-- SELECT * FROM display_template_line ORDER BY template_id, line_number;
-- SELECT * FROM molecule_def WHERE molecule_key = 'display_template_type';
-- SELECT * FROM molecule_value_list WHERE molecule_id = (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'display_template_type');
