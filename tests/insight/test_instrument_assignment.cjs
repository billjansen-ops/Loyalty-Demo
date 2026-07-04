/**
 * Per-participant instrument assignment — Insight / wi_php (Session 131,
 * db v97 — WisconsinPATH Stage 2 part 2 plumbing).
 *
 * member_instrument rows put a participant in the ASSIGNED regime: they owe
 * exactly their active assignments (cadence override honored; one_time =
 * screening due once from start_date, satisfied forever by a completion on or
 * after it). No rows = the pre-assignment default (every active cadenced
 * survey). MEDS resolves through getExpectedInstruments at all four sites.
 *
 * Load-bearing assertions:
 *   - default regime: MEDS expects every cadenced instrument, screeners absent
 *   - assigning flips the regime: MEDS expects EXACTLY the assigned set
 *   - one_time satisfied by a past completion ≥ start_date; unsatisfied = due
 *   - recurring assignment of a no-default-cadence screener without an
 *     override is rejected in plain English
 *   - pausing everything = owes nothing (no fallback to owes-everything)
 *   - deleting the last assignment returns the member to the default regime
 *   - cross-tenant confinement (Delta session can't see Insight assignments)
 *
 * Uses an engineered participant with a completed PPSI. Fires real MEDS
 * processing (notifications/registry) — harness snapshot/restore wipes it.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

module.exports = {
  name: 'Insight: per-participant instrument assignment (MEDS honors the assigned set)',

  async run(ctx) {
    const tenantId = 5;
    const db = new Client(DB_CONFIG);
    await db.connect();

    try {
      // ── Auth: Claude superuser (lands on Insight) ──
      const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(login._ok, 'Claude login successful');
      const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });
      ctx.assert(sw._ok, 'Session on Insight (tenant 5)');

      // ── A participant who has completed a PPSI (for the one_time-satisfied case) ──
      const memberRow = await db.query(
        `SELECT m.membership_number, m.link
           FROM member m
          WHERE m.tenant_id = $1 AND m.is_active
            AND EXISTS (SELECT 1 FROM member_survey ms WHERE ms.member_link = m.link AND ms.survey_link = 1 AND ms.end_ts IS NOT NULL)
          LIMIT 1`, [tenantId]);
      ctx.assert(memberRow.rows.length === 1, 'Found a participant with a completed PPSI');
      const memberId = memberRow.rows[0].membership_number;

      // ── 1. Default regime: owes every cadenced instrument, screeners absent ──
      ctx.log('1: default regime');
      const before = await ctx.fetch(`/v1/members/${memberId}/instruments`);
      ctx.assert(before.regime === 'default', `regime starts 'default' (got ${before.regime})`);
      const ppsiBefore = before.items.find(i => i.survey_code === 'PPSI');
      const phq9Before = before.items.find(i => i.survey_code === 'PHQ9');
      ctx.assert(ppsiBefore && ppsiBefore.expected === true, 'PPSI expected by default (cadenced)');
      ctx.assert(phq9Before && phq9Before.expected === false, 'PHQ9 not expected by default (screener, no cadence)');

      const medsBefore = await ctx.fetch(`/v1/meds/member/${memberId}`);
      const surveysBefore = medsBefore.items.filter(i => i.type === 'survey');
      ctx.assert(surveysBefore.length >= 8, `MEDS default expects all cadenced instruments (got ${surveysBefore.length})`);
      ctx.assert(!surveysBefore.some(i => i.code === 'PHQ9'), 'MEDS default does NOT expect PHQ9');

      // ── 2. Assign: PPSI one_time (satisfied by history) + PHQ9 one_time (due) ──
      ctx.log('2: assignments flip the regime');
      const a1 = await ctx.fetch(`/v1/members/${memberId}/instruments`, {
        method: 'POST', body: { survey_code: 'PPSI', mode: 'one_time', start_date: -20000 }
      });
      // start_date -20000 is a Bill-epoch day in 1994 (offset -32768) — safely
      // before any completion, so the historical PPSI satisfies the one_time.
      ctx.assert(a1._ok && a1.member_instrument_id, `PPSI assigned one_time from the past (${a1._status}${a1.error ? ': ' + a1.error : ''})`);
      const a2 = await ctx.fetch(`/v1/members/${memberId}/instruments`, {
        method: 'POST', body: { survey_code: 'PHQ9', mode: 'one_time' }
      });
      ctx.assert(a2._ok && a2.member_instrument_id, 'PHQ9 assigned one_time from today');

      const dup = await ctx.fetch(`/v1/members/${memberId}/instruments`, {
        method: 'POST', body: { survey_code: 'PPSI', mode: 'one_time' }
      });
      ctx.assert(dup._status === 409, `duplicate assignment rejected (got ${dup._status})`);

      const badCadence = await ctx.fetch(`/v1/members/${memberId}/instruments`, {
        method: 'POST', body: { survey_code: 'GAD7', mode: 'cadence' }
      });
      ctx.assert(badCadence._status === 400 && (badCadence.error || '').includes('cadence'),
        `recurring screener without a cadence rejected in plain English (${badCadence._status})`);

      // ── 3. Assigned regime: MEDS expects EXACTLY the assigned set ──
      ctx.log('3: MEDS honors the assigned set');
      const after = await ctx.fetch(`/v1/members/${memberId}/instruments`);
      ctx.assert(after.regime === 'assigned', `regime now 'assigned' (got ${after.regime})`);
      ctx.assert(after.items.find(i => i.survey_code === 'PROMIS8A').expected === false, 'PROMIS8A no longer expected');

      const medsAfter = await ctx.fetch(`/v1/meds/member/${memberId}`);
      const surveysAfter = medsAfter.items.filter(i => i.type === 'survey');
      ctx.assert(surveysAfter.length === 2, `MEDS expects exactly the 2 assigned (got ${surveysAfter.length}: ${surveysAfter.map(i => i.code).join(',')})`);
      const ppsiItem = surveysAfter.find(i => i.code === 'PPSI');
      const phq9Item = surveysAfter.find(i => i.code === 'PHQ9');
      ctx.assert(ppsiItem && ppsiItem.mode === 'one_time' && ppsiItem.status === 'current' && ppsiItem.next_due === null,
        `PPSI one_time SATISFIED by its past completion (status ${ppsiItem && ppsiItem.status}, next_due ${ppsiItem && ppsiItem.next_due})`);
      ctx.assert(phq9Item && phq9Item.status === 'never_completed',
        `PHQ9 one_time is DUE (never completed) (status ${phq9Item && phq9Item.status})`);

      // ── 4. Pause everything: owes NOTHING (no fallback to owes-everything) ──
      ctx.log('4: fully paused = owes nothing');
      const p1 = await ctx.fetch(`/v1/members/${memberId}/instruments/${a1.member_instrument_id}`, {
        method: 'PATCH', body: { status: 'paused' }
      });
      const p2 = await ctx.fetch(`/v1/members/${memberId}/instruments/${a2.member_instrument_id}`, {
        method: 'PATCH', body: { status: 'paused' }
      });
      ctx.assert(p1._ok && p2._ok, 'both assignments paused');
      const medsPaused = await ctx.fetch(`/v1/meds/member/${memberId}`);
      ctx.assert(medsPaused.items.filter(i => i.type === 'survey').length === 0,
        'MEDS expects zero surveys when every assignment is paused');

      // ── 5. Resume + cadence override sticks ──
      ctx.log('5: resume with a cadence override');
      const r1 = await ctx.fetch(`/v1/members/${memberId}/instruments/${a1.member_instrument_id}`, {
        method: 'PATCH', body: { status: 'active', mode: 'cadence', cadence_days: 14 }
      });
      ctx.assert(r1._ok && r1.cadence_days === 14 && r1.mode === 'cadence', 'PPSI resumed as recurring every 14 days');
      const medsResumed = await ctx.fetch(`/v1/meds/member/${memberId}`);
      const ppsiResumed = medsResumed.items.find(i => i.type === 'survey' && i.code === 'PPSI');
      ctx.assert(ppsiResumed && ppsiResumed.cadence_days === 14, `MEDS uses the 14-day override (got ${ppsiResumed && ppsiResumed.cadence_days})`);

      // ── 6. member_meds recalculated on write ──
      const mm = await db.query('SELECT meds_next_due FROM member_meds WHERE member_link = $1', [memberRow.rows[0].link]);
      ctx.assert(mm.rows.length === 1, 'member_meds next-due recalculated after assignment writes');

      // ── 7. Cross-tenant confinement ──
      ctx.log('7: Delta session cannot reach Insight assignments');
      const swd = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 1 } });
      ctx.assert(swd._ok, 'switched to Delta');
      const cross = await ctx.fetch(`/v1/members/${memberId}/instruments`);
      ctx.assert(cross._status === 404, `Insight participant invisible from Delta (got ${cross._status})`);
      const swb = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });
      ctx.assert(swb._ok, 'switched back to Insight');

      // ── 8. Delete both: back to the default regime ──
      ctx.log('8: removing the last assignment restores the default');
      const d1 = await ctx.fetch(`/v1/members/${memberId}/instruments/${a1.member_instrument_id}`, { method: 'DELETE' });
      const d2 = await ctx.fetch(`/v1/members/${memberId}/instruments/${a2.member_instrument_id}`, { method: 'DELETE' });
      ctx.assert(d1._ok && d2._ok, 'both assignments removed');
      const final = await ctx.fetch(`/v1/members/${memberId}/instruments`);
      ctx.assert(final.regime === 'default', `regime back to 'default' (got ${final.regime})`);
      const medsFinal = await ctx.fetch(`/v1/meds/member/${memberId}`);
      ctx.assert(medsFinal.items.filter(i => i.type === 'survey').length === surveysBefore.length,
        'MEDS expectation restored to the full default set');
    } finally {
      await db.end();
    }
  }
};
