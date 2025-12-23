-- ============================================================================
-- COMPOSITE SYSTEM MIGRATION
-- Creates composite and composite_detail tables, populates from input_template
-- Date: 2025-12-12
-- ============================================================================

-- Step 1: Create composite table (header)
CREATE TABLE public.composite (
    link SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    composite_type CHAR(1) NOT NULL,
    description VARCHAR(100),
    validate_function VARCHAR(100),
    UNIQUE (tenant_id, composite_type)
);

COMMENT ON TABLE public.composite IS 'Defines which molecules make up each activity type per tenant';
COMMENT ON COLUMN public.composite.composite_type IS 'Activity type: A=Accrual, P=Partner, J=Adjustment, R=Redemption';
COMMENT ON COLUMN public.composite.validate_function IS 'Optional whole-composite validation function name';

-- Step 2: Create composite_detail table
CREATE TABLE public.composite_detail (
    link SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    p_link SMALLINT NOT NULL REFERENCES composite(link) ON DELETE CASCADE,
    molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
    is_required BOOLEAN DEFAULT false,
    is_calculated BOOLEAN DEFAULT false,
    calc_function VARCHAR(100),
    sort_order SMALLINT NOT NULL,
    UNIQUE (p_link, molecule_id)
);

COMMENT ON TABLE public.composite_detail IS 'Molecules that make up a composite activity structure';
COMMENT ON COLUMN public.composite_detail.p_link IS 'Parent composite link';
COMMENT ON COLUMN public.composite_detail.is_required IS 'If true, value must be provided (validation)';
COMMENT ON COLUMN public.composite_detail.is_calculated IS 'If true, server computes value using calc_function';
COMMENT ON COLUMN public.composite_detail.calc_function IS 'Function name for calculated fields (e.g., selectAircraftType)';
COMMENT ON COLUMN public.composite_detail.sort_order IS 'Processing order (important when calculations depend on each other)';

-- Step 3: Create indexes
CREATE INDEX idx_composite_tenant ON public.composite(tenant_id);
CREATE INDEX idx_composite_detail_parent ON public.composite_detail(p_link);

-- Step 4: Populate composite from input_template (one per tenant + activity_type)
INSERT INTO public.composite (tenant_id, composite_type, description)
SELECT DISTINCT 
    it.tenant_id,
    it.activity_type,
    it.template_name
FROM public.input_template it
ORDER BY it.tenant_id, it.activity_type;

-- Step 5: Populate composite_detail from input_template_field
-- Join through input_template to get tenant_id, then to molecule_def to get molecule_id
INSERT INTO public.composite_detail (p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
SELECT 
    c.link,
    md.molecule_id,
    COALESCE(itf.is_required, md.is_required, false),
    COALESCE(itf.enterable = 'N', false),
    itf.system_generated,
    itf.sort_order
FROM public.input_template_field itf
JOIN public.input_template it ON itf.template_id = it.template_id
JOIN public.composite c ON c.tenant_id = it.tenant_id AND c.composite_type = it.activity_type
JOIN public.molecule_def md ON md.molecule_key = itf.molecule_key AND md.tenant_id = it.tenant_id
ORDER BY c.link, itf.sort_order;

-- Step 6: Add composite_link column to input_template_field
ALTER TABLE public.input_template_field 
ADD COLUMN composite_link SMALLINT REFERENCES composite_detail(link);

COMMENT ON COLUMN public.input_template_field.composite_link IS 'Links to composite_detail for business rules (required, calculated)';

-- Step 7: Populate composite_link by matching molecule
UPDATE public.input_template_field itf
SET composite_link = cd.link
FROM public.input_template it,
     public.composite c,
     public.composite_detail cd,
     public.molecule_def md
WHERE itf.template_id = it.template_id
  AND c.tenant_id = it.tenant_id 
  AND c.composite_type = it.activity_type
  AND cd.p_link = c.link
  AND md.molecule_id = cd.molecule_id
  AND md.molecule_key = itf.molecule_key
  AND md.tenant_id = it.tenant_id;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

SELECT '=== COMPOSITE TABLE ===' as info;
SELECT link, tenant_id, composite_type, description FROM public.composite ORDER BY link;

SELECT '=== COMPOSITE_DETAIL TABLE ===' as info;
SELECT 
    cd.link,
    cd.p_link,
    c.composite_type,
    md.molecule_key,
    cd.is_required,
    cd.is_calculated,
    cd.calc_function,
    cd.sort_order
FROM public.composite_detail cd
JOIN public.composite c ON cd.p_link = c.link
JOIN public.molecule_def md ON cd.molecule_id = md.molecule_id
ORDER BY cd.p_link, cd.sort_order;

SELECT '=== INPUT_TEMPLATE_FIELD WITH COMPOSITE_LINK ===' as info;
SELECT 
    itf.field_id,
    itf.template_id,
    itf.molecule_key,
    itf.composite_link,
    cd.is_required as composite_required,
    cd.is_calculated as composite_calculated
FROM public.input_template_field itf
LEFT JOIN public.composite_detail cd ON itf.composite_link = cd.link
ORDER BY itf.template_id, itf.sort_order;

SELECT '=== ROW COUNTS ===' as info;
SELECT 'composite' as table_name, COUNT(*) as row_count FROM public.composite
UNION ALL
SELECT 'composite_detail', COUNT(*) FROM public.composite_detail
UNION ALL
SELECT 'input_template_field (with composite_link)', COUNT(*) FROM public.input_template_field WHERE composite_link IS NOT NULL;
