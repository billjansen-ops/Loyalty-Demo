/**
 * Intake — the administrative front door, separated from the Stability
 * Registry (Erica's intake spec, adopted whole — Session 142, Phase 1).
 *
 * The Stability Registry is a clinical surface (participants, tiers,
 * composite scores). Intake review is administrative work on registrants:
 * SLA-prioritized, stage-driven, no clinical tier anywhere. One person,
 * one truth: the lifecycle status lives in the INTAKE_STATUS member
 * molecule (Erica's ten stages + Participant); the work item lives in the
 * intake_item table (v111) and can never pollute registry tier counts.
 *
 * Role-scoped actions are enforced HERE, server-side — the platform's
 * first real permission gate, riding the POSITIONCLINIC positions:
 *   Case Manager (CASEMAN): add note, record outreach, route to
 *     resources, send for Medical Director review.
 *   Medical Director (MEDDIR): add note, approve for screening, refer
 *     for evaluation, refer for treatment, route to resources, send back
 *     to the case manager (with a reason), close the file (with a reason).
 * Escalate and Advance are RETIRED. A wrong-role request is refused with
 * a plain-English answer, not just hidden in the interface.
 *
 * Endpoints:
 *   GET  /v1/intake-items            — the queue (filters: stage, referral
 *                                      source, owner, SLA state)
 *   GET  /v1/intake-items/:link      — one item + its triage notes
 *   POST /v1/intake-items/:link/notes    — add an attributed triage note
 *   POST /v1/intake-items/:link/actions  — the one action door (role-gated)
 *
 * External action handler: createIntakeItem — the REG_REVIEW dispatch
 * target since v111 (was createRegistryItem). New registrations create
 * intake items, never registry items.
 *
 * Scheduled job: INTAKE_SLA — flags newly-overdue items to the case
 * managers. Auto-escalation to the Medical Director is OFF by default
 * (Erica's open decision; Bill's default until she answers) — sysparm
 * intake_sla / auto_escalate.
 */

// The intake lifecycle codes (v111 seeds these as INTAKE_STATUS values —
// codes are stable, labels live in the database). PARTICIPANT is the
// eleventh value: the roster is status=Participant, the intake queue is
// everyone else with an open item.
const STATUS_PARTICIPANT = 'PARTICIPANT';

// What each action needs: the position that may perform it, the review
// stage the item must be in, and whether a written reason is required.
// This table IS the server-side permission gate (spec §7).
const ACTIONS = {
  record_outreach:   { position: 'CASEMAN', stage: 'CM', needsReason: false, label: 'Record outreach' },
  send_md:           { position: 'CASEMAN', stage: 'CM', needsReason: true,  label: 'Send for Medical Director review' },
  route_resources:   { position: 'EITHER',  stage: 'OWN', needsReason: true, label: 'Route to resources' },
  approve_screening: { position: 'MEDDIR',  stage: 'MD', needsReason: false, label: 'Approve for screening' },
  refer_evaluation:  { position: 'MEDDIR',  stage: 'MD', needsReason: false, label: 'Refer for evaluation' },
  refer_treatment:   { position: 'MEDDIR',  stage: 'MD', needsReason: false, label: 'Refer for treatment' },
  send_back:         { position: 'MEDDIR',  stage: 'MD', needsReason: true,  label: 'Send back to case manager' },
  close_file:        { position: 'MEDDIR',  stage: 'MD', needsReason: true,  label: 'Close file' }
};

// Which member status a terminal disposition stamps. send_md / send_back
// move the ITEM between review stages; they only restamp the member when
// the member is already in a registrant status (a Phase-1 participant
// under administrative review stays on the roster until a real
// disposition says otherwise).
const DISPOSITION_STATUS = {
  route_resources:   'RESOURCES',
  approve_screening: 'SCREENING',
  refer_evaluation:  'EVALUATION',
  refer_treatment:   'TREATMENT',
  close_file:        'CLOSED'
};

const RESOLUTION_CODE = {
  route_resources:   'RESOURCES',
  approve_screening: 'SCREENING',
  refer_evaluation:  'EVALUATION',
  refer_treatment:   'TREATMENT',
  close_file:        'CLOSED'
};

/**
 * Add N business days to a timestamp (skips Saturday/Sunday, keeps the
 * time of day — the spec's two-business-day outreach standard). Holidays
 * are out of scope until the program says otherwise.
 */
