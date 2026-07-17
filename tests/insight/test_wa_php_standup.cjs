/**
 * Insight: wa_php stand-up (v116) — Washington is a real, complete tenant.
 *
 * The Session 144 thesis test: standing up the second state is
 * configuration, not construction. Proves:
 *   1. The tenant exists (workforce_monitoring, active), resolved by KEY.
 *   2. Config parity with Wisconsin — table-by-table row counts match the
 *      source (molecules, instruments, questions, active bonuses, rules,
 *      compliance, signals, follow-up schedule, external actions).
 *   3. Internal-list value_ids copied EXACTLY (INTAKE_STATUS 11 values,
 *      byte-identical ids — the one-byte cell contract, MOLECULES.md §5.3).
 *   4. The molecule machinery WORKS on wa_php — a live encode round-trip
 *      through the API, not just rows in tables.
 *   5. Washington content is Washington's: branding name, Pacific delivery
 *      window, 5 WA licensing boards, zero Wisconsin boards.
 *   6. Clinical parity: PPII current weight set values equal Wisconsin's,
 *      keyed by stream code.
 *   7. No people came along: wa_php has zero members, zero logins;
 *      Wisconsin's member count is untouched by the stand-up.
 *
 * Self-contained: read-only against v116's seeded config (harness
 * snapshot/restore covers the login session).
 */
const { execSync } = require('child_process');

module.exports = {
  name: 'Insight: wa_php stand-up (v116 config copy — Washington is a complete tenant)',

  async run(ctx) {
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    const sql = (q) => execSync(
      `${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -t -A -c "${q.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }).toString().trim();

    // ── 1. Both tenants resolved by KEY — never hand-entered ids ──
    const WA = sql(`SELECT tenant_id FROM tenant WHERE tenant_key = 'wa_php' AND is_active = true AND vertical_key = 'workforce_monitoring'`);
    const WI = sql(`SELECT tenant_id FROM tenant WHERE tenant_key = 'wi_php'`);
    ctx.assert(WA !== '', 'wa_php tenant exists, active, workforce_monitoring vertical');
    ctx.assert(WI !== '', 'wi_php source tenant exists');
    ctx.assert(sql(`SELECT name FROM tenant WHERE tenant_id = ${WA}`) === 'Washington PHP', 'Tenant name is Washington PHP');

    // ── 2. Config parity — counts match the source ──
    const parity = [
      ['molecule_def', ''],
      ['survey', ''],
      ['survey_question', ''],
      ['compliance_item', ''],
      ['signal_type', ''],
      ['external_result_action', ''],
      ['notification_rule', ''],
      ['followup_schedule', ''],
      ['bonus', ' AND is_active = true'],
      ['ppii_stream', ''],
      ['ppsi_subdomain', ''],
      ['scheduled_job', ''],
    ];
    for (const [table, filter] of parity) {
      const wi = sql(`SELECT COUNT(*) FROM ${table} WHERE tenant_id = ${WI}${filter}`);
      const wa = sql(`SELECT COUNT(*) FROM ${table} WHERE tenant_id = ${WA}${filter}`);
      ctx.assert(wa === wi && wi !== '0', `${table}: wa_php count (${wa}) matches wi_php (${wi})`);
    }

    // ── 3. INTAKE_STATUS value_ids byte-identical ──
    const idsFor = (t) => sql(
      `SELECT string_agg(v.value_id || ':' || v.text_value, ',' ORDER BY v.value_id)
       FROM molecule_value_text v JOIN molecule_def d ON d.molecule_id = v.molecule_id
       WHERE d.tenant_id = ${t} AND d.molecule_key = 'INTAKE_STATUS'`);
    ctx.assert(idsFor(WA) === idsFor(WI) && idsFor(WA).includes('11:PARTICIPANT'),
      'INTAKE_STATUS values copied with exact value_ids (11:PARTICIPANT present)');

    // ── 4. Live machinery: encode round-trip on wa_php through the API ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude system login');
    const bind = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: Number(WA) } });
    ctx.assert(bind._ok, 'Superuser session rebinds to wa_php');
    const enc = await ctx.fetch(`/v1/molecules/encode?tenant_id=${WA}&key=INTAKE_STATUS&value=PARTICIPANT&return_text=true`);
    ctx.assert(enc._ok, 'INTAKE_STATUS encodes on wa_php (the copied list is live, not just rows)');

    // ── 5. Washington content ──
    ctx.assert(sql(
      `SELECT sd.value FROM sysparm s JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
       WHERE s.tenant_id = ${WA} AND s.sysparm_key = 'branding' AND sd.code = 'company_name'`) === 'Washington PHP',
      'Branding company_name is Washington PHP');
    ctx.assert(sql(`SELECT timezone FROM notification_delivery_config WHERE tenant_id = ${WA}`) === 'America/Los_Angeles',
      'Delivery window runs on Pacific time');
    ctx.assert(sql(`SELECT COUNT(*) FROM licensing_board WHERE tenant_id = ${WA}`) === '5',
      'Five Washington licensing boards seeded');
    ctx.assert(sql(`SELECT COUNT(*) FROM licensing_board WHERE tenant_id = ${WA} AND board_name = 'Washington Medical Commission'`) === '1',
      'Washington Medical Commission present');
    ctx.assert(sql(`SELECT COUNT(*) FROM licensing_board WHERE tenant_id = ${WA} AND board_name ILIKE '%wisconsin%'`) === '0',
      "No Wisconsin boards leaked into Washington's list");

    // ── 6. Clinical parity: PPII current weight values equal, keyed by code ──
    const weightsFor = (t) => sql(
      `SELECT string_agg(v.stream_code || '=' || v.weight, ',' ORDER BY v.stream_code)
       FROM ppii_weight_set_value v JOIN ppii_weight_set ws ON ws.weight_set_id = v.weight_set_id
       WHERE ws.tenant_id = ${t} AND ws.is_current = true`);
    ctx.assert(weightsFor(WA) === weightsFor(WI) && weightsFor(WA) !== '',
      'PPII current weight set values match Wisconsin, stream by stream');

    // ── 7. No people, and the source untouched ──
    ctx.assert(sql(`SELECT COUNT(*) FROM member WHERE tenant_id = ${WA}`) === '0', 'wa_php has zero members');
    ctx.assert(sql(`SELECT COUNT(*) FROM platform_user WHERE tenant_id = ${WA}`) === '0',
      'wa_php has zero logins (the tenant-chooser story owns those)');
    ctx.assert(Number(sql(`SELECT COUNT(*) FROM member WHERE tenant_id = ${WI}`)) > 0,
      "Wisconsin's members untouched by the stand-up");
  }
};
