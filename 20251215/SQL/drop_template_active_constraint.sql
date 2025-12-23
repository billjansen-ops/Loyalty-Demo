-- Drop unique index constraint on display_template
-- Business logic should be in application code, not database constraints

DROP INDEX IF EXISTS idx_display_template_active_unique;

-- Application code in server_db_api.js activate endpoint already handles deactivating
-- other templates of the same tenant/activity_type/template_type combination