function addBusinessDays(from, days) {
  const d = new Date(from.getTime());
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d;
}

/**
 * The intake SLA knobs — sysparm group 'intake_sla' (v111), with the
 * platform-standard fallback so a tenant without the rows keeps working.
 */
async function readIntakeConfig(db, tenantId) {
  const cfg = { businessDays: 2, dueSoonHours: 12, autoEscalate: false };
  try {
    const r = await db.query(`
      SELECT sd.code, sd.value FROM sysparm s
      JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
      WHERE s.tenant_id = $1 AND s.sysparm_key = 'intake_sla'
    `, [tenantId]);
    for (const row of r.rows) {
      if (row.code === 'business_days') cfg.businessDays = parseInt(row.value) || cfg.businessDays;
      if (row.code === 'due_soon_hours') cfg.dueSoonHours = parseInt(row.value) || cfg.dueSoonHours;
      if (row.code === 'auto_escalate') cfg.autoEscalate = String(row.value).toLowerCase() === 'true';
    }
  } catch (e) {
    console.error('readIntakeConfig failed (using defaults):', e.message);
  }
  return cfg;
}

/** on_time / due_soon / overdue / resolved — never a clinical tier. */
function slaState(item, dueSoonHours) {
  if (item.status === 'R') return 'resolved';
  if (!item.sla_deadline) return 'on_time';
  const deadline = new Date(item.sla_deadline).getTime();
  const now = Date.now();
  if (now > deadline) return 'overdue';
  if (deadline - now <= dueSoonHours * 3600000) return 'due_soon';
  return 'on_time';
}

/**
 * Who is calling, and which intake positions do they hold? Resolved from
 * the session (authoritative), through the SAME position resolution the
 * notification router uses (findUsersByMoleculeValue) — read/gate symmetry.
 */
async function resolveCaller(ctx, req, db, tenantId) {
  const userId = req.session?.userId;
  if (!userId) return null;
  const u = await db.query(
    `SELECT user_id, link, display_name FROM platform_user WHERE user_id = $1`, [userId]);
  if (!u.rows.length) return null;
  const [caseManagers, medicalDirectors] = await Promise.all([
    ctx.molecules.findUsersByMoleculeValue(tenantId, 'POSITIONCLINIC', 'CASEMAN'),
    ctx.molecules.findUsersByMoleculeValue(tenantId, 'POSITIONCLINIC', 'MEDDIR')
  ]);
  return {
    userId: u.rows[0].user_id,
    displayName: u.rows[0].display_name,
    isCaseManager: caseManagers.some(h => h.user_id === userId),
    isMedicalDirector: medicalDirectors.some(h => h.user_id === userId)
  };
}

/**
 * Set the member's INTAKE_STATUS (replace-in-place through the molecule
 * helpers — the single-value contract: at most one row). Codes are the
 * v111 text_values; encodeMolecule maps code → per-molecule value_id.
 */
async function setIntakeStatus(ctx, memberLink, tenantId, code, client = null) {
  const valueId = await ctx.molecules.encodeMolecule(tenantId, 'INTAKE_STATUS', code);
  if (valueId == null) throw new Error(`INTAKE_STATUS has no value '${code}'`);
  const existing = await ctx.molecules.getMoleculeRows(memberLink, 'INTAKE_STATUS', tenantId, null, client);
  for (const row of existing) {
    await ctx.molecules.deleteMoleculeRow(memberLink, 'INTAKE_STATUS', { c1: row.C1 }, tenantId, client);
  }
  await ctx.molecules.insertMoleculeRow(memberLink, 'INTAKE_STATUS', [valueId], tenantId, null, client);
}

/** Read + decode the member's current INTAKE_STATUS code (null = none). */
async function getIntakeStatus(ctx, memberLink, tenantId, client = null) {
  const rows = await ctx.molecules.getMoleculeRows(memberLink, 'INTAKE_STATUS', tenantId, null, client);
  if (!rows.length) return null;
  return await ctx.molecules.decodeMolecule(tenantId, 'INTAKE_STATUS', rows[0].C1);
}

