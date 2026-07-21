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
// Reactivation (Phase 2) — first-class return path. The person keeps their
// record and history; they get a NEW intake item and go back under
// case-manager review. Never a re-registration.
// ─────────────────────────────────────────────────────────────────────────

// Statuses a person can come back from. Participant is NOT here — an active
// participant has nothing to reactivate — and the active review stages are
// already in the queue.
const REACTIVATABLE = ['RESOURCES', 'TREATMENT', 'EVALUATION', 'SCREENING', 'REACTIVATION', 'DECLINED', 'CLOSED'];

async function reactivateRegistrant(ctx, createIntakeItem, db, memberLink, tenantId, opts = {}) {
  // opts.client: run every write on the caller's transaction client (the
  // staff reactivation door holds the member row lock — S148 audit #8).
  // Without it, writes ride the pool as before (the public register path).
  const writer = opts.client || db;
  const itemLink = await createIntakeItem({
    memberLink,
    tenantId,
    activityDate: ctx.dates.platformTodayStr(),
    actionCode: 'REACTIVATE',
    resultDescription: 'Returned to the program — reactivated for case-manager review',
    client: opts.client || null
  });
  await setIntakeStatus(ctx, memberLink, tenantId, 'CM_REVIEW', opts.client || null);
  if (opts.noteText) {
    await writer.query(`
      INSERT INTO intake_note (intake_link, tenant_id, author_user_id, note_text)
      VALUES ($1, $2, $3, $4)
    `, [itemLink, tenantId, opts.byUserId ?? null, opts.noteText]);
  }
  return itemLink;
}

// The mint panel's referral-type strings (carried in code context) → the
// REFERRAL_SOURCE molecule's codes. Same mapping the Performance Profile
// pre-fill uses, resolved server-side here.
const REFERRAL_CONTEXT_TO_CODE = {
  'self-referral': 'SELF',
  'employer': 'EMP',
  'board-mandated': 'BOARD'
};

// One confirmation for every successful (or already-registered) submit —
// the answer NEVER reveals whether a record already existed.
const REGISTER_CONFIRMATION =
  'Thank you — your registration was received. Someone from the program will contact you within two business days.';

