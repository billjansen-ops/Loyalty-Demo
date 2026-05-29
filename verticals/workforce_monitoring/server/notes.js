/**
 * Workforce Monitoring (Insight) — staff notes module.
 *
 * Session 131 (Category 1): moves the five healthcare-named endpoints
 * that Phase 6 missed out of pointers.js. They slipped Phase 6 because
 * the anti-pattern lint regex is case-sensitive and these URLs are
 * lowercase (same blind spot as the camelCase clinician helpers cleaned
 * up in the Session 130 post-Phase-6 rounds):
 *
 *   - GET   /v1/physician-annotations/:membershipNumber
 *   - POST  /v1/physician-annotations
 *   - GET   /v1/survey-note-reviews
 *   - GET   /v1/survey-note-reviews/:membershipNumber
 *   - PATCH /v1/survey-note-reviews/:reviewId
 *
 * Backed by the Insight-specific tables physician_annotation and
 * survey_note_review.
 *
 * It also registers two vertical->platform callbacks for the only two
 * remaining platform-side references to those tables, both inside
 * platform-shared endpoints that stay in pointers.js:
 *
 *   - recordSurveyNoteReview — PUT /v1/member-surveys/:link/answers
 *     writes a survey_note_review row when a note-alert survey is
 *     submitted with a comment.
 *   - getMemberNotes — GET /v1/export/:report 'notes' section reads
 *     physician_annotation for the member export.
 *
 * Same callback-bridge pattern as Phase 5's calcPPII and the Session 130
 * clinician helpers (see clinicians.js). Safe fallbacks at the call
 * sites (no-op / []) keep the platform working when the vertical isn't
 * loaded — platform-only tenants have neither note-alert surveys nor
 * annotation rows.
 */

// ---- module-private helpers (take ctx up front, like clinicians.js) ----

async function getMemberNotes(ctx, memberLink, tenantId) {
  const dbClient = ctx.getDbClient();
  const { moleculeIntToDate, formatDateLocal } = ctx.dates;
  const r = await dbClient.query(`
    SELECT annotation_date, annotation_text, created_by_member, created_ts
    FROM physician_annotation
    WHERE member_link = $1 AND tenant_id = $2
    ORDER BY annotation_date DESC
  `, [memberLink, tenantId]);
  return r.rows.map(row => ({
    ...row,
    date_display: formatDateLocal(moleculeIntToDate(row.annotation_date)),
    author: row.created_by_member ? 'Participant' : 'Care Team'
  }));
}

async function recordSurveyNoteReview(ctx, activityLink, memberLink, tenantId) {
  const dbClient = ctx.getDbClient();
  await dbClient.query(
    `INSERT INTO survey_note_review (activity_link, member_link, tenant_id, review_status)
     VALUES ($1, $2, $3, 'pending')`,
    [activityLink, memberLink, tenantId]
  );
}

