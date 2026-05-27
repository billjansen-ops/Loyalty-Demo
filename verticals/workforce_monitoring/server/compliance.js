/**
 * Workforce Monitoring — Compliance endpoints + scheduled jobs.
 *
 * Phase 3 of the Insight server extraction. Moved from pointers.js
 * (formerly lines 27486–27831 + the RANDOM_DRUG_TEST / DRUG_TEST_MISSED
 * job handlers). See docs/INSIGHT_EXTRACTION_DESIGN.md.
 *
 * The 9 endpoints + 2 job handlers are behavior-preserved from the
 * original. The only intentional change vs. the original is at the
 * DRUG_TEST_MISSED link allocation: the source had a raw-SQL
 * UPDATE link_tank ... RETURNING next_link - 1 pattern, which
 * violates the platform rule "never allocate links with raw SQL —
 * always use getNextLink()". Swapped to ctx.getNextLink while we're
 * already in this file; same semantics, removes one anti-pattern.
 *
 * Audit-helper decision (Design Decision 4): pass-through. This file
 * uses ctx.getDbClient() for its audit-shaped writes — same shape
 * pointers.js used. Revisit a shared helper after Phase 4/6 reveal
 * whether the audit shapes diverge enough to justify it.
 */

export function register(app, ctx) {
  const { resolveMember, getNextLink, createAccrualActivity, getCustauth, caches } = ctx;
  const { platformToday, platformTodayStr, moleculeIntToDate, formatDateLocal } = ctx.dates;
  const { debugLog } = ctx.log;

  // GET /v1/compliance/member/:membershipNumber — get physician's active compliance items with statuses
  app.get('/v1/compliance/member/:membershipNumber', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const memberRec = await resolveMember(req.params.membershipNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });

      // Get active compliance items for this member with all valid statuses
      const result = await dbClient.query(`
        SELECT mc.member_compliance_id, mc.cadence_type, mc.cadence_days, mc.status AS mc_status,
               ci.compliance_item_id, ci.item_code, ci.item_name, ci.weight,
               cis.status_id, cis.status_code, cis.score, cis.is_sentinel, cis.sort_order
        FROM member_compliance mc
        JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
        JOIN compliance_item_status cis ON cis.compliance_item_id = ci.compliance_item_id
        WHERE mc.member_link = $1 AND mc.status = 'active' AND ci.status = 'active'
        ORDER BY ci.compliance_item_id, cis.sort_order
      `, [memberRec.link]);

      // Group by compliance item
      const items = {};
      for (const row of result.rows) {
        if (!items[row.compliance_item_id]) {
          items[row.compliance_item_id] = {
            member_compliance_id: row.member_compliance_id,
            compliance_item_id: row.compliance_item_id,
            item_code: row.item_code,
            item_name: row.item_name,
            weight: parseFloat(row.weight),
            cadence_type: row.cadence_type,
            cadence_days: row.cadence_days,
            statuses: []
          };
        }
        items[row.compliance_item_id].statuses.push({
          status_id: row.status_id,
          status_code: row.status_code,
          score: row.score,
          is_sentinel: row.is_sentinel
        });
      }

      res.json(Object.values(items));
    } catch (error) {
      console.error('Error loading compliance items:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/compliance/member/:membershipNumber/history — compliance event history
  app.get('/v1/compliance/member/:membershipNumber/history', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const memberRec = await resolveMember(req.params.membershipNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });

      const result = await dbClient.query(`
        SELECT cr.link, cr.result_date AS result_date_int, cr.notes,
               ci.item_code, ci.item_name,
               cis.status_code, cis.score, cis.is_sentinel,
               mc.cadence_type, mc.cadence_days
        FROM compliance_result cr
        JOIN member_compliance mc ON mc.member_compliance_id = cr.member_compliance_id
        JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
        JOIN compliance_item_status cis ON cis.status_id = cr.status_id
        WHERE mc.member_link = $1 AND cr.tenant_id = $2
        ORDER BY cr.result_date DESC, cr.link DESC
      `, [memberRec.link, tenantId]);

      // Convert Bill epoch dates to YYYY-MM-DD strings
      const rows = result.rows.map(r => ({
        ...r,
        result_date: formatDateLocal(moleculeIntToDate(r.result_date_int))
      }));

      res.json(rows);
    } catch (error) {
      console.error('Error loading compliance history:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/compliance/entry — submit a compliance event
  // Creates compliance_result record + accrual activity with COMP_RESULT molecule
  app.post('/v1/compliance/entry', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    const { membership_number, member_compliance_id, status_id, notes } = req.body;
    if (!membership_number || !member_compliance_id || !status_id) {
      return res.status(400).json({ error: 'membership_number, member_compliance_id, and status_id required' });
    }

    const client = await dbClient.connect();
    try {
      await client.query('BEGIN');

      // Resolve member
      const memberRec = await resolveMember(membership_number, tenantId);
      if (!memberRec) { await client.query('ROLLBACK'); client.release(); return res.status(404).json({ error: 'Member not found' }); }

      // Verify member_compliance belongs to this member
      const mcResult = await client.query(`
        SELECT mc.member_compliance_id, mc.member_link, ci.item_code, ci.item_name
        FROM member_compliance mc
        JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
        WHERE mc.member_compliance_id = $1 AND mc.tenant_id = $2
      `, [member_compliance_id, tenantId]);
      if (!mcResult.rows.length) { await client.query('ROLLBACK'); client.release(); return res.status(404).json({ error: 'Compliance item not found' }); }
      if (mcResult.rows[0].member_link !== memberRec.link) { await client.query('ROLLBACK'); client.release(); return res.status(400).json({ error: 'Compliance item does not belong to this member' }); }

      // Verify status_id is valid for this compliance item
      const statusResult = await client.query(`
        SELECT cis.status_id, cis.status_code, cis.score, cis.is_sentinel,
               ci.item_code
        FROM compliance_item_status cis
        JOIN compliance_item ci ON ci.compliance_item_id = cis.compliance_item_id
        JOIN member_compliance mc ON mc.compliance_item_id = ci.compliance_item_id
        WHERE cis.status_id = $1 AND mc.member_compliance_id = $2
      `, [status_id, member_compliance_id]);
      if (!statusResult.rows.length) { await client.query('ROLLBACK'); client.release(); return res.status(400).json({ error: 'Invalid status for this compliance item' }); }
      const statusRow = statusResult.rows[0];

      // Create compliance_result record
      const compLink = await getNextLink(tenantId, 'compliance_result');
      const resultDateInt = platformToday();
      await client.query(`
        INSERT INTO compliance_result (link, member_compliance_id, status_id, result_date, notes, tenant_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [compLink, member_compliance_id, status_id, resultDateInt, notes || null, tenantId]);

      debugLog(() => `\n📋 Compliance entry: ${mcResult.rows[0].item_name} → ${statusRow.status_code} (score ${statusRow.score}) for member ${membership_number}, comp_result link=${compLink}`);

      // Create accrual activity
      const activityData = {
        activity_date: platformTodayStr(),
        base_points: statusRow.score,
        ACCRUAL_TYPE: 'COMP',
        COMP_RESULT: compLink
      };
      if (notes && notes.trim()) activityData.ACTIVITY_COMMENT = notes.trim();

      // Sentinel statuses hang a SIGNAL molecule so the promotion engine can fire
      if (statusRow.is_sentinel) {
        const sentinelSignalMap = {
          'CONFIRMED_POSITIVE': 'SENTINEL_POSITIVE',
          'REFUSED_TAMPERED':   'SENTINEL_REFUSED',
          'PROBATION_SUSPEND':  'SENTINEL_SUSPENDED'
        };
        const signalCode = sentinelSignalMap[statusRow.status_code];
        if (signalCode) {
          activityData.SIGNAL = signalCode;
          debugLog(() => `   🚨 Sentinel detected: hanging SIGNAL=${signalCode} on accrual`);
        }
      }

      const accrualResult = await createAccrualActivity(memberRec.link, activityData, tenantId);
      debugLog(() => `   ✅ Accrual created: link=${accrualResult.link}, points=${statusRow.score}`);

      await client.query('COMMIT');

      // Custauth POST_ACCRUAL hook — composite recalc after compliance entry
      try {
        const postCustauth = await getCustauth(tenantId);
        await postCustauth('POST_ACCRUAL', activityData, { tenantId, memberLink: memberRec.link, db: dbClient, accrualResult, ppiiWeights: caches.ppiiWeights.get(tenantId), ppsiSubdomainWeights: caches.ppsiSubdomainWeights.get(tenantId) });
      } catch (postErr) {
        console.error('POST_ACCRUAL custauth error (non-fatal):', postErr.message);
      }

      res.json({
        compliance_result_link: compLink,
        accrual_link: accrualResult.link,
        item_code: statusRow.item_code,
        status_code: statusRow.status_code,
        score: statusRow.score,
        is_sentinel: statusRow.is_sentinel
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating compliance entry:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // GET /v1/compliance/items — master list of compliance items for a tenant
  app.get('/v1/compliance/items', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const result = await dbClient.query(`
        SELECT compliance_item_id, item_code, item_name, weight, status, cadence_type, cadence_days
        FROM compliance_item
        WHERE tenant_id = $1 ${req.query.include_inactive === '1' ? '' : "AND status = 'active'"}
        ORDER BY compliance_item_id
      `, [tenantId]);
      res.json(result.rows);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/compliance/items — create a compliance item
  app.post('/v1/compliance/items', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { item_code, item_name, weight, cadence_type, cadence_days } = req.body;
    if (!item_code || !item_name) return res.status(400).json({ error: 'item_code and item_name required' });
    try {
      const result = await dbClient.query(`
        INSERT INTO compliance_item (tenant_id, item_code, item_name, weight, cadence_type, cadence_days)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [tenantId, item_code.toUpperCase(), item_name, weight || 0, cadence_type || 'monthly', cadence_days || 30]);
      res.json(result.rows[0]);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // PUT /v1/compliance/items/:id — update a compliance item
  app.put('/v1/compliance/items/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { item_name, weight, cadence_type, cadence_days, status } = req.body;
    try {
      const result = await dbClient.query(`
        UPDATE compliance_item
        SET item_name = COALESCE($1, item_name),
            weight = COALESCE($2, weight),
            cadence_type = COALESCE($3, cadence_type),
            cadence_days = COALESCE($4, cadence_days),
            status = COALESCE($5, status)
        WHERE compliance_item_id = $6 AND tenant_id = $7
        RETURNING *
      `, [item_name, weight, cadence_type, cadence_days, status, req.params.id, tenantId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
      res.json(result.rows[0]);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // PUT /v1/compliance/member/:membershipNumber/cadence/:memberComplianceId — update member's cadence override
  // Body: { cadence_type, cadence_days, schedule_mode }
  // schedule_mode: 'cadence' (default) | 'random' | 'undetermined'
  // When schedule_mode is 'random' or 'undetermined', cadence_days is cleared (null).
  app.put('/v1/compliance/member/:membershipNumber/cadence/:memberComplianceId', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { cadence_type, cadence_days, schedule_mode } = req.body;
    if (!cadence_type) return res.status(400).json({ error: 'cadence_type required' });
    const mode = schedule_mode || 'cadence';
    if (!['cadence', 'random', 'undetermined'].includes(mode)) {
      return res.status(400).json({ error: 'schedule_mode must be cadence, random, or undetermined' });
    }
    // For random/undetermined, clear cadence_days (no fixed interval)
    const daysToStore = mode === 'cadence' ? cadence_days : null;
    try {
      const result = await dbClient.query(`
        UPDATE member_compliance
        SET cadence_type = $1, cadence_days = $2, schedule_mode = $3
        WHERE member_compliance_id = $4 AND tenant_id = $5
        RETURNING *
      `, [cadence_type, daysToStore, mode, req.params.memberComplianceId, tenantId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Member compliance not found' });
      res.json(result.rows[0]);
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });

  // POST /v1/compliance/member/:membershipNumber/assign — bulk assign compliance items
  app.post('/v1/compliance/member/:membershipNumber/assign', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { items } = req.body;  // Array of { compliance_item_id }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array required' });
    }
    try {
      const memberRec = await resolveMember(req.params.membershipNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });

      const assigned = [];
      for (const item of items) {
        // Check if already assigned
        const existing = await dbClient.query(`
          SELECT member_compliance_id FROM member_compliance
          WHERE member_link = $1 AND compliance_item_id = $2 AND tenant_id = $3
        `, [memberRec.link, item.compliance_item_id, tenantId]);

        if (existing.rows.length > 0) {
          // Reactivate if inactive
          await dbClient.query(`
            UPDATE member_compliance SET status = 'active'
            WHERE member_compliance_id = $1
          `, [existing.rows[0].member_compliance_id]);
          assigned.push({ compliance_item_id: item.compliance_item_id, action: 'reactivated' });
        } else {
          // Copy cadence from the rule definition
          const ruleRow = await dbClient.query(`
            SELECT cadence_type, cadence_days FROM compliance_item WHERE compliance_item_id = $1
          `, [item.compliance_item_id]);
          const cType = ruleRow.rows[0]?.cadence_type || 'monthly';
          const cDays = ruleRow.rows[0]?.cadence_days || 30;
          const result = await dbClient.query(`
            INSERT INTO member_compliance (member_link, compliance_item_id, cadence_type, cadence_days, tenant_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING member_compliance_id
          `, [memberRec.link, item.compliance_item_id, cType, cDays, tenantId]);
          assigned.push({ compliance_item_id: item.compliance_item_id, member_compliance_id: result.rows[0].member_compliance_id, action: 'created' });
        }
      }
      res.json({ success: true, assigned });
    } catch (e) {
      console.error('Error assigning compliance items:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /v1/compliance/member/:membershipNumber/assign/:complianceItemId — remove compliance item from member
  app.delete('/v1/compliance/member/:membershipNumber/assign/:complianceItemId', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const memberRec = await resolveMember(req.params.membershipNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });

      await dbClient.query(`
        UPDATE member_compliance SET status = 'inactive'
        WHERE member_link = $1 AND compliance_item_id = $2 AND tenant_id = $3
      `, [memberRec.link, req.params.complianceItemId, tenantId]);
      res.json({ success: true });
    } catch (e) { console.error("Error in", req.method, req.path, ":", e); res.status(500).json({ error: e.message }); }
  });
}

/**
 * Register scheduled-job handlers. Called from boot(ctx) so the
 * scheduler tick can see them. See docs/INSIGHT_TOUCH_POINTS.md §7.
 */
export function registerJobs(ctx) {
  const { registerJobHandler, getNextLink, fireNotificationEvent } = ctx;
  const { platformToday } = ctx.dates;
  const { debugLog } = ctx.log;

  // ─── RANDOM DRUG TEST SELECTION (Daily 7 AM) ───────────────────────────────
  // For each member with a random-schedule drug test compliance item:
  //   - 1-in-7 chance of selection each day (baseline)
  //   - Minimum 2-day spacing: if last_selected_date was yesterday, skip.
  //   - Maximum 10-day gap: if days_since_selected >= 10, force selection.
  //   - When selected: set next_scheduled_date = today (MEDS detects missed if no result by 5 PM sweep)
  //   - Updates days_since_selected daily.
  registerJobHandler('RANDOM_DRUG_TEST', async (tenantId, scheduledJobId, db) => {
    const todayBillEpoch = platformToday();
    const yesterdayBillEpoch = todayBillEpoch - 1;

    // Get all random-mode drug test compliance items for active members
    const randomItems = await db.query(`
      SELECT mc.member_compliance_id, mc.member_link, mc.last_selected_date, mc.days_since_selected,
             ci.item_code, ci.item_name, m.fname, m.lname
      FROM member_compliance mc
      JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
      JOIN member m ON m.link = mc.member_link
      WHERE mc.tenant_id = $1 AND mc.status = 'active' AND mc.schedule_mode = 'random' AND m.is_active = TRUE
    `, [tenantId]);

    // Filter out clinicians
    const custauth = await ctx.getCustauth(tenantId);
    const filteredRows = await custauth('FILTER_MEMBER_LIST', randomItems.rows, { tenantId, db });

    let analyzed = 0, selected = 0, forced = 0;

    for (const item of filteredRows) {
      analyzed++;
      const daysSince = (item.days_since_selected || 0) + 1;
      const wasSelectedYesterday = item.last_selected_date === yesterdayBillEpoch;

      let isSelected = false;

      // Rule 3: force selection if 10+ days without (max-gap enforcement)
      if (daysSince >= 11) {
        isSelected = true;
        forced++;
      }
      // Rule 2: skip if selected yesterday (min 2-day spacing)
      else if (wasSelectedYesterday) {
        isSelected = false;
      }
      // Rule 1: 1-in-7 random chance
      else {
        const roll = Math.floor(Math.random() * 7) + 1; // 1-7
        isSelected = (roll === 1);
      }

      if (isSelected) {
        // Selected: set next_scheduled_date = today, reset counter
        await db.query(`
          UPDATE member_compliance SET next_scheduled_date = $1, last_selected_date = $1, days_since_selected = 0
          WHERE member_compliance_id = $2
        `, [todayBillEpoch, item.member_compliance_id]);
        selected++;
        debugLog(() => `  🎲 RANDOM_DRUG_TEST: ${item.fname} ${item.lname} SELECTED (${item.item_code})`);
      } else {
        // Not selected: increment counter
        await db.query(`
          UPDATE member_compliance SET days_since_selected = $1
          WHERE member_compliance_id = $2
        `, [daysSince, item.member_compliance_id]);
      }
    }

    return { analyzed, processed: selected, flagged: forced };
  });

  // ─── DRUG TEST MISSED SWEEP (Daily 5 PM) ────────────────────────────────────
  // If a participant was selected for a random drug test today (next_scheduled_date = today)
  // and no non-voided compliance_result exists with result_date = today, mark as MISSED.
  registerJobHandler('DRUG_TEST_MISSED', async (tenantId, scheduledJobId, db) => {
    const todayBillEpoch = platformToday();

    // Find all random items selected today with no result
    const pending = await db.query(`
      SELECT mc.member_compliance_id, mc.member_link, ci.item_code, ci.item_name,
             m.fname, m.lname, m.membership_number
      FROM member_compliance mc
      JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
      JOIN member m ON m.link = mc.member_link
      WHERE mc.tenant_id = $1 AND mc.schedule_mode = 'random'
        AND mc.next_scheduled_date = $2
        AND NOT EXISTS (
          SELECT 1 FROM compliance_result cr
          WHERE cr.member_compliance_id = mc.member_compliance_id
            AND cr.result_date = $2 AND cr.voided_ts IS NULL
        )
    `, [tenantId, todayBillEpoch]);

    let flagged = 0;

    for (const item of pending.rows) {
      // Look up the MISSED status for this compliance item type
      // Drug Test Completion → MISSED status
      const missedStatus = await db.query(`
        SELECT status_id FROM compliance_item_status
        WHERE compliance_item_id = (SELECT compliance_item_id FROM member_compliance WHERE member_compliance_id = $1)
          AND status_code = 'MISSED'
      `, [item.member_compliance_id]);

      if (missedStatus.rows.length) {
        // Allocate the result link via the platform helper (was raw link_tank
        // UPDATE in pointers.js — swapped to getNextLink during the Phase 3
        // move; same semantics, removes an anti-pattern).
        const resultLink = await getNextLink(tenantId, 'compliance_result');

        await db.query(`
          INSERT INTO compliance_result (link, member_compliance_id, status_id, tenant_id, result_date, notes)
          VALUES ($1, $2, $3, $4, $5, 'Auto-flagged: no specimen received by 5:00 PM cutoff')
        `, [resultLink, item.member_compliance_id, missedStatus.rows[0].status_id, tenantId, todayBillEpoch]);

        // Fire compliance overdue notification
        const memberName = `${item.fname} ${item.lname}`;
        await fireNotificationEvent('MEDS_COMPLIANCE_OVERDUE', tenantId, {
          memberLink: item.member_link,
          memberName,
          detail: `${item.item_name}: random drug test selected today — no specimen received by 5 PM cutoff`,
          sourcePage: 'meds'
        });

        flagged++;
        debugLog(() => `  ⚠️ DRUG_TEST_MISSED: ${item.fname} ${item.lname} — no specimen for ${item.item_code}`);
      }
    }

    return { analyzed: pending.rows.length, processed: pending.rows.length, flagged };
  });
}

export default { register, registerJobs };
