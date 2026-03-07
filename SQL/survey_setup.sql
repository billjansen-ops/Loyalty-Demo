-- ============================================================
-- SURVEY SYSTEM DDL
-- Six new tables + Link Tank entries + Wisconsin PHP tenant
-- Run on: loyalty, loyaltydemo, loyalty_backup
-- ============================================================

-- ============================================================
-- TABLE 1: survey_question_category
-- Lookup table for question categories (Sleep, Burnout, etc.)
-- ============================================================
CREATE TABLE survey_question_category (
    link        SMALLINT    NOT NULL,
    tenant_id   SMALLINT    NOT NULL,
    category_code   VARCHAR(20)  NOT NULL,
    category_name   VARCHAR(100) NOT NULL,
    status      CHAR(1)     NOT NULL DEFAULT 'A',
    CONSTRAINT survey_question_category_pkey PRIMARY KEY (link),
    CONSTRAINT survey_question_category_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
);

-- ============================================================
-- TABLE 2: survey_question
-- The question pool — reusable across surveys
-- ============================================================
CREATE TABLE survey_question (
    link        SMALLINT    NOT NULL,
    tenant_id   SMALLINT    NOT NULL,
    category_link   SMALLINT    NOT NULL,
    question    VARCHAR(500) NOT NULL,
    is_required BOOLEAN     NOT NULL DEFAULT TRUE,
    allow_multiple  BOOLEAN NOT NULL DEFAULT FALSE,
    status      CHAR(1)     NOT NULL DEFAULT 'A',
    CONSTRAINT survey_question_pkey PRIMARY KEY (link),
    CONSTRAINT survey_question_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
    CONSTRAINT survey_question_category_fkey FOREIGN KEY (category_link) REFERENCES survey_question_category(link)
);

-- ============================================================
-- TABLE 3: survey
-- Survey header — PPSI, Provider Pulse, future instruments
-- ============================================================
CREATE TABLE survey (
    link        SMALLINT    NOT NULL,
    tenant_id   SMALLINT    NOT NULL,
    survey_code VARCHAR(20) NOT NULL,
    survey_name VARCHAR(100) NOT NULL,
    survey_description  VARCHAR(500),
    respondent_type     CHAR(1) NOT NULL DEFAULT 'S',
    status      CHAR(1)     NOT NULL DEFAULT 'A',
    CONSTRAINT survey_pkey PRIMARY KEY (link),
    CONSTRAINT survey_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
);

COMMENT ON COLUMN survey.respondent_type IS 'S=self, C=clinician, B=both';

-- ============================================================
-- TABLE 4: survey_question_list
-- Questions assigned to a survey with display order
-- ============================================================
CREATE TABLE survey_question_list (
    link        SMALLINT    NOT NULL,
    tenant_id   SMALLINT    NOT NULL,
    survey_link SMALLINT    NOT NULL,
    question_link   SMALLINT    NOT NULL,
    display_order   SMALLINT    NOT NULL,
    status      CHAR(1)     NOT NULL DEFAULT 'A',
    CONSTRAINT survey_question_list_pkey PRIMARY KEY (link),
    CONSTRAINT survey_question_list_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
    CONSTRAINT survey_question_list_survey_fkey FOREIGN KEY (survey_link) REFERENCES survey(link),
    CONSTRAINT survey_question_list_question_fkey FOREIGN KEY (question_link) REFERENCES survey_question(link)
);

-- ============================================================
-- TABLE 5: survey_question_answer
-- Answer definitions per question (no tenant — inherits from question)
-- ============================================================
CREATE TABLE survey_question_answer (
    link        SMALLINT    NOT NULL,
    question_link   SMALLINT    NOT NULL,
    answer_text VARCHAR(100) NOT NULL,
    answer_value    SMALLINT    NOT NULL,
    display_order   SMALLINT    NOT NULL,
    status      CHAR(1)     NOT NULL DEFAULT 'A',
    CONSTRAINT survey_question_answer_pkey PRIMARY KEY (link),
    CONSTRAINT survey_question_answer_question_fkey FOREIGN KEY (question_link) REFERENCES survey_question(link)
);

-- ============================================================
-- TABLE 6: member_survey
-- A member taking a survey (no tenant — inherits from member)
-- ============================================================
CREATE TABLE member_survey (
    link        INTEGER     NOT NULL,
    member_link CHAR(5)     NOT NULL,
    survey_link SMALLINT    NOT NULL,
    start_ts    INTEGER     NOT NULL,
    end_ts      INTEGER,
    CONSTRAINT member_survey_pkey PRIMARY KEY (link),
    CONSTRAINT member_survey_member_fkey FOREIGN KEY (member_link) REFERENCES member(link),
    CONSTRAINT member_survey_survey_fkey FOREIGN KEY (survey_link) REFERENCES survey(link)
);

