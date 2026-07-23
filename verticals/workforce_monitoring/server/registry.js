/**
 * Workforce Monitoring — Stability registry + follow-up endpoints,
 * the F1_T5 extended-card batch detection job, the createRegistryItem
 * external action handler, and the scheduleFollowups helper.
 *
 * Phase 6 moved the endpoint bodies and F1_T5 handler. Session 130
 * follow-up (the "this needs to be fixed" cleanup) moves
 * createRegistryItem + scheduleFollowups here too — they had been
 * stuck in pointers.js because they're called from the platform's
 * bonus/promotion engine external-action dispatch path. The fix
 * makes externalActionHandlers a registry that verticals populate
 * via ctx.registerExternalActionHandler at boot, same shape as the
 * existing ctx.registerJobHandler / ctx.registerCallback patterns.
 * After this cleanup, pointers.js owns zero healthcare-named code.
 *
 * Layout:
 *   - register(app, ctx)              — Express endpoints (Phase 6)
 *   - registerJobs(ctx)               — F1_T5 scheduled handler (Phase 6)
 *   - registerActionHandlers(ctx)     — createRegistryItem (Session 130)
 *   - scheduleFollowups (module-private, called only from
 *                       createRegistryItem)
 */

// ── scheduleFollowups (module-private) ──────────────────────────────
// Called only from createRegistryItem below. Reads followup_schedule
// (extended-card override wins, urgency fallback) and inserts one
// registry_followup row per matched step. Healthcare-specific by
// design — every table it touches (followup_schedule, registry_followup)
// is Insight-only.
async function scheduleFollowups(ctx, registryLink, tenantId, urgency, createdDate, client, extendedCard = null) {
  const db = client || ctx.getDbClient();

  let schedule = { rows: [] };
  if (extendedCard) {
    schedule = await db.query(
      `SELECT followup_type, offset_days
       FROM followup_schedule
       WHERE tenant_id = $1 AND extended_card = $2 AND is_active = true
       ORDER BY step_order`,
      [tenantId, extendedCard]
    );
  }
  if (schedule.rows.length === 0) {
    schedule = await db.query(
      `SELECT followup_type, offset_days
       FROM followup_schedule
       WHERE tenant_id = $1 AND urgency = $2 AND extended_card IS NULL AND is_active = true
       ORDER BY step_order`,
      [tenantId, urgency]
    );
  }

  for (const s of schedule.rows) {
    await db.query(
      `INSERT INTO registry_followup (registry_link, tenant_id, followup_type, scheduled_date)
       VALUES ($1, $2, $3, $4)`,
      [registryLink, tenantId, s.followup_type, createdDate + s.offset_days]
    );
  }
}

