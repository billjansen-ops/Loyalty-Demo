/**
 * Core: The molecule two-door (BI session, v158 — Bill's design).
 *
 * The molecule surface opens from two places. The superuser door sees
 * everything, exactly as before. The client-admin door narrows to the RULES
 * VOCABULARY: definitions whose attaches_to letters are set (the letters MEAN
 * "usable as a criteria field on that side") and that are not engine-owned
 * (system_required). Client admins maintain labels/descriptions and list
 * values; structure is superuser surgery. Plumbing answers 404 (no oracle).
 *
 * Proves:
 *   1. v158 census: the six plumbing molecules (TRANSFER_LINK,
 *      SPONSOR_SOURCE_LINK, MED_LINK, BAD_EMAIL, BAD_PHONE, BADGE) carry NO
 *      letters on ANY tenant — and every one still has its routing rows
 *      (the S137 fallback safety the migration asserted).
 *   2. Superuser list: full surface, plumbing included.
 *   3. Client-admin list: lettered + non-system only — no plumbing, no
 *      engine molecules; the program vocabulary and member facts present.
 *   4. Plumbing answers 404 to the admin (GET, PUT, value doors).
 *   5. Structural PUT refused in plain English naming the field; reference
 *      molecules refused by name; create/delete/column/lookup doors 403.
 *   6. Label edit works for the admin and round-trips.
 *   7. List-value add on the admin's vocabulary works (allocateListValueId
 *      path — the value reads back).
 *   8. The rule editors' by-source pickers no longer offer plumbing.
 *
 * Creates its own Delta admin login; snapshot/restore wipes everything.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty',
  // One clock (S167): pin the test's Postgres session to the machine zone
  options: `-c TimeZone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`
};

const PLUMBING = ['TRANSFER_LINK', 'SPONSOR_SOURCE_LINK', 'MED_LINK', 'BAD_EMAIL', 'BAD_PHONE', 'BADGE'];

module.exports = {
  name: 'Core: Molecule two-door (superuser full surface, client-admin rules vocabulary, v158 census)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const tenantId = 1;

    try {
      // ── Superuser session ──
      const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(login._ok, 'superuser login');
      ctx.assert((await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } }))._ok, 'bound to Delta');

      // ── 1. v158 census ──
      ctx.log('Step 1: v158 census — plumbing letterless everywhere, routing rows intact');
      const census = (await db.query(`
        SELECT (SELECT COUNT(*) FROM molecule_def WHERE molecule_key = ANY($1) AND COALESCE(attaches_to,'') <> '')::int AS lettered,
               (SELECT COUNT(*) FROM molecule_def d WHERE d.molecule_key = ANY($1) AND d.is_active = true
                  AND NOT EXISTS (SELECT 1 FROM molecule_value_lookup l WHERE l.molecule_id = d.molecule_id))::int AS rowless`,
        [PLUMBING])).rows[0];
      ctx.assertEqual(census.lettered, 0, 'no plumbing molecule carries rules letters on any tenant');
      ctx.assertEqual(census.rowless, 0, 'every plumbing molecule keeps its storage routing rows (S137 fallback safety)');

      // ── 2. Superuser sees everything ──
      const superList = await ctx.fetch('/v1/molecules');
      const superKeys = new Set(superList.map(m => m.molecule_key));
      ctx.assert(PLUMBING.every(k => superKeys.has(k) || k === 'BADGE' && superKeys.has(k)),
        'superuser list includes the plumbing');
      ctx.assert(superKeys.has('MEMBER_POINTS') && superKeys.has('CARRIER'), 'superuser list includes engine molecules and vocabulary');

      // ── Own client-admin login ──
      ctx.log('Step 2: a Delta client admin logs in');
      const mk = await ctx.fetch('/v1/users', { method: 'POST', body: {
        username: 'twodoor_admin', password: 'twodoor123!', display_name: 'Two-Door Admin', role: 'admin', tenant_id: tenantId } });
      ctx.assert(mk._ok, `admin user created (${mk._status})`);

      // Second cookie jar: raw fetch against the same base as ctx
      const base = process.env.TEST_API_BASE || 'http://127.0.0.1:4001';
      let adminCookie = '';
      const admin = async (path, opts = {}) => {
        const r = await fetch(base + path, {
          method: opts.method || 'GET',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: opts.body ? JSON.stringify(opts.body) : undefined
        });
        const setC = r.headers.get('set-cookie');
        if (setC) adminCookie = setC.split(';')[0];
        const j = await r.json().catch(() => ({}));
        return { _status: r.status, _ok: r.ok, ...(Array.isArray(j) ? { rows: j } : j) };
      };
      const aLogin = await admin('/v1/auth/login', { method: 'POST', body: { username: 'twodoor_admin', password: 'twodoor123!' } });
      ctx.assert(aLogin._ok && aLogin.role === 'admin', `admin session (role ${aLogin.role})`);

      // ── 3. The narrowed list ──
      ctx.log('Step 3: the client-admin list is the rules vocabulary');
      const aList = await admin('/v1/molecules');
      const aKeys = new Set((aList.rows || []).map(m => m.molecule_key));
      ctx.assert(aKeys.size > 0 && aKeys.size < superKeys.size, `narrower than superuser (${aKeys.size} < ${superKeys.size})`);
      const leaked = [...PLUMBING, 'MEMBER_POINTS', 'BONUS_RULE_ID', 'BONUS_ACTIVITY_LINK', 'IS_DELETED']
        .filter(k => aKeys.has(k));
      ctx.assertEqual(leaked.length, 0, `no plumbing or engine molecules leak (${leaked.join(',') || 'none'})`);
      for (const k of ['CARRIER', 'ORIGIN', 'DESTINATION', 'FARE_CLASS', 'MEMBER_TIER_ON_DATE', 'MEMBER_STATE']) {
        ctx.assert(aKeys.has(k), `vocabulary present: ${k}`);
      }

      // Molecule ids for the door probes
      const ids = {};
      for (const k of ['TRANSFER_LINK', 'CARRIER', 'FARE_CLASS', 'MEMBER_TIER_ON_DATE', 'COLOR']) {
        ids[k] = (await db.query(`SELECT molecule_id FROM molecule_def WHERE tenant_id=$1 AND molecule_key=$2`, [tenantId, k])).rows[0].molecule_id;
      }

      // ── 4. Plumbing has no oracle ──
      ctx.log('Step 4: plumbing answers 404 to the admin');
      ctx.assertEqual((await admin(`/v1/molecules/${ids.TRANSFER_LINK}`))._status, 404, 'GET plumbing → 404');
      ctx.assertEqual((await admin(`/v1/molecules/${ids.TRANSFER_LINK}`, { method: 'PUT', body: { label: 'x' } }))._status, 404, 'PUT plumbing → 404');
      ctx.assertEqual((await admin(`/v1/molecules/${ids.TRANSFER_LINK}/values`, { method: 'POST', body: { text_value: 'X' } }))._status, 404, 'value door on plumbing → 404');

      // ── 5. Structure is superuser surgery ──
      ctx.log('Step 5: structural doors refuse in plain English');
      const structural = await admin(`/v1/molecules/${ids.CARRIER}`, { method: 'PUT', body: { storage_size: '4' } });
      ctx.assert(structural._status === 403 && /storage_size/.test(structural.error || ''), `structural PUT names the field (${structural.error})`);
      const ref = await admin(`/v1/molecules/${ids.MEMBER_TIER_ON_DATE}`, { method: 'PUT', body: { label: 'Tier' } });
      ctx.assert(ref._status === 403 && /reference/.test(ref.error || ''), 'reference molecule refused by kind');
      ctx.assertEqual((await admin('/v1/molecules', { method: 'POST', body: { molecule_key: 'HACK' } }))._status, 403, 'create → 403');
      ctx.assertEqual((await admin(`/v1/molecules/${ids.CARRIER}`, { method: 'DELETE' }))._status, 403, 'delete → 403');
      ctx.assertEqual((await admin(`/v1/molecules/${ids.CARRIER}/column-definitions`, { method: 'PUT', body: {} }))._status, 403, 'column-definitions → 403');
      ctx.assertEqual((await admin(`/v1/molecules/${ids.CARRIER}/lookup-config`, { method: 'PUT', body: {} }))._status, 403, 'lookup-config → 403');

      // ── 6. Labels are theirs ──
      ctx.log('Step 6: label maintenance works and round-trips');
      const relabel = await admin(`/v1/molecules/${ids.COLOR}`, { method: 'PUT', body: { label: 'Colour (two-door test)' } });
      ctx.assert(relabel._ok && relabel.label === 'Colour (two-door test)', 'label edit saves');
      const back = await admin(`/v1/molecules/${ids.COLOR}`);
      ctx.assertEqual(back.label, 'Colour (two-door test)', 'label reads back');

      // ── 7. List values are theirs ──
      ctx.log('Step 7: list-value add on the vocabulary');
      const addVal = await admin(`/v1/molecules/${ids.FARE_CLASS}/values`, {
        method: 'POST', body: { value: 'Q', label: 'Two-Door Test Class' } });
      ctx.assert(addVal._ok, `value added through the guarded door (${addVal._status}${addVal.error ? ': ' + addVal.error : ''})`);
      const vRow = (await db.query(
        `SELECT value_id FROM molecule_value_text WHERE molecule_id = $1 AND text_value = 'Q'`, [ids.FARE_CLASS])).rows[0];
      ctx.assert(!!vRow && vRow.value_id >= 1 && vRow.value_id <= 127, `value_id per-molecule and in byte range (${vRow?.value_id})`);

      // ── 8. The rule pickers cleaned themselves ──
      ctx.log('Step 8: by-source pickers carry no plumbing');
      for (const side of ['Activity', 'Member']) {
        const src = await ctx.fetch(`/v1/molecules/by-source/${side}`);
        const srcKeys = (Array.isArray(src) ? src : src.rows || []).map(m => m.molecule_key);
        const dirty = PLUMBING.filter(k => srcKeys.includes(k));
        ctx.assertEqual(dirty.length, 0, `${side}-side picker clean (${dirty.join(',') || 'none'})`);
      }

    } finally {
      await db.end();
    }
  }
};
