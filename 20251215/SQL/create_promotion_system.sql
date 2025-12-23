-- ============================================================================
-- PROMOTION SYSTEM SCHEMA
-- Created: 2025-11-18
-- Purpose: Multi-activity campaign tracking with progressive goals and rewards
-- ============================================================================

-- Add mqd (Medallion Qualifying Dollars) field to activity table
-- Used for revenue-based counting (count_type='mqd')
ALTER TABLE activity ADD COLUMN IF NOT EXISTS mqd NUMERIC DEFAULT 0;
COMMENT ON COLUMN activity.mqd IS 'Revenue/spend amount for revenue-based promotions (e.g., Medallion Qualifying Dollars)';

-- ============================================================================
-- PROMOTION TABLE
-- Defines promotion campaigns with goals and rewards
-- ============================================================================
CREATE TABLE IF NOT EXISTS promotion (
    promotion_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    promotion_code VARCHAR(20) NOT NULL,
    promotion_name VARCHAR(100) NOT NULL,
    promotion_description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Enrollment
    enrollment_type CHAR(1) NOT NULL CHECK (enrollment_type IN ('A', 'R')),
    allow_member_enrollment BOOLEAN NOT NULL DEFAULT false,
    
    -- Rule linkage (shared with bonus system)
    rule_id INTEGER REFERENCES rule(rule_id),
    
    -- Counting logic
    count_type VARCHAR(20) NOT NULL CHECK (count_type IN ('flights', 'miles', 'enrollments', 'mqd')),
    goal_amount NUMERIC NOT NULL CHECK (goal_amount > 0),
    
    -- Rewards
    reward_type VARCHAR(30) NOT NULL CHECK (reward_type IN ('points', 'tier', 'external', 'enroll_promotion')),
    reward_amount BIGINT CHECK ((reward_type = 'points' AND reward_amount > 0) OR (reward_type != 'points' AND reward_amount IS NULL)),
    reward_tier_id INTEGER REFERENCES tier_definition(tier_id),
    reward_promotion_id INTEGER REFERENCES promotion(promotion_id),
    
    -- Repeatability
    process_limit_count INTEGER CHECK (process_limit_count IS NULL OR process_limit_count > 0),
    
    -- Duration (for tier rewards)
    duration_type VARCHAR(10) CHECK (duration_type IS NULL OR duration_type IN ('calendar', 'virtual')),
    duration_end_date DATE,
    duration_days INTEGER CHECK (duration_days IS NULL OR duration_days > 0),
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_promotion_code_per_tenant UNIQUE (tenant_id, promotion_code),
    CONSTRAINT valid_tier_reward CHECK (
        (reward_type = 'tier' AND reward_tier_id IS NOT NULL AND duration_type IS NOT NULL) OR
        (reward_type != 'tier' AND reward_tier_id IS NULL)
    ),
    CONSTRAINT valid_enroll_promotion_reward CHECK (
        (reward_type = 'enroll_promotion' AND reward_promotion_id IS NOT NULL) OR
        (reward_type != 'enroll_promotion' AND reward_promotion_id IS NULL)
    ),
    CONSTRAINT valid_duration_config CHECK (
        (duration_type = 'calendar' AND duration_end_date IS NOT NULL AND duration_days IS NULL) OR
        (duration_type = 'virtual' AND duration_days IS NOT NULL AND duration_end_date IS NULL) OR
        (duration_type IS NULL AND duration_end_date IS NULL AND duration_days IS NULL)
    )
);

CREATE INDEX idx_promotion_tenant ON promotion(tenant_id);
CREATE INDEX idx_promotion_active ON promotion(tenant_id, is_active);
CREATE INDEX idx_promotion_dates ON promotion(tenant_id, start_date, end_date);

COMMENT ON TABLE promotion IS 'Promotion campaigns with multi-activity goals and various reward types';
COMMENT ON COLUMN promotion.enrollment_type IS 'A=Auto-enroll on first qualifying activity, R=Restricted (manual/raise-hand only)';
COMMENT ON COLUMN promotion.allow_member_enrollment IS 'For restricted promotions: allow member self-enrollment (raise your hand)';
COMMENT ON COLUMN promotion.count_type IS 'What to count: flights (activity count), miles (points), enrollments (referrals), mqd (revenue)';
COMMENT ON COLUMN promotion.reward_type IS 'What member gets: points (activity M), tier (member_tier), external (certificate), enroll_promotion (unlock next)';
COMMENT ON COLUMN promotion.process_limit_count IS 'Max times member can complete (NULL=unlimited, supports carryover)';
COMMENT ON COLUMN promotion.duration_type IS 'For tier rewards: calendar (fixed end date) or virtual (days from qualify)';

