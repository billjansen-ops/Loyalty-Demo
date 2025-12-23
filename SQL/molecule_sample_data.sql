-- ============================================================================
-- MOLECULE SYSTEM SAMPLE DATA
-- ============================================================================
-- This script populates sample molecules for Delta Airlines (tenant_id = 1)
-- Includes static tenant config and activity molecules
-- ============================================================================

-- ============================================================================
-- STATIC TENANT CONFIG MOLECULES
-- ============================================================================

-- Currency Label (singular)
INSERT INTO molecule_def (
    tenant_id, molecule_key, label, value_kind, scalar_type, 
    context, is_static, is_permanent, description
) VALUES (
    1, 'currency_label_singular', 'Currency Label (Singular)', 'scalar', 'text',
    'tenant', true, true, 'Singular form of points/miles (e.g., "mile", "point")'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING
RETURNING molecule_id;

-- Store the value
INSERT INTO molecule_value_text (molecule_id, text_value)
SELECT molecule_id, 'mile'
FROM molecule_def
WHERE tenant_id = 1 AND molecule_key = 'currency_label_singular'
ON CONFLICT DO NOTHING;

-- Currency Label (plural)
INSERT INTO molecule_def (
    tenant_id, molecule_key, label, value_kind, scalar_type, 
    context, is_static, is_permanent, description
) VALUES (
    1, 'currency_label_plural', 'Currency Label (Plural)', 'scalar', 'text',
    'tenant', true, true, 'Plural form of points/miles (e.g., "miles", "points")'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING;

INSERT INTO molecule_value_text (molecule_id, text_value)
SELECT molecule_id, 'miles'
FROM molecule_def
WHERE tenant_id = 1 AND molecule_key = 'currency_label_plural'
ON CONFLICT DO NOTHING;

-- Retro Days Allowed
INSERT INTO molecule_def (
    tenant_id, molecule_key, label, value_kind, scalar_type, 
    context, is_static, is_permanent, description
) VALUES (
    1, 'retro_days_allowed', 'Retroactive Days Allowed', 'scalar', 'numeric',
    'tenant', true, true, 'Number of days back activities can be entered'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING;

INSERT INTO molecule_value_numeric (molecule_id, numeric_value)
SELECT molecule_id, 365
FROM molecule_def
WHERE tenant_id = 1 AND molecule_key = 'retro_days_allowed'
ON CONFLICT DO NOTHING;

-- Max Tier Qualification Days
INSERT INTO molecule_def (
    tenant_id, molecule_key, label, value_kind, scalar_type, 
    context, is_static, is_permanent, description
) VALUES (
    1, 'max_tier_qualification_days', 'Max Tier Qualification Days', 'scalar', 'numeric',
    'tenant', true, true, 'Maximum days to qualify for tier status'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING;

INSERT INTO molecule_value_numeric (molecule_id, numeric_value)
SELECT molecule_id, 365
FROM molecule_def
WHERE tenant_id = 1 AND molecule_key = 'max_tier_qualification_days'
ON CONFLICT DO NOTHING;

-- Last Member Number (counter for new member IDs)
INSERT INTO molecule_def (
    tenant_id, molecule_key, label, value_kind, scalar_type, 
    context, is_static, is_permanent, description
) VALUES (
    1, 'last_member_number', 'Last Member Number', 'scalar', 'numeric',
    'tenant', true, true, 'Counter for generating new member numbers'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING;

INSERT INTO molecule_value_numeric (molecule_id, numeric_value)
SELECT molecule_id, 10000
FROM molecule_def
WHERE tenant_id = 1 AND molecule_key = 'last_member_number'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ACTIVITY MOLECULES (transactional - define valid options)
-- ============================================================================

-- Fare Class (list type - defines valid fare classes)
-- Parent already exists from old system, update it
UPDATE molecule_def
SET 
    context = 'activity',
    is_static = false,
    is_permanent = true,
    description = 'Flight cabin class of service'
WHERE tenant_id = 1 AND molecule_key = 'fare_class';

-- Add the valid fare class options
DO $$
DECLARE
    v_molecule_id INTEGER;
BEGIN
    SELECT molecule_id INTO v_molecule_id
    FROM molecule_def
    WHERE tenant_id = 1 AND molecule_key = 'fare_class';
    
    -- First Class
    INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order)
    VALUES (v_molecule_id, 'F', 'First Class', 1)
    ON CONFLICT DO NOTHING;
    
    -- Business Class
    INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order)
    VALUES (v_molecule_id, 'C', 'Business Class', 2)
    ON CONFLICT DO NOTHING;
    
    -- Economy
    INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order)
    VALUES (v_molecule_id, 'Y', 'Economy', 3)
    ON CONFLICT DO NOTHING;
END $$;

-- Update existing activity molecules with new fields
UPDATE molecule_def
SET 
    context = 'activity',
    is_static = false,
    is_permanent = true
WHERE tenant_id = 1 AND molecule_key IN ('carrier', 'origin', 'destination', 'flight_number');

UPDATE molecule_def
SET description = 'Airline carrier code'
WHERE tenant_id = 1 AND molecule_key = 'carrier';

UPDATE molecule_def
SET description = 'Origin airport code'
WHERE tenant_id = 1 AND molecule_key = 'origin';

UPDATE molecule_def
SET description = 'Destination airport code'
WHERE tenant_id = 1 AND molecule_key = 'destination';

UPDATE molecule_def
SET description = 'Flight number'
WHERE tenant_id = 1 AND molecule_key = 'flight_number';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show all molecules
SELECT 
    md.molecule_id,
    md.tenant_id,
    md.molecule_key,
    md.label,
    md.value_kind,
    md.scalar_type,
    md.context,
    md.is_static,
    md.is_permanent,
    md.description
FROM molecule_def md
WHERE md.tenant_id = 1
ORDER BY md.context, md.is_static DESC, md.molecule_key;

-- Show static molecule values
SELECT 
    md.molecule_key,
    md.label,
    md.scalar_type,
    COALESCE(
        mvt.text_value,
        mvn.numeric_value::text,
        mvd.date_value::text,
        mvb.bool_value::text
    ) as value
FROM molecule_def md
LEFT JOIN molecule_value_text mvt ON md.molecule_id = mvt.molecule_id
LEFT JOIN molecule_value_numeric mvn ON md.molecule_id = mvn.molecule_id
LEFT JOIN molecule_value_date mvd ON md.molecule_id = mvd.molecule_id
LEFT JOIN molecule_value_boolean mvb ON md.molecule_id = mvb.molecule_id
WHERE md.tenant_id = 1 AND md.is_static = true
ORDER BY md.molecule_key;

-- Show list-type molecules and their options
SELECT 
    md.molecule_key,
    md.label,
    mvt.text_value,
    mvt.display_label,
    mvt.sort_order
FROM molecule_def md
JOIN molecule_value_text mvt ON md.molecule_id = mvt.molecule_id
WHERE md.tenant_id = 1 AND md.value_kind = 'list'
ORDER BY md.molecule_key, mvt.sort_order;

-- ============================================================================
-- SAMPLE DATA COMPLETE
-- ============================================================================
