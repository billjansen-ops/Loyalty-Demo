-- ============================================================================
-- MOLECULE SYSTEM MIGRATION
-- ============================================================================
-- This migration evolves molecule_def and creates the molecule_value_* tables
-- for the unified molecule architecture supporting multi-tenant, multi-industry
--
-- SAFE TO RUN: Uses IF NOT EXISTS and adds columns with defaults
-- ============================================================================

-- ============================================================================
-- STEP 1: Add new columns to existing molecule_def table
-- ============================================================================

-- Add tenant_id (required for multi-tenant)
ALTER TABLE molecule_def 
ADD COLUMN IF NOT EXISTS tenant_id SMALLINT;

-- Set default tenant_id for existing rows (Delta = 1)
UPDATE molecule_def 
SET tenant_id = 1 
WHERE tenant_id IS NULL;

-- Make tenant_id required and add FK
ALTER TABLE molecule_def 
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE molecule_def
ADD CONSTRAINT IF NOT EXISTS molecule_def_tenant_fk 
FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

-- Add context (activity, member, tenant)
ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS context text;

UPDATE molecule_def
SET context = 'activity'
WHERE context IS NULL;

ALTER TABLE molecule_def
ALTER COLUMN context SET NOT NULL;

-- Add behavioral flags
ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS is_static boolean DEFAULT false;

ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS is_permanent boolean DEFAULT false;

ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT false;

ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Set existing activity molecules as permanent
UPDATE molecule_def
SET is_permanent = true
WHERE molecule_key IN ('carrier', 'origin', 'destination', 'fare_class', 'flight_number');

-- Add foreign_schema for tenant-specific FK lookups
ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS foreign_schema text;

-- Add description for help text
ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS description text;

-- Add display_order for UI sorting
ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add updated_at timestamp
ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- ============================================================================
-- STEP 2: Update primary key structure
-- ============================================================================

-- Add molecule_id as new primary key if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'molecule_def' 
                 AND column_name = 'molecule_id') THEN
    ALTER TABLE molecule_def ADD COLUMN molecule_id SERIAL;
    
    -- Drop old PK if it exists
    ALTER TABLE molecule_def DROP CONSTRAINT IF EXISTS molecule_def_pkey;
    
    -- Set new PK
    ALTER TABLE molecule_def ADD PRIMARY KEY (molecule_id);
  END IF;
END $$;

-- Create unique constraint on (tenant_id, molecule_key)
DROP INDEX IF EXISTS molecule_def_tenant_key_uq;
CREATE UNIQUE INDEX molecule_def_tenant_key_uq 
ON molecule_def (tenant_id, molecule_key);

-- ============================================================================
-- STEP 3: Create indexes for molecule_def
-- ============================================================================

CREATE INDEX IF NOT EXISTS molecule_def_tenant_idx 
ON molecule_def(tenant_id);

CREATE INDEX IF NOT EXISTS molecule_def_context_idx 
ON molecule_def(tenant_id, context);

CREATE INDEX IF NOT EXISTS molecule_def_static_idx 
ON molecule_def(tenant_id, is_static);

-- ============================================================================
-- STEP 4: Create molecule_value_text table
-- ============================================================================

CREATE TABLE IF NOT EXISTS molecule_value_text (
    value_id        SERIAL PRIMARY KEY,
    molecule_id     INTEGER NOT NULL,
    text_value      text NOT NULL,
    display_label   text,
    sort_order      INTEGER DEFAULT 0,
    is_active       boolean DEFAULT true,
    created_at      timestamp DEFAULT now(),
    updated_at      timestamp DEFAULT now(),
    
    CONSTRAINT molecule_value_text_molecule_fk 
    FOREIGN KEY (molecule_id) 
    REFERENCES molecule_def(molecule_id) 
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS molecule_value_text_molecule_idx 
ON molecule_value_text(molecule_id);

CREATE INDEX IF NOT EXISTS molecule_value_text_sort_idx 
ON molecule_value_text(molecule_id, sort_order);

-- ============================================================================
-- STEP 5: Create molecule_value_numeric table
-- ============================================================================

CREATE TABLE IF NOT EXISTS molecule_value_numeric (
    value_id        SERIAL PRIMARY KEY,
    molecule_id     INTEGER NOT NULL,
    numeric_value   numeric NOT NULL,
    is_active       boolean DEFAULT true,
    created_at      timestamp DEFAULT now(),
    updated_at      timestamp DEFAULT now(),
    
    CONSTRAINT molecule_value_numeric_molecule_fk 
    FOREIGN KEY (molecule_id) 
    REFERENCES molecule_def(molecule_id) 
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS molecule_value_numeric_molecule_idx 
ON molecule_value_numeric(molecule_id);

-- ============================================================================
-- STEP 6: Create molecule_value_date table
-- ============================================================================

CREATE TABLE IF NOT EXISTS molecule_value_date (
    value_id        SERIAL PRIMARY KEY,
    molecule_id     INTEGER NOT NULL,
    date_value      date NOT NULL,
    is_active       boolean DEFAULT true,
    created_at      timestamp DEFAULT now(),
    updated_at      timestamp DEFAULT now(),
    
    CONSTRAINT molecule_value_date_molecule_fk 
    FOREIGN KEY (molecule_id) 
    REFERENCES molecule_def(molecule_id) 
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS molecule_value_date_molecule_idx 
ON molecule_value_date(molecule_id);

-- ============================================================================
-- STEP 7: Create molecule_value_boolean table
-- ============================================================================

CREATE TABLE IF NOT EXISTS molecule_value_boolean (
    value_id        SERIAL PRIMARY KEY,
    molecule_id     INTEGER NOT NULL,
    bool_value      boolean NOT NULL,
    is_active       boolean DEFAULT true,
    created_at      timestamp DEFAULT now(),
    updated_at      timestamp DEFAULT now(),
    
    CONSTRAINT molecule_value_boolean_molecule_fk 
    FOREIGN KEY (molecule_id) 
    REFERENCES molecule_def(molecule_id) 
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS molecule_value_boolean_molecule_idx 
ON molecule_value_boolean(molecule_id);

-- ============================================================================
-- STEP 8: Create molecule_value_ref table (for FK references)
-- ============================================================================

CREATE TABLE IF NOT EXISTS molecule_value_ref (
    value_id        SERIAL PRIMARY KEY,
    molecule_id     INTEGER NOT NULL,
    ref_id          bigint NOT NULL,
    display_label   text,
    sort_order      INTEGER DEFAULT 0,
    is_active       boolean DEFAULT true,
    created_at      timestamp DEFAULT now(),
    updated_at      timestamp DEFAULT now(),
    
    CONSTRAINT molecule_value_ref_molecule_fk 
    FOREIGN KEY (molecule_id) 
    REFERENCES molecule_def(molecule_id) 
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS molecule_value_ref_molecule_idx 
ON molecule_value_ref(molecule_id);

CREATE INDEX IF NOT EXISTS molecule_value_ref_sort_idx 
ON molecule_value_ref(molecule_id, sort_order);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show updated molecule_def structure
\d molecule_def

-- Show new tables
\d molecule_value_text
\d molecule_value_numeric
\d molecule_value_date
\d molecule_value_boolean
\d molecule_value_ref

-- Show existing molecules with new columns
SELECT 
    molecule_id,
    tenant_id,
    molecule_key,
    label,
    value_kind,
    context,
    is_static,
    is_permanent
FROM molecule_def
ORDER BY tenant_id, molecule_key;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
