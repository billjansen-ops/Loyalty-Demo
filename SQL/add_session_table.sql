-- ============================================================
-- Session Table for express-session + connect-pg-simple
-- Run against: loyalty, loyaltytest, loyaltybackup
-- ============================================================

CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR NOT NULL COLLATE "default",
  sess   JSON    NOT NULL,
  expire TIMESTAMP(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- ============================================================
-- Usage:
--   psql -h 127.0.0.1 -U billjansen -d loyalty        -f SQL/add_session_table.sql
--   psql -h 127.0.0.1 -U billjansen -d loyaltytest    -f SQL/add_session_table.sql
--   psql -h 127.0.0.1 -U billjansen -d loyaltybackup  -f SQL/add_session_table.sql
-- ============================================================
