-- Create redemption_point_type join table
CREATE TABLE IF NOT EXISTS redemption_point_type (
    redemption_id INTEGER NOT NULL REFERENCES redemption_rule(redemption_id) ON DELETE CASCADE,
    point_type_id INTEGER NOT NULL REFERENCES point_type(point_type_id) ON DELETE CASCADE,
    PRIMARY KEY (redemption_id, point_type_id)
);

COMMENT ON TABLE redemption_point_type IS 'Restricts which point types can be used for a redemption. If no rows exist for a redemption, all point types are allowed.';
