-- Stability Registry — the central table for physician status tracking
-- Created: Session 83, March 10, 2026

CREATE TABLE stability_registry (
    link INTEGER PRIMARY KEY,
    member_link CHAR(5) NOT NULL REFERENCES member(link),
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    urgency VARCHAR(10) NOT NULL,           -- SENTINEL, RED, ORANGE, YELLOW
    source_stream VARCHAR(10) NOT NULL,     -- PPSI, PULSE, COMP, EVENT, MEDS, COMPOSITE
    reason_code VARCHAR(30) NOT NULL,       -- e.g., SENTINEL_POSITIVE, PPII_RED, MISSED_SURVEY
    reason_text TEXT,                        -- Human-readable description
    activity_link CHAR(5),                  -- Activity that triggered this, nullable
    score_at_creation SMALLINT,             -- PPII score when item was created
    sla_hours SMALLINT NOT NULL DEFAULT 72, -- 0=immediate, 24=same day, 48, 72
    sla_deadline TIMESTAMP,                 -- When the SLA expires
    created_date SMALLINT NOT NULL,         -- Bill epoch
    created_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_to INTEGER REFERENCES platform_user(user_id),
    assigned_ts TIMESTAMP,
    resolved_ts TIMESTAMP,
    resolution_code VARCHAR(20),            -- WORKED, ESCALATED, AUTO_CLEARED
    resolution_notes TEXT,
    status CHAR(1) NOT NULL DEFAULT 'O'     -- O=Open, A=Assigned, R=Resolved
);

-- Index for the primary query: open items by physician
CREATE INDEX idx_sr_member_status ON stability_registry(member_link, status) WHERE status != 'R';

-- Index for tenant-wide queue view
CREATE INDEX idx_sr_tenant_status ON stability_registry(tenant_id, status, urgency) WHERE status != 'R';

-- Index for SLA monitoring
CREATE INDEX idx_sr_sla ON stability_registry(sla_deadline) WHERE status != 'R';

-- Add link_tank entry for stability_registry
INSERT INTO link_tank (table_name, next_id)
VALUES ('stability_registry', -2147483648)
ON CONFLICT (table_name) DO NOTHING;
