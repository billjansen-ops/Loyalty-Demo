/**
 * Workforce Monitoring — MEDS (Missing Event Detection System).
 *
 * Phase 4 of the Insight server extraction (Session 128). Moved from
 * pointers.js: SENTINEL_MEDS_NEXT_DUE constant (was at L215), two
 * helpers (calculateMedsNextDue, processMedsForMember), the MEDS
 * scheduled-job handler, and four endpoints (POST /v1/meds/check/:link,
 * GET /v1/meds/member/:link, POST /v1/meds/seed, GET /v1/meds/summary).
 *
 * Pure transplant — behavior preserved. The only structural change
 * is that calculateMedsNextDue and processMedsForMember now read
 * dbClient via ctx.getDbClient() instead of closing over a top-level
 * pointers.js binding.
 */

// Sentinel used when a member has no MEDS schedule. Matches the original
// column default and the value the row would have had pre-v76. After v76,
// "no row in member_meds" semantically equals this sentinel.
const SENTINEL_MEDS_NEXT_DUE = 31910; // = 01/01/2137 in Bill epoch

export function register(app, ctx) {
  const { resolveMember, getCustauth } = ctx;
  const { platformToday, moleculeIntToDate, billEpochToDate } = ctx.dates;

  // --- MEDS API: check single member (called on page load) ---
  app.post('/v1/meds/check/:memberLink', async (req, res) => {
    const dbClient = ctx.getDbClient();
    const memberLink = req.params.memberLink;
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      // Check the member exists, then look up MEDS schedule from scoped table
      // (v76). Absence of a member_meds row = sentinel = nothing scheduled.
      const memberCheck = await dbClient.query(
        'SELECT 1 FROM member WHERE link = $1 AND tenant_id = $2',
        [memberLink, tenantId]
      );
      if (!memberCheck.rows.length) return res.status(404).json({ error: 'Member not found' });

      const medsRow = await dbClient.query(
        'SELECT meds_next_due FROM member_meds WHERE member_link = $1',
        [memberLink]
      );

      const todayBillEpoch = platformToday();
      const medsDate = medsRow.rows.length ? medsRow.rows[0].meds_next_due : SENTINEL_MEDS_NEXT_DUE;

      if (medsDate > todayBillEpoch) {
        return res.json({ checked: true, due: false, meds_next_due: medsDate });
      }

      // Due — process
      const result = await processMedsForMember(ctx, memberLink, tenantId);
      return res.json({ checked: true, due: true, ...result });
    } catch (e) {
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });

  // GET /v1/meds/member/:memberLink — full MEDS status for a single member (all cadenced items)
  //
  // :memberLink in the route is actually the public membership_number (per the
  // /v1/member/:id/* convention used elsewhere). The CHAR(5) member.link used by
  // the join queries is internal storage. The MEDS endpoint had been passing the
  // membership_number directly into the member_link comparisons, so the
  // subqueries never matched any rows and everything came back as
  // "never_completed" — even for members who had completed surveys (e.g. Grace
  // Newfield #46). resolveMember() converts membership_number → internal link.
  app.get('/v1/meds/member/:memberLink', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const membershipNumber = req.params.memberLink;
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const memberRec = await resolveMember(membershipNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });
      const memberLink = memberRec.link;

      const now = new Date();
      const items = [];

      // Surveys with cadence
      const surveys = await dbClient.query(
        `SELECT s.survey_code, s.survey_name, s.cadence_days,
                (SELECT MAX(ms.end_ts) FROM member_survey ms WHERE ms.member_link = $1 AND ms.survey_link = s.link AND ms.end_ts IS NOT NULL) as last_completed_ts
         FROM survey s WHERE s.tenant_id = $2 AND s.status = 'A' AND s.cadence_days IS NOT NULL AND s.cadence_days > 0`,
        [memberLink, tenantId]
      );
      for (const s of surveys.rows) {
        const item = { type: 'survey', code: s.survey_code, name: s.survey_name, cadence_days: s.cadence_days };
        if (!s.last_completed_ts) {
          item.status = 'never_completed';
          item.last_completed = null;
          item.next_due = null;
          item.days_overdue = null;
        } else {
          const lastDate = billEpochToDate(s.last_completed_ts);
          const nextDue = new Date(lastDate);
          nextDue.setDate(nextDue.getDate() + s.cadence_days);
          item.last_completed = lastDate.toISOString();
          item.next_due = nextDue.toISOString();
          const diffDays = Math.floor((now - nextDue) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            item.status = 'overdue';
            item.days_overdue = diffDays;
          } else if (diffDays > -3) {
            item.status = 'due_soon';
            item.days_until_due = Math.abs(diffDays);
          } else {
            item.status = 'current';
            item.days_until_due = Math.abs(diffDays);
          }
        }
        items.push(item);
      }

      // Compliance items with cadence
      const compliance = await dbClient.query(
        `SELECT mc.member_compliance_id, ci.item_code, ci.item_name, mc.cadence_days,
                (SELECT MAX(cr.result_date) FROM compliance_result cr WHERE cr.member_compliance_id = mc.member_compliance_id) as last_result_date
         FROM member_compliance mc
         JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
         WHERE mc.member_link = $1 AND mc.tenant_id = $2 AND mc.status = 'active' AND mc.cadence_days IS NOT NULL AND mc.cadence_days > 0`,
        [memberLink, tenantId]
      );
      for (const c of compliance.rows) {
        const item = { type: 'compliance', code: c.item_code, name: c.item_name, cadence_days: c.cadence_days };
        if (!c.last_result_date) {
          item.status = 'never_completed';
          item.last_completed = null;
          item.next_due = null;
          item.days_overdue = null;
        } else {
          const lastDate = moleculeIntToDate(c.last_result_date);
          const nextDue = new Date(lastDate);
          nextDue.setDate(nextDue.getDate() + c.cadence_days);
          item.last_completed = lastDate.toISOString();
          item.next_due = nextDue.toISOString();
          const diffDays = Math.floor((now - nextDue) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            item.status = 'overdue';
            item.days_overdue = diffDays;
          } else if (diffDays > -3) {
            item.status = 'due_soon';
            item.days_until_due = Math.abs(diffDays);
          } else {
            item.status = 'current';
            item.days_until_due = Math.abs(diffDays);
          }
        }
        items.push(item);
      }

      // Sort: overdue first, then due_soon, then never_completed, then current
      const order = { overdue: 0, due_soon: 1, never_completed: 2, current: 3 };
      items.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

      // Echo the membership_number the caller passed in (preserves API
      // contract — pre-fix the field was the route param, which callers
      // used as a public-id passthrough).
      res.json({ member_link: membershipNumber, items });
    } catch (e) {
      console.error(`MEDS member status error for ${membershipNumber}:`, e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /v1/meds/seed — calculate next-due for all members in a tenant (one-time init).
  // Writes into member_meds (v76: previously member.meds_next_due column).
  app.post('/v1/meds/seed', async (req, res) => {
    const dbClient = ctx.getDbClient();
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const members = await dbClient.query(
        'SELECT link FROM member WHERE tenant_id = $1 AND is_active = TRUE',
        [tenantId]
      );

      // FILTER_MEMBER_LIST custauth hook
      const custauth = await getCustauth(tenantId);
      const filtered = await custauth('FILTER_MEMBER_LIST', members.rows, { tenantId, db: dbClient });

      let seeded = 0;
      for (const row of filtered) {
        await calculateMedsNextDue(ctx, row.link, tenantId);
        seeded++;
      }

      res.json({ seeded, tenant_id: tenantId });
    } catch (e) {
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });

  // GET /v1/meds/summary — dashboard summary of overdue members
  app.get('/v1/meds/summary', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const todayBillEpoch = platformToday();

      // Get all overdue members (meds_next_due <= today) — v76: JOIN member_meds.
      const result = await dbClient.query(
        `SELECT m.link, m.fname, m.lname, m.membership_number, mm.meds_next_due
           FROM member m
           JOIN member_meds mm ON mm.member_link = m.link
          WHERE m.tenant_id = $1 AND m.is_active = TRUE AND mm.meds_next_due <= $2
          ORDER BY mm.meds_next_due ASC`,
        [tenantId, todayBillEpoch]
      );

      // For each overdue member, find what's overdue
      const overdueMembers = [];
      for (const m of result.rows) {
        const items = [];

        // Check surveys
        const surveys = await dbClient.query(
          `SELECT s.survey_code, s.survey_name, s.cadence_days,
                  (SELECT MAX(ms.end_ts) FROM member_survey ms WHERE ms.member_link = $1 AND ms.survey_link = s.link AND ms.end_ts IS NOT NULL) as last_completed_ts
           FROM survey s WHERE s.tenant_id = $2 AND s.status = 'A' AND s.cadence_days IS NOT NULL AND s.cadence_days > 0`,
          [m.link, tenantId]
        );
        for (const s of surveys.rows) {
          if (!s.last_completed_ts) {
            items.push({ type: 'survey', code: s.survey_code, name: s.survey_name, status: 'never_completed' });
          } else {
            const lastDate = billEpochToDate(s.last_completed_ts);
            const nextDue = new Date(lastDate);
            nextDue.setDate(nextDue.getDate() + s.cadence_days);
            if (nextDue <= new Date()) {
              const daysOverdue = Math.floor((new Date() - nextDue) / (1000 * 60 * 60 * 24));
              items.push({ type: 'survey', code: s.survey_code, name: s.survey_name, days_overdue: daysOverdue });
            }
          }
        }

        // Check compliance items
        const compliance = await dbClient.query(
          `SELECT mc.member_compliance_id, ci.item_code, ci.item_name, mc.cadence_days,
                  (SELECT MAX(cr.result_date) FROM compliance_result cr WHERE cr.member_compliance_id = mc.member_compliance_id) as last_result_date
           FROM member_compliance mc
           JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
           WHERE mc.member_link = $1 AND mc.tenant_id = $2 AND mc.status = 'active' AND mc.cadence_days IS NOT NULL AND mc.cadence_days > 0`,
          [m.link, tenantId]
        );
        for (const c of compliance.rows) {
          if (!c.last_result_date) {
            items.push({ type: 'compliance', code: c.item_code, name: c.item_name, status: 'never_completed' });
          } else {
            const lastDate = moleculeIntToDate(c.last_result_date);
            const nextDue = new Date(lastDate);
            nextDue.setDate(nextDue.getDate() + c.cadence_days);
            if (nextDue <= new Date()) {
              const daysOverdue = Math.floor((new Date() - nextDue) / (1000 * 60 * 60 * 24));
              items.push({ type: 'compliance', code: c.item_code, name: c.item_name, days_overdue: daysOverdue });
            }
          }
        }

        if (items.length > 0) {
          overdueMembers.push({
            link: m.link,
            name: `${m.fname} ${m.lname}`.trim(),
            membership_number: m.membership_number,
            overdue_items: items,
            overdue_count: items.length
          });
        }
      }

      res.json({
        total_overdue_members: overdueMembers.length,
        total_overdue_items: overdueMembers.reduce((sum, m) => sum + m.overdue_count, 0),
        members: overdueMembers
      });
    } catch (e) {
      console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message });
    }
  });
}

