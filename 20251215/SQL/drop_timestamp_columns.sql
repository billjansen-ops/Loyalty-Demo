-- Drop created_at and updated_at columns from ALL tables
-- These columns are not used by the loyalty platform

-- Public schema tables
ALTER TABLE public.activity_bonus DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.activity_bonus DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.airports DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.airports DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.bonus DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.bonus DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.carriers DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.carriers DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.display_template DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.display_template DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.molecule_def DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.molecule_def DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.molecule_value_boolean DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.molecule_value_boolean DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.molecule_value_date DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.molecule_value_date DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.molecule_value_embedded_list DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.molecule_value_embedded_list DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.molecule_value_lookup DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.molecule_value_lookup DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.molecule_value_numeric DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.molecule_value_numeric DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.molecule_value_ref DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.molecule_value_ref DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.molecule_value_text DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.molecule_value_text DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.redemption_detail DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.redemption_detail DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.redemption_rule DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.redemption_rule DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.rule DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.rule DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.rule_criteria DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.rule_criteria DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.settings DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.settings DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.tenant DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.tenant DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.tier_definition DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.tier_definition DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.x_tenant_settings DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.x_tenant_settings DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.x_tenant_terms DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.x_tenant_terms DROP COLUMN IF EXISTS updated_at;

-- t_delta schema tables
ALTER TABLE t_delta.activity_attr DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_delta.activity_attr DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_delta.airports DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_delta.airports DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_delta.attr_def DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_delta.attr_def DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_delta.carriers DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_delta.carriers DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_delta.label_map DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_delta.label_map DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_delta.member_attr DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_delta.member_attr DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_delta.theme DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_delta.theme DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_delta.tier_levels DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_delta.tier_levels DROP COLUMN IF EXISTS updated_at;

-- t_demo schema tables
ALTER TABLE t_demo.activity_attr DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_demo.activity_attr DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_demo.airports DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_demo.airports DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_demo.attr_def DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_demo.attr_def DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_demo.carriers DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_demo.carriers DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_demo.label_map DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_demo.label_map DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_demo.member_attr DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_demo.member_attr DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_demo.theme DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_demo.theme DROP COLUMN IF EXISTS updated_at;

ALTER TABLE t_demo.tier_levels DROP COLUMN IF EXISTS created_at;
ALTER TABLE t_demo.tier_levels DROP COLUMN IF EXISTS updated_at;

-- Verification query
SELECT 
  table_schema,
  table_name, 
  column_name
FROM information_schema.columns 
WHERE column_name IN ('created_at', 'updated_at')
  AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
