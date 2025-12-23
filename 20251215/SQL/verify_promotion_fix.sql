-- Verification Script for Promotion Reward Display Fix
-- Run after deploying SQL and server changes

\echo '=== 1. Verify Molecules Created ==='
SELECT molecule_id, molecule_key, label, value_kind, lookup_table_key, context
FROM molecule_def 
WHERE molecule_key IN ('member_promotion', 'promotion')
ORDER BY molecule_key;

\echo '\n=== 2. Verify Lookup Metadata ==='
SELECT 
  mvl.lookup_id, 
  md.molecule_key, 
  mvl.table_name, 
  mvl.id_column,
  mvl.code_column, 
  mvl.label_column,
  mvl.is_tenant_specific
FROM molecule_value_lookup mvl
JOIN molecule_def md ON mvl.molecule_id = md.molecule_id
WHERE md.molecule_key IN ('member_promotion', 'promotion')
ORDER BY md.molecule_key;

\echo '\n=== 3. Check Existing Type M Activities (Before Fix) ==='
SELECT 
  a.activity_id, 
  a.member_id,
  a.activity_date,
  a.activity_type, 
  a.point_amount,
  a.lot_id,
  COUNT(ad.molecule_id) as molecule_count,
  STRING_AGG(md.molecule_key, ', ') as molecules
FROM activity a
LEFT JOIN activity_detail ad ON a.activity_id = ad.activity_id
LEFT JOIN molecule_def md ON ad.molecule_id = md.molecule_id
WHERE a.activity_type = 'M'
GROUP BY a.activity_id, a.member_id, a.activity_date, a.activity_type, a.point_amount, a.lot_id
ORDER BY a.activity_id DESC;

\echo '\n=== 4. Check Active Promotions ==='
SELECT 
  promotion_id,
  promotion_code,
  promotion_name,
  enrollment_type,
  count_type,
  goal_amount,
  reward_type,
  reward_amount,
  is_active
FROM promotion
WHERE is_active = true
ORDER BY promotion_code;

\echo '\n=== 5. Check Member Promotion Enrollments ==='
SELECT 
  mp.member_promotion_id,
  m.membership_number,
  p.promotion_code,
  p.promotion_name,
  mp.progress_counter,
  mp.goal_amount,
  mp.qualify_date,
  mp.process_date
FROM member_promotion mp
JOIN member m ON mp.member_id = m.member_id
JOIN promotion p ON mp.promotion_id = p.promotion_id
ORDER BY mp.member_promotion_id DESC
LIMIT 10;

\echo '\n=== READY TO TEST ==='
\echo 'Next steps:'
\echo '1. Post an activity that qualifies a promotion'
\echo '2. Check that type M activity is created with 2 molecules'
\echo '3. Verify activity list shows promotion details in DETAILS column'
\echo ''
\echo 'Example test query after creating new promotion reward:'
\echo ''
\echo 'SELECT a.activity_id, a.point_amount,'
\echo '       STRING_AGG(md.molecule_key || ''='' || ad.v_ref_id, '', '') as molecule_data'
\echo 'FROM activity a'
\echo 'JOIN activity_detail ad ON a.activity_id = ad.activity_id'
\echo 'JOIN molecule_def md ON ad.molecule_id = md.molecule_id'
\echo 'WHERE a.activity_type = ''M'''
\echo 'GROUP BY a.activity_id, a.point_amount'
\echo 'ORDER BY a.activity_id DESC LIMIT 5;'