// ─────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────
export function register(app, ctx) {
  const { logAudit, fireNotificationEvent } = ctx;
  // The same item-creation door the REG_REVIEW dispatch uses — the public
  // registration endpoint and the reactivation path both go through it.
  const createIntakeItem = makeCreateIntakeItem(ctx);

  // POST /v1/register — the PUBLIC registration door (Intake Phase 2).
  // Allowlisted in pointers.js PUBLIC_ROUTES; the gate is the registration
  // code itself: no valid registration-type link, no door. Creates a true
  // REGISTRANT (status Registered, never Participant) + an intake item via
  // the same enrollment machinery staff enroll uses. Tenant comes from the
  // code row — there is no session out here.
  app.post('/v1/register', async (req, res) => {
    const db = ctx.getDbClient();
    if (!db) return res.status(501).json({ error: 'Database not connected' });
    // Public door — per-IP throttle so it can't be scripted to flood the
    // intake queue with junk registrants (S147 audit #5).
    if (ctx.rateLimit && !(await ctx.rateLimit('register', req, res))) return;

    try {
      const token = String(req.body?.code || '').trim();
      const generic404 = () => res.status(404).json({
        error: 'This link isn’t active. If you were given it by your program, please check back with them for a current link.'
      });
      if (!token) return generic404();

      const codeRow = await ctx.codes.resolveCode(token);
      const today = ctx.dates.platformToday();
      const inWindow = codeRow &&
        (codeRow.start_date == null || today >= codeRow.start_date) &&
        (codeRow.end_date == null || today <= codeRow.end_date);
      if (!codeRow || codeRow.code_type !== 'registration' || codeRow.status !== 'A' || !inWindow) {
        // One generic answer — never reveal which codes exist or why one failed.
        return generic404();
      }
      // Enforce the use cap HERE, at the write — this is the single consume
      // point for registration codes (the landing only peeks). Atomic, so a
      // single-use link admits exactly one registration even under a direct
      // POST that skips the landing, or two simultaneous submits (S147 #5).
      if (codeRow.max_uses != null) {
        const consumed = await ctx.codes.consumeCode(token);
        if (!consumed.ok) return generic404();   // used_up / revoked / expired
      }
      const tenantId = codeRow.tenant_id;

      const clean = (v, max) => String(v || '').trim().substring(0, max);
      const fname = clean(req.body?.fname, 50);
      const lname = clean(req.body?.lname, 50);
      const email = clean(req.body?.email, 100);
      const phone = clean(req.body?.phone, 30);
      if (!fname || !lname) {
        return res.status(400).json({ error: 'First and last name are required.' });
      }
      if (!email && !phone) {
        return res.status(400).json({ error: 'An email address or phone number is required so the program can reach you.' });
      }

      // Referral source: the form's explicit pick wins; otherwise the code's
      // minted context supplies it. Unknown values are skipped, never fatal.
      let referralCode = null;
      const bodyReferral = clean(req.body?.referral, 10).toUpperCase();
      if (['SELF', 'EMP', 'BOARD'].includes(bodyReferral)) {
        referralCode = bodyReferral;
      } else if (codeRow.context?.referral_type) {
        referralCode = REFERRAL_CONTEXT_TO_CODE[String(codeRow.context.referral_type).toLowerCase()] || null;
      }

      // Never register the same person twice (the spec's rule). An exact
      // name + email match is the same person: no new record. If their file
      // was closed, this re-contact REACTIVATES them (new intake item, back
      // to case-manager review, history intact). The response is identical
      // either way — a public form must not confirm who is already known.
      if (email) {
        const existing = await db.query(`
          SELECT link FROM member
          WHERE tenant_id = $1 AND LOWER(fname) = LOWER($2)
            AND LOWER(lname) = LOWER($3) AND LOWER(email) = LOWER($4)
        `, [tenantId, fname, lname, email]);
        if (existing.rows.length) {
          const memberLink = existing.rows[0].link;
          try {
            const open = await db.query(
              `SELECT link FROM intake_item WHERE member_link = $1 AND tenant_id = $2 AND status <> 'R' LIMIT 1`,
              [memberLink, tenantId]);
            if (open.rows.length) {
              // Already being worked — note the repeat contact on the item.
              await db.query(`
                INSERT INTO intake_note (intake_link, tenant_id, author_user_id, note_text)
                VALUES ($1, $2, NULL, 'Registered again through a registration link while this item was open.')
              `, [open.rows[0].link, tenantId]);
            } else {
              const status = await getIntakeStatus(ctx, memberLink, tenantId);
              if (status && REACTIVATABLE.includes(status)) {
                await reactivateRegistrant(ctx, createIntakeItem, db, memberLink, tenantId, {
                  noteText: 'Returned through a registration link.'
                });
              } else {
                // A current participant (or someone with no closed file)
                // used a registration link — nothing to reopen; log it.
                console.log(`register: existing member ${memberLink} (status ${status}) re-registered — no action taken`);
              }
            }
          } catch (e) {
            // The person is already in the system — a bookkeeping failure
            // here must not turn their submit into an error page.
            console.error('register: returning-registrant handling failed:', e.message);
          }
          return res.json({ success: true, message: REGISTER_CONFIRMATION });
        }
      }

      // A new registrant. The server allocates the membership number —
      // nothing for the public form to reserve or double-submit.
      const membershipNumber = await ctx.getNextMembershipNumber(tenantId);
      const { member } = await ctx.enrollMemberRecord(tenantId, {
        membership_number: membershipNumber,
        fname, lname,
        email: email || null,
        phone: phone || null
      }, {
        // Stamp BEFORE the enrollment promotions fire: the REG_REVIEW
        // dispatch (createIntakeItem) must see Registered, not stamp
        // Participant. This ordering is the whole point of the hook.
        beforePromotions: async (m) => {
          await setIntakeStatus(ctx, m.link, tenantId, 'REGISTERED');
          if (referralCode) {
            const valueId = await ctx.molecules.encodeMolecule(tenantId, 'REFERRAL_SOURCE', referralCode);
            if (valueId != null) {
              await ctx.molecules.insertMoleculeRow(m.link, 'REFERRAL_SOURCE', [valueId], tenantId);
            } else {
              console.error(`register: REFERRAL_SOURCE has no value '${referralCode}' — skipped`);
            }
          }
        }
      });

      // Public action — audited with no acting user.
      await logAudit(tenantId, null, 'member', member.link, 'A');
      ctx.log.debugLog(() => `📝 Public registration: ${fname} ${lname} → member ${member.link} (registrant)`);

      res.json({ success: true, message: REGISTER_CONFIRMATION });
    } catch (error) {
      console.error('Error in POST /v1/register:', error);
      res.status(500).json({ error: 'Something went wrong saving your registration. Please try again, or contact the program directly.' });
    }
  });

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
    let statusMap = new Map(), referralMap = new Map(), credentialMap = new Map();
    try {
      statusMap = await ctx.molecules.bulkGetMoleculeValues('INTAKE_STATUS', links, tenantId);
    } catch (e) { console.error('intake: INTAKE_STATUS bulk read failed:', e.message); }
    try {
      referralMap = await ctx.molecules.bulkGetMoleculeValues('REFERRAL_SOURCE', links, tenantId);
    } catch (e) { console.error('intake: REFERRAL_SOURCE bulk read failed:', e.message); }
    try {
      // Credentials (Session 143): the display rule "Name, CRED" holds on
      // the queue too. Fail-open — a tenant without the molecule is unaffected.
      credentialMap = await ctx.molecules.bulkGetMoleculeValues('CREDENTIAL', links, tenantId);
    } catch (e) { /* tenant without CREDENTIAL — fine */ }

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
      item.credentials = [];
      for (const row of credentialMap.get(item.member_link) || []) {
        if (row.C1 == null) continue;
        const label = await decode('CREDENTIAL', row.C1, true);
        if (label) item.credentials.push(label);
      }
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
      // One person's items (by public membership number) — the chart's
      // intake-history card asks this way, usually with include_resolved=1.
      if (req.query.member) { params.push(String(req.query.member)); where += ` AND m.membership_number = $${params.length}`; }

      const r = await db.query(`
        SELECT ii.*,
               m.fname || ' ' || m.lname AS member_name,
               m.membership_number,
               owner.display_name AS assigned_to_name,
               sender.display_name AS sent_by_name,
               resolver.display_name AS resolved_by_name,
               outreacher.display_name AS outreach_by_name,
               (SELECT COUNT(*)::int FROM intake_note n WHERE n.intake_link = ii.link) AS note_count
        FROM intake_item ii
        JOIN member m ON m.link = ii.member_link
        LEFT JOIN platform_user owner ON owner.user_id = ii.assigned_to
        LEFT JOIN platform_user sender ON sender.user_id = ii.sent_by
        LEFT JOIN platform_user resolver ON resolver.user_id = ii.resolved_by
        LEFT JOIN platform_user outreacher ON outreacher.user_id = ii.outreach_by
        WHERE ${where}
        ORDER BY ii.sla_deadline ASC NULLS LAST, ii.registered_ts ASC
      `, params);

      const cfg = await readIntakeConfig(db, tenantId);
      let items = await decorateItems(db, r.rows, tenantId, cfg);

      // include_notes=1 — attach each item's notes (the chart's intake-
      // history card renders them inline; the queue list never asks).
      if (req.query.include_notes === '1' && items.length) {
        const noteRows = await db.query(`
          SELECT n.intake_link, n.note_ts, n.note_text,
                 pu.display_name AS author_name
          FROM intake_note n
          LEFT JOIN platform_user pu ON pu.user_id = n.author_user_id
          WHERE n.intake_link = ANY($1)
          ORDER BY n.note_ts DESC
        `, [items.map(i => i.link)]);
        for (const i of items) {
          i.notes = noteRows.rows.filter(n => n.intake_link === i.link);
        }
      }

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

      // The person's EARLIER items, each with its notes — reactivation
      // creates a NEW item, and before this the old item's notes and
      // outreach stamp were unreachable from the new one (Erica's
      // "data loss" flag — the data was always retained, only hidden).
      const history = await db.query(`
        SELECT ii.link, ii.review_type, ii.status, ii.registered_ts,
               ii.resolution_code, ii.resolution_notes, ii.resolved_ts,
               ii.outreach_ts,
               resolver.display_name AS resolved_by_name,
               outreacher.display_name AS outreach_by_name
        FROM intake_item ii
        LEFT JOIN platform_user resolver ON resolver.user_id = ii.resolved_by
        LEFT JOIN platform_user outreacher ON outreacher.user_id = ii.outreach_by
        WHERE ii.member_link = $1 AND ii.tenant_id = $2 AND ii.link <> $3
        ORDER BY ii.registered_ts DESC
      `, [item.member_link, tenantId, link]);
      if (history.rows.length) {
        const histNotes = await db.query(`
          SELECT n.intake_link, n.note_ts, n.note_text,
                 pu.display_name AS author_name
          FROM intake_note n
          LEFT JOIN platform_user pu ON pu.user_id = n.author_user_id
          WHERE n.intake_link = ANY($1)
          ORDER BY n.note_ts DESC
        `, [history.rows.map(h => h.link)]);
        for (const h of history.rows) {
          h.notes = histNotes.rows.filter(n => n.intake_link === h.link);
        }
      }

      const caller = await resolveCaller(ctx, req, db, tenantId);
      res.json({
        item, notes: notes.rows, history: history.rows,
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

      // Position-holder lookups are read-only config — resolve them before
      // the transaction so the lock window stays short.
      let mdHolder = null, cmFallback = null;
      if (action === 'send_md') {
        const holders = await ctx.molecules.findUsersByMoleculeValue(tenantId, 'POSITIONCLINIC', 'MEDDIR');
        if (!holders.length) {
          return res.status(409).json({
            error: 'No one holds the Medical Director position. Assign it in Program Settings → Users & Roles first.'
          });
        }
        mdHolder = holders[0].user_id;
      }
      if (action === 'send_back' && !item.sent_by) {
        const holders = await ctx.molecules.findUsersByMoleculeValue(tenantId, 'POSITIONCLINIC', 'CASEMAN');
        cmFallback = holders.length ? holders[0].user_id : null;
      }

      // ── The transitions — one member-row-locked transaction (S148 audit
      // #8, same class S145 closed for the member-write windows). The item
      // was read on the pool above; two staff acting at once could both
      // pass the guards and lose a disposition. Inside the lock we re-read
      // the item and re-check the two facts that race (already resolved /
      // review stage); every write rides the client so a failure rolls the
      // whole disposition back. Lock order is member THEN item everywhere
      // in this file — consistent order is what prevents deadlock. ──
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT link FROM member WHERE link = $1 FOR UPDATE', [item.member_link]);
        const locked = await client.query(
          `SELECT review_type, status, sent_by FROM intake_item
           WHERE link = $1 AND tenant_id = $2 FOR UPDATE`, [link, tenantId]);
        const now = locked.rows[0];
        if (!now) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Intake item not found' });
        }
        if (now.status === 'R') {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Someone else just resolved this item — refresh the queue to see its disposition.' });
        }
        if (now.review_type !== stageNeeded) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: now.review_type === 'MD'
              ? 'This item just moved to the Medical Director — refresh the queue.'
              : 'This item just came back to case-manager review — refresh the queue.'
          });
        }

        if (action === 'record_outreach') {
          await client.query(
            `UPDATE intake_item SET outreach_ts = NOW(), outreach_by = $2 WHERE link = $1`,
            [link, caller.userId]);

        } else if (action === 'send_md') {
          await client.query(`
            UPDATE intake_item SET review_type = 'MD', sent_by = $2, sent_ts = NOW(),
              assigned_to = $3, assigned_ts = NOW()
            WHERE link = $1
          `, [link, caller.userId, mdHolder]);
          // A registrant moves to the Medical-director-review stage; a
          // Phase-1 participant under administrative review stays Participant.
          const current = await getIntakeStatus(ctx, item.member_link, tenantId, client);
          if (current && current !== STATUS_PARTICIPANT) {
            await setIntakeStatus(ctx, item.member_link, tenantId, 'MD_REVIEW', client);
          }
          notify = { event: 'INTAKE_SENT_MD', detail: `Sent by ${caller.displayName}: ${reason}` };

        } else if (action === 'send_back') {
          // The return path Escalate never had. Back to the case manager —
          // the one who sent it when known, else the first position holder.
          const backTo = now.sent_by || cmFallback;
          await client.query(`
            UPDATE intake_item SET review_type = 'CM', assigned_to = $2,
              assigned_ts = CASE WHEN $2::integer IS NULL THEN assigned_ts ELSE NOW() END
            WHERE link = $1
          `, [link, backTo]);
          const current = await getIntakeStatus(ctx, item.member_link, tenantId, client);
          if (current && current !== STATUS_PARTICIPANT) {
            await setIntakeStatus(ctx, item.member_link, tenantId, 'CM_REVIEW', client);
          }
          notify = { event: 'INTAKE_SENT_BACK', detail: `${caller.displayName}: ${reason}` };

        } else {
          // Terminal dispositions: route_resources / approve_screening /
          // refer_evaluation / refer_treatment / close_file.
          await client.query(`
            UPDATE intake_item SET status = 'R', resolution_code = $2,
              resolution_notes = $3, resolved_ts = NOW(), resolved_by = $4
            WHERE link = $1
          `, [link, RESOLUTION_CODE[action], reason || null, caller.userId]);
          await setIntakeStatus(ctx, item.member_link, tenantId, DISPOSITION_STATUS[action], client);
        }

        // Reason text is a triage note too — attributed, dated, on the chart.
        if (reason) {
          await client.query(`
            INSERT INTO intake_note (intake_link, tenant_id, author_user_id, note_text)
            VALUES ($1, $2, $3, $4)
          `, [link, tenantId, caller.userId, `[${spec.label}] ${reason}`]);
        }

        await client.query('COMMIT');
      } catch (txnError) {
        await client.query('ROLLBACK');
        throw txnError;
      } finally {
        client.release();
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

  // POST /v1/participant-activations — THE conversion moment (Phase 2).
  // A registrant becomes a participant at exactly one moment: the signing
  // of the monitoring agreement (spec §4). Recording that fact assigns the
  // clinic, stamps Participant (the roster picks them up instantly — no
  // member_instrument rows means they owe the program-default set, which
  // is how MEDS already works), and resolves any open intake item. Either
  // intake position may record it: the signature is an administrative
  // fact; the clinical decisions stayed with the Medical Director.
  // Body: { membership_number, program_id, note? }
  app.post('/v1/participant-activations', async (req, res) => {
    const db = ctx.getDbClient();
    if (!db) return res.status(501).json({ error: 'Database not connected' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const membershipNumber = String(req.body?.membership_number || '').trim();
      const programId = parseInt(req.body?.program_id);
      if (!membershipNumber) return res.status(400).json({ error: 'membership_number required' });
      if (!programId) return res.status(400).json({ error: 'A clinic (program_id) is required — activation assigns the participant somewhere.' });

      const caller = await resolveCaller(ctx, req, db, tenantId);
      if (!caller || (!caller.isCaseManager && !caller.isMedicalDirector)) {
        return res.status(403).json({
          error: 'Recording a signed monitoring agreement belongs to Case Managers and Medical Directors. Your login holds neither position — assign one in Program Settings → Users & Roles.'
        });
      }

      const m = await db.query(
        `SELECT link, fname || ' ' || lname AS member_name FROM member
         WHERE tenant_id = $1 AND membership_number = $2`,
        [tenantId, membershipNumber]);
      if (!m.rows.length) return res.status(404).json({ error: 'No person with that number in this program.' });
      const memberLink = m.rows[0].link;

      // The clinic: resolve the program AND its partner — the
      // PARTNER_PROGRAM molecule stores both, referenced by code.
      // partner_program has no tenant_id of its own; it is tenant-scoped
      // only through partner.tenant_id, so the join + filter is what keeps
      // a caller from assigning their participant to ANOTHER program's
      // clinic by passing its id directly (S147 audit).
      const prog = await db.query(`
        SELECT pp.program_id, pp.partner_id, pp.program_name
        FROM partner_program pp
        JOIN partner p ON p.partner_id = pp.partner_id
        WHERE pp.program_id = $1 AND pp.is_active = true AND p.tenant_id = $2
      `, [programId, tenantId]);
      if (!prog.rows.length) return res.status(404).json({ error: 'That clinic/program was not found (or is inactive).' });
      const clinic = prog.rows[0];

      // ── The conversion — one member-row-locked transaction (S148 audit
      // #8). The status check lives INSIDE the lock: two staff recording
      // the same signature at once used to both pass "not yet a
      // participant" and double-assign the clinic. Member THEN item lock
      // order, same as the action door. ──
      const noteText = String(req.body?.note || '').trim();
      let status = null;
      let resolvedItem = null;
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT link FROM member WHERE link = $1 FOR UPDATE', [memberLink]);

        status = await getIntakeStatus(ctx, memberLink, tenantId, client);
        if (status === STATUS_PARTICIPANT) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: `${m.rows[0].member_name} is already an active participant.` });
        }

        // Assign the clinic — replace-in-place (one clinic per person). The
        // external-list columns store the numeric ids (partner_id, program_id).
        const existingClinic = await ctx.molecules.getMoleculeRows(memberLink, 'PARTNER_PROGRAM', tenantId, null, client);
        for (const row of existingClinic) {
          await ctx.molecules.deleteMoleculeRow(memberLink, 'PARTNER_PROGRAM', { n1: row.N1, n2: row.N2 }, tenantId, client);
        }
        await ctx.molecules.insertMoleculeRow(memberLink, 'PARTNER_PROGRAM', [clinic.partner_id, clinic.program_id], tenantId, null, client);

        // The one status change that makes them a participant.
        await setIntakeStatus(ctx, memberLink, tenantId, STATUS_PARTICIPANT, client);

        // Compliance starts when monitoring starts (S149, Bill's call):
        // becoming a participant assigns the program's ACTIVE compliance
        // set — cadence copied from each item's definition, an existing
        // inactive row reactivated instead of duplicated. Rides the
        // transaction: a half-activated participant is worse than a loud
        // rollback. (Replaces the retired POST_ENROLL auto-assign, which
        // fired for unsigned registrants and was silently broken.)
        await client.query(`
          INSERT INTO member_compliance (member_link, compliance_item_id, cadence_type, cadence_days, tenant_id)
          SELECT $1, ci.compliance_item_id,
                 COALESCE(ci.cadence_type, 'monthly'), COALESCE(ci.cadence_days, 30), $2
          FROM compliance_item ci
          WHERE ci.tenant_id = $2 AND ci.status = 'active'
          ON CONFLICT (member_link, compliance_item_id)
          DO UPDATE SET status = 'active'
        `, [memberLink, tenantId]);

        // Resolve any open intake item — signing the agreement IS the
        // disposition. History (items, notes, screenings) rides with them.
        const open = await client.query(
          `SELECT link FROM intake_item WHERE member_link = $1 AND tenant_id = $2 AND status <> 'R' LIMIT 1 FOR UPDATE`,
          [memberLink, tenantId]);
        if (open.rows.length) {
          resolvedItem = open.rows[0].link;
          await client.query(`
            UPDATE intake_item SET status = 'R', resolution_code = 'PARTICIPANT',
              resolution_notes = $2, resolved_ts = NOW(), resolved_by = $3
            WHERE link = $1
          `, [resolvedItem, noteText || 'Signed the monitoring agreement — activated as participant.', caller.userId]);
          await client.query(`
            INSERT INTO intake_note (intake_link, tenant_id, author_user_id, note_text)
            VALUES ($1, $2, $3, $4)
          `, [resolvedItem, tenantId, caller.userId,
              `[Activated] Signed monitoring agreement — assigned to ${clinic.program_name}.${noteText ? ' ' + noteText : ''}`]);
        }

        await client.query('COMMIT');
      } catch (txnError) {
        await client.query('ROLLBACK');
        throw txnError;
      } finally {
        client.release();
      }

      if (resolvedItem != null) {
        await logAudit(tenantId, caller.userId, 'intake_item', resolvedItem, 'E',
          { resolution_code: 'PARTICIPANT', program_id: clinic.program_id });
      }

      await logAudit(tenantId, caller.userId, 'member', memberLink, 'E',
        { activated_as_participant: true, from_status: status, program_id: clinic.program_id });

      try {
        await fireNotificationEvent('INTAKE_ACTIVATED', tenantId, {
          memberLink,
          memberName: m.rows[0].member_name,
          detail: `Now an active participant — assigned to ${clinic.program_name}.`,
          sourceLink: resolvedItem != null ? String(resolvedItem) : null,
          sourcePage: 'intake_queue.html'
        });
      } catch (e) {
        console.error('INTAKE_ACTIVATED notification fire failed:', e.message);
      }

      res.json({
        success: true,
        message: `${m.rows[0].member_name} is now an active participant, assigned to ${clinic.program_name}.`,
        resolved_item: resolvedItem
      });
    } catch (error) {
      console.error('Error in POST /v1/participant-activations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/intake-reactivations — the staff reactivation door (Phase 2).
  // Body: { membership_number, note? }. Either intake position may record a
  // return (Erica's "who triggers reactivation" decision is OPEN — this is
  // the case-manager-initiated default; a registrant re-using a registration
  // link reaches the same routine through the public door).
  app.post('/v1/intake-reactivations', async (req, res) => {
    const db = ctx.getDbClient();
    if (!db) return res.status(501).json({ error: 'Database not connected' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const membershipNumber = String(req.body?.membership_number || '').trim();
      if (!membershipNumber) return res.status(400).json({ error: 'membership_number required' });

      const caller = await resolveCaller(ctx, req, db, tenantId);
      if (!caller || (!caller.isCaseManager && !caller.isMedicalDirector)) {
        return res.status(403).json({
          error: 'Reactivation belongs to Case Managers and Medical Directors. Your login holds neither position — assign one in Program Settings → Users & Roles.'
        });
      }

      const m = await db.query(
        `SELECT link, fname || ' ' || lname AS member_name FROM member
         WHERE tenant_id = $1 AND membership_number = $2`,
        [tenantId, membershipNumber]);
      if (!m.rows.length) return res.status(404).json({ error: 'No person with that number in this program.' });
      const memberLink = m.rows[0].link;

      // ── One member-row-locked transaction (S148 audit #8): the open-item
      // check and the status check happen INSIDE the lock, so two staff
      // reactivating at once (or a reactivation racing an activation, which
      // takes the same member lock) can't double-create an intake item. ──
      const noteText = String(req.body?.note || '').trim();
      let status = null;
      let itemLink = null;
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT link FROM member WHERE link = $1 FOR UPDATE', [memberLink]);

        const open = await client.query(
          `SELECT link FROM intake_item WHERE member_link = $1 AND tenant_id = $2 AND status <> 'R' LIMIT 1`,
          [memberLink, tenantId]);
        if (open.rows.length) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: `${m.rows[0].member_name} already has an open intake item — work that one instead of reactivating.` });
        }

        status = await getIntakeStatus(ctx, memberLink, tenantId, client);
        if (status === STATUS_PARTICIPANT) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: `${m.rows[0].member_name} is an active participant — there is nothing to reactivate.` });
        }
        if (!status || !REACTIVATABLE.includes(status)) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: `Reactivation is for people whose file was closed, declined, routed to resources, or in outside care. This person's status is ${status || 'not set'}.` });
        }

        itemLink = await reactivateRegistrant(ctx, createIntakeItem, db, memberLink, tenantId, {
          byUserId: caller.userId,
          noteText: noteText ? `[Reactivated] ${noteText}` : 'Reactivated — returned to the program.',
          client
        });

        await client.query('COMMIT');
      } catch (txnError) {
        await client.query('ROLLBACK');
        throw txnError;
      } finally {
        client.release();
      }
      await logAudit(tenantId, caller.userId, 'intake_item', itemLink, 'A', { reactivated_from: status });

      res.json({ success: true, item_link: itemLink });
    } catch (error) {
      console.error('Error in POST /v1/intake-reactivations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/intake-reactivations/candidates — the closed/declined/routed
  // files staff can bring back, searchable by NAME (Erica: staff don't
  // remember numbers). No q = the most recently closed files first (the
  // "recent list"). Same role gate as the reactivation door itself.
  app.get('/v1/intake-reactivations/candidates', async (req, res) => {
    const db = ctx.getDbClient();
    if (!db) return res.status(501).json({ error: 'Database not connected' });
    if (!req.session?.userId) return res.status(401).json({ error: 'Login required' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const caller = await resolveCaller(ctx, req, db, tenantId);
      if (!caller || (!caller.isCaseManager && !caller.isMedicalDirector)) {
        return res.status(403).json({
          error: 'Reactivation belongs to Case Managers and Medical Directors. Your login holds neither position — assign one in Program Settings → Users & Roles.'
        });
      }

      const q = String(req.query.q || '').trim();
      const params = [tenantId];
      let nameFilter = '';
      if (q) {
        params.push(`%${q}%`, q);
        nameFilter = ` AND (m.fname ILIKE $2 OR m.lname ILIKE $2 OR (m.fname || ' ' || m.lname) ILIKE $2 OR m.membership_number = $3)`;
      }
      const members = await db.query(`
        SELECT m.link, m.fname || ' ' || m.lname AS name, m.membership_number
        FROM member m
        WHERE m.tenant_id = $1 AND m.is_active = true${nameFilter}
        LIMIT 500
      `, params);
      if (!members.rows.length) return res.json({ candidates: [] });

      // Status per member through the helpers (never raw molecule SQL),
      // decoded once per distinct byte; only reactivatable statuses stay.
      const links = members.rows.map(r => r.link);
      const statusMap = await ctx.molecules.bulkGetMoleculeValues('INTAKE_STATUS', links, tenantId);
      let credentialMap = new Map();
      try {
        credentialMap = await ctx.molecules.bulkGetMoleculeValues('CREDENTIAL', links, tenantId);
      } catch (e) { /* tenant without CREDENTIAL — fine */ }
      const decodeCache = new Map();
      async function decode(key, valueId, wantLabel) {
        const ck = `${key}:${valueId}:${wantLabel ? 'L' : 'C'}`;
        if (!decodeCache.has(ck)) {
          try { decodeCache.set(ck, await ctx.molecules.decodeMolecule(tenantId, key, valueId, wantLabel ? 'label' : null)); }
          catch (e) { decodeCache.set(ck, null); }
        }
        return decodeCache.get(ck);
      }

      const candidates = [];
      for (const m of members.rows) {
        const row = (statusMap.get(m.link) || [])[0];
        if (!row) continue;
        const code = await decode('INTAKE_STATUS', row.C1, false);
        if (!code || !REACTIVATABLE.includes(code)) continue;
        const credentials = [];
        for (const c of credentialMap.get(m.link) || []) {
          if (c.C1 == null) continue;
          const label = await decode('CREDENTIAL', c.C1, true);
          if (label) credentials.push(label);
        }
        candidates.push({
          member_link: m.link, name: m.name, credentials,
          membership_number: m.membership_number,
          status_code: code,
          status_label: await decode('INTAKE_STATUS', row.C1, true)
        });
      }
      if (!candidates.length) return res.json({ candidates: [] });

      // Most recent intake disposition per candidate — sorts the recent
      // list and tells staff when/why the file closed.
      const lastItems = await db.query(`
        SELECT DISTINCT ON (member_link) member_link, resolution_code, resolved_ts
        FROM intake_item
        WHERE member_link = ANY($1) AND tenant_id = $2
        ORDER BY member_link, registered_ts DESC
      `, [candidates.map(c => c.member_link), tenantId]);
      const lastByLink = new Map(lastItems.rows.map(r => [r.member_link, r]));
      for (const c of candidates) {
        const last = lastByLink.get(c.member_link);
        c.last_resolution_code = last ? last.resolution_code : null;
        c.last_resolved_ts = last ? last.resolved_ts : null;
        delete c.member_link;   // internal key — the public number is the handle
      }
      candidates.sort((a, b) => new Date(b.last_resolved_ts || 0) - new Date(a.last_resolved_ts || 0));

      res.json({ candidates: candidates.slice(0, 20) });
    } catch (error) {
      console.error('Error in GET /v1/intake-reactivations/candidates:', error);
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