export function register(app, ctx) {
  const { resolveMember } = ctx;
  const { moleculeIntToDate, platformToday, formatDateLocal } = ctx.dates;

  // GET /v1/physician-annotations/:membershipNumber — get annotations for a member
  app.get('/v1/physician-annotations/:membershipNumber', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const memberRec = await resolveMember(req.params.membershipNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });

      const result = await dbClient.query(`
        SELECT pa.annotation_id, pa.annotation_date, pa.annotation_text,
               pa.created_by_member, pa.created_by_user_id, pa.created_ts,
               u.display_name as created_by_name
        FROM physician_annotation pa
        LEFT JOIN platform_user u ON u.user_id = pa.created_by_user_id
        WHERE pa.member_link = $1 AND pa.tenant_id = $2
        ORDER BY pa.annotation_date DESC, pa.created_ts DESC
      `, [memberRec.link, tenantId]);

      const annotations = result.rows.map(r => ({
        ...r,
        annotation_date_display: formatDateLocal(moleculeIntToDate(r.annotation_date))
      }));

      res.json({ annotations });
    } catch (error) {
      console.error('Error in GET /v1/physician-annotations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/physician-annotations — create an annotation
  app.post('/v1/physician-annotations', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const { membership_number, tenant_id, annotation_text, annotation_date, created_by_member, user_id } = req.body;
    if (!membership_number || !tenant_id || !annotation_text) {
      return res.status(400).json({ error: 'membership_number, tenant_id, and annotation_text required' });
    }

    try {
      const memberRec = await resolveMember(membership_number, tenant_id);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });

      // Use provided date or today
      const annDate = annotation_date || platformToday();

      const result = await dbClient.query(`
        INSERT INTO physician_annotation (member_link, tenant_id, annotation_date, annotation_text, created_by_member, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [memberRec.link, tenant_id, annDate, annotation_text.substring(0, 1000), created_by_member !== false, user_id || null]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error in POST /v1/physician-annotations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/survey-note-reviews — all pending note reviews for a tenant (action queue use)
  app.get('/v1/survey-note-reviews', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || req.query.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const result = await dbClient.query(`
        SELECT snr.review_id, snr.activity_link, snr.review_status, snr.reviewed_by,
               snr.reviewed_at, snr.review_notes, snr.created_at,
               m.fname, m.lname, m.membership_number, m.title
        FROM survey_note_review snr
        JOIN member m ON m.link = snr.member_link
        WHERE snr.tenant_id = $1
        ORDER BY snr.review_status ASC, snr.created_at DESC
      `, [tenantId]);

      const pending = result.rows.filter(r => r.review_status === 'pending').length;
      res.json({ reviews: result.rows, pending_count: pending });
    } catch (error) {
      console.error('Error in GET /v1/survey-note-reviews:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/survey-note-reviews/:membershipNumber — note reviews for a member
  app.get('/v1/survey-note-reviews/:membershipNumber', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const memberRec = await resolveMember(req.params.membershipNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });

      const result = await dbClient.query(`
        SELECT snr.review_id, snr.activity_link, snr.review_status, snr.reviewed_by,
               snr.reviewed_at, snr.review_notes, snr.created_at,
               pu.display_name AS reviewed_by_name
        FROM survey_note_review snr
        LEFT JOIN platform_user pu ON pu.user_id = snr.reviewed_by
        WHERE snr.member_link = $1 AND snr.tenant_id = $2
        ORDER BY snr.created_at DESC
      `, [memberRec.link, tenantId]);

      res.json({ reviews: result.rows });
    } catch (error) {
      console.error('Error in GET /v1/survey-note-reviews:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /v1/survey-note-reviews/:reviewId — update review status
  app.patch('/v1/survey-note-reviews/:reviewId', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const reviewId = parseInt(req.params.reviewId);
    const { review_status, review_notes } = req.body;
    if (!review_status || !['reviewed', 'escalated'].includes(review_status)) {
      return res.status(400).json({ error: 'review_status must be "reviewed" or "escalated"' });
    }

    try {
      const userId = req.session?.userId || null;
      const result = await dbClient.query(`
        UPDATE survey_note_review
        SET review_status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
        WHERE review_id = $4
        RETURNING *
      `, [review_status, userId, review_notes || null, reviewId]);

      if (!result.rows.length) return res.status(404).json({ error: 'Review not found' });
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error in PATCH /v1/survey-note-reviews:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

/**
 * Register vertical->platform callbacks. Called from index.js -> boot(ctx).
 *
 * - getMemberNotes(memberLink, tenantId) -> formatted annotation rows.
 *   Consumer: GET /v1/export/:report 'notes' section. Fallback []: a
 *   platform-only export simply has no annotation rows.
 * - recordSurveyNoteReview(activityLink, memberLink, tenantId) -> writes
 *   the pending review row. Consumer: PUT /v1/member-surveys/:link/answers
 *   note-alert branch. Fallback no-op: platform-only tenants have no
 *   note-alert surveys, so the branch never fires for them anyway.
 */
export function registerCallbacks(ctx) {
  ctx.registerCallback('getMemberNotes',
    (memberLink, tenantId) => getMemberNotes(ctx, memberLink, tenantId));
  ctx.registerCallback('recordSurveyNoteReview',
    (activityLink, memberLink, tenantId) => recordSurveyNoteReview(ctx, activityLink, memberLink, tenantId));
}

export default { register, registerCallbacks };
