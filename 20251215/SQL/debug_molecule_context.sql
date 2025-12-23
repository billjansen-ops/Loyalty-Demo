-- Check what context values exist for molecules
SELECT 
  context,
  COUNT(*) as molecule_count,
  STRING_AGG(molecule_key, ', ' ORDER BY molecule_key) as molecules
FROM molecule_def
WHERE is_active = true
GROUP BY context
ORDER BY context;

-- Check specifically for Activity molecules
SELECT 
  molecule_id,
  molecule_key,
  label,
  context,
  value_kind,
  tenant_id
FROM molecule_def
WHERE context ILIKE '%activity%'
  AND is_active = true
ORDER BY molecule_key;

-- Check all contexts
SELECT DISTINCT context 
FROM molecule_def 
ORDER BY context;
