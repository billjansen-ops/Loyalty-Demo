/**
 * tenant_standup.js — the ONE door for standing up a new tenant.
 *
 * Session 145 (Bill's ask after wa_php): "what is the process to make sure
 * all the required molecules, default settings, etc. are set up. Should be
 * re-usable helper functions, and some list of all required parts."
 *
 * Three exports:
 *   REQUIRED_PARTS            — the written list of everything a complete
 *                               tenant carries (the manifest). Adding a new
 *                               per-tenant config table? Add it HERE and the
 *                               copier + verifier + docs all follow.
 *   copyTenantConfig(client, opts)
 *                             — stand up a new tenant as a full config copy
 *                               of a source tenant (no people, no member
 *                               data, no logins). Called from migrations —
 *                               the next state is a five-line migration.
 *   verifyTenantSetup(client, targetKey, sourceKey)
 *                             — completeness report: for every manifest
 *                               part, source count vs target count. Returns
 *                               { complete, parts: [{part, source, target, ok}] }.
 *
 * History: wa_php (v116) was stood up by this same logic inline before the
 * module existed. v116 stays frozen (append-only migrations); THIS module is
 * the door for every tenant after it. Links go through getNextLink only.
 */
import { getNextLink } from './get_next_link.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// A vertical contributes its OWN stand-up parts (manifest entries + copy
// logic) via verticals/{vertical}/standup_parts.js — the platform module
// never names vertical concepts (the root-file layering rule). Missing
// file = the vertical has no extra parts.
async function loadVerticalParts(verticalKey) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const p = path.join(dir, 'verticals', verticalKey, 'standup_parts.js');
  if (!fs.existsSync(p)) return null;
  return await import(`./verticals/${verticalKey}/standup_parts.js`);
}

/**
 * The manifest. Every per-tenant configuration part the platform carries.
 * `table` + optional `where` power both the copier's completeness check and
 * verifyTenantSetup. Parts marked `content: true` are STATE-SPECIFIC — the
 * copier does not copy them from the source; the caller supplies them
 * (licensing boards) or they're overridden (branding, timezone).
 */
export const REQUIRED_PARTS = [
  { part: 'Branding (sysparm)',            table: 'sysparm',            where: "sysparm_key = 'branding'", content: true },
  { part: 'Config groups (sysparm)',       table: 'sysparm',            where: "sysparm_key <> 'branding'" },
  { part: 'Point types',                   table: 'point_type' },
  { part: 'Molecules',                     table: 'molecule_def' },
  { part: 'Composites',                    table: 'composite' },
  { part: 'Input templates',               table: 'input_template' },
  { part: 'Display templates',             table: 'display_template' },
  { part: 'Survey instruments',            table: 'survey' },
  { part: 'Survey questions',              table: 'survey_question' },
  // survey_question_answer has no tenant_id — its tenant identity is the
  // question it belongs to, so this part counts through a JOIN (countSql
  // takes $1 = tenant_id). Absent from this manifest until Session 161,
  // which is how every copied tenant ended up with questions but no choices.
  { part: 'Survey answer options',         table: 'survey_question_answer',
    countSql: `SELECT COUNT(*)::int AS n FROM survey_question_answer a
               JOIN survey_question q ON q.link = a.question_link WHERE q.tenant_id = $1` },
  // Copied since S144 but never COUNTED — a regression in either loop passed
  // the standup gate green (S163, audit 2.2; the protective-collapse fix
  // joins categories by code, so these are load-bearing).
  { part: 'Survey question categories',    table: 'survey_question_category' },
  { part: 'Survey question lists',         table: 'survey_question_list' },
  { part: 'Compliance items',              table: 'compliance_item' },
  // Copied inside the compliance-item loop since the module was born, but
  // never COUNTED until S164's manifest-contract guard flagged it — the same
  // tenant-less-child shape as survey_question_answer (counts through parent).
  { part: 'Compliance item statuses',      table: 'compliance_item_status',
    countSql: `SELECT COUNT(*)::int AS n FROM compliance_item_status s
               JOIN compliance_item ci ON ci.compliance_item_id = s.compliance_item_id WHERE ci.tenant_id = $1` },
  { part: 'Signal types',                  table: 'signal_type' },
  { part: 'External result actions',       table: 'external_result_action' },
  { part: 'Bonuses (active)',              table: 'bonus',              where: 'is_active = true' },
  { part: 'Promotions (active)',           table: 'promotion',          where: 'is_active = true' },
  { part: 'Notification rules',            table: 'notification_rule' },
  { part: 'Follow-up schedule',            table: 'followup_schedule' },
  { part: 'Delivery config',               table: 'notification_delivery_config', content: true },
  { part: 'Document types',                table: 'document_type' },
  { part: 'Document access rules',         table: 'document_access_rule' },
  { part: 'Licensing boards',              table: 'licensing_board',    content: true },
  { part: 'Testing paradigms',             table: 'test_paradigm',      content: true },
  { part: 'Scheduled jobs',                table: 'scheduled_job' },
  { part: 'Point expiration rules',        table: 'point_expiration_rule' },
  { part: 'Member groups (definitions)',   table: 'member_group' },
  { part: 'MEDs (active)',                 table: 'med',                where: 'is_active = true' },
  // ── S163 additions (audit 2.1 + 2.2): reward targets, redemption/alias
  //    config, and the tenant-less molecule children ──
  { part: 'Tier definitions',              table: 'tier_definition' },
  { part: 'Adjustment types',              table: 'adjustment' },
  { part: 'Redemption rules',              table: 'redemption_rule' },
  { part: 'Redemption point types',        table: 'redemption_point_type',
    countSql: `SELECT COUNT(*)::int AS n FROM redemption_point_type rpt
               JOIN redemption_rule rr ON rr.redemption_id = rpt.redemption_id WHERE rr.tenant_id = $1` },
  { part: 'Alias composites',              table: 'alias_composite' },
  { part: 'Alias composite details',       table: 'alias_composite_detail',
    countSql: `SELECT COUNT(*)::int AS n FROM alias_composite_detail d
               JOIN alias_composite c ON c.link = d.p_link WHERE c.tenant_id = $1` },
  { part: 'Molecule value groups',         table: 'molecule_group',
    countSql: `SELECT COUNT(*)::int AS n FROM molecule_group mg
               JOIN molecule_def md ON md.molecule_id = mg.molecule_id WHERE md.tenant_id = $1` },
  { part: 'Molecule value group members',  table: 'molecule_group_member',
    countSql: `SELECT COUNT(*)::int AS n FROM molecule_group_member mm
               JOIN molecule_group mg ON mg.link = mm.p_link
               JOIN molecule_def md ON md.molecule_id = mg.molecule_id WHERE md.tenant_id = $1` },
  { part: 'Molecule static values (non-text)', table: 'molecule_value_numeric',
    countSql: `SELECT (
                 (SELECT COUNT(*) FROM molecule_value_numeric v JOIN molecule_def md ON md.molecule_id = v.molecule_id WHERE md.tenant_id = $1)
               + (SELECT COUNT(*) FROM molecule_value_date v JOIN molecule_def md ON md.molecule_id = v.molecule_id WHERE md.tenant_id = $1)
               + (SELECT COUNT(*) FROM molecule_value_boolean v JOIN molecule_def md ON md.molecule_id = v.molecule_id WHERE md.tenant_id = $1)
               )::int AS n` },
];

