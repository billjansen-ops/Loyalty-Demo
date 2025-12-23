-- Input Template System
-- Parallel to display_template, defines how activity entry forms are built
-- Created: 2025-11-25

-- =============================================================================
-- TABLE: input_template (header - mirrors display_template)
-- =============================================================================
CREATE TABLE public.input_template (
    template_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES public.tenant(tenant_id) ON DELETE CASCADE,
    template_name VARCHAR(100) NOT NULL,
    activity_type CHAR(1) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    CONSTRAINT input_template_activity_type_check CHECK (activity_type IN ('A', 'R', 'P', 'J'))
);

COMMENT ON TABLE public.input_template IS 'Activity Input Templates - defines how activity entry forms are built';
COMMENT ON COLUMN public.input_template.activity_type IS 'A=Flight, R=Redemption, P=Partner, J=Adjustment';

CREATE INDEX idx_input_template_tenant ON public.input_template(tenant_id);
CREATE INDEX idx_input_template_active ON public.input_template(tenant_id, activity_type, is_active);

-- =============================================================================
-- TABLE: input_template_line (detail - mirrors display_template_line)
-- =============================================================================
CREATE TABLE public.input_template_line (
    line_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES public.input_template(template_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    template_string TEXT NOT NULL
);

COMMENT ON TABLE public.input_template_line IS 'Individual rows within an input template';
COMMENT ON COLUMN public.input_template_line.line_number IS 'Order of rows (10, 20, 30...) - used for form layout';
COMMENT ON COLUMN public.input_template_line.template_string IS 'Template syntax: [M,molecule_key,"width",R/O] or [T,"Section Label"]';

CREATE INDEX idx_input_template_line_template ON public.input_template_line(template_id);
CREATE INDEX idx_input_template_line_order ON public.input_template_line(template_id, line_number);

-- =============================================================================
-- SEED DATA: Tenant 1 (Delta) Input Templates
-- =============================================================================

-- Flight Entry Template (activity_type = 'A')
INSERT INTO public.input_template (tenant_id, template_name, activity_type, is_active)
VALUES (1, 'Flight Entry', 'A', true);

INSERT INTO public.input_template_line (template_id, line_number, template_string)
VALUES 
    (1, 10, '[M,carrier,"third",R],[M,flight_number,"third",O],[M,fare_class,"third",R]'),
    (1, 20, '[M,origin,"half",R],[M,destination,"half",R]'),
    (1, 30, '[M,base_miles,"half",R]');

-- Partner Entry Template (activity_type = 'P')
INSERT INTO public.input_template (tenant_id, template_name, activity_type, is_active)
VALUES (1, 'Partner Activity Entry', 'P', true);

INSERT INTO public.input_template_line (template_id, line_number, template_string)
VALUES 
    (2, 10, '[M,partner,"half",R],[M,partner_program,"half",R,partner]'),
    (2, 20, '[M,base_miles,"half",R]');

-- Adjustment Entry Template (activity_type = 'J')
INSERT INTO public.input_template (tenant_id, template_name, activity_type, is_active)
VALUES (1, 'Adjustment Entry', 'J', true);

INSERT INTO public.input_template_line (template_id, line_number, template_string)
VALUES 
    (3, 10, '[M,adjustment,"half",R]'),
    (3, 20, '[M,base_miles,"half",R]');

-- =============================================================================
-- VERIFICATION
-- =============================================================================
SELECT 'Input Templates:' as info;
SELECT t.template_id, t.template_name, t.activity_type, t.is_active, COUNT(l.line_id) as lines
FROM public.input_template t
LEFT JOIN public.input_template_line l ON t.template_id = l.template_id
GROUP BY t.template_id, t.template_name, t.activity_type, t.is_active
ORDER BY t.template_id;

SELECT 'Input Template Lines:' as info;
SELECT t.template_name, l.line_number, l.template_string
FROM public.input_template t
JOIN public.input_template_line l ON t.template_id = l.template_id
ORDER BY t.template_id, l.line_number;