// ── createRegistryItem external action handler ────────────────────
// Registered with the platform's externalActionHandlers registry via
// registerActionHandlers(ctx) below. The platform's bonus/promotion
// engines dispatch to this handler by function_name when an
// external_result_action with function_name='createRegistryItem' fires.
// Direct internal callers (F1_T5 handler, MEDS, compliance) reach it
// the same way via ctx.externalActionHandlers.createRegistryItem.
function makeCreateRegistryItem(ctx) {
  const { getNextLink, fireNotificationEvent, logAudit, logPlatformError } = ctx;
  const { dateToMoleculeInt } = ctx.dates;
  const { debugLog } = ctx.log;

  return async function createRegistryItem(actionCtx) {
    const { memberLink, tenantId, activityDate, actionCode, resultDescription, activityData, client } = actionCtx;

    // Resolve urgency + sla from actionCtx (engine path passes both,
    // populated from external_result_action.urgency / sla_hours).
    // Direct internal callers (MEDS missed-survey, T5/T6/F1 escalations)
    // only pass actionCode — for those, look up the same columns from
    // the table. Final fallback YELLOW/72h shouldn't normally hit
    // unless the action row is missing the new columns (pre-v69 state).
    let urgency = actionCtx.urgency;
    let slaHours = actionCtx.slaHours;
    if (urgency == null || slaHours == null) {
      const db = client || ctx.getDbClient();
      const lookup = await db.query(
        `SELECT urgency, sla_hours FROM external_result_action
         WHERE tenant_id = $1 AND action_code = $2 AND is_active = true LIMIT 1`,
        [tenantId, actionCode]
      );
      if (lookup.rows.length > 0) {
        urgency = urgency ?? lookup.rows[0].urgency;
        slaHours = slaHours ?? lookup.rows[0].sla_hours;
      }
    }
    urgency = urgency || 'YELLOW';
    slaHours = (slaHours != null) ? slaHours : 72;
    const mapped = { urgency, sla: slaHours };

    const link = await getNextLink(tenantId, 'stability_registry');
    // Normalize activityDate — callers (bonus engine, promotion engine,
    // custauth direct calls) pass it either as a Date object (from
    // hydrateActivityDates) or a YYYY-MM-DD string.
    const activityDateAsDate = activityDate instanceof Date
      ? activityDate
      : new Date(String(activityDate).split('T')[0] + 'T00:00:00');
    const createdDate = dateToMoleculeInt(activityDateAsDate);
    const slaDeadline = new Date(Date.now() + mapped.sla * 3600000);

    // Extract dominant driver info from activityData (set by custauth POST_ACCRUAL)
    const dominantDriver = activityData?.DOMINANT_DRIVER || null;
    const dominantSubdomain = activityData?.DOMINANT_SUBDOMAIN || null;
    const protocolCard = activityData?.PROTOCOL_CARD || null;
    const extendedCard = activityData?.EXTENDED_CARD || null;
    const sourceStream = dominantDriver || 'COMPOSITE';

    await (client || ctx.getDbClient()).query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, sla_hours, sla_deadline, created_date, created_ts, status, dominant_driver, dominant_subdomain, protocol_card, extended_card)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'O', $11, $12, $13, $14)
    `, [link, memberLink, tenantId, mapped.urgency, sourceStream, actionCode, resultDescription || actionCode, mapped.sla, slaDeadline, createdDate, dominantDriver, dominantSubdomain, protocolCard, extendedCard]);

    // Audit log: record creation (user_id null for system-created items)
    await logAudit(tenantId, null, 'stability_registry', link, 'A');

    debugLog(() => `        📋 Registry item created: ${mapped.urgency} / ${actionCode} / link=${link} / driver=${dominantDriver || 'none'} / card=${protocolCard || 'none'} / ext=${extendedCard || 'none'}`);

    // Auto-schedule follow-up checks if dominant driver was identified
    if (dominantDriver && protocolCard) {
      try {
        await scheduleFollowups(ctx, link, tenantId, mapped.urgency, createdDate, client, extendedCard);
        debugLog(() => `        📅 Follow-ups scheduled for registry item ${link} (extendedCard: ${extendedCard || 'none'})`);
      } catch (e) {
        console.error(`Follow-up scheduling failed for registry ${link}:`, e.message);
      }
    }

    // Fire notification event for registry item creation
    try {
      await fireNotificationEvent('REGISTRY_CREATED', tenantId, {
        memberLink: memberLink,
        detail: resultDescription || actionCode,
        sourceLink: String(link),
        sourcePage: 'action_queue.html'
      });
    } catch (e) { logPlatformError('warn', 'createRegistryItem', 'Notification fire failed', { error: e.message }); }

    // Also fire an action-scoped event (REGISTRY_<action code>) so notification
    // rules can target one kind of registry item. No matching rule = no-op.
    // (Registration reviews no longer come through here — since v111 the
    // REG_REVIEW action dispatches to createIntakeItem in intake.js.)
    try {
      const nameRow = await (client || ctx.getDbClient()).query(
        `SELECT fname || ' ' || lname AS member_name FROM member WHERE link = $1`, [memberLink]);
      await fireNotificationEvent(`REGISTRY_${actionCode}`, tenantId, {
        memberLink: memberLink,
        memberName: nameRow.rows[0]?.member_name,
        detail: resultDescription || actionCode,
        sourceLink: String(link),
        sourcePage: 'action_queue.html'
      });
    } catch (e) { logPlatformError('warn', 'createRegistryItem', 'Action-scoped notification fire failed', { error: e.message }); }
  };
}

export function register(app, ctx) {
  const {
    resolveMember, encodeValue, getOrCreateEntityLink, logAudit
  } = ctx;
  const { getMoleculeStorageInfo } = ctx.molecules;
  const { platformToday, dateToMoleculeInt, moleculeIntToDate, formatDateLocal } = ctx.dates;

  // ============================================================
  // STABILITY REGISTRY — AUDIT HISTORY
  // ============================================================
  app.get('/v1/stability-registry/audit-history', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    const { user_id, program_id, start_date, end_date } = req.query;

    try {
      // Get the entity type link for stability_registry (auto-creates if first time)
      const { link: entityTypeLink, key_size } = await getOrCreateEntityLink(tenantId, 'stability_registry');
      const auditTable = `audit_log_${key_size}`;

      // Build filters
      let dateFilter = '';
      const params = [entityTypeLink];
      let paramIndex = 2;

      if (start_date) {
        dateFilter += ` AND a.audit_ts >= timestamp_to_audit_ts($${paramIndex}::date::timestamp)`;
        params.push(start_date);
        paramIndex++;
      }
      if (end_date) {
        dateFilter += ` AND a.audit_ts <= timestamp_to_audit_ts(($${paramIndex}::date + 1)::timestamp)`;
        params.push(end_date);
        paramIndex++;
      }

      let userFilter = '';
      if (user_id) {
        const userResult = await dbClient.query('SELECT link FROM platform_user WHERE user_id = $1', [user_id]);
        if (userResult.rows.length > 0) {
          userFilter = ` AND a.user_link = $${paramIndex}`;
          params.push(userResult.rows[0].link);
          paramIndex++;
        }
      }

      // Defense-in-depth: pin the joined registry rows to this tenant. The audit
      // rows are already tenant-scoped (a.p_link is the per-tenant entity link
      // from getOrCreateEntityLink(tenantId,...)), so this is belt-and-suspenders
      // that keeps the boundary explicit if that invariant ever changes. (S121)
      params.push(tenantId);
      const srTenantParam = paramIndex;
      paramIndex++;

      // Query audit entries for stability_registry, join to registry + member for context
      const result = await dbClient.query(`
        SELECT
          a.link as audit_link,
          a.entity_key as registry_link,
          audit_ts_to_timestamp(a.audit_ts) as action_time,
          a.audit_ts,
          a.action,
          a.user_link,
          u.display_name as user_name,
          sr.member_link,
          sr.urgency,
          sr.source_stream,
          sr.reason_code,
          sr.reason_text,
          sr.status as current_status,
          sr.resolution_code,
          sr.resolution_notes,
          m.fname,
          m.lname,
          m.membership_number
        FROM ${auditTable} a
        LEFT JOIN platform_user u ON a.user_link = u.link
        LEFT JOIN stability_registry sr ON a.entity_key = sr.link AND sr.tenant_id = $${srTenantParam}
        LEFT JOIN member m ON sr.member_link = m.link
        WHERE a.p_link = $1 ${dateFilter} ${userFilter}
        ORDER BY a.audit_ts DESC
        LIMIT 500
      `, params);

      let rows = result.rows;

      // Clinic filter: only include entries for members in the specified program
      if (program_id) {
        const ppInfo = await getMoleculeStorageInfo(tenantId, 'PARTNER_PROGRAM');
        if (ppInfo) {
          const col2 = ppInfo.columns[1];
          const encoded = encodeValue(parseInt(program_id), col2.size, col2.valueType);
          const clinicMembers = await dbClient.query(
            `SELECT p_link FROM ${ppInfo.tableName} WHERE molecule_id = ${ppInfo.moleculeId} AND attaches_to = 'M' AND ${col2.name} = $1`,
            [encoded]
          );
          const memberSet = new Set(clinicMembers.rows.map(r => r.p_link));
          rows = rows.filter(r => memberSet.has(r.member_link));
        }
      }

      // For edit actions, get field-level changes
      for (const row of rows) {
        if (row.action === 'E') {
          try {
            const changesResult = await dbClient.query(`
              SELECT af.field_name, ac.old_value, ac.new_value
              FROM audit_change ac
              JOIN audit_field af ON ac.field_link = af.link
              WHERE ac.p_link = $1 AND ac.key_size = $2
            `, [row.audit_link, key_size]);
            row.changes = changesResult.rows;
          } catch (e) {
            // A failed diff read is not "no changes" (2026-07 audit Tier 2).
            logPlatformError('warn', 'registryAuditHistory', 'Audit change read failed', { audit_link: row.audit_link, error: e.message });
            row.changes = [];
            row.changes_error = true;
          }
        }
      }

      // Build action descriptions for the UI
      rows = rows.map(r => {
        let description = '';
        if (r.action === 'A') {
          description = `Created ${r.urgency} registry item: ${r.reason_text || r.reason_code}`;
        } else if (r.action === 'E') {
          const statusChange = (r.changes || []).find(c => c.field_name === 'status');
          if (statusChange) {
            const labels = { O: 'Open', A: 'Assigned', R: 'Resolved' };
            description = `${labels[statusChange.old_value] || statusChange.old_value} → ${labels[statusChange.new_value] || statusChange.new_value}`;
            if (statusChange.new_value === 'R' && r.resolution_notes) {
              description += `: ${r.resolution_notes}`;
            }
          } else {
            description = 'Updated registry item';
          }
        }
        return {
          ...r,
          action_description: description,
          physician_name: r.fname && r.lname ? `${r.fname} ${r.lname}` : 'Unknown'
        };
      });

      res.json({ items: rows, total: rows.length });

    } catch (error) {
      console.error('Error fetching registry audit history:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // STABILITY REGISTRY ENDPOINTS
  // ============================================================

  // GET /v1/stability-registry — open items, optionally scoped to a clinic (program_id)
  app.get('/v1/stability-registry', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const programId = req.query.program_id ? parseInt(req.query.program_id) : null;
    const includeResolved = req.query.include_resolved === 'true';

    try {
      // Build clinic filter join if program_id provided
      let clinicJoin = '';
      let clinicWhere = '';
      let clinicSelect = '';
      const params = [tenantId];
      let paramCount = 2;

      if (programId) {
        const ppInfo = await getMoleculeStorageInfo(tenantId, 'PARTNER_PROGRAM');
        console.log(`[clinic filter] programId=${programId}, table=${ppInfo?.tableName}, cols=${ppInfo?.columns?.length}, storageSize=${ppInfo?.storageSize}`);
        if (ppInfo) {
          const col2 = ppInfo.columns[1];
          console.log(`[clinic filter] col2=${JSON.stringify(col2)}`);
          if (col2) {
            const encoded = encodeValue(programId, col2.size, col2.valueType);
            console.log(`[clinic filter] encoded=${encoded}, join on ${col2.name}`);
            // (The old REG_REVIEW OR-escape is gone — Session 142. Since
            // v111 registration reviews live in intake_item, so no open
            // registry row can carry that reason code; the registry is
            // clinical items only, all clinic-scoped the same way.)
            clinicJoin = ` LEFT JOIN ${ppInfo.tableName} pp ON pp.p_link = m.link AND pp.molecule_id = ${ppInfo.moleculeId} AND pp.attaches_to = 'M' AND pp.${col2.name} = $${paramCount}`;
            // A person with NO clinic yet (every registrant, pre-activation)
            // belongs to no program — so they belong to EVERY program's view.
            // The old filter (pp.p_link IS NOT NULL alone) made a registrant's
            // safety items invisible from any program-scoped screen — Erica
            // found a live SENTINEL-class item this way (S148). Unassigned
            // people ride along, flagged so the queue can label them.
            clinicWhere = ` AND (pp.p_link IS NOT NULL OR NOT EXISTS (
              SELECT 1 FROM ${ppInfo.tableName} pp0
              WHERE pp0.p_link = m.link AND pp0.molecule_id = ${ppInfo.moleculeId} AND pp0.attaches_to = 'M'))`;
            clinicSelect = `, pp.p_link IS NULL AS clinic_unassigned`;
            params.push(encoded);
            paramCount++;
          }
        }
      }

      const statusFilter = includeResolved ? '' : ` AND sr.status != 'R'`;

      const query = `
        SELECT sr.link, sr.urgency, sr.source_stream, sr.reason_code, sr.reason_text,
               sr.score_at_creation, sr.sla_hours, sr.sla_deadline,
               sr.created_date, sr.created_ts, sr.status,
               sr.assigned_to, sr.assigned_ts, sr.resolved_ts,
               sr.resolution_code, sr.resolution_notes,
               sr.dominant_driver, sr.dominant_subdomain, sr.protocol_card, sr.extended_card,
               m.membership_number, m.fname, m.lname, m.title${clinicSelect}
        FROM stability_registry sr
        JOIN member m ON m.link = sr.member_link
        ${clinicJoin}
        WHERE sr.tenant_id = $1${statusFilter}${clinicWhere}
        ORDER BY
          CASE sr.urgency
            WHEN 'SENTINEL' THEN 0
            WHEN 'RED' THEN 1
            WHEN 'ORANGE' THEN 2
            WHEN 'YELLOW' THEN 3
            ELSE 4
          END,
          sr.created_ts DESC
      `;

      const result = await dbClient.query(query, params);

      // Convert Bill epoch dates
      const items = result.rows.map(r => ({
        ...r,
        created_date_display: formatDateLocal(moleculeIntToDate(r.created_date))
      }));

      // Summary counts
      const summary = { total: items.length, sentinel: 0, red: 0, orange: 0, yellow: 0 };
      for (const i of items) {
        if (i.status === 'R') continue;
        const u = i.urgency.toLowerCase();
        if (summary[u] !== undefined) summary[u]++;
      }

      res.json({ summary, items });

    } catch (error) {
      console.error('Error in /v1/stability-registry:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/stability-registry/member/:membershipNumber — items for one physician
  app.get('/v1/stability-registry/member/:membershipNumber', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const includeResolved = req.query.include_resolved !== 'false'; // default true for detail view

    try {
      const memberRec = await resolveMember(req.params.membershipNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });

      const statusFilter = includeResolved ? '' : ` AND sr.status != 'R'`;

      const result = await dbClient.query(`
        SELECT sr.link, sr.urgency, sr.source_stream, sr.reason_code, sr.reason_text,
               sr.score_at_creation, sr.sla_hours, sr.sla_deadline,
               sr.created_date, sr.created_ts, sr.status,
               sr.assigned_to, sr.assigned_ts, sr.resolved_ts,
               sr.resolution_code, sr.resolution_notes,
               sr.dominant_driver, sr.dominant_subdomain, sr.protocol_card, sr.extended_card
        FROM stability_registry sr
        WHERE sr.member_link = $1 AND sr.tenant_id = $2${statusFilter}
        ORDER BY sr.created_ts DESC
      `, [memberRec.link, tenantId]);

      const items = result.rows.map(r => ({
        ...r,
        created_date_display: formatDateLocal(moleculeIntToDate(r.created_date))
      }));

      // Current color = most severe open item
      let currentColor = 'GREEN';
      const colorPriority = { SENTINEL: 0, RED: 1, ORANGE: 2, YELLOW: 3 };
      let bestPriority = 999;
      for (const i of items) {
        if (i.status === 'R') continue;
        const p = colorPriority[i.urgency] ?? 999;
        if (p < bestPriority) { bestPriority = p; currentColor = i.urgency === 'SENTINEL' ? 'RED' : i.urgency; }
      }

      res.json({ current_color: currentColor, items });

    } catch (error) {
      console.error('Error in /v1/stability-registry/member:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /v1/stability-registry/:link — update a registry item (assign, resolve)
  app.put('/v1/stability-registry/:link', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const link = parseInt(req.params.link);
    const { status, assigned_to, resolution_code, resolution_notes, user_id } = req.body;

    try {
      // Scope to the caller's tenant — do NOT derive tenant from the row, or a
      // cross-tenant user could resolve/reopen/reassign another tenant's
      // registry item (PHI) by link. (Session 121 tenant-isolation fix.)
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
      const beforeResult = await dbClient.query(
        'SELECT tenant_id, status, assigned_to, resolution_code, resolution_notes FROM stability_registry WHERE link = $1 AND tenant_id = $2',
        [link, tenantId]
      );
      if (!beforeResult.rows.length) return res.status(404).json({ error: 'Registry item not found' });
      const before = { status: beforeResult.rows[0].status, assigned_to: beforeResult.rows[0].assigned_to, resolution_code: beforeResult.rows[0].resolution_code, resolution_notes: beforeResult.rows[0].resolution_notes };

      const updates = [];
      const params = [link];
      let paramCount = 2;

      if (status === 'A' && assigned_to) {
        updates.push(`status = 'A'`);
        updates.push(`assigned_to = $${paramCount++}`);
        params.push(assigned_to);
        updates.push(`assigned_ts = NOW()`);
      }

      if (status === 'R') {
        updates.push(`status = 'R'`);
        updates.push(`resolved_ts = NOW()`);
        if (resolution_code) {
          updates.push(`resolution_code = $${paramCount++}`);
          params.push(resolution_code);
        }
        if (resolution_notes) {
          updates.push(`resolution_notes = $${paramCount++}`);
          params.push(resolution_notes);
        }
      }

      // Reopen: status back to O (from R)
      if (status === 'O') {
        updates.push(`status = 'O'`);
        updates.push(`resolved_ts = NULL`);
        updates.push(`resolution_code = NULL`);
        updates.push(`resolution_notes = NULL`);
      }

      if (!updates.length) return res.status(400).json({ error: 'No valid updates' });

      params.push(tenantId);
      const result = await dbClient.query(
        `UPDATE stability_registry SET ${updates.join(', ')} WHERE link = $1 AND tenant_id = $${params.length} RETURNING *`,
        params
      );

      if (!result.rows.length) return res.status(404).json({ error: 'Registry item not found' });

      // Audit log: capture after state and log the change
      const after = {
        status: result.rows[0].status,
        assigned_to: result.rows[0].assigned_to,
        resolution_code: result.rows[0].resolution_code,
        resolution_notes: result.rows[0].resolution_notes
      };
      await logAudit(tenantId, user_id || null, 'stability_registry', link, 'E', { before, after });

      res.json(result.rows[0]);

    } catch (error) {
      console.error('Error updating registry item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // REGISTRATION REVIEW QUEUE (WisconsinPATH Stage 1)
  // ============================================================

  // GET /v1/position-holders?code=MEDDIR — staff logins holding a position
  // (any clinic). Backs the escalation flow and any position-based picker.
  app.get('/v1/position-holders', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    try {
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
      const code = String(req.query.code || '').toUpperCase();
      if (!code) return res.status(400).json({ error: 'code required' });
      const holders = await ctx.molecules.findUsersByMoleculeValue(tenantId, 'POSITIONCLINIC', code);
      res.json(holders.map(h => ({ user_id: h.user_id, display_name: h.display_name })));
    } catch (error) {
      console.error('Error listing position holders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // (The registration-review Escalate endpoint is RETIRED — Session 142.
  // Erica's intake spec: Escalate was directionless, named no recipient,
  // and had no return path. Registration reviews now live in the
  // intake_item table with role-scoped actions — see intake.js.)

  // ============================================================
  // REGISTRY FOLLOW-UP ENDPOINTS
  // ============================================================

  // GET /v1/registry-followups — follow-up queue for tenant
  app.get('/v1/registry-followups', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const result = await dbClient.query(`
        SELECT rf.followup_id, rf.registry_link, rf.followup_type,
               rf.scheduled_date, rf.completed_date, rf.completed_ts,
               rf.completed_by, rf.outcome, rf.notes,
               sr.urgency, sr.reason_code, sr.dominant_driver,
               sr.dominant_subdomain, sr.protocol_card, sr.extended_card, sr.status as registry_status,
               m.fname, m.lname, m.membership_number, m.title
        FROM registry_followup rf
        JOIN stability_registry sr ON sr.link = rf.registry_link
        JOIN member m ON m.link = sr.member_link
        WHERE rf.tenant_id = $1
        ORDER BY
          CASE WHEN rf.completed_ts IS NULL THEN 0 ELSE 1 END,                 -- pending first
          CASE WHEN rf.completed_ts IS NULL THEN rf.scheduled_date END ASC,    -- pending: earliest scheduled at top
          rf.completed_ts DESC                                                  -- completed: most recent first (Erica)
      `, [tenantId]);

      // Add display dates
      const followups = result.rows.map(r => ({
        ...r,
        scheduled_date_display: formatDateLocal(moleculeIntToDate(r.scheduled_date)),
        completed_date_display: r.completed_date ? formatDateLocal(moleculeIntToDate(r.completed_date)) : null,
        is_overdue: !r.completed_ts && r.scheduled_date <= platformToday()
      }));

      res.json({ followups });

    } catch (error) {
      console.error('Error in GET /v1/registry-followups:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /v1/registry-followups/summary — counts for dashboard badge
  app.get('/v1/registry-followups/summary', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const today = platformToday();
      const result = await dbClient.query(`
        SELECT
          COUNT(*) FILTER (WHERE rf.completed_ts IS NULL) as pending,
          COUNT(*) FILTER (WHERE rf.completed_ts IS NULL AND rf.scheduled_date <= $2) as overdue,
          COUNT(*) FILTER (WHERE rf.completed_ts IS NULL AND rf.scheduled_date > $2 AND rf.scheduled_date <= $2 + 7) as due_this_week,
          COUNT(*) FILTER (WHERE rf.completed_ts IS NOT NULL) as completed
        FROM registry_followup rf
        JOIN stability_registry sr ON sr.link = rf.registry_link
        WHERE rf.tenant_id = $1
      `, [tenantId, today]);
      // No registry-status filter (Bill, Session 152): a follow-up is
      // after-care — resolving the item is the intervention ending, which is
      // exactly when the checks matter. The chips/badge must count the same
      // population the worklist shows; completing a check (any outcome) is
      // the one way it leaves the pending count.

      res.json(result.rows[0]);

    } catch (error) {
      console.error('Error in GET /v1/registry-followups/summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /v1/registry-followups — create a manual follow-up tied to an open registry item
  // Body: { registry_link, tenant_id, followup_type, scheduled_date, notes? }
  // followup_type must be one of: 48h, weekly, 2wk, 4wk, 8wk, compliance_period
  // scheduled_date is YYYY-MM-DD; converted to Bill-epoch SMALLINT
  app.post('/v1/registry-followups', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const { registry_link, followup_type, scheduled_date, notes } = req.body;
    const tenant_id = req.tenantId;  // authoritative — never trust body tenant_id (S121)

    if (!registry_link || !tenant_id || !followup_type || !scheduled_date) {
      return res.status(400).json({ error: 'registry_link, tenant_id, followup_type, and scheduled_date are required' });
    }

    const validTypes = ['48h', 'weekly', '2wk', '4wk', '8wk', 'compliance_period'];
    if (!validTypes.includes(followup_type)) {
      return res.status(400).json({ error: `followup_type must be one of: ${validTypes.join(', ')}` });
    }

    try {
      // Convert YYYY-MM-DD to Bill epoch SMALLINT
      const parsed = new Date(scheduled_date + 'T00:00:00');
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'scheduled_date must be YYYY-MM-DD' });
      }
      const billEpoch = dateToMoleculeInt(parsed);

      // Verify the registry item exists and belongs to this tenant
      const regCheck = await dbClient.query(
        `SELECT link FROM stability_registry WHERE link = $1 AND tenant_id = $2`,
        [registry_link, tenant_id]
      );
      if (!regCheck.rows.length) {
        return res.status(404).json({ error: 'Registry item not found in this tenant' });
      }

      const result = await dbClient.query(`
        INSERT INTO registry_followup (registry_link, tenant_id, followup_type, scheduled_date, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [registry_link, tenant_id, followup_type, billEpoch, notes || null]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error in POST /v1/registry-followups:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /v1/registry-followups/:id — complete a follow-up check
  app.patch('/v1/registry-followups/:id', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const followupId = parseInt(req.params.id);
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const { outcome, notes, pathway_answers, user_id } = req.body;

    // 'not_needed' (displayed "No longer needed") completes a check like any
    // outcome but is deliberately absent from the F1 intervention-failure job's
    // watch list (declining/escalated) — retiring a check this way never rings
    // the escalation bell. See the F1 detection query below and migration v127.
    const VALID_OUTCOMES = ['improving', 'stable', 'declining', 'escalated', 'not_needed'];
    if (!outcome) return res.status(400).json({ error: 'outcome required (improving/stable/declining/escalated/not_needed)' });
    if (!VALID_OUTCOMES.includes(outcome)) {
      return res.status(400).json({ error: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` });
    }

    try {
      const today = platformToday();
      const result = await dbClient.query(`
        UPDATE registry_followup
        SET completed_date = $1, completed_ts = NOW(), completed_by = $2,
            outcome = $3, notes = $4, pathway_answers = $5
        WHERE followup_id = $6 AND tenant_id = $7
        RETURNING *
      `, [today, user_id || null, outcome, notes || null, pathway_answers ? JSON.stringify(pathway_answers) : null, followupId, tenantId]);

      if (!result.rows.length) return res.status(404).json({ error: 'Follow-up not found' });

      res.json(result.rows[0]);

    } catch (error) {
      console.error('Error in PATCH /v1/registry-followups:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

/**
 * Register the F1_T5 scheduled-job handler. Called from boot(ctx) so
 * the scheduler tick can see it. Walks open Yellow/Orange registry
 * items for T5 (12+ weeks Yellow), T6 (21+ days Yellow/Orange), and
 * F1 (intervention failure outcome) detection.
 */
export function registerJobs(ctx) {
  const { registerJobHandler, externalActionHandlers, fireNotificationEvent } = ctx;
  const { platformToday, formatDateLocal } = ctx.dates;
  const { debugLog } = ctx.log;

  // (The REG_REVIEW_SLA job handler is RETIRED — Session 142. v111 renamed
  // the scheduled job to INTAKE_SLA; intake.js registers its handler.
  // Registration reviews live in the intake_item table now, and the
  // overdue default is flag-and-notify, not auto-escalate — Erica's open
  // decision, configurable via sysparm intake_sla.)

  // ─── F1/T5 Extended Card Batch Detection ───────────────────────────────────
  // Runs daily. Detects two destabilization archetypes from registry + followup data:
  //   T5 (Chronic Borderline) — Yellow tier 12+ consecutive weeks with 1+ completed follow-up cycle
  //   F1 (Intervention Failure) — completed follow-up with declining/escalated outcome on open registry item
  // Creates new registry items with appropriate extended_card assignment.
  registerJobHandler('F1_T5', async (tenantId, scheduledJobId, db) => {
    let totalAnalyzed = 0;
    let totalProcessed = 0;
    let totalFlagged = 0;

    const todayBillEpoch = platformToday();
    const twelveWeeksAgo = todayBillEpoch - 84; // 12 weeks = 84 days
    const threeWeeksAgo = todayBillEpoch - 21;  // 3 weeks = 21 days

    // ── T5: Chronic Borderline Management ──
    // Find open YELLOW registry items created 12+ weeks ago that have at least one completed follow-up
    // and do NOT already have a T5 extended card on any open item for the same member
    try {
      const t5Candidates = await db.query(`
        SELECT sr.link, sr.member_link, sr.created_date, sr.protocol_card,
               m.fname, m.lname, m.membership_number
        FROM stability_registry sr
        JOIN member m ON m.link = sr.member_link
        WHERE sr.tenant_id = $1
          AND sr.status = 'O'
          AND sr.urgency = 'YELLOW'
          AND sr.created_date <= $2
          AND EXISTS (
            SELECT 1 FROM registry_followup rf
            WHERE rf.registry_link = sr.link AND rf.completed_ts IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM stability_registry t5
            WHERE t5.member_link = sr.member_link
              AND t5.tenant_id = $1
              AND t5.extended_card = 'T5'
              AND t5.status = 'O'
          )
      `, [tenantId, twelveWeeksAgo]);

      totalAnalyzed += t5Candidates.rows.length;

      // Deduplicate by member_link — one T5 per member per run
      const t5ProcessedMembers = new Set();
      for (const row of t5Candidates.rows) {
        if (t5ProcessedMembers.has(row.member_link)) continue;
        t5ProcessedMembers.add(row.member_link);
        try {
          const activityDate = formatDateLocal(new Date());
          await externalActionHandlers.createRegistryItem({
            memberLink: row.member_link,
            tenantId,
            activityDate,
            actionCode: 'SR_YELLOW', // T5 stays Yellow — transitions to sustained monitoring
            resultDescription: `T5 Chronic Borderline — Yellow tier 12+ weeks (source registry #${row.link})`,
            activityData: {
              EXTENDED_CARD: 'T5',
              PROTOCOL_CARD: 'T5',
              DOMINANT_DRIVER: 'COMPOSITE'
            }
          });
          totalFlagged++;
          debugLog(() => `  🔶 T5 created for member ${row.member_link} (source registry #${row.link}, Yellow since ${row.created_date})`);

          await fireNotificationEvent('EXTENDED_CARD_DETECTED', tenantId, {
            memberLink: row.member_link,
            memberName: `${row.fname} ${row.lname}`,
            detail: 'T5 Chronic Borderline — Yellow tier for 12+ consecutive weeks despite intervention',
            sourcePage: 'physician_detail.html',
            sourceLink: row.membership_number
          });
        } catch (e) {
          console.error(`F1_T5: T5 creation failed for member ${row.member_link}:`, e.message);
        }
        totalProcessed++;
      }
    } catch (e) {
      console.error('F1_T5: T5 detection query failed:', e.message);
    }

    // ── T6: Repeated Moderate — Early Warning (3+ weeks at Yellow/Orange) ──
    // Detects members with open YELLOW or ORANGE registry items for 21+ days
    // who don't already have an open T6 or T5 (T5 supersedes at 12 weeks)
    try {
      const t6Candidates = await db.query(`
        SELECT sr.link, sr.member_link, sr.created_date, sr.urgency,
               m.fname, m.lname, m.membership_number
        FROM stability_registry sr
        JOIN member m ON m.link = sr.member_link
        WHERE sr.tenant_id = $1
          AND sr.status = 'O'
          AND sr.urgency IN ('YELLOW', 'ORANGE')
          AND sr.created_date <= $2
          AND NOT EXISTS (
            SELECT 1 FROM stability_registry t6
            WHERE t6.member_link = sr.member_link
              AND t6.tenant_id = $1
              AND t6.extended_card = 'T6'
              AND t6.status = 'O'
          )
          AND NOT EXISTS (
            SELECT 1 FROM stability_registry t5
            WHERE t5.member_link = sr.member_link
              AND t5.tenant_id = $1
              AND t5.extended_card = 'T5'
              AND t5.status = 'O'
          )
      `, [tenantId, threeWeeksAgo]);

      totalAnalyzed += t6Candidates.rows.length;

      const t6ProcessedMembers = new Set();
      for (const row of t6Candidates.rows) {
        if (t6ProcessedMembers.has(row.member_link)) continue;
        t6ProcessedMembers.add(row.member_link);
        try {
          const activityDate = formatDateLocal(new Date());
          await externalActionHandlers.createRegistryItem({
            memberLink: row.member_link,
            tenantId,
            activityDate,
            actionCode: 'SR_ORANGE', // Escalation — 3+ weeks at moderate warrants higher attention
            resultDescription: `T6 Repeated Moderate — ${row.urgency} tier 3+ consecutive weeks (source registry #${row.link})`,
            activityData: {
              EXTENDED_CARD: 'T6',
              PROTOCOL_CARD: 'T6',
              DOMINANT_DRIVER: 'COMPOSITE'
            }
          });
          totalFlagged++;
          debugLog(() => `  🟠 T6 created for member ${row.member_link} (source registry #${row.link}, ${row.urgency} since ${row.created_date})`);

          await fireNotificationEvent('EXTENDED_CARD_DETECTED', tenantId, {
            memberLink: row.member_link,
            memberName: `${row.fname} ${row.lname}`,
            detail: `T6 Repeated Moderate — ${row.urgency} tier for 3+ consecutive weeks`,
            sourcePage: 'physician_detail.html',
            sourceLink: row.membership_number
          });
        } catch (e) {
          console.error(`F1_T5: T6 creation failed for member ${row.member_link}:`, e.message);
        }
        totalProcessed++;
      }
    } catch (e) {
      console.error('F1_T5: T6 detection query failed:', e.message);
    }

    // ── F1: Intervention Failure — Structured Reassessment ──
    // Find completed follow-ups with outcome 'declining' or 'escalated' where:
    //   - The parent registry item is still open
    //   - No F1 extended card already exists for the same member (open)
    // The watch list is ONLY declining/escalated: improving, stable, and
    // 'not_needed' (No longer needed, v127) complete a check without ever
    // triggering an F1 escalation — retiring a check never rings the bell.
    try {
      const f1Candidates = await db.query(`
        SELECT DISTINCT sr.link, sr.member_link, sr.urgency, sr.protocol_card,
               rf.followup_id, rf.outcome, rf.completed_ts,
               m.fname, m.lname, m.membership_number
        FROM registry_followup rf
        JOIN stability_registry sr ON sr.link = rf.registry_link
        JOIN member m ON m.link = sr.member_link
        WHERE rf.tenant_id = $1
          AND rf.outcome IN ('declining', 'escalated')
          AND rf.completed_ts IS NOT NULL
          AND sr.status = 'O'
          AND NOT EXISTS (
            SELECT 1 FROM stability_registry f1
            WHERE f1.member_link = sr.member_link
              AND f1.tenant_id = $1
              AND f1.extended_card = 'F1'
              AND f1.status = 'O'
          )
      `, [tenantId]);

      totalAnalyzed += f1Candidates.rows.length;

      // Deduplicate by member_link — one F1 per member per run
      const f1ProcessedMembers = new Set();
      for (const row of f1Candidates.rows) {
        if (f1ProcessedMembers.has(row.member_link)) continue;
        f1ProcessedMembers.add(row.member_link);
        try {
          const activityDate = formatDateLocal(new Date());
          // F1 escalates: if Yellow → Orange, if Orange → Red
          let actionCode = 'SR_ORANGE'; // default escalation
          if (row.urgency === 'ORANGE' || row.urgency === 'RED' || row.urgency === 'SENTINEL') {
            actionCode = 'SR_RED';
          }

          await externalActionHandlers.createRegistryItem({
            memberLink: row.member_link,
            tenantId,
            activityDate,
            actionCode,
            resultDescription: `F1 Intervention Failure — ${row.outcome} outcome at follow-up (source registry #${row.link})`,
            activityData: {
              EXTENDED_CARD: 'F1',
              PROTOCOL_CARD: 'F1',
              DOMINANT_DRIVER: 'COMPOSITE'
            }
          });
          totalFlagged++;
          debugLog(() => `  🔴 F1 created for member ${row.member_link} (${row.outcome} on registry #${row.link})`);

          await fireNotificationEvent('EXTENDED_CARD_DETECTED', tenantId, {
            memberLink: row.member_link,
            memberName: `${row.fname} ${row.lname}`,
            detail: `F1 Intervention Failure — ${row.outcome} outcome at success check`,
            sourcePage: 'physician_detail.html',
            sourceLink: row.membership_number
          });
        } catch (e) {
          console.error(`F1_T5: F1 creation failed for member ${row.member_link}:`, e.message);
        }
        totalProcessed++;
      }
    } catch (e) {
      console.error('F1_T5: F1 detection query failed:', e.message);
    }

    debugLog(() => `📊 F1/T5 batch complete: analyzed=${totalAnalyzed}, processed=${totalProcessed}, flagged=${totalFlagged}`);
    return { analyzed: totalAnalyzed, processed: totalProcessed, flagged: totalFlagged };
  });
}

/**
 * Register external action handlers. Called from boot(ctx) so the
 * platform's bonus/promotion engine dispatch path can see them.
 *
 * Only one handler today: createRegistryItem. The platform-side
 * dispatch sites (pointers.js in the bonus engine, promotion
 * engine, and processPromotionResult) look up handlers by
 * function_name from the externalActionHandlers registry; the
 * vertical adding 'createRegistryItem' here makes the existing
 * SR_SENTINEL / SR_RED / SR_ORANGE / SR_YELLOW external_result_action
 * rows continue to dispatch correctly. Direct internal callers
 * (this file's F1_T5 handler, meds.js, compliance.js) reach the
 * same handler via ctx.externalActionHandlers.createRegistryItem
 * — same registry, same function.
 */
export function registerActionHandlers(ctx) {
  ctx.registerExternalActionHandler('createRegistryItem', makeCreateRegistryItem(ctx));
}

export default { register, registerJobs, registerActionHandlers };
