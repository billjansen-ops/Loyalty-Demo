-- cleanup_dupes.sql v3
-- Deletes duplicate physicians for tenant 5, keeping only the first 8 (lowest links)

-- Duplicate member links subquery (reused below)
-- SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)

-- Step 1: Survey answers
DELETE FROM member_survey_answer WHERE member_survey_link IN (SELECT link FROM member_survey WHERE member_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)));

-- Step 2: Surveys
DELETE FROM member_survey WHERE member_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));

-- Step 3: Activity molecule data
DELETE FROM "5_data_0"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)));
DELETE FROM "5_data_1"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)));
DELETE FROM "5_data_2"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)));
DELETE FROM "5_data_3"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)));
DELETE FROM "5_data_4"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)));
DELETE FROM "5_data_5"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)));
DELETE FROM "5_data_54"  WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)));
DELETE FROM "5_data_222" WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname)));

-- Step 4: Member molecule data
DELETE FROM "5_data_0"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));
DELETE FROM "5_data_1"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));
DELETE FROM "5_data_2"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));
DELETE FROM "5_data_3"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));
DELETE FROM "5_data_4"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));
DELETE FROM "5_data_5"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));
DELETE FROM "5_data_54"  WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));
DELETE FROM "5_data_222" WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));

-- Step 5: Point buckets
DELETE FROM member_point_bucket WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));

-- Step 6: Activities
DELETE FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname));

-- Step 7: Duplicate members
DELETE FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') AND link NOT IN (SELECT MIN(link) FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') GROUP BY fname, lname);

-- Verify
SELECT fname, lname, link FROM member WHERE tenant_id = 5 AND fname IN ('James','Sarah','Marcus','Patricia','David','Elena','Robert','Michelle') ORDER BY link;