/**
 * Register scheduled-job handlers. Called from boot(ctx) so the
 * scheduler tick can see them.
 */
export function registerJobs(ctx) {
  const { registerJobHandler } = ctx;
  const { platformToday } = ctx.dates;

  // --- MEDS Scheduled Job Handler ---
  registerJobHandler('MEDS', async (tenantId, scheduledJobId, db) => {
    const todayBillEpoch = platformToday();

    // Find all members with meds_next_due <= today (v76: scan member_meds, JOIN
    // member for is_active check). Members at sentinel have no member_meds row,
    // so they're naturally excluded — and Delta members (no MEDS workflow ever
    // runs for them) never have a row at all.
    const dueMembers = await db.query(
      `SELECT mm.member_link AS link
         FROM member_meds mm
         JOIN member m ON m.link = mm.member_link
        WHERE mm.tenant_id = $1
          AND mm.meds_next_due <= $2
          AND m.is_active = TRUE`,
      [tenantId, todayBillEpoch]
    );

    // FILTER_MEMBER_LIST custauth hook
    const custauth = await ctx.getCustauth(tenantId);
    const filteredMembers = await custauth('FILTER_MEMBER_LIST', dueMembers.rows, { tenantId, db });

    let totalAnalyzed = 0;
    let totalProcessed = 0;
    let totalFlagged = 0;

    for (const row of filteredMembers) {
      const result = await processMedsForMember(ctx, row.link, tenantId);
      totalAnalyzed += result.analyzed;
      totalProcessed += result.processed;
      totalFlagged += result.flagged;
    }

    return { analyzed: dueMembers.rows.length, processed: totalProcessed, flagged: totalFlagged };
  });
}

