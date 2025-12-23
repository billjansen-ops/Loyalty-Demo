-- Migration: Add link and p_link to activity table
-- Date: 2025-12-02

-- Step 1: Add link column (5-byte squished primary key)
ALTER TABLE activity ADD COLUMN link CHAR(5);

-- Step 2: Add p_link column (5-byte pointer to member.link)
ALTER TABLE activity ADD COLUMN p_link CHAR(5);

-- Step 3: Create indexes
CREATE INDEX idx_activity_link ON activity(tenant_id, link);
CREATE INDEX idx_activity_p_link ON activity(tenant_id, p_link);

-- Backfill and link_tank priming will be done via Node.js script
