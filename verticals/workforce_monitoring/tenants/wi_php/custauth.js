/**
 * custauth.js — Wisconsin PHP Custom Authorization / Hook Function
 */

import { calcPPII, recordPpiiSnapshot } from './scorePPII.js';
import { analyzeDominantDriver } from './dominantDriver.js';
import { detectExtendedCard } from './extendedCardDetector.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

let mlProcess = null;

// Module-level fallback. The live values come from admin_settings
// (ppii_red_threshold / ppii_orange_threshold / ppii_yellow_threshold) and
// are loaded per-call inside POST_ACCRUAL. Used only if the table is
// unreachable or a key is missing — matches the pattern_* fallback pattern.
const PPII_THRESHOLDS_DEFAULT = [
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
      // Event severity → signal. Threshold and signal name live in
      // sysparm (key='event_severity', detail rows code='threshold' /
      // 'signal_name') so a new tenant can tune severity bands without
      // code changes. Fall back to the historical 3 / EVENT_SEVERITY_3
      // if the rows are missing or the table is unreachable. DB query
      // only runs for EVENT activities, not every accrual.
      if (data.ACCRUAL_TYPE === 'EVENT') {
        let sevThreshold = 3;
        let sevSignal = 'EVENT_SEVERITY_3';
        try {
          const { tenantId, db } = context;
          if (db && tenantId) {
            const sevResult = await db.query(
              `SELECT sd.code, sd.value FROM sysparm s
               JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
               WHERE s.tenant_id = $1 AND s.sysparm_key = 'event_severity'`,
              [tenantId]
            );
            for (const r of sevResult.rows) {
              if (r.code === 'threshold')   sevThreshold = parseInt(r.value, 10);
              if (r.code === 'signal_name') sevSignal = r.value;
            }
          }
        } catch (e) { /* sysparm unavailable — use defaults */ }

        if (Number(data.base_points) >= sevThreshold) {
          data.SIGNAL = sevSignal;
        }
      }
      return data;

    case 'POST_ACCRUAL': {
      if (data.SIGNAL && PPII_SIGNALS.includes(data.SIGNAL)) return data;
      if (!RECALC_TRIGGERS.includes(data.ACCRUAL_TYPE)) return data;

      const { tenantId, memberLink, db, ppiiWeights, ppsiSubdomainWeights } = context;
      if (!db || !memberLink) return data;

      try {
        // Molecule SQL fragments — table + molecule id resolved through the
        // box (moleculeJoinSQL / moleculeCondSQL, MOLECULES.md §10). This
        // hook runs on every scoring accrual, and it no longer queries
        // molecule_def to build an id map first.
        const { moleculeJoinSQL, moleculeCondSQL } = context.molecules;
        const molSQL = {
          join: (key, refExpr, opts) => moleculeJoinSQL(tenantId, key, refExpr, opts),
          cond: (key, refExpr, opts) => moleculeCondSQL(tenantId, key, refExpr, opts)
        };
        const surveyJoin  = molSQL.join('MEMBER_SURVEY_LINK', 'a.link');
        const scoreJoin   = molSQL.join('MEMBER_POINTS', 'a.link', { left: true });
        const pulseJoin   = molSQL.join('PULSE_RESPONDENT_LINK', 'a.link');
        const compJoin    = molSQL.join('COMP_RESULT', 'a.link');
        const atJoin      = molSQL.join('ACCRUAL_TYPE', 'a.link');
        const noPulseCond = molSQL.cond('PULSE_RESPONDENT_LINK', 'a.link', { negate: true });

        // Stream A: PPSI — latest survey score (has MEMBER_SURVEY_LINK, no PULSE_RESPONDENT_LINK).
        // Score is normalized to 0..100 via member_survey.score_math_version:
        // v=1 (legacy raw sum, max 102) is scaled, v=2 (Option A, already 0..100) is pass-through.
        // PPII_MAXIMA.ppsi=100 so calcPPII consumes this scale directly.
        const ppsiResult = await db.query(`
          SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score,
                 COALESCE(ms.score_math_version, 1) AS math_version
          FROM activity a
          ${surveyJoin.sql}
          ${scoreJoin.sql}
          LEFT JOIN member_survey ms ON ms.link = ${surveyJoin.col}
          WHERE a.activity_type = 'A' AND a.p_link = $1
            AND ${noPulseCond}
          ORDER BY a.activity_date DESC LIMIT 1
        `, [memberLink]);
        const ppsiRaw = ppsiResult.rows.length
          ? (Number(ppsiResult.rows[0].math_version) === 2
              ? Math.min(100, Math.round(Number(ppsiResult.rows[0].score)))
              : Math.round(Number(ppsiResult.rows[0].score) * 100 / 102))
          : null;

        // Stream C: Provider Pulse — latest pulse score (has PULSE_RESPONDENT_LINK)
        const pulseResult = await db.query(`
          SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score
          FROM activity a
          ${pulseJoin.sql}
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A' AND a.p_link = $1
          ORDER BY a.activity_date DESC LIMIT 1
        `, [memberLink]);
        const pulseRaw = pulseResult.rows.length ? Number(pulseResult.rows[0].score) : null;

        // Stream B: Compliance — sum of last 6 COMP accrual scores (has COMP_RESULT)
        const compResult = await db.query(`
          SELECT SUM(sub.score) AS comp_score FROM (
            SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score
            FROM activity a
            ${compJoin.sql}
            ${scoreJoin.sql}
            WHERE a.activity_type = 'A' AND a.p_link = $1
            ORDER BY a.activity_date DESC LIMIT 6
          ) sub
        `, [memberLink]);
        const compRaw = compResult.rows.length && compResult.rows[0].comp_score !== null
          ? Number(compResult.rows[0].comp_score) : null;

        // Stream G: Events — most recent event severity (ACCRUAL_TYPE = EVENT, score from points)
        // The stored byte for ACCRUAL_TYPE='EVENT' comes from the box
        // (context.molecules.encodeMolecule → value_id, context.encodeValue →
        // stored CHAR) and is compared as an opaque value in SQL — it rides a
        // $ parameter, never the SQL string. The query never decodes molecule
        // bytes itself — the old ASCII(c1)-1 join here recreated the squish
        // encoding in SQL, a molecule-rule violation (fixed Session 134).
        // Tiebreaker on a.link DESC keeps selection stable for same-date events.
        const eventByte = context.encodeValue(
          await context.molecules.encodeMolecule(tenantId, 'ACCRUAL_TYPE', 'EVENT'), 1);
        const eventJoin = molSQL.join('ACCRUAL_TYPE', 'a.link', { valueExpr: '$1' });
        const eventResult = await db.query(`
          SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score
          FROM activity a
          ${eventJoin.sql}
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A' AND a.p_link = $2
          ORDER BY a.activity_date DESC, a.link DESC LIMIT 1
        `, [eventByte, memberLink]);
        const eventRaw = eventResult.rows.length ? Number(eventResult.rows[0].score) : null;

        // Calculate composite (v58: tenant-specific weights from context, hardcoded fallback in scorePPII.js)
        const ppii = calcPPII({ ppsiRaw, pulseRaw, compRaw, eventRaw, weights: ppiiWeights });
        if (ppii === null) return data;

        // ── Snapshot the score that just got produced ────────────────────
        // One row in ppii_score_history + one component row per non-null
        // stream. trigger_type carries data.ACCRUAL_TYPE so a later audit
        // can see *what* event drove the calc. weight_set_id is plumbed
        // through so a later weights change can show "previous PPII" on
        // the chart with the right version label. Failures are logged but
        // don't break the surrounding accrual flow — the snapshot is a
        // companion to the calc, not a precondition for it.
        try {
          await recordPpiiSnapshot(db, {
            tenantId,
            memberLink,
            ppii,
            components: { pulse: pulseRaw, ppsi: ppsiRaw, compliance: compRaw, events: eventRaw },
            weightSetId: ppiiWeights ? ppiiWeights.weight_set_id : undefined,
            triggerType: data.ACCRUAL_TYPE
          });
        } catch (snapErr) {
          console.error(`[custauth POST_ACCRUAL] ppii snapshot failed for member ${memberLink}: ${snapErr.message}`);
        }

        // Load PPII thresholds from sysparm (key='ppii_thresholds', detail
        // rows category='band' code='red'/'orange'/'yellow'). Fall back to
        // defaults if rows are missing — same shape as the pattern_* lookup
        // below.
        let ppiiThresholds = PPII_THRESHOLDS_DEFAULT;
        try {
          const thrResult = await db.query(
            `SELECT sd.code, sd.value FROM sysparm s
             JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
             WHERE s.tenant_id = $1 AND s.sysparm_key = 'ppii_thresholds'`,
            [tenantId]
          );
          if (thrResult.rows.length > 0) {
            const m = {};
            for (const r of thrResult.rows) m[r.code] = parseInt(r.value, 10);
            ppiiThresholds = [
              { min: m.red    ?? PPII_THRESHOLDS_DEFAULT[0].min, signal: 'PPII_RED' },
              { min: m.orange ?? PPII_THRESHOLDS_DEFAULT[1].min, signal: 'PPII_ORANGE' },
              { min: m.yellow ?? PPII_THRESHOLDS_DEFAULT[2].min, signal: 'PPII_YELLOW' },
            ];
          }
        } catch (e) { /* sysparm unavailable — use defaults */ }

        // Check thresholds (highest band first; bands are exclusive — first match wins)
        const threshold = ppiiThresholds.find(t => ppii >= t.min);

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
        // Load configurable thresholds from sysparm (key='pattern_triggers',
        // detail rows category='threshold' code='trend_periods'/'spike_delta'/
        // 'protective_periods'). Fall back to defaults if rows are missing.
        let patternConfig = { ...PATTERN_DEFAULTS };
        try {
          const cfgResult = await db.query(
            `SELECT sd.code, sd.value FROM sysparm s
             JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
             WHERE s.tenant_id = $1 AND s.sysparm_key = 'pattern_triggers'`,
            [tenantId]
          );
          for (const r of cfgResult.rows) {
            if (r.code === 'trend_periods')      patternConfig.TREND_CONSECUTIVE_PERIODS = parseInt(r.value);
            if (r.code === 'spike_delta')        patternConfig.SPIKE_DELTA_THRESHOLD = parseInt(r.value);
            if (r.code === 'protective_periods') patternConfig.PROTECTIVE_DECLINE_PERIODS = parseInt(r.value);
          }
        } catch(e) { /* sysparm unavailable — use defaults */ }

        // Get recent PPII composite scores for this member (last N+1 for trend/spike)
        const historyCount = Math.max(patternConfig.TREND_CONSECUTIVE_PERIODS + 1, 4);
        const ppiiHistory = await db.query(`
          SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score, a.activity_date
          FROM activity a
          ${atJoin.sql}
          JOIN molecule_value_embedded_list mvel ON mvel.molecule_id = ${atJoin.alias}.molecule_id AND mvel.link = ${atJoin.col} AND mvel.code = 'SURVEY'
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A' AND a.p_link = $1
          ORDER BY a.activity_date DESC LIMIT $2
        `, [memberLink, historyCount]);
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
        // Prior-period PPSI for dominant-driver delta. Same v=1/v=2
        // normalization as the current row above so the delta is computed
        // on a single 0..100 scale.
        const ppsiPrior = await db.query(`
          SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score,
                 COALESCE(ms.score_math_version, 1) AS math_version
          FROM activity a
          ${surveyJoin.sql}
          ${scoreJoin.sql}
          LEFT JOIN member_survey ms ON ms.link = ${surveyJoin.col}
          WHERE a.activity_type = 'A' AND a.p_link = $1
            AND ${noPulseCond}
          ORDER BY a.activity_date DESC LIMIT 1 OFFSET 1
        `, [memberLink]);
        const ppsiRawPrior = ppsiPrior.rows.length
          ? (Number(ppsiPrior.rows[0].math_version) === 2
              ? Math.min(100, Math.round(Number(ppsiPrior.rows[0].score)))
              : Math.round(Number(ppsiPrior.rows[0].score) * 100 / 102))
          : null;

        const pulsePrior = await db.query(`
          SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score
          FROM activity a
          ${pulseJoin.sql}
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A' AND a.p_link = $1
          ORDER BY a.activity_date DESC LIMIT 1 OFFSET 1
        `, [memberLink]);
        const pulseRawPrior = pulsePrior.rows.length ? Number(pulsePrior.rows[0].score) : null;

        const compPrior = await db.query(`
          SELECT SUM(sub.score) AS comp_score FROM (
            SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score
            FROM activity a
            ${compJoin.sql}
            ${scoreJoin.sql}
            WHERE a.activity_type = 'A' AND a.p_link = $1
            ORDER BY a.activity_date DESC LIMIT 6 OFFSET 6
          ) sub
        `, [memberLink]);
        const compRawPrior = compPrior.rows.length && compPrior.rows[0].comp_score !== null
          ? Number(compPrior.rows[0].comp_score) : null;

        const eventPrior = await db.query(`
          SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score
          FROM activity a
          ${atJoin.sql}
          JOIN molecule_value_embedded_list mvel ON mvel.molecule_id = ${atJoin.alias}.molecule_id AND mvel.link = ${atJoin.col} AND mvel.code = 'EVENT'
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A' AND a.p_link = $1
          ORDER BY a.activity_date DESC LIMIT 1 OFFSET 1
        `, [memberLink]);
        const eventRawPrior = eventPrior.rows.length ? Number(eventPrior.rows[0].score) : null;

        // Run dominant driver analysis
        let driverResult = { dominant_driver: null, dominant_subdomain: null, protocol_card: null };
        try {
          driverResult = await analyzeDominantDriver(
            db, memberLink, tenantId,
            { ppsiRaw, pulseRaw, compRaw, eventRaw },
            { ppsiRaw: ppsiRawPrior, pulseRaw: pulseRawPrior, compRaw: compRawPrior, eventRaw: eventRawPrior },
            ppsiSubdomainWeights
          );
        } catch (driverErr) {
          console.error('Dominant driver analysis error (non-fatal):', driverErr.message);
        }

        // Run extended card detection (M1-M3, T1-T4, D2-D3)
        let extendedCard = null;
        try {
          extendedCard = await detectExtendedCard(
            db, memberLink, tenantId,
            { ppsiRaw, pulseRaw, compRaw, eventRaw },
            { ppsiRaw: ppsiRawPrior, pulseRaw: pulseRawPrior, compRaw: compRawPrior, eventRaw: eventRawPrior },
            data.ACCRUAL_TYPE,
            molSQL
          );
          if (extendedCard) {
            console.log(`   Extended card detected: ${extendedCard} for member ${memberLink}`);
          }
        } catch (extErr) {
          console.error('Extended card detection error (non-fatal):', extErr.message);
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
        const postPayload = {
          tenant_id: tenantId,
          // Pin to Central time so the activity_date is deterministic
          // regardless of where the server runs (Heroku dyno can land in
          // any region; without the timeZone, near-midnight CST events
          // could land on the wrong day). Closest analog we have to
          // platformToday() inside a custauth file — todayLocal() lives
          // in pointers.js scope and isn't importable here.
          activity_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }),
          base_points: ppii,
          ACCRUAL_TYPE: 'SURVEY',
          SIGNAL: activeSignal,
          ACTIVITY_COMMENT: activeComment,
          DOMINANT_DRIVER: driverResult.dominant_driver,
          DOMINANT_SUBDOMAIN: driverResult.dominant_subdomain,
          PROTOCOL_CARD: driverResult.protocol_card
        };
        if (extendedCard) postPayload.EXTENDED_CARD = extendedCard;
        const postData = JSON.stringify(postPayload);

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

    case 'FILTER_MEMBER_LIST': {
      // Exclude clinicians from any member list (search, roster, MEDS, ML batch)
      const { tenantId, molecules } = context;
      if (!molecules?.getFlaggedLinks || !data || !data.length) return data;

      try {
        // IS_CLINICIAN is a flag molecule — presence marks the member as
        // clinical staff. The platform flag helper is the one door.
        const flagged = await molecules.getFlaggedLinks('IS_CLINICIAN', tenantId);
        // Compare as hex strings — Buffer === comparison fails by reference
        const clinicianLinks = new Set(flagged.map(l => Buffer.isBuffer(l) ? l.toString('hex') : String(l)));
        if (clinicianLinks.size === 0) return data;

        return data.filter(m => {
          const key = Buffer.isBuffer(m.link) ? m.link.toString('hex') : String(m.link);
          return !clinicianLinks.has(key);
        });
      } catch (e) {
        console.error('FILTER_MEMBER_LIST error (non-fatal):', e.message);
        return data;
      }
    }

    case 'STARTUP': {
      // Launch ML service as a child process
      const projectRoot = context?.projectRoot || process.cwd();
      const mlScript = path.join(projectRoot, 'ml', 'ml_service.py');

      try {
        // Kill any existing ML process from a previous run
        if (mlProcess) {
          mlProcess.kill();
          mlProcess = null;
        }

        mlProcess = spawn('python3', [mlScript], {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        });

        mlProcess.on('error', (e) => {
          console.warn(`[ML Service] Not available: ${e.message} — Predictive Risk card will show 'service unavailable'`);
          mlProcess = null;
        });
        mlProcess.stdout.on('data', (d) => {
          const msg = d.toString().trim();
          if (msg) console.log(`[ML Service] ${msg}`);
        });
        mlProcess.stderr.on('data', (d) => {
          const msg = d.toString().trim();
          if (msg && !msg.includes('WARNING:')) console.error(`[ML Service] ${msg}`);
        });
        mlProcess.on('exit', (code) => {
          console.log(`[ML Service] exited with code ${code}`);
          mlProcess = null;
        });

        console.log(`[ML Service] Started (PID ${mlProcess.pid}) on port 5050`);
      } catch (e) {
        console.warn(`[ML Service] Not available: ${e.message} — Predictive Risk card will show 'service unavailable'`);
      }
      return data;
    }

    default:
      return data;
  }
}
