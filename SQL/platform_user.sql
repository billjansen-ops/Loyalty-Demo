-- Platform User table for authentication and audit tracking
-- Run: psql -h 127.0.0.1 -U billjansen -d loyalty -f database/platform_user.sql

-- Create table
CREATE TABLE IF NOT EXISTS platform_user (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255),              -- NULL if external auth only
  display_name VARCHAR(100) NOT NULL,
  tenant_id SMALLINT REFERENCES tenant(tenant_id),  -- NULL = superuser (all tenants)
  role VARCHAR(20) NOT NULL CHECK (role IN ('superuser', 'admin', 'csr')),
  is_active BOOLEAN DEFAULT true,
  
  -- Future: external identity mapping
  external_provider VARCHAR(50),           -- 'okta', 'azure_ad', 'google', etc.
  external_id VARCHAR(255),                -- ID from external system
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Index for login lookup
CREATE INDEX IF NOT EXISTS idx_platform_user_username ON platform_user(username);
CREATE INDEX IF NOT EXISTS idx_platform_user_external ON platform_user(external_provider, external_id);

-- Comment
COMMENT ON TABLE platform_user IS 'Platform users for authentication and audit tracking. Internal user_id is stable regardless of auth method.';

-- NOTE: Seed users are created via the seed_users.js script which properly hashes passwords
-- Run: node database/seed_users.js
