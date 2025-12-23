-- ============================================================================
-- MIGRATION: Convert tenant_id from BIGINT/INTEGER to SMALLINT
-- ============================================================================
-- 
-- CURRENT STATE:
--   tenant.tenant_id:          BIGINT (8 bytes)
--   member.tenant_id:          BIGINT (8 bytes)
--   point_type.tenant_id:      BIGINT (8 bytes)
--   tenant_settings.tenant_id: BIGINT (8 bytes)
--   tenant_terms.tenant_id:    BIGINT (8 bytes)
--   bonus.tenant_id:           INTEGER (4 bytes)
--   carriers.tenant_id:        INTEGER (4 bytes)
--   tier_definition.tenant_id: INTEGER (4 bytes)
--
-- TARGET STATE:
--   ALL tenant_id columns:     SMALLINT (2 bytes)
--
-- RATIONALE:
--   - Expected tenants: ~50
--   - SMALLINT max: 32,767
--   - Headroom: 655x over expected usage
--   - Savings: 2-6 bytes per record (depending on current type)
--   - Better cache utilization
--   - Faster joins
--
-- IMPORTANT: Run this during a maintenance window. 
--            Tables will be locked briefly during conversion.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop foreign key constraints (will recreate after conversion)
-- ============================================================================

ALTER TABLE bonus DROP CONSTRAINT IF EXISTS bonus_tenant_id_fkey;
ALTER TABLE carriers DROP CONSTRAINT IF EXISTS carriers_tenant_id_fkey;
ALTER TABLE member DROP CONSTRAINT IF EXISTS member_tenant_fk;
ALTER TABLE point_type DROP CONSTRAINT IF EXISTS point_type_tenant_id_fkey;
ALTER TABLE tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_tenant_id_fkey;
ALTER TABLE tenant_terms DROP CONSTRAINT IF EXISTS tenant_terms_tenant_id_fkey;
ALTER TABLE tier_definition DROP CONSTRAINT IF EXISTS tier_definition_tenant_id_fkey;

-- ============================================================================
-- STEP 2: Convert tenant table (parent) first
-- ============================================================================

-- Convert primary key
ALTER TABLE tenant ALTER COLUMN tenant_id TYPE SMALLINT;

-- Convert sequence
ALTER SEQUENCE tenant_tenant_id_seq AS SMALLINT;

-- ============================================================================
-- STEP 3: Drop RLS policy that depends on tenant_id
-- ============================================================================

DROP POLICY IF EXISTS member_rls_tenant ON member;

-- ============================================================================
-- STEP 4: Convert child tables
-- ============================================================================

-- Tables currently using BIGINT (8 bytes -> 2 bytes = 6 byte savings each)
ALTER TABLE member ALTER COLUMN tenant_id TYPE SMALLINT;
ALTER TABLE point_type ALTER COLUMN tenant_id TYPE SMALLINT;
ALTER TABLE tenant_settings ALTER COLUMN tenant_id TYPE SMALLINT;
ALTER TABLE tenant_terms ALTER COLUMN tenant_id TYPE SMALLINT;

-- Tables currently using INTEGER (4 bytes -> 2 bytes = 2 byte savings each)
ALTER TABLE bonus ALTER COLUMN tenant_id TYPE SMALLINT;
ALTER TABLE carriers ALTER COLUMN tenant_id TYPE SMALLINT;
ALTER TABLE tier_definition ALTER COLUMN tenant_id TYPE SMALLINT;

-- ============================================================================
-- STEP 5: Recreate foreign key constraints
-- ============================================================================

ALTER TABLE bonus 
    ADD CONSTRAINT bonus_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE carriers 
    ADD CONSTRAINT carriers_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE member 
    ADD CONSTRAINT member_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE RESTRICT;

ALTER TABLE point_type 
    ADD CONSTRAINT point_type_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE;

ALTER TABLE tenant_settings 
    ADD CONSTRAINT tenant_settings_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE;

ALTER TABLE tenant_terms 
    ADD CONSTRAINT tenant_terms_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE;

ALTER TABLE tier_definition 
    ADD CONSTRAINT tier_definition_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

-- ============================================================================
-- STEP 6: Recreate RLS policy on member table
-- ============================================================================

CREATE POLICY member_rls_tenant ON member 
    USING (tenant_id = app_current_tenant_id());

-- ============================================================================
-- STEP 7: Update function that returns tenant_id (currently returns BIGINT)
-- ============================================================================

DROP FUNCTION IF EXISTS app_current_tenant_id();

CREATE FUNCTION app_current_tenant_id() RETURNS SMALLINT
    LANGUAGE sql STABLE
    AS $$
  SELECT current_setting('app.tenant_id', true)::SMALLINT
$$;

-- ============================================================================
-- STEP 8: Verify the changes
-- ============================================================================

-- Show all tenant_id columns and their new types (should all be SMALLINT)
SELECT 
    table_name,
    column_name,
    data_type,
    CASE 
        WHEN data_type = 'smallint' THEN '✓ Correct'
        ELSE '✗ Wrong type: ' || data_type
    END as status
FROM information_schema.columns
WHERE column_name = 'tenant_id'
  AND table_schema = 'public'
ORDER BY table_name;

COMMIT;

-- ============================================================================
-- ROLLBACK PLAN (if something goes wrong)
-- ============================================================================
--
-- If you need to rollback, run:
--
-- BEGIN;
-- ALTER TABLE tenant ALTER COLUMN tenant_id TYPE BIGINT;
-- ALTER TABLE member ALTER COLUMN tenant_id TYPE BIGINT;
-- ALTER TABLE point_type ALTER COLUMN tenant_id TYPE BIGINT;
-- ALTER TABLE tenant_settings ALTER COLUMN tenant_id TYPE BIGINT;
-- ALTER TABLE tenant_terms ALTER COLUMN tenant_id TYPE BIGINT;
-- ALTER TABLE bonus ALTER COLUMN tenant_id TYPE INTEGER;
-- ALTER TABLE carriers ALTER COLUMN tenant_id TYPE INTEGER;
-- ALTER TABLE tier_definition ALTER COLUMN tenant_id TYPE INTEGER;
-- -- (recreate FK constraints - see above)
-- COMMIT;
--
-- ============================================================================

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- 1. Update server_db_api.js:
--    - Change any BIGINT references to SMALLINT in queries
--    - Update parseInt() to handle SMALLINT range
--    - SMALLINT range: -32,768 to 32,767
--
-- 2. Future tables:
--    - Always use SMALLINT for new tenant_id columns
--    - Example: CREATE TABLE new_table (tenant_id SMALLINT NOT NULL, ...)
--
-- 3. Benefits achieved:
--    - Reduced storage size
--    - Improved cache efficiency
--    - Faster index operations
--    - Consistent data type across all tables
--
-- 4. Monitor after migration:
--    - Check query performance (should be same or better)
--    - Verify all admin pages still work
--    - Test tenant selection and filtering
--
-- ============================================================================
