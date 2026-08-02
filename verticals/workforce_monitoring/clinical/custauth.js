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
// ML watchdog state (Session 142). The engine is a REQUIRED dependency —
// pointers.js refuses to boot without it — and a mid-run death is never
// silent: every automatic restart is logged durably; exhausting the
// restart budget fires the critical ML_ENGINE_DOWN notification.
let mlRestartTimer = null;
let mlExitTimes = [];
let mlDeliberateKill = false;
const ML_RESTART_DELAY_MS = 5000;         // wait before an automatic relaunch
const ML_RESTART_WINDOW_MS = 5 * 60_000;  // rolling window for counting deaths
const ML_MAX_RESTARTS = 3;                // deaths inside the window before giving up

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
// EVERY signal this hook can stamp on the accrual it files must be listed
// here — this is the recursion guard: a signal-carrying accrual re-enters
// POST_ACCRUAL (ACCRUAL_TYPE is SURVEY) and must return immediately. The
// pattern signals were missing from S95 until S162; the old duplicate-item
// check that used to catch the second pass matches nothing since the v67
// promotion→bonus conversion (items now file under the ACTION code, e.g.
// SR_YELLOW, not the signal), so an unlisted signal loops: re-detect →
// re-file → nested accrual → pool exhaustion. Masked 2026-03→08 only
// because the filing path itself was dead (the 401ed internal HTTP hop).
const PPII_SIGNALS = ['PPII_RED', 'PPII_ORANGE', 'PPII_YELLOW',
                      'PPII_SPIKE', 'PPII_TREND_UP', 'PROTECTIVE_COLLAPSE'];

// Pattern-based trigger defaults (configurable via admin_settings)
const PATTERN_DEFAULTS = {
  TREND_CONSECUTIVE_PERIODS: 3,   // # of consecutive rising periods
  SPIKE_DELTA_THRESHOLD: 15,      // point jump in one period
  PROTECTIVE_DECLINE_PERIODS: 2,  // # of consecutive surveys with all 3 declining
};