-- ============================================================================
-- MEMBER_PROMOTION TABLE
-- Tracks individual member enrollment and progress toward goals
-- ============================================================================
CREATE TABLE IF NOT EXISTS member_promotion (
    member_promotion_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES member(member_id),
    promotion_id INTEGER NOT NULL REFERENCES promotion(promotion_id),
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    
    -- Key dates
    enrolled_date DATE NOT NULL,
    qualify_date DATE,
    process_date DATE,
    
    -- Progress tracking
    progress_counter NUMERIC NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'qualified', 'processed')),
    
    -- Audit trail for manual actions
    enrolled_by_user_id INTEGER,
    qualified_by_user_id INTEGER,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_member_promotion_dates CHECK (
        (qualify_date IS NULL OR qualify_date >= enrolled_date) AND
        (process_date IS NULL OR process_date >= enrolled_date)
    ),
    CONSTRAINT valid_member_promotion_status CHECK (
        (status = 'enrolled' AND qualify_date IS NULL AND process_date IS NULL) OR
        (status = 'qualified' AND qualify_date IS NOT NULL) OR
        (status = 'processed' AND qualify_date IS NOT NULL AND process_date IS NOT NULL)
    )
);

CREATE INDEX idx_member_promotion_member ON member_promotion(member_id, promotion_id);
CREATE INDEX idx_member_promotion_status ON member_promotion(member_id, status);
CREATE INDEX idx_member_promotion_promotion ON member_promotion(promotion_id, status);
CREATE INDEX idx_member_promotion_tenant ON member_promotion(tenant_id);

COMMENT ON TABLE member_promotion IS 'Individual member enrollment and progress tracking for promotions';
COMMENT ON COLUMN member_promotion.enrolled_date IS 'When member joined promotion (auto or manual)';
COMMENT ON COLUMN member_promotion.qualify_date IS 'When member reached goal (progress_counter >= goal_amount)';
COMMENT ON COLUMN member_promotion.process_date IS 'When reward was delivered/fulfilled';
COMMENT ON COLUMN member_promotion.progress_counter IS 'Current progress toward goal (flights count, miles sum, etc.)';
COMMENT ON COLUMN member_promotion.enrolled_by_user_id IS 'CSR who manually enrolled (NULL=auto-enroll)';
COMMENT ON COLUMN member_promotion.qualified_by_user_id IS 'CSR who manually qualified (NULL=auto-qualify)';

-- ============================================================================
-- MEMBER_PROMOTION_DETAIL TABLE
-- Links activities to promotions showing contribution amounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS member_promotion_detail (
    detail_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_promotion_id BIGINT NOT NULL REFERENCES member_promotion(member_promotion_id),
    activity_id BIGINT REFERENCES activity(activity_id),
    contribution_amount NUMERIC NOT NULL,
    
    -- For enrollment counting (referrals)
    enrolled_member_id BIGINT REFERENCES member(member_id),
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_promotion_detail_link CHECK (
        (activity_id IS NOT NULL AND enrolled_member_id IS NULL) OR
        (activity_id IS NULL AND enrolled_member_id IS NOT NULL)
    )
);

CREATE INDEX idx_promotion_detail_promotion ON member_promotion_detail(member_promotion_id);
CREATE INDEX idx_promotion_detail_activity ON member_promotion_detail(activity_id);
CREATE INDEX idx_promotion_detail_enrolled_member ON member_promotion_detail(enrolled_member_id);

COMMENT ON TABLE member_promotion_detail IS 'Attribution linking activities to promotions with contribution amounts';
COMMENT ON COLUMN member_promotion_detail.activity_id IS 'Activity that contributed (NULL for enrollment counting)';
COMMENT ON COLUMN member_promotion_detail.contribution_amount IS 'How much this activity/enrollment contributed to progress';
COMMENT ON COLUMN member_promotion_detail.enrolled_member_id IS 'For referral counting: who was enrolled (NULL for activity counting)';

