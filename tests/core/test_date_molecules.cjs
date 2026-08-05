/**
 * Core: DATE molecules — the box translates, in both directions (BI session).
 *
 * A molecule's contract is that you hand it the value as humans know it and it
 * stores our format. Dates never honoured that: value_type 'date' existed, but
 * the engine passed the number straight through, so twelve call sites ran
 * dateToMoleculeInt/moleculeIntToDate BY HAND and each had to know which of the
 * two Bill-epoch schemes applied. Two of them got it wrong (the
 * new Date('YYYY-MM-DD') UTC-midnight trap — a badge starting a day early).
 *
 * Now translation lives in encodeValue/decodeValue and nowhere else, for BOTH
 * types, and a bare number is REFUSED rather than sniffed (a day and a
 * 10-second block are indistinguishable as integers).
 *
 *   'date'    — 2 bytes, a calendar DAY
 *   'bigdate' — 4 bytes, a MOMENT (10-second precision) — NEW; the foundation
 *               for pending transactions
 *
 * Proves, on Delta, through real doors (raw SQL only for byte-level
 * verification per MOLECULES.md §7):
 *   1. Creation: both types created through createMoleculeComplete, each
 *      proving its OWN round-trip; the widths are fixed (a date must be 2, a
 *      date/time must be 4) and the wrong width is refused in plain English.
 *   2. The refusal: a bare number handed to either type is rejected, and the
 *      message says why — it is never guessed at.
 *   3. Round-trip through the generic member row door, BYTE-PROVEN: what JS
 *      stores equals what POSTGRES' own date_to_molecule_int /
 *      timestamp_to_audit_ts compute for the same value. If JS and SQL ever
 *      disagree about a stored number, this is the assert that reds.
 *   4. The SQL exit agrees: GROUP_REMOVED's removal date reaches the API
 *      through moleculeJoinSQL (converted Postgres-side, no JS in the path)
 *      and reports the same day the stored byte carries.
 *   5. BADGE end to end (its start AND end columns are dates): the dates come
 *      back exactly as sent — no day shift — the bytes match Postgres, the
 *      badge is found ON ITS OWN FIRST DAY (the third instance of the
 *      UTC-midnight bug lived in that lookup), and delete-by-start-date still
 *      finds its row (the raw-SQL encode path).
 *
 * Mutates Delta config + member data — harness snapshot/restore wipes it.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty',
  // One clock (S167): pin the test's Postgres session to the MACHINE's zone so
  // date_to_molecule_int(CURRENT_DATE) answers the same "today" the platform's
  // JS helpers compute.
  options: `-c TimeZone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`
};

const MEMBER = '2153442807';
const DAY_KEY = 'RT_DATE_DAY';
const MOMENT_KEY = 'RT_DATE_MOMENT';
const GROUP = 'TGD_DATE';
const BADGE_CODE = 'RTDATEBADGE';

// Fixed values, deliberately NOT "today": a day-shift bug hides when every
// value is the same day you compute the expectation on. The moment is aligned
// to a whole 10-second block, which is this type's real precision.
const A_DAY = '2026-03-09';          // the day after US DST starts in 2026
const A_MOMENT = '2026-03-09 14:30:20';
const BADGE_START = '2026-03-09';
const BADGE_END = '2026-11-02';

module.exports = {
  name: 'Core: DATE molecules (date + bigdate translate in the box; bare numbers refused)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const tenantId = 1;

    try {
      ctx.assert((await ctx.fetch('/v1/auth/login', {
        method: 'POST', body: { username: 'Claude', password: 'claude123' }
      }))._ok, 'superuser login');
      ctx.assert((await ctx.fetch('/v1/auth/tenant', {
        method: 'POST', body: { tenant_id: tenantId } }))._ok, 'bound to Delta');

      // ── 1. Creation: both types, each proving its own round-trip ──
      ctx.log('1: create a Date molecule and a Date/Time molecule; widths are fixed');

      const dayMol = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: DAY_KEY, label: 'RT date day', molecule_type: 'D',
          attaches_to: 'M', storage_size: '2',
          columns: [{ column_order: 1, column_type: 'date', value_type: 'date', value_kind: 'value', scalar_type: 'numeric' }]
        }
      });
      ctx.assert(dayMol._ok, `2-byte Date molecule created (${dayMol._status}${dayMol.error ? ': ' + dayMol.error : ''})`);
      ctx.assert(dayMol.round_trip && dayMol.round_trip.proven === true,
        'the Date molecule proved its own round-trip at creation (a real date in, the same date back)');

      const momentMol = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: MOMENT_KEY, label: 'RT date moment', molecule_type: 'D',
          attaches_to: 'M', storage_size: '4',
          columns: [{ column_order: 1, column_type: 'datetime', value_type: 'bigdate', value_kind: 'value', scalar_type: 'numeric' }]
        }
      });
      ctx.assert(momentMol._ok, `4-byte Date/Time molecule created (${momentMol._status}${momentMol.error ? ': ' + momentMol.error : ''})`);
      ctx.assert(momentMol.round_trip && momentMol.round_trip.proven === true,
        'the Date/Time molecule proved its own round-trip at creation (10-second precision held)');

      const wrongDayWidth = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_DATE_BAD1', label: 'x', attaches_to: 'M', storage_size: '4',
          columns: [{ column_order: 1, column_type: 'date', value_type: 'date', value_kind: 'value', scalar_type: 'numeric' }]
        }
      });
      ctx.assert(wrongDayWidth._status === 400 && /calendar day/.test(wrongDayWidth.error || ''),
        'a Date in a 4-byte cell is refused in plain English');

      const wrongMomentWidth = await ctx.fetch('/v1/molecules/complete', {
        method: 'POST',
        body: {
          molecule_key: 'RT_DATE_BAD2', label: 'x', attaches_to: 'M', storage_size: '2',
          columns: [{ column_order: 1, column_type: 'datetime', value_type: 'bigdate', value_kind: 'value', scalar_type: 'numeric' }]
        }
      });
      ctx.assert(wrongMomentWidth._status === 400 && /4-byte moment/.test(wrongMomentWidth.error || ''),
        'a Date/Time in a 2-byte cell is refused in plain English');

      // ── 2. A bare number is REFUSED, never sniffed ──
      ctx.log('2: a bare Bill-epoch number is refused by both types');

      const numberAtDay = await ctx.fetch(`/v1/members/${MEMBER}/molecule-rows/${DAY_KEY}`, {
        method: 'POST', body: { values: [24567] }
      });
      ctx.assert(numberAtDay._status === 400 && /bare number/.test(numberAtDay.error || ''),
        `a bare number handed to a Date is refused, not stored (${numberAtDay._status}: ${numberAtDay.error})`);

      const numberAtMoment = await ctx.fetch(`/v1/members/${MEMBER}/molecule-rows/${MOMENT_KEY}`, {
        method: 'POST', body: { values: [1234567] }
      });
      ctx.assert(numberAtMoment._status === 400 && /bare number/.test(numberAtMoment.error || ''),
        'a bare number handed to a Date/Time is refused too');

      const dayOnlyAtMoment = await ctx.fetch(`/v1/members/${MEMBER}/molecule-rows/${MOMENT_KEY}`, {
        method: 'POST', body: { values: ['2026-03-09'] }
      });
      ctx.assert(dayOnlyAtMoment._status === 400 && /no honest time of day/.test(dayOnlyAtMoment.error || ''),
        'a date with no time is refused by Date/Time — a midnight is never invented');

      // ── 3. Round-trip through a real door, byte-proven against POSTGRES ──
      ctx.log('3: store and read back both types; the stored byte matches Postgres own conversion');

      const putDay = await ctx.fetch(`/v1/members/${MEMBER}/molecule-rows/${DAY_KEY}`, {
        method: 'POST', body: { values: [A_DAY] }
      });
      ctx.assert(putDay._status === 201, `a real date stored (${putDay._status}${putDay.error ? ': ' + putDay.error : ''})`);

      const dayBytes = await db.query(`
        SELECT d.n1, date_to_molecule_int(DATE '${A_DAY}') AS pg_expected,
               molecule_int_to_date(d.n1) AS pg_reads_back
        FROM "5_data_2" d
        JOIN molecule_def md ON md.molecule_id = d.molecule_id
        JOIN member m ON m.link = d.p_link
        WHERE md.molecule_key = $1 AND md.tenant_id = $2 AND m.membership_number = $3
          AND d.attaches_to = 'M'`, [DAY_KEY, tenantId, MEMBER]);
      ctx.assertEqual(dayBytes.rows.length, 1, 'exactly one stored Date row');
      ctx.assertEqual(Number(dayBytes.rows[0].n1), Number(dayBytes.rows[0].pg_expected),
        'THE STORED BYTE IS WHAT POSTGRES COMPUTES for the same day — JS and SQL agree');
      ctx.assertEqual(
        new Date(dayBytes.rows[0].pg_reads_back).toLocaleDateString('en-CA'), A_DAY,
        'Postgres reads the same stored number back as the same calendar day');

      const gotDay = await ctx.fetch(`/v1/members/${MEMBER}/molecule-rows/${DAY_KEY}`);
      ctx.assert(Array.isArray(gotDay) && gotDay.length === 1, 'the Date row reads back through the door');
      ctx.assertEqual(new Date(gotDay[0].values[0]).toLocaleDateString('en-CA'), A_DAY,
        'the door returns the SAME DAY that went in — no shift');

      const putMoment = await ctx.fetch(`/v1/members/${MEMBER}/molecule-rows/${MOMENT_KEY}`, {
        method: 'POST', body: { values: [A_MOMENT] }
      });
      ctx.assert(putMoment._status === 201, `a real date/time stored (${putMoment._status}${putMoment.error ? ': ' + putMoment.error : ''})`);

      const momentBytes = await db.query(`
        SELECT d.n1, timestamp_to_audit_ts(TIMESTAMPTZ '${A_MOMENT}') AS pg_expected
        FROM "5_data_4" d
        JOIN molecule_def md ON md.molecule_id = d.molecule_id
        JOIN member m ON m.link = d.p_link
        WHERE md.molecule_key = $1 AND md.tenant_id = $2 AND m.membership_number = $3
          AND d.attaches_to = 'M'`, [MOMENT_KEY, tenantId, MEMBER]);
      ctx.assertEqual(momentBytes.rows.length, 1, 'exactly one stored Date/Time row');
      ctx.assertEqual(Number(momentBytes.rows[0].n1), Number(momentBytes.rows[0].pg_expected),
        'THE STORED BYTE IS WHAT POSTGRES COMPUTES for the same moment — JS and SQL agree');

      const gotMoment = await ctx.fetch(`/v1/members/${MEMBER}/molecule-rows/${MOMENT_KEY}`);
      ctx.assert(Array.isArray(gotMoment) && gotMoment.length === 1, 'the Date/Time row reads back through the door');
      const backMoment = new Date(gotMoment[0].values[0]);
      ctx.assertEqual(backMoment.getTime(), new Date(A_MOMENT.replace(' ', 'T')).getTime(),
        'the door returns the SAME MOMENT that went in, to the second');

      // A duplicate must still be caught now that the value is a Date object
      // (=== on two Dates is identity, and identity is always false).
      const dupe = await ctx.fetch(`/v1/members/${MEMBER}/molecule-rows/${DAY_KEY}`, {
        method: 'POST', body: { values: [A_DAY] }
      });
      ctx.assertEqual(dupe._status, 409, 'the same date twice is still caught as a duplicate');

      const removed = await ctx.fetch(`/v1/members/${MEMBER}/molecule-rows/${DAY_KEY}`, {
        method: 'DELETE', body: { values: [A_DAY] }
      });
      ctx.assert(removed._ok, `delete-by-date finds its row (${removed._status}${removed.error ? ': ' + removed.error : ''})`);

      // ── 4. The SQL exit: GROUP_REMOVED through moleculeJoinSQL ──
      ctx.log('4: the removal date reaches the API through the SQL join, converted Postgres-side');

      ctx.assert((await ctx.fetch('/v1/groups', {
        method: 'POST', body: { group_code: GROUP, group_name: 'Date molecule test group' }
      }))._ok, 'test group created');
      ctx.assert((await ctx.fetch(`/v1/groups/${GROUP}/members`, {
        method: 'POST', body: { membership_number: MEMBER }
      }))._ok, 'member added to the group');
      ctx.assert((await ctx.fetch(`/v1/groups/${GROUP}/members/${encodeURIComponent(MEMBER)}`, {
        method: 'DELETE' }))._ok, 'member removed (stamps the GROUP_REMOVED date molecule)');

      const history = await ctx.fetch(`/v1/groups/${GROUP}/members?history=1`);
      const histRow = (history || []).find(m => m.membership_number === MEMBER);
      ctx.assert(!!histRow && !!histRow.removed_date, 'history serves the ended stay with its removal date');

      // The side filter is the member_group_member REGISTRY byte — these rows
      // hang on a 5-byte own-table parent, never a borrowed A/M (§5.0).
      const removalByte = await db.query(`
        SELECT molecule_int_to_date(d.n1) AS stored_day
        FROM "5_data_2" d
        JOIN molecule_def md ON md.molecule_id = d.molecule_id
        JOIN member_group_member mm ON mm.link = d.p_link
        JOIN member_group g ON g.link = mm.group_link
        WHERE md.molecule_key = 'GROUP_REMOVED' AND md.tenant_id = $1 AND g.group_code = $2
          AND d.attaches_to = (SELECT CHR(entity_id % 127 + 1) FROM link_tank
                               WHERE table_key = 'member_group_member' AND entity_id IS NOT NULL)`,
        [tenantId, GROUP]);
      ctx.assertEqual(removalByte.rows.length, 1, 'exactly one GROUP_REMOVED molecule row');
      ctx.assertEqual(
        histRow.removed_date,
        new Date(removalByte.rows[0].stored_day).toLocaleDateString('en-CA'),
        'THE SQL EXIT AGREES WITH THE STORED BYTE — the join converts, so JS and SQL cannot drift apart');

      // ── 5. BADGE end to end — two date columns on one molecule ──
      ctx.log('5: badge start + end dates survive the round trip, and the badge is found on its own first day');

      const badgeCreate = await ctx.fetch('/v1/badges', {
        method: 'POST',
        body: { tenant_id: tenantId, badge_code: BADGE_CODE, badge_name: 'RT date badge', icon: '🗓' }
      });
      ctx.assert(badgeCreate._ok || badgeCreate._status === 409,
        `badge definition available (${badgeCreate._status}${badgeCreate.error ? ': ' + badgeCreate.error : ''})`);

      const award = await ctx.fetch(`/v1/members/${MEMBER}/badges`, {
        method: 'POST', body: { badge_code: BADGE_CODE, start_date: BADGE_START, end_date: BADGE_END }
      });
      ctx.assert(award._ok, `badge awarded with a start and end date (${award._status}${award.error ? ': ' + award.error : ''})`);

      const badgeList = await ctx.fetch(`/v1/members/${MEMBER}/badges`);
      const mine = (badgeList || []).find(b => b.badge_code === BADGE_CODE);
      ctx.assert(!!mine, 'the badge reads back');
      ctx.assertEqual(mine.start_date, BADGE_START, 'the START DATE comes back exactly as sent — no day shift');
      ctx.assertEqual(mine.end_date, BADGE_END, 'the END DATE comes back exactly as sent — no day shift');

      const badgeBytes = await db.query(`
        SELECT d.n2, d.n3,
               date_to_molecule_int(DATE '${BADGE_START}') AS pg_start,
               date_to_molecule_int(DATE '${BADGE_END}') AS pg_end
        FROM "5_data_222" d
        JOIN molecule_def md ON md.molecule_id = d.molecule_id
        JOIN member m ON m.link = d.p_link
        JOIN badge b ON b.badge_id = d.n1 + 32768 AND b.tenant_id = md.tenant_id
        WHERE md.molecule_key = 'BADGE' AND md.tenant_id = $1
          AND m.membership_number = $2 AND b.badge_code = $3
          AND d.attaches_to = 'M'`,
        [tenantId, MEMBER, BADGE_CODE]);
      ctx.assertEqual(badgeBytes.rows.length, 1, 'exactly one stored BADGE row for this badge');
      ctx.assertEqual(Number(badgeBytes.rows[0].n2), Number(badgeBytes.rows[0].pg_start),
        'the stored START byte is what Postgres computes for that day');
      ctx.assertEqual(Number(badgeBytes.rows[0].n3), Number(badgeBytes.rows[0].pg_end),
        'the stored END byte is what Postgres computes for that day');

      // The badge-on-date lookup carried the THIRD copy of the UTC-midnight
      // bug — it built the comparison date with new Date('YYYY-MM-DD'), so
      // asked about the badge's OWN FIRST DAY it could answer "no". Prove it
      // through the door that actually uses it: a rule criterion.
      ctx.log('5b: the badge-on-date rule answers correctly on the first day, the last day, and outside');
      const bonus = await ctx.fetch('/v1/bonuses', {
        method: 'POST',
        body: {
          tenant_id: tenantId, bonus_code: 'RTDATEBON', bonus_description: 'RT date badge window',
          bonus_type: 'fixed', bonus_amount: 100,
          start_date: '2026-01-01', end_date: '2026-12-31', is_active: true,
          apply_sunday: true, apply_monday: true, apply_tuesday: true, apply_wednesday: true,
          apply_thursday: true, apply_friday: true, apply_saturday: true
        }
      });
      ctx.assert(bonus._ok, `badge-window bonus created (${bonus._status}${bonus.error ? ': ' + bonus.error : ''})`);
      const bonusId = bonus.bonus?.bonus_id || bonus.bonus_id || bonus.id;

      const crit = await ctx.fetch(`/v1/bonuses/${bonusId}/criteria`, {
        method: 'POST',
        body: {
          source: 'Member', molecule: 'MEMBER_BADGE_ON_DATE', operator: '=',
          value: 'Y', param1_value: BADGE_CODE, label: 'holds the RT badge that day'
        }
      });
      ctx.assert(crit._ok, `criterion "holds the badge on the activity date" saved (${crit._status}${crit.error ? ': ' + crit.error : ''})`);

      const probe = async (date) => (await ctx.fetch('/v1/test-rule/RTDATEBON', {
        method: 'POST',
        body: { member_id: MEMBER, activity_date: date, CARRIER: 'DL', FARE_CLASS: 'Y', ORIGIN: 'MSP', DESTINATION: 'LAX' }
      }));

      const firstDay = await probe(BADGE_START);
      ctx.assert(firstDay._ok && firstDay.pass === true,
        `THE BADGE IS FOUND ON ITS OWN FIRST DAY (${BADGE_START}) — the day-shift bug in this lookup is gone`);

      const lastDay = await probe(BADGE_END);
      ctx.assert(lastDay._ok && lastDay.pass === true, `the badge is still found on its last day (${BADGE_END})`);

      const dayBefore = await probe('2026-03-08');
      ctx.assert(dayBefore._ok && dayBefore.pass === false, 'the badge is NOT found the day before it starts');

      const dayAfter = await probe('2026-11-03');
      ctx.assert(dayAfter._ok && dayAfter.pass === false, 'the badge is NOT found the day after it ends');

      // ── 5c. Delete by start date — the raw-SQL encode path ──
      const badgeIdRow = await db.query(
        `SELECT badge_id FROM badge WHERE badge_code = $1 AND tenant_id = $2`, [BADGE_CODE, tenantId]);
      const delBadge = await ctx.fetch(
        `/v1/members/${MEMBER}/badges/${badgeIdRow.rows[0].badge_id}?start_date=${BADGE_START}`, { method: 'DELETE' });
      ctx.assert(delBadge._ok, `delete-by-start-date succeeded (${delBadge._status}) — the raw-SQL encode path agrees with the writer`);
      const afterDel = await ctx.fetch(`/v1/members/${MEMBER}/badges`);
      ctx.assert(!(afterDel || []).some(b => b.badge_code === BADGE_CODE),
        'the badge is gone — the delete matched on the encoded date');

    } finally {
      // Tidy the config objects this test created (member data rides the
      // harness snapshot/restore). The molecule door is keyed by id.
      for (const key of [DAY_KEY, MOMENT_KEY]) {
        try {
          const r = await db.query(
            `SELECT molecule_id FROM molecule_def WHERE molecule_key = $1 AND tenant_id = $2`, [key, tenantId]);
          if (r.rows.length) await ctx.fetch(`/v1/molecules/${r.rows[0].molecule_id}`, { method: 'DELETE' });
        } catch (e) { /* cleanup only — the restore is the real broom */ }
      }
      await ctx.fetch(`/v1/groups/${GROUP}`, { method: 'DELETE' }).catch(() => {});
      await db.end();
    }
  }
};
