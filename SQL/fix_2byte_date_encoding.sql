-- Fix 2-byte date encoding to use full SMALLINT range
-- Stored value = days_since_1959 - 32768
-- This gives ~179 years (1959-2138) instead of ~89 years (1959-2048)
--
-- Dec 3, 1959 = day 0, stored as -32768
-- Dec 3, 2025 = day 24107, stored as -8661
-- ~Sept 2049 = day 32768, stored as 0
-- ~2138 = day 65535, stored as +32767

-- Step 1: Fix the PostgreSQL functions
CREATE OR REPLACE FUNCTION public.date_to_molecule_int(d date) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    RETURN (d - DATE '1959-12-03') - 32768;
END;
$$;

CREATE OR REPLACE FUNCTION public.molecule_int_to_date(n integer) RETURNS date
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    RETURN DATE '1959-12-03' + (n + 32768);
END;
$$;

-- Step 2: Migrate existing SMALLINT date columns (subtract 32768)

-- activity.activity_date
UPDATE activity SET activity_date = activity_date - 32768 WHERE activity_date IS NOT NULL;

-- member_point_bucket.expire_date
UPDATE member_point_bucket SET expire_date = expire_date - 32768 WHERE expire_date IS NOT NULL;

-- bonus_stat.stat_date
UPDATE bonus_stat SET stat_date = stat_date - 32768 WHERE stat_date IS NOT NULL;

-- promotion_stat.stat_date
UPDATE promotion_stat SET stat_date = stat_date - 32768 WHERE stat_date IS NOT NULL;

-- redemption_stat.stat_date
UPDATE redemption_stat SET stat_date = stat_date - 32768 WHERE stat_date IS NOT NULL;

-- Step 3: Add enroll_date column with correct value
-- Dec 3, 2025 = 24107 days since epoch, stored as 24107 - 32768 = -8661
ALTER TABLE member ADD COLUMN IF NOT EXISTS enroll_date SMALLINT;
COMMENT ON COLUMN member.enroll_date IS 'Enrollment date stored as days_since_1959 - 32768';
UPDATE member SET enroll_date = -8661 WHERE enroll_date IS NULL;

-- Verify the fix (function tests only - no data display)
SELECT 'Functions test:' as test;
SELECT date_to_molecule_int('1959-12-03'::date) as "1959-12-03 should be -32768";
SELECT date_to_molecule_int('2025-12-03'::date) as "2025-12-03 should be -8661";
SELECT molecule_int_to_date(-32768) as "stored -32768 should be 1959-12-03";
SELECT molecule_int_to_date(-8661) as "stored -8661 should be 2025-12-03";
SELECT molecule_int_to_date(0) as "stored 0 should be ~2049-09-19";

-- Row counts affected
SELECT 'Rows updated:' as summary;
SELECT 
  (SELECT COUNT(*) FROM activity WHERE activity_date IS NOT NULL) as activity_rows,
  (SELECT COUNT(*) FROM member_point_bucket WHERE expire_date IS NOT NULL) as bucket_rows,
  (SELECT COUNT(*) FROM member WHERE enroll_date IS NOT NULL) as member_rows;