-- ============================================================================
-- PROMOTION MOLECULE DEFINITION
-- Lookup molecule for promotion rewards (activity type M)
-- ============================================================================
INSERT INTO molecule_def (
    molecule_key,
    label,
    value_kind,
    tenant_id,
    context,
    is_static,
    is_permanent,
    is_required,
    is_active,
    description,
    display_order
) VALUES (
    'promotion',
    'Promotion',
    'lookup',
    1, -- tenant_id (update if needed)
    'activity',
    false,
    false,
    false,
    true,
    'Links promotion reward activities (type M) to member_promotion record',
    100
) ON CONFLICT (molecule_key, tenant_id) DO NOTHING;

-- ============================================================================
-- PROMOTION MOLECULE VALUE LOOKUP
-- Points to member_promotion table
-- ============================================================================
INSERT INTO molecule_value_lookup (
    molecule_id,
    table_name,
    id_column,
    code_column,
    description_column,
    is_tenant_specific
) 
SELECT 
    molecule_id,
    'member_promotion',
    'member_promotion_id',
    'member_promotion_id', -- Using ID as code since member_promotion doesn't have a code field
    'member_promotion_id', -- Using ID as description too
    true
FROM molecule_def 
WHERE molecule_key = 'promotion' AND tenant_id = 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ACTIVITY DISPLAY CONFIGURATION FOR TYPE 'M'
-- ============================================================================
INSERT INTO molecule_value_embedded_list (
    molecule_id,
    tenant_id,
    category,
    code,
    description,
    sort_order,
    is_active
)
SELECT 
    m.molecule_id,
    1,
    'M',
    'label',
    'Promotion',
    1,
    true
FROM molecule_def m
WHERE m.molecule_key = 'activity_display' AND m.tenant_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO molecule_value_embedded_list (
    molecule_id,
    tenant_id,
    category,
    code,
    description,
    sort_order,
    is_active
)
SELECT 
    m.molecule_id,
    1,
    'M',
    'icon',
    '🎯',
    2,
    true
FROM molecule_def m
WHERE m.molecule_key = 'activity_display' AND m.tenant_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO molecule_value_embedded_list (
    molecule_id,
    tenant_id,
    category,
    code,
    description,
    sort_order,
    is_active
)
SELECT 
    m.molecule_id,
    1,
    'M',
    'color',
    '#f59e0b',
    3,
    true
FROM molecule_def m
WHERE m.molecule_key = 'activity_display' AND m.tenant_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO molecule_value_embedded_list (
    molecule_id,
    tenant_id,
    category,
    code,
    description,
    sort_order,
    is_active
)
SELECT 
    m.molecule_id,
    1,
    'M',
    'bg_color',
    '#fef3c7',
    4,
    true
FROM molecule_def m
WHERE m.molecule_key = 'activity_display' AND m.tenant_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO molecule_value_embedded_list (
    molecule_id,
    tenant_id,
    category,
    code,
    description,
    sort_order,
    is_active
)
SELECT 
    m.molecule_id,
    1,
    'M',
    'border_color',
    '#f59e0b',
    5,
    true
FROM molecule_def m
WHERE m.molecule_key = 'activity_display' AND m.tenant_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO molecule_value_embedded_list (
    molecule_id,
    tenant_id,
    category,
    code,
    description,
    sort_order,
    is_active
)
SELECT 
    m.molecule_id,
    1,
    'M',
    'show_bonuses',
    'false',
    6,
    true
FROM molecule_def m
WHERE m.molecule_key = 'activity_display' AND m.tenant_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO molecule_value_embedded_list (
    molecule_id,
    tenant_id,
    category,
    code,
    description,
    sort_order,
    is_active
)
SELECT 
    m.molecule_id,
    1,
    'M',
    'action_verb',
    'Awarded',
    7,
    true
FROM molecule_def m
WHERE m.molecule_key = 'activity_display' AND m.tenant_id = 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check promotion tables
SELECT 'promotion table' as check_name, COUNT(*) as count FROM promotion;
SELECT 'member_promotion table' as check_name, COUNT(*) as count FROM member_promotion;
SELECT 'member_promotion_detail table' as check_name, COUNT(*) as count FROM member_promotion_detail;

-- Check activity mqd column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'activity' AND column_name = 'mqd';

-- Check promotion molecule
SELECT molecule_key, label, value_kind, context 
FROM molecule_def 
WHERE molecule_key = 'promotion';

-- Check activity type M display config
SELECT category, code, description
FROM molecule_value_embedded_list mvl
JOIN molecule_def md ON mvl.molecule_id = md.molecule_id
WHERE md.molecule_key = 'activity_display' 
  AND mvl.category = 'M'
ORDER BY mvl.sort_order;