-- ============================================================
-- TABLE 7: member_survey_answer
-- Individual answers (no tenant — inherits from member_survey)
-- ============================================================
CREATE TABLE member_survey_answer (
    link        INTEGER     NOT NULL,
    member_survey_link  INTEGER NOT NULL,
    question_link   SMALLINT    NOT NULL,
    answer      VARCHAR(500),
    CONSTRAINT member_survey_answer_pkey PRIMARY KEY (link),
    CONSTRAINT member_survey_answer_survey_fkey FOREIGN KEY (member_survey_link) REFERENCES member_survey(link),
    CONSTRAINT member_survey_answer_question_fkey FOREIGN KEY (question_link) REFERENCES survey_question(link)
);

-- ============================================================
-- TENANT: Wisconsin PHP
-- ============================================================
INSERT INTO tenant (tenant_id, tenant_key, name, industry, is_active) VALUES
    (5, 'wi_php', 'Wisconsin PHP', 'healthcare', TRUE);

-- ============================================================
-- DONE — Verify
-- ============================================================
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'survey%' OR tablename LIKE 'member_survey%'
ORDER BY tablename;
-- ============================================================
-- SURVEY CONTENT LOAD — loyalty database only
-- Tables already created. Wisconsin PHP (tenant 5) already exists.
-- ============================================================

BEGIN;

-- ============================================================
-- CATEGORIES (tenant 5)
-- ============================================================
INSERT INTO survey_question_category (link, tenant_id, category_code, category_name, status) VALUES
    (1, 5, 'SLEEP',       'Sleep Stability', 'A'),
    (2, 5, 'BURNOUT',     'Emotional Exhaustion / Burnout', 'A'),
    (3, 5, 'WORK',        'Work Sustainability', 'A'),
    (4, 5, 'ISOLATION',   'Isolation + Support', 'A'),
    (5, 5, 'COGNITIVE',   'Cognitive Load', 'A'),
    (6, 5, 'RECOVERY',    'Recovery / Routine Stability', 'A'),
    (7, 5, 'PURPOSE',     'Meaning + Purpose', 'A'),
    (8, 5, 'GLOBAL',      'Global Stability Check', 'A'),
    (9, 5, 'ENGAGEMENT',  'Treatment Engagement', 'A'),
    (10, 5, 'MOOD',       'Mood and Safety Signals', 'A'),
    (11, 5, 'FUNCTION',   'Functional Work Stability', 'A'),
    (12, 5, 'PROVIDER',   'Provider Stability Concern', 'A');

-- ============================================================
-- QUESTIONS — PPSI (34 questions)
-- ============================================================
-- Section 1: Sleep Stability
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (1,  5, 1, 'My sleep has not felt restorative', TRUE, FALSE, 'A'),
    (2,  5, 1, 'I had difficulty falling or staying asleep', TRUE, FALSE, 'A'),
    (3,  5, 1, 'I felt physically exhausted during the day', TRUE, FALSE, 'A'),
    (4,  5, 1, 'My sleep schedule was inconsistent', TRUE, FALSE, 'A'),
    (5,  5, 1, 'I had multiple nights with less than 6 hours of sleep', TRUE, FALSE, 'A');

-- Section 2: Emotional Exhaustion / Burnout
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (6,  5, 2, 'I felt emotionally drained by work', TRUE, FALSE, 'A'),
    (7,  5, 2, 'I felt burned out', TRUE, FALSE, 'A'),
    (8,  5, 2, 'I felt fatigued facing my workday', TRUE, FALSE, 'A'),
    (9,  5, 2, 'I felt detached or less engaged with work', TRUE, FALSE, 'A'),
    (10, 5, 2, 'I struggled to find energy or motivation for work', TRUE, FALSE, 'A');

-- Section 3: Work Sustainability
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (11, 5, 3, 'My workload felt difficult to manage', TRUE, FALSE, 'A'),
    (12, 5, 3, 'My schedule felt unpredictable or excessive', TRUE, FALSE, 'A'),
    (13, 5, 3, 'I felt unsupported in my work environment', TRUE, FALSE, 'A'),
    (14, 5, 3, 'My work felt difficult to sustain long-term', TRUE, FALSE, 'A'),
    (15, 5, 3, 'I felt pressure that was difficult to maintain', TRUE, FALSE, 'A');

