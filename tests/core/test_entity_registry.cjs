/**
 * Core: entity-type registry (Session 137 — docs/MOLECULE_ATTACH_ANYTHING_DESIGN.md)
 *
 * link_tank is the keeper of the 1-byte "who do I belong to" codes — used
 * purely as the existing directory of table names; link ALLOCATION is
 * untouched. The three legacy parents keep the codes their stored letters
 * already encode (activity 64 'A', member_alias 75 'L', member 76 'M'), so
 * zero legacy storage rows changed. platform_user got the first minted code
 * (77, byte 'N') and the one 4_data_12 placeholder row was restamped to it.
 *
 * Proves:
 *   1. Seed + byte identity: registered codes squish to EXACTLY the letters
 *      the data has always stored; codes unique; blank code (31) absent;
 *      every byte in every storage table is a registered code's byte.
 *   2. User-parent rows live under the TRUE code: the positions surface
 *      reads/writes/deletes through byte 'N', and a planted legacy-'A'
 *      residue row is invisible to it.
 *   3. Self-registration: creating a molecule on a brand-new parent table
 *      (partner_program — the first molecule ever attached to a clinic)
 *      mints the next code automatically and the round-trip proves through
 *      the real doors.
 *   4. A typo'd parent table fails loud in plain English, writing nothing.
 *
 * Tenant 5 (wi_php) for the positions surface; the clinic molecule is
 * created and deleted inside the test. Snapshot/restore wipes the rest.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

module.exports = {
  name: 'Core: entity-type registry (table→code directory, self-registering)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const createdIds = [];
    let clinicTableCreated = false, clinicTableName = null;

    try {
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 5 } });

      // ── 1. Seed + byte identity ──
      ctx.log('Step 1: registry seed and byte identity');
      const reg = await db.query(
        `SELECT table_key, entity_id, CHR(entity_id % 127 + 1) AS byte
         FROM link_tank WHERE entity_id IS NOT NULL ORDER BY entity_id`);
      const byKey = Object.fromEntries(reg.rows.map(r => [r.table_key, r]));
      ctx.assert(byKey.activity?.entity_id === 64 && byKey.activity?.byte === 'A', `activity = 64, byte 'A' (${JSON.stringify(byKey.activity)})`);
      ctx.assert(byKey.member_alias?.entity_id === 75 && byKey.member_alias?.byte === 'L', `member_alias = 75, byte 'L'`);
      ctx.assert(byKey.member?.entity_id === 76 && byKey.member?.byte === 'M', `member = 76, byte 'M'`);
      ctx.assert(byKey.platform_user?.entity_id === 77 && byKey.platform_user?.byte === 'N', `platform_user = 77, byte 'N'`);
      ctx.assert(!reg.rows.some(r => r.entity_id === 31), 'blank code (31) never assigned');
      const uniq = await db.query(
        `SELECT COUNT(*)::int AS n, COUNT(DISTINCT entity_id)::int AS d FROM link_tank WHERE entity_id IS NOT NULL`);
      ctx.assertEqual(uniq.rows[0].n, uniq.rows[0].d, 'entity codes are unique');

      // Every byte in every storage table is a registered code's byte
      const bytes = await db.query(`
        SELECT DISTINCT side FROM (
          SELECT attaches_to AS side FROM "5_data_0"
          UNION SELECT attaches_to FROM "5_data_1" UNION SELECT attaches_to FROM "5_data_2"
          UNION SELECT attaches_to FROM "5_data_22" UNION SELECT attaches_to FROM "5_data_222"
          UNION SELECT attaches_to FROM "5_data_4" UNION SELECT attaches_to FROM "5_data_5"
          UNION SELECT attaches_to FROM "5_data_54" UNION SELECT attaches_to FROM "4_data_1"
          UNION SELECT attaches_to FROM "4_data_12"
        ) x`);
      const registeredBytes = new Set(reg.rows.map(r => r.byte));
      const strays = bytes.rows.map(r => r.side).filter(b => !registeredBytes.has(b));
      ctx.assertEqual(strays.length, 0, `every stored byte is a registered code (strays: ${JSON.stringify(strays)})`);

      // ── 2. User-parent rows under the true code ──
      ctx.log('Step 2: positions surface reads/writes byte N; legacy-A residue invisible');
      const pcRow = await db.query(`
        SELECT u.user_id, d.p_link, d.c1, d.n1
        FROM "4_data_12" d
        JOIN molecule_def md ON md.molecule_id = d.molecule_id AND md.molecule_key = 'POSITIONCLINIC'
        JOIN platform_user u ON u.link = d.p_link
        LIMIT 1`);
      ctx.assert(pcRow.rows.length === 1, 'the assigned POSITIONCLINIC row exists and joins to its login');
      const holder = pcRow.rows[0];
      const stamped = await db.query(
        `SELECT attaches_to FROM "4_data_12" WHERE p_link = $1`, [holder.p_link]);
      ctx.assert(stamped.rows.every(r => r.attaches_to === 'N'), `stored rows carry byte 'N' (v106 restamp)`);

      // Counts are RELATIVE to this holder's own rows — a database with
      // real usage (the Heroku copy) has staff holding more than one
      // position row, and the invariants hold at any base count.
      const listed = await ctx.fetch(`/v1/users/${holder.user_id}/molecule-rows/POSITIONCLINIC`);
      ctx.assert(Array.isArray(listed) && listed.length >= 1, `positions surface reads the restamped row(s) (${Array.isArray(listed) ? listed.length : listed?.error})`);
      const baseN = listed.length;
      const rowValues = listed[0].values;

      // Plant pre-migration residue: same row under the retired 'A' placeholder
      await db.query(
        `INSERT INTO "4_data_12" (p_link, attaches_to, molecule_id, c1, n1)
         SELECT p_link, 'A', molecule_id, c1, n1 FROM "4_data_12" WHERE p_link = $1 AND attaches_to = 'N' LIMIT 1`,
        [holder.p_link]);
      const listed2 = await ctx.fetch(`/v1/users/${holder.user_id}/molecule-rows/POSITIONCLINIC`);
      ctx.assertEqual(listed2.length, baseN, 'a planted legacy-A residue row is invisible to the surface');

      // Duplicate check reads the same side (409), delete removes ONLY byte-N
      const dup = await ctx.fetch(`/v1/users/${holder.user_id}/molecule-rows/POSITIONCLINIC`, { method: 'POST', body: { values: rowValues } });
      ctx.assertEqual(dup._status, 409, `re-adding the same assignment is refused (${dup._status})`);
      const del = await ctx.fetch(`/v1/users/${holder.user_id}/molecule-rows/POSITIONCLINIC`, { method: 'DELETE', body: { values: rowValues } });
      ctx.assert(del._ok, 'remove succeeds');
      const sides = await db.query(
        `SELECT attaches_to, COUNT(*)::int AS n FROM "4_data_12" WHERE p_link = $1 GROUP BY 1`, [holder.p_link]);
      const aCount = sides.rows.find(r => r.attaches_to === 'A')?.n || 0;
      const nCount = sides.rows.find(r => r.attaches_to === 'N')?.n || 0;
      ctx.assert(aCount === 1 && nCount === baseN - 1,
        `remove deleted only ONE byte-N row — the planted A row survived (${JSON.stringify(sides.rows)}, base ${baseN})`);
      const readd = await ctx.fetch(`/v1/users/${holder.user_id}/molecule-rows/POSITIONCLINIC`, { method: 'POST', body: { values: rowValues } });
      ctx.assert(readd._ok, 're-add succeeds despite the planted A row (dup check reads byte N only)');
      const restored = await db.query(
        `SELECT COUNT(*)::int AS n FROM "4_data_12" WHERE p_link = $1 AND attaches_to = 'N'`, [holder.p_link]);
      ctx.assertEqual(restored.rows[0].n, baseN, `the re-added row is stamped 'N' — writes carry the true code`);

      // ── 3. Self-registration: first molecule ever attached to a clinic ──
      ctx.log('Step 3: new parent (partner_program) self-registers + round-trip proves');
      const preReg = await db.query(`SELECT entity_id FROM link_tank WHERE table_key = 'partner_program'`);
      ctx.assert(!preReg.rows.length || preReg.rows[0].entity_id === null, 'precondition: partner_program not yet registered');

      const clinic = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_CLINIC_NOTE', label: 'RT clinic note', molecule_type: 'D',
          attaches_to: '', parent_bytes: 4, parent_table: 'partner_program', storage_size: '1',
          columns: [{ column_order: 1, value_kind: 'internal_list', value_type: 'code' }],
          values: [{ value: 'RT1', label: 'Round trip one' }]
        }
      });
      ctx.assert(clinic._ok && clinic.round_trip && clinic.round_trip.proven === true,
        `clinic molecule created + round-trip PROVEN (${clinic._status}${clinic.error ? ': ' + clinic.error : ''})`);
      if (clinic.molecule) createdIds.push(clinic.molecule.molecule_id);
      clinicTableCreated = clinic.table_created === true;
      clinicTableName = clinic.table_name || null;

      const minted = await db.query(`SELECT entity_id FROM link_tank WHERE table_key = 'partner_program' AND entity_id IS NOT NULL`);
      ctx.assert(minted.rows.length === 1, 'partner_program self-registered');
      const clinicCode = minted.rows.length ? Number(minted.rows[0].entity_id) : null;
      ctx.assert(clinicCode > 77 && ![31, 64, 75, 76].includes(clinicCode),
        `minted code is fresh and non-reserved (${clinicCode})`);
      const defParent = await db.query(
        `SELECT parent_entity_id FROM molecule_def WHERE molecule_id = $1`, [clinic.molecule.molecule_id]);
      ctx.assertEqual(Number(defParent.rows[0].parent_entity_id), clinicCode, 'the definition names its parent by that code');

      // ── 4. A typo'd parent table fails loud, writes nothing ──
      ctx.log('Step 4: typo rejection');
      const typo = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_TYPO_PARENT', label: 'x', molecule_type: 'D',
          attaches_to: '', parent_bytes: 4, parent_table: 'no_such_table_xyz', storage_size: '1',
          columns: [{ column_order: 1, value_kind: 'internal_list', value_type: 'code' }],
          values: [{ value: 'X', label: 'x' }]
        }
      });
      ctx.assert(!typo._ok && /no table/i.test(typo.error || ''), `typo'd parent refused in plain English (${typo.error})`);
      const noWrite = await db.query(`SELECT 1 FROM molecule_def WHERE molecule_key = 'RT_TYPO_PARENT'`);
      ctx.assertEqual(noWrite.rows.length, 0, 'nothing was written for the refused molecule');
      const noPhantom = await db.query(`SELECT 1 FROM link_tank WHERE table_key = 'no_such_table_xyz'`);
      ctx.assertEqual(noPhantom.rows.length, 0, 'no phantom registry entry for the typo');

    } finally {
      for (const id of createdIds) {
        await ctx.fetch(`/v1/molecules/${id}`, { method: 'DELETE' }).catch(() => {});
      }
      // Snapshot restore doesn't drop tables it never knew — drop a
      // test-created storage table ourselves (same rule as the create test)
      if (clinicTableCreated && clinicTableName && /^"?4_data_[0-9]+"?$/.test(clinicTableName)) {
        await db.query(`DROP TABLE IF EXISTS ${clinicTableName.startsWith('"') ? clinicTableName : `"${clinicTableName}"`}`).catch(() => {});
      }
      await db.end();
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    }
  }
};