/**
 * Calculate the next MEDS due date for a member.
 * Scans all surveys and compliance items, finds the earliest next-due date,
 * upserts it into member_meds. Called after processing or event completion.
 * (v76: storage moved off member.meds_next_due into scoped member_meds table.)
 *
 * If the computed date is today or past, automatically calls processMedsForMember.
 *
 * @param {object} ctx - vertical ctx object
 * @param {string} memberLink - 5-byte member PK
 * @param {number} tenantId
 * @param {object} client - DB client (must be in a transaction if caller wants atomicity)
 */
async function calculateMedsNextDue(ctx, memberLink, tenantId, client) {
  const db = client || ctx.getDbClient();
  if (!db) return;

  const SENTINEL_2137 = (() => {
    const epoch = new Date(1959, 11, 3);
    const target = new Date(2137, 0, 1);
    return Math.floor((target - epoch) / (1000 * 60 * 60 * 24)) - 32768;
  })();

  const todayBillEpoch = ctx.dates.platformToday();

  let earliestDue = SENTINEL_2137;

  try {
    // --- Survey cadences ---
    // Find all active surveys for this tenant with a cadence
    const surveys = await db.query(
      `SELECT s.link AS survey_link, s.cadence_days
       FROM survey s
       WHERE s.tenant_id = $1 AND s.status = 'A' AND s.cadence_days IS NOT NULL AND s.cadence_days > 0`,
      [tenantId]
    );

    for (const survey of surveys.rows) {
      // Find most recent completed survey for this member
      const lastSurvey = await db.query(
        `SELECT end_ts FROM member_survey
         WHERE member_link = $1 AND survey_link = $2 AND end_ts IS NOT NULL
         ORDER BY end_ts DESC LIMIT 1`,
        [memberLink, survey.survey_link]
      );

      let nextDue;
      if (!lastSurvey.rows.length) {
        // Never taken — due now
        nextDue = todayBillEpoch;
      } else {
        // Convert Unix timestamp to Bill epoch date, add cadence days
        const lastDate = ctx.dates.billEpochToDate(lastSurvey.rows[0].end_ts);
        const lastBillEpoch = ctx.dates.dateToMoleculeInt(lastDate);
        nextDue = lastBillEpoch + survey.cadence_days;
      }

      if (nextDue < earliestDue) earliestDue = nextDue;
    }

    // --- Compliance item cadences ---
    const compItems = await db.query(
      `SELECT mc.member_compliance_id, mc.cadence_days
       FROM member_compliance mc
       WHERE mc.member_link = $1 AND mc.tenant_id = $2 AND mc.status = 'active'
         AND mc.schedule_mode = 'cadence'
         AND mc.cadence_days IS NOT NULL AND mc.cadence_days > 0`,
      [memberLink, tenantId]
    );

    for (const ci of compItems.rows) {
      const lastResult = await db.query(
        `SELECT result_date FROM compliance_result
         WHERE member_compliance_id = $1 AND voided_ts IS NULL
         ORDER BY result_date DESC LIMIT 1`,
        [ci.member_compliance_id]
      );

      let nextDue;
      if (!lastResult.rows.length) {
        // Never completed — due now
        nextDue = todayBillEpoch;
      } else {
        nextDue = lastResult.rows[0].result_date + ci.cadence_days;
      }

      if (nextDue < earliestDue) earliestDue = nextDue;
    }

    // --- Random-scheduled compliance items (system picks dates) ---
    // The scheduled date itself is the "due" date; if it has no satisfying result, it's considered due.
    const randomItems = await db.query(
      `SELECT mc.member_compliance_id, mc.next_scheduled_date
       FROM member_compliance mc
       WHERE mc.member_link = $1 AND mc.tenant_id = $2 AND mc.status = 'active'
         AND mc.schedule_mode = 'random'
         AND mc.next_scheduled_date IS NOT NULL`,
      [memberLink, tenantId]
    );
    for (const ri of randomItems.rows) {
      // If a non-voided result exists on/after the scheduled date, this one is satisfied — skip
      const satisfied = await db.query(
        `SELECT 1 FROM compliance_result
         WHERE member_compliance_id = $1 AND voided_ts IS NULL AND result_date >= $2
         LIMIT 1`,
        [ri.member_compliance_id, ri.next_scheduled_date]
      );
      if (satisfied.rows.length) continue;

      if (ri.next_scheduled_date < earliestDue) earliestDue = ri.next_scheduled_date;
    }

    // Write the date into the scoped member_meds table (v76).
    // Sentinel = "no MEDS scheduled" is represented by absence of a row, so
    // delete on sentinel; upsert otherwise. Keeps the bulk-scan in the MEDS
    // job tight by not carrying inert rows.
    if (earliestDue === SENTINEL_MEDS_NEXT_DUE) {
      await db.query(`DELETE FROM member_meds WHERE member_link = $1`, [memberLink]);
    } else {
      await db.query(
        `INSERT INTO member_meds (member_link, tenant_id, meds_next_due)
              VALUES ($1, $2, $3)
         ON CONFLICT (member_link)
            DO UPDATE SET tenant_id = EXCLUDED.tenant_id,
                          meds_next_due = EXCLUDED.meds_next_due`,
        [memberLink, tenantId, earliestDue]
      );
    }

    // If due today or past, process immediately
    if (earliestDue <= todayBillEpoch) {
      await processMedsForMember(ctx, memberLink, tenantId, client);
    }

  } catch (e) {
    console.error(`calculateMedsNextDue error for member ${memberLink}:`, e.message);
  }
}

