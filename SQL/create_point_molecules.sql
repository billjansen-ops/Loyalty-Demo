-- Point Bucket molecule (member state - replaces point_lot)
INSERT INTO molecule_def (
    tenant_id,
    molecule_key,
    label,
    value_kind,
    context,
    list_context,
    system_required,
    description,
    is_static
) VALUES (
    1,
    'point_bucket',
    'Point Bucket',
    'dynamic_list',
    'member',
    'member',
    true,
    'Tracks point balance by expiration rule (replaces point_lot)',
    false
);

-- Get the molecule_id we just created
-- Then add column definitions
INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'rule_id (point_rule)'
FROM molecule_def WHERE molecule_key = 'point_bucket' AND tenant_id = 1;

INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v3', 'numeric', 3, 'accrued'
FROM molecule_def WHERE molecule_key = 'point_bucket' AND tenant_id = 1;

INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v4', 'numeric', 4, 'redeemed'
FROM molecule_def WHERE molecule_key = 'point_bucket' AND tenant_id = 1;

INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v5', 'date', 5, 'expire_date'
FROM molecule_def WHERE molecule_key = 'point_bucket' AND tenant_id = 1;

-- Points molecule (activity relationship - links activity to bucket)
INSERT INTO molecule_def (
    tenant_id,
    molecule_key,
    label,
    value_kind,
    context,
    list_context,
    system_required,
    description,
    is_static
) VALUES (
    1,
    'points',
    'Points',
    'dynamic_list',
    'activity',
    'activity',
    true,
    'Links activity to point bucket with amount (replaces lot_id, point_amount)',
    false
);

INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v1', 'ref', 1, 'bucket_id (member_detail_list.detail_list_id)'
FROM molecule_def WHERE molecule_key = 'points' AND tenant_id = 1;

INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
SELECT molecule_id, 'v2', 'numeric', 2, 'amount (positive=earn, negative=redeem)'
FROM molecule_def WHERE molecule_key = 'points' AND tenant_id = 1;
