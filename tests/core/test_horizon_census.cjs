/**
 * Horizon census — the standing growth guard (Session 145, from the July
 * audit's "standing guards" list).
 *
 * The platform's defining failure mode is silence: a code or counter space
 * that fills up quietly and misbehaves only at its ceiling. This test
 * reddens when any bounded space passes 80% of its ceiling — early enough
 * to design the fix calmly instead of during an outage.
 *
 * Spaces watched:
 *   1. Every link_tank counter vs its byte-width capacity.
 *   2. Entity codes (link_tank.entity_id, 1..127, 31 banned).
 *   3. audit_entity_type's 1-byte code space — one of the two known SILENT
 *      boundaries (it wraps at ~126 with no error; the other, the shared
 *      5-byte link space, has been side-filter-guarded since Session 137).
 *   4. Per-molecule internal-list value_ids (1..127 per molecule — the
 *      one-byte cell contract, MOLECULES.md §5.3).
 *   5. The Bill-epoch day horizon (today vs the SMALLINT ceiling, ~2138).
 *
 * Environment-honest: no absolute counts, only ratios — green on any
 * database until a space genuinely approaches its ceiling.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const DB_HOST = process.env.DATABASE_HOST || '127.0.0.1';
const DB_USER = process.env.DATABASE_USER || 'billjansen';
const DB_NAME = process.env.DATABASE_NAME || 'loyalty';

function psql(sql) {
  const out = execSync(
    `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -t -A -F '|' -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
  if (!out) return [];
  return out.split('\n').map(line => line.split('|'));
}

const REDLINE = 0.8;

module.exports = {
  name: 'Core: horizon census — every code/counter space under 80% of its ceiling',

  async run(ctx) {
    // ── 1. link_tank counters vs byte-width capacity ──
    // Capacities per link_bytes tier (base-127 for odd/char, offset numeric
    // for even; 8 = raw BIGINT counter, effectively unbounded — use the
    // BIGINT ceiling so the ratio stays honest instead of skipped).
    const CAPACITY = {
      1: 127,
      2: 65535,
      3: 127 ** 3,           // 2,048,383
      4: 4294967295,
      5: 127 ** 5,           // ~33.0e9 … 1T-scale space
      8: 9223372036854775807
    };
    const counters = psql(`SELECT table_key, link_bytes, next_link FROM link_tank ORDER BY table_key`);
    ctx.assert(counters.length > 0, `link_tank has counters to census (got ${counters.length})`);
    let worst = { key: '(none)', ratio: 0 };
    for (const [key, bytes, next] of counters) {
      const cap = CAPACITY[Number(bytes)];
      ctx.assert(cap !== undefined, `link_tank '${key}': known byte width (got ${bytes})`);
      const ratio = Number(next) / cap;
      if (ratio > worst.ratio) worst = { key, ratio };
      ctx.assert(ratio < REDLINE,
        `link counter '${key}' under 80% of its ${bytes}-byte space (at ${(ratio * 100).toFixed(4)}%)`);
    }
    ctx.log(`  link counters: ${counters.length} checked; fullest is '${worst.key}' at ${(worst.ratio * 100).toFixed(4)}%`);

    // ── 2. Entity codes: 1..127 minus the banned 31 → 126 usable ──
    const [[entityCodes]] = psql(`SELECT COUNT(*) FROM link_tank WHERE entity_id IS NOT NULL`);
    ctx.assert(Number(entityCodes) / 126 < REDLINE,
      `entity-code space under 80% (${entityCodes} of 126 usable codes)`);

    // ── 3. audit_entity_type — the known SILENT boundary ──
    const [[auditTypes]] = psql(`SELECT COUNT(*) FROM audit_entity_type`);
    ctx.assert(Number(auditTypes) / 126 < REDLINE,
      `audit_entity_type under 80% of its 1-byte space (${auditTypes} of ~126 — ⚠️ this boundary WRAPS SILENTLY; merging it into the entity registry is the parked design fix)`);

    // ── 4. Per-molecule internal-list value_ids (1..127 each) ──
    const hot = psql(`
      SELECT d.tenant_id, d.molecule_key, MAX(v.value_id) AS max_id
      FROM molecule_value_text v JOIN molecule_def d ON d.molecule_id = v.molecule_id
      GROUP BY d.tenant_id, d.molecule_key
      HAVING MAX(v.value_id) >= ${Math.ceil(127 * REDLINE)}
      ORDER BY max_id DESC
    `);
    ctx.assert(hot.length === 0,
      hot.length === 0
        ? 'every internal list under 80% of its 127-value space'
        : `internal list(s) past 80% of 127 value_ids: ${hot.map(r => `${r[1]} (tenant ${r[0]}, max ${r[2]})`).join('; ')}`);
    const [[listCount]] = psql(`SELECT COUNT(DISTINCT molecule_id) FROM molecule_value_text`);
    ctx.log(`  internal lists: ${listCount} molecules checked, none past ${Math.ceil(127 * REDLINE)} value_ids`);

    // ── 5. Bill-epoch day horizon (SMALLINT ceiling ≈ year 2138) ──
    const [[todayRaw]] = psql(`SELECT date_to_molecule_int(CURRENT_DATE)`);
    const spanUsed = (Number(todayRaw) + 32768) / 65535;
    ctx.assert(spanUsed < REDLINE,
      `Bill-epoch day horizon under 80% of the SMALLINT span (today = ${todayRaw}, ${(spanUsed * 100).toFixed(1)}% — ceiling ≈ year 2138)`);
    ctx.log(`  date horizon: ${(spanUsed * 100).toFixed(1)}% of the epoch span consumed`);
  }
};
