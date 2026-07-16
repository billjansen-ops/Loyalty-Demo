/**
 * Insight: MEDS overdue processing actually PERSISTS (Session 138).
 *
 * Two bugs had made MEDS overdue detection a total silent no-op:
 *   1. The page-load trigger (POST /v1/meds/check/:id) compared the public
 *      membership number against the internal CHAR(5) link — 404 on every
 *      call, response ignored by the page.
 *   2. processMedsForMember crashed on an undefined variable (`surveys`,
 *      renamed to `instruments` by the v97 refactor everywhere but the
 *      recalc block), rolled back everything it had just written — alerts,
 *      registry item — and returned success-shaped counts anyway.
 *
 * This test guards both: a fresh participant is made overdue, the check
 * endpoint is called with the PUBLIC number (bug 1), and the assertions
 * read the DATABASE afterwards (bug 2) — response claims alone would have
 * passed under the old broken code.
 *
 * S137 suite rules: creates its own member and its own overdue state;
 * assertions are about rows this test caused. Harness restore wipes it all.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const CONN = `-h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'}`;

function sql(query) {
  return execSync(`${PSQL} ${CONN} -t -A -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

module.exports = {
  name: 'Insight: MEDS overdue processing persists (check endpoint + registry + schedule bump)',

  async run(ctx) {
    const TENANT = 5;

    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'Claude', password: 'claude123' }
    });
    ctx.assert(login._ok, 'Claude login');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: TENANT } });
    ctx.assert(sw._ok, 'session on Insight');

    // ── A Case Manager to RECEIVE the overdue alerts. v114 repointed the
    //    two overdue warning rules from role='clinician' — a role the
    //    platform_user CHECK constraint doesn't even allow, so they had
    //    delivered to NOBODY since they were seeded — to the CASEMAN
    //    position (the intake pattern). Without a holder the notification
    //    asserts below would be vacuous. ──
    const stamp = Math.floor(Math.random() * 1e9);
    const partners = await ctx.fetch(`/v1/partners?tenant_id=${TENANT}`);
    const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${TENANT}`);
    const cm = await ctx.fetch('/v1/users', {
      method: 'POST', body: { username: `meds_cm_${stamp}`, password: 'cmpass1', display_name: 'Meds TestCaseManager', tenant_id: TENANT, role: 'csr' }
    });
    ctx.assert(cm._ok && cm.user_id, 'Created throwaway case-manager login (the alert recipient)');
    const cmAssign = await ctx.fetch(`/v1/users/${cm.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['CASEMAN', programs[0].program_id] }
    });
    ctx.assert(cmAssign._ok, 'Assigned the Case Manager position');

    // ── Fresh participant (default regime: owes every cadenced instrument) ──
    const num = await ctx.fetch('/v1/member/next-number');
    const mnum = num.membership_number;
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: mnum, fname: 'Meds', lname: 'OverdueTest' }
    });
    ctx.assert(created._ok, `Created participant ${mnum}`);
    const MEMBER_LINK_SQL = `(SELECT link FROM member WHERE tenant_id = ${TENANT} AND membership_number = '${mnum}')`;

    // ── Make them overdue: MEDS schedule says they were due yesterday ──
    sql(`INSERT INTO member_meds (member_link, tenant_id, meds_next_due)
         VALUES (${MEMBER_LINK_SQL}, ${TENANT}, date_to_molecule_int(CURRENT_DATE) - 1)
         ON CONFLICT (member_link) DO UPDATE SET meds_next_due = date_to_molecule_int(CURRENT_DATE) - 1`);

    // Baseline: enrollment already created a REG_REVIEW registry item — count
    // only MEDS-stream items, which must start at zero for this member.
    const medsItemsBefore = Number(sql(
      `SELECT COUNT(*) FROM stability_registry WHERE member_link = ${MEMBER_LINK_SQL} AND source_stream = 'MEDS'`));
    ctx.assert(medsItemsBefore === 0, `no MEDS registry items before the check (${medsItemsBefore})`);

    // ── The page-load trigger, called exactly the way the chart page calls it:
    //    with the PUBLIC membership number (bug 1's regression guard) ──
    const check = await ctx.fetch(`/v1/meds/check/${mnum}?tenant_id=${TENANT}`, { method: 'POST' });
    ctx.assert(check._ok, `check endpoint accepts the public membership number (${check._status}${check.error ? ': ' + check.error : ''})`);
    ctx.assert(check.due === true, `member is recognized as due (due=${check.due})`);
    ctx.assert(Number(check.flagged) >= 1, `at least one overdue item flagged (${check.flagged})`);

    // ── THE regression core: the work PERSISTED (bug 2's guard — under the
    //    old code the response above looked identical while the transaction
    //    had rolled everything back) ──
    const medsItemsAfter = Number(sql(
      `SELECT COUNT(*) FROM stability_registry WHERE member_link = ${MEMBER_LINK_SQL} AND source_stream = 'MEDS' AND status = 'O'`));
    ctx.assert(medsItemsAfter === 1, `exactly one OPEN missed-survey registry item persisted (${medsItemsAfter})`);

    const nextDue = Number(sql(`SELECT meds_next_due FROM member_meds WHERE member_link = ${MEMBER_LINK_SQL}`));
    const todayBE = Number(sql(`SELECT date_to_molecule_int(CURRENT_DATE)`));
    ctx.assert(nextDue > todayBE, `MEDS schedule bumped past today (${nextDue} > ${todayBE}) — no same-day re-flag loop`);

    // ── Notifications (v114): named, chart-landing, and deduped ──
    const NOTIF_WHERE = `tenant_id = ${TENANT} AND member_link = ${MEMBER_LINK_SQL}
      AND event_type IN ('MEDS_SURVEY_OVERDUE','MEDS_COMPLIANCE_OVERDUE','MEDS_CONSECUTIVE_MISS')`;
    const notifsFirst = Number(sql(`SELECT COUNT(*) FROM notification WHERE ${NOTIF_WHERE}`));
    ctx.assert(notifsFirst >= 1, `the check fired MEDS notifications (${notifsFirst})`);
    const unnamed = Number(sql(`SELECT COUNT(*) FROM notification WHERE ${NOTIF_WHERE} AND body NOT LIKE '%Meds OverdueTest%'`));
    ctx.assert(unnamed === 0, `every MEDS notification NAMES the member (${unnamed} unnamed)`);
    const keyless = Number(sql(`SELECT COUNT(*) FROM notification WHERE ${NOTIF_WHERE} AND dedup_key IS NULL`));
    ctx.assert(keyless === 0, `every MEDS notification carries a dedup key (${keyless} without)`);
    const wrongPage = Number(sql(`SELECT COUNT(*) FROM notification WHERE ${NOTIF_WHERE} AND (source_page IS DISTINCT FROM 'physician_detail.html' OR source_link IS DISTINCT FROM '${mnum}')`));
    ctx.assert(wrongPage === 0, `the bell lands on the participant's chart (${wrongPage} misrouted)`);

    // ── Idempotency: a second check must not mint a second registry item ──
    const check2 = await ctx.fetch(`/v1/meds/check/${mnum}?tenant_id=${TENANT}`, { method: 'POST' });
    ctx.assert(check2._ok, 'second check runs clean');
    const medsItemsSecond = Number(sql(
      `SELECT COUNT(*) FROM stability_registry WHERE member_link = ${MEMBER_LINK_SQL} AND source_stream = 'MEDS' AND status = 'O'`));
    ctx.assert(medsItemsSecond === 1, `still exactly one open MEDS item after a second check (${medsItemsSecond})`);
    // …and must not re-send the same news (THE Session 143 fix — this was
    // one new identical critical per scan since March).
    const notifsSecond = Number(sql(`SELECT COUNT(*) FROM notification WHERE ${NOTIF_WHERE}`));
    ctx.assert(notifsSecond === notifsFirst, `a re-check adds ZERO notifications (${notifsFirst} → ${notifsSecond})`);

    // ── The daily scan path runs clean and reports honestly ──
    // Re-arm the schedule so the scan sees this member as due again, then run
    // the MEDS scheduled job manually (resolved by job_code — ids diverge
    // across environments).
    sql(`UPDATE member_meds SET meds_next_due = date_to_molecule_int(CURRENT_DATE) - 1 WHERE member_link = ${MEMBER_LINK_SQL}`);
    const medsJobId = sql(`SELECT scheduled_job_id FROM scheduled_job WHERE tenant_id = ${TENANT} AND job_code = 'MEDS'`);
    ctx.assert(!!medsJobId, `MEDS scheduled job exists (id ${medsJobId})`);
    const job = await ctx.fetch(`/v1/scheduled/jobs/${medsJobId}/run?tenant_id=${TENANT}`, { method: 'POST' });
    ctx.assert(job._ok, `MEDS scan job ran manually (${job._status}${job.error ? ': ' + job.error : ''})`);
    const jobResult = job.result || job;
    const failed = Number(jobResult.failed ?? 0);
    ctx.assert(failed === 0, `scan reports zero failed members (failed=${failed}) — and the field exists to report them`);
    // The scan is the second detection for this member — dedup must hold.
    const medsItemsScan = Number(sql(
      `SELECT COUNT(*) FROM stability_registry WHERE member_link = ${MEMBER_LINK_SQL} AND source_stream = 'MEDS' AND status = 'O'`));
    ctx.assert(medsItemsScan === 1, `scan did not duplicate the open MEDS item (${medsItemsScan})`);
    // The daily scan is exactly the path that built the 5,000-notification
    // flood — it must add nothing while the state is unchanged.
    const notifsScan = Number(sql(`SELECT COUNT(*) FROM notification WHERE ${NOTIF_WHERE}`));
    ctx.assert(notifsScan === notifsFirst, `the daily scan adds ZERO notifications for an unchanged state (${notifsFirst} → ${notifsScan})`);
  }
};
