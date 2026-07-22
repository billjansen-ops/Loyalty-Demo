/**
 * Workforce Monitoring (Insight) — CSV / PDF export endpoints.
 *
 * Session 131 (Category 2): moved out of pointers.js. Both endpoints are
 * Insight-only — they query stability_registry / registry_followup /
 * member_survey / compliance_result (Insight-domain tables whose CRUD already
 * lives in this vertical) and are called only from the vertical's own pages
 * (physician_detail.html, action_queue.html). Nothing on the Delta side calls
 * /v1/export, so the routes belong here.
 *
 *   - GET /v1/export/:report — registry / followups / roster / compliance CSV.
 *   - GET /v1/export/participant/:membershipNumber — per-participant chart,
 *     CSV or PDF, with column-selectable sections.
 *
 * The assigned-clinician and member-notes enrichments call the vertical's own
 * helpers directly (getAssignedClinicians from clinicians.js, getMemberNotes
 * from notes.js) — no verticalCallbacks bridge needed now that the export code
 * lives inside the vertical alongside them.
 */

import { getAssignedClinicians } from './clinicians.js';
import { getMemberNotes } from './notes.js';
import { getExpectedInstruments } from './meds.js';

function toCsv(rows, columns) {
  if (!rows.length) return '';
  const header = columns.map(c => c.label).join(',');
  const lines = rows.map(row =>
    columns.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) val = `"${val}"`;
      return val;
    }).join(',')
  );
  return header + '\n' + lines.join('\n');
}

