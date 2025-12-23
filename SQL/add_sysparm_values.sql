-- Add system parameters to sysparm embedded list
-- Consolidates debug, retro, and tier parameters that were previously individual molecules
-- Run this with: psql -h localhost -U billjansen -d loyalty -f add_sysparm_values.sql

-- 1. Debug logging switch
INSERT INTO molecule_value_embedded_list (
  molecule_id,
  tenant_id,
  category,
  code,
  description,
  sort_order,
  is_active
) VALUES (
  16,           -- sysparm molecule_id
  1,            -- tenant_id
  'debug',      -- category
  'enabled',    -- code
  'Y',          -- description (value: 'Y' or 'N')
  10,           -- sort_order
  true          -- is_active
)
ON CONFLICT DO NOTHING;

-- 2. Retroactive days allowed
INSERT INTO molecule_value_embedded_list (
  molecule_id,
  tenant_id,
  category,
  code,
  description,
  sort_order,
  is_active
) VALUES (
  16,           -- sysparm molecule_id
  1,            -- tenant_id
  'retro',      -- category
  'days_allowed', -- code
  '90',         -- description (value: number as string)
  20,           -- sort_order
  true          -- is_active
)
ON CONFLICT DO NOTHING;

-- 3. Max tier qualification days
INSERT INTO molecule_value_embedded_list (
  molecule_id,
  tenant_id,
  category,
  code,
  description,
  sort_order,
  is_active
) VALUES (
  16,           -- sysparm molecule_id
  1,            -- tenant_id
  'tier',       -- category
  'max_qualification_days', -- code
  '365',        -- description (value: number as string)
  30,           -- sort_order
  true          -- is_active
)
ON CONFLICT DO NOTHING;

-- Verify what we created
SELECT 
  category,
  code,
  description as value,
  sort_order
FROM molecule_value_embedded_list
WHERE molecule_id = 16
  AND tenant_id = 1
  AND category IN ('debug', 'retro', 'tier')
ORDER BY sort_order;
