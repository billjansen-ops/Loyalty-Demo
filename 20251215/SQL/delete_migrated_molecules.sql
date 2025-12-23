-- Delete migrated static molecules
-- Run after confirming sysparm migration is working

-- These molecules have been migrated to sysparm table:
-- currency_label, currency_label_singular, activity_type_label
-- retro_days_allowed, max_tier_qualification_days
-- activity_display, error_messages, activity_type, state, sysparm

-- Get molecule_ids first for reference
SELECT molecule_id, molecule_key, context, is_static 
FROM molecule_def 
WHERE molecule_key IN (
  'currency_label', 'currency_label_singular', 'activity_type_label',
  'retro_days_allowed', 'max_tier_qualification_days',
  'activity_display', 'error_messages', 'activity_type', 'state', 'sysparm'
)
AND tenant_id = 1;

-- Delete from value tables first (foreign key dependencies)
DELETE FROM molecule_value_text WHERE molecule_id IN (
  SELECT molecule_id FROM molecule_def 
  WHERE molecule_key IN ('currency_label', 'currency_label_singular', 'activity_type_label', 'error_messages', 'activity_type', 'state')
  AND tenant_id = 1
);

DELETE FROM molecule_value_numeric WHERE molecule_id IN (
  SELECT molecule_id FROM molecule_def 
  WHERE molecule_key IN ('retro_days_allowed', 'max_tier_qualification_days')
  AND tenant_id = 1
);

DELETE FROM molecule_value_embedded_list WHERE molecule_id IN (
  SELECT molecule_id FROM molecule_def 
  WHERE molecule_key IN ('activity_display', 'sysparm')
  AND tenant_id = 1
);

-- Delete molecule definitions
DELETE FROM molecule_def 
WHERE molecule_key IN (
  'currency_label', 'currency_label_singular', 'activity_type_label',
  'retro_days_allowed', 'max_tier_qualification_days',
  'activity_display', 'error_messages', 'activity_type', 'state', 'sysparm'
)
AND tenant_id = 1;

-- Verify deletion
SELECT COUNT(*) as remaining FROM molecule_def 
WHERE molecule_key IN (
  'currency_label', 'currency_label_singular', 'activity_type_label',
  'retro_days_allowed', 'max_tier_qualification_days',
  'activity_display', 'error_messages', 'activity_type', 'state', 'sysparm'
)
AND tenant_id = 1;
