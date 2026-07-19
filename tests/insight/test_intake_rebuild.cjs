/**
 * Intake Rebuild Phase 1 — Insight / wi_php (Erica's intake spec, Session 142).
 *
 * The intake surface, separated from the Stability Registry:
 *   enroll → REG_REVIEW external action → createIntakeItem (intake_item
 *   table, NOT stability_registry) + INTAKE_STATUS stamp + case-manager
 *   notification whose bell lands on the item (sourcePage intake_queue.html).
 *
 * The platform's first server-enforced role gate (POSITIONCLINIC):
 *   Case Manager — note / outreach / route to resources / send for MD review.
 *   Medical Director — approve screening / refer evaluation / refer
 *   treatment / route to resources / send BACK with reason / close file.
 *   Wrong role or wrong stage → plain-English refusal. Escalate/Advance
 *   are retired. A superuser holding no position is refused too — the gate
 *   is position-based, not role-based.
 *
 * Also proves: v111 backfill (existing members = Participant), the
 * roster/queue separation (a routed-to-resources member leaves the
 * wellness roster), the INTAKE_SLA job (flags, notifies, does NOT
 * auto-escalate — the contract default), and a role-scoped browser walk
 * of intake_queue.html.
 *
 * Self-contained: throwaway logins + members; harness snapshot/restore
 * wipes everything. Personas resolved by name, never hand-entered ids.
 */
const { execSync } = require('child_process');

