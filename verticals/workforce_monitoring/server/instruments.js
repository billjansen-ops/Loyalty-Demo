/**
 * Workforce Monitoring — per-participant instrument assignment (Session 131,
 * db v97 — WisconsinPATH Stage 2 part 2 plumbing).
 *
 * Who takes which instrument, on what schedule. member_instrument rows put a
 * participant in the ASSIGNED regime (they owe exactly their active rows —
 * cadence override honored, one_time = screening due once from start_date);
 * a participant with no rows keeps the pre-assignment default (every active
 * cadenced survey). MEDS resolves the expected set through
 * getExpectedInstruments in meds.js — these endpoints only maintain the rows.
 *
 * Every write recalculates the member's MEDS next-due date, so an assignment
 * takes effect immediately (including firing overdue processing when the
 * assigned instrument is already due).
 *
 * The assignment screen (participant chart) is the next-session build; these
 * endpoints are its plumbing.
 */
import { calculateMedsNextDue } from './meds.js';

export function register(app, ctx) {
  const { resolveMember } = ctx;

  // Effective-cadence rule shared by POST and PATCH: a recurring assignment
  // must end up with a positive cadence from somewhere (its own override or
  // the survey's default). Screening instruments have no default cadence, so
  // assigning one as recurring without an override is a spec error, not a
  // silent never-due row.
  function cadenceProblem(mode, overrideDays, surveyDefaultDays) {
    if (mode !== 'cadence') return null;
    const effective = overrideDays ?? surveyDefaultDays;
    if (!effective || effective <= 0) {
      return 'A recurring assignment needs a cadence — this instrument has no default, so give the assignment its own cadence_days (or assign it one_time)';
    }
    return null;
  }

  // GET /v1/members/:id/instruments — the tenant's instrument catalog with
  // this member's assignment state. `regime` says which world the member is
  // in: 'default' (no rows — owes every cadenced survey) or 'assigned'.
  app.get('/v1/members/:id/instruments', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      const surveys = await dbClient.query(
        `SELECT link AS survey_link, survey_code, survey_name, respondent_type,
                cadence_days AS default_cadence_days, instrument_purpose
           FROM survey WHERE tenant_id = $1 AND status = 'A' ORDER BY link`,
        [tenantId]
      );
      const assignments = await dbClient.query(
        `SELECT member_instrument_id, survey_link, status, mode, cadence_days, start_date
           FROM member_instrument WHERE member_link = $1 AND tenant_id = $2`,
        [member.link, tenantId]
      );
      const byLink = new Map(assignments.rows.map(a => [a.survey_link, a]));
      const regime = assignments.rows.length ? 'assigned' : 'default';

      const items = surveys.rows.map(s => {
        const a = byLink.get(s.survey_link) || null;
        const expected = regime === 'assigned'
          ? !!(a && a.status === 'active')
          : !!(s.default_cadence_days && s.default_cadence_days > 0);
        return { ...s, assignment: a, expected };
      });
      res.json({ regime, items });
    } catch (e) {
      console.error('Error in', req.method, req.path, ':', e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /v1/members/:id/instruments — assign an instrument.
  // Body: { survey_code, mode: 'cadence'|'one_time', cadence_days?, start_date? }
  app.post('/v1/members/:id/instruments', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      const { survey_code, mode = 'cadence', cadence_days = null, start_date = null } = req.body || {};
      if (!survey_code) return res.status(400).json({ error: 'survey_code required' });
      if (mode !== 'cadence' && mode !== 'one_time') {
        return res.status(400).json({ error: `mode must be 'cadence' or 'one_time', got '${mode}'` });
      }

      const survey = await dbClient.query(
        `SELECT link, survey_name, cadence_days FROM survey
          WHERE tenant_id = $1 AND UPPER(survey_code) = UPPER($2) AND status = 'A'`,
        [tenantId, survey_code]
      );
      if (!survey.rows.length) return res.status(404).json({ error: `Instrument '${survey_code}' not found` });

      const problem = cadenceProblem(mode, cadence_days, survey.rows[0].cadence_days);
      if (problem) return res.status(400).json({ error: problem });

      const inserted = await dbClient.query(
        `INSERT INTO member_instrument (member_link, survey_link, tenant_id, mode, cadence_days, start_date)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, public.date_to_molecule_int(CURRENT_DATE)))
         ON CONFLICT (member_link, survey_link) DO NOTHING
         RETURNING *`,
        [member.link, survey.rows[0].link, tenantId, mode, cadence_days, start_date]
      );
      if (!inserted.rows.length) {
        return res.status(409).json({ error: `${survey.rows[0].survey_name} is already assigned to this participant` });
      }

      await calculateMedsNextDue(ctx, member.link, tenantId);
      res.status(201).json(inserted.rows[0]);
    } catch (e) {
      console.error('Error in', req.method, req.path, ':', e);
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /v1/members/:id/instruments/:assignmentId — pause/resume, change
  // mode or cadence override.
  app.patch('/v1/members/:id/instruments/:assignmentId', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      const existing = await dbClient.query(
        `SELECT mi.*, s.cadence_days AS survey_default_cadence
           FROM member_instrument mi JOIN survey s ON s.link = mi.survey_link
          WHERE mi.member_instrument_id = $1 AND mi.member_link = $2 AND mi.tenant_id = $3`,
        [req.params.assignmentId, member.link, tenantId]
      );
      if (!existing.rows.length) return res.status(404).json({ error: 'Assignment not found' });
      const row = existing.rows[0];

      const body = req.body || {};
      const status = body.status !== undefined ? body.status : row.status;
      const mode = body.mode !== undefined ? body.mode : row.mode;
      const cadenceDays = body.cadence_days !== undefined ? body.cadence_days : row.cadence_days;
      if (status !== 'active' && status !== 'paused') {
        return res.status(400).json({ error: `status must be 'active' or 'paused', got '${status}'` });
      }
      if (mode !== 'cadence' && mode !== 'one_time') {
        return res.status(400).json({ error: `mode must be 'cadence' or 'one_time', got '${mode}'` });
      }
      const problem = cadenceProblem(mode, cadenceDays, row.survey_default_cadence);
      if (problem) return res.status(400).json({ error: problem });

      const updated = await dbClient.query(
        `UPDATE member_instrument SET status = $1, mode = $2, cadence_days = $3
          WHERE member_instrument_id = $4 RETURNING *`,
        [status, mode, cadenceDays, row.member_instrument_id]
      );

      await calculateMedsNextDue(ctx, member.link, tenantId);
      res.json(updated.rows[0]);
    } catch (e) {
      console.error('Error in', req.method, req.path, ':', e);
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /v1/members/:id/instruments/:assignmentId — remove the assignment.
  // Removing the LAST row returns the member to the default regime.
  app.delete('/v1/members/:id/instruments/:assignmentId', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const member = await resolveMember(req.params.id, tenantId);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      const deleted = await dbClient.query(
        `DELETE FROM member_instrument
          WHERE member_instrument_id = $1 AND member_link = $2 AND tenant_id = $3
          RETURNING member_instrument_id`,
        [req.params.assignmentId, member.link, tenantId]
      );
      if (!deleted.rows.length) return res.status(404).json({ error: 'Assignment not found' });

      await calculateMedsNextDue(ctx, member.link, tenantId);
      res.json({ success: true });
    } catch (e) {
      console.error('Error in', req.method, req.path, ':', e);
      res.status(500).json({ error: e.message });
    }
  });
}
