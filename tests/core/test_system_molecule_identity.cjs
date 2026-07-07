/**
 * Core: system-molecule identity (Session 135, migration v103) — the engine's
 * system molecules (IS_DELETED, MEMBER_POINTS, the bonus/promotion linkage
 * set) must be IDENTICAL on every tenant: present everywhere, flagged
 * system_required, same definition shape, same column metadata. The v103
 * drift (MEMBER_POINTS column metadata on tenants 1+3 only; United/Ferrari
 * missing the bonus-linkage defs entirely) hid for months behind
 * presence-only checks — this test and the boot Layer-4 shape check keep the
 * fleet uniform.
 *
 * DB-level assertions via psql (read-only), same env-var pattern CI uses.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const CONN = `-h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'}`;

function sql(query) {
  return execSync(`${PSQL} ${CONN} -t -A -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

const SYSTEM_KEYS = [
  'IS_DELETED', 'MEMBER_POINTS',
  'BONUS_RULE_ID', 'BONUS_ACTIVITY_LINK', 'BONUS_ACTIVITY_ID', 'BONUS_RESULT',
  'MEMBER_PROMOTION', 'PROMOTION'
];

module.exports = {
  name: 'Core: system-molecule identity (same shape on every tenant, v103)',

  async run(ctx) {
    const tenantCount = parseInt(sql(`SELECT COUNT(*) FROM tenant WHERE is_active = true`), 10);
    ctx.assert(tenantCount >= 5, `active tenants found (${tenantCount})`);

    for (const key of SYSTEM_KEYS) {
      // Present on every active tenant, flagged system_required everywhere
      const presence = sql(`
        SELECT COUNT(*) || '|' || COUNT(*) FILTER (WHERE system_required) FROM molecule_def
        WHERE UPPER(molecule_key) = '${key}' AND is_active = true`);
      const [copies, flagged] = presence.split('|').map(Number);
      ctx.assert(copies === tenantCount, `${key}: a copy on every tenant (${copies}/${tenantCount})`);
      ctx.assert(flagged === copies, `${key}: system_required on every copy`);

      // One definition shape fleet-wide
      const defShapes = parseInt(sql(`
        SELECT COUNT(DISTINCT (value_kind, value_type, scalar_type, storage_size::text,
                               context, attaches_to, molecule_type, COALESCE(parent_bytes, 5)))
        FROM molecule_def WHERE UPPER(molecule_key) = '${key}' AND is_active = true`), 10);
      ctx.assert(defShapes === 1, `${key}: one definition shape across all tenants`);

      // One column-metadata shape fleet-wide (aggregate each copy's lookup
      // rows into a canonical string, then count distinct strings)
      const colShapes = parseInt(sql(`
        SELECT COUNT(DISTINCT colshape) FROM (
          SELECT d.molecule_id,
                 COALESCE(string_agg(
                   l.column_order || ':' || COALESCE(l.value_type,'') || ':' || COALESCE(l.value_kind,'') || ':' ||
                   COALESCE(l.scalar_type,'') || ':' || COALESCE(l.storage_size::text,'') || ':' ||
                   COALESCE(l.context,'') || ':' || COALESCE(l.attaches_to,''),
                   '|' ORDER BY l.column_order), 'NONE') AS colshape
          FROM molecule_def d
          LEFT JOIN molecule_value_lookup l ON l.molecule_id = d.molecule_id
          WHERE UPPER(d.molecule_key) = '${key}' AND d.is_active = true
          GROUP BY d.molecule_id
        ) shapes`), 10);
      ctx.assert(colShapes === 1, `${key}: one column-metadata shape across all tenants`);
    }

    // MEMBER_POINTS specifically carries its two-column metadata everywhere
    // (the original drift finding — tenants 2/4/5 had none)
    const mpRows = sql(`
      SELECT COUNT(*) FROM molecule_value_lookup l
      JOIN molecule_def d ON d.molecule_id = l.molecule_id
      WHERE UPPER(d.molecule_key) = 'MEMBER_POINTS' AND d.is_active = true`);
    ctx.assertEqual(parseInt(mpRows, 10), tenantCount * 2,
      'MEMBER_POINTS carries its 2 column-metadata rows on every tenant');
  }
};