/**
 * DELIBERATELY NOT COPIED — machine-readable since S164 (the manifest-contract
 * test diffs REQUIRED_PARTS + this list against the schema, so a new per-tenant
 * table cannot be silently absent from both — the survey_question_answer
 * signature, structurally).
 *
 * If you add a per-tenant table, it belongs in REQUIRED_PARTS (copied +
 * verified) or in this list (a decision). Silence is the one option that has
 * bitten us.
 */
export const NOT_COPIED = [
  { table: 'member_group_member',   reason: 'group MEMBERSHIPS are people, not configuration — a new tenant gets the group definitions and no stays (S159)' },
  { table: 'med_identification',    reason: 'MED episodes are per-member history (S159)' },
  { table: 'partner',               reason: 'state CONTENT, not config — health systems/clinics belong to the state; real ones arrive at kickoff, fictional ones are seeded deliberately (S158 ruling, S163)' },
  { table: 'partner_program',       reason: 'state CONTENT — rides partner (S163)' },
  { table: 'evaluator',             reason: 'clinical content (real people/orgs), not config (S163)' },
  { table: 'badge',                 reason: 'state content — wi_php badges are AFFILIATIONS (Wisconsin Medical Society, UW Health...); a badge-awarding result refuses to copy: create the new tenant\'s badges, then wire deliberately (S163)' },
  { table: 'network_entity',        reason: 'directory CONTENT — the shared pool is tenant-0 by design (S163)' },
  { table: 'program_network_entry', reason: 'per-program directory working data, starts empty (S163)' },
  { table: 'audit_entity_type',     reason: 'self-heals on demand at first audit write (pointers.js getOrCreateEntityLink) — the 2026-08 audit cleared it (S164)' },
  { table: 'carriers',              reason: 'airline vertical CONTENT (like partners for workforce) — a new airline tenant seeds its own carrier list (S164)' },
  { table: 'break_glass_grant',          reason: 'emergency-access grants are operational records tied to real incidents, never configuration (S166)' },
  { table: 'break_glass_grant_document', reason: 'rides break_glass_grant (S166)' },
  { table: 'collection_site',            reason: 'state CONTENT like partner — collection sites belong to the state; real ones arrive at kickoff, fictional ones seeded deliberately on the sandbox (S166)' },
  { table: 'member_paradigm',            reason: 'per-member monitoring assignments are operational history, not configuration (S166)' },
];

