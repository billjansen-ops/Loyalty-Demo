-- Fix 2-byte link encoding
-- Problem: 2-byte links were created starting at 1,2,3... instead of -32768,-32767,-32766...
-- Solution: Subtract 32768 from all existing 2-byte link and p_link values

BEGIN;

-- Drop FK constraints first
ALTER TABLE composite_detail DROP CONSTRAINT IF EXISTS composite_detail_p_link_fkey;
ALTER TABLE alias_composite_detail DROP CONSTRAINT IF EXISTS alias_composite_detail_p_link_fkey;
ALTER TABLE input_template_field DROP CONSTRAINT IF EXISTS input_template_field_composite_link_fkey;
ALTER TABLE member_alias DROP CONSTRAINT IF EXISTS member_alias_alias_type_link_fkey;

-- Fix all 2-byte tables
UPDATE composite SET link = link - 32768 WHERE link > -32768;
UPDATE composite_detail SET link = link - 32768 WHERE link > -32768;
UPDATE composite_detail SET p_link = p_link - 32768 WHERE p_link > -32768;

UPDATE alias_composite SET link = link - 32768 WHERE link > -32768;
UPDATE alias_composite_detail SET link = link - 32768 WHERE link > -32768;
UPDATE alias_composite_detail SET p_link = p_link - 32768 WHERE p_link > -32768;

UPDATE member_alias SET alias_type_link = alias_type_link - 32768 
WHERE alias_type_link > -32768;

UPDATE input_template_field SET composite_link = composite_link - 32768 
WHERE composite_link IS NOT NULL AND composite_link > -32768;

-- Fix link_tank.next_link for 2-byte tables
UPDATE link_tank SET next_link = next_link - 32768 WHERE link_bytes = 2;

-- Add composite to link_tank if not present
INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
SELECT 1, 'composite', 2, COALESCE(MAX(link), -32768) + 1
FROM composite
WHERE NOT EXISTS (SELECT 1 FROM link_tank WHERE table_key = 'composite')
ON CONFLICT DO NOTHING;

-- Recreate FK constraints
ALTER TABLE composite_detail ADD CONSTRAINT composite_detail_p_link_fkey 
  FOREIGN KEY (p_link) REFERENCES composite(link);
ALTER TABLE alias_composite_detail ADD CONSTRAINT alias_composite_detail_p_link_fkey 
  FOREIGN KEY (p_link) REFERENCES alias_composite(link) ON DELETE CASCADE;
ALTER TABLE input_template_field ADD CONSTRAINT input_template_field_composite_link_fkey 
  FOREIGN KEY (composite_link) REFERENCES composite_detail(link);
ALTER TABLE member_alias ADD CONSTRAINT member_alias_alias_type_link_fkey 
  FOREIGN KEY (alias_type_link) REFERENCES alias_composite(link);

COMMIT;

-- Verify row counts
SELECT 'link_tank 2-byte:' as check, COUNT(*) as rows FROM link_tank WHERE link_bytes = 2;
SELECT 'composite:' as check, COUNT(*) as rows, MIN(link) as min_link FROM composite;
SELECT 'composite_detail:' as check, COUNT(*) as rows, MIN(link) as min_link, MIN(p_link) as min_plink FROM composite_detail;
SELECT 'alias_composite:' as check, COUNT(*) as rows, MIN(link) as min_link FROM alias_composite;
SELECT 'member_alias:' as check, COUNT(*) as rows, MIN(alias_type_link) as min_type_link FROM member_alias;
