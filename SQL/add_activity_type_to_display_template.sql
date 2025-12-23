-- Add activity_type column to display_template
-- Activity types come from activity_display molecule (source of truth)

ALTER TABLE display_template 
ADD COLUMN activity_type CHAR(1) NOT NULL DEFAULT 'A';

COMMENT ON COLUMN display_template.activity_type IS 'Activity type this template applies to - valid values from activity_display molecule categories';

-- Update existing templates to be 'A' type (they were for flights/activities)
UPDATE display_template SET activity_type = 'A' WHERE activity_type = 'A';

-- Now we can have unique constraint: one active template per tenant, per activity type, per template type
-- This ensures only one active efficient 'A' template, one active verbose 'A' template, etc.
CREATE UNIQUE INDEX idx_display_template_active_unique 
ON display_template (tenant_id, activity_type, template_type) 
WHERE is_active = true;

COMMENT ON INDEX idx_display_template_active_unique IS 'Ensures only one active template per tenant/activity_type/template_type combination';
