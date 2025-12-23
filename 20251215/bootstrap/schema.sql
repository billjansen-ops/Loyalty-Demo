CREATE TABLE IF NOT EXISTS tenant (
  tenant_id bigint PRIMARY KEY,
  tenant_key text NOT NULL UNIQUE,
  name text NOT NULL,
  industry text NOT NULL DEFAULT 'airline',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS member (
  member_id bigint PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenant(tenant_id) ON DELETE RESTRICT,
  name text,
  email text,
  address text,
  city text,
  state text,
  postal_code text,
  country text
);
CREATE TABLE IF NOT EXISTS activity (
  activity_id bigserial PRIMARY KEY,
  tenant_id bigint NOT NULL,
  member_id bigint NOT NULL,
  activity_date date NOT NULL,
  carrier_code text,
  class_of_service text,
  origin text,
  destination text,
  points numeric,
  point_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
