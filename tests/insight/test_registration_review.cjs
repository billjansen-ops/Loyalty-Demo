/**
 * Registration Review Queue — Insight / wi_php (WisconsinPATH Stage 1).
 *
 * The trigger is pure configuration (db_migrate v95): enrolling a member runs
 * evaluateEnrollmentPromotions -> REG_REVIEW promotion (enrollment counter,
 * goal 1) qualifies at signup -> external result -> createRegistryItem
 * (urgency YELLOW, SLA 48h) -> action-scoped notification event
 * REGISTRY_REG_REVIEW -> notification_rule routes BY POSITION to every staff
 * login holding the Case Manager position (POSITIONCLINIC value CASEMAN).
 *
 * Self-contained: creates its own staff login + member; harness
 * snapshot/restore wipes everything.
 */
module.exports = {
  name: 'Insight: Registration review queue (enroll -> registry item + position-routed notification)',

  async run(ctx) {
    const tenantId = 5;

    // ── Auth: Claude superuser (home tenant 5) ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');

    // ── A case-manager staff login to receive the routing ──
    const uname = `test_cm_${Math.floor(Date.now() / 1000)}`;
    const staff = await ctx.fetch('/v1/users', {
      method: 'POST',
      body: { username: uname, password: 'cmpass1', display_name: 'Test CaseManager', tenant_id: tenantId, role: 'csr' }
    });
    ctx.assert(staff._ok && staff.user_id, 'Created throwaway case-manager login');

    const partners = await ctx.fetch(`/v1/partners?tenant_id=${tenantId}`);
    const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${tenantId}`);
    const assign = await ctx.fetch(`/v1/users/${staff.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['CASEMAN', programs[0].program_id] }
    });
    ctx.assert(assign._ok, 'Assigned Case Manager position to the staff login');

    // ── Enroll a new participant — THE trigger ──
    const num = await ctx.fetch('/v1/member/next-number');
    const mnum = num.membership_number;
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: mnum, fname: 'Reggie', lname: 'ReviewTest' }
    });
    ctx.assert(created._ok, `Enrolled new participant ${mnum}`);

    // ── The review item appears in the registry, correctly shaped ──
    const registry = await ctx.fetch(`/v1/stability-registry?tenant_id=${tenantId}`);
    const items = Array.isArray(registry) ? registry : (registry.items || []);
    const review = items.find(i => i.reason_code === 'REG_REVIEW' &&
      `${i.fname} ${i.lname}`.includes('ReviewTest'));
    ctx.assert(!!review, 'Registration review item created in the registry on enrollment');
    ctx.assert(review && review.urgency === 'YELLOW', `Review urgency is YELLOW (got: ${review && review.urgency})`);
    ctx.assert(review && Number(review.sla_hours) === 48, `Review SLA is 48h (got: ${review && review.sla_hours})`);
    ctx.assert(review && review.status === 'O', 'Review starts Open');

    // ── The case manager got the notification (position routing) ──
    const cmLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: uname, password: 'cmpass1' } });
    ctx.assert(cmLogin._ok, 'Case-manager login successful');
    const notifs = await ctx.fetch('/v1/notifications');
    const list = notifs.notifications || notifs.recent || (Array.isArray(notifs) ? notifs : []);
    const hit = list.find(n => (n.title || '').includes('New registration awaiting review'));
    ctx.assert(!!hit, 'Case manager received the "New registration awaiting review" notification');
    ctx.assert(hit && (hit.body || '').includes('Reggie ReviewTest'), 'Notification names the participant');

    // ── Piece 2: escalation to the Medical Director ──
    // Back to Claude (superuser) to create the MEDDIR holder.
    const relogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(relogin._ok, 'Claude re-login for escalation setup');

    // Escalate with NO medical director assigned → actionable 409.
    const noMd = await ctx.fetch(`/v1/registration-reviews/${review.link}/escalate`, {
      method: 'POST', body: { note: 'needs MD review' }
    });
    ctx.assert(!noMd._ok && noMd._status === 409 && (noMd.error || '').includes('Medical Director'),
      `Escalate with no MD holder gets an actionable 409 (got ${noMd._status})`);

    const mdName = `test_md_${Math.floor(Date.now() / 1000)}`;
    const md = await ctx.fetch('/v1/users', {
      method: 'POST',
      body: { username: mdName, password: 'mdpass1', display_name: 'Test MedDirector', tenant_id: tenantId, role: 'csr' }
    });
    ctx.assert(md._ok, 'Created throwaway medical-director login');
    const mdAssign = await ctx.fetch(`/v1/users/${md.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['MEDDIR', programs[0].program_id] }
    });
    ctx.assert(mdAssign._ok, 'Assigned Medical Director position');

    const esc = await ctx.fetch(`/v1/registration-reviews/${review.link}/escalate`, {
      method: 'POST', body: { note: 'License question — needs MD judgment' }
    });
    ctx.assert(esc._ok && esc.assigned_to === md.user_id,
      `Escalation assigns the review to the MD holder (got ${esc.assigned_to})`);

    const mdLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: mdName, password: 'mdpass1' } });
    ctx.assert(mdLogin._ok, 'Medical-director login successful');
    const mdNotifs = await ctx.fetch('/v1/notifications');
    const mdList = mdNotifs.notifications || mdNotifs.recent || (Array.isArray(mdNotifs) ? mdNotifs : []);
    const escHit = mdList.find(n => (n.title || '').includes('Registration review escalated'));
    ctx.assert(!!escHit, 'Medical director received the escalation notification');
    ctx.assert(escHit && (escHit.body || '').includes('License question'),
      'Escalation notification carries the case-manager note');

    // ── Disposition: Advance resolves the review ──
    const back = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(back._ok, 'Claude re-login for disposition');
    const advance = await ctx.fetch(`/v1/stability-registry/${review.link}`, {
      method: 'PUT', body: { status: 'R', resolution_code: 'ADVANCED', resolution_notes: 'Cleared to enter the program' }
    });
    ctx.assert(advance._ok && advance.status === 'R' && advance.resolution_code === 'ADVANCED',
      'Advance disposition resolves the review with code ADVANCED');

    // ── Piece 3: the overdue clock (REG_REVIEW_SLA job) ──
    // Enroll a second participant, backdate its review deadline (raw SQL is a
    // test fixture — harness snapshot/restore wipes it), run the job manually.
    const num2 = await ctx.fetch('/v1/member/next-number');
    const created2 = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: num2.membership_number, fname: 'Odessa', lname: 'OverdueTest' }
    });
    ctx.assert(created2._ok, 'Enrolled second participant');

    const registry2 = await ctx.fetch(`/v1/stability-registry?tenant_id=${tenantId}`);
    const items2 = Array.isArray(registry2) ? registry2 : (registry2.items || []);
    const review2 = items2.find(i => i.reason_code === 'REG_REVIEW' && `${i.fname} ${i.lname}`.includes('OverdueTest'));
    ctx.assert(!!review2, 'Second registration review created');

    const { execSync } = require('child_process');
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    execSync(`${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -c "UPDATE stability_registry SET sla_deadline = NOW() - interval '2 hours' WHERE link = ${review2.link};"`,
      { stdio: 'pipe' });

    const jobs = await ctx.fetch('/v1/scheduled/jobs');
    const jobList = Array.isArray(jobs) ? jobs : (jobs.jobs || []);
    const slaJob = jobList.find(j => j.job_code === 'REG_REVIEW_SLA');
    ctx.assert(!!slaJob, 'REG_REVIEW_SLA scheduled job exists (v95)');

    const run = await ctx.fetch(`/v1/scheduled/jobs/${slaJob.scheduled_job_id}/run`, { method: 'POST' });
    ctx.assert(run._ok && run.processed >= 1, `SLA job escalated the overdue review (processed: ${run.processed})`);

    const registry3 = await ctx.fetch(`/v1/stability-registry?tenant_id=${tenantId}`);
    const items3 = Array.isArray(registry3) ? registry3 : (registry3.items || []);
    const escalated = items3.find(i => i.link === review2.link);
    ctx.assert(escalated && escalated.urgency === 'ORANGE', `Overdue review bumped to ORANGE (got: ${escalated && escalated.urgency})`);
    ctx.assert(escalated && escalated.status === 'A', 'Overdue review auto-assigned to the Medical Director');

    // Rerun is a no-op — ORANGE marks it processed.
    const rerun = await ctx.fetch(`/v1/scheduled/jobs/${slaJob.scheduled_job_id}/run`, { method: 'POST' });
    ctx.assert(rerun._ok && rerun.processed === 0, `SLA job rerun processes nothing (got: ${rerun.processed})`);
  }
};
