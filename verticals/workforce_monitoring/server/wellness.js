/**
 * Workforce Monitoring — Wellness dashboard + pulse respondents +
 * the calcPPII callback bridge.
 *
 * Phase 5 of the Insight server extraction (Session 129). Moved from
 * pointers.js:
 *   - GET  /v1/wellness/members      (formerly L26548 — the heaviest single
 *                                     endpoint; computes PPII inline for
 *                                     every member returned)
 *   - POST /v1/pulse-respondents     (formerly L26515)
 *
 * Plus a registerCallbacks(ctx) hook that wires calcPPII into the
 * platform's verticalCallbacks registry. The only platform-side caller
 * of calcPPII after Phase 5 is gatherMemberFeatures in pointers.js;
 * that call site now does:
 *     verticalCallbacks.computePpii?.({...}) || ppsiCurrent
 * which falls back cleanly when the vertical isn't loaded.
 *
 * scorePPII.js is imported directly here (vertical-internal — allowed by
 * Decision 7 of docs/INSIGHT_EXTRACTION_DESIGN.md). The platform-side
 * static import at pointers.js:6 is what Phase 5 removed.
 */

import { calcPPII, normStream } from '../tenants/wi_php/scorePPII.js';
import { getExpectedInstruments } from './meds.js';

export function register(app, ctx) {
  const {
    getDbClient, getNextLink, getCustauth, caches, encodeValue
  } = ctx;
  const { getMoleculeId, getMoleculeStorageInfo, getMoleculeRows, decodeMolecule, encodeMolecule,
          bulkGetMoleculeValues, moleculeJoinSQL, moleculeCondSQL } = ctx.molecules;
  const { platformToday, moleculeIntToDate, formatDateLocal } = ctx.dates;

  // POST /v1/pulse-respondents — record a respondent for a Pulse member-survey
  app.post('/v1/pulse-respondents', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    try {
      const { member_survey_link, respondent_name, member_link } = req.body;
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
      if (!member_survey_link) return res.status(400).json({ error: 'member_survey_link required' });
      if (!respondent_name) return res.status(400).json({ error: 'respondent_name required' });

      const link = await getNextLink(tenantId, 'pulse_respondent');
      await dbClient.query(`
        INSERT INTO pulse_respondent (link, member_survey_link, respondent_name, member_link, tenant_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [link, member_survey_link, respondent_name, member_link || null, tenantId]);

      res.json({ link });
    } catch (error) {
      console.error('Error creating pulse respondent:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // WELLNESS DASHBOARD ENDPOINT
  // GET /v1/wellness/members — all members with PPII composite scores + risk tiers
  // PPII = four-stream composite: PP(35%) + PPSI(25%) + Compliance(25%) + Events(15%)
  // Each stream normalized to 0-100 before weighting. Falls back gracefully if stream has no data.
  // ============================================================
  app.get('/v1/wellness/members', async (req, res) => {
    const dbClient = getDbClient();
    if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    try {
      // All active members
      const programId = req.query.program_id ? parseInt(req.query.program_id) : null;

      // Build clinic filter if program_id provided
      let memberWhereClause = `WHERE tenant_id = $1 AND is_active = true`;
      const memberParams = [tenantId];
      if (programId) {
        const ppInfo = await getMoleculeStorageInfo(tenantId, 'PARTNER_PROGRAM');
        const col2 = ppInfo?.columns?.[1];
        if (col2) {
          const encoded = encodeValue(programId, col2.size, col2.valueType);
          memberWhereClause += ` AND link IN (SELECT p_link FROM ${ppInfo.tableName} WHERE molecule_id = ${ppInfo.moleculeId} AND attaches_to = 'M' AND ${col2.name} = $2)`;
          memberParams.push(encoded);
          console.log(`[wellness/members] clinic filter: programId=${programId}, encoded=${encoded}`);
        }
      }

      const memberResult = await dbClient.query(
        `SELECT link, membership_number, fname, lname, title, enroll_date
         FROM member
         ${memberWhereClause}
         ORDER BY lname, fname`,
        memberParams
      );

      // FILTER_MEMBER_LIST custauth hook — exclude clinicians etc.
      const custauth = await getCustauth(tenantId);
      const filteredMembers = await custauth('FILTER_MEMBER_LIST', memberResult.rows, { tenantId, db: dbClient, molecules: ctx.molecules });

      const memberLinks = filteredMembers.map(m => m.link);

      // Look up clinic (program) name per member via PARTNER_PROGRAM composite molecule
      const programByMember = {};
      try {
        const programIds = new Set();
        const ppByMember = await bulkGetMoleculeValues('PARTNER_PROGRAM', memberLinks, tenantId);
        for (const m of filteredMembers) {
          const rows = ppByMember.get(m.link) || [];
          if (rows.length > 0) {
            const progId = rows[0].N2; // second column = program_id, already decoded
            programByMember[m.link] = progId;
            programIds.add(progId);
          }
        }
        if (programIds.size > 0) {
          const progResult = await dbClient.query(
            `SELECT program_id, program_name FROM partner_program WHERE program_id = ANY($1)`,
            [Array.from(programIds)]
          );
          const progNames = {};
          for (const p of progResult.rows) progNames[p.program_id] = p.program_name;
          for (const [link, progId] of Object.entries(programByMember)) {
            programByMember[link] = progNames[progId] || 'Unassigned';
          }
        }
      } catch(ppErr) {
        console.warn('PARTNER_PROGRAM lookup failed:', ppErr.message);
      }

      // Look up licensing board per member via LICENSING_BOARD molecule
      const licensingBoardByMember = {};
      try {
        const boardIds = new Set();
        const lbByMember = await bulkGetMoleculeValues('LICENSING_BOARD', memberLinks, tenantId);
        for (const m of filteredMembers) {
          const rows = lbByMember.get(m.link) || [];
          if (rows.length > 0) {
            const boardId = rows[0].N1;
            licensingBoardByMember[m.link] = boardId;
            boardIds.add(boardId);
          }
        }
        if (boardIds.size > 0) {
          const boardResult = await dbClient.query(
            `SELECT licensing_board_id, board_code, board_name, profession FROM licensing_board WHERE licensing_board_id = ANY($1)`,
            [Array.from(boardIds)]
          );
          const boardMap = {};
          for (const b of boardResult.rows) boardMap[b.licensing_board_id] = b;
          for (const [link, boardId] of Object.entries(licensingBoardByMember)) {
            licensingBoardByMember[link] = boardMap[boardId] || null;
          }
        }
      } catch(lbErr) {
        console.warn('LICENSING_BOARD lookup failed:', lbErr.message);
      }

      // Look up referral source per member via REFERRAL_SOURCE internal-list molecule
      // (WisconsinPATH Stage 1 classification — how the participant entered the program).
      // Two-layer decode: getMoleculeRows → the stored value_id (C1); decodeMolecule → the
      // display code ('SELF'/'EMP'/'BOARD') and label ('Self-referral'/…). No table join —
      // internal-list values live in molecule_value_text (see docs/MOLECULES.md §2).
      const referralSourceByMember = {};
      try {
        const rsByMember = await bulkGetMoleculeValues('REFERRAL_SOURCE', memberLinks, tenantId);
        const decodedById = new Map(); // decode once per distinct value, not per member
        for (const m of filteredMembers) {
          const rows = rsByMember.get(m.link) || [];
          if (rows.length > 0 && rows[0].C1 != null) {
            const valueId = rows[0].C1;
            if (!decodedById.has(valueId)) {
              decodedById.set(valueId, {
                code:  await decodeMolecule(tenantId, 'REFERRAL_SOURCE', valueId),
                label: await decodeMolecule(tenantId, 'REFERRAL_SOURCE', valueId, 'label')
              });
            }
            referralSourceByMember[m.link] = decodedById.get(valueId);
          }
        }
      } catch(rsErr) {
        console.warn('REFERRAL_SOURCE lookup failed:', rsErr.message);
      }

      // ── Stream A: PPSI surveys (have MEMBER_SURVEY_LINK, no PULSE_RESPONDENT_LINK) ──
      // Score read from 5_data_54.n1 (MEMBER_POINTS molecule). Last 4 for trend.
      // Joins member_survey via the MEMBER_SURVEY_LINK value (a size-4 numeric
      // molecule whose stored value is offset-encoded the same way ms.link is)
      // to surface score_math_version per row — needed to normalize legacy raw
      // sums (v=1, max 102) and Option A scores (v=2, max 100) to the same
      // 0..100 scale.
      const surveyJoin = moleculeJoinSQL(tenantId, 'MEMBER_SURVEY_LINK', 'a.link');
      const scoreJoin  = moleculeJoinSQL(tenantId, 'MEMBER_POINTS', 'a.link', { left: true });
      const noPulseCond = moleculeCondSQL(tenantId, 'PULSE_RESPONDENT_LINK', 'a.link', { negate: true });

      const ppsiResult = await dbClient.query(
        `WITH ppsi_activities AS (
          SELECT a.link, a.p_link, a.activity_date,
                 COALESCE(${scoreJoin.colN(2)}, 0) AS ppsi_score,
                 COALESCE(ms.score_math_version, 1) AS math_version,
                 ROW_NUMBER() OVER (PARTITION BY a.p_link ORDER BY a.activity_date DESC, a.link DESC) AS rn
          FROM activity a
          ${surveyJoin.sql}
          ${scoreJoin.sql}
          LEFT JOIN member_survey ms ON ms.link = ${surveyJoin.col}
          WHERE a.activity_type = 'A'
            AND ${noPulseCond}
            AND a.p_link IN (SELECT link FROM member WHERE tenant_id = $1 AND is_active = true)
        )
        SELECT link, p_link, activity_date, ppsi_score, math_version, rn
        FROM ppsi_activities
        WHERE rn <= 4
        ORDER BY p_link, rn`,
        [tenantId]
      );

      const ppsiByMember = {};
      for (const row of ppsiResult.rows) {
        if (!ppsiByMember[row.p_link]) ppsiByMember[row.p_link] = [];
        ppsiByMember[row.p_link].push(row);
      }

      // ── Stream C: Provider Pulse (have PULSE_RESPONDENT_LINK). Max score = 42. ──
      const pulseJoin = moleculeJoinSQL(tenantId, 'PULSE_RESPONDENT_LINK', 'a.link');
      const pulseResult = await dbClient.query(
        `WITH pulse_activities AS (
          SELECT a.p_link,
                 COALESCE(${scoreJoin.colN(2)}, 0) AS pulse_score,
                 ROW_NUMBER() OVER (PARTITION BY a.p_link ORDER BY a.activity_date DESC, a.link DESC) AS rn
          FROM activity a
          ${pulseJoin.sql}
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A'
            AND a.p_link IN (SELECT link FROM member WHERE tenant_id = $1 AND is_active = true)
        )
        SELECT p_link, pulse_score
        FROM pulse_activities
        WHERE rn = 1`,
        [tenantId]
      );

      const pulseByMember = {};
      for (const row of pulseResult.rows) {
        pulseByMember[row.p_link] = row.pulse_score;
      }

      // ── Stream B: Compliance — sum of recent COMP accrual scores per member ──
      // Identified by COMP_RESULT molecule. Score from 5_data_54.n1. Last 6 entries, max raw = 18.
      const compJoin = moleculeJoinSQL(tenantId, 'COMP_RESULT', 'a.link');
      const compResult = await dbClient.query(
        `WITH comp_activities AS (
          SELECT a.p_link,
                 COALESCE(${scoreJoin.colN(2)}, 0) AS comp_score,
                 ROW_NUMBER() OVER (PARTITION BY a.p_link ORDER BY a.activity_date DESC, a.link DESC) AS rn
          FROM activity a
          ${compJoin.sql}
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A'
            AND a.p_link IN (SELECT link FROM member WHERE tenant_id = $1 AND is_active = true)
        )
        SELECT p_link, SUM(comp_score) AS comp_score, COUNT(*) AS comp_count
        FROM comp_activities
        WHERE rn <= 6
        GROUP BY p_link`,
        [tenantId]
      );

      const compByMember = {};
      for (const row of compResult.rows) {
        compByMember[row.p_link] = { score: parseInt(row.comp_score), count: parseInt(row.comp_count) };
      }

      // ── Stream G: Events — most recent event accrual severity per member ──
      // Events have no MEMBER_SURVEY_LINK, PULSE_RESPONDENT_LINK, or COMP_RESULT. Score from 5_data_54.n1.
      // Events stream — strict inclusion filter on ACCRUAL_TYPE='EVENT'.
      // The stored byte for ACCRUAL_TYPE='EVENT' is computed through the box
      // (encodeMolecule → value_id, encodeValue → stored CHAR) and compared as
      // an opaque value in SQL. The query never decodes molecule bytes itself —
      // the old ASCII(c1)-1 join here recreated the squish encoding in SQL,
      // which is a molecule-rule violation (fixed Session 134).
      // Tiebreaker on a.link DESC keeps selection stable for same-date events.
      const eventByte = encodeValue(await encodeMolecule(tenantId, 'ACCRUAL_TYPE', 'EVENT'), 1);
      const eventJoin = moleculeJoinSQL(tenantId, 'ACCRUAL_TYPE', 'a.link', { valueExpr: '$1' });
      const eventResult = await dbClient.query(
        `WITH event_activities AS (
          SELECT a.p_link,
                 COALESCE(${scoreJoin.colN(2)}, 0) AS event_score,
                 ROW_NUMBER() OVER (PARTITION BY a.p_link ORDER BY a.activity_date DESC, a.link DESC) AS rn
          FROM activity a
          ${eventJoin.sql}
          ${scoreJoin.sql}
          WHERE a.activity_type = 'A'
            AND a.p_link IN (SELECT link FROM member WHERE tenant_id = $2 AND is_active = true)
        )
        SELECT p_link, event_score
        FROM event_activities
        WHERE rn = 1`,
        [eventByte, tenantId]
      );

      const eventByMember = {};
      for (const row of eventResult.rows) {
        eventByMember[row.p_link] = row.event_score;
      }

      const TIER_COLORS = {
        SENTINEL: { tier: 'RED',    label: 'Red',    color: '#dc2626' },
        RED:      { tier: 'RED',    label: 'Red',    color: '#dc2626' },
        ORANGE:   { tier: 'ORANGE', label: 'Orange', color: '#ea580c' },
        YELLOW:   { tier: 'YELLOW', label: 'Yellow', color: '#ca8a04' },
        GREEN:    { tier: 'GREEN',  label: 'Green',  color: '#16a34a' }
      };

      // Get most severe open registry item per member (drives color, overrides score)
      const registryResult = await dbClient.query(`
        SELECT DISTINCT ON (sr.member_link)
          sr.member_link, sr.urgency, sr.score_at_creation
        FROM stability_registry sr
        WHERE sr.tenant_id = $1 AND sr.status != 'R'
        ORDER BY sr.member_link,
          CASE sr.urgency
            WHEN 'SENTINEL' THEN 0
            WHEN 'RED' THEN 1
            WHEN 'ORANGE' THEN 2
            WHEN 'YELLOW' THEN 3
            ELSE 4
          END,
          sr.created_ts DESC
      `, [tenantId]);

      const registryByMember = {};
      for (const r of registryResult.rows) {
        registryByMember[r.member_link] = r;
      }

      const TODAY_EPOCH = platformToday();

      // Normalize a PPSI row (carrying ppsi_score + math_version) to 0..100.
      // v=1 (legacy raw sum, max 102): score × 100 / 102 → rounded.
      // v=2 (Option A, already 0..100): pass through (clamped to 100).
      // PPII_MAXIMA.ppsi is 100 so calcPPII / ppsi_norm both consume this scale.
      const ppsiToHundred = (row) => {
        if (!row) return null;
        const v = Number(row.math_version);
        const score = Number(row.ppsi_score);
        return v === 2 ? Math.min(100, Math.round(score)) : normStream(score, 102);
      };

      const members = [];
      for (const m of filteredMembers) {
        const ppsiSurveys = ppsiByMember[m.link] || [];
        const latestPPSI  = ppsiSurveys[0] || null;
        const priorPPSI   = ppsiSurveys[1] || null;

        const ppsiNorm = ppsiToHundred(latestPPSI); // 0..100 across v=1 / v=2
        const ppsiPriorNorm = ppsiToHundred(priorPPSI);
        const pulseRaw = pulseByMember[m.link] !== undefined ? pulseByMember[m.link] : null;
        const compData = compByMember[m.link] || null;
        const compRaw  = compData ? compData.score : null;
        const eventRaw = eventByMember[m.link] !== undefined ? eventByMember[m.link] : null;

        // Compute PPII composite (delegated to tenants/wi_php/scorePPII.js).
        // ppsi feeds in pre-normalized 0..100 (PPII_MAXIMA.ppsi=100 makes
        // composer math an identity for the ppsi term).
        const ppiiWeights = caches.ppiiWeights.get(tenantId);
        let ppii = calcPPII({ ppsiRaw: ppsiNorm, pulseRaw, compRaw, eventRaw, weights: ppiiWeights });

        // Trend from PPSI (normalized delta — both already 0..100)
        let trend = 'none';
        if (ppsiNorm !== null && ppsiPriorNorm !== null) {
          const delta = ppsiNorm - ppsiPriorNorm;
          trend = delta >= 8 ? 'up' : delta <= -8 ? 'down' : 'stable';
        }

        // Color/tier from stability registry (most severe open item)
        let tier = null;
        const reg = registryByMember[m.link];
        if (reg) {
          const urgency = reg.urgency === 'SENTINEL' ? 'RED' : reg.urgency;
          tier = { ...TIER_COLORS[urgency], norm: ppii };
        } else {
          tier = { ...TIER_COLORS.GREEN, norm: ppii || 0 };
        }

        const lastPPSIDate = latestPPSI ? latestPPSI.activity_date : null;
        // Missed-survey flag honors the member's instrument assignment (v97):
        // getExpectedInstruments is the one source of "does this member owe
        // PPSI, and on what cadence". Not expected (unassigned/paused) = never
        // flagged; a cadence override changes the window; one_time is missed
        // only until a completion on/after its start_date.
        let missedSurvey = false;
        const expectedInstruments = await getExpectedInstruments(dbClient, m.link, tenantId);
        const ppsiExpected = expectedInstruments.find(i => i.survey_code === 'PPSI');
        if (ppsiExpected) {
          if (ppsiExpected.mode === 'one_time') {
            const satisfied = lastPPSIDate !== null && lastPPSIDate >= ppsiExpected.start_date;
            missedSurvey = !satisfied && TODAY_EPOCH > ppsiExpected.start_date;
          } else {
            // Don't flag missed survey for physicians enrolled within one cadence period
            const enrolledRecently = m.enroll_date && (TODAY_EPOCH - m.enroll_date) <= ppsiExpected.cadence_days;
            missedSurvey = !enrolledRecently && (!lastPPSIDate || (TODAY_EPOCH - lastPPSIDate) > ppsiExpected.cadence_days);
          }
        }

        members.push({
          membership_number: m.membership_number,
          title: m.title || null,
          fname: m.fname,
          lname: m.lname,
          enroll_date: m.enroll_date,
          program_name: programByMember[m.link] || 'Unassigned',
          licensing_board: licensingBoardByMember[m.link] || null,
          referral_source: referralSourceByMember[m.link] || null,
          psrs: ppii,   // psrs field kept for UI compatibility — now holds PPII composite
          ppii,
          ppsi_norm:       ppsiNorm,
          pulse_norm:      pulseRaw !== null ? normStream(pulseRaw, 42) : null,
          compliance_norm: compRaw  !== null ? normStream(compRaw, 18) : null,
          events_norm:     eventRaw !== null ? normStream(eventRaw, 3) : null,
          tier,
          trend,
          latest_score: latestPPSI ? latestPPSI.ppsi_score : null,
          latest_date: latestPPSI ? formatDateLocal(moleculeIntToDate(latestPPSI.activity_date)) : null,
          survey_count: ppsiSurveys.length,
          missed_survey: missedSurvey,
          scores: ppsiSurveys.map(s => ({
            date: formatDateLocal(moleculeIntToDate(s.activity_date)),
            ppsi: s.ppsi_score,
            norm: ppsiToHundred(s)
          }))
        });
      }

      const summary = { total: members.length, green: 0, yellow: 0, orange: 0, red: 0, no_data: 0, alerts: 0 };
      for (const m of members) {
        if (!m.tier) { summary.no_data++; continue; }
        summary[m.tier.tier.toLowerCase()]++;
        if (m.missed_survey || m.tier.tier === 'RED' || m.tier.tier === 'ORANGE') summary.alerts++;
      }

      res.json({ summary, members });

    } catch (error) {
      console.error('Error in /v1/wellness/members:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

/**
 * Register vertical→platform callbacks. Called from index.js → boot(ctx).
 * The platform's gatherMemberFeatures looks up `verticalCallbacks.computePpii`
 * and falls back to ppsiCurrent when the vertical isn't loaded.
 */
export function registerCallbacks(ctx) {
  ctx.registerCallback('computePpii', calcPPII);
}

export default { register, registerCallbacks };