module.exports = {
  name: 'Insight: Intake rebuild Phase 1 (enroll -> intake item, role-gated actions, SLA, roster separation)',

  async run(ctx) {
    const TENANT = 5;
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    const sql = (q) => execSync(
      `${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -t -A -c "${q.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }).toString().trim();

    // ── Auth: Claude superuser (home tenant 5) ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');

    // ── v111 backfill: an existing participant carries INTAKE_STATUS =
    //    Participant, stored on the member side (the §7 byte proof) ──
    const molId = sql(`SELECT molecule_id FROM molecule_def WHERE tenant_id = ${TENANT} AND molecule_key = 'INTAKE_STATUS'`);
    ctx.assert(molId, 'INTAKE_STATUS molecule exists (v111)');
    const participantId = sql(`SELECT value_id FROM molecule_value_text WHERE molecule_id = ${molId} AND text_value = 'PARTICIPANT'`);
    ctx.assertEqual(participantId, '11', 'PARTICIPANT is value_id 11 (explicit per-molecule numbering)');
    const backfilled = sql(`SELECT COUNT(*) FROM member m JOIN "5_data_1" d ON d.p_link = m.link AND d.molecule_id = ${molId} AND d.attaches_to = 'M' AND ascii(d.c1)-1 = 11 WHERE m.tenant_id = ${TENANT}`);
    const memberCount = sql(`SELECT COUNT(*) FROM member WHERE tenant_id = ${TENANT}`);
    ctx.assertEqual(backfilled, memberCount, `every existing member backfilled to Participant (${backfilled}/${memberCount})`);

    // ── Staff: one Case Manager, one Medical Director (throwaway) ──
    const partners = await ctx.fetch(`/v1/partners?tenant_id=${TENANT}`);
    const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${TENANT}`);
    const stamp = Math.floor(Math.random() * 1e9);

    const cmName = `test_cm_${stamp}`;
    const cm = await ctx.fetch('/v1/users', {
      method: 'POST', body: { username: cmName, password: 'cmpass1', display_name: 'Test CaseManager', tenant_id: TENANT, role: 'csr' }
    });
    ctx.assert(cm._ok && cm.user_id, 'Created throwaway case-manager login');
    const cmAssign = await ctx.fetch(`/v1/users/${cm.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['CASEMAN', programs[0].program_id] }
    });
    ctx.assert(cmAssign._ok, 'Assigned Case Manager position');

    const mdName = `test_md_${stamp}`;
    const md = await ctx.fetch('/v1/users', {
      method: 'POST', body: { username: mdName, password: 'mdpass1', display_name: 'Test MedDirector', tenant_id: TENANT, role: 'csr' }
    });
    ctx.assert(md._ok && md.user_id, 'Created throwaway medical-director login');
    const mdAssign = await ctx.fetch(`/v1/users/${md.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['MEDDIR', programs[0].program_id] }
    });
    ctx.assert(mdAssign._ok, 'Assigned Medical Director position');

    const cmHolders = (await ctx.fetch('/v1/position-holders?code=CASEMAN')) || [];
    const cmHolderIds = (Array.isArray(cmHolders) ? cmHolders : []).map(h => h.user_id);

    // ── Enroll — THE trigger. An intake item appears; a registry item does NOT ──
    const num = await ctx.fetch('/v1/member/next-number');
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: num.membership_number, fname: 'Ingrid', lname: 'IntakeTest' }
    });
    ctx.assert(created._ok, `Enrolled new person ${num.membership_number}`);

    const queue = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
    ctx.assert(queue._ok, 'Intake queue endpoint answers');
    const item = (queue.items || []).find(i => i.member_name === 'Ingrid IntakeTest');
    ctx.assert(!!item, 'Enrollment created an INTAKE item (not a registry item)');
    ctx.assert(item && item.review_type === 'CM', `New item starts in case-manager review (got ${item && item.review_type})`);
    ctx.assert(item && cmHolderIds.includes(item.assigned_to), `Item auto-assigned to a Case Manager holder (got ${item && item.assigned_to})`);
    ctx.assert(item && item.sla_state === 'on_time', `Two-business-day clock starts on time (got ${item && item.sla_state})`);
    ctx.assert(item && item.stage_code === 'PARTICIPANT', `Phase-1 staff enroll stamps Participant (got ${item && item.stage_code})`);

    const registry = await ctx.fetch(`/v1/stability-registry?tenant_id=${TENANT}`);
    const regItems = Array.isArray(registry) ? registry : (registry.items || []);
    ctx.assert(!regItems.find(i => i.reason_code === 'REG_REVIEW'),
      'The Stability Registry holds NO registration reviews (surface separation)');

    // ── v122: staff records skip the intake ceremony. The enroll door's
    //    creation flags raise IS_CLINICIAN BEFORE the REG_REVIEW trigger
    //    evaluates its "is not set" criterion — no intake item ever files. ──
    const staffNum = await ctx.fetch('/v1/member/next-number');
    const staff = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: staffNum.membership_number,
        fname: 'Stella', lname: 'StaffTest', flags: ['IS_CLINICIAN'] }
    });
    ctx.assert(staff._ok, `Enrolled staff record ${staffNum.membership_number} with creation flag`);
    const staffFlag = await ctx.fetch(`/v1/members/${staffNum.membership_number}/flags/IS_CLINICIAN?tenant_id=${TENANT}`);
    ctx.assert(staffFlag._ok && staffFlag.set === true, 'IS_CLINICIAN flag really set at creation');
    const queueAfterStaff = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
    ctx.assert(!(queueAfterStaff.items || []).find(i => i.member_name === 'Stella StaffTest'),
      'Staff record filed NO intake item (the v122 rule criterion held)');
    const badFlag = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: '999999998', fname: 'Bad', lname: 'FlagTest', flags: ['NO_SUCH_FLAG'] }
    });
    ctx.assert(badFlag._status === 400 && String(badFlag.error || '').includes('NO_SUCH_FLAG'),
      `Unknown creation flag refused in plain English before anything is created (${badFlag._status})`);
    // The v122 sweep + gate together: no clinician-flagged member anywhere
    // in this tenant has an OPEN intake item (Erica's stray item closed).
    const openStaffItems = sql(`SELECT COUNT(*) FROM intake_item i
      JOIN "5_data_0" f ON f.p_link = i.member_link AND f.attaches_to = 'M'
      JOIN molecule_def md ON md.molecule_id = f.molecule_id AND md.tenant_id = ${TENANT} AND md.molecule_key = 'IS_CLINICIAN'
      WHERE i.tenant_id = ${TENANT} AND i.status = 'O'`);
    ctx.assertEqual(openStaffItems, '0', 'No clinician-flagged member holds an open intake item (v122 sweep)');

    // ── The case manager's bell lands on the item ──
    const cmLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: cmName, password: 'cmpass1' } });
    ctx.assert(cmLogin._ok, 'Case-manager login successful');
    let notifs = await ctx.fetch('/v1/notifications');
    let list = notifs.notifications || notifs.recent || (Array.isArray(notifs) ? notifs : []);
    const createdNotif = list.find(n => (n.title || '').includes('New registration awaiting review') && (n.body || '').includes('Ingrid IntakeTest'));
    ctx.assert(!!createdNotif, 'Case manager received the new-registration notification');
    ctx.assert(createdNotif && createdNotif.source_page === 'intake_queue.html' && String(createdNotif.source_link) === String(item.link),
      `Bell lands on the intake ITEM (page=${createdNotif && createdNotif.source_page}, link=${createdNotif && createdNotif.source_link})`);

    // ── Role gate, refused in plain English ──
    // A case manager cannot close a file (MD action)…
    const cmClose = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'close_file', reason: 'trying anyway' }
    });
    ctx.assert(!cmClose._ok && cmClose._status === 403 && (cmClose.error || '').includes('Medical Director'),
      `CM refused close_file with a plain-English 403 (got ${cmClose._status})`);
    // …nor approve entrance.
    const cmApprove = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'approve_screening' }
    });
    ctx.assert(!cmApprove._ok && cmApprove._status === 403, `CM refused approve_screening (got ${cmApprove._status})`);
    // Escalate is retired by name.
    const escalate = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'escalate' }
    });
    ctx.assert(!escalate._ok && escalate._status === 400 && (escalate.error || '').includes('retired'),
      'Escalate is refused by name — retired');
    // send_md needs a written reason.
    const noReason = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'send_md' }
    });
    ctx.assert(!noReason._ok && noReason._status === 400, `send_md without a reason refused (got ${noReason._status})`);

    // ── The case manager's real work: outreach, note, send to the MD ──
    const outreach = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'record_outreach' }
    });
    ctx.assert(outreach._ok && outreach.item.outreach_ts, 'Outreach recorded with a date');

    const note = await ctx.fetch(`/v1/intake-items/${item.link}/notes`, {
      method: 'POST', body: { note_text: 'Spoke with Ingrid — license question needs MD judgment.' }
    });
    ctx.assert(note._ok, 'Case manager added a triage note');

    const sendMd = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'send_md', reason: 'License question — needs MD judgment' }
    });
    ctx.assert(sendMd._ok && sendMd.item.review_type === 'MD', 'Send for MD review moves the item to MD review');
    ctx.assert(sendMd.item.sent_by === cm.user_id, 'The item records WHO sent it (the return path needs this)');
    ctx.assert(sendMd.item.assigned_to === md.user_id, 'Item assigned to the Medical Director holder');

    // CM acting on an MD-stage item → stage gate.
    const cmLate = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'route_resources', reason: 'too late' }
    });
    ctx.assert(!cmLate._ok && cmLate._status === 409 && (cmLate.error || '').includes('Medical Director'),
      'CM acting on an MD-stage item is stage-gated with a plain answer');

    // ── The Medical Director: notified, then sends it BACK with a reason ──
    const mdLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: mdName, password: 'mdpass1' } });
    ctx.assert(mdLogin._ok, 'Medical-director login successful');
    notifs = await ctx.fetch('/v1/notifications');
    list = notifs.notifications || notifs.recent || (Array.isArray(notifs) ? notifs : []);
    const mdNotif = list.find(n => (n.title || '').includes('Medical Director review') && (n.body || '').includes('Ingrid IntakeTest'));
    ctx.assert(!!mdNotif, 'Medical director received the sent-for-review notification');
    ctx.assert(mdNotif && (mdNotif.body || '').includes('License question'), 'Notification carries the case-manager reason');

    const sendBackNoReason = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'send_back' }
    });
    ctx.assert(!sendBackNoReason._ok && sendBackNoReason._status === 400, 'Send back REQUIRES a reason');

    const sendBack = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'send_back', reason: 'Need the board order number before I can rule.' }
    });
    ctx.assert(sendBack._ok && sendBack.item.review_type === 'CM', 'Send back returns the item to case-manager review');
    ctx.assert(sendBack.item.assigned_to === cm.user_id, 'Send back reassigns to the case manager who sent it');

    // The case manager hears about the send-back.
    const cmRelogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: cmName, password: 'cmpass1' } });
    ctx.assert(cmRelogin._ok, 'CM re-login');
    notifs = await ctx.fetch('/v1/notifications');
    list = notifs.notifications || notifs.recent || (Array.isArray(notifs) ? notifs : []);
    const backNotif = list.find(n => (n.title || '').includes('sent back') && (n.body || '').includes('board order'));
    ctx.assert(!!backNotif, 'Case manager received the send-back notification with the reason');

    // ── Disposition: route to resources — the member leaves the roster ──
    const rosterBefore = await ctx.fetch('/v1/wellness/members');
    ctx.assert((rosterBefore.members || []).some(m => m.lname === 'IntakeTest'),
      'Before disposition the person is on the wellness roster (Participant)');

    const route = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'route_resources', reason: 'Not a program candidate — provided community resources list.' }
    });
    ctx.assert(route._ok && route.item.status === 'R' && route.item.resolution_code === 'RESOURCES',
      'Route to resources resolves the item');

    const statusAfter = sql(`SELECT ascii(d.c1)-1 FROM member m JOIN "5_data_1" d ON d.p_link = m.link AND d.molecule_id = ${molId} AND d.attaches_to = 'M' WHERE m.tenant_id = ${TENANT} AND m.membership_number = '${num.membership_number}'`);
    const resourcesId = sql(`SELECT value_id FROM molecule_value_text WHERE molecule_id = ${molId} AND text_value = 'RESOURCES'`);
    ctx.assertEqual(statusAfter, resourcesId, `Member INTAKE_STATUS is now Routed-to-resources (byte ${statusAfter})`);

    const rosterAfter = await ctx.fetch('/v1/wellness/members');
    ctx.assert(!(rosterAfter.members || []).some(m => m.lname === 'IntakeTest'),
      'A routed-to-resources registrant LEAVES the roster (surface separation, other direction)');

    // Resolved items can't be acted on.
    const dead = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'route_resources', reason: 'again' }
    });
    ctx.assert(!dead._ok && dead._status === 409, 'A resolved item refuses further actions');

    // ── Second person: the approve path + the superuser gate ──
    const su = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(su._ok, 'Claude re-login');
    const num2 = await ctx.fetch('/v1/member/next-number');
    const created2 = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: num2.membership_number, fname: 'Adam', lname: 'ApproveTest' }
    });
    ctx.assert(created2._ok, 'Enrolled second person');
    const queue2 = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
    const item2 = (queue2.items || []).find(i => i.member_name === 'Adam ApproveTest');
    ctx.assert(!!item2, 'Second intake item created');

    // The gate is position-based, not role-based: the superuser holds no
    // position and is refused like anyone else.
    const suTry = await ctx.fetch(`/v1/intake-items/${item2.link}/actions`, {
      method: 'POST', body: { action: 'record_outreach' }
    });
    ctx.assert(!suTry._ok && suTry._status === 403, `Superuser without a position is refused (got ${suTry._status})`);

    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: cmName, password: 'cmpass1' } });
    const sendMd2 = await ctx.fetch(`/v1/intake-items/${item2.link}/actions`, {
      method: 'POST', body: { action: 'send_md', reason: 'Clean history — recommend screening.' }
    });
    ctx.assert(sendMd2._ok, 'Second item sent for MD review');

    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: mdName, password: 'mdpass1' } });
    const approve = await ctx.fetch(`/v1/intake-items/${item2.link}/actions`, {
      method: 'POST', body: { action: 'approve_screening' }
    });
    ctx.assert(approve._ok && approve.item.resolution_code === 'SCREENING', 'MD approves for screening');
    const status2 = sql(`SELECT ascii(d.c1)-1 FROM member m JOIN "5_data_1" d ON d.p_link = m.link AND d.molecule_id = ${molId} AND d.attaches_to = 'M' WHERE m.tenant_id = ${TENANT} AND m.membership_number = '${num2.membership_number}'`);
    const screeningId = sql(`SELECT value_id FROM molecule_value_text WHERE molecule_id = ${molId} AND text_value = 'SCREENING'`);
    ctx.assertEqual(status2, screeningId, 'Approved person moves to In-screening status');

    // ── The INTAKE_SLA job: flags + notifies, does NOT auto-escalate ──
    const back2 = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(back2._ok, 'Claude re-login for SLA test');
    const num3 = await ctx.fetch('/v1/member/next-number');
    const created3 = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: num3.membership_number, fname: 'Odessa', lname: 'OverdueTest' }
    });
    ctx.assert(created3._ok, 'Enrolled third person');
    const queue3 = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
    const item3 = (queue3.items || []).find(i => i.member_name === 'Odessa OverdueTest');
    ctx.assert(!!item3, 'Third intake item created');

    // Backdate the deadline (test fixture — harness restore wipes it).
    sql(`UPDATE intake_item SET sla_deadline = NOW() - interval '3 hours' WHERE link = ${item3.link}`);

    const jobs = await ctx.fetch('/v1/scheduled/jobs');
    const jobList = Array.isArray(jobs) ? jobs : (jobs.jobs || []);
    const slaJob = jobList.find(j => j.job_code === 'INTAKE_SLA');
    ctx.assert(!!slaJob, 'INTAKE_SLA scheduled job exists (v111 renamed REG_REVIEW_SLA)');

    const run1 = await ctx.fetch(`/v1/scheduled/jobs/${slaJob.scheduled_job_id}/run`, { method: 'POST' });
    ctx.assert(run1._ok && run1.processed >= 1, `SLA job flagged the overdue item (processed: ${run1.processed})`);

    const detail3 = await ctx.fetch(`/v1/intake-items/${item3.link}?tenant_id=${TENANT}`);
    ctx.assert(detail3._ok && detail3.item.review_type === 'CM',
      'Overdue item STAYS with the case manager — no auto-escalation (the contract default)');
    ctx.assert(detail3.item.sla_state === 'overdue', `Item shows overdue (got ${detail3.item.sla_state})`);
    ctx.assert(!!detail3.item.overdue_notified_ts, 'Overdue flag stamped (dedup marker)');

    const run2 = await ctx.fetch(`/v1/scheduled/jobs/${slaJob.scheduled_job_id}/run`, { method: 'POST' });
    ctx.assert(run2._ok && run2.processed === 0, `SLA job rerun processes nothing (got ${run2.processed})`);

    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: cmName, password: 'cmpass1' } });
    notifs = await ctx.fetch('/v1/notifications');
    list = notifs.notifications || notifs.recent || (Array.isArray(notifs) ? notifs : []);
    const overdueNotif = list.find(n => (n.title || '').includes('overdue') && (n.body || '').includes('Odessa OverdueTest'));
    ctx.assert(!!overdueNotif, 'Case manager received the overdue notification');

    // Queue filter: sla=overdue finds it.
    const overdueQueue = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}&sla=overdue`);
    ctx.assert(overdueQueue._ok && (overdueQueue.items || []).some(i => i.link === item3.link),
      'Queue filter sla=overdue returns the overdue item');

    // ── Browser walk: the queue as the case manager sees it ──
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser walk — Playwright not available');
      return;
    }
    const page = await ctx.openPage('/login.html');
    page.on('dialog', async (d) => { try { await d.accept(); } catch (_) {} });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    const origin = new URL(page.url()).origin;
    await page.evaluate(async (u) => {
      await fetch('/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ username: u, password: 'cmpass1' })
      });
    }, cmName);
    await page.evaluate(() => {
      sessionStorage.setItem('tenant_id', '5');
      sessionStorage.setItem('tenant_name', 'Insight Health Solutions');
    });

    try {
      await page.goto(`${origin}/verticals/workforce_monitoring/intake_queue.html`);
      await new Promise(r => setTimeout(r, 3000));

      const view = await page.evaluate(() => ({
        rows: document.querySelectorAll('.queue-item').length,
        chips: document.getElementById('statsRow')?.innerText || '',
        bodyText: document.body.innerText
      }));
      ctx.assert(view.rows >= 1, `Queue renders open items (${view.rows} rows)`);
      ctx.assert(view.chips.includes('Overdue') && view.chips.includes('Case manager review'),
        'SLA + review-type chips present');
      ctx.assert(!view.chips.includes('SENTINEL') && !view.chips.includes('Yellow'),
        'NO clinical tier chips on the intake surface');

      // Open the overdue item — CM sees CM actions, never MD actions.
      await page.evaluate((link) => openItemByLink(link), item3.link);
      await new Promise(r => setTimeout(r, 1500));
      const modal = await page.evaluate(() => ({
        open: !!document.getElementById('detailOverlay'),
        text: document.getElementById('detailOverlay')?.innerText || ''
      }));
      ctx.assert(modal.open, 'Item detail modal opens');
      ctx.assert(modal.text.includes('Send for Medical Director review'), 'CM sees the send-for-review action');
      ctx.assert(!modal.text.includes('Close file'), 'CM does NOT see the Medical-Director-only actions');
      ctx.assert(modal.text.includes('Overdue'), 'Modal shows the SLA state');

      ctx.assert(pageErrors.length === 0, `Zero page errors on the walk (${pageErrors.slice(0, 2).join(' | ')})`);
      const realConsoleErrors = consoleErrors.filter(t => !t.includes('favicon'));
      ctx.assert(realConsoleErrors.length === 0, `Zero console errors on the walk (${realConsoleErrors.slice(0, 2).join(' | ')})`);
    } finally {
      await page.close();
    }
  }
};
