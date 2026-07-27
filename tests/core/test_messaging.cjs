/**
 * Core: Outbound Messaging — the black boxes (Session 158, v138 —
 * docs/MESSAGING_DESIGN.md is the contract, Bill's design).
 *
 * Callers are finished forever: sendMemberMessage / notifyMember write one
 * member_message row per call (queue AND history), the provider wires in
 * later, nothing upstream ever changes. This test proves the boxes, the
 * pre-flight, the molecules, the drain, and the callback door — through
 * platform doors; raw SQL only for byte verification (MOLECULES.md §7) and
 * queue-row time-warping (test setup on the queue table, not molecule
 * storage; snapshot/restore wipes everything).
 *
 * Proves:
 *   1. v138 census: every tenant carries CHANNEL_PREF + BAD_EMAIL +
 *      BAD_PHONE and the MSG_QUEUE job (the seedUniversalMolecules door).
 *   2. The send door: marketing email queues with the address SNAPSHOT;
 *      urgent operational stays pending with no provider (never silently
 *      "sent"); nonsense class refused in plain English.
 *   3. Pre-flight: do-not-contact group suppresses MARKETING but not
 *      OPERATIONAL (the legal split); no-address suppresses; every
 *      suppression is a recorded history row, not a silent drop.
 *   4. CHANNEL_PREF routes the auto channel (molecule round-trip through
 *      the real profile doors).
 *   5. The callback door: 404 while no secret is configured (no oracle);
 *      with the secret, a hard bounce stamps the receipt AND writes the
 *      BAD_EMAIL molecule — byte-proven in 5_data_42 (text_id decodes to
 *      the address, date = today, attaches_to = 'M').
 *   6. Sendability DERIVES: the bounced address suppresses; changing the
 *      member's email through the profile door makes them sendable again —
 *      nothing was cleared.
 *   7. MED email results are REAL enqueues (source med:CODE) — MEDS done.
 *   8. The workforce consent gate: an Insight member's message is
 *      suppressed 'consent_gate' — config cannot leak past the box.
 *   9. The MSG_QUEUE drain: honest counts with no provider; a time-warped
 *      expiry sweeps to 'expired' (stale marketing never blasts late).
 *
 * Tenant 1 (Delta) + one wi_php read for the gate. Snapshot/restore wipes.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

const DNC = 'DO_NOT_CONTACT';
const AMG = 'TMG_S158M';   // MED audience group
const MED = 'TMS_S158';    // the MED with an email result

module.exports = {
  name: 'Core: Outbound messaging (black boxes, pre-flight, bounce molecules, drain, callback)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const tenantId = 1;

    try {
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });

      // ── 1. The census — the one seeding door reached every tenant ──
      ctx.log('Step 1: universal molecule + job census');
      const census = (await db.query(`
        SELECT (SELECT COUNT(*) FROM tenant)::int AS tenants,
               (SELECT COUNT(DISTINCT tenant_id) FROM molecule_def WHERE molecule_key = 'CHANNEL_PREF')::int AS pref,
               (SELECT COUNT(DISTINCT tenant_id) FROM molecule_def WHERE molecule_key = 'BAD_EMAIL')::int AS bade,
               (SELECT COUNT(DISTINCT tenant_id) FROM molecule_def WHERE molecule_key = 'BAD_PHONE')::int AS badp,
               (SELECT COUNT(*) FROM scheduled_job WHERE job_code = 'MSG_QUEUE')::int AS job`)).rows[0];
      ctx.assertEqual(census.pref, census.tenants, `CHANNEL_PREF on every tenant (${census.pref}/${census.tenants})`);
      ctx.assertEqual(census.bade, census.tenants, `BAD_EMAIL on every tenant`);
      ctx.assertEqual(census.badp, census.tenants, `BAD_PHONE on every tenant`);
      ctx.assertEqual(census.job, census.tenants, `MSG_QUEUE job on every tenant`);

      // Two Delta members with an email AND a phone (the routing needs both)
      const people = (await db.query(
        `SELECT link, membership_number, fname, lname, email, phone,
                address1, address2, city, state, zip, zip_plus4, title, middle_initial
         FROM member
         WHERE tenant_id = $1 AND is_active = true AND membership_number IS NOT NULL
           AND email IS NOT NULL AND email <> '' AND phone IS NOT NULL AND phone <> ''
         ORDER BY membership_number LIMIT 2`, [tenantId])).rows;
      ctx.assert(people.length === 2, `precondition: two Delta members with email + phone (${people.length})`);
      const [A, B] = people;
      const rowsFor = async (link) => (await db.query(
        `SELECT * FROM member_message WHERE member_link = $1 ORDER BY created_at DESC`, [link])).rows;

      // ── 2. The send door ──
      ctx.log('Step 2: the send door — queue, snapshot, urgent honesty, plain refusals');
      const q1 = await ctx.fetch(`/v1/members/${A.membership_number}/message`, {
        method: 'POST', body: { channel: 'E', msg_class: 'M', urgency: 'Q', subject: 'Hello', body: 'first marketing message' }
      });
      ctx.assert(q1._ok && q1.status === 'pending', `marketing email queued (${q1._status}/${q1.status})`);
      let rows = await rowsFor(A.link);
      ctx.assert(rows.length === 1 && rows[0].to_address === A.email, 'row written with the address SNAPSHOT');
      ctx.assert(rows[0].expires_at !== null, 'marketing carries an expiry (stale offers never blast late)');

      const urgent = await ctx.fetch(`/v1/members/${A.membership_number}/message`, {
        method: 'POST', body: { channel: 'E', msg_class: 'O', urgency: 'N', subject: 'Reset', body: 'operational urgent' }
      });
      ctx.assert(urgent._ok && urgent.status === 'pending', `urgent with no provider stays pending, never fake-sent (${urgent.status})`);
      rows = await rowsFor(A.link);
      const urgRow = rows.find(r => r.msg_class === 'O');
      ctx.assert(urgRow && urgRow.expires_at === null, 'operational messages do not expire');

      const badClass = await ctx.fetch(`/v1/members/${A.membership_number}/message`, {
        method: 'POST', body: { channel: 'E', msg_class: 'X', body: 'nope' }
      });
      ctx.assert(badClass._status === 400 && /msg_class/.test(badClass.error || ''), `nonsense class refused (${badClass.error})`);

      // ── 3. The legal split: DNC suppresses marketing, not operational ──
      ctx.log('Step 3: do-not-contact — marketing suppressed, operational passes');
      const g = await ctx.fetch('/v1/groups', { method: 'POST', body: { group_code: DNC, group_name: 'Do not contact' } });
      ctx.assert(g._ok, `DNC group created (${g._status})`);
      const add = await ctx.fetch(`/v1/groups/${DNC}/members`, { method: 'POST', body: { membership_number: A.membership_number } });
      ctx.assert(add._ok, `A opted out (added to DNC) (${add._status})`);

      const mkt = await ctx.fetch(`/v1/members/${A.membership_number}/message`, {
        method: 'POST', body: { channel: 'E', msg_class: 'M', urgency: 'Q', body: 'marketing to opted-out' }
      });
      ctx.assert(mkt._ok && mkt.status === 'suppressed' && mkt.suppress_reason === 'do_not_contact',
        `marketing suppressed for opted-out member (${mkt.status}/${mkt.suppress_reason})`);
      const ops = await ctx.fetch(`/v1/members/${A.membership_number}/message`, {
        method: 'POST', body: { channel: 'E', msg_class: 'O', urgency: 'Q', body: 'operational to opted-out' }
      });
      ctx.assert(ops._ok && ops.status === 'pending', `operational still reaches an opted-out member (${ops.status})`);
      const supRow = (await rowsFor(A.link)).find(r => r.status === 'suppressed');
      ctx.assert(!!supRow, 'the suppression is a recorded history row, not a silent drop');
      await ctx.fetch(`/v1/groups/${DNC}/members/${encodeURIComponent(A.membership_number)}`, { method: 'DELETE' });

      // ── 4. CHANNEL_PREF routes the auto channel ──
      ctx.log('Step 4: channel preference — molecule round-trip through the profile doors');
      const prefSave = await ctx.fetch(`/v1/member/${B.membership_number}/molecules`, {
        method: 'PUT', body: { molecules: { CHANNEL_PREF: 'SMS' } }
      });
      ctx.assert(prefSave._ok, `CHANNEL_PREF = SMS saves through the member door (${prefSave._status}${prefSave.error ? ': ' + prefSave.error : ''})`);
      const prefRead = await ctx.fetch(`/v1/member/${B.membership_number}/molecules?tenant_id=${tenantId}`);
      ctx.assert(prefRead._ok && JSON.stringify(prefRead).includes('SMS'), 'CHANNEL_PREF reads back SMS');
      const auto = await ctx.fetch(`/v1/members/${B.membership_number}/message`, {
        method: 'POST', body: { channel: 'auto', msg_class: 'M', urgency: 'Q', body: 'routed message' }
      });
      ctx.assert(auto._ok && auto.status === 'pending', `auto-channel send queued (${auto.status})`);
      const bRows = await rowsFor(B.link);
      ctx.assert(bRows.length === 1 && bRows[0].channel === 'S' && bRows[0].to_address === B.phone,
        `the routing box chose SMS from the preference (channel=${bRows[0] && bRows[0].channel})`);

      // ── 5. The callback door + the bounce molecule ──
      ctx.log('Step 5: callback — locked without a secret; a hard bounce writes the molecule');
      const noSecret = await ctx.fetch('/v1/messaging/callback', {
        method: 'POST', body: { provider_message_id: 'x', verdict: 'delivered' }
      });
      ctx.assertEqual(noSecret._status, 404, `callback answers 404 while no secret is configured (${noSecret._status})`);

      // Test setup: plant the callback secret (platform config, tenant 0) and
      // a provider receipt on A's first marketing row — raw SQL on config +
      // queue tables only (not molecule storage); snapshot/restore wipes it.
      const spId = (await db.query(`SELECT sysparm_id FROM sysparm WHERE tenant_id = 0 AND sysparm_key = 'messaging'`)).rows[0].sysparm_id;
      await db.query(`INSERT INTO sysparm_detail (sysparm_id, category, code, value) VALUES ($1, 'provider', 'callback_secret', 'test-secret-158')`, [spId]);
      const firstRow = (await rowsFor(A.link)).find(r => r.msg_class === 'M' && r.status === 'pending');
      await db.query(`UPDATE member_message SET provider_message_id = 'pm-158-1', status = 'sent' WHERE link = $1`, [firstRow.link]);

      const wrongSecret = await ctx.fetch('/v1/messaging/callback', {
        method: 'POST', headers: { 'x-messaging-secret': 'wrong' },
        body: { provider_message_id: 'pm-158-1', verdict: 'bounced' }
      });
      ctx.assertEqual(wrongSecret._status, 404, 'wrong secret answers 404 (no oracle)');

      const cb = await ctx.fetch('/v1/messaging/callback', {
        method: 'POST', headers: { 'x-messaging-secret': 'test-secret-158' },
        body: { provider_message_id: 'pm-158-1', verdict: 'bounced', detail: 'mailbox does not exist' }
      });
      ctx.assert(cb._ok && cb.hard_bounce_recorded === true, `hard bounce accepted (${cb._status})`);
      const stamped = (await db.query(`SELECT provider_status FROM member_message WHERE link = $1`, [firstRow.link])).rows[0];
      ctx.assertEqual(stamped.provider_status, 'bounced', 'receipt stamped on the queue row');

      // §7 byte verification: the molecule row carries the address + today
      const molId = (await db.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'BAD_EMAIL'`, [tenantId])).rows[0].molecule_id;
      const bytes = (await db.query(`
        SELECT d.n1 + 2147483648 AS text_id, d.n2 AS day, d.attaches_to,
               (SELECT text_value FROM molecule_text WHERE text_id = d.n1 + 2147483648) AS address,
               date_to_molecule_int(CURRENT_DATE) AS today
        FROM "5_data_42" d WHERE d.p_link = $1 AND d.molecule_id = $2`, [A.link, molId])).rows;
      ctx.assertEqual(bytes.length, 1, 'exactly one BAD_EMAIL history row');
      ctx.assertEqual(bytes[0].address, A.email, `the molecule carries THE ADDRESS THAT DIED (${bytes[0].address})`);
      ctx.assertEqual(Number(bytes[0].day), Number(bytes[0].today), 'and the Bill-epoch day we heard');
      ctx.assertEqual(bytes[0].attaches_to, 'M', "stored on the member side ('M') — MOLECULES.md §5.0");

      // ── 6. Sendability derives — nothing is ever cleared ──
      ctx.log('Step 6: dead address suppresses; a changed address is sendable again');
      const dead = await ctx.fetch(`/v1/members/${A.membership_number}/message`, {
        method: 'POST', body: { channel: 'E', msg_class: 'M', urgency: 'Q', body: 'to a dead address' }
      });
      ctx.assert(dead._ok && dead.suppress_reason === 'address_known_bad',
        `current address matching the history suppresses (${dead.suppress_reason})`);
      // The profile door is a WHOLE-ROW save (the real screen loads then
      // saves everything) — send the full profile with only the email changed.
      const prof = await ctx.fetch(`/v1/member/${A.membership_number}/profile`, {
        method: 'PUT', body: {
          membership_number: A.membership_number, title: A.title,
          fname: A.fname, lname: A.lname, middle_initial: A.middle_initial,
          email: 'fresh.address.s158@example.com', phone: A.phone,
          address1: A.address1, address2: A.address2, city: A.city,
          state: A.state, zip: A.zip, zip_plus4: A.zip_plus4, is_active: true
        }
      });
      ctx.assert(prof._ok, `A's email changed through the profile door (${prof._status}${prof.error ? ': ' + prof.error : ''})`);
      const alive = await ctx.fetch(`/v1/members/${A.membership_number}/message`, {
        method: 'POST', body: { channel: 'E', msg_class: 'M', urgency: 'Q', body: 'to the new address' }
      });
      ctx.assert(alive._ok && alive.status === 'pending', `new address is sendable BY DERIVATION — nothing was cleared (${alive.status})`);
      const aliveRow = (await rowsFor(A.link))[0];
      ctx.assertEqual(aliveRow.to_address, 'fresh.address.s158@example.com', 'and the new snapshot rides the row');

      // ── 7. MED email results are real enqueues ──
      ctx.log('Step 7: a MED firing enqueues its email through the box');
      await ctx.fetch('/v1/groups', { method: 'POST', body: { group_code: AMG, group_name: 'S158 msg audience' } });
      await ctx.fetch(`/v1/groups/${AMG}/members`, { method: 'POST', body: { membership_number: B.membership_number } });
      const medCreate = await ctx.fetch('/v1/meds', {
        method: 'POST', body: { med_code: MED, med_name: 'S158 message MED', start_date: '2020-01-01', end_date: '2030-12-31' }
      });
      ctx.assert(medCreate._ok, `MED created (${medCreate._status})`);
      await ctx.fetch(`/v1/meds/${MED}/criteria`, {
        method: 'POST', body: { source: 'Member', molecule: 'MEMBER_GROUP', operator: 'in', value: [AMG], label: 'In audience' }
      });
      const rEmail = await ctx.fetch(`/v1/meds/${MED}/results`, {
        method: 'POST', body: { result_type: 'email', result_description: 'We miss you — come back!' }
      });
      ctx.assert(rEmail._ok, `email result saved on the MED (${rEmail._status}${rEmail.error ? ': ' + rEmail.error : ''})`);
      const run = await ctx.fetch(`/v1/meds/${MED}/run`, { method: 'POST' });
      ctx.assert(run._ok && run.fired === 1, `MED fired for B (${run.fired})`);
      const medMsg = (await rowsFor(B.link)).find(r => r.source === `med:${MED}`);
      ctx.assert(!!medMsg && medMsg.status === 'pending' && medMsg.msg_class === 'M',
        'the firing enqueued a REAL marketing message (source med:CODE) — MEDS is finished forever');

      // ── 8. The workforce consent gate ──
      ctx.log('Step 8: Insight members are gated until the consent architecture opens the door');
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 5 } });
      const wm = (await db.query(
        `SELECT membership_number FROM member WHERE tenant_id = 5 AND is_active = true AND membership_number IS NOT NULL ORDER BY membership_number LIMIT 1`)).rows[0];
      const gated = await ctx.fetch(`/v1/members/${wm.membership_number}/message`, {
        method: 'POST', body: { channel: 'E', msg_class: 'O', urgency: 'Q', body: 'should be gated' }
      });
      ctx.assert(gated._ok && gated.suppress_reason === 'consent_gate',
        `workforce tenant suppressed by the consent gate (${gated.suppress_reason})`);
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });

      // ── 9. The drain: honest no-provider counts + the expiry sweep ──
      ctx.log('Step 9: MSG_QUEUE drain — honest counts, expiry sweeps');
      // Time-warp one pending marketing row past its expiry (queue-table setup)
      const toExpire = (await rowsFor(B.link)).find(r => r.status === 'pending' && r.msg_class === 'M');
      await db.query(`UPDATE member_message SET expires_at = NOW() - INTERVAL '1 hour' WHERE link = $1`, [toExpire.link]);
      const jobs = await ctx.fetch('/v1/scheduled/jobs');
      const drain = (Array.isArray(jobs) ? jobs : []).find(j => j.job_code === 'MSG_QUEUE');
      ctx.assert(!!drain, 'Delta sees its MSG_QUEUE job');
      const dr = await ctx.fetch(`/v1/scheduled/jobs/${drain.scheduled_job_id}/run`, { method: 'POST' });
      ctx.assert(dr._ok && dr.status === 'completed', `drain completed (${dr.status})`);
      ctx.assertEqual(dr.processed, 0, 'nothing sent — no provider, honestly');
      ctx.assert(dr.flagged >= 1, `the expiry swept (flagged=${dr.flagged})`);
      const expired = (await db.query(`SELECT status FROM member_message WHERE link = $1`, [toExpire.link])).rows[0];
      ctx.assertEqual(expired.status, 'expired', 'stale marketing expired instead of waiting to blast late');

      // The screens' doors serve
      const summary = await ctx.fetch('/v1/messaging/summary');
      ctx.assert(summary._ok && summary.provider_configured === false, 'summary tells the truth: no provider');
      const list = await ctx.fetch('/v1/messaging/queue');
      ctx.assert(list._ok && list.total >= 5 && list.rows.length <= 200, `queue list serves capped with complete counts (${list.total})`);
    } finally {
      await db.end();
    }
  }
};
