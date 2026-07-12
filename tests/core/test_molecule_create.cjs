/**
 * Core test: createMoleculeComplete — the one molecule-creation routine
 * (Session 131 Tier-1 hardening).
 *
 * POST /v1/molecules/complete creates a COMPLETE molecule in one transaction
 * (definition + lookup rows + values with explicit per-molecule value_ids +
 * the storage table if missing), validates every MOLECULES.md §5 invariant
 * up front, then PROVES the molecule with a real-path round-trip
 * (encodeMolecule → insertMoleculeRow → getMoleculeRows → decode) and removes
 * itself if the proof fails.
 *
 * Load-bearing assertions:
 *   - happy paths for the major types: internal list (member), external
 *     lookup (carriers), 4-byte user parent, borrowed list, reference
 *   - the storage table is CREATED when missing (5_data_12) and shape-verified
 *   - proof rows are cleaned (zero storage rows after create)
 *   - value_ids are explicit per-molecule 1..N (§5.3), lookup row carries
 *     attaches_to='M' for a member molecule (§5.2)
 *   - broken specs are rejected in plain English with NOTHING written
 *   - browser: the rewired admin create flow drives the same endpoint
 *
 * Tenant: Delta (1) — no wi_php data touched. All molecules created here are
 * deleted at the end; the one table this test creates (5_data_12) is dropped
 * via the verification pg client (snapshot restore does not drop tables that
 * aren't in the snapshot).
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

module.exports = {
  name: 'Core: createMoleculeComplete (one-call create + round-trip proof)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const createdIds = [];

    try {
      // ── Auth: Claude superuser, switched into Delta ──
      const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(login._ok, 'Claude login successful');
      const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 1 } });
      ctx.assert(sw._ok, 'Switched session into Delta (tenant 1)');

      // ── 1. Internal list on the member (the canonical case) ──
      ctx.log('1: internal list, member-attached, with values');
      const list = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_MC_LIST', label: 'RT list', molecule_type: 'D',
          attaches_to: 'M', parent_bytes: 5, storage_size: '1',
          columns: [{ column_order: 1, column_type: 'internal_list', value_kind: 'internal_list', value_type: 'code' }],
          values: [{ value: 'ALPHA', label: 'Alpha' }, { value: 'BRAVO', label: 'Bravo' }]
        }
      });
      ctx.assert(list._ok && list.success, `internal-list create succeeds (${list._status}${list.error ? ': ' + list.error : ''})`);
      ctx.assert(list.round_trip && list.round_trip.proven === true, 'round-trip PROVEN through the real path');
      ctx.assert(list.table_created === false, '5_data_1 already existed — not re-created');
      const listId = list.molecule && list.molecule.molecule_id;
      if (listId) createdIds.push(listId);

      // §5.2: member molecule's lookup row present with attaches_to='M'
      const lookup = await db.query('SELECT attaches_to, context FROM molecule_value_lookup WHERE molecule_id = $1', [listId]);
      ctx.assert(lookup.rows.length === 1 && lookup.rows[0].attaches_to === 'M' && lookup.rows[0].context === 'member',
        `lookup row written with attaches_to=M/context=member (§5.2) — got ${JSON.stringify(lookup.rows)}`);
      // §5.3: explicit per-molecule value_ids 1..N
      const vals = await db.query('SELECT value_id, text_value FROM molecule_value_text WHERE molecule_id = $1 ORDER BY value_id', [listId]);
      ctx.assert(vals.rows.length === 2 && vals.rows[0].value_id === 1 && vals.rows[1].value_id === 2,
        `value_ids are explicit per-molecule 1..2 (§5.3) — got ${JSON.stringify(vals.rows.map(r => r.value_id))}`);
      // proof rows cleaned
      const residue = await db.query('SELECT count(*)::int AS n FROM "5_data_1" WHERE molecule_id = $1', [listId]);
      ctx.assert(residue.rows[0].n === 0, 'proof rows removed — zero storage rows after create');

      // ── 2. External lookup (carriers, 2-byte offset key) ──
      ctx.log('2: external lookup against carriers');
      const lk = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_MC_LOOKUP', label: 'RT lookup', molecule_type: 'D',
          attaches_to: 'A', storage_size: '2',
          columns: [{ column_order: 1, value_kind: 'external_list', value_type: 'key', table_name: 'carriers', id_column: 'carrier_id', code_column: 'code', label_column: 'name', is_tenant_specific: true }]
        }
      });
      ctx.assert(lk._ok && lk.round_trip && lk.round_trip.proven === true, `external-lookup create + proof (${lk._status}${lk.error ? ': ' + lk.error : ''})`);
      if (lk.molecule) createdIds.push(lk.molecule.molecule_id);

      // ── 3. 4-byte user parent (routes to 4_data_1) ──
      ctx.log('3: user-parent molecule (parent_bytes 4)');
      const up = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_MC_USER', label: 'RT user', molecule_type: 'D',
          attaches_to: '', parent_bytes: 4, storage_size: '1',
          columns: [{ column_order: 1, value_kind: 'internal_list', value_type: 'code' }],
          values: [{ value: 'T1', label: 'Test one' }]
        }
      });
      ctx.assert(up._ok && up.round_trip && up.round_trip.proven === true, `user-parent create + proof (${up._status}${up.error ? ': ' + up.error : ''})`);
      ctx.assert(up.table_name === '4_data_1', `routes to 4_data_1 (got ${up.table_name})`);
      if (up.molecule) createdIds.push(up.molecule.molecule_id);

      // ── 4. New storage table created inside the transaction (5_data_12) ──
      ctx.log('4: pattern 12 — table created with the molecule');
      // A database with real usage may already carry a 12-pattern table
      // (the Heroku copy does) — there the in-transaction creation proof
      // becomes a reuse proof (table_created false), like section 1's
      // 5_data_1 case. The round-trip proof runs identically either way.
      const before = await db.query(`SELECT to_regclass('"5_data_12"') AS t`);
      const tablePreexisted = before.rows[0].t !== null;
      ctx.log(tablePreexisted
        ? '   (5_data_12 already exists on this database — expecting reuse, not creation)'
        : '   (5_data_12 absent — expecting in-transaction creation)');
      const wide = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_MC_WIDE', label: 'RT wide', molecule_type: 'D',
          attaches_to: 'A', storage_size: '12',
          columns: [
            { column_order: 1, value_kind: 'internal_list', value_type: 'code' },
            { column_order: 2, value_kind: 'value', value_type: 'numeric', scalar_type: 'numeric' }
          ],
          values: [{ value: 'W1', label: 'Wide one' }]
        }
      });
      ctx.assert(wide._ok && wide.table_created === !tablePreexisted, `5_data_12 ${tablePreexisted ? 'reused' : 'created'} with the molecule (${wide._status}${wide.error ? ': ' + wide.error : ''})`);
      ctx.assert(wide.round_trip && wide.round_trip.proven === true, 'two-column round-trip proven (list + numeric)');
      if (wide.molecule) createdIds.push(wide.molecule.molecule_id);

      // ── 5. Borrowed list — proof resolves through the source molecule ──
      ctx.log('5: borrowed list (list_source_molecule_id → RT_MC_LIST)');
      const borrow = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_MC_BORROW', label: 'RT borrower', molecule_type: 'D',
          attaches_to: 'A', storage_size: '1',
          columns: [{ column_order: 1, value_kind: 'internal_list', value_type: 'code', list_source_molecule_id: listId }]
        }
      });
      ctx.assert(borrow._ok && borrow.round_trip && borrow.round_trip.proven === true, `borrower create + proof via source list (${borrow._status}${borrow.error ? ': ' + borrow.error : ''})`);
      if (borrow.molecule) createdIds.push(borrow.molecule.molecule_id);

      // ── 6. Reference molecule — nothing stored, function must exist ──
      ctx.log('6: reference molecule');
      const ref = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: { molecule_key: 'RT_MC_REF', label: 'RT ref', molecule_type: 'R', ref_function_name: 'get_member_current_tier' }
      });
      ctx.assert(ref._ok && ref.round_trip && ref.round_trip.skipped === true, `reference create (proof skipped — stores nothing) (${ref._status}${ref.error ? ': ' + ref.error : ''})`);
      if (ref.molecule) createdIds.push(ref.molecule.molecule_id);

      // ── 7. Rejections — plain English, nothing written ──
      ctx.log('7: broken specs are rejected with nothing left behind');
      const rejections = [
        [{ molecule_key: 'RT_MC_BAD1', label: 'x', molecule_type: 'D', storage_size: '1', columns: [{ column_order: 1 }] },
          400, 'value_kind is required', 'missing value_kind'],
        [{ molecule_key: 'RT_MC_BAD2', label: 'x', molecule_type: 'D', storage_size: '2', columns: [{ column_order: 1, value_kind: 'internal_list' }] },
          400, 'width 1', 'internal list wider than one byte'],
        [{ molecule_key: 'RT_MC_LIST', label: 'x', molecule_type: 'D', storage_size: '1', columns: [{ column_order: 1, value_kind: 'internal_list' }] },
          409, 'already exists', 'duplicate molecule_key'],
        [{ molecule_key: 'RT_MC_BAD3', label: 'x', molecule_type: 'D', storage_size: '2', columns: [{ column_order: 1, value_kind: 'external_list', value_type: 'key', table_name: 'no_such_table', id_column: 'id', code_column: 'code' }] },
          400, 'does not exist', 'nonexistent lookup table'],
        [{ molecule_key: 'RT_MC_BAD4', label: 'x', molecule_type: 'D', storage_size: '2', columns: [{ column_order: 1, value_kind: 'external_list', table_name: 'carriers', id_column: 'carrier_id', code_column: 'code' }] },
          400, "'key'", 'missing key-vs-numeric declaration on a 2-byte lookup'],
        [{ molecule_key: 'RT_MC_BAD5', label: 'x', molecule_type: 'D', parent_bytes: 4, attaches_to: 'M', storage_size: '1', columns: [{ column_order: 1, value_kind: 'internal_list' }] },
          400, 'attaches_to empty', 'A/M on a non-5-byte parent'],
        [{ molecule_key: 'RT_MC_BAD6', label: 'x', molecule_type: 'D', storage_size: '1', columns: [{ column_order: 1, value_kind: 'internal_list', list_source_molecule_id: 999999 }] },
          400, 'does not exist', 'borrowed-list source missing'],
        [{ molecule_key: 'RT_MC_BAD7', label: 'x', molecule_type: 'R' },
          400, 'ref_function_name', 'reference with no target'],
      ];
      for (const [body, wantStatus, wantText, why] of rejections) {
        const r = await ctx.fetch('/v1/molecules/complete', { method: 'POST', body });
        ctx.assert(r._status === wantStatus && (r.error || '').includes(wantText),
          `rejected: ${why} (${r._status}: ${(r.error || '').substring(0, 90)})`);
      }
      const badResidue = await db.query(`SELECT count(*)::int AS n FROM molecule_def WHERE molecule_key LIKE 'RT_MC_BAD%'`);
      ctx.assert(badResidue.rows[0].n === 0, 'rejected creates wrote NOTHING (no definition rows)');

      // ── 8. Browser: the rewired admin create flow drives the same endpoint ──
      if (ctx.hasBrowser()) {
        ctx.log('8: browser — admin_molecule_edit.html create mode, one call');
        const page = await ctx.openPage('/admin_molecule_edit.html');
        try {
          const walk = await page.evaluate(async () => {
            // stay on Delta (the harness login lands on the user's default tenant)
            const sw = await fetch('/v1/auth/tenant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ tenant_id: 1 }) });
            if (!sw.ok) return { error: 'tenant switch failed ' + sw.status };
            sessionStorage.setItem('tenant_id', '1');

            window.__alerts = [];
            window.alert = m => window.__alerts.push(String(m));
            window.confirm = () => true;

            document.getElementById('moleculeKey').value = 'RT_MC_UI';
            document.getElementById('moleculeLabel').value = 'RT UI walk';
            document.getElementById('moleculeType').value = 'dynamic';
            document.getElementById('moleculeType').dispatchEvent(new Event('change'));
            document.getElementById('attachesToActivity').checked = true;

            // page state the modals would have built
            columnDefs.push({ type: 'internal_list', typeLabel: 'Internal List', width: 1, listSourceMoleculeId: null, lookupTable: null, decimals: null, description: 'walk', storageMode: null, sampleData: null, lookupConfig: null, hasSample: false, hasConfig: false });
            listValues.push({ code: 'UIONE', description: 'UI one', sort_order: 1 });
            document.getElementById('listValuesSection').classList.remove('hidden');

            await saveMolecule();
            return { alerts: window.__alerts };
          });
          ctx.assert(!walk.error && walk.alerts && walk.alerts.some(a => a.includes('Round-trip proven')),
            `browser save reports the round-trip proof (${JSON.stringify(walk.alerts || walk.error).substring(0, 120)})`);
          const uiRow = await db.query(`SELECT molecule_id FROM molecule_def WHERE molecule_key = 'RT_MC_UI' AND tenant_id = 1`);
          ctx.assert(uiRow.rows.length === 1, 'browser-created molecule exists');
          if (uiRow.rows.length) createdIds.push(uiRow.rows[0].molecule_id);
        } finally {
          await page.close();
        }
      } else {
        ctx.log('8: browser not available — UI walk skipped');
      }

      // ── 9. Composite auto-wiring (Session 133) ──
      // Creation wires the molecule into the record structure in the same call —
      // the same member_composite / activity_composites parameters a migration passes.
      ctx.log('9: molecule creation auto-wires composites (member + per-activity-type)');

      // 9a. Member molecule → M composite, Required flag honored.
      const mcomp = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_MC_MCOMP', label: 'RT member composite', molecule_type: 'D',
          attaches_to: 'M', parent_bytes: 5, storage_size: '1',
          columns: [{ column_order: 1, column_type: 'internal_list', value_kind: 'internal_list', value_type: 'code' }],
          values: [{ value: 'ONE', label: 'One' }],
          member_composite: { required: true }
        }
      });
      ctx.assert(!!mcomp.molecule, `member molecule with member_composite created (${mcomp._status}${mcomp.error ? ': ' + mcomp.error : ''})`);
      if (mcomp.molecule) createdIds.push(mcomp.molecule.molecule_id);
      const mRow = await db.query(
        `SELECT cd.is_required FROM composite_detail cd JOIN composite c ON c.link = cd.p_link
          WHERE c.tenant_id = 1 AND c.composite_type = 'M' AND cd.molecule_id = $1`, [mcomp.molecule ? mcomp.molecule.molecule_id : -1]);
      ctx.assert(mRow.rows.length === 1 && mRow.rows[0].is_required === true,
        'member molecule auto-added to the M composite as REQUIRED');

      // 9b. Activity molecule → one row per ticked type, each with its own Required flag.
      const acomp = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_MC_ACOMP', label: 'RT activity composite', molecule_type: 'D',
          attaches_to: 'A', parent_bytes: 5, storage_size: '2',
          columns: [{ column_order: 1, value_kind: 'value', value_type: 'numeric', scalar_type: 'numeric' }],
          activity_composites: [{ activity_type: 'A', required: true }, { activity_type: 'P', required: false }]
        }
      });
      ctx.assert(!!acomp.molecule, `activity molecule with activity_composites created (${acomp._status}${acomp.error ? ': ' + acomp.error : ''})`);
      if (acomp.molecule) createdIds.push(acomp.molecule.molecule_id);
      const aRows = await db.query(
        `SELECT c.composite_type, cd.is_required FROM composite_detail cd JOIN composite c ON c.link = cd.p_link
          WHERE c.tenant_id = 1 AND cd.molecule_id = $1 ORDER BY c.composite_type`, [acomp.molecule ? acomp.molecule.molecule_id : -1]);
      const aMap = Object.fromEntries(aRows.rows.map(r => [r.composite_type, r.is_required]));
      ctx.assert(aMap.A === true && aMap.P === false && !('J' in aMap),
        `activity molecule wired per-type — A required, P optional, J absent (got ${JSON.stringify(aMap)})`);

      // 9c. A reference molecule stores nothing — it cannot be placed in a composite.
      const refComp = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: { molecule_key: 'RT_MC_REFC', label: 'x', molecule_type: 'R', ref_function_name: 'get_member_current_tier', member_composite: { required: false } }
      });
      ctx.assert(refComp._status === 400 && (refComp.error || '').includes('stores nothing'),
        `reference molecule rejected when given a composite (${refComp._status})`);

      // 9d. An activity type with no composite for this tenant → rejected up front.
      const badType = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_MC_BADT', label: 'x', molecule_type: 'D', attaches_to: 'A', storage_size: '2',
          columns: [{ column_order: 1, value_kind: 'value', value_type: 'numeric', scalar_type: 'numeric' }],
          activity_composites: [{ activity_type: 'Z', required: false }]
        }
      });
      ctx.assert(badType._status === 400 && (badType.error || '').includes("no 'Z'"),
        `unknown activity composite type rejected (${badType._status})`);

      // ── 10. Text column in a multi-column molecule now PROVES (Session 133) ──
      // A text field is an internal-table lookup (text_id in molecule_text /
      // molecule_text_pool) and works in any column, not just column 1. The
      // prover used to bail on this shape ("not provable yet"); it must now
      // encode text per-column through the real path and prove it.
      ctx.log('10: text column in a multi-column molecule creates and proves');
      const mctext = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_MC_MCTEXT', label: 'RT multi-col text', molecule_type: 'D',
          attaches_to: 'A', parent_bytes: 5, storage_size: '24',
          columns: [
            { column_order: 1, value_kind: 'value', value_type: 'numeric', scalar_type: 'numeric' },
            { column_order: 2, value_kind: 'value', value_type: 'key', scalar_type: 'text' }
          ]
        }
      });
      ctx.assert(!!mctext.molecule, `multi-column text molecule created (${mctext._status}${mctext.error ? ': ' + mctext.error : ''})`);
      if (mctext.molecule) createdIds.push(mctext.molecule.molecule_id);
      ctx.assert(mctext.round_trip && mctext.round_trip.proven === true && !mctext.round_trip.skipped,
        `multi-column text PROVED through the real path (round_trip: ${JSON.stringify(mctext.round_trip)})`);

      // ── Cleanup: delete every molecule this test created ──
      // Reverse order: the borrower must go before its list source (a list
      // that other molecules borrow is correctly protected from deletion).
      // The member/activity molecules above carry composite rows — their clean
      // DELETE here also proves the delete path removes composite_detail (else
      // the FK would block it).
      ctx.log('Cleanup: deleting the throwaway molecules');
      for (const id of createdIds.slice().reverse()) {
        const del = await ctx.fetch(`/v1/molecules/${id}`, { method: 'DELETE' });
        ctx.assert(del._ok, `deleted throwaway molecule ${id}`);
      }
      const left = await db.query(`SELECT count(*)::int AS n FROM molecule_def WHERE molecule_key LIKE 'RT_MC_%'`);
      ctx.assert(left.rows[0].n === 0, 'zero RT_MC_* molecules remain');
    } finally {
      // Drop the table this test created — the snapshot restore only drops
      // objects that exist in the snapshot, so this would otherwise linger.
      await db.query('DROP TABLE IF EXISTS "5_data_12"').catch(() => {});
      await db.end();
    }
  }
};