// ─────────────────────────────────────────────────────────────────────────
// createIntakeItem — the external action handler behind REG_REVIEW (v111).
// ─────────────────────────────────────────────────────────────────────────
function makeCreateIntakeItem(ctx) {
  const { getNextLink, fireNotificationEvent, logAudit, logPlatformError } = ctx;
  const { dateToMoleculeInt } = ctx.dates;
  const { debugLog } = ctx.log;

  return async function createIntakeItem(actionCtx) {
    const { memberLink, tenantId, activityDate, actionCode, resultDescription, client } = actionCtx;
    const db = client || ctx.getDbClient();

    // Phase-1 semantics: today's staff enroll door creates a PARTICIPANT
    // (current behavior preserved — Erica's flow keeps working), with an
    // intake item for the administrative review. Phase 2's registration
    // link will create REGISTERED people through its own door. Only stamp
    // when the member has no status yet — never overwrite one.
    try {
      const current = await getIntakeStatus(ctx, memberLink, tenantId, client);
      if (current == null) {
        await setIntakeStatus(ctx, memberLink, tenantId, STATUS_PARTICIPANT, client);
      }
    } catch (e) {
      // Loud, never silent — but a status stamp failure must not kill the
      // enrollment that triggered us.
      console.error(`createIntakeItem: INTAKE_STATUS stamp failed for ${memberLink}:`, e.message);
      logPlatformError('warn', 'createIntakeItem', 'INTAKE_STATUS stamp failed', { error: e.message });
    }

    const cfg = await readIntakeConfig(db, tenantId);
    const slaDeadline = addBusinessDays(new Date(), cfg.businessDays);

    // A named owner from day one when someone holds the position (spec:
    // an item is never owned by a role alone). No holder = unassigned,
    // shown plainly on the queue.
    let assignedTo = null;
    try {
      const holders = await ctx.molecules.findUsersByMoleculeValue(tenantId, 'POSITIONCLINIC', 'CASEMAN', db);
      assignedTo = holders.length ? holders[0].user_id : null;
    } catch (e) {
      console.error('createIntakeItem: case-manager lookup failed:', e.message);
    }

    const link = await getNextLink(tenantId, 'intake_item');
    const activityDateAsDate = activityDate instanceof Date
      ? activityDate
      : new Date(String(activityDate).split('T')[0] + 'T00:00:00');
    const createdDate = dateToMoleculeInt(activityDateAsDate);

    await db.query(`
      INSERT INTO intake_item (link, member_link, tenant_id, review_type,
        assigned_to, assigned_ts, registered_ts, created_date, sla_deadline, status)
      VALUES ($1, $2, $3, 'CM', $4, CASE WHEN $4::integer IS NULL THEN NULL ELSE NOW() END, NOW(), $5, $6, 'O')
    `, [link, memberLink, tenantId, assignedTo, createdDate, slaDeadline]);

    await logAudit(tenantId, null, 'intake_item', link, 'A');
    debugLog(() => `        📥 Intake item created: link=${link} / ${actionCode} / assigned_to=${assignedTo ?? 'unassigned'}`);

    try {
      const nameRow = await db.query(
        `SELECT fname || ' ' || lname AS member_name FROM member WHERE link = $1`, [memberLink]);
      await fireNotificationEvent('INTAKE_ITEM_CREATED', tenantId, {
        memberLink,
        memberName: nameRow.rows[0]?.member_name,
        detail: resultDescription || actionCode,
        sourceLink: String(link),
        sourcePage: 'intake_queue.html'
      });
    } catch (e) {
      logPlatformError('warn', 'createIntakeItem', 'Notification fire failed', { error: e.message });
    }

    return link;
  };
}

export function registerActionHandlers(ctx) {
  ctx.registerExternalActionHandler('createIntakeItem', makeCreateIntakeItem(ctx));
}

