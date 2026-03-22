/**
 * custauth.js — Wisconsin PHP Custom Authorization / Hook Function
 */

import { calcPPII } from './scorePPII.js';
import { analyzeDominantDriver } from './dominantDriver.js';

const PPII_THRESHOLDS = [
  { min: 75, signal: 'PPII_RED' },
  { min: 55, signal: 'PPII_ORANGE' },
  { min: 35, signal: 'PPII_YELLOW' },
];

const RECALC_TRIGGERS = ['SURVEY', 'PULSE', 'COMP', 'EVENT'];
const PPII_SIGNALS = ['PPII_RED', 'PPII_ORANGE', 'PPII_YELLOW'];

// Pattern-based trigger defaults (configurable via admin_settings)
const PATTERN_DEFAULTS = {
  TREND_CONSECUTIVE_PERIODS: 3,   // # of consecutive rising periods
  SPIKE_DELTA_THRESHOLD: 15,      // point jump in one period
  PROTECTIVE_DECLINE_PERIODS: 2,  // # of consecutive surveys with all 3 declining
};
const PATTERN_SIGNALS = ['PPII_TREND_UP', 'PPII_SPIKE', 'PROTECTIVE_COLLAPSE'];

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

        if (threshold) {
          // Skip if already open registry item for this signal
          const existingResult = await db.query(`
            SELECT 1 FROM stability_registry
            WHERE member_link = $1 AND tenant_id = $2 AND status IN ('O', 'A') AND reason_code = $3
            LIMIT 1
          `, [memberLink, tenantId, threshold.signal]);
          if (existingResult.rows.length > 0) {
            // Threshold already handled — still check patterns below
          } else {
            // Threshold crossed — will create registry item below
          }
        }

        // --- Pattern-Based Trigger Detection ---
        // Load configurable thresholds (fall back to defaults)
        let patternConfig = { ...PATTERN_DEFAULTS };
        try {
          const cfgResult = await db.query(
            `SELECT setting_key, setting_value FROM admin_settings WHERE tenant_id = $1 AND setting_key LIKE 'pattern_%'`,
            [tenantId]
          );
          for (const r of cfgResult.rows) {
            if (r.setting_key === 'pattern_trend_periods') patternConfig.TREND_CONSECUTIVE_PERIODS = parseInt(r.setting_value);
            if (r.setting_key === 'pattern_spike_delta') patternConfig.SPIKE_DELTA_THRESHOLD = parseInt(r.setting_value);
            if (r.setting_key === 'pattern_protective_periods') patternConfig.PROTECTIVE_DECLINE_PERIODS = parseInt(r.setting_value);
          }
        } catch(e) { /* admin_settings may not exist yet — use defaults */ }

        // Get recent PPII composite scores for this member (last N+1 for trend/spike)
        const historyCount = Math.max(patternConfig.TREND_CONSECUTIVE_PERIODS + 1, 4);
        const ppiiHistory = await db.query(`
          SELECT COALESCE(d54.n1, 0) AS score, a.activity_date
          FROM activity a
          JOIN "5_data_1" d1 ON d1.p_link = a.link AND d1.molecule_id = $1
          JOIN molecule_value_embedded_list mvel ON mvel.molecule_id = d1.molecule_id AND mvel.link = d1.c1 AND mvel.code = 'SURVEY'
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $3
          ORDER BY a.activity_date DESC LIMIT $4
        `, [accrualTypeMolId, mid.MEMBER_POINTS, memberLink, historyCount]);
        const scores = ppiiHistory.rows.map(r => Number(r.score));

        let patternTriggered = null;

        // 1. PPII_SPIKE — current vs previous score
        if (!patternTriggered && scores.length >= 2) {
          const delta = scores[0] - scores[1];
          if (delta >= patternConfig.SPIKE_DELTA_THRESHOLD) {
            patternTriggered = { signal: 'PPII_SPIKE', reason: `PPII jumped ${delta} points in one period (threshold: ${patternConfig.SPIKE_DELTA_THRESHOLD})` };
          }
        }

        // 2. PPII_TREND_UP — N consecutive increases
        if (!patternTriggered && scores.length >= patternConfig.TREND_CONSECUTIVE_PERIODS) {
          let trending = true;
          for (let i = 0; i < patternConfig.TREND_CONSECUTIVE_PERIODS - 1; i++) {
            if (scores[i] <= scores[i + 1]) { trending = false; break; }
          }
          if (trending) {
            patternTriggered = { signal: 'PPII_TREND_UP', reason: `PPII rising for ${patternConfig.TREND_CONSECUTIVE_PERIODS} consecutive periods` };
          }
        }

        // 3. PROTECTIVE_COLLAPSE — sections 4 (Isolation), 6 (Recovery), 7 (Purpose) all declining
        if (!patternTriggered && data.ACCRUAL_TYPE === 'SURVEY') {
          try {
            const protectiveHistory = await db.query(`
              SELECT ms.link as survey_link, ms.start_ts,
                SUM(CASE WHEN sq.category_link = 4 THEN CAST(msa.answer AS INTEGER) ELSE 0 END) as isolation,
                SUM(CASE WHEN sq.category_link = 6 THEN CAST(msa.answer AS INTEGER) ELSE 0 END) as recovery,
                SUM(CASE WHEN sq.category_link = 7 THEN CAST(msa.answer AS INTEGER) ELSE 0 END) as purpose
              FROM member_survey ms
              JOIN member_survey_answer msa ON msa.member_survey_link = ms.link
              JOIN survey_question sq ON sq.link = msa.question_link
              WHERE ms.member_link = $1 AND sq.category_link IN (4, 6, 7)
              GROUP BY ms.link, ms.start_ts
              ORDER BY ms.start_ts DESC
              LIMIT $2
            `, [memberLink, patternConfig.PROTECTIVE_DECLINE_PERIODS + 1]);

            const pRows = protectiveHistory.rows;
            if (pRows.length >= patternConfig.PROTECTIVE_DECLINE_PERIODS + 1) {
              let allDeclining = true;
              for (let i = 0; i < patternConfig.PROTECTIVE_DECLINE_PERIODS; i++) {
                // Higher score = worse (0-3 scale), so "declining" means scores are increasing
                if (pRows[i].isolation <= pRows[i + 1].isolation ||
                    pRows[i].recovery <= pRows[i + 1].recovery ||
                    pRows[i].purpose <= pRows[i + 1].purpose) {
                  allDeclining = false;
                  break;
                }
              }
              if (allDeclining) {
                patternTriggered = { signal: 'PROTECTIVE_COLLAPSE', reason: 'Isolation, Recovery, and Purpose scores all worsening over consecutive surveys' };
              }
            }
          } catch(e) { /* non-fatal — protective collapse check failed */ }
        }

        // If pattern triggered, check for duplicate and create registry item
        if (patternTriggered) {
          const existingPattern = await db.query(`
            SELECT 1 FROM stability_registry
            WHERE member_link = $1 AND tenant_id = $2 AND status IN ('O', 'A') AND reason_code = $3
            LIMIT 1
          `, [memberLink, tenantId, patternTriggered.signal]);

          if (existingPattern.rows.length === 0) {
            // No threshold crossed but pattern detected — create via internal HTTP below
            if (!threshold) {
              // Use pattern as the signal for registry item creation
              data.SIGNAL = patternTriggered.signal;
              data.ACTIVITY_COMMENT = patternTriggered.reason;
            }
          } else {
            patternTriggered = null; // already open
          }
        }

        // Nothing to act on — no threshold crossed and no new pattern
        if (!threshold && !patternTriggered) return data;

        // If threshold already has an open item and no pattern triggered, skip
        if (threshold && !patternTriggered) {
          const existingResult = await db.query(`
            SELECT 1 FROM stability_registry
            WHERE member_link = $1 AND tenant_id = $2 AND status IN ('O', 'A') AND reason_code = $3
            LIMIT 1
          `, [memberLink, tenantId, threshold.signal]);
          if (existingResult.rows.length > 0) return data;
        }

        // --- Dominant Driver Analysis ---
        // Get prior-period stream scores for comparison (2nd most recent for each stream)
        const ppsiPrior = await db.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $4
            AND NOT EXISTS (SELECT 1 FROM "5_data_4" d4b WHERE d4b.p_link = a.link AND d4b.molecule_id = $3)
          ORDER BY a.activity_date DESC LIMIT 1 OFFSET 1
        `, [mid.MEMBER_SURVEY_LINK, mid.MEMBER_POINTS, mid.PULSE_RESPONDENT_LINK, memberLink]);
        const ppsiRawPrior = ppsiPrior.rows.length ? Number(ppsiPrior.rows[0].score) : null;

        const pulsePrior = await db.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $3
          ORDER BY a.activity_date DESC LIMIT 1 OFFSET 1
        `, [mid.PULSE_RESPONDENT_LINK, mid.MEMBER_POINTS, memberLink]);
        const pulseRawPrior = pulsePrior.rows.length ? Number(pulsePrior.rows[0].score) : null;

        const compPrior = await db.query(`
          SELECT SUM(sub.score) AS comp_score FROM (
            SELECT COALESCE(d54.n1, 0) AS score
            FROM activity a
            JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
            LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
            WHERE a.activity_type = 'A' AND a.p_link = $3
            ORDER BY a.activity_date DESC LIMIT 6 OFFSET 6
          ) sub
        `, [mid.COMP_RESULT, mid.MEMBER_POINTS, memberLink]);
        const compRawPrior = compPrior.rows.length && compPrior.rows[0].comp_score !== null
          ? Number(compPrior.rows[0].comp_score) : null;

        const eventPrior = await db.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_1" d1 ON d1.p_link = a.link AND d1.molecule_id = $1
          JOIN molecule_value_embedded_list mvel ON mvel.molecule_id = d1.molecule_id AND mvel.link = d1.c1 AND mvel.code = 'EVENT'
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $3
          ORDER BY a.activity_date DESC LIMIT 1 OFFSET 1
        `, [accrualTypeMolId, mid.MEMBER_POINTS, memberLink]);
        const eventRawPrior = eventPrior.rows.length ? Number(eventPrior.rows[0].score) : null;

        // Run dominant driver analysis
        let driverResult = { dominant_driver: null, dominant_subdomain: null, protocol_card: null };
        try {
          driverResult = await analyzeDominantDriver(
            db, memberLink, tenantId,
            { ppsiRaw, pulseRaw, compRaw, eventRaw },
            { ppsiRaw: ppsiRawPrior, pulseRaw: pulseRawPrior, compRaw: compRawPrior, eventRaw: eventRawPrior }
          );
        } catch (driverErr) {
          console.error('Dominant driver analysis error (non-fatal):', driverErr.message);
        }

        // Create PPII composite accrual via internal HTTP
        const mnResult = await db.query(
          `SELECT membership_number FROM member WHERE link = $1 LIMIT 1`, [memberLink]
        );
        if (!mnResult.rows.length) return data;

        const http = await import('http');
        const activeSignal = threshold ? threshold.signal : patternTriggered.signal;
        const activeComment = threshold
          ? `PPII composite ${ppii} — ${threshold.signal}`
          : `PPII ${ppii} — ${patternTriggered.reason}`;
        const postData = JSON.stringify({
          tenant_id: tenantId,
          activity_date: new Date().toLocaleDateString('en-CA'),
          base_points: ppii,
          ACCRUAL_TYPE: 'SURVEY',
          SIGNAL: activeSignal,
          ACTIVITY_COMMENT: activeComment,
          DOMINANT_DRIVER: driverResult.dominant_driver,
          DOMINANT_SUBDOMAIN: driverResult.dominant_subdomain,
          PROTOCOL_CARD: driverResult.protocol_card
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
