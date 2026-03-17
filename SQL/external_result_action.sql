-- External Result Action — maps external promotion result codes to functions
-- Created: Session 83b, March 10, 2026
-- This is CORE POINTER — any tenant can use it

CREATE TABLE external_result_action (
    action_id SERIAL PRIMARY KEY,
    tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
    action_code VARCHAR(30) NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    function_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(tenant_id, action_code)
);

COMMENT ON TABLE external_result_action IS 'Maps external promotion result codes to server-side functions. When a promotion with reward_type=external qualifies, the engine looks up the action_code and calls the mapped function.';
COMMENT ON COLUMN external_result_action.function_name IS 'Name of the server-side async function to call. Receives context: { memberLink, tenantId, activityDate, promotionId, memberPromotionId, resultAmount, resultDescription }';

-- Seed: Wisconsin PHP actions
INSERT INTO external_result_action (tenant_id, action_code, action_name, function_name, description)
VALUES
  (5, 'SR_SENTINEL', 'Stability Registry — Sentinel', 'createRegistryItem', 'Creates a SENTINEL urgency item in the stability registry. Immediate SLA.'),
  (5, 'SR_RED', 'Stability Registry — Red', 'createRegistryItem', 'Creates a RED urgency item in the stability registry. Same-day SLA.'),
  (5, 'SR_ORANGE', 'Stability Registry — Orange', 'createRegistryItem', 'Creates an ORANGE urgency item in the stability registry. 48-hour SLA.'),
  (5, 'SR_YELLOW', 'Stability Registry — Yellow', 'createRegistryItem', 'Creates a YELLOW urgency item in the stability registry. 72-hour SLA.');
