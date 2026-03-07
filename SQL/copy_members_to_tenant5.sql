-- Copy Delta members (tenant 1) to Wisconsin PHP (tenant 5)
-- Members only — point buckets, aliases, tiers, molecules start fresh
-- Safe to run multiple times (ON CONFLICT DO NOTHING)

BEGIN;

-- Step 1: Copy members
INSERT INTO member (
  tenant_id, fname, lname, middle_initial,
  address1, address2, city, state, zip, zip_plus4,
  phone, email, is_active, membership_number,
  link, enroll_date, active_through_date
)
SELECT
  5, fname, lname, middle_initial,
  address1, address2, city, state, zip, zip_plus4,
  phone, email, is_active, membership_number,
  link, enroll_date, active_through_date
FROM member
WHERE tenant_id = 1
ON CONFLICT (link) DO NOTHING;

-- Step 2: Update link tank for tenant 5 member
-- Set to max link from tenant 1 members + 1 (or current next_link if higher)
INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
SELECT
  5,
  'member',
  lt.link_bytes,
  GREATEST(
    (SELECT next_link FROM link_tank WHERE tenant_id = 1 AND table_key = 'member'),
    COALESCE((SELECT next_link FROM link_tank WHERE tenant_id = 5 AND table_key = 'member'), 0)
  )
FROM link_tank lt
WHERE lt.tenant_id = 1 AND lt.table_key = 'member'
ON CONFLICT (tenant_id, table_key) DO UPDATE
  SET next_link = EXCLUDED.next_link;

COMMIT;

-- Verify
SELECT 'Members copied:' AS info, COUNT(*) AS count FROM member WHERE tenant_id = 5
UNION ALL
SELECT 'Link tank next_link:', next_link FROM link_tank WHERE tenant_id = 5 AND table_key = 'member';