async function count(client, part, tenantId) {
  // A part whose table has no tenant_id column supplies its own countSql
  // ($1 = tenant_id) — e.g. survey_question_answer, tenant-scoped via its question.
  if (part.countSql) {
    const r = await client.query(part.countSql, [tenantId]);
    return r.rows[0].n;
  }
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM ${part.table} WHERE tenant_id = $1${part.where ? ' AND ' + part.where : ''}`, [tenantId]);
  return r.rows[0].n;
}

/**
 * Completeness report: target vs source, part by part. A `content: true`
 * part passes on presence (>0 where the source has >0) rather than equal
 * counts — Washington has Washington's boards, not Wisconsin's count.
 */
export async function verifyTenantSetup(client, targetKey, sourceKey) {
  const tgt = await client.query(`SELECT tenant_id FROM tenant WHERE tenant_key = $1`, [targetKey]);
  const src = await client.query(`SELECT tenant_id FROM tenant WHERE tenant_key = $1`, [sourceKey]);
  if (!tgt.rows.length) throw new Error(`verifyTenantSetup: tenant '${targetKey}' not found`);
  if (!src.rows.length) throw new Error(`verifyTenantSetup: reference tenant '${sourceKey}' not found`);
  const vk = (await client.query(`SELECT vertical_key FROM tenant WHERE tenant_key = $1`, [targetKey])).rows[0].vertical_key;
  const vertical = await loadVerticalParts(vk);
  const allParts = vertical?.PARTS ? [...REQUIRED_PARTS, ...vertical.PARTS] : REQUIRED_PARTS;
  const parts = [];
  for (const p of allParts) {
    const s = await count(client, p, src.rows[0].tenant_id);
    const t = await count(client, p, tgt.rows[0].tenant_id);
    const ok = p.content ? (s === 0 || t > 0) : t === s;
    parts.push({ part: p.part, source: s, target: t, ok });
  }
  return { complete: parts.every(p => p.ok), parts };
}

/**
 * Stand up a new tenant: full configuration copy from a source tenant.
 * No people, no member data, no logins — configuration only.
 *
 * opts: {
 *   sourceKey, targetKey, name, verticalKey?,       — identity
 *   branding: [[category, code, value, sort], ...], — the new tenant's own
 *   timezone?,                                      — delivery window TZ
 *   licensingBoards?: [[code, name, profession]],   — state content
 *   changeNote?                                     — stamped on weight sets
 * }
 * Returns a summary object; throws (rolling back the caller's transaction)
 * on anything unexpected. Idempotence: refuses if targetKey already exists.
 */
export async function copyTenantConfig(client, opts) {
  const { sourceKey, targetKey, name, branding, timezone, licensingBoards, changeNote } = opts;
  if (!sourceKey || !targetKey || !name || !branding) {
    throw new Error('copyTenantConfig: sourceKey, targetKey, name, branding are required');
  }
  const srcQ = await client.query(`SELECT tenant_id, vertical_key FROM tenant WHERE tenant_key = $1`, [sourceKey]);
  if (!srcQ.rows.length) throw new Error(`Source tenant ${sourceKey} not found`);
  const SRC = srcQ.rows[0].tenant_id;
  const vertical = opts.verticalKey || srcQ.rows[0].vertical_key;

  const existQ = await client.query(`SELECT 1 FROM tenant WHERE tenant_key = $1`, [targetKey]);
  if (existQ.rows.length) throw new Error(`Tenant ${targetKey} already exists — refusing to overwrite`);

  // The tenant_id sequence can lag hand-seeded tenants — true it up first.
  await client.query(`SELECT setval('tenant_tenant_id_seq', (SELECT MAX(tenant_id) FROM tenant))`);
  const tgtQ = await client.query(
    `INSERT INTO tenant (tenant_key, name, vertical_key, is_active) VALUES ($1, $2, $3, true) RETURNING tenant_id`,
    [targetKey, name, vertical]);
  const TGT = tgtQ.rows[0].tenant_id;
  const note = changeNote || `Tenant stand-up — copied from ${sourceKey}`;

  // ── sysparm + details (branding replaced with the new tenant's own) ──
  const sysparms = await client.query(
    `SELECT sysparm_id, sysparm_key, value_type, description FROM sysparm
     WHERE tenant_id = $1 AND sysparm_key <> 'branding'`, [SRC]);
  for (const sp of sysparms.rows) {
    const ins = await client.query(
      `INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
       VALUES ($1, $2, $3, $4) RETURNING sysparm_id`,
      [TGT, sp.sysparm_key, sp.value_type, sp.description]);
    await client.query(
      `INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
       SELECT $1, category, code, value, sort_order FROM sysparm_detail WHERE sysparm_id = $2`,
      [ins.rows[0].sysparm_id, sp.sysparm_id]);
  }
  const brandIns = await client.query(
    `INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
     VALUES ($1, 'branding', 'json', 'Tenant branding') RETURNING sysparm_id`, [TGT]);
  for (const [cat, code, value, ord] of branding) {
    await client.query(
      `INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order) VALUES ($1, $2, $3, $4, $5)`,
      [brandIns.rows[0].sysparm_id, cat, code, value, ord]);
  }

  // ── point types ──
  const ptMap = new Map();
  for (const pt of (await client.query(`SELECT * FROM point_type WHERE tenant_id = $1`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO point_type (tenant_id, point_type_code, point_type_name, redemption_priority, display_order, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING point_type_id`,
      [TGT, pt.point_type_code, pt.point_type_name, pt.redemption_priority, pt.display_order, pt.status]);
    ptMap.set(pt.point_type_id, ins.rows[0].point_type_id);
  }

  // ── molecules: defs → lookups (list_source remapped) → values (EXACT
  //    per-molecule value_ids — the one-byte cell contract, §5.3) ──
  const molMap = new Map();
  const defs = await client.query(`SELECT * FROM molecule_def WHERE tenant_id = $1 ORDER BY molecule_id`, [SRC]);
  for (const d of defs.rows) {
    const ins = await client.query(
      `INSERT INTO molecule_def (
         tenant_id, molecule_key, label, description, attaches_to, context,
         storage_size, value_type, value_kind, scalar_type, lookup_table_key,
         display_width, is_permanent, molecule_type, value_structure,
         ref_function_name, ref_table_name, ref_field_name,
         system_required, parent_bytes, parent_entity_id,
         is_static, is_required, is_active, foreign_schema, display_order,
         sample_code, sample_description, decimal_places,
         parent_molecule_key, parent_fk_field, can_be_promotion_counter,
         list_context, input_type, param1_label, param2_label, param3_label, param4_label
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
       RETURNING molecule_id`,
      [TGT, d.molecule_key, d.label, d.description, d.attaches_to, d.context,
       d.storage_size, d.value_type, d.value_kind, d.scalar_type, d.lookup_table_key,
       d.display_width, d.is_permanent, d.molecule_type, d.value_structure,
       d.ref_function_name, d.ref_table_name, d.ref_field_name,
       d.system_required || false, d.parent_bytes || 5, d.parent_entity_id,
       d.is_static, d.is_required, d.is_active, d.foreign_schema, d.display_order,
       d.sample_code, d.sample_description, d.decimal_places,
       d.parent_molecule_key, d.parent_fk_field, d.can_be_promotion_counter,
       d.list_context, d.input_type, d.param1_label, d.param2_label, d.param3_label, d.param4_label]);
    molMap.set(d.molecule_id, ins.rows[0].molecule_id);
  }
  for (const [oldId, newId] of molMap) {
    for (const l of (await client.query(`SELECT * FROM molecule_value_lookup WHERE molecule_id = $1 ORDER BY column_order`, [oldId])).rows) {
      await client.query(
        `INSERT INTO molecule_value_lookup (
           molecule_id, table_name, id_column, code_column, label_column,
           maintenance_page, maintenance_description, is_tenant_specific,
           column_order, column_type, decimal_places, col_description,
           value_type, lookup_table_key, value_kind, scalar_type, context,
           storage_size, attaches_to, ref_table_name, ref_field_name,
           ref_function_name, list_source_molecule_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [newId, l.table_name, l.id_column, l.code_column, l.label_column,
         l.maintenance_page, l.maintenance_description, l.is_tenant_specific,
         l.column_order, l.column_type, l.decimal_places, l.col_description,
         l.value_type, l.lookup_table_key, l.value_kind, l.scalar_type, l.context,
         l.storage_size, l.attaches_to, l.ref_table_name, l.ref_field_name,
         l.ref_function_name, l.list_source_molecule_id ? (molMap.get(l.list_source_molecule_id) || null) : null]);
    }
    for (const v of (await client.query(`SELECT * FROM molecule_value_text WHERE molecule_id = $1 ORDER BY value_id`, [oldId])).rows) {
      await client.query(
        `INSERT INTO molecule_value_text (molecule_id, value_id, text_value, display_label, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newId, v.value_id, v.text_value, v.display_label, v.sort_order, v.is_active]);
    }
    // The non-text static value tables (S163, audit 2.2): same tenant-less
    // shape as molecule_value_text, same exact-value_id contract. Only text
    // values existed on tenants 5/6/7 when this gap was found, so blast
    // radius was zero — this closes it before a tenant with static
    // numeric/date/boolean molecules is ever copied.
    for (const v of (await client.query(`SELECT * FROM molecule_value_numeric WHERE molecule_id = $1 ORDER BY value_id`, [oldId])).rows) {
      await client.query(
        `INSERT INTO molecule_value_numeric (molecule_id, value_id, numeric_value, is_active)
         VALUES ($1, $2, $3, $4)`, [newId, v.value_id, v.numeric_value, v.is_active]);
    }
    for (const v of (await client.query(`SELECT * FROM molecule_value_date WHERE molecule_id = $1 ORDER BY value_id`, [oldId])).rows) {
      await client.query(
        `INSERT INTO molecule_value_date (molecule_id, value_id, date_value, is_active)
         VALUES ($1, $2, $3, $4)`, [newId, v.value_id, v.date_value, v.is_active]);
    }
    for (const v of (await client.query(`SELECT * FROM molecule_value_boolean WHERE molecule_id = $1 ORDER BY value_id`, [oldId])).rows) {
      await client.query(
        `INSERT INTO molecule_value_boolean (molecule_id, value_id, bool_value, is_active)
         VALUES ($1, $2, $3, $4)`, [newId, v.value_id, v.bool_value, v.is_active]);
    }
    // Molecule value groups (S163, audit 2.2): tenant-less children of
    // molecule_def backing the IN GROUP / NOT IN GROUP criteria operators.
    // The platform's own molecule-clone routine copies them; the tenant
    // copier never did. Members carry value_code verbatim — per-molecule
    // value coding is preserved exactly above, so codes stay valid.
    for (const g of (await client.query(`SELECT * FROM molecule_group WHERE molecule_id = $1`, [oldId])).rows) {
      const gl = await getNextLink(client, TGT, 'molecule_group');
      await client.query(
        `INSERT INTO molecule_group (link, molecule_id, group_code, group_name, description, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [gl, newId, g.group_code, g.group_name, g.description, g.status]);
      await client.query(
        `INSERT INTO molecule_group_member (p_link, value_code)
         SELECT $1, value_code FROM molecule_group_member WHERE p_link = $2`, [gl, g.link]);
    }
  }

  // ── composites + details (links via getNextLink) ──
  const compMap = new Map();
  for (const c of (await client.query(`SELECT * FROM composite WHERE tenant_id = $1`, [SRC])).rows) {
    const newLink = await getNextLink(client, TGT, 'composite');
    await client.query(
      `INSERT INTO composite (link, tenant_id, composite_type, description, validate_function, point_type_molecule_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newLink, TGT, c.composite_type, c.description, c.validate_function,
       c.point_type_molecule_id ? (molMap.get(c.point_type_molecule_id) || null) : null]);
    compMap.set(c.link, newLink);
    for (const cd of (await client.query(`SELECT * FROM composite_detail WHERE p_link = $1 ORDER BY sort_order`, [c.link])).rows) {
      const dLink = await getNextLink(client, TGT, 'composite_detail');
      await client.query(
        `INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [dLink, newLink, molMap.get(cd.molecule_id), cd.is_required, cd.is_calculated, cd.calc_function, cd.sort_order]);
    }
  }

  // ── input templates + fields ──
  for (const t of (await client.query(`SELECT * FROM input_template WHERE tenant_id = $1`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO input_template (tenant_id, template_name, activity_type, is_active)
       VALUES ($1, $2, $3, $4) RETURNING template_id`, [TGT, t.template_name, t.activity_type, t.is_active]);
    for (const f of (await client.query(`SELECT * FROM input_template_field WHERE template_id = $1`, [t.template_id])).rows) {
      await client.query(
        `INSERT INTO input_template_field (
           template_id, row_number, molecule_key, start_position, display_width, field_width,
           enterable, system_generated, is_required, display_label, sort_order, composite_link, column_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [ins.rows[0].template_id, f.row_number, f.molecule_key, f.start_position, f.display_width, f.field_width,
         f.enterable, f.system_generated, f.is_required, f.display_label, f.sort_order,
         f.composite_link ? (compMap.get(f.composite_link) || null) : null, f.column_number]);
    }
  }

  // ── display templates + lines (molecule KEYS live in the strings) ──
  for (const t of (await client.query(`SELECT * FROM display_template WHERE tenant_id = $1`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO display_template (tenant_id, template_name, template_type, is_active, activity_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING template_id`,
      [TGT, t.template_name, t.template_type, t.is_active, t.activity_type]);
    await client.query(
      `INSERT INTO display_template_line (template_id, line_number, template_string)
       SELECT $1, line_number, template_string FROM display_template_line WHERE template_id = $2`,
      [ins.rows[0].template_id, t.template_id]);
  }

  // ── survey catalog: categories → questions → surveys → lists ──
  const catMap = new Map(), qMap = new Map(), svMap = new Map();
  for (const c of (await client.query(`SELECT * FROM survey_question_category WHERE tenant_id = $1`, [SRC])).rows) {
    const nl = await getNextLink(client, TGT, 'survey_question_category');
    await client.query(
      `INSERT INTO survey_question_category (link, tenant_id, category_code, category_name, status)
       VALUES ($1, $2, $3, $4, $5)`, [nl, TGT, c.category_code, c.category_name, c.status]);
    catMap.set(c.link, nl);
  }
  for (const q of (await client.query(`SELECT * FROM survey_question WHERE tenant_id = $1`, [SRC])).rows) {
    const nl = await getNextLink(client, TGT, 'survey_question');
    await client.query(
      `INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [nl, TGT, q.category_link ? catMap.get(q.category_link) : null, q.question, q.is_required, q.allow_multiple, q.status]);
    qMap.set(q.link, nl);
  }
  // Answer options ride each question. survey_question_answer has no tenant
  // column — its tenant identity IS the question link — which is exactly how
  // this copy got skipped until Session 161: every copied tenant had all 116
  // questions with ZERO answer choices, so no human could ever complete a
  // survey (latent on wa_php since v116; the sandbox's people seed silently
  // degraded to all-zero answers). v141 backfills the tenants stood up before
  // this loop existed.
  for (const [oldQ, newQ] of qMap) {
    for (const a of (await client.query(
      `SELECT * FROM survey_question_answer WHERE question_link = $1 ORDER BY display_order`, [oldQ])).rows) {
      const nl = await getNextLink(client, TGT, 'survey_question_answer');
      await client.query(
        `INSERT INTO survey_question_answer (link, question_link, answer_text, answer_value, display_order, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [nl, newQ, a.answer_text, a.answer_value, a.display_order, a.status]);
    }
  }
  // survey.display_order arrived in v145, AFTER migrations that call this
  // copier (v139 stood up the sandbox). A from-scratch migration replay
  // (CI, a fresh environment) runs THIS current code at a pre-v145
  // schema, so the column is copied only when it exists — v145's
  // backfill then fills the copied rows by survey_code, converging to
  // the same end state. (Session 165 hotfix: this exact miss made CI
  // red from the Session 164 push onward — the local suite can't see it
  // because the local schema is already current.)
  const hasDisplayOrder = (await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'survey' AND column_name = 'display_order'`)).rows.length > 0;
  for (const s of (await client.query(`SELECT * FROM survey WHERE tenant_id = $1`, [SRC])).rows) {
    const nl = await getNextLink(client, TGT, 'survey');
    const cols = ['link', 'tenant_id', 'survey_code', 'survey_name', 'survey_description', 'respondent_type',
                  'status', 'score_function', 'cadence_days', 'note_alert', 'instrument_purpose', 'license_status'];
    const vals = [nl, TGT, s.survey_code, s.survey_name, s.survey_description, s.respondent_type,
                  s.status, s.score_function, s.cadence_days, s.note_alert, s.instrument_purpose, s.license_status];
    if (hasDisplayOrder) { cols.push('display_order'); vals.push(s.display_order); }
    await client.query(
      `INSERT INTO survey (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
      vals);
    svMap.set(s.link, nl);
  }
  for (const l of (await client.query(`SELECT * FROM survey_question_list WHERE tenant_id = $1`, [SRC])).rows) {
    const nl = await getNextLink(client, TGT, 'survey_question_list');
    await client.query(
      `INSERT INTO survey_question_list (link, tenant_id, survey_link, question_link, display_order, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nl, TGT, svMap.get(l.survey_link), qMap.get(l.question_link), l.display_order, l.status]);
  }

  // ── compliance items + statuses ──
  for (const ci of (await client.query(`SELECT * FROM compliance_item WHERE tenant_id = $1`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO compliance_item (tenant_id, item_code, item_name, weight, status, cadence_days, cadence_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING compliance_item_id`,
      [TGT, ci.item_code, ci.item_name, ci.weight, ci.status, ci.cadence_days, ci.cadence_type]);
    await client.query(
      `INSERT INTO compliance_item_status (compliance_item_id, status_code, score, is_sentinel, sort_order)
       SELECT $1, status_code, score, is_sentinel, sort_order FROM compliance_item_status WHERE compliance_item_id = $2`,
      [ins.rows[0].compliance_item_id, ci.compliance_item_id]);
  }

  // ── signal types ──
  await client.query(
    `INSERT INTO signal_type (tenant_id, signal_code, signal_name, description, is_active)
     SELECT $1, signal_code, signal_name, description, is_active FROM signal_type WHERE tenant_id = $2`, [TGT, SRC]);

  // ── external result actions ──
  const actMap = new Map();
  for (const a of (await client.query(`SELECT * FROM external_result_action WHERE tenant_id = $1`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO external_result_action (tenant_id, action_code, action_name, function_name, description, is_active, urgency, sla_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING action_id`,
      [TGT, a.action_code, a.action_name, a.function_name, a.description, a.is_active, a.urgency, a.sla_hours]);
    actMap.set(a.action_id, ins.rows[0].action_id);
  }

  // ── reward targets: tiers, badges, adjustment types (S163, audit 2.1) ──
  // Before this block, promotion/MED tier/badge/token results copied their
  // result_reference_id RAW — a cross-tenant pointer into the SOURCE
  // tenant's id space — and these three target tables were never copied at
  // all, so even a correct remap had nothing to land on.
  const tierMap = new Map();
  for (const t of (await client.query(`SELECT * FROM tier_definition WHERE tenant_id = $1`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO tier_definition (tier_code, tier_description, tier_ranking, is_active, tenant_id, badge_color, text_color, icon)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING tier_id`,
      [t.tier_code, t.tier_description, t.tier_ranking, t.is_active, TGT, t.badge_color, t.text_color, t.icon]);
    tierMap.set(t.tier_id, ins.rows[0].tier_id);
  }
  // Badges are deliberately NOT copied — on wi_php they are AFFILIATIONS
  // (Wisconsin Medical Society, UW Health...), state content like partners
  // and boards, not program config. A badge-awarding result therefore
  // cannot be auto-remapped; mapResultReference refuses it loudly below.
  const adjMap = new Map();
  for (const aj of (await client.query(`SELECT * FROM adjustment WHERE tenant_id = $1`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO adjustment (tenant_id, adjustment_code, adjustment_name, adjustment_type, fixed_points, is_active, comment_mode, point_type_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING adjustment_id`,
      [TGT, aj.adjustment_code, aj.adjustment_name, aj.adjustment_type, aj.fixed_points, aj.is_active,
       aj.comment_mode, aj.point_type_id ? (ptMap.get(aj.point_type_id) || null) : null]);
    adjMap.set(aj.adjustment_id, ins.rows[0].adjustment_id);
  }

  // ── redemption rules + their point types (S163, audit 2.2: per-tenant
  //    config with no manifest entry and no recorded not-copied decision) ──
  for (const rr of (await client.query(`SELECT * FROM redemption_rule WHERE tenant_id = $1`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO redemption_rule (tenant_id, redemption_code, redemption_description, status,
         start_date, end_date, redemption_type, points_required, quantity_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING redemption_id`,
      [TGT, rr.redemption_code, rr.redemption_description, rr.status,
       rr.start_date, rr.end_date, rr.redemption_type, rr.points_required, rr.quantity_available]);
    for (const rpt of (await client.query(
      `SELECT point_type_id FROM redemption_point_type WHERE redemption_id = $1`, [rr.redemption_id])).rows) {
      const newPt = ptMap.get(rpt.point_type_id);
      if (!newPt) throw new Error(`copyTenantConfig: redemption ${rr.redemption_code} points at point_type ${rpt.point_type_id} which was not copied`);
      await client.query(
        `INSERT INTO redemption_point_type (redemption_id, point_type_id) VALUES ($1, $2)`,
        [ins.rows[0].redemption_id, newPt]);
    }
  }

  // ── alias composites + details (S163, audit 2.2: same gap class) ──
  for (const ac of (await client.query(`SELECT * FROM alias_composite WHERE tenant_id = $1`, [SRC])).rows) {
    const al = await getNextLink(client, TGT, 'alias_composite');
    await client.query(
      `INSERT INTO alias_composite (link, tenant_id, composite_code, composite_name, is_active)
       VALUES ($1,$2,$3,$4,$5)`, [al, TGT, ac.composite_code, ac.composite_name, ac.is_active]);
    for (const ad of (await client.query(
      `SELECT * FROM alias_composite_detail WHERE p_link = $1 ORDER BY sort_order`, [ac.link])).rows) {
      const dl = await getNextLink(client, TGT, 'alias_composite_detail');
      const newMol = molMap.get(ad.molecule_id);
      if (!newMol) throw new Error(`copyTenantConfig: alias composite ${ac.composite_code} detail points at molecule ${ad.molecule_id} which was not copied`);
      await client.query(
        `INSERT INTO alias_composite_detail (link, p_link, molecule_id, is_required, is_key, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`, [dl, al, newMol, ad.is_required, ad.is_key, ad.sort_order]);
    }
  }

  // A result row's reward reference, remapped through the map its OWN type
  // points at (external→action, tier→tier_definition, badge→badge,
  // token→adjustment). A miss is refused loudly — a silently-nulled
  // reference is a reward that vanishes without a trace.
  function mapResultReference(resultType, refId, what) {
    if (!refId) return null;
    if (resultType === 'badge') {
      throw new Error(
        `copyTenantConfig: ${what} awards a badge — badges are content and are not copied. ` +
        `Stand up the tenant, create its own badges, then wire the result deliberately.`);
    }
    const map = resultType === 'external' ? actMap
              : resultType === 'tier'     ? tierMap
              : resultType === 'token'    ? adjMap
              : null;
    if (!map) return null;  // points/group/sms/email carry no reference id
    const nl = map.get(refId);
    if (!nl) throw new Error(`copyTenantConfig: ${what} (${resultType}) points at id ${refId} which was not copied`);
    return nl;
  }

  // ── rules + criteria (shared by bonuses / promotions / expiration) ──
  async function copyRule(oldRuleId) {
    if (!oldRuleId) return null;
    const newRule = await client.query(`INSERT INTO rule DEFAULT VALUES RETURNING rule_id`);
    await client.query(
      `INSERT INTO rule_criteria (rule_id, molecule_key, operator, value, label, joiner, sort_order,
         param1_value, param2_value, param3_value, param4_value, column_number)
       SELECT $1, molecule_key, operator, value, label, joiner, sort_order,
         param1_value, param2_value, param3_value, param4_value, column_number
       FROM rule_criteria WHERE rule_id = $2`, [newRule.rows[0].rule_id, oldRuleId]);
    return newRule.rows[0].rule_id;
  }

  // ── member groups: DEFINITIONS ONLY (v131 tables; copied Session 159) ──
  // Must run BEFORE the result-carrying engines below — a bonus / promotion / MED
  // result can point at a group, and those pointers are remapped through grpMap.
  // Memberships (member_group_member) are people and are deliberately not copied.
  const grpMap = new Map();
  for (const g of (await client.query(`SELECT * FROM member_group WHERE tenant_id = $1`, [SRC])).rows) {
    const nl = await getNextLink(client, TGT, 'member_group');
    await client.query(
      `INSERT INTO member_group (link, tenant_id, group_code, group_name, description, rule_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [nl, TGT, g.group_code, g.group_name, g.description, await copyRule(g.rule_id), g.is_active]);
    grpMap.set(g.link, nl);
  }

  // A result row's group pointer, remapped to the new tenant's group. A 'group' result
  // whose group did not come across would silently do nothing, so refuse loudly instead.
  function mapGroup(oldLink, what) {
    if (!oldLink) return null;
    const nl = grpMap.get(oldLink);
    if (!nl) throw new Error(`copyTenantConfig: ${what} points at member_group '${oldLink}' which was not copied`);
    return nl;
  }

  // An 'enroll' result chains into ANOTHER promotion, and promotion ids are assigned as
  // we insert — a source id would be a cross-tenant pointer. None exist today; refuse
  // loudly rather than copy a broken chain if one ever does. (The legacy
  // reward_promotion_id column has always been nulled for the same reason, below.)
  function mapEnrollTarget(what) {
    throw new Error(
      `copyTenantConfig: ${what} is an 'enroll' result (a promotion chain). Chains cannot be ` +
      `auto-remapped across tenants — copy the tenant, then wire the chain deliberately.`);
  }

  // ── bonuses (active) + results ──
  for (const b of (await client.query(`SELECT * FROM bonus WHERE tenant_id = $1 AND is_active = true`, [SRC])).rows) {
    const newRuleId = await copyRule(b.rule_id);
    const ins = await client.query(
      `INSERT INTO bonus (bonus_code, bonus_description, start_date, end_date, is_active, bonus_type,
         bonus_amount, rule_id, tenant_id, apply_sunday, apply_monday, apply_tuesday, apply_wednesday,
         apply_thursday, apply_friday, apply_saturday, required_tier_id, point_type_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING bonus_id`,
      [b.bonus_code, b.bonus_description, b.start_date, b.end_date, b.is_active, b.bonus_type,
       b.bonus_amount, newRuleId, TGT, b.apply_sunday, b.apply_monday, b.apply_tuesday, b.apply_wednesday,
       b.apply_thursday, b.apply_friday, b.apply_saturday,
       // Legacy tier gate: remapped through tierMap (was copied verbatim —
       // a cross-tenant pointer). Loud on a miss, same as result references.
       b.required_tier_id ? mapResultReference('tier', b.required_tier_id, `bonus ${b.bonus_code} required_tier_id`) : null,
       b.point_type_id ? (ptMap.get(b.point_type_id) || null) : null]);
    for (const r of (await client.query(`SELECT * FROM bonus_result WHERE bonus_id = $1 ORDER BY sort_order`, [b.bonus_id])).rows) {
      await client.query(
        `INSERT INTO bonus_result (bonus_id, tenant_id, result_type, result_amount, amount_type,
           result_reference_id, result_description, point_type_id, result_group_link, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [ins.rows[0].bonus_id, TGT, r.result_type, r.result_amount, r.amount_type,
         mapResultReference(r.result_type, r.result_reference_id, `bonus ${b.bonus_code} result`),
         r.result_description, r.point_type_id ? (ptMap.get(r.point_type_id) || null) : null,
         mapGroup(r.result_group_link, `bonus ${b.bonus_code} result`), r.sort_order]);
    }
  }

  // ── promotions (active) + counters ──
  for (const p of (await client.query(`SELECT * FROM promotion WHERE tenant_id = $1 AND is_active = true`, [SRC])).rows) {
    const newRuleId = await copyRule(p.rule_id);
    const ins = await client.query(
      `INSERT INTO promotion (tenant_id, promotion_code, promotion_name, promotion_description,
         start_date, end_date, is_active, enrollment_type, allow_member_enrollment, rule_id,
         reward_type, reward_amount, reward_tier_id, reward_promotion_id, process_limit_count,
         duration_type, duration_end_date, duration_days, point_type_id, counter_joiner,
         apply_sunday, apply_monday, apply_tuesday, apply_wednesday, apply_thursday, apply_friday, apply_saturday)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       RETURNING promotion_id`,
      [TGT, p.promotion_code, p.promotion_name, p.promotion_description,
       p.start_date, p.end_date, p.is_active, p.enrollment_type, p.allow_member_enrollment, newRuleId,
       p.reward_type, p.reward_amount,
       // Legacy reward tier: remapped through tierMap (was copied verbatim).
       p.reward_tier_id ? mapResultReference('tier', p.reward_tier_id, `promotion ${p.promotion_code} reward_tier_id`) : null,
       null, p.process_limit_count,
       p.duration_type, p.duration_end_date, p.duration_days,
       p.point_type_id ? (ptMap.get(p.point_type_id) || null) : null, p.counter_joiner,
       p.apply_sunday, p.apply_monday, p.apply_tuesday, p.apply_wednesday, p.apply_thursday, p.apply_friday, p.apply_saturday]);
    for (const cRow of (await client.query(`SELECT * FROM promo_wt_count WHERE promotion_id = $1 ORDER BY sort_order`, [p.promotion_id])).rows) {
      await client.query(
        `INSERT INTO promo_wt_count (promotion_id, tenant_id, count_type, counter_molecule_id, counter_token_adjustment_id, goal_amount, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ins.rows[0].promotion_id, TGT, cRow.count_type,
         cRow.counter_molecule_id ? (molMap.get(cRow.counter_molecule_id) || null) : null,
         cRow.counter_token_adjustment_id, cRow.goal_amount, cRow.sort_order]);
    }
    // promotion_result — the CURRENT reward model (the legacy reward_* columns copied
    // above are only a fallback the engine uses when a promotion has zero result rows).
    // Session 159: these were never copied, so a stood-up tenant inherited promotions
    // whose results were missing — survivable only while the legacy columns happened to
    // be set too. wa_php's REG_REVIEW is exactly that artifact.
    for (const r of (await client.query(`SELECT * FROM promotion_result WHERE promotion_id = $1 ORDER BY sort_order`, [p.promotion_id])).rows) {
      await client.query(
        `INSERT INTO promotion_result (promotion_id, tenant_id, result_type, result_amount,
           result_reference_id, result_description, duration_type, duration_end_date, duration_days,
           point_type_id, result_group_link, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [ins.rows[0].promotion_id, TGT, r.result_type, r.result_amount,
         r.result_type === 'enroll' ? mapEnrollTarget(`promotion ${p.promotion_code} result`)
           : mapResultReference(r.result_type, r.result_reference_id, `promotion ${p.promotion_code} result`),
         r.result_description, r.duration_type, r.duration_end_date, r.duration_days,
         r.point_type_id ? (ptMap.get(r.point_type_id) || null) : null,
         mapGroup(r.result_group_link, `promotion ${p.promotion_code} result`), r.sort_order]);
    }
  }

  // ── MEDs (active) + results (v132/v137 tables; copied Session 159) ──
  // Definitions only: med_identification rows are per-member episodes, never copied.
  for (const m of (await client.query(`SELECT * FROM med WHERE tenant_id = $1 AND is_active = true`, [SRC])).rows) {
    const nl = await getNextLink(client, TGT, 'med');
    await client.query(
      `INSERT INTO med (link, tenant_id, med_code, med_name, description, start_date, end_date,
         run_mode, cooldown_days, lifetime_cap, rule_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [nl, TGT, m.med_code, m.med_name, m.description, m.start_date, m.end_date,
       m.run_mode, m.cooldown_days, m.lifetime_cap, await copyRule(m.rule_id), m.is_active]);
    for (const r of (await client.query(`SELECT * FROM med_result WHERE med_link = $1 ORDER BY sort_order`, [m.link])).rows) {
      await client.query(
        `INSERT INTO med_result (med_link, tenant_id, result_type, result_amount,
           result_reference_id, result_description, duration_type, duration_end_date, duration_days,
           point_type_id, result_group_link, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [nl, TGT, r.result_type, r.result_amount,
         r.result_type === 'enroll' ? mapEnrollTarget(`MED ${m.med_code} result`)
           : mapResultReference(r.result_type, r.result_reference_id, `MED ${m.med_code} result`),
         r.result_description, r.duration_type, r.duration_end_date, r.duration_days,
         r.point_type_id ? (ptMap.get(r.point_type_id) || null) : null,
         mapGroup(r.result_group_link, `MED ${m.med_code} result`), r.sort_order]);
    }
  }

  // ── notification rules, follow-up schedule, delivery config ──
  await client.query(
    `INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role, notify_member,
       severity, title_template, body_template, timing_offset_hours, repeat_hours, repeat_count, is_active)
     SELECT $1, event_type, recipient_type, recipient_role, notify_member,
       severity, title_template, body_template, timing_offset_hours, repeat_hours, repeat_count, is_active
     FROM notification_rule WHERE tenant_id = $2`, [TGT, SRC]);
  await client.query(
    `INSERT INTO followup_schedule (tenant_id, urgency, extended_card, step_order, followup_type, offset_days, is_active)
     SELECT $1, urgency, extended_card, step_order, followup_type, offset_days, is_active
     FROM followup_schedule WHERE tenant_id = $2`, [TGT, SRC]);
  // Caller-supplied timezone wins; otherwise the copied tenant inherits the
  // SOURCE tenant's timezone. The old default was a hardcoded Central — a
  // copy of a Pacific tenant with no explicit timezone silently became
  // Central (S162 audit finding 1.6).
  await client.query(
    `INSERT INTO notification_delivery_config (tenant_id, timezone, window_start, window_end, digest_hour,
       email_enabled, sms_enabled, push_enabled, max_retries)
     SELECT $1, COALESCE($3, timezone), window_start, window_end, digest_hour, email_enabled, sms_enabled, push_enabled, max_retries
     FROM notification_delivery_config WHERE tenant_id = $2`,
    [TGT, SRC, timezone || null]);

  // ── document classification (v121 tables; missed by every standup until
  //    S163 — the sandbox had ZERO document types, audit finding 1.7) ──
  await client.query(
    `INSERT INTO document_type (tenant_id, type_code, type_name, default_confidentiality, sort_order, is_active)
     SELECT $1, type_code, type_name, default_confidentiality, sort_order, is_active
     FROM document_type WHERE tenant_id = $2`, [TGT, SRC]);
  // Access rules remap type_id through the type_code just copied. Empty on
  // every tenant today (access mode is 'open') but copies faithfully the
  // day rules exist.
  await client.query(
    `INSERT INTO document_access_rule (tenant_id, type_id, audience)
     SELECT $1, tt.type_id, r.audience
     FROM document_access_rule r
     JOIN document_type st ON st.type_id = r.type_id
     JOIN document_type tt ON tt.tenant_id = $1 AND tt.type_code = st.type_code
     WHERE r.tenant_id = $2`, [TGT, SRC]);

  // ── the vertical's own parts (clinical scoring config etc.) ──
  const verticalParts = await loadVerticalParts(vertical);
  if (verticalParts?.copy) await verticalParts.copy(client, SRC, TGT, { note });

  // ── state content: licensing boards (never copied from the source) ──
  for (const [code, bName, prof] of (licensingBoards || [])) {
    await client.query(
      `INSERT INTO licensing_board (tenant_id, board_code, board_name, profession, is_active)
       VALUES ($1, $2, $3, $4, true)`, [TGT, code, bName, prof]);
  }

  // ── testing paradigms (program policy config, like compliance items —
  //    copied as starting points; codes portable, values the program's
  //    to tune; S166 monitoring core story 1) ──
  await client.query(
    `INSERT INTO test_paradigm (tenant_id, paradigm_code, paradigm_name, tests_per_period, period, min_gap_days, weekdays_only, is_active)
     SELECT $1, paradigm_code, paradigm_name, tests_per_period, period, min_gap_days, weekdays_only, is_active
     FROM test_paradigm WHERE tenant_id = $2`, [TGT, SRC]);

  // ── scheduled jobs (fresh clocks) ──
  await client.query(
    `INSERT INTO scheduled_job (tenant_id, job_code, job_name, job_description, interval_minutes, is_active, preferred_start_time)
     SELECT $1, job_code, job_name, job_description, interval_minutes, is_active, preferred_start_time
     FROM scheduled_job WHERE tenant_id = $2`, [TGT, SRC]);

  // ── point expiration rules ──
  for (const per of (await client.query(`SELECT * FROM point_expiration_rule WHERE tenant_id = $1`, [SRC])).rows) {
    const newRuleId = await copyRule(per.rule_id);
    await client.query(
      `INSERT INTO point_expiration_rule (rule_key, start_date, end_date, expiration_date, description, rule_id, tenant_id, point_type_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [per.rule_key, per.start_date, per.end_date, per.expiration_date, per.description, newRuleId, TGT,
       per.point_type_id ? (ptMap.get(per.point_type_id) || null) : null]);
  }

  // ── the manifest is the contract: verify before returning ──
  const report = await verifyTenantSetup(client, targetKey, sourceKey);
  if (!report.complete) {
    const missing = report.parts.filter(p => !p.ok).map(p => `${p.part} (source ${p.source}, target ${p.target})`);
    throw new Error(`Tenant stand-up INCOMPLETE for ${targetKey}: ${missing.join('; ')}`);
  }
  return { tenant_id: TGT, molecules: molMap.size, report };
}