/**
 * Process all overdue MEDS items for a single member.
 * Locks the member record, checks each survey and compliance item against cadence,
 * fires notifications for overdue items, creates registry items for consecutive misses.
 * When done, calls calculateMedsNextDue to set next date.
 *
 * @param {object} ctx - vertical ctx object
 * @param {string} memberLink - 5-byte member PK
 * @param {number} tenantId
 * @param {object} [externalClient] - if provided, caller owns the transaction
 */
async function processMedsForMember(ctx, memberLink, tenantId, externalClient) {
  const dbClient = ctx.getDbClient();
  if (!dbClient) return { analyzed: 0, processed: 0, flagged: 0 };

  const { billEpochToDate, dateToMoleculeInt, platformToday, formatDateLocal } = ctx.dates;
  const { debugLog } = ctx.log;
  const { fireNotificationEvent, externalActionHandlers } = ctx;

  const pool = dbClient;  // Use the pool for a dedicated client
  let client;
  let ownsTransaction = false;

  if (externalClient) {
    client = externalClient;
  } else {
    client = await pool.connect ? await pool.connect() : pool;
    ownsTransaction = true;
  }

  const todayBillEpoch = platformToday();
  let analyzed = 0;
  let processed = 0;
  let flagged = 0;
  const results = [];

  try {
    if (ownsTransaction) await client.query('BEGIN');

    // Lock member record
    await client.query('SELECT link FROM member WHERE link = $1 FOR UPDATE', [memberLink]);

    // Get member name for notifications
    const memberResult = await client.query(
      'SELECT fname, lname, membership_number FROM member WHERE link = $1',
      [memberLink]
    );
    const member = memberResult.rows[0];
    const memberName = member ? `${member.fname || ''} ${member.lname || ''}`.trim() : 'Unknown';

    // --- Check surveys ---
    const surveys = await client.query(
      `SELECT s.link AS survey_link, s.survey_code, s.survey_name, s.cadence_days
       FROM survey s
       WHERE s.tenant_id = $1 AND s.status = 'A' AND s.cadence_days IS NOT NULL AND s.cadence_days > 0`,
      [tenantId]
    );

    for (const survey of surveys.rows) {
      analyzed++;

      const lastSurvey = await client.query(
        `SELECT end_ts FROM member_survey
         WHERE member_link = $1 AND survey_link = $2 AND end_ts IS NOT NULL
         ORDER BY end_ts DESC LIMIT 1`,
        [memberLink, survey.survey_link]
      );

      let nextDue;
      if (!lastSurvey.rows.length) {
        nextDue = todayBillEpoch; // Never taken
      } else {
        const lastDate = billEpochToDate(lastSurvey.rows[0].end_ts);
        const lastBillEpoch = dateToMoleculeInt(lastDate);
        nextDue = lastBillEpoch + survey.cadence_days;
      }

      if (nextDue > todayBillEpoch) continue; // Not due yet

      processed++;
      const daysOverdue = todayBillEpoch - nextDue;

      // Count consecutive misses (how many cadence periods overdue)
      const consecutiveMisses = Math.floor(daysOverdue / survey.cadence_days) + 1;

      // Fire notification
      await fireNotificationEvent('MEDS_SURVEY_OVERDUE', tenantId, {
        memberLink,
        memberName,
        detail: `${survey.survey_name} overdue by ${daysOverdue} day(s) (${consecutiveMisses} consecutive miss${consecutiveMisses > 1 ? 'es' : ''})`,
        sourcePage: 'meds'
      }, client);
      flagged++;
      results.push({ type: 'survey', code: survey.survey_code, name: survey.survey_name, days_overdue: daysOverdue, consecutive_misses: consecutiveMisses });

      // Create MISSED_SURVEY registry item on first detection (dedup: skip if one already open)
      try {
        const existingMissed = await client.query(
          `SELECT 1 FROM stability_registry
           WHERE member_link = $1 AND tenant_id = $2 AND source_stream = 'MEDS' AND status = 'O'
           LIMIT 1`,
          [memberLink, tenantId]
        );
        if (!existingMissed.rows.length) {
          const activityDate = formatDateLocal(new Date());
          await externalActionHandlers.createRegistryItem({
            memberLink, tenantId, activityDate,
            actionCode: 'SR_YELLOW',
            resultDescription: `Missed survey: ${survey.survey_name} overdue by ${daysOverdue} day(s) — MEDS detection`,
            activityData: { DOMINANT_DRIVER: 'MEDS', SOURCE_STREAM: 'MEDS' },
            client
          });
          debugLog(() => `  📋 MISSED_SURVEY registry item created for member ${memberLink} (${survey.survey_name})`);
        }
      } catch (e) {
        console.error(`MEDS: MISSED_SURVEY registry creation failed for member ${memberLink}:`, e.message);
      }

      // If 3+ consecutive misses, escalate notification
      if (consecutiveMisses >= 3) {
        await fireNotificationEvent('MEDS_CONSECUTIVE_MISS', tenantId, {
          memberLink,
          memberName,
          detail: `${survey.survey_name}: ${consecutiveMisses} consecutive missed assessments`,
          sourcePage: 'meds'
        }, client);
      }
    }

    // --- Check cadenced compliance items ---
    const compItems = await client.query(
      `SELECT mc.member_compliance_id, mc.cadence_days, ci.item_code, ci.item_name
       FROM member_compliance mc
       JOIN compliance_item ci ON mc.compliance_item_id = ci.compliance_item_id
       WHERE mc.member_link = $1 AND mc.tenant_id = $2 AND mc.status = 'active'
         AND mc.schedule_mode = 'cadence'
         AND mc.cadence_days IS NOT NULL AND mc.cadence_days > 0`,
      [memberLink, tenantId]
    );

    for (const ci of compItems.rows) {
      analyzed++;

      const lastResult = await client.query(
        `SELECT result_date FROM compliance_result
         WHERE member_compliance_id = $1 AND voided_ts IS NULL
         ORDER BY result_date DESC LIMIT 1`,
        [ci.member_compliance_id]
      );

      let nextDue;
      if (!lastResult.rows.length) {
        nextDue = todayBillEpoch; // Never completed
      } else {
        nextDue = lastResult.rows[0].result_date + ci.cadence_days;
      }

      if (nextDue > todayBillEpoch) continue; // Not due yet

      processed++;
      const daysOverdue = todayBillEpoch - nextDue;
      const consecutiveMisses = Math.floor(daysOverdue / ci.cadence_days) + 1;

      await fireNotificationEvent('MEDS_COMPLIANCE_OVERDUE', tenantId, {
        memberLink,
        memberName,
        detail: `${ci.item_name} overdue by ${daysOverdue} day(s) (${consecutiveMisses} consecutive miss${consecutiveMisses > 1 ? 'es' : ''})`,
        sourcePage: 'meds'
      }, client);
      flagged++;
      results.push({ type: 'compliance', code: ci.item_code, name: ci.item_name, days_overdue: daysOverdue, consecutive_misses: consecutiveMisses });

      if (consecutiveMisses >= 3) {
        await fireNotificationEvent('MEDS_CONSECUTIVE_MISS', tenantId, {
          memberLink,
          memberName,
          detail: `${ci.item_name}: ${consecutiveMisses} consecutive missed events`,
          sourcePage: 'meds'
        }, client);
      }
    }

    // --- Check random-scheduled compliance items (system picks the date) ---
    // Flag as missed when next_scheduled_date has passed AND no non-voided result recorded on/after that date.
    const randomItems = await client.query(
      `SELECT mc.member_compliance_id, mc.next_scheduled_date, ci.item_code, ci.item_name
       FROM member_compliance mc
       JOIN compliance_item ci ON mc.compliance_item_id = ci.compliance_item_id
       WHERE mc.member_link = $1 AND mc.tenant_id = $2 AND mc.status = 'active'
         AND mc.schedule_mode = 'random'
         AND mc.next_scheduled_date IS NOT NULL
         AND mc.next_scheduled_date <= $3`,
      [memberLink, tenantId, todayBillEpoch]
    );

    for (const ri of randomItems.rows) {
      analyzed++;

      // Was there a non-voided result recorded on or after the scheduled date?
      const satisfied = await client.query(
        `SELECT 1 FROM compliance_result
         WHERE member_compliance_id = $1 AND voided_ts IS NULL AND result_date >= $2
         LIMIT 1`,
        [ri.member_compliance_id, ri.next_scheduled_date]
      );
      if (satisfied.rows.length) continue; // Already satisfied

      processed++;
      const daysOverdue = todayBillEpoch - ri.next_scheduled_date;

      await fireNotificationEvent('MEDS_COMPLIANCE_OVERDUE', tenantId, {
        memberLink,
        memberName,
        detail: `${ri.item_name} (random-scheduled) overdue by ${daysOverdue} day(s)`,
        sourcePage: 'meds'
      }, client);
      flagged++;
      results.push({ type: 'compliance_random', code: ri.item_code, name: ri.item_name, days_overdue: daysOverdue, scheduled_date: ri.next_scheduled_date });
    }

    // Recalculate next due date (but don't recurse — skip the auto-process check)
    // We just processed, so update the date directly
    let earliestDue = (() => {
      const epoch = new Date(1959, 11, 3);
      const target = new Date(2137, 0, 1);
      return Math.floor((target - epoch) / (1000 * 60 * 60 * 24)) - 32768;
    })();

    // Recalc from surveys
    for (const survey of surveys.rows) {
      const lastSurvey = await client.query(
        `SELECT end_ts FROM member_survey
         WHERE member_link = $1 AND survey_link = $2 AND end_ts IS NOT NULL
         ORDER BY end_ts DESC LIMIT 1`,
        [memberLink, survey.survey_link]
      );
      let nextDue;
      if (!lastSurvey.rows.length) {
        nextDue = todayBillEpoch + survey.cadence_days; // Just flagged, next check is one cadence from now
      } else {
        const lastDate = billEpochToDate(lastSurvey.rows[0].end_ts);
        nextDue = dateToMoleculeInt(lastDate) + survey.cadence_days;
        // If still overdue, next check is tomorrow (don't re-flag same day)
        if (nextDue <= todayBillEpoch) nextDue = todayBillEpoch + 1;
      }
      if (nextDue < earliestDue) earliestDue = nextDue;
    }

    // Recalc from compliance
    for (const ci of compItems.rows) {
      const lastResult = await client.query(
        `SELECT result_date FROM compliance_result
         WHERE member_compliance_id = $1
         ORDER BY result_date DESC LIMIT 1`,
        [ci.member_compliance_id]
      );
      let nextDue;
      if (!lastResult.rows.length) {
        nextDue = todayBillEpoch + ci.cadence_days;
      } else {
        nextDue = lastResult.rows[0].result_date + ci.cadence_days;
        if (nextDue <= todayBillEpoch) nextDue = todayBillEpoch + 1;
      }
      if (nextDue < earliestDue) earliestDue = nextDue;
    }

    // v76: write to scoped member_meds table; absence of row = sentinel.
    if (earliestDue === SENTINEL_MEDS_NEXT_DUE) {
      await client.query(`DELETE FROM member_meds WHERE member_link = $1`, [memberLink]);
    } else {
      await client.query(
        `INSERT INTO member_meds (member_link, tenant_id, meds_next_due)
              VALUES ($1, $2, $3)
         ON CONFLICT (member_link)
            DO UPDATE SET tenant_id = EXCLUDED.tenant_id,
                          meds_next_due = EXCLUDED.meds_next_due`,
        [memberLink, tenantId, earliestDue]
      );
    }

    if (ownsTransaction) await client.query('COMMIT');

  } catch (e) {
    if (ownsTransaction) await client.query('ROLLBACK');
    console.error(`processMedsForMember error for ${memberLink}:`, e.message);
  } finally {
    if (ownsTransaction && client.release) client.release();
  }

  return { analyzed, processed, flagged, results };
}

export default { register, registerJobs };
