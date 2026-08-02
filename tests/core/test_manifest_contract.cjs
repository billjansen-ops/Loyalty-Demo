/**
 * Core: the manifest CONTRACT — every table in the schema has a recorded
 * disposition (Wisconsin-assumptions audit standing guard #6, Session 164).
 *
 * The survey_question_answer bug (S161): a tenant-less child table was copied
 * by nobody and counted by nobody, so every copied tenant had questions with
 * ZERO answer choices — and no gate could see it, because the table was
 * silently absent from BOTH the manifest and the not-copied list.
 *
 * This test makes that silence impossible. It diffs the live schema against:
 *   1. REQUIRED_PARTS          (tenant_standup.js — copied + counted; tables
 *                               named directly or inside a part's countSql)
 *   2. vertical PARTS          (verticals\/*\/standup_parts.js)
 *   3. NOT_COPIED              (tenant_standup.js — deliberate decisions,
 *                               machine-readable since S164)
 *   4. COPIED_WITH             (below — config children the copier carries
 *                               inside a parent part's loop, not separately
 *                               counted; each names its parent part)
 *   5. OPERATIONAL             (below — people / runtime / history: never
 *                               part of a stand-up, same reasoning as member)
 *   6. PLATFORM / LEGACY       (below — tenant-less infrastructure, shared
 *                               demo reference data, and legacy leftovers)
 *
 * A NEW table that appears in none of these FAILS the suite with filing
 * instructions. Stale entries (a listed table that no longer exists) fail
 * too, so the lists can't rot.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── 4. Config children the copier carries inside a parent part's loop.
//       Copied, verified transitively (the parent's copy loop writes them),
//       but not separately counted. Each names the manifest part that owns it.
//       Promoting one to its own countSql part (like compliance_item_status,
//       S164) is always legitimate — this list is the explicit record until
//       someone does.
const COPIED_WITH = {
  sysparm_detail:                 'Config groups (sysparm)',
  composite_detail:               'Composites',
  display_template_line:          'Display templates',
  input_template_field:           'Input templates',
  input_template_line:            'Input templates',
  rule:                           'Bonuses (active)',   // shared criteria machinery (bonus/promotion/MED/group)
  rule_criteria:                  'Bonuses (active)',
  bonus_result:                   'Bonuses (active)',
  promotion_result:               'Promotions (active)',
  promo_wt_count:                 'Promotions (active)',
  med_result:                     'MEDs (active)',
  molecule_value_text:            'Molecules',          // static/internal-list values, exact value_id contract
  molecule_value_lookup:          'Molecules',          // the attaches_to/context routing row (MOLECULES.md trap #1)
  ppii_weight_set_value:          'PPII weight set (current)',
  ppsi_subdomain_weight_set_value:'PPSI weight set (current)',
};

// ── 5. People / runtime / history — never part of a stand-up (the same
//       reasoning that keeps members, activities, and logins out).
const OPERATIONAL = new Set([
  'member', 'activity', 'member_alias', 'member_compliance',
  'member_instrument', 'member_meds', 'member_message', 'member_point_bucket',
  'member_promo_wt_count', 'member_promotion', 'member_promotion_detail',
  'member_survey', 'member_survey_answer', 'member_tier', 'member_group_member',
  'intake_item', 'intake_note', 'stability_registry', 'registry_followup',
  'compliance_result', 'physician_annotation', 'survey_note_review',
  'pulse_respondent', 'participant_selection', 'document', 'document_file',
  'notification', 'notification_delivery', 'usage_log', 'error_log', 'session',
  'audit_change', 'audit_field', 'scheduled_job_log',
  'bonus_stats', 'promotion_stats', 'redemption_stats',
  'ppii_score_history', 'ppii_score_history_component',
  'code',                // issued single-use codes/vouchers (runtime data)
  'molecule_text', 'molecule_text_pool',   // text-molecule STORAGE (member/activity data)
  'platform_user', 'platform_user_person', 'platform_user_tenant',  // logins never copy
]);
// member_group_member and med_identification also appear in NOT_COPIED
// (they're the standup-decision record); operational membership here is the
// schema-census disposition. Overlap between these two lists is allowed.

// ── 6. Tenant-less infrastructure, shared demo reference, legacy ──
const PLATFORM = new Set([
  'tenant', 'link_tank',
  'airports',            // shared airline reference (tenant-less)
  'brand', 'property',   // hotel vertical demo reference (tenant-less)
  'network_entity_type', // tenant-0 shared pool by design (2026-08 audit cleared)
]);
const LEGACY = new Set([
  'zzz_activity_detail_list', 'zzz_molecule_value_list', 'zzz_molecule_value_ref',
  'molecule_value_embedded_list',  // EMPTY everywhere, nothing writes it (S162 finding 1.1) — removal is a Bill decision
]);
// Pattern-dispositioned: /^\d+_data_\d+$/ (molecule storage — member/activity
// data), /^audit_log_\d+$/ (audit history).
const PATTERNS = [/^\d+_data_\d+$/, /^audit_log_\d+$/];

module.exports = {
  name: 'Core: manifest contract — every schema table has a recorded disposition (audit guard #6)',

  async run(ctx) {
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    const sql = (q) => execSync(
      `${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -t -A -c "${q.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }).toString().trim();

    const ROOT = path.join(__dirname, '..', '..');
    const { REQUIRED_PARTS, NOT_COPIED } = await import(path.join(ROOT, 'tenant_standup.js'));

    // Vertical parts — every verticals/*/standup_parts.js contributes.
    let verticalParts = [];
    const vdir = path.join(ROOT, 'verticals');
    for (const v of fs.readdirSync(vdir, { withFileTypes: true })) {
      if (!v.isDirectory()) continue;
      const p = path.join(vdir, v.name, 'standup_parts.js');
      if (fs.existsSync(p)) {
        const mod = await import(p);
        if (Array.isArray(mod.PARTS)) verticalParts = verticalParts.concat(mod.PARTS);
      }
    }
    const allParts = [...REQUIRED_PARTS, ...verticalParts];

    ctx.assert(Array.isArray(NOT_COPIED) && NOT_COPIED.length > 0 &&
      NOT_COPIED.every(e => e.table && e.reason),
      `NOT_COPIED is machine-readable — ${NOT_COPIED.length} entries, each with a table and a reason`);

    // ── The covered set: part tables + every table a countSql touches ──
    const covered = new Set();
    for (const p of allParts) {
      covered.add(p.table);
      if (p.countSql) {
        for (const m of p.countSql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_0-9]+)/gi)) covered.add(m[1].toLowerCase());
      }
    }
    const notCopied = new Set(NOT_COPIED.map(e => e.table));

    // A table can't be both copied-and-counted AND deliberately-not-copied.
    const contradictions = [...notCopied].filter(t => covered.has(t));
    ctx.assert(contradictions.length === 0,
      `No table is in both the manifest and NOT_COPIED${contradictions.length ? ' — ' + contradictions.join(', ') : ''}`);

    // COPIED_WITH parents must be real part names (typo guard).
    const partNames = new Set(allParts.map(p => p.part));
    const badParents = Object.entries(COPIED_WITH).filter(([, parent]) => !partNames.has(parent));
    ctx.assert(badParents.length === 0,
      `Every COPIED_WITH entry names a real manifest part${badParents.length ? ' — bad: ' + badParents.map(([t, p]) => `${t}→"${p}"`).join(', ') : ''}`);

    // ── The live schema census ──
    const tables = sql(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`
    ).split('\n').filter(Boolean);
    ctx.assert(tables.length >= 100, `Schema census sees the whole database (${tables.length} tables)`);

    // ── THE CONTRACT: every table has exactly one home ──
    const undispositioned = tables.filter(t =>
      !covered.has(t) && !notCopied.has(t) && !(t in COPIED_WITH) &&
      !OPERATIONAL.has(t) && !PLATFORM.has(t) && !LEGACY.has(t) &&
      !PATTERNS.some(rx => rx.test(t)));
    ctx.assert(undispositioned.length === 0,
      undispositioned.length === 0
        ? 'Every schema table has a recorded disposition'
        : `UNDISPOSITIONED TABLE(S): ${undispositioned.join(', ')} — file each in tenant_standup.js REQUIRED_PARTS (copied+counted) or NOT_COPIED (a decision), or in this test's COPIED_WITH / OPERATIONAL / PLATFORM lists. Silence is the survey_question_answer bug.`);

    // ── Stale-entry guards: listed tables must exist ──
    const existing = new Set(tables);
    const staleParts = allParts.filter(p => !existing.has(p.table)).map(p => `${p.part} (${p.table})`);
    ctx.assert(staleParts.length === 0,
      `Every manifest part's table exists in the schema${staleParts.length ? ' — stale: ' + staleParts.join(', ') : ''}`);
    const staleNotCopied = [...notCopied].filter(t => !existing.has(t));
    ctx.assert(staleNotCopied.length === 0,
      `Every NOT_COPIED table exists in the schema${staleNotCopied.length ? ' — stale: ' + staleNotCopied.join(', ') : ''}`);
    const staleLists = [...Object.keys(COPIED_WITH), ...OPERATIONAL, ...PLATFORM, ...LEGACY].filter(t => !existing.has(t));
    ctx.assert(staleLists.length === 0,
      `Every in-test disposition exists in the schema${staleLists.length ? ' — stale: ' + staleLists.join(', ') : ''}`);

    // ── Per-tenant tables get the STRONG contract: manifest or NOT_COPIED or
    //    an explicit child/operational home — never only pattern-matched ──
    const tenantTables = new Set(sql(
      `SELECT DISTINCT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'tenant_id'`
    ).split('\n').filter(Boolean));
    const weakOnly = [...tenantTables].filter(t => existing.has(t) &&
      !covered.has(t) && !notCopied.has(t) && !(t in COPIED_WITH) &&
      !OPERATIONAL.has(t) && !PLATFORM.has(t) && !LEGACY.has(t));
    ctx.assert(weakOnly.length === 0,
      `Every per-tenant (tenant_id) table has an explicit disposition${weakOnly.length ? ' — missing: ' + weakOnly.join(', ') : ''}`);
  }
};
