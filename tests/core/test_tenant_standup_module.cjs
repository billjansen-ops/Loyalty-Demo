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
      // The first version of this block sourced DELTA, because delta had a demo
      // group (MN_MEMBERS) and a demo MED (WINBACK_60). Both are LOCAL-ONLY
      // artifacts (STATE.md says so) — CI's database has neither, so the block
      // failed there on its own can't-prove-anything guard. Correct answer: BUILD
      // the fixtures through the real doors so this proves the same thing in every
      // environment. The session's tenant is wi_php, which is also a sane source.
      const GRP = 'ZZ_S159_STANDUP_G';
      const MED = 'ZZ_S159_STANDUP_M';
      const mkGroup = await ctx.fetch('/v1/groups', {
        method: 'POST',
        body: { group_code: GRP, group_name: 'S159 stand-up fixture group', description: 'copier proof' }
      });
      ctx.assert(mkGroup._ok, `fixture group created on the source tenant (${mkGroup._status}${mkGroup.error ? ': ' + mkGroup.error : ''})`);
      const mkMed = await ctx.fetch('/v1/meds', {
        method: 'POST',
        body: { med_code: MED, med_name: 'S159 stand-up fixture MED', start_date: '2020-01-01', end_date: '2030-12-31', cooldown_days: 15 }
      });
      ctx.assert(mkMed._ok, `fixture MED created on the source tenant (${mkMed._status}${mkMed.error ? ': ' + mkMed.error : ''})`);
      // A MED result that POINTS AT the group — this is what proves the copier
      // remaps group pointers instead of carrying the source tenant's link.
      const mkMedRes = await ctx.fetch(`/v1/meds/${MED}/results`, {
        method: 'POST',
        body: { result_type: 'group', result_group_code: GRP, result_description: 'S159 remap proof' }
      });
      ctx.assert(mkMedRes._ok, `the fixture MED has a 'group' result pointing at the fixture group (${mkMedRes._status}${mkMedRes.error ? ': ' + mkMedRes.error : ''})`);

      const SRCT = Number(sql(`SELECT tenant_id FROM tenant WHERE tenant_key = 'wi_php'`));
      const srcGroups = Number(sql(`SELECT COUNT(*) FROM member_group WHERE tenant_id = ${SRCT}`));
      const srcMeds = Number(sql(`SELECT COUNT(*) FROM med WHERE tenant_id = ${SRCT} AND is_active = true`));
      const srcPromoResults = Number(sql(
        `SELECT COUNT(*) FROM promotion_result r JOIN promotion p ON p.promotion_id = r.promotion_id
         WHERE p.tenant_id = ${SRCT} AND p.is_active = true`));
      const srcMedGroupResults = Number(sql(
        `SELECT COUNT(*) FROM med_result r JOIN med m ON m.link = r.med_link
         WHERE m.tenant_id = ${SRCT} AND r.result_group_link IS NOT NULL`));
      ctx.assert(srcGroups > 0 && srcMeds > 0 && srcMedGroupResults > 0,
        `the source now has what these assertions need (${srcGroups} group(s), ${srcMeds} MED(s), ${srcMedGroupResults} group-pointing MED result(s), ${srcPromoResults} promotion result(s)) — built by this test, not inherited from demo data`);

      const d = await copyTenantConfig(client, {
        sourceKey: 'wi_php',
        targetKey: 'zz_test2',
        name: 'Stand-up Engine Copy Test',
        branding: [['text', 'company_name', 'Stand-up Engine Copy Test', 1]],
        licensingBoards: [['TB2', 'Test Board Two', 'Physician']],
      });
      const T2 = d.tenant_id;
      ctx.assert(d.report.complete, 'the engine-copy stand-up passed its own manifest self-check');

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
         WHERE a.tenant_id = ${T2} AND b2.tenant_id = ${SRCT} AND a.rule_id IS NOT NULL`);
      ctx.assert(sharedRules === '0', 'Copied MEDs own their own rules — no shared rule with the source tenant');

      // ── 3c. OFFSET-REGIME CENSUS (the v140 SURVEY_LINK class) ──
      // A 2/4-byte lookup molecule with value_type 'key'/'code' stores
      // `id − offset`, which only works for always-positive SERIAL ids. A
      // lookup table keyed from link_tank hands out ids ALREADY in the offset
      // region (negative) — offsetting them again overflows the cell and the
      // first write 500s. That was the sandbox's first survey (Session 160),
      // latent on wa_php since it stood up. This census reddens if ANY
      // tenant's molecule — including the two just stood up here, whose
      // copied survey tables carry link_tank ids — pairs offset encoding
      // with a table whose ids go negative. MOLECULES.md §4: link_tank PK →
      // 'numeric' pass-through, never 'key'.
      // Census v2 (S163, audit 2.4): the v1 census saw only value_kind
      // lookup/external_list, column 1, and silently dropped rows with no
      // table_name — SURVEY_LINK's own shape (value_kind 'value') slipped
      // it. Now: EVERY offset-encoded def (any value_kind) and every
      // offset-encoded lookup COLUMN 2..N is either probed against its
      // table's real id range, or NAMED as un-auditable — never dropped.
      const offsetDefs = JSON.parse(sql(
        `SELECT COALESCE(json_agg(json_build_object(
            'tenant_id', d.tenant_id, 'key', d.molecule_key, 'col', 1,
            'table_name', l.table_name, 'id_column', l.id_column,
            'tenant_specific', l.is_tenant_specific)), '[]')
         FROM molecule_def d
         LEFT JOIN molecule_value_lookup l ON l.molecule_id = d.molecule_id AND l.column_order = 1
         WHERE d.value_type IN ('key','code')
           AND d.storage_size::text IN ('2','4')`));
      const offsetCols = JSON.parse(sql(
        `SELECT COALESCE(json_agg(json_build_object(
            'tenant_id', d.tenant_id, 'key', d.molecule_key, 'col', l.column_order,
            'table_name', l.table_name, 'id_column', l.id_column,
            'tenant_specific', l.is_tenant_specific)), '[]')
         FROM molecule_def d
         JOIN molecule_value_lookup l ON l.molecule_id = d.molecule_id AND l.column_order > 1
         WHERE l.value_type IN ('key','code')
           AND COALESCE(l.storage_size, d.storage_size)::text IN ('2','4')`));
      const offenders = [], unauditable = [];
      for (const def of [...offsetDefs, ...offsetCols]) {
        if (!def.table_name || !def.id_column) {
          unauditable.push(`tenant ${def.tenant_id} ${def.key} col${def.col}`);
          continue;
        }
        const scope = (def.tenant_specific === true || def.tenant_specific === 't')
          ? ` WHERE tenant_id = ${def.tenant_id}` : '';
        const min = sql(`SELECT MIN(${def.id_column}) FROM ${def.table_name}${scope}`);
        if (min !== '' && Number(min) < 0) {
          offenders.push(`tenant ${def.tenant_id} ${def.key} col${def.col} → ${def.table_name}.${def.id_column} (min id ${min})`);
        }
      }
      if (unauditable.length) {
        ctx.log(`Offset-regime census: ${unauditable.length} offset-encoded molecule column(s) have no ` +
          `lookup table to probe (number-shaped codes like FLIGHT_NUMBER, or SERIAL-backed ids like ` +
          `BONUS_RULE_ID): ${unauditable.join('; ')} — un-auditable by table probe, NAMED here so a new ` +
          `one is a visible event, not a silent census gap. The encodeValue sign guard (S163) is the ` +
          `write-time backstop for these.`);
      }
      ctx.assert(offenders.length === 0,
        offenders.length
          ? `Offset-regime census FAILED — offset encoding over link_tank ids double-offsets and overflows on first write: ${offenders.join('; ')}`
          : `Offset-regime census v2: no offset-encoded molecule COLUMN (any value_kind, all columns) points at a link_tank-keyed table (${offsetDefs.length + offsetCols.length} checked: ${offsetDefs.length} col-1 defs + ${offsetCols.length} later columns; ${unauditable.length} named un-auditable)`);

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
