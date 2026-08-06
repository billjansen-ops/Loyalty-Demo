/**
 * STORY 4 — toxicology results + the MRO state machine (Session 168;
 * Erica's emailed answers are the contract until her result-state-machine
 * document arrives; docs/MONITORING_CORE_DESIGN.md §3.3 records them).
 *
 * What this proves, all through real doors on the SANDBOX (a copied
 * tenant — nothing here may be Wisconsin-only):
 *   1. The anchor rule: a result answers a selection or says why not
 *      (reconcile reason); future collection dates refuse.
 *   2. The record is born at RECEIVED, portal-SUPPRESSED by default,
 *      and its current stage is DERIVED from the newest history row.
 *   3. The stage SEQUENCE is data and enforced in every mode: illegal
 *      jumps refuse naming the legal moves; a disposition is required
 *      at the terminal stage and refused before it; a terminal record
 *      never moves again; history is append-only and complete.
 *   4. WHO may move a record is enforced under mode 'rules' via the
 *      role map: a plain staff login cannot create; a Case Manager
 *      walks the chain but CANNOT disposition (MRO-only); the MEDDIR
 *      holder can — because the MRO role-map row defaults to the
 *      Medical Director's position (v159), and changing WHO the MRO
 *      is is a row edit, never code.
 *   5. Void is a mark, never a deletion: reason required, one-way,
 *      voided records leave the list and refuse to move.
 *   6. Tenant confinement: another tenant answers 404, no oracle.
 *
 * DELIBERATELY ABSENT: the disposition files NO compliance/scoring
 * event yet — that seam (scoring moves only on disposition, forward-
 * only) is its own bite and its test extends this file FIRST.
 *
 * Self-contained: fixture member + throwaway staff built through real
 * doors; mode flipped back; harness snapshot/restore backstops.
 */

