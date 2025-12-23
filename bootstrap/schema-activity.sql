CREATE TABLE IF NOT EXISTS activity (
  activity_id    BIGSERIAL PRIMARY KEY,
  member_id      BIGINT NOT NULL REFERENCES member(member_id) ON DELETE CASCADE,
  activity_date  DATE   NOT NULL,
  kind           TEXT   NOT NULL CHECK (kind IN ('accrual','redemption')),
  subtype        TEXT,
  adjustment_code TEXT,
  point_amount   NUMERIC,
  point_type     TEXT DEFAULT 'miles',
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_member_date_idx ON activity(member_id, activity_date DESC);

CREATE TABLE IF NOT EXISTS activity_detail (
  activity_id BIGINT NOT NULL REFERENCES activity(activity_id) ON DELETE CASCADE,
  k           TEXT   NOT NULL,
  v_ref_id    BIGINT,
  v_text      TEXT,
  v_num       NUMERIC,
  v_date      DATE,
  raw         TEXT,
  PRIMARY KEY (activity_id, k),
  CHECK (
    (v_ref_id IS NOT NULL)::int +
    (v_text   IS NOT NULL)::int +
    (v_num    IS NOT NULL)::int +
    (v_date   IS NOT NULL)::int = 1
  )
);
CREATE INDEX IF NOT EXISTS activity_detail_key_ref_idx ON activity_detail(k, v_ref_id);
CREATE INDEX IF NOT EXISTS activity_detail_activity_idx ON activity_detail(activity_id, k);
