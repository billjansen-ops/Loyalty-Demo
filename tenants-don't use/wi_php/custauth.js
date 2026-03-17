/**
 * custauth.js — Wisconsin PHP Custom Authorization / Hook Function
 */

import { calcPPII } from './scorePPII.js';

const PPII_THRESHOLDS = [
  { min: 75, signal: 'PPII_RED' },
  { min: 55, signal: 'PPII_ORANGE' },
  { min: 35, signal: 'PPII_YELLOW' },
];

const RECALC_TRIGGERS = ['SURVEY', 'PULSE', 'COMP', 'EVENT'];
const PPII_SIGNALS = ['PPII_RED', 'PPII_ORANGE', 'PPII_YELLOW'];

export default async function custauth(hook, data, context) {
  switch (hook) {

    case 'PRE_ACCRUAL':
      if (data.ACCRUAL_TYPE === 'EVENT' && Number(data.base_points) >= 3) {
        data.SIGNAL = 'EVENT_SEVERITY_3';
      }
      return data;

    case 'POST_ACCRUAL': {
      if (data.SIGNAL && PPII_SIGNALS.includes(data.SIGNAL)) return data;
      if (!RECALC_TRIGGERS.includes(data.ACCRUAL_TYPE)) return data;

      const { tenantId, memberLink, db } = context;
      if (!db || !memberLink) return data;

      try {
        // Get molecule IDs we need
        const molIds = await db.query(`
          SELECT molecule_key, molecule_id FROM molecule_def
          WHERE tenant_id = $1 AND molecule_key IN ('MEMBER_SURVEY_LINK', 'MEMBER_POINTS', 'PULSE_RESPONDENT_LINK', 'COMP_RESULT', 'ACCRUAL_TYPE')
        `, [tenantId]);

        const mid = {};
        for (const r of molIds.rows) mid[r.molecule_key] = r.molecule_id;

        // Stream A: PPSI — latest survey score (has MEMBER_SURVEY_LINK, no PULSE_RESPONDENT_LINK)
        const ppsiResult = await db.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $4
            AND NOT EXISTS (SELECT 1 FROM "5_data_4" d4b WHERE d4b.p_link = a.link AND d4b.molecule_id = $3)
          ORDER BY a.activity_date DESC LIMIT 1
        `, [mid.MEMBER_SURVEY_LINK, mid.MEMBER_POINTS, mid.PULSE_RESPONDENT_LINK, memberLink]);
        const ppsiRaw = ppsiResult.rows.length ? Number(ppsiResult.rows[0].score) : null;

        // Stream C: Provider Pulse — latest pulse score (has PULSE_RESPONDENT_LINK)
        const pulseResult = await db.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $3
          ORDER BY a.activity_date DESC LIMIT 1
        `, [mid.PULSE_RESPONDENT_LINK, mid.MEMBER_POINTS, memberLink]);
        const pulseRaw = pulseResult.rows.length ? Number(pulseResult.rows[0].score) : null;

        // Stream B: Compliance — sum of last 6 COMP accrual scores (has COMP_RESULT)
        const compResult = await db.query(`
          SELECT SUM(sub.score) AS comp_score FROM (
            SELECT COALESCE(d54.n1, 0) AS score
            FROM activity a
            JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
            LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
            WHERE a.activity_type = 'A' AND a.p_link = $3
            ORDER BY a.activity_date DESC LIMIT 6
          ) sub
        `, [mid.COMP_RESULT, mid.MEMBER_POINTS, memberLink]);
        const compRaw = compResult.rows.length && compResult.rows[0].comp_score !== null
          ? Number(compResult.rows[0].comp_score) : null;

        // Stream G: Events — most recent event severity (ACCRUAL_TYPE = EVENT, score from points)
        // Events use ACCRUAL_TYPE embedded list code 'EVENT' (encoded value 3 in 5_data_1)
        // Score = member_points n1 on that activity
        const accrualTypeMolId = mid.ACCRUAL_TYPE;
        const eventResult = await db.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_1" d1 ON d1.p_link = a.link AND d1.molecule_id = $1
          JOIN molecule_value_embedded_list mvel ON mvel.molecule_id = d1.molecule_id AND mvel.link = d1.c1 AND mvel.code = 'EVENT'
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $3
          ORDER BY a.activity_date DESC LIMIT 1
        `, [accrualTypeMolId, mid.MEMBER_POINTS, memberLink]);
        const eventRaw = eventResult.rows.length ? Number(eventResult.rows[0].score) : null;

        // Calculate composite
        const ppii = calcPPII({ ppsiRaw, pulseRaw, compRaw, eventRaw });
        if (ppii === null) return data;

        // Check thresholds
        const threshold = PPII_THRESHOLDS.find(t => ppii >= t.min);
        if (!threshold) return data;

        // Skip if already open registry item for this signal
        const existingResult = await db.query(`
          SELECT 1 FROM stability_registry
          WHERE member_link = $1 AND tenant_id = $2 AND status IN ('O', 'A') AND reason_code = $3
          LIMIT 1
        `, [memberLink, tenantId, threshold.signal]);
        if (existingResult.rows.length > 0) return data;

        // Create PPII composite accrual via internal HTTP
        const mnResult = await db.query(
          `SELECT membership_number FROM member WHERE link = $1 LIMIT 1`, [memberLink]
        );
        if (!mnResult.rows.length) return data;

        const http = await import('http');
        const postData = JSON.stringify({
          tenant_id: tenantId,
          activity_date: new Date().toLocaleDateString('en-CA'),
          base_points: ppii,
          ACCRUAL_TYPE: 'SURVEY',
          SIGNAL: threshold.signal,
          ACTIVITY_COMMENT: `PPII composite ${ppii} — ${threshold.signal}`
        });

        await new Promise((resolve, reject) => {
          const req = http.request({
            hostname: '127.0.0.1',
            port: process.env.PORT || 4001,
            path: `/v1/members/${mnResult.rows[0].membership_number}/accruals`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': String(tenantId) }
          }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(body));
          });
          req.on('error', reject);
          req.write(postData);
          req.end();
        });

      } catch (err) {
        console.error('POST_ACCRUAL PPII recalc error:', err.message);
      }

      return data;
    }

    case 'POST_ENROLL': {
      // Auto-assign all active compliance items to newly enrolled physician
      const { memberLink, membershipNumber, tenantId, db } = data;
      if (!db || !memberLink) return data;

      try {
        // Get all active compliance items for this tenant
        const itemsResult = await db.query(
          `SELECT compliance_item_id FROM compliance_item
           WHERE tenant_id = $1 AND status = 'active'`,
          [tenantId]
        );

        // Assign each to the new member
        for (const item of itemsResult.rows) {
          await db.query(
            `INSERT INTO member_compliance (member_link, compliance_item_id, cadence, tenant_id)
             VALUES ($1, $2, 'monthly', $3)
             ON CONFLICT DO NOTHING`,
            [memberLink, item.compliance_item_id, tenantId]
          );
        }

        console.log(`POST_ENROLL: Assigned ${itemsResult.rows.length} compliance items to ${membershipNumber}`);
      } catch (err) {
        console.error('POST_ENROLL compliance assignment error:', err.message);
      }

      return data;
    }

    default:
      return data;
  }
}
