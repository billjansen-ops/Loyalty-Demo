-- =============================================================================
-- MEMBER ALIAS SYSTEM
-- Alternate account numbers that resolve to canonical members
-- Created: 2025-12-16
-- =============================================================================

-- Alias type definitions per tenant
CREATE TABLE alias_composite (
  link SMALLINT PRIMARY KEY,
  tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
  composite_code VARCHAR(20) NOT NULL,
  composite_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE (tenant_id, composite_code)
);

COMMENT ON TABLE alias_composite IS 'Defines valid alias types per tenant (Partner, Carrier, Legacy, etc.)';

-- Which molecules attach to each alias type
CREATE TABLE alias_composite_detail (
  link SMALLINT PRIMARY KEY,
  p_link SMALLINT NOT NULL REFERENCES alias_composite(link) ON DELETE CASCADE,
  molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
  is_required BOOLEAN DEFAULT false,
  is_key BOOLEAN DEFAULT false,
  sort_order SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (p_link, molecule_id)
);

COMMENT ON TABLE alias_composite_detail IS 'Molecules that attach to each alias type. is_key marks uniqueness participant.';

-- The actual aliases
CREATE TABLE member_alias (
  link CHAR(5) PRIMARY KEY,
  p_link CHAR(5) NOT NULL REFERENCES member(link),
  alias_type_link SMALLINT NOT NULL REFERENCES alias_composite(link),
  alias_value VARCHAR(50) NOT NULL,
  key_ref SMALLINT,
  tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id)
);

COMMENT ON TABLE member_alias IS 'Alternate account numbers that resolve to members. Molecules attach via 5_data_* with attaches_to=L';

-- Unique index handles NULL key_ref properly
CREATE UNIQUE INDEX idx_member_alias_unique 
  ON member_alias(tenant_id, alias_type_link, COALESCE(key_ref, 0), alias_value);

-- Index for lookup by alias value
CREATE INDEX idx_member_alias_lookup ON member_alias(tenant_id, alias_value);
