/**
 * Network Directory Phase 2 part 1 — the PARTICIPANT-SCOPED selection
 * partition (Session 155, v129). Erica's spec §7.1 is the contract:
 *
 *   "The selection is stored in a partition that only the participant can
 *    read. Monitoring program staff cannot see it. ... It does not appear
 *    in any administrative screen, report, export, dashboard, or support
 *    tool available to a program. ... The restriction is enforced at the
 *    data layer and is covered by test."
 *
 * She flags this as "the requirement most likely to be broken quietly
 * during build, usually by the addition of a convenient administrative
 * view." This test IS the §7.1 test, and it stands guard three ways:
 *
 *   1. DATA-LAYER SEMANTICS — selections are created/read/withdrawn only
 *      through participant_selections.js (the one door; there is no HTTP
 *      door yet because participants have no logins — the participant
 *      door arrives with the consent architecture). A selection may only
 *      target an entity the participant's own directory shows; reads are
 *      scoped to one member by construction; withdraw/delete refuse other
 *      members' rows; snapshots (entity name, category, date — exactly
 *      what a §7.2 release would disclose) survive entity rename AND
 *      entity deletion.
 *   2. THE STAFF ATTACK — with a real selection planted, a superuser
 *      session probes every plausible selection URL (nothing exists) and
 *      sweeps every member-scoped staff surface (profile, molecules,
 *      wellness, registry, intake, documents, audit door, program CSV
 *      exports, participant CSV/PDF report). The planted entity's unique
 *      name must appear NOWHERE — the association member↔entity is the
 *      secret; the entity itself is legitimately public in the directory.
 *      Entity deletion answers exactly like Phase 1 (no refusal, no
 *      count, no message difference) — no existence oracle.
 *   3. THE CODE CENSUS — scans every server/page source file in the repo
 *      and REDDENS THE SUITE if anything beyond the module, the
 *      migration, and this test references the partition's table by
 *      name. A convenient admin view cannot arrive quietly. If you are
 *      here because this assert failed: per spec §7.1 that change is a
 *      CONSENT-MODEL change — escalate to Bill/Erica; do not allowlist.
 *
 * Self-contained: creates its own entities, plants and hard-deletes its
 * own selections (harness snapshot/restore backstops).
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

// The marker: unique enough that finding it in ANY staff response proves a
// leak, not a coincidence.
const MARKER = 'QA Selection Wall Target Center 155';

module.exports = {
  name: 'Insight: Network Directory Phase 2 — participant-scoped selections (the §7.1 wall)',

  async run(ctx) {
    const WI = 5;
    const db = new Client(DB_CONFIG);
    await db.connect();

    // Raw-text staff fetches (CSV/PDF and marker sweeps need the body as
    // text, not parsed JSON). Keeps its own cookie from its own login.
    let rawCookie = null;
    async function rawLogin() {
      const r = await fetch(`${ctx.apiBase}/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Claude', password: 'claude123' })
      });
      const sc = r.headers.get('set-cookie');
      if (sc) rawCookie = sc.split(';')[0];
      return r.ok;
    }
    async function rawGet(p) {
      const r = await fetch(`${ctx.apiBase}${p}`, { headers: rawCookie ? { Cookie: rawCookie } : {} });
      return { status: r.status, text: await r.text() };
    }
    async function rawSwitchTenant(tenantId) {
      const r = await fetch(`${ctx.apiBase}/v1/auth/tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(rawCookie ? { Cookie: rawCookie } : {}) },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      return r.ok;
    }

    try {
      // ── The one door: the data-layer module ──
      const modPath = path.join(__dirname, '..', '..', 'verticals', 'workforce_monitoring', 'server', 'participant_selections.js');
      const sel = await import(pathToFileURL(modPath).href);

      // ── Auth: ctx session (door operations) + raw session (text sweeps) ──
      const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(login._ok, 'Claude login successful');
      const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WI } });
      ctx.assert(sw._ok, 'Session on Wisconsin (tenant 5)');
      ctx.assert(await rawLogin() && await rawSwitchTenant(WI), 'Raw staff session established for text sweeps');

      // ── Two Wisconsin members (environment-honest: any two real records) ──
      const mems = await db.query(
        `SELECT link, membership_number FROM member WHERE tenant_id = $1 ORDER BY membership_number LIMIT 2`, [WI]
      );
      ctx.assert(mems.rows.length === 2, 'Two Wisconsin member records found');
      const [A, B] = mems.rows;

      // ── Directory furniture: IHS entity (the marker), a program-list
      //    entity, and an orphan entity on no list ──
      const types = await ctx.fetch('/v1/network-directory/types');
      const treatment = types.find(t => t.type_code === 'TREATMENT');
      const coaching = types.find(t => t.type_code === 'COACHING');
      ctx.assert(!!treatment && !!coaching, 'Taxonomy types available');

      const ihsEnt = await ctx.fetch('/v1/network-directory/admin/entities', {
        method: 'POST',
        body: { scope: 'ihs', entity_code: 'QA_PS_IHS', entity_name: MARKER,
                entity_type_id: treatment.entity_type_id, city: 'Madison', state: 'WI' }
      });
      ctx.assert(ihsEnt._ok && ihsEnt.ihs_status === 'L', 'IHS-pool entity created (the marker entity)');
      const privEnt = await ctx.fetch('/v1/network-directory/admin/entities', {
        method: 'POST',
        body: { scope: 'program', entity_code: 'QA_PS_PRIV', entity_name: 'QA Sel Private Coach 155',
                entity_type_id: coaching.entity_type_id, city: 'Milwaukee', state: 'WI' }
      });
      ctx.assert(privEnt._ok, 'Program-private entity created');
      const addToList = await ctx.fetch('/v1/network-directory/program-list', { method: 'POST', body: { entity_id: privEnt.entity_id } });
      ctx.assert(addToList._ok, 'Private entity added to the program list');
      const orphanEnt = await ctx.fetch('/v1/network-directory/admin/entities', {
        method: 'POST',
        body: { scope: 'program', entity_code: 'QA_PS_ORPH', entity_name: 'QA Sel Orphan Entity 155',
                entity_type_id: coaching.entity_type_id }
      });
      ctx.assert(orphanEnt._ok, 'Orphan entity created (on no list — not selectable)');

      // ── 1. Data-layer semantics ──
      const s1 = await sel.addSelection(db, { memberLink: A.link, entityId: ihsEnt.entity_id });
      ctx.assert(s1.ok && s1.selection.entity_name === MARKER && s1.selection.type_name === 'Treatment facility',
        'Selection records with entity name + category snapshotted');
      const today = await db.query(`SELECT date_to_molecule_int(CURRENT_DATE) AS d`);
      ctx.assertEqual(s1.selection.selected_date, today.rows[0].d, 'selected_date is today (Bill-epoch day)');

      const s2 = await sel.addSelection(db, { memberLink: A.link, entityId: privEnt.entity_id });
      ctx.assert(s2.ok, 'Program-list entity is selectable');
      const s3 = await sel.addSelection(db, { memberLink: A.link, entityId: orphanEnt.entity_id });
      ctx.assert(!s3.ok, 'An entity on NO list and outside the IHS pool is not selectable');
      const dup = await sel.addSelection(db, { memberLink: A.link, entityId: ihsEnt.entity_id });
      ctx.assert(!dup.ok, 'Selecting the same entity twice is refused politely');

      // The three-way visibility setting governs selectability the same way
      // it governs the public view — one truth, not two.
      const visIhs = await ctx.fetch('/v1/network-directory/settings', { method: 'PUT', body: { visibility: 'ihs' } });
      ctx.assert(visIhs._ok, "Visibility set to 'ihs' for the negative check");
      const sHidden = await sel.addSelection(db, { memberLink: B.link, entityId: privEnt.entity_id });
      ctx.assert(!sHidden.ok, "With the program section hidden, a program-list entity is NOT selectable");
      const sIhsOk = await sel.addSelection(db, { memberLink: B.link, entityId: ihsEnt.entity_id });
      ctx.assert(sIhsOk.ok, 'The IHS section stays selectable under visibility ihs');
      const visBoth = await ctx.fetch('/v1/network-directory/settings', { method: 'PUT', body: { visibility: 'both' } });
      ctx.assert(visBoth._ok, "Visibility restored to 'both'");

      const listA = await sel.listSelections(db, { memberLink: A.link });
      ctx.assertEqual(listA.length, 2, "Participant A reads exactly A's own selections");
      const listB = await sel.listSelections(db, { memberLink: B.link });
      ctx.assertEqual(listB.length, 1, "Participant B reads exactly B's own selection");

      // Withdraw is the participant's own act only.
      const wrongWd = await sel.withdrawSelection(db, { memberLink: B.link, selectionId: s1.selection.selection_id });
      ctx.assert(!wrongWd.ok, "Another participant's withdraw answers not-found (never touched)");
      const wd = await sel.withdrawSelection(db, { memberLink: A.link, selectionId: s1.selection.selection_id });
      ctx.assert(wd.ok, 'Participant A withdraws their own selection');
      ctx.assertEqual((await sel.listSelections(db, { memberLink: A.link })).length, 1, 'Withdrawn selection leaves the active list');
      const revived = await sel.addSelection(db, { memberLink: A.link, entityId: ihsEnt.entity_id });
      ctx.assert(revived.ok && revived.selection.selection_id === s1.selection.selection_id,
        'Re-selecting revives the same row (reactivate-not-duplicate)');

      // ── 2. THE STAFF ATTACK (a real selection is now planted) ──
      // 2a. No selection route exists, under any plausible name.
      for (const probe of [
        '/v1/participant-selections',
        '/v1/selections',
        '/v1/network-directory/selections',
        '/v1/network-directory/admin/selections',
        `/v1/member/${A.membership_number}/selections`,
        `/v1/members/${A.membership_number}/selections`,
      ]) {
        const r = await rawGet(probe);
        ctx.assert(r.status === 404 && !r.text.includes(MARKER),
          `No selection door at ${probe} (got ${r.status})`);
      }

      // 2b. Member-scoped staff surfaces: the marker must appear nowhere.
      // (The association member↔entity is the secret; the entity itself is
      // legitimately visible in the directory admin screens.)
      const sweeps = [
        `/v1/member/${A.membership_number}/profile`,
        `/v1/member/${A.membership_number}/molecules`,
        `/v1/wellness/members?tenant_id=${WI}`,
        `/v1/stability-registry/member/${A.membership_number}`,
        `/v1/intake-items?member=${A.membership_number}&include_notes=1`,
        `/v1/documents?member=${A.membership_number}`,
        `/v1/audit/member/${A.membership_number}`,
        '/v1/export/registry',
        '/v1/export/roster',
        '/v1/export/followups',
        '/v1/export/compliance',
        `/v1/export/participant/${A.membership_number}?format=csv&sections=registry,followups,surveys,compliance,notes,meds`,
        `/v1/export/participant/${A.membership_number}?format=pdf`,
      ];
      for (const p of sweeps) {
        const r = await rawGet(p);
        ctx.assert(!r.text.includes(MARKER),
          `Staff surface ${p} carries no trace of the participant's selection`);
      }

      // The audit door cannot be aimed at the partition's table either.
      const auditProbe = await rawGet(`/v1/audit/participant_selection/${s1.selection.selection_id}`);
      ctx.assert(!auditProbe.text.includes(MARKER),
        'The audit door returns nothing from the selection partition');

      // ── 3. Snapshots survive rename and deletion; deletion leaks nothing ──
      const rename = await ctx.fetch(`/v1/network-directory/admin/entities/${ihsEnt.entity_id}`, {
        method: 'PUT', body: { entity_name: 'QA Renamed After Selection 155' }
      });
      ctx.assert(rename._ok, 'Marker entity renamed through the admin door');
      const afterRename = await sel.listSelections(db, { memberLink: A.link });
      ctx.assert(afterRename.some(s => s.entity_name === MARKER),
        'The selection still reads the name AS SELECTED (snapshot, per what a release would disclose)');

      // Delete all three entities. The doors must answer EXACTLY as Phase 1
      // proved they answer without selections — success, no count, no
      // mention — or the delete door becomes an existence oracle.
      const rmList = await ctx.fetch(`/v1/network-directory/program-list/${addToList.entry_id}`, { method: 'DELETE' });
      ctx.assert(rmList._ok, 'Program-list entry removed');
      for (const [id, label] of [[ihsEnt.entity_id, 'marker (selected twice)'], [privEnt.entity_id, 'private (selected once)'], [orphanEnt.entity_id, 'orphan (never selected)']]) {
        const r = await ctx.fetch(`/v1/network-directory/admin/entities/${id}`, { method: 'DELETE' });
        ctx.assert(r._ok && r.deleted === true && !JSON.stringify(r).toLowerCase().includes('selection'),
          `Entity delete (${label}) succeeds identically — no selection oracle`);
      }
      const orphaned = await sel.listSelections(db, { memberLink: A.link, includeInactive: true });
      ctx.assert(orphaned.length === 2 && orphaned.every(s => s.entity_id === null) &&
                 orphaned.some(s => s.entity_name === MARKER),
        'Selections survive entity deletion as intact snapshots (entity pointer nulled, name/category/date kept)');

      // ── 4. THE CODE CENSUS — the wall cannot be breached quietly ──
      const repoRoot = path.join(__dirname, '..', '..');
      const allow = new Set([
        'db_migrate.js',
        path.join('verticals', 'workforce_monitoring', 'server', 'participant_selections.js'),
      ]);
      const skipDirs = new Set(['node_modules', '.git', 'tests', 'database', '.claude', 'Bill']);
      const exts = new Set(['.js', '.cjs', '.mjs', '.html']);
      const offenders = [];
      (function walk(dir, rel) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, e.name);
          const r = rel ? path.join(rel, e.name) : e.name;
          if (e.isDirectory()) { if (!skipDirs.has(e.name)) walk(abs, r); continue; }
          if (!exts.has(path.extname(e.name)) || allow.has(r)) continue;
          // \b keeps the module FILENAME (…_selections) legal while any use
          // of the TABLE name itself is flagged.
          if (/\bparticipant_selection\b/.test(fs.readFileSync(abs, 'utf8'))) offenders.push(r);
        }
      })(repoRoot, '');
      ctx.assert(offenders.length === 0,
        `CODE CENSUS: no file outside the one door references the selection table (spec §7.1 — a staff-visible read is a consent-model change; ESCALATE, never allowlist)${offenders.length ? ' — OFFENDERS: ' + offenders.join(', ') : ''}`);

      // ── 5. Cleanup: participants erase their own rows ──
      for (const m of [A, B]) {
        const rows = await sel.listSelections(db, { memberLink: m.link, includeInactive: true });
        for (const s of rows) {
          const del = await sel.deleteSelection(db, { memberLink: m.link, selectionId: s.selection_id });
          ctx.assert(del.ok, `Selection ${s.selection_id} erased by its own participant`);
        }
      }
      ctx.assertEqual((await sel.listSelections(db, { memberLink: A.link, includeInactive: true })).length, 0, 'Partition clean for A');
      ctx.assertEqual((await sel.listSelections(db, { memberLink: B.link, includeInactive: true })).length, 0, 'Partition clean for B');
    } finally {
      await db.end();
    }
  }
};
