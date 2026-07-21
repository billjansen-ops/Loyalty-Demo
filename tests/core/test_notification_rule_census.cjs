/**
 * Core: notification-rule deliverability census (Session 148 standing guard).
 *
 * Erica's missing safety bell exposed a whole class: notification rules are
 * DATA, and data can point at nobody. Eight seeded rules routed to login
 * roles ('clinical-authority', 'case-manager') that the platform_user CHECK
 * constraint doesn't even allow — so REGISTRY_CREATED (every registry item,
 * SENTINELs included), DRUG_TEST_POSITIVE, and FOLLOWUP_OVERDUE delivered
 * to ZERO people on both workforce tenants from the day they were seeded.
 * The router's exact match makes an unresolvable rule fail silently, and no
 * test had ever asserted that every rule CAN reach someone. (Same disease
 * Session 143 cured for two MEDS rules; the siblings survived because the
 * fix was a spot repair, not an invariant.)
 *
 * This census asserts every ACTIVE rule references resolvable vocabulary:
 *   - role rules name a role the platform_user CHECK actually allows
 *     (read live from the constraint — never a hardcoded list);
 *   - position rules name a real molecule on the rule's tenant and a real
 *     value in its list (holders are OPERATIONAL state — a new tenant
 *     legitimately has none yet — but the vocabulary must exist);
 *   - the recipient_type itself is one the router implements.
 *
 * Reddens the moment anyone seeds a rule addressed to nobody-possible.
 * Modeled on the S145 horizon census: an invariant over data, not a walk.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const CONN = `-h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'}`;

function sql(query) {
  return execSync(`${PSQL} ${CONN} -t -A -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}
function sqlRows(query) {
  const out = sql(query);
  return out ? out.split('\n').map(l => l.split('|')) : [];
}

// The recipient types the router (fireNotificationEvent) actually implements.
const ROUTER_TYPES = ['role', 'member', 'all_clinical', 'position', 'assigned_clinician'];

module.exports = {
  name: 'Core: notification-rule deliverability census (every active rule can reach someone)',

  async run(ctx) {
    // The role vocabulary, read live from the platform_user CHECK constraint
    // so this census can never drift from the schema.
    const constraintDef = sql(
      `SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conrelid = 'platform_user'::regclass AND contype = 'c'
         AND pg_get_constraintdef(oid) LIKE '%role%'`);
    const allowedRoles = [...constraintDef.matchAll(/'([a-z_-]+)'::character varying/g)].map(m => m[1]);
    ctx.assert(allowedRoles.length >= 3,
      `role vocabulary read from the live CHECK constraint (${allowedRoles.join(', ')})`);

    const rules = sqlRows(
      `SELECT rule_id, tenant_id, event_type, recipient_type, COALESCE(recipient_role,'')
       FROM notification_rule WHERE is_active = true ORDER BY tenant_id, rule_id`);
    ctx.assert(rules.length >= 1, `census covers ${rules.length} active rules`);

    const undeliverable = [];
    for (const [ruleId, tenantId, eventType, recipientType, recipientRole] of rules) {
      if (!ROUTER_TYPES.includes(recipientType)) {
        undeliverable.push(`rule ${ruleId} (t${tenantId} ${eventType}): recipient_type '${recipientType}' is not implemented by the router`);
        continue;
      }
      if (recipientType === 'role') {
        if (!allowedRoles.includes(recipientRole)) {
          undeliverable.push(`rule ${ruleId} (t${tenantId} ${eventType}): role '${recipientRole}' — no login can ever hold it (allowed: ${allowedRoles.join('/')})`);
        }
      }
      if (recipientType === 'position') {
        // Format MOLECULEKEY:CODE — both halves must exist on the rule's tenant.
        const [molKey, code] = String(recipientRole).split(':');
        if (!molKey || !code) {
          undeliverable.push(`rule ${ruleId} (t${tenantId} ${eventType}): position value '${recipientRole}' is not MOLECULEKEY:CODE`);
          continue;
        }
        // Follow the borrowed-list pointer exactly like the encoder does
        // (resolveListSourceId): a multi-column molecule's column-1 codes can
        // live under its SOURCE molecule (POSITIONCLINIC borrows POSITION's
        // list), so the census checks the source when one is declared.
        const known = sql(
          `SELECT COUNT(*) FROM molecule_def md
           LEFT JOIN molecule_value_lookup mvl
             ON mvl.molecule_id = md.molecule_id AND mvl.column_order = 1
           JOIN molecule_value_text mvt
             ON mvt.molecule_id = COALESCE(mvl.list_source_molecule_id, md.molecule_id)
           WHERE md.tenant_id = ${Number(tenantId)}
             AND UPPER(md.molecule_key) = UPPER('${molKey}')
             AND UPPER(mvt.text_value) = UPPER('${code}')`);
        if (Number(known) === 0) {
          undeliverable.push(`rule ${ruleId} (t${tenantId} ${eventType}): position '${recipientRole}' — the molecule or value doesn't exist on that tenant`);
        }
      }
    }

    ctx.assert(undeliverable.length === 0,
      undeliverable.length
        ? `every active rule is deliverable — FAILURES:\n      ${undeliverable.join('\n      ')}`
        : `every one of the ${rules.length} active rules references resolvable vocabulary`);
  }
};
