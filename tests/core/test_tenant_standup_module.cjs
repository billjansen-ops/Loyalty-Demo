/**
 * Core: tenant_standup.js — the reusable stand-up door (Session 145).
 *
 * Proves the machinery the NEXT state will use:
 *   1. copyTenantConfig stands up a throwaway tenant (zz_test) from wi_php
 *      inside the harness — and its manifest self-check passes.
 *   2. The copy is real: value_ids preserved exactly, state content is the
 *      caller's (branding, timezone, boards), no people/logins came along.
 *   3. verifyTenantSetup reports COMPLETE for the new tenant AND for
 *      wa_php (stood up by v116, the module's inline ancestor — proving
 *      the module and v116 agree on what complete means).
 *   4. The door refuses to overwrite an existing tenant.
 *
 * The throwaway tenant is created inside the harness run — snapshot/restore
 * wipes it.
 */
const { execSync } = require('child_process');
const path = require('path');

module.exports = {
  name: 'Core: tenant stand-up module (manifest, copier, verifier — the next state\'s door)',

  async run(ctx) {
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    const sql = (q) => execSync(
      `${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -t -A -c "${q.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }).toString().trim();

    // Import the ESM module + a direct pg client (the module takes a client,
    // as migrations hand it one).
    const ROOT = path.join(__dirname, '..', '..');
    const { copyTenantConfig, verifyTenantSetup, REQUIRED_PARTS } =
      await import(path.join(ROOT, 'tenant_standup.js'));
    const pgMod = await import('pg');
    const client = new pgMod.default.Client({
      host: process.env.PGHOST || '127.0.0.1',
      user: process.env.PGUSER || 'billjansen',
      database: process.env.PGDATABASE || 'loyalty',
    });
    await client.connect();

    try {
      ctx.assert(Array.isArray(REQUIRED_PARTS) && REQUIRED_PARTS.length >= 20,
        `The manifest lists the required parts (${REQUIRED_PARTS.length})`);

      // ── 1. Stand up a throwaway tenant through the door ──
      const result = await copyTenantConfig(client, {
        sourceKey: 'wi_php',
        targetKey: 'zz_test',
        name: 'Stand-up Test Program',
        branding: [
          ['text', 'company_name', 'Stand-up Test Program', 1],
          ['color', 'primary', '#334155', 2],
        ],
        timezone: 'America/Denver',
        licensingBoards: [['TB1', 'Test Board One', 'Physician']],
      });
      ctx.assert(result.tenant_id > 0, `copyTenantConfig stood up zz_test (tenant_id=${result.tenant_id})`);
      ctx.assert(result.report.complete, 'The copier\'s manifest self-check passed');

      // ── 2. The copy is real ──
      const TGT = result.tenant_id;
      const WI = Number(sql(`SELECT tenant_id FROM tenant WHERE tenant_key = 'wi_php'`));
      const ids = (t) => sql(
        `SELECT string_agg(v.value_id || ':' || v.text_value, ',' ORDER BY v.value_id)
         FROM molecule_value_text v JOIN molecule_def d ON d.molecule_id = v.molecule_id
         WHERE d.tenant_id = ${t} AND d.molecule_key = 'INTAKE_STATUS'`);
      ctx.assert(ids(TGT) === ids(WI), 'INTAKE_STATUS value_ids preserved exactly');
      ctx.assert(sql(`SELECT timezone FROM notification_delivery_config WHERE tenant_id = ${TGT}`) === 'America/Denver',
        'Delivery timezone is the caller\'s, not the source\'s');
      ctx.assert(sql(`SELECT board_name FROM licensing_board WHERE tenant_id = ${TGT}`) === 'Test Board One',
        'Licensing boards are the caller\'s state content, never copied');
      ctx.assert(sql(`SELECT COUNT(*) FROM member WHERE tenant_id = ${TGT}`) === '0', 'No members came along');
      ctx.assert(sql(`SELECT COUNT(*) FROM platform_user WHERE tenant_id = ${TGT}`) === '0', 'No logins came along');

      // ── 3. The verifier agrees — for the new tenant AND for wa_php ──
      const vNew = await verifyTenantSetup(client, 'zz_test', 'wi_php');
      ctx.assert(vNew.complete, 'verifyTenantSetup: zz_test complete vs wi_php');
      const vWA = await verifyTenantSetup(client, 'wa_php', 'wi_php');
      ctx.assert(vWA.complete,
        `verifyTenantSetup: wa_php (v116) complete vs wi_php${vWA.complete ? '' : ' — MISSING: ' + vWA.parts.filter(p => !p.ok).map(p => p.part).join(', ')}`);

      // ── 4. The door refuses an overwrite ──
      let refused = false;
      try {
        await copyTenantConfig(client, {
          sourceKey: 'wi_php', targetKey: 'wa_php', name: 'X',
          branding: [['text', 'company_name', 'X', 1]],
        });
      } catch (e) {
        refused = /already exists/i.test(e.message);
      }
      ctx.assert(refused, 'Standing up over an existing tenant is refused in plain English');
    } finally {
      await client.end();
    }
  }
};
