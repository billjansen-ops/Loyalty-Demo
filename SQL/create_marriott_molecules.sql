-- Marriott Hotel Molecules
-- Date: 2025-12-29
-- Tenant ID 3 = Marriott

-- Property molecule (lookup to property table)
INSERT INTO molecule_def (
  tenant_id, molecule_key, label, description, attaches_to, context,
  storage_size, value_type, value_kind, lookup_table_key,
  display_width, is_permanent, molecule_type, value_structure
) VALUES (
  3, 'property', 'Property', 'Hotel property', 'A', 'activity',
  2, 'key', 'lookup', 'property',
  200, false, 'D', 'single'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING;

-- Brand molecule (lookup to brand table)
INSERT INTO molecule_def (
  tenant_id, molecule_key, label, description, attaches_to, context,
  storage_size, value_type, value_kind, lookup_table_key,
  display_width, is_permanent, molecule_type, value_structure
) VALUES (
  3, 'brand', 'Brand', 'Hotel brand', 'A', 'activity',
  2, 'key', 'lookup', 'brand',
  150, false, 'D', 'single'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING;

-- Nights molecule (numeric)
INSERT INTO molecule_def (
  tenant_id, molecule_key, label, description, attaches_to, context,
  storage_size, value_type, value_kind, scalar_type,
  display_width, is_permanent, molecule_type, value_structure
) VALUES (
  3, 'nights', 'Nights', 'Number of nights stayed', 'A', 'activity',
  2, 'numeric', 'value', 'numeric',
  80, false, 'D', 'single'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING;

-- Eligible spend molecule (numeric - stored in cents)
INSERT INTO molecule_def (
  tenant_id, molecule_key, label, description, attaches_to, context,
  storage_size, value_type, value_kind, scalar_type, decimal_places,
  display_width, is_permanent, molecule_type, value_structure
) VALUES (
  3, 'eligible_spend', 'Eligible Spend', 'Total qualifying spend (dollars)', 'A', 'activity',
  4, 'numeric', 'value', 'numeric', 2,
  120, false, 'D', 'single'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING;

-- Folio molecule (text - confirmation number)
INSERT INTO molecule_def (
  tenant_id, molecule_key, label, description, attaches_to, context,
  storage_size, value_type, value_kind, scalar_type,
  display_width, is_permanent, molecule_type, value_structure
) VALUES (
  3, 'folio', 'Folio', 'Confirmation/folio number', 'A', 'activity',
  20, 'text', 'value', 'text',
  150, false, 'D', 'single'
) ON CONFLICT (tenant_id, molecule_key) DO NOTHING;

-- Verify
SELECT molecule_id, molecule_key, label, storage_size, value_type, value_kind 
FROM molecule_def 
WHERE tenant_id = 3 
ORDER BY molecule_id;
