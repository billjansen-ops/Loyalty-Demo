-- ============================================================================
-- MIGRATE TO UNIFIED MOLECULE ARCHITECTURE
-- Moves activity_detail data to activity_detail_list with column definitions
-- ============================================================================

-- Step 1: Add column definitions for all dynamic activity molecules
-- Each gets a single column: v1 = value

-- carrier (lookup)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'carrier' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- destination (lookup)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'destination' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- origin (lookup)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'origin' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- adjustment (lookup)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'adjustment' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- redemption_type (lookup)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'redemption_type' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- partner (lookup)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'partner' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- partner_program (lookup)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'partner_program' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- member_promotion (lookup)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'member_promotion' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- promotion (lookup)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'promotion' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- fare_class (list)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'fare_class' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- flight_number (scalar)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'numeric', 1, 'value'
FROM molecule_def WHERE molecule_key = 'flight_number' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- color (scalar)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'color' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- mqd (scalar)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'numeric', 1, 'value'
FROM molecule_def WHERE molecule_key = 'mqd' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- bonus_activity_id (scalar)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'bonus_activity_id' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- bonus_rule_id (scalar)
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'value'
FROM molecule_def WHERE molecule_key = 'bonus_rule_id' AND tenant_id = 1
ON CONFLICT (molecule_id, column_name) DO NOTHING;

-- Step 2: Set list_context for all dynamic activity molecules
UPDATE molecule_def 
SET list_context = 'activity'
WHERE is_static = false 
  AND context = 'activity' 
  AND tenant_id = 1
  AND list_context IS NULL;

-- Step 3: Migrate activity_detail rows to activity_detail_list
-- Only migrate molecules that aren't already dynamic_list (member_points already there)
INSERT INTO activity_detail_list (activity_id, molecule_id, v1, created_at)
SELECT 
  ad.activity_id,
  ad.molecule_id,
  ad.v_ref_id,
  NOW()
FROM activity_detail ad
JOIN molecule_def md ON ad.molecule_id = md.molecule_id
WHERE md.value_kind != 'dynamic_list'
  AND md.is_static = false
  AND md.context = 'activity'
ON CONFLICT DO NOTHING;

-- Step 4: Verify migration
SELECT 'activity_detail rows' as source, COUNT(*) as count FROM activity_detail
UNION ALL
SELECT 'activity_detail_list rows' as source, COUNT(*) as count FROM activity_detail_list
UNION ALL
SELECT 'column definitions' as source, COUNT(*) as count FROM molecule_column_def;

-- Note: activity_detail table is kept for now as backup
-- Can be dropped later after verification:
-- DROP TABLE activity_detail;
