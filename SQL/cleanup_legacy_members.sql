-- Delete all tenant 5 members except the 8 physicians (membership numbers 34-41)

DELETE FROM member_survey_answer WHERE member_survey_link IN (SELECT link FROM member_survey WHERE member_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41')));
DELETE FROM member_survey WHERE member_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM "5_data_0"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41')));
DELETE FROM "5_data_1"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41')));
DELETE FROM "5_data_2"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41')));
DELETE FROM "5_data_3"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41')));
DELETE FROM "5_data_4"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41')));
DELETE FROM "5_data_5"   WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41')));
DELETE FROM "5_data_54"  WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41')));
DELETE FROM "5_data_222" WHERE p_link IN (SELECT link FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41')));
DELETE FROM "5_data_0"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM "5_data_1"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM "5_data_2"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM "5_data_3"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM "5_data_4"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM "5_data_5"   WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM "5_data_54"  WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM "5_data_222" WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM member_point_bucket WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM activity WHERE p_link IN (SELECT link FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41'));
DELETE FROM member WHERE tenant_id = 5 AND membership_number NOT IN ('34','35','36','37','38','39','40','41');

SELECT membership_number, fname, lname FROM member WHERE tenant_id = 5 ORDER BY link;
