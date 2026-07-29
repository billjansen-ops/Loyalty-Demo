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

      // ── 3b. The RESULT-CARRYING ENGINES come across (Session 159) ──
      // Deliberately sourced from DELTA, not wi_php: wi_php has zero member groups
      // and zero MEDs, so a wi_php copy never executes these paths at all. This is
      // how the gap hid — the old test passed while promotion_result was never
      // copied and result_group_link was dropped. Source a tenant that HAS them.
      const DELTA = Number(sql(`SELECT tenant_id FROM tenant WHERE tenant_key = 'delta'`));
      const srcGroups = Number(sql(`SELECT COUNT(*) FROM member_group WHERE tenant_id = ${DELTA}`));
      const srcMeds = Number(sql(`SELECT COUNT(*) FROM med WHERE tenant_id = ${DELTA} AND is_active = true`));
      const srcPromoResults = Number(sql(
        `SELECT COUNT(*) FROM promotion_result r JOIN promotion p ON p.promotion_id = r.promotion_id
         WHERE p.tenant_id = ${DELTA} AND p.is_active = true`));
      ctx.assert(srcGroups > 0 && srcMeds > 0 && srcPromoResults > 0,
        `Delta is a meaningful source (${srcGroups} group(s), ${srcMeds} MED(s), ${srcPromoResults} promotion result(s)) — if this ever reads 0 the assertions below stop proving anything`);

      const d = await copyTenantConfig(client, {
        sourceKey: 'delta',
        targetKey: 'zz_test2',
        name: 'Stand-up Test Airline',
        branding: [['text', 'company_name', 'Stand-up Test Airline', 1]],
      });
      const T2 = d.tenant_id;
      ctx.assert(d.report.complete, 'Delta-sourced stand-up passed its own manifest self-check');

      ctx.assert(Number(sql(`SELECT COUNT(*) FROM member_group WHERE tenant_id = ${T2}`)) === srcGroups,
        'Member group DEFINITIONS came across');
      ctx.assert(sql(`SELECT COUNT(*) FROM member_group_member g JOIN member_group mg ON mg.link = g.group_link WHERE mg.tenant_id = ${T2}`) === '0',
        'Group MEMBERSHIPS deliberately did NOT come across (people, not config)');
      ctx.assert(Number(sql(`SELECT COUNT(*) FROM med WHERE tenant_id = ${T2}`)) === srcMeds,
        'MED definitions came across');
      ctx.assert(sql(`SELECT COUNT(*) FROM med_identification i JOIN med m ON m.link = i.med_link WHERE m.tenant_id = ${T2}`) === '0',
        'MED episodes deliberately did NOT come across (per-member history)');

      // The regression that started this: promotion results were never copied.
      ctx.assert(Number(sql(
        `SELECT COUNT(*) FROM promotion_result r JOIN promotion p ON p.promotion_id = r.promotion_id
         WHERE p.tenant_id = ${T2}`)) === srcPromoResults,
        'promotion_result rows came across (the Session 159 gap — wa_php REG_REVIEW is its artifact)');

      // Group pointers must be REMAPPED to the new tenant's groups, never left
      // pointing at the source's — a cross-tenant pointer is the silent failure.
      const strayGroupPointers = sql(
        `SELECT COUNT(*) FROM (
           SELECT result_group_link FROM bonus_result br JOIN bonus b ON b.bonus_id = br.bonus_id
             WHERE b.tenant_id = ${T2} AND br.result_group_link IS NOT NULL
           UNION ALL
           SELECT result_group_link FROM promotion_result pr JOIN promotion p ON p.promotion_id = pr.promotion_id
             WHERE p.tenant_id = ${T2} AND pr.result_group_link IS NOT NULL
           UNION ALL
           SELECT result_group_link FROM med_result mr JOIN med m ON m.link = mr.med_link
             WHERE m.tenant_id = ${T2} AND mr.result_group_link IS NOT NULL
         ) x WHERE result_group_link NOT IN (SELECT link FROM member_group WHERE tenant_id = ${T2})`);
      ctx.assert(strayGroupPointers === '0',
        'Every copied group result points at the NEW tenant\'s group, never the source\'s');

      // Each copied MED/group owns its own rule — sharing one would make editing
      // the new tenant's criteria silently change the source tenant's.
      const sharedRules = sql(
        `SELECT COUNT(*) FROM med a JOIN med b2 ON a.rule_id = b2.rule_id
         WHERE a.tenant_id = ${T2} AND b2.tenant_id = ${DELTA} AND a.rule_id IS NOT NULL`);
      ctx.assert(sharedRules === '0', 'Copied MEDs own their own rules — no shared rule with the source tenant');

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