-- Section 4: Isolation + Support
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (16, 5, 4, 'I felt isolated', TRUE, FALSE, 'A'),
    (17, 5, 4, 'I lacked meaningful peer connection', TRUE, FALSE, 'A'),
    (18, 5, 4, 'I felt unsupported by people I trust', TRUE, FALSE, 'A'),
    (19, 5, 4, 'I went extended periods without meaningful personal connection', TRUE, FALSE, 'A'),
    (20, 5, 4, 'I had limited contact with supportive peers', TRUE, FALSE, 'A');

-- Section 5: Cognitive Load
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (21, 5, 5, 'I had difficulty concentrating', TRUE, FALSE, 'A'),
    (22, 5, 5, 'I felt mentally overloaded', TRUE, FALSE, 'A'),
    (23, 5, 5, 'Decision making felt harder than usual', TRUE, FALSE, 'A'),
    (24, 5, 5, 'I experienced forgetfulness or disorganization', TRUE, FALSE, 'A'),
    (25, 5, 5, 'My cognitive capacity felt reduced', TRUE, FALSE, 'A');

-- Section 6: Recovery / Routine Stability
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (26, 5, 6, 'I struggled to maintain healthy routines', TRUE, FALSE, 'A'),
    (27, 5, 6, 'I skipped important self-care behaviors', TRUE, FALSE, 'A'),
    (28, 5, 6, 'I avoided support when I needed it', TRUE, FALSE, 'A'),
    (29, 5, 6, 'I was inconsistent with treatment or coaching', TRUE, FALSE, 'A');

-- Section 7: Meaning + Purpose
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (30, 5, 7, 'My work felt less meaningful', TRUE, FALSE, 'A'),
    (31, 5, 7, 'I felt disconnected from purpose', TRUE, FALSE, 'A'),
    (32, 5, 7, 'I felt less effective in my role', TRUE, FALSE, 'A'),
    (33, 5, 7, 'I felt uncertain about my professional future', TRUE, FALSE, 'A');

-- Section 8: Global Stability Check
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (34, 5, 8, 'Overall stability right now', TRUE, FALSE, 'A');

-- ============================================================
-- QUESTIONS — Provider Pulse (14 questions)
-- ============================================================
-- Section 1: Treatment Engagement
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (35, 5, 9, 'Appointment attendance stability', TRUE, FALSE, 'A'),
    (36, 5, 9, 'Adherence to treatment recommendations', TRUE, FALSE, 'A'),
    (37, 5, 9, 'Participation in treatment', TRUE, FALSE, 'A');

-- Section 2: Sleep Stability (Provider observed)
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (38, 5, 1, 'Sleep hour reduction', TRUE, FALSE, 'A'),
    (39, 5, 1, 'Routine / daily pattern disruption', TRUE, FALSE, 'A');

-- Section 3: Mood and Safety Signals
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (40, 5, 10, 'Observed mood presentation', TRUE, FALSE, 'A'),
    (41, 5, 10, 'Safety concerns reported or identified', TRUE, FALSE, 'A');

-- Section 4: Cognitive Function
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (42, 5, 5, 'Concentration and focus', TRUE, FALSE, 'A'),
    (43, 5, 5, 'Decision fatigue / cognitive overload', TRUE, FALSE, 'A');

-- Section 5: Functional Work Stability
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (44, 5, 11, 'Ability to manage professional workload', TRUE, FALSE, 'A'),
    (45, 5, 11, 'Work-related distress', TRUE, FALSE, 'A');

-- Section 6: Recovery & Protective Factors
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (46, 5, 6, 'Engagement in stabilizing routines', TRUE, FALSE, 'A'),
    (47, 5, 6, 'Peer / professional support engagement', TRUE, FALSE, 'A');

-- Section 7: Provider Stability Concern
INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status) VALUES
    (48, 5, 12, 'Overall stability concern', TRUE, FALSE, 'A');

-- ============================================================
-- ANSWER DEFINITIONS — Standard 0-3 scale for all questions
-- 4 answers per question x 48 questions = 192 rows
-- ============================================================
DO $$
DECLARE
    q_link SMALLINT;
    base_link SMALLINT;