export function register(app, ctx) {
  const { resolveMember, getCustauth } = ctx;
  const { formatDateLocal, moleculeIntToDate, billEpochToDate, platformTodayStr } = ctx.dates;

  // Postgres timestamp columns come back as JS Date objects; unformatted they
  // serialize into the CSV as "Tue Jul 21 2026 06:12:19 GMT-0500 (…)" — ugly
  // in Excel (Session 152, from the tour-setup walk's registry export).
  const fmtTimestamp = (d) => d
    ? `${formatDateLocal(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '';

  // GET /v1/export/:report — download CSV
  app.get('/v1/export/:report', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
    const report = req.params.report;

    try {
      let rows, columns, filename;

      if (report === 'registry') {
        const includeResolved = req.query.include_resolved === 'true';
        const statusFilter = includeResolved ? '' : ` AND sr.status != 'R'`;
        const result = await dbClient.query(`
          SELECT sr.urgency, m.title, m.fname, m.lname, m.membership_number,
                 sr.source_stream, sr.reason_code, sr.reason_text,
                 sr.score_at_creation, sr.dominant_driver, sr.dominant_subdomain, sr.protocol_card, sr.extended_card,
                 sr.sla_hours, sr.sla_deadline, sr.created_ts,
                 sr.status, sr.assigned_to, sr.resolved_ts, sr.resolution_notes
          FROM stability_registry sr
          JOIN member m ON m.link = sr.member_link
          WHERE sr.tenant_id = $1${statusFilter}
          ORDER BY sr.created_ts DESC
        `, [tenantId]);
        // Enrich registry rows with assigned clinician.
        for (const row of result.rows) {
          try {
            const memberRec = await resolveMember(row.membership_number, tenantId);
            if (memberRec) {
              const clinicians = await getAssignedClinicians(ctx, memberRec.link, tenantId);
              row.assigned_clinician = (clinicians || []).map(c => `${c.fname} ${c.lname}`.trim()).join('; ');
            } else { row.assigned_clinician = ''; }
          } catch(e) {
            // Never blank the column on error — a failed lookup exported as
            // "" reads as "unattended" (2026-07 audit Tier 2). Say so.
            console.error('Export: assigned-clinician lookup failed for', row.membership_number, ':', e.message);
            row.assigned_clinician = '(lookup failed)';
          }
        }

        // Timestamps → readable local form (raw JS Date text reads terribly in Excel).
        for (const row of result.rows) {
          row.created_ts = fmtTimestamp(row.created_ts);
          row.resolved_ts = fmtTimestamp(row.resolved_ts);
        }

        rows = result.rows;
        columns = [
          { key: 'urgency', label: 'Urgency' },
          { key: 'title', label: 'Title' },
          { key: 'fname', label: 'First Name' },
          { key: 'lname', label: 'Last Name' },
          { key: 'membership_number', label: 'ID' },
          { key: 'assigned_clinician', label: 'Assigned Clinician' },
          { key: 'source_stream', label: 'Source' },
          { key: 'reason_code', label: 'Reason Code' },
          { key: 'reason_text', label: 'Reason' },
          { key: 'score_at_creation', label: 'PPII' },
          { key: 'dominant_driver', label: 'Dominant Driver' },
          { key: 'dominant_subdomain', label: 'Sub-domain' },
          { key: 'protocol_card', label: 'Protocol Card' },
          { key: 'sla_hours', label: 'SLA Hours' },
          { key: 'created_ts', label: 'Created' },
          { key: 'status', label: 'Status' },
          { key: 'resolved_ts', label: 'Resolved' },
          { key: 'resolution_notes', label: 'Resolution Notes' }
        ];
        filename = 'stability_registry';

      } else if (report === 'followups') {
        const result = await dbClient.query(`
          SELECT rf.followup_type, rf.scheduled_date, rf.completed_ts, rf.outcome, rf.notes,
                 sr.urgency, sr.reason_code, sr.dominant_driver, sr.protocol_card,
                 m.title, m.fname, m.lname, m.membership_number
          FROM registry_followup rf
          JOIN stability_registry sr ON sr.link = rf.registry_link
          JOIN member m ON m.link = sr.member_link
          WHERE rf.tenant_id = $1
          ORDER BY
          CASE WHEN rf.completed_ts IS NULL THEN 0 ELSE 1 END,                 -- pending first
          CASE WHEN rf.completed_ts IS NULL THEN rf.scheduled_date END ASC,    -- pending: earliest scheduled at top
          rf.completed_ts DESC                                                  -- completed: most recent first (Erica)
        `, [tenantId]);
        rows = result.rows.map(r => ({
          ...r,
          scheduled_date_display: formatDateLocal(moleculeIntToDate(r.scheduled_date)),
          status: r.completed_ts ? 'Completed' : 'Pending'
        }));
        columns = [
          { key: 'title', label: 'Title' },
          { key: 'fname', label: 'First Name' },
          { key: 'lname', label: 'Last Name' },
          { key: 'membership_number', label: 'ID' },
          { key: 'followup_type', label: 'Check Type' },
          { key: 'scheduled_date_display', label: 'Scheduled' },
          { key: 'status', label: 'Status' },
          { key: 'outcome', label: 'Outcome' },
          { key: 'urgency', label: 'Urgency' },
          { key: 'reason_code', label: 'Reason' },
          { key: 'dominant_driver', label: 'Driver' },
          { key: 'protocol_card', label: 'Protocol Card' },
          { key: 'notes', label: 'Notes' }
        ];
        filename = 'followups';

      } else if (report === 'roster') {
        const result = await dbClient.query(`
          SELECT m.link, m.title, m.fname, m.lname, m.membership_number,
                 m.email, m.phone,
                 COALESCE(tier.tier_description, 'Green') as current_tier
          FROM member m
          LEFT JOIN LATERAL get_member_current_tier(m.link) tier ON true
          WHERE m.tenant_id = $1
          ORDER BY m.lname, m.fname
        `, [tenantId]);

        // FILTER_MEMBER_LIST custauth hook
        const custauth = await getCustauth(tenantId);
        const filtered = await custauth('FILTER_MEMBER_LIST', result.rows, { tenantId, db: dbClient, molecules: ctx.molecules });

        // Enrich with assigned clinician names.
        for (const row of filtered) {
          try {
            const memberRec = await resolveMember(row.membership_number, tenantId);
            if (memberRec) {
              const clinicians = await getAssignedClinicians(ctx, memberRec.link, tenantId);
              row.assigned_clinician = (clinicians || []).map(c => `${c.fname} ${c.lname}`.trim()).join('; ');
            } else {
              row.assigned_clinician = '';
            }
          } catch(e) {
            // Never blank the column on error — a failed lookup exported as
            // "" reads as "unattended" (2026-07 audit Tier 2). Say so.
            console.error('Export: assigned-clinician lookup failed for', row.membership_number, ':', e.message);
            row.assigned_clinician = '(lookup failed)';
          }
          delete row.link; // don't export binary link
        }

        rows = filtered;
        columns = [
          { key: 'title', label: 'Title' },
          { key: 'fname', label: 'First Name' },
          { key: 'lname', label: 'Last Name' },
          { key: 'membership_number', label: 'ID' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'current_tier', label: 'Current Tier' },
          { key: 'assigned_clinician', label: 'Assigned Clinician' }
        ];
        filename = 'roster';

      } else if (report === 'compliance') {
        // Parameterize member_id — never interpolate request input into SQL.
        // (S121 fix: the old `'${req.query.member_id}'` form was a SQL-
        // injection vector that could also break tenant scoping.)
        const memberFilter = req.query.member_id ? `AND m.membership_number = $2` : '';
        const params = req.query.member_id ? [tenantId, req.query.member_id] : [tenantId];
        const result = await dbClient.query(`
          SELECT m.title, m.fname, m.lname, m.membership_number,
                 ci.item_name, ci.item_code,
                 mc.cadence_type, mc.cadence_days, mc.status as is_active
          FROM member_compliance mc
          JOIN member m ON m.link = mc.member_link
          JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
          WHERE mc.tenant_id = $1 ${memberFilter}
          ORDER BY m.lname, m.fname, ci.item_name
        `, params);
        rows = result.rows;
        columns = [
          { key: 'title', label: 'Title' },
          { key: 'fname', label: 'First Name' },
          { key: 'lname', label: 'Last Name' },
          { key: 'membership_number', label: 'ID' },
          { key: 'item_name', label: 'Compliance Item' },
          { key: 'item_code', label: 'Item Code' },
          { key: 'cadence_type', label: 'Cadence' },
          { key: 'cadence_days', label: 'Cadence Days' },
          { key: 'is_active', label: 'Active' }
        ];
        filename = 'compliance';

      } else {
        return res.status(400).json({ error: `Unknown report: ${report}. Available: registry, followups, roster, compliance` });
      }

      const csv = toCsv(rows, columns);
      const timestamp = platformTodayStr();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}_${timestamp}.csv"`);
      res.send(csv);

    } catch (error) {
      console.error(`Error in GET /v1/export/${report}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // PER-PARTICIPANT CHART EXPORT (CSV or PDF with column selection)
  // ============================================================
  // GET /v1/export/participant/:membershipNumber?format=csv|pdf&sections=registry,followups,surveys,compliance,notes,meds
  // sections param is comma-separated; defaults to all.
  // For CSV: returns a single CSV with section headers as separator rows.
  // For PDF: returns a formatted clinical summary.
  app.get('/v1/export/participant/:membershipNumber', async (req, res) => {
    const dbClient = ctx.getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId || parseInt(req.query.tenant_id);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      const memberRec = await resolveMember(req.params.membershipNumber, tenantId);
      if (!memberRec) return res.status(404).json({ error: 'Member not found' });
      const m = memberRec;
      const format = (req.query.format || 'csv').toLowerCase();
      const allSections = ['registry', 'followups', 'surveys', 'compliance', 'notes', 'meds'];
      const sections = req.query.sections ? req.query.sections.split(',').filter(s => allSections.includes(s)) : allSections;

      const data = {};

      // Registry items
      if (sections.includes('registry')) {
        const r = await dbClient.query(`
          SELECT urgency, source_stream, reason_text, dominant_driver, protocol_card, status,
                 created_ts, resolved_ts, resolution_notes
          FROM stability_registry WHERE member_link = $1 AND tenant_id = $2
          ORDER BY created_ts DESC
        `, [m.link, tenantId]);
        for (const row of r.rows) {
          row.created_ts = fmtTimestamp(row.created_ts);
          row.resolved_ts = fmtTimestamp(row.resolved_ts);
        }
        data.registry = r.rows;
      }

      // Follow-ups
      if (sections.includes('followups')) {
        const r = await dbClient.query(`
          SELECT rf.followup_type, rf.scheduled_date, rf.completed_ts, rf.outcome, rf.notes
          FROM registry_followup rf
          JOIN stability_registry sr ON sr.link = rf.registry_link
          WHERE sr.member_link = $1 AND rf.tenant_id = $2
          ORDER BY rf.scheduled_date DESC
        `, [m.link, tenantId]);
        data.followups = r.rows.map(row => ({
          ...row,
          scheduled_date_display: formatDateLocal(moleculeIntToDate(row.scheduled_date)),
          status: row.completed_ts ? 'Completed' : 'Pending'
        }));
      }

      // Surveys (wellness + Pulse submissions)
      if (sections.includes('surveys')) {
        const r = await dbClient.query(`
          SELECT s.survey_name, ms.start_ts, ms.end_ts, ms.voided_ts
          FROM member_survey ms
          JOIN survey s ON s.link = ms.survey_link
          WHERE ms.member_link = $1 AND ms.voided_ts IS NULL
          ORDER BY ms.start_ts DESC
        `, [m.link]);
        data.surveys = r.rows.map(row => ({
          survey_name: row.survey_name,
          started: row.start_ts ? billEpochToDate(row.start_ts).toISOString() : null,
          completed: row.end_ts ? billEpochToDate(row.end_ts).toISOString() : null
        }));
      }

      // Compliance results
      if (sections.includes('compliance')) {
        const r = await dbClient.query(`
          SELECT ci.item_name, cis.status_code, cr.result_date, cr.notes, cr.voided_ts
          FROM compliance_result cr
          JOIN member_compliance mc ON mc.member_compliance_id = cr.member_compliance_id
          JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
          JOIN compliance_item_status cis ON cis.status_id = cr.status_id
          WHERE mc.member_link = $1 AND cr.tenant_id = $2 AND cr.voided_ts IS NULL
          ORDER BY cr.result_date DESC
        `, [m.link, tenantId]);
        data.compliance = r.rows.map(row => ({
          ...row,
          result_date_display: row.result_date ? formatDateLocal(moleculeIntToDate(row.result_date)) : null
        }));
      }

      // Notes (member annotations) — vertical's own helper.
      if (sections.includes('notes')) {
        data.notes = (await getMemberNotes(ctx, m.link, tenantId)) ?? [];
      }

      // MEDS status — this participant's expected instrument set (v97), not
      // the tenant-global catalog. Assigned regime shows exactly the active
      // assignments (cadence override honored, one_time rows have no cadence).
      if (sections.includes('meds')) {
        const medsItems = [];
        const instruments = await getExpectedInstruments(dbClient, m.link, tenantId);
        for (const s of instruments) medsItems.push({ type: 'survey', name: s.survey_name, cadence: s.cadence_days, mode: s.mode });

        const comp = await dbClient.query(`
          SELECT ci.item_name, mc.cadence_days, mc.schedule_mode
          FROM member_compliance mc
          JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
          WHERE mc.member_link = $1 AND mc.tenant_id = $2 AND mc.status = 'active'
        `, [m.link, tenantId]);
        for (const c of comp.rows) medsItems.push({ type: 'compliance', name: c.item_name, cadence: c.cadence_days, mode: c.schedule_mode });
        data.meds = medsItems;
      }

      const memberName = `${m.title ? m.title + ' ' : ''}${m.fname} ${m.lname}`.trim();
      const timestamp = platformTodayStr();

      if (format === 'pdf') {
        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="chart_${m.membership_number}_${timestamp}.pdf"`);
        doc.pipe(res);

        // Header
        doc.fontSize(18).font('Helvetica-Bold').text(`Participant Chart: ${memberName}`, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`ID: ${m.membership_number} | Exported: ${timestamp}`, { align: 'center' });
        doc.moveDown(1.5);

        const addSection = (title, rows, cols) => {
          if (!rows || !rows.length) return;
          doc.fontSize(12).font('Helvetica-Bold').text(title);
          doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica');
          for (const row of rows) {
            const line = cols.map(c => `${c.label}: ${row[c.key] ?? ''}`).join(' | ');
            doc.text(line, { width: 500 });
          }
          doc.moveDown(1);
        };

        if (data.registry) addSection('Stability Registry', data.registry, [
          { key: 'urgency', label: 'Urgency' }, { key: 'source_stream', label: 'Source' },
          { key: 'reason_text', label: 'Reason' }, { key: 'dominant_driver', label: 'Driver' },
          { key: 'protocol_card', label: 'Card' }, { key: 'status', label: 'Status' }
        ]);
        if (data.followups) addSection('Follow-ups', data.followups, [
          { key: 'followup_type', label: 'Type' }, { key: 'scheduled_date_display', label: 'Scheduled' },
          { key: 'status', label: 'Status' }, { key: 'outcome', label: 'Outcome' }, { key: 'notes', label: 'Notes' }
        ]);
        if (data.surveys) addSection('Survey Submissions', data.surveys, [
          { key: 'survey_name', label: 'Survey' }, { key: 'started', label: 'Started' }, { key: 'completed', label: 'Completed' }
        ]);
        if (data.compliance) addSection('Compliance Results', data.compliance, [
          { key: 'item_name', label: 'Item' }, { key: 'status_code', label: 'Result' },
          { key: 'result_date_display', label: 'Date' }, { key: 'notes', label: 'Notes' }
        ]);
        if (data.notes) addSection('Notes & Outreach', data.notes, [
          { key: 'date_display', label: 'Date' }, { key: 'author', label: 'Author' }, { key: 'annotation_text', label: 'Note' }
        ]);
        if (data.meds) addSection('MEDS Configuration', data.meds, [
          { key: 'type', label: 'Type' }, { key: 'name', label: 'Name' }, { key: 'cadence', label: 'Cadence (days)' }, { key: 'mode', label: 'Mode' }
        ]);

        doc.end();

      } else {
        // CSV — section headers as separator rows
        let csvContent = '';
        const addCsvSection = (title, rows, cols) => {
          if (!rows || !rows.length) return;
          csvContent += `\n--- ${title} ---\n`;
          csvContent += toCsv(rows, cols) + '\n';
        };

        if (data.registry) addCsvSection('Stability Registry', data.registry, [
          { key: 'urgency', label: 'Urgency' }, { key: 'source_stream', label: 'Source' },
          { key: 'reason_text', label: 'Reason' }, { key: 'dominant_driver', label: 'Driver' },
          { key: 'protocol_card', label: 'Card' }, { key: 'status', label: 'Status' },
          { key: 'created_ts', label: 'Created' }, { key: 'resolved_ts', label: 'Resolved' },
          { key: 'resolution_notes', label: 'Resolution Notes' }
        ]);
        if (data.followups) addCsvSection('Follow-ups', data.followups, [
          { key: 'followup_type', label: 'Type' }, { key: 'scheduled_date_display', label: 'Scheduled' },
          { key: 'status', label: 'Status' }, { key: 'outcome', label: 'Outcome' }, { key: 'notes', label: 'Notes' }
        ]);
        if (data.surveys) addCsvSection('Survey Submissions', data.surveys, [
          { key: 'survey_name', label: 'Survey' }, { key: 'started', label: 'Started' }, { key: 'completed', label: 'Completed' }
        ]);
        if (data.compliance) addCsvSection('Compliance Results', data.compliance, [
          { key: 'item_name', label: 'Item' }, { key: 'status_code', label: 'Result' },
          { key: 'result_date_display', label: 'Date' }, { key: 'notes', label: 'Notes' }
        ]);
        if (data.notes) addCsvSection('Notes & Outreach', data.notes, [
          { key: 'date_display', label: 'Date' }, { key: 'author', label: 'Author' }, { key: 'annotation_text', label: 'Note' }
        ]);
        if (data.meds) addCsvSection('MEDS Configuration', data.meds, [
          { key: 'type', label: 'Type' }, { key: 'name', label: 'Name' }, { key: 'cadence', label: 'Cadence (days)' }, { key: 'mode', label: 'Mode' }
        ]);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="chart_${m.membership_number}_${timestamp}.csv"`);
        res.send(`Participant Chart: ${memberName} (ID: ${m.membership_number})\nExported: ${timestamp}\n${csvContent}`);
      }

    } catch (error) {
      console.error('Error in participant chart export:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

export default { register };
