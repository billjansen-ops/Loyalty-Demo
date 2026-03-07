-- Uppercase all user-facing codes and keys
-- Run this once to normalize existing data

-- molecule_def.molecule_key (the main one causing issues)
UPDATE molecule_def SET molecule_key = UPPER(molecule_key) WHERE molecule_key != UPPER(molecule_key);

-- rule_criteria.molecule_key (references molecule_def)
UPDATE rule_criteria SET molecule_key = UPPER(molecule_key) WHERE molecule_key != UPPER(molecule_key);

-- bonus.bonus_code
UPDATE bonus SET bonus_code = UPPER(bonus_code) WHERE bonus_code != UPPER(bonus_code);

-- promotion.promotion_code
UPDATE promotion SET promotion_code = UPPER(promotion_code) WHERE promotion_code != UPPER(promotion_code);

-- partner.partner_code
UPDATE partner SET partner_code = UPPER(partner_code) WHERE partner_code != UPPER(partner_code);

-- partner_program.program_code
UPDATE partner_program SET program_code = UPPER(program_code) WHERE program_code != UPPER(program_code);

-- redemption_rule.redemption_code
UPDATE redemption_rule SET redemption_code = UPPER(redemption_code) WHERE redemption_code != UPPER(redemption_code);

-- tier_definition.tier_code
UPDATE tier_definition SET tier_code = UPPER(tier_code) WHERE tier_code != UPPER(tier_code);

-- adjustment.adjustment_code
UPDATE adjustment SET adjustment_code = UPPER(adjustment_code) WHERE adjustment_code != UPPER(adjustment_code);

-- rule.rule_key
UPDATE rule SET rule_key = UPPER(rule_key) WHERE rule_key != UPPER(rule_key);

-- molecule_value_lookup.table_name (references like 'airports', 'carriers')
-- These are table names, keep lowercase (PostgreSQL convention)

-- molecule_column_def has no codes

-- molecule_group.group_code
UPDATE molecule_group SET group_code = UPPER(group_code) WHERE group_code != UPPER(group_code);

-- display_template references molecule_key in template_string - these are embedded in JSON-like strings
-- We'll handle these separately if needed

-- Verify counts
SELECT 'molecule_def' as table_name, COUNT(*) as total FROM molecule_def
UNION ALL SELECT 'rule_criteria', COUNT(*) FROM rule_criteria
UNION ALL SELECT 'bonus', COUNT(*) FROM bonus
UNION ALL SELECT 'promotion', COUNT(*) FROM promotion
UNION ALL SELECT 'partner', COUNT(*) FROM partner
UNION ALL SELECT 'partner_program', COUNT(*) FROM partner_program
UNION ALL SELECT 'tier_definition', COUNT(*) FROM tier_definition
UNION ALL SELECT 'adjustment', COUNT(*) FROM adjustment
UNION ALL SELECT 'rule', COUNT(*) FROM rule
UNION ALL SELECT 'molecule_group', COUNT(*) FROM molecule_group;