// ─────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────
export function register(app, ctx) {
  const { logAudit, fireNotificationEvent } = ctx;

  // Shared loader: the item with its member + owner names, tenant-scoped.
  async function loadItem(db, link, tenantId) {
    const r = await db.query(`
      SELECT ii.*,
             m.fname || ' ' || m.lname AS member_name,
             m.membership_number,
             owner.display_name AS assigned_to_name,
             sender.display_name AS sent_by_name,
             resolver.display_name AS resolved_by_name,
             outreacher.display_name AS outreach_by_name
      FROM intake_item ii
      JOIN member m ON m.link = ii.member_link
      LEFT JOIN platform_user owner ON owner.user_id = ii.assigned_to
      LEFT JOIN platform_user sender ON sender.user_id = ii.sent_by
      LEFT JOIN platform_user resolver ON resolver.user_id = ii.resolved_by
      LEFT JOIN platform_user outreacher ON outreacher.user_id = ii.outreach_by
      WHERE ii.link = $1 AND ii.tenant_id = $2
    `, [link, tenantId]);
    return r.rows[0] || null;
  }

  // Decorate items with decoded stage + referral source (from the member
  // molecules — the one truth) and the computed SLA state.
  async function decorateItems(db, items, tenantId, cfg) {
    if (!items.length) return items;
    const links = [...new Set(items.map(i => i.member_link))];
    let statusMap = new Map(), referralMap = new Map();
    try {
      statusMap = await ctx.molecules.bulkGetMoleculeValues('INTAKE_STATUS', links, tenantId);
    } catch (e) { console.error('intake: INTAKE_STATUS bulk read failed:', e.message); }
    try {
      referralMap = await ctx.molecules.bulkGetMoleculeValues('REFERRAL_SOURCE', links, tenantId);
    } catch (e) { console.error('intake: REFERRAL_SOURCE bulk read failed:', e.message); }

    // Decode each distinct value_id once (both lists are small).
    const decodeCache = new Map();
    async function decode(key, valueId, wantLabel) {
      if (valueId == null) return null;
      const ck = `${key}:${valueId}:${wantLabel ? 'L' : 'C'}`;
      if (!decodeCache.has(ck)) {
        try {
          decodeCache.set(ck, await ctx.molecules.decodeMolecule(tenantId, key, valueId, wantLabel ? 'label' : null));
        } catch (e) { decodeCache.set(ck, null); }
      }
      return decodeCache.get(ck);
    }

    for (const item of items) {
      const statusRow = (statusMap.get(item.member_link) || [])[0];
      const referralRow = (referralMap.get(item.member_link) || [])[0];
      item.stage_code = statusRow ? await decode('INTAKE_STATUS', statusRow.C1, false) : null;
      item.stage_label = statusRow ? await decode('INTAKE_STATUS', statusRow.C1, true) : null;
      item.referral_code = referralRow ? await decode('REFERRAL_SOURCE', referralRow.C1, false) : null;
      item.referral_label = referralRow ? await decode('REFERRAL_SOURCE', referralRow.C1, true) : null;
      item.sla_state = slaState(item, cfg.dueSoonHours);
    }
    return items;
  }

  // GET /v1/intake-items — the queue. Filters: review_type, stage,
  // referral, owner (assigned_to), sla (on_time/due_soon/overdue),
  // include_resolved.
  app.get('/v1/intake-items', async (req, res) => {
    const db = ctx.getDbClient();
    if (!db) return res.status(501).json({ error: 'Database not connected' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const includeResolved = req.query.include_resolved === '1';
      const params = [tenantId];
      let where = `ii.tenant_id = $1`;
      if (!includeResolved) where += ` AND ii.status <> 'R'`;
      if (req.query.review_type) { params.push(req.query.review_type); where += ` AND ii.review_type = $${params.length}`; }
      if (req.query.owner) { params.push(parseInt(req.query.owner)); where += ` AND ii.assigned_to = $${params.length}`; }

      const r = await db.query(`
        SELECT ii.*,
               m.fname || ' ' || m.lname AS member_name,
               m.membership_number,
               owner.display_name AS assigned_to_name,
               sender.display_name AS sent_by_name,
               (SELECT COUNT(*)::int FROM intake_note n WHERE n.intake_link = ii.link) AS note_count
        FROM intake_item ii
        JOIN member m ON m.link = ii.member_link
        LEFT JOIN platform_user owner ON owner.user_id = ii.assigned_to
        LEFT JOIN platform_user sender ON sender.user_id = ii.sent_by
        WHERE ${where}
        ORDER BY ii.sla_deadline ASC NULLS LAST, ii.registered_ts ASC
      `, params);

      const cfg = await readIntakeConfig(db, tenantId);
      let items = await decorateItems(db, r.rows, tenantId, cfg);

      // Stage / referral / SLA filters apply after decode (they live on
      // the member molecules and the clock, not on item columns).
      if (req.query.stage) items = items.filter(i => i.stage_code === req.query.stage);
      if (req.query.referral) items = items.filter(i => i.referral_code === req.query.referral);
      if (req.query.sla) items = items.filter(i => i.sla_state === req.query.sla);

      const caller = await resolveCaller(ctx, req, db, tenantId);
      res.json({
        items,
        sla: { business_days: cfg.businessDays, due_soon_hours: cfg.dueSoonHours },
        caller: caller ? {
          user_id: caller.userId,
          is_case_manager: caller.isCaseManager,
          is_medical_director: caller.isMedicalDirector
        } : null
      });
    } catch (error) {
      console.error('Error in GET /v1/intake-items:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/intake-items/:link — one item + its triage notes.
  app.get('/v1/intake-items/:link', async (req, res) => {
    const db = ctx.getDbClient();
    if (!db) return res.status(501).json({ error: 'Database not connected' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const link = parseInt(req.params.link);
      const item = await loadItem(db, link, tenantId);
      if (!item) return res.status(404).json({ error: 'Intake item not found' });

      const cfg = await readIntakeConfig(db, tenantId);
      await decorateItems(db, [item], tenantId, cfg);

      const notes = await db.query(`
        SELECT n.note_id, n.note_ts, n.note_text, n.author_user_id,
               pu.display_name AS author_name
        FROM intake_note n
        LEFT JOIN platform_user pu ON pu.user_id = n.author_user_id
        WHERE n.intake_link = $1
        ORDER BY n.note_ts DESC
      `, [link]);

      const caller = await resolveCaller(ctx, req, db, tenantId);
      res.json({
        item, notes: notes.rows,
        caller: caller ? {
          user_id: caller.userId,
          is_case_manager: caller.isCaseManager,
          is_medical_director: caller.isMedicalDirector
        } : null
      });
    } catch (error) {
      console.error('Error in GET /v1/intake-items/:link:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/intake-items/:link/notes — attributed, dated, audited.
  app.post('/v1/intake-items/:link/notes', async (req, res) => {
    const db = ctx.getDbClient();
    if (!db) return res.status(501).json({ error: 'Database not connected' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const link = parseInt(req.params.link);
      const noteText = (req.body?.note_text || '').trim();
      if (!noteText) return res.status(400).json({ error: 'A note needs text' });

      const item = await loadItem(db, link, tenantId);
      if (!item) return res.status(404).json({ error: 'Intake item not found' });

      const caller = await resolveCaller(ctx, req, db, tenantId);
      if (!caller || (!caller.isCaseManager && !caller.isMedicalDirector)) {
        return res.status(403).json({
          error: 'Triage notes are written by Case Managers and Medical Directors. Your login holds neither position — assign one in Program Settings → Users & Roles.'
        });
      }

      const inserted = await db.query(`
        INSERT INTO intake_note (intake_link, tenant_id, author_user_id, note_text)
        VALUES ($1, $2, $3, $4) RETURNING note_id, note_ts
      `, [link, tenantId, caller.userId, noteText]);
      await logAudit(tenantId, caller.userId, 'intake_item', link, 'E',
        { note_added: noteText.substring(0, 200) });

      res.json({ success: true, note_id: inserted.rows[0].note_id, note_ts: inserted.rows[0].note_ts });
    } catch (error) {
      console.error('Error in POST /v1/intake-items/:link/notes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/intake-items/:link/actions — THE action door. Role and stage
  // are enforced here; the interface only decides what to render.
  app.post('/v1/intake-items/:link/actions', async (req, res) => {
    const db = ctx.getDbClient();
    if (!db) return res.status(501).json({ error: 'Database not connected' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const link = parseInt(req.params.link);
      const action = req.body?.action;
      const reason = (req.body?.reason || '').trim();

      const spec = ACTIONS[action];
      if (!spec) {
        return res.status(400).json({
          error: `Unknown intake action '${action}'. Escalate and Advance are retired — the named actions are: ${Object.keys(ACTIONS).join(', ')}.`
        });
      }

      const item = await loadItem(db, link, tenantId);
      if (!item) return res.status(404).json({ error: 'Intake item not found' });
      if (item.status === 'R') {
        return res.status(409).json({ error: `This item is already resolved (${item.resolution_code}). Nothing further can be done to it.` });
      }

      const caller = await resolveCaller(ctx, req, db, tenantId);
      const isCM = caller?.isCaseManager === true;
      const isMD = caller?.isMedicalDirector === true;

      // ── Role gate (server-side, spec §7) ──
      if (spec.position === 'CASEMAN' && !isCM) {
        return res.status(403).json({
          error: `Only a Case Manager can ${spec.label.toLowerCase()}. ${isMD ? 'Your login holds the Medical Director position.' : 'Your login holds neither intake position — assign one in Program Settings → Users & Roles.'}`
        });
      }
      if (spec.position === 'MEDDIR' && !isMD) {
        return res.status(403).json({
          error: `Only the Medical Director can ${spec.label.toLowerCase()}. ${isCM ? 'A case manager routes to resources or sends the item for Medical Director review.' : 'Your login holds neither intake position — assign one in Program Settings → Users & Roles.'}`
        });
      }
      if (spec.position === 'EITHER' && !isCM && !isMD) {
        return res.status(403).json({
          error: 'Intake actions belong to Case Managers and Medical Directors. Your login holds neither position — assign one in Program Settings → Users & Roles.'
        });
      }

      // ── Stage gate: the action set is a function of role AND stage ──
      const stageNeeded = spec.stage === 'OWN' ? (isMD && item.review_type === 'MD' ? 'MD' : 'CM') : spec.stage;
      if (item.review_type !== stageNeeded) {
        return res.status(409).json({
          error: item.review_type === 'MD'
            ? 'This item is with the Medical Director. It comes back to the case manager only if the Medical Director sends it back.'
            : 'This item is in case-manager review — it has not been sent for Medical Director review yet.'
        });
      }

      if (spec.needsReason && !reason) {
        return res.status(400).json({ error: `${spec.label} needs a written reason — it goes on the chart and the audit trail.` });
      }

      const before = {
        review_type: item.review_type, status: item.status,
        assigned_to: item.assigned_to, outreach_ts: item.outreach_ts
      };
      let notify = null;

      // ── The transitions ──
      if (action === 'record_outreach') {
        await db.query(
          `UPDATE intake_item SET outreach_ts = NOW(), outreach_by = $2 WHERE link = $1`,
          [link, caller.userId]);

      } else if (action === 'send_md') {
        const holders = await ctx.molecules.findUsersByMoleculeValue(tenantId, 'POSITIONCLINIC', 'MEDDIR');
        if (!holders.length) {
          return res.status(409).json({
            error: 'No one holds the Medical Director position. Assign it in Program Settings → Users & Roles first.'
          });
        }
        await db.query(`
          UPDATE intake_item SET review_type = 'MD', sent_by = $2, sent_ts = NOW(),
            assigned_to = $3, assigned_ts = NOW()
          WHERE link = $1
        `, [link, caller.userId, holders[0].user_id]);
        // A registrant moves to the Medical-director-review stage; a
        // Phase-1 participant under administrative review stays Participant.
        const current = await getIntakeStatus(ctx, item.member_link, tenantId);
        if (current && current !== STATUS_PARTICIPANT) {
          await setIntakeStatus(ctx, item.member_link, tenantId, 'MD_REVIEW');
        }
        notify = { event: 'INTAKE_SENT_MD', detail: `Sent by ${caller.displayName}: ${reason}` };

      } else if (action === 'send_back') {
        // The return path Escalate never had. Back to the case manager —
        // the one who sent it when known, else the first position holder.
        let backTo = item.sent_by;
        if (!backTo) {
          const holders = await ctx.molecules.findUsersByMoleculeValue(tenantId, 'POSITIONCLINIC', 'CASEMAN');
          backTo = holders.length ? holders[0].user_id : null;
        }
        await db.query(`
          UPDATE intake_item SET review_type = 'CM', assigned_to = $2,
            assigned_ts = CASE WHEN $2::integer IS NULL THEN assigned_ts ELSE NOW() END
          WHERE link = $1
        `, [link, backTo]);
        const current = await getIntakeStatus(ctx, item.member_link, tenantId);
        if (current && current !== STATUS_PARTICIPANT) {
          await setIntakeStatus(ctx, item.member_link, tenantId, 'CM_REVIEW');
        }
        notify = { event: 'INTAKE_SENT_BACK', detail: `${caller.displayName}: ${reason}` };

      } else {
        // Terminal dispositions: route_resources / approve_screening /
        // refer_evaluation / refer_treatment / close_file.
        await db.query(`
          UPDATE intake_item SET status = 'R', resolution_code = $2,
            resolution_notes = $3, resolved_ts = NOW(), resolved_by = $4
          WHERE link = $1
        `, [link, RESOLUTION_CODE[action], reason || null, caller.userId]);
        await setIntakeStatus(ctx, item.member_link, tenantId, DISPOSITION_STATUS[action]);
      }

      // Reason text is a triage note too — attributed, dated, on the chart.
      if (reason) {
        await db.query(`
          INSERT INTO intake_note (intake_link, tenant_id, author_user_id, note_text)
          VALUES ($1, $2, $3, $4)
        `, [link, tenantId, caller.userId, `[${spec.label}] ${reason}`]);
      }

      const after = await loadItem(db, link, tenantId);
      await logAudit(tenantId, caller.userId, 'intake_item', link, 'E', {
        before,
        after: {
          review_type: after.review_type, status: after.status,
          assigned_to: after.assigned_to, resolution_code: after.resolution_code
        }
      });

      if (notify) {
        try {
          await fireNotificationEvent(notify.event, tenantId, {
            memberLink: item.member_link,
            memberName: item.member_name,
            detail: notify.detail,
            sourceLink: String(link),
            sourcePage: 'intake_queue.html'
          });
        } catch (e) {
          console.error(`${notify.event} notification fire failed:`, e.message);
        }
      }

      res.json({ success: true, item: after });
    } catch (error) {
      console.error('Error in POST /v1/intake-items/:link/actions:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// INTAKE_SLA — the daily overdue check. Default behavior (the contract's
// stand-in for Erica's open decision): overdue FLAGS and notifies the case
// managers; the item STAYS with its case manager. Flip sysparm intake_sla /
// auto_escalate to 'true' and it also moves the item to the Medical
// Director — config, not code.
// ─────────────────────────────────────────────────────────────────────────
export function registerJobs(ctx) {
  const { registerJobHandler, fireNotificationEvent } = ctx;
  const { debugLog } = ctx.log;

  registerJobHandler('INTAKE_SLA', async (tenantId, scheduledJobId, db) => {
    const cfg = await readIntakeConfig(db, tenantId);
    const overdue = await db.query(`
      SELECT ii.link, ii.member_link, ii.assigned_to, ii.review_type,
             m.fname || ' ' || m.lname AS member_name
      FROM intake_item ii
      JOIN member m ON m.link = ii.member_link
      WHERE ii.tenant_id = $1
        AND ii.status <> 'R'
        AND ii.sla_deadline IS NOT NULL
        AND NOW() > ii.sla_deadline
        AND ii.overdue_notified_ts IS NULL
    `, [tenantId]);

    let processed = 0;
    let mdHolder = null;
    if (cfg.autoEscalate && overdue.rows.length) {
      const holders = await ctx.molecules.findUsersByMoleculeValue(tenantId, 'POSITIONCLINIC', 'MEDDIR');
      mdHolder = holders.length ? holders[0] : null;
    }

    for (const item of overdue.rows) {
      if (cfg.autoEscalate && mdHolder && item.review_type === 'CM') {
        await db.query(
          `UPDATE intake_item SET review_type = 'MD', assigned_to = $2, assigned_ts = NOW(),
             overdue_notified_ts = NOW() WHERE link = $1`,
          [item.link, mdHolder.user_id]);
        await ctx.logAudit(tenantId, null, 'intake_item', item.link, 'E',
          { before: { review_type: 'CM', assigned_to: item.assigned_to },
            after: { review_type: 'MD', assigned_to: mdHolder.user_id, auto_escalated: true } });
      } else {
        await db.query(
          `UPDATE intake_item SET overdue_notified_ts = NOW() WHERE link = $1`, [item.link]);
      }
      try {
        await fireNotificationEvent('INTAKE_OVERDUE', tenantId, {
          memberLink: item.member_link,
          memberName: item.member_name,
          detail: 'The two-business-day outreach window has passed with no disposition.',
          sourceLink: String(item.link),
          sourcePage: 'intake_queue.html'
        });
      } catch (e) {
        console.error('INTAKE_SLA notification fire failed:', e.message);
      }
      processed++;
    }

    debugLog(() => `INTAKE_SLA: ${overdue.rows.length} newly overdue, ${processed} flagged (auto_escalate=${cfg.autoEscalate})`);
    return { analyzed: overdue.rows.length, processed, flagged: processed };
  });
}