BEGIN
    FOR q_link IN SELECT link FROM survey_question ORDER BY link LOOP
        base_link := (q_link - 1) * 4 + 1;
        INSERT INTO survey_question_answer (link, question_link, answer_text, answer_value, display_order, status) VALUES
            (base_link,     q_link, 'Stable / no concern',   0, 1, 'A'),
            (base_link + 1, q_link, 'Mild concern',          1, 2, 'A'),
            (base_link + 2, q_link, 'Moderate concern',      2, 3, 'A'),
            (base_link + 3, q_link, 'Significant concern',   3, 4, 'A');
    END LOOP;
END $$;

-- ============================================================
-- SURVEY DEFINITIONS
-- ============================================================
INSERT INTO survey (link, tenant_id, survey_code, survey_name, survey_description, respondent_type, status) VALUES
    (1, 5, 'PPSI', 'Predictive Professional Stability Index',
     '34-item weekly self-report. 8 sections, 0-3 scale, max 102.', 'S', 'A'),
    (2, 5, 'PROVPULSE', 'Provider Pulse Survey',
     '14-item clinician-completed instrument. 7 sections, 0-3 scale, max 42. Monthly or after encounters.', 'C', 'A');

-- ============================================================
-- SURVEY QUESTION LISTS — Assign questions to surveys with order
-- ============================================================
-- PPSI: questions 1-34
INSERT INTO survey_question_list (link, tenant_id, survey_link, question_link, display_order, status) VALUES
    (1,  5, 1, 1,  1,  'A'),
    (2,  5, 1, 2,  2,  'A'),
    (3,  5, 1, 3,  3,  'A'),
    (4,  5, 1, 4,  4,  'A'),
    (5,  5, 1, 5,  5,  'A'),
    (6,  5, 1, 6,  6,  'A'),
    (7,  5, 1, 7,  7,  'A'),
    (8,  5, 1, 8,  8,  'A'),
    (9,  5, 1, 9,  9,  'A'),
    (10, 5, 1, 10, 10, 'A'),
    (11, 5, 1, 11, 11, 'A'),
    (12, 5, 1, 12, 12, 'A'),
    (13, 5, 1, 13, 13, 'A'),
    (14, 5, 1, 14, 14, 'A'),
    (15, 5, 1, 15, 15, 'A'),
    (16, 5, 1, 16, 16, 'A'),
    (17, 5, 1, 17, 17, 'A'),
    (18, 5, 1, 18, 18, 'A'),
    (19, 5, 1, 19, 19, 'A'),
    (20, 5, 1, 20, 20, 'A'),
    (21, 5, 1, 21, 21, 'A'),
    (22, 5, 1, 22, 22, 'A'),
    (23, 5, 1, 23, 23, 'A'),
    (24, 5, 1, 24, 24, 'A'),
    (25, 5, 1, 25, 25, 'A'),
    (26, 5, 1, 26, 26, 'A'),
    (27, 5, 1, 27, 27, 'A'),
    (28, 5, 1, 28, 28, 'A'),
    (29, 5, 1, 29, 29, 'A'),
    (30, 5, 1, 30, 30, 'A'),
    (31, 5, 1, 31, 31, 'A'),
    (32, 5, 1, 32, 32, 'A'),
    (33, 5, 1, 33, 33, 'A'),
    (34, 5, 1, 34, 34, 'A');

-- Provider Pulse: questions 35-48
INSERT INTO survey_question_list (link, tenant_id, survey_link, question_link, display_order, status) VALUES
    (35, 5, 2, 35, 1,  'A'),
    (36, 5, 2, 36, 2,  'A'),
    (37, 5, 2, 37, 3,  'A'),
    (38, 5, 2, 38, 4,  'A'),
    (39, 5, 2, 39, 5,  'A'),
    (40, 5, 2, 40, 6,  'A'),
    (41, 5, 2, 41, 7,  'A'),
    (42, 5, 2, 42, 8,  'A'),
    (43, 5, 2, 43, 9,  'A'),
    (44, 5, 2, 44, 10, 'A'),
    (45, 5, 2, 45, 11, 'A'),
    (46, 5, 2, 46, 12, 'A'),
    (47, 5, 2, 47, 13, 'A'),
    (48, 5, 2, 48, 14, 'A');

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'Categories' as what, count(*) as cnt FROM survey_question_category
UNION ALL
SELECT 'Questions', count(*) FROM survey_question
UNION ALL
SELECT 'Answers', count(*) FROM survey_question_answer
UNION ALL
SELECT 'Surveys', count(*) FROM survey
UNION ALL
SELECT 'Question Lists', count(*) FROM survey_question_list;