// "Never the same news twice while it's open": is there an open registry item
// this signal already produced? Items file under the ACTION code of whatever
// active bonus the signal fires (v67 turned the alert promotions into
// bonuses — e.g. PROTECTIVE_COLLAPSE files as SR_YELLOW), while
// promotion-era items (pre-v67) carry the SIGNAL name itself. This check
// matches both, resolving the action codes from live config — signal →
// active bonus whose criteria is SIGNAL equals this value → its external
// results → action codes — never a hardcoded map. (S162: the old check
// compared reason_code to the signal name only, so post-v67 it matched
// nothing and every qualifying submission re-filed the same news.)
async function openItemExistsForSignal(db, memberLink, tenantId, signal) {
  const r = await db.query(`
    SELECT 1 FROM stability_registry sr
    WHERE sr.member_link = $1 AND sr.tenant_id = $2 AND sr.status IN ('O','A')
      AND (sr.reason_code = $3 OR sr.reason_code IN (
        SELECT era.action_code
        FROM bonus b
        JOIN rule_criteria rc ON rc.rule_id = b.rule_id
          AND rc.molecule_key = 'SIGNAL' AND rc.value = to_jsonb($3::text)
        JOIN bonus_result br ON br.bonus_id = b.bonus_id AND br.result_type = 'external'
        JOIN external_result_action era ON era.action_id = br.result_reference_id
        WHERE b.tenant_id = $2 AND b.is_active = true
      ))
    LIMIT 1
  `, [memberLink, tenantId, signal]);
  return r.rows.length > 0;
}
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
        const { moleculeJoinSQL, moleculeCondSQL, flagCondSQL } = context.molecules;
        const molSQL = {
          join: (key, refExpr, opts) => moleculeJoinSQL(tenantId, key, refExpr, opts),
          cond: (key, refExpr, opts) => moleculeCondSQL(tenantId, key, refExpr, opts)
        };
        const surveyJoin  = molSQL.join('MEMBER_SURVEY_LINK', 'a.link');
        const scoreJoin   = molSQL.join('MEMBER_POINTS', 'a.link', { left: true });
        const pulseJoin   = molSQL.join('PULSE_RESPONDENT_LINK', 'a.link');
        const compJoin    = molSQL.join('COMP_RESULT', 'a.link');
        const noPulseCond = molSQL.cond('PULSE_RESPONDENT_LINK', 'a.link', { negate: true });
        // Soft-deleted activities must not feed scoring, trends, or driver
        // analysis (Session 161 — same fix as the wellness streams: the
        // timeline excluded them, these walks did not, so a deleted survey's
        // zero still steered PPII and the pattern detectors).
        const notDeleted  = flagCondSQL(tenantId, 'IS_DELETED', 'a.link', { attachesTo: 'A', negate: true });

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
            AND ${notDeleted}
          ORDER BY a.activity_date DESC, a.link DESC LIMIT 1
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
            AND ${notDeleted}
          ORDER BY a.activity_date DESC, a.link DESC LIMIT 1
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
              AND ${notDeleted}
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
            AND ${notDeleted}
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

        // (The real threshold open-item gate lives below, after pattern
        // detection — a no-op pre-check that discarded its own result was
        // removed here in S162.)

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

        // Get recent PPII composite scores for this member (last N+1 for trend/spike).
        // ACCRUAL_TYPE='SURVEY' matches by the box-encoded byte on a $ parameter
        // (the Stream G pattern above, S134). The old join here went through
        // molecule_value_embedded_list — EMPTY since the ~S126 internal-list
        // era, so scores was always [] and PPII_SPIKE / PPII_TREND_UP could
        // never fire on ANY tenant (S162 audit finding 1.1).
        const historyCount = Math.max(patternConfig.TREND_CONSECUTIVE_PERIODS + 1, 4);
        const surveyByte = context.encodeValue(
          await context.molecules.encodeMolecule(tenantId, 'ACCRUAL_TYPE', 'SURVEY'), 1);
        const atSurveyJoin = molSQL.join('ACCRUAL_TYPE', 'a.link', { valueExpr: '$3' });
        const ppiiHistory = await db.query(`
          SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score, a.activity_date
          FROM activity a
          ${atSurveyJoin.sql}
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A' AND a.p_link = $1
            AND ${notDeleted}
          ORDER BY a.activity_date DESC, a.link DESC LIMIT $2
        `, [memberLink, historyCount, surveyByte]);
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

        // 3. PROTECTIVE_COLLAPSE — Isolation, Recovery, and Purpose sections all declining.
        // Categories resolve by CODE per tenant: category links are wi_php-specific numbers
        // (4/6/7) but link_tank-allocated on every copied tenant (wa_php ISOLATION = -32765).
        if (!patternTriggered && data.ACCRUAL_TYPE === 'SURVEY') {
          try {
            const protectiveHistory = await db.query(`
              SELECT ms.link as survey_link, ms.start_ts,
                SUM(CASE WHEN sqc.category_code = 'ISOLATION' THEN CAST(msa.answer AS INTEGER) ELSE 0 END) as isolation,
                SUM(CASE WHEN sqc.category_code = 'RECOVERY' THEN CAST(msa.answer AS INTEGER) ELSE 0 END) as recovery,
                SUM(CASE WHEN sqc.category_code = 'PURPOSE' THEN CAST(msa.answer AS INTEGER) ELSE 0 END) as purpose
              FROM member_survey ms
              JOIN member_survey_answer msa ON msa.member_survey_link = ms.link
              JOIN survey_question sq ON sq.link = msa.question_link
              JOIN survey_question_category sqc ON sqc.link = sq.category_link
              WHERE ms.member_link = $1 AND ms.voided_ts IS NULL
                AND sqc.category_code IN ('ISOLATION', 'RECOVERY', 'PURPOSE')
              GROUP BY ms.link, ms.start_ts
              ORDER BY ms.start_ts DESC, ms.link DESC
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
          const alreadyOpen = await openItemExistsForSignal(db, memberLink, tenantId, patternTriggered.signal);

          if (!alreadyOpen) {
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
          if (await openItemExistsForSignal(db, memberLink, tenantId, threshold.signal)) return data;
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
            AND ${notDeleted}
          ORDER BY a.activity_date DESC, a.link DESC LIMIT 1 OFFSET 1
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
            AND ${notDeleted}
          ORDER BY a.activity_date DESC, a.link DESC LIMIT 1 OFFSET 1
        `, [memberLink]);
        const pulseRawPrior = pulsePrior.rows.length ? Number(pulsePrior.rows[0].score) : null;

        const compPrior = await db.query(`
          SELECT SUM(sub.score) AS comp_score FROM (
            SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score
            FROM activity a
            ${compJoin.sql}
            ${scoreJoin.sql}
            WHERE a.activity_type = 'A' AND a.p_link = $1
              AND ${notDeleted}
            ORDER BY a.activity_date DESC LIMIT 6 OFFSET 6
          ) sub
        `, [memberLink]);
        const compRawPrior = compPrior.rows.length && compPrior.rows[0].comp_score !== null
          ? Number(compPrior.rows[0].comp_score) : null;

        // ACCRUAL_TYPE='EVENT' via the box-encoded byte (eventByte from Stream G
        // above) — the old molecule_value_embedded_list join here was dead the
        // same way as the trend/spike history read (S162 audit finding 1.1),
        // so the events-stream prior was always null for driver analysis.
        const eventPriorJoin = molSQL.join('ACCRUAL_TYPE', 'a.link', { valueExpr: '$2' });
        const eventPrior = await db.query(`
          SELECT COALESCE(${scoreJoin.colN(2)}, 0) AS score
          FROM activity a
          ${eventPriorJoin.sql}
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A' AND a.p_link = $1
            AND ${notDeleted}
          ORDER BY a.activity_date DESC, a.link DESC LIMIT 1 OFFSET 1
        `, [memberLink, eventByte]);
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

        // Create PPII composite accrual through the platform's own pipeline,
        // handed in via context.createAccrual (Session 162). The old internal
        // HTTP hop hit the accruals route as an unauthenticated visitor: the
        // auth wall 401ed it and the response was never checked, so from
        // 2026-03-19 no threshold or pattern registry item was created on
        // any tenant. Failures are LOUD now — a refused signal accrual is a
        // safety alert that vanished.
        const mnResult = await db.query(
          `SELECT membership_number FROM member WHERE link = $1 LIMIT 1`, [memberLink]
        );
        if (!mnResult.rows.length) return data;

        const activeSignal = threshold ? threshold.signal : patternTriggered.signal;
        const activeComment = threshold
          ? `PPII composite ${ppii} — ${threshold.signal}`
          : `PPII ${ppii} — ${patternTriggered.reason}`;
        // Activity date in the TENANT's timezone (notification_delivery_config
        // is the per-tenant timezone home). Was pinned to America/Chicago —
        // a Washington signal filed 22:00–24:00 Pacific carried tomorrow's
        // date into trends and the registry timeline (S162 audit finding
        // 1.6). Central stays the fallback for tenants with no config row.
        let tenantTz = 'America/Chicago';
        try {
          const tzRes = await db.query(
            `SELECT timezone FROM notification_delivery_config WHERE tenant_id = $1`,
            [tenantId]
          );
          if (tzRes.rows.length && tzRes.rows[0].timezone) tenantTz = tzRes.rows[0].timezone;
        } catch (tzErr) {
          console.error('Tenant timezone lookup failed (falling back to Central):', tzErr.message);
        }
        const postPayload = {
          tenant_id: tenantId,
          activity_date: new Date().toLocaleDateString('en-CA', { timeZone: tenantTz }),
          base_points: ppii,
          ACCRUAL_TYPE: 'SURVEY',
          SIGNAL: activeSignal,
          ACTIVITY_COMMENT: activeComment,
          DOMINANT_DRIVER: driverResult.dominant_driver,
          DOMINANT_SUBDOMAIN: driverResult.dominant_subdomain,
          PROTOCOL_CARD: driverResult.protocol_card
        };
        if (extendedCard) postPayload.EXTENDED_CARD = extendedCard;

        if (typeof context.createAccrual !== 'function') {
          console.error(`[custauth POST_ACCRUAL] no createAccrual capability in context — ${activeSignal} for member ${memberLink} NOT filed`);
          return data;
        }
        const signalResp = await context.createAccrual(mnResult.rows[0].membership_number, postPayload);
        if (!signalResp || signalResp.status >= 400) {
          console.error(`[custauth POST_ACCRUAL] signal accrual refused (${signalResp ? signalResp.status : 'no response'}): ` +
            `${signalResp && signalResp.body ? signalResp.body.error : 'unknown'} — ${activeSignal} for member ${memberLink} NOT filed`);
        }

      } catch (err) {
        console.error('POST_ACCRUAL PPII recalc error:', err.message);
      }

      return data;
    }

    // POST_ENROLL compliance auto-assign RETIRED (Session 149, Bill's
    // call). It pre-dated the registrant/participant split, so it fired
    // for REGISTRANTS who haven't signed anything — and it had been
    // silently broken anyway (INSERT named a member_compliance column
    // that was renamed away; every call threw and was swallowed).
    // Compliance now starts when monitoring starts: participant
    // activation assigns the program's active set (intake.js).

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
      // Launch the ML engine as a child process — and keep it alive.
      // Session 142 (Bill's rule): the engine is a required dependency.
      // The platform refuses to BOOT without it (gate in pointers.js,
      // requireMlHealthy). If it dies while running: automatic restart,
      // with every restart LOGGED durably to error_log; if it keeps dying
      // (ML_MAX_RESTARTS exits inside ML_RESTART_WINDOW_MS) stop
      // thrashing, log at error level, and fire the critical
      // ML_ENGINE_DOWN notification (rule seeded v112) so a human knows
      // fresh risk scoring is offline. Nothing about this process is
      // silent anymore.
      const projectRoot = context?.projectRoot || process.cwd();
      const mlScript = path.join(projectRoot, 'ml', 'ml_service.py');
      const logPlatformError = context?.logPlatformError || (async () => {});
      const fireNotificationEvent = context?.fireNotificationEvent || (async () => {});
      const startupTenantId = context?.tenantId;

      const launchML = () => {
        mlProcess = spawn('python3', [mlScript], {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        });

        mlProcess.on('error', (e) => {
          // Spawn itself failed (no python3?) — the boot gate will catch
          // this at startup; mid-run it rides the same exit path budget.
          console.error(`[ML Service] Failed to launch: ${e.message}`);
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
          mlProcess = null;
          if (mlDeliberateKill) { mlDeliberateKill = false; return; }  // we killed it (re-STARTUP) — not a death

          // Date.now() here is elapsed-time measurement (allowed), not a date.
          const now = Date.now();
          mlExitTimes = mlExitTimes.filter(t => now - t < ML_RESTART_WINDOW_MS);
          mlExitTimes.push(now);

          if (mlExitTimes.length > ML_MAX_RESTARTS) {
            console.error(`[ML Service] Died ${mlExitTimes.length} times in ${ML_RESTART_WINDOW_MS / 60000} minutes — giving up. Fresh risk scoring is OFFLINE.`);
            logPlatformError('error', 'ml_watchdog',
              `ML engine died ${mlExitTimes.length} times in ${ML_RESTART_WINDOW_MS / 60000} minutes — automatic restarts exhausted; fresh risk scoring is OFFLINE until the engine is brought back`,
              { exit_code: code, deaths_in_window: mlExitTimes.length })
              .catch(() => {});
            fireNotificationEvent('ML_ENGINE_DOWN', startupTenantId, {
              detail: `It exited ${mlExitTimes.length} times in ${ML_RESTART_WINDOW_MS / 60000} minutes (last exit code ${code}).`
            }).catch((e) => console.error(`[ML Service] ML_ENGINE_DOWN notification failed: ${e.message}`));
            return;
          }

          console.warn(`[ML Service] Exited (code ${code}) — automatic restart in ${ML_RESTART_DELAY_MS / 1000}s (death ${mlExitTimes.length} of ${ML_MAX_RESTARTS} tolerated per ${ML_RESTART_WINDOW_MS / 60000}min)`);
          logPlatformError('warn', 'ml_watchdog',
            `ML engine exited (code ${code}) — automatic restart (death ${mlExitTimes.length} of ${ML_MAX_RESTARTS} in the ${ML_RESTART_WINDOW_MS / 60000}-minute window)`,
            { exit_code: code, deaths_in_window: mlExitTimes.length })
            .catch(() => {});
          mlRestartTimer = setTimeout(launchML, ML_RESTART_DELAY_MS);
        });

        if (mlProcess) console.log(`[ML Service] Started (PID ${mlProcess.pid}) on port 5050`);
      };

      try {
        // A re-STARTUP (database switch, cache reload) replaces the child
        // cleanly: cancel any pending relaunch, mark the kill deliberate
        // so the exit handler doesn't count it as a death, reset the budget.
        if (mlRestartTimer) { clearTimeout(mlRestartTimer); mlRestartTimer = null; }
        if (mlProcess) {
          mlDeliberateKill = true;
          mlProcess.kill();
          mlProcess = null;
        }
        mlExitTimes = [];
        launchML();
      } catch (e) {
        console.error(`[ML Service] Failed to launch: ${e.message}`);
      }
      return data;
    }

    default:
      return data;
  }
}