module.exports = {
  name: 'Insight: toxicology results + the MRO state machine (story 4 framework)',

  async run(ctx) {
    const SB = 7, WI = 5;
    const stamp = Math.floor(Math.random() * 1e9);
    const PW = 'qa-tox-168!';

    const asClaude = async (tenant) => {
      const l = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(l._ok, 'Claude login');
      const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenant } });
      ctx.assert(sw._ok, `Session on tenant ${tenant}`);
    };
    await asClaude(SB);

    // ── Fixture member (built, never borrowed — tenant 7 ships empty) ──
    const next = await ctx.fetch(`/v1/member/next-number?tenant_id=${SB}`);
    const MNUM = next.membership_number;
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { tenant_id: SB, membership_number: MNUM, fname: 'Tox', lname: `Fixture${stamp}` } });
    ctx.assert(created._ok, `Sandbox fixture member created (#${MNUM})`);

    // ── 1. The anchor rule ──
    const noAnchor = await ctx.fetch('/v1/tox-results', { method: 'POST', body: { member_number: MNUM } });
    ctx.assert(noAnchor._status === 400, 'A result with no selection and no reason refuses (the anchor rule)');
    const badReason = await ctx.fetch('/v1/tox-results', { method: 'POST',
      body: { member_number: MNUM, reconcile_reason_code: 'NOPE' } });
    ctx.assert(badReason._status === 400, 'Unknown reconciliation reason refuses');
    const future = await ctx.fetch('/v1/tox-results', { method: 'POST',
      body: { member_number: MNUM, reconcile_reason_code: 'FOR_CAUSE', collection_date: '2126-01-01' } });
    ctx.assert(future._status === 400, 'A future collection date refuses');

    // ── 2. Born at RECEIVED, suppressed, stage derived ──
    const mk = await ctx.fetch('/v1/tox-results', { method: 'POST',
      body: { member_number: MNUM, reconcile_reason_code: 'FOR_CAUSE', coc_reference: `COC-${stamp}` } });
    ctx.assert(mk._ok && mk.result.current_stage === 'RECEIVED',
      `Result created at RECEIVED (got ${mk.result && mk.result.current_stage})`);
    ctx.assert(mk.result.portal_suppressed === true, 'Born portal-SUPPRESSED (record-level, the safe default)');
    ctx.assert(mk.result.reconcile_reason_code === 'FOR_CAUSE', 'Reconciliation reason recorded');
    const L = mk.result.link;

    // ── 3. The sequence is data ──
    const jump = await ctx.fetch(`/v1/tox-results/${L}/stage`, { method: 'POST', body: { to_stage: 'MRO_REVIEW' } });
    ctx.assert(jump._status === 409 && /SCREEN/.test(jump.error),
      'Illegal jump refuses, naming the legal moves');
    const early = await ctx.fetch(`/v1/tox-results/${L}/stage`, { method: 'POST',
      body: { to_stage: 'SCREEN', disposition_code: 'NEGATIVE' } });
    ctx.assert(early._status === 400, 'A disposition on a non-terminal stage refuses');
    for (const s of ['SCREEN', 'LAB_CONFIRMED', 'MRO_REVIEW']) {
      const mv = await ctx.fetch(`/v1/tox-results/${L}/stage`, { method: 'POST', body: { to_stage: s } });
      ctx.assert(mv._ok && mv.result.current_stage === s, `Advanced to ${s} (derived stage agrees)`);
    }
    const noDisp = await ctx.fetch(`/v1/tox-results/${L}/stage`, { method: 'POST', body: { to_stage: 'DISPOSITION' } });
    ctx.assert(noDisp._status === 400, 'The final stage requires a disposition');
    const badDisp = await ctx.fetch(`/v1/tox-results/${L}/stage`, { method: 'POST',
      body: { to_stage: 'DISPOSITION', disposition_code: 'MAYBE' } });
    ctx.assert(badDisp._status === 400, 'Unknown disposition refuses');
    const disp = await ctx.fetch(`/v1/tox-results/${L}/stage`, { method: 'POST',
      body: { to_stage: 'DISPOSITION', disposition_code: 'CONFIRMED_POSITIVE' } });
    ctx.assert(disp._ok && disp.result.current_stage === 'DISPOSITION'
      && disp.result.disposition_code === 'CONFIRMED_POSITIVE', 'Disposition recorded');
    const after = await ctx.fetch(`/v1/tox-results/${L}/stage`, { method: 'POST', body: { to_stage: 'RECEIVED' } });
    ctx.assert(after._status === 409 && /final/.test(after.error), 'A disposed record never moves again');

    const detail = await ctx.fetch(`/v1/tox-results/${L}`);
    ctx.assert(detail._ok
      && detail.history.map(h => h.stage_code).join(',') === 'RECEIVED,SCREEN,LAB_CONFIRMED,MRO_REVIEW,DISPOSITION',
      `History is append-only and complete (got ${detail._ok && detail.history.map(h => h.stage_code).join(',')})`);
    ctx.assert(detail.history[detail.history.length - 1].disposition_code === 'CONFIRMED_POSITIVE',
      'The disposition lives on the disposition stage row');

    // ── The auto-anchor: a result on a selected day answers the selection
    //    (no reason needed) — the same reconciliation the lab path will use ──
    const sel = await ctx.fetch('/v1/monitoring/selections', { method: 'POST',
      body: { member_number: MNUM, reason: 'QA for-cause (auto-anchor probe)' } });
    ctx.assert(sel._ok && sel.selection.selection_id, 'For-cause selection created for today');
    const auto = await ctx.fetch('/v1/tox-results', { method: 'POST', body: { member_number: MNUM } });
    ctx.assert(auto._ok && auto.result.selection_id === sel.selection.selection_id,
      `A result on a selected day auto-anchors to the selection (got ${auto._ok && auto.result.selection_id} vs ${sel.selection.selection_id})`);
    ctx.assert(auto.result.reconcile_reason_code === null, 'An anchored result carries no reconciliation reason');

    // ── 6 (early). Tenant confinement — no oracle ──
    await asClaude(WI);
    const cross = await ctx.fetch(`/v1/tox-results/${L}`);
    ctx.assert(cross._status === 404, "Another tenant's session gets 404 — no oracle");
    await asClaude(SB);

    // ── 4. WHO — mode 'rules' + the role map ──
    const mkUser = (name, role) => ctx.fetch('/v1/users', {
      method: 'POST', body: { username: name, password: PW, display_name: name, tenant_id: SB, role } });
    const uPlain = await mkUser(`qa_tox_plain_${stamp}`, 'csr');
    const uCm = await mkUser(`qa_tox_cm_${stamp}`, 'csr');
    const uMd = await mkUser(`qa_tox_md_${stamp}`, 'csr');
    ctx.assert(uPlain._ok && uCm._ok && uMd._ok, 'Three throwaway staff logins created');
    const partners = await ctx.fetch(`/v1/partners?tenant_id=${SB}`);
    const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${SB}`);
    const posGrant = (userId, code) => ctx.fetch(`/v1/users/${userId}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: [code, programs[0].program_id] } });
    const gCm = await posGrant(uCm.user_id, 'CASEMAN');
    const gMd = await posGrant(uMd.user_id, 'MEDDIR');
    ctx.assert(gCm._ok && gMd._ok, 'Positions granted (CASEMAN, MEDDIR)');

    const flip = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'rules' } });
    ctx.assert(flip._ok && flip.mode === 'rules', "Sandbox flipped to mode 'rules' — roles resolve now");

    const as = async (username, fn) => {
      const l = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username, password: PW } });
      ctx.assert(l._ok, `Logged in as ${username}`);
      const out = await fn();
      await asClaude(SB);
      return out;
    };

    try {
      // A plain staff login cannot record a result.
      const plainMk = await as(`qa_tox_plain_${stamp}`, () =>
        ctx.fetch('/v1/tox-results', { method: 'POST',
          body: { member_number: MNUM, reconcile_reason_code: 'FOR_CAUSE' } }));
      ctx.assert(plainMk._status === 403, 'Under rules, a plain staff login cannot record a result (403)');

      // The Case Manager records and walks the chain...
      const cmWalk = await as(`qa_tox_cm_${stamp}`, async () => {
        const c = await ctx.fetch('/v1/tox-results', { method: 'POST',
          body: { member_number: MNUM, reconcile_reason_code: 'FOR_CAUSE' } });
        if (!c._ok) return { fail: `create: ${c._status}` };
        for (const s of ['SCREEN', 'LAB_CONFIRMED', 'MRO_REVIEW']) {
          const mv = await ctx.fetch(`/v1/tox-results/${c.result.link}/stage`, { method: 'POST', body: { to_stage: s } });
          if (!mv._ok) return { fail: `${s}: ${mv._status}` };
        }
        const d = await ctx.fetch(`/v1/tox-results/${c.result.link}/stage`, { method: 'POST',
          body: { to_stage: 'DISPOSITION', disposition_code: 'NEGATIVE' } });
        return { link: c.result.link, dispStatus: d._status, dispError: d.error };
      });
      ctx.assert(!cmWalk.fail, `Case Manager records and walks the chain (${cmWalk.fail || 'ok'})`);
      ctx.assert(cmWalk.dispStatus === 403 && /MRO/.test(cmWalk.dispError),
        `THE MRO RULE: a Case Manager cannot disposition — MRO only (got ${cmWalk.dispStatus})`);

      // ...and the MEDDIR holder dispositions, because the MRO role-map
      // row defaults to the Medical Director's position (a row, not code).
      const mdDisp = await as(`qa_tox_md_${stamp}`, () =>
        ctx.fetch(`/v1/tox-results/${cmWalk.link}/stage`, { method: 'POST',
          body: { to_stage: 'DISPOSITION', disposition_code: 'NEGATIVE' } }));
      ctx.assert(mdDisp._ok && mdDisp.result.disposition_code === 'NEGATIVE',
        'The MEDDIR holder dispositions — MRO resolves through the role-map row');

      // ── The staged notifications (v160) under the CONTENT RULE ──
      // The MD user (MEDDIR position) received the internal flag when the
      // CM moved the record to screen non-negative, and the finalized
      // notice at disposition. The text NEVER carries the member, the
      // stage, or the answer — "log in and look".
      const notifs = await as(`qa_tox_md_${stamp}`, () => ctx.fetch('/v1/notifications'));
      const toxNotifs = (notifs.notifications || []).filter(n => n.source === 'toxicology');
      ctx.assert(toxNotifs.some(n => n.title === 'A toxicology result requires attention'),
        'Screen non-negative fired the internal attention flag to the MD/MRO position');
      ctx.assert(toxNotifs.some(n => n.title === 'A toxicology result was finalized'),
        'Disposition fired the finalized notice to the clinical tier');
      const leaky = toxNotifs.filter(n => {
        const text = `${n.title} ${n.body}`;
        return text.includes(MNUM) || /NEGATIVE|POSITIVE|non-negative|SCREEN|Fixture/i.test(text);
      });
      ctx.assert(toxNotifs.length > 0 && leaky.length === 0,
        `THE CONTENT RULE: no member, no stage, no answer in any notification text (${toxNotifs.length} checked${leaky.length ? ' — LEAK: ' + JSON.stringify(leaky[0]) : ''})`);

      // Void under rules: plain refused, CM allowed; one-way; leaves the list.
      const plainVoid = await as(`qa_tox_plain_${stamp}`, () =>
        ctx.fetch(`/v1/tox-results/${cmWalk.link}/void`, { method: 'POST', body: { reason: 'nope' } }));
      ctx.assert(plainVoid._status === 403, 'A plain staff login cannot void');
      const noReason = await ctx.fetch(`/v1/tox-results/${L}/void`, { method: 'POST', body: {} });
      ctx.assert(noReason._status === 400, 'Void requires a reason');
      const cmVoid = await as(`qa_tox_cm_${stamp}`, () =>
        ctx.fetch(`/v1/tox-results/${cmWalk.link}/void`, { method: 'POST', body: { reason: 'QA fixture cleanup' } }));
      ctx.assert(cmVoid._ok, 'The Case Manager voids (a mark, with why)');
      const reVoid = await ctx.fetch(`/v1/tox-results/${cmWalk.link}/void`, { method: 'POST', body: { reason: 'again' } });
      ctx.assert(reVoid._status === 409, 'Void is one-way');
      const vMove = await ctx.fetch(`/v1/tox-results/${cmWalk.link}/stage`, { method: 'POST', body: { to_stage: 'RECEIVED' } });
      ctx.assert(vMove._status === 409 && /voided/.test(vMove.error), 'A voided record does not move');
      const list = await ctx.fetch(`/v1/tox-results?member_number=${MNUM}`);
      ctx.assert(list._ok && !list.results.some(r => r.link === cmWalk.link),
        'Voided records leave the list (include_voided=1 brings them back)');
      const listAll = await ctx.fetch(`/v1/tox-results?member_number=${MNUM}&include_voided=1`);
      ctx.assert(listAll._ok && listAll.results.some(r => r.link === cmWalk.link),
        'include_voided=1 shows the voided record — a mark, never a deletion');
    } finally {
      // ── Cleanup: mode back to 'open' (the snapshot/restore backstops) ──
      await asClaude(SB);
      const back = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'open', rules: [] } });
      ctx.assert(back._ok, "Sandbox flipped back to 'open'");
    }
  }
};
