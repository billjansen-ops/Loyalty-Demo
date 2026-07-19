/**
 * The login→person bridge (v120, Session 146).
 *
 * A login is a keycard; platform_user_person says WHO holds it, one pointer
 * per (login, program). This replaced the display-name matching in
 * notification routing that delivered to NOBODY in live data (S138 audit
 * 1.4 — display names carry titles/credentials, so the exact-name hunt
 * never matched).
 *
 * Proves:
 *   - GET/PUT/DELETE /v1/users/:id/person happy path + every refusal in
 *     plain English (unknown person 404, person already claimed 409,
 *     login not in the program 400, unlink-where-none 404)
 *   - the member notification branch delivers through the bridge inside
 *     REAL dispatch (a MEDS overdue check fires the event; the linked
 *     login gets the row)
 *   - an unlinked login gets nothing and nothing crashes
 *   - a DEACTIVATED login stops receiving (the is_active join)
 *
 * S137 suite rules: own members, own logins, own notification rule;
 * assertions only about rows this test caused. Harness restore wipes all.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const CONN = `-h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'}`;

function sql(query) {
  return execSync(`${PSQL} ${CONN} -t -A -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

module.exports = {
  name: 'Login→person bridge: endpoints + notification routing through the pointer (v120)',

  async run(ctx) {
    const TENANT = 5;
    const stamp = Math.floor(Math.random() * 1e9);

    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'Claude', password: 'claude123' }
    });
    ctx.assert(login._ok, 'Claude login');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: TENANT } });
    ctx.assert(sw._ok, 'session on Insight');

    // ── Two throwaway logins and a person record ──
    const l1 = await ctx.fetch('/v1/users', {
      method: 'POST', body: { username: `bridge_a_${stamp}`, password: 'bridgepass1', display_name: 'Dr. Bridge TestPersonA', tenant_id: TENANT, role: 'csr' }
    });
    ctx.assert(l1._ok && l1.user_id, 'created login A');
    const l2 = await ctx.fetch('/v1/users', {
      method: 'POST', body: { username: `bridge_b_${stamp}`, password: 'bridgepass1', display_name: 'Bridge TestPersonB', tenant_id: TENANT, role: 'csr' }
    });
    ctx.assert(l2._ok && l2.user_id, 'created login B');

    const numP = (await ctx.fetch('/v1/member/next-number')).membership_number;
    const createdP = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: numP, fname: 'Bridge', lname: 'PersonP' }
    });
    ctx.assert(createdP._ok, `created person P (${numP})`);
    const P_LINK_SQL = `(SELECT link FROM member WHERE tenant_id = ${TENANT} AND membership_number = '${numP}')`;

    // ── Endpoint contract ──
    const empty = await ctx.fetch(`/v1/users/${l1.user_id}/person?tenant_id=${TENANT}`);
    ctx.assert(empty._ok && empty.person === null, 'unlinked login answers person: null');

    const put = await ctx.fetch(`/v1/users/${l1.user_id}/person?tenant_id=${TENANT}`, {
      method: 'PUT', body: { membership_number: numP }
    });
    ctx.assert(put._ok, 'linked login A to person P');
    const readBack = await ctx.fetch(`/v1/users/${l1.user_id}/person?tenant_id=${TENANT}`);
    ctx.assert(readBack.person?.membership_number === numP, `read-back returns the person (${readBack.person?.membership_number})`);

    // NOTE: the display name deliberately does NOT match the person's name
    // ("Dr. Bridge TestPersonA" vs "Bridge PersonP") — under the old
    // name-matching this delivery would have been impossible. The bridge
    // makes the label irrelevant, which is the point.

    const claim = await ctx.fetch(`/v1/users/${l2.user_id}/person?tenant_id=${TENANT}`, {
      method: 'PUT', body: { membership_number: numP }
    });
    ctx.assert(claim._status === 409, `second login claiming the same person answers 409 (${claim._status})`);
    ctx.assert((claim.error || '').includes(`bridge_a_${stamp}`), 'the 409 NAMES the login already holding the person');

    const unknown = await ctx.fetch(`/v1/users/${l1.user_id}/person?tenant_id=${TENANT}`, {
      method: 'PUT', body: { membership_number: 'ZZZ_NO_SUCH' }
    });
    ctx.assert(unknown._status === 404, `unknown person number answers 404 (${unknown._status})`);

    // A session bound to another program cannot manage this login's pointer.
    const toDelta = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 1 } });
    ctx.assert(toDelta._ok, 'session rebound to Delta');
    const crossProgram = await ctx.fetch(`/v1/users/${l1.user_id}/person`, {
      method: 'PUT', body: { membership_number: numP }
    });
    ctx.assert(crossProgram._status === 400 && (crossProgram.error || '').includes("doesn't work in this program"),
      `a tenant-5 login targeted from a Delta session is refused plainly (${crossProgram._status}: ${crossProgram.error})`);
    const backTo5 = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: TENANT } });
    ctx.assert(backTo5._ok, 'session back on Insight');

    const unlinkNone = await ctx.fetch(`/v1/users/${l2.user_id}/person?tenant_id=${TENANT}`, { method: 'DELETE' });
    ctx.assert(unlinkNone._status === 404, `unlink where no link exists answers 404 (${unlinkNone._status})`);

    // ── Notification routing through the bridge, inside REAL dispatch ──
    // Own rule: the MEDS overdue check fires MEDS_SURVEY_OVERDUE; this rule
    // routes it to the member's own login — which only the bridge can find.
    sql(`INSERT INTO notification_rule (tenant_id, event_type, recipient_type, notify_member, severity, title_template, body_template)
         VALUES (${TENANT}, 'MEDS_SURVEY_OVERDUE', 'member', true, 'info', 'Bridge test: your survey is overdue', 'bridge_${stamp}')`);

    sql(`INSERT INTO member_meds (member_link, tenant_id, meds_next_due)
         VALUES (${P_LINK_SQL}, ${TENANT}, date_to_molecule_int(CURRENT_DATE) - 1)`);

    const check = await ctx.fetch(`/v1/meds/check/${numP}?tenant_id=${TENANT}`, { method: 'POST' });
    ctx.assert(check._ok && check.due === true, `P's overdue check ran (${check._status}, due=${check.due})`);
    // The event fires once PER overdue instrument (a fresh participant owes
    // the whole cadenced catalog), so count by this rule's own body stamp:
    // every delivery from MY rule must land on the linked login, nowhere else.
    const delivered = Number(sql(
      `SELECT COUNT(*) FROM notification WHERE tenant_id = ${TENANT} AND recipient_user_id = ${l1.user_id}
       AND body = 'bridge_${stamp}' AND member_link = ${P_LINK_SQL}`));
    ctx.assert(delivered >= 1, `the member-addressed notification landed on the LINKED login (${delivered})`);
    const misdelivered = Number(sql(
      `SELECT COUNT(*) FROM notification WHERE tenant_id = ${TENANT} AND body = 'bridge_${stamp}'
       AND recipient_user_id <> ${l1.user_id}`));
    ctx.assert(misdelivered === 0, `no delivery from this rule went to any OTHER login (${misdelivered})`);

    // ── Unlinked member: nothing delivered to an unrelated login, no crash ──
    const numQ = (await ctx.fetch('/v1/member/next-number')).membership_number;
    const createdQ = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: numQ, fname: 'Bridge', lname: 'PersonQ' }
    });
    ctx.assert(createdQ._ok, `created unlinked person Q (${numQ})`);
    const Q_LINK_SQL = `(SELECT link FROM member WHERE tenant_id = ${TENANT} AND membership_number = '${numQ}')`;
    sql(`INSERT INTO member_meds (member_link, tenant_id, meds_next_due)
         VALUES (${Q_LINK_SQL}, ${TENANT}, date_to_molecule_int(CURRENT_DATE) - 1)`);
    const checkQ = await ctx.fetch(`/v1/meds/check/${numQ}?tenant_id=${TENANT}`, { method: 'POST' });
    ctx.assert(checkQ._ok, 'unlinked member overdue check runs clean');
    const strayQ = Number(sql(
      `SELECT COUNT(*) FROM notification WHERE tenant_id = ${TENANT} AND member_link = ${Q_LINK_SQL}
       AND event_type = 'MEDS_SURVEY_OVERDUE' AND recipient_user_id IN (${l1.user_id}, ${l2.user_id})`));
    ctx.assert(strayQ === 0, `no member-addressed delivery for an unlinked member (${strayQ})`);

    // ── A deactivated keycard stops receiving (the is_active join) ──
    const numR = (await ctx.fetch('/v1/member/next-number')).membership_number;
    const createdR = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: numR, fname: 'Bridge', lname: 'PersonR' }
    });
    ctx.assert(createdR._ok, `created person R (${numR})`);
    const R_LINK_SQL = `(SELECT link FROM member WHERE tenant_id = ${TENANT} AND membership_number = '${numR}')`;
    const linkR = await ctx.fetch(`/v1/users/${l2.user_id}/person?tenant_id=${TENANT}`, {
      method: 'PUT', body: { membership_number: numR }
    });
    ctx.assert(linkR._ok, 'linked login B to person R');
    const deact = await ctx.fetch(`/v1/users/${l2.user_id}`, {
      method: 'PUT', body: { display_name: 'Bridge TestPersonB', role: 'csr', tenant_id: TENANT, is_active: false }
    });
    ctx.assert(deact._ok, 'deactivated login B');
    sql(`INSERT INTO member_meds (member_link, tenant_id, meds_next_due)
         VALUES (${R_LINK_SQL}, ${TENANT}, date_to_molecule_int(CURRENT_DATE) - 1)`);
    const checkR = await ctx.fetch(`/v1/meds/check/${numR}?tenant_id=${TENANT}`, { method: 'POST' });
    ctx.assert(checkR._ok, "R's overdue check runs clean");
    const deadDelivery = Number(sql(
      `SELECT COUNT(*) FROM notification WHERE tenant_id = ${TENANT} AND member_link = ${R_LINK_SQL}
       AND event_type = 'MEDS_SURVEY_OVERDUE' AND recipient_user_id = ${l2.user_id}`));
    ctx.assert(deadDelivery === 0, `a deactivated login receives nothing (${deadDelivery})`);

    // ── Unlink completes the lifecycle ──
    const unlink = await ctx.fetch(`/v1/users/${l1.user_id}/person?tenant_id=${TENANT}`, { method: 'DELETE' });
    ctx.assert(unlink._ok, 'unlinked login A');
    const afterUnlink = await ctx.fetch(`/v1/users/${l1.user_id}/person?tenant_id=${TENANT}`);
    ctx.assert(afterUnlink._ok && afterUnlink.person === null, 'pointer gone after unlink');

    // ── In-run cleanup: the harness restores only at the END of the suite,
    //    so anything planted here is visible to every LATER test in the same
    //    run — the wa_php parity tests count wi_php's notification rules
    //    (the S145 weight-residue lesson, same shape). Remove our rule. ──
    sql(`DELETE FROM notification_rule WHERE tenant_id = ${TENANT} AND body_template = 'bridge_${stamp}'`);
  }
};
