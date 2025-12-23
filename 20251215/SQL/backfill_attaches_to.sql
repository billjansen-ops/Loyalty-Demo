-- Backfill attaches_to column based on context for existing molecules
-- Run once after deploying the new server version

-- Set attaches_to = 'A' for activity context molecules
UPDATE molecule_def
SET attaches_to = 'A'
WHERE context = 'activity' AND (attaches_to IS NULL OR attaches_to = '');

-- Set attaches_to = 'M' for member context molecules
UPDATE molecule_def
SET attaches_to = 'M'
WHERE context = 'member' AND (attaches_to IS NULL OR attaches_to = '');

-- Verify
SELECT molecule_key, context, attaches_to
FROM molecule_def
WHERE context IN ('activity', 'member')
ORDER BY context, molecule_key;
