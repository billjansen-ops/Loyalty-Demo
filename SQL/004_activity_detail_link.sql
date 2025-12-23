-- Migration: Add p_link to activity_detail table
-- Date: 2025-12-02

-- Step 1: Add p_link column (5-byte pointer to activity.link)
ALTER TABLE activity_detail ADD COLUMN p_link CHAR(5);

-- Step 2: Create index
CREATE INDEX idx_activity_detail_p_link ON activity_detail(p_link);
