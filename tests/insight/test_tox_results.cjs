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
 *   7. THE SCORING SEAM (Session 169): a disposition — and ONLY a
 *      disposition — files the compliance event its tox_disposition
 *      row names, through the real compliance entry path. Exactly one
 *      event per result; dated the DISPOSITION day, never the
 *      collection day (proven with a backdated collection); scored per
 *      the status row; sentinel statuses ring the safety machinery
 *      (signal → alert bonus → stability registry). Filing enrolls the
 *      member in the named item when activation predated it
 *      (DRUG_TEST_EXCEPTION was born in v159 — every earlier
 *      participant lacks the row). Voiding a DISPOSED result marks its
 *      filed event in error (the mark-in-error columns), carrying the
 *      void reason; nothing files at any earlier stage, so a record
 *      voided before disposition has nothing to unwind.
 *
 * Self-contained: fixture member + throwaway staff built through real
 * doors; mode flipped back; harness snapshot/restore backstops.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty',
  // One clock (S167): pin this test's Postgres session to the MACHINE's
  // timezone so CURRENT_DATE agrees with the platform's JS "today".
  // Copy this pin into any test that opens its own Client.
  options: `-c TimeZone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`
};

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

    const db = new Client(DB_CONFIG);
    await db.connect();

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

    // ── 7. THE SCORING SEAM — nothing files before disposition ──
    // The record has walked RECEIVED → SCREEN → LAB_CONFIRMED →
    // MRO_REVIEW: not one compliance event may exist yet.
    const preHist = await ctx.fetch(`/v1/compliance/member/${MNUM}/history`);
    ctx.assert(Array.isArray(preHist) && preHist.length === 0,
      `NO compliance event at receipt, screen, confirmed, or MRO review (got ${Array.isArray(preHist) ? preHist.length : preHist._status})`);

    const disp = await ctx.fetch(`/v1/tox-results/${L}/stage`, { method: 'POST',
      body: { to_stage: 'DISPOSITION', disposition_code: 'CONFIRMED_POSITIVE' } });
    ctx.assert(disp._ok && disp.result.current_stage === 'DISPOSITION'
      && disp.result.disposition_code === 'CONFIRMED_POSITIVE', 'Disposition recorded');

    // The disposition files: exactly one event, through the real entry
    // path, dated the disposition day, scored per the status row.
    const todayStr = (await db.query(`SELECT CURRENT_DATE::text AS d`)).rows[0].d;
    const hist1 = await ctx.fetch(`/v1/compliance/member/${MNUM}/history`);
    ctx.assert(Array.isArray(hist1) && hist1.length === 1,
      `Exactly ONE compliance event after disposition (got ${Array.isArray(hist1) ? hist1.length : hist1._status})`);
    const ev1 = (Array.isArray(hist1) && hist1[0]) || {};
    ctx.assert(ev1.item_code === 'DRUG_TEST_RESULT' && ev1.status_code === 'CONFIRMED_POSITIVE',
      `The event is the one the disposition row names (got ${ev1.item_code}/${ev1.status_code})`);
    ctx.assert(Number(ev1.score) === 3 && ev1.is_sentinel === true,
      `Scored per the status row: 3, sentinel (got ${ev1.score}, sentinel ${ev1.is_sentinel})`);
    ctx.assert(ev1.result_date === todayStr,
      `Disposition-DATED (got ${ev1.result_date}, today ${todayStr})`);

    // Structural: the result carries the pointer to its filed event
    // (the exactly-once guard + the void handle), and filing ENROLLED
    // the member in the item — this fixture was never activated, so no
    // compliance assignment existed before the seam created it.
    const filed1 = await db.query(
      `SELECT filed_compliance_link FROM tox_result WHERE link = $1`, [L])
      .then(r => r.rows[0], () => null); // null until v161 exists
    ctx.assert(filed1 && filed1.filed_compliance_link != null,
      'The result records WHICH event it filed (the exactly-once guard)');
    const enrolled = await db.query(
      `SELECT mc.status FROM member_compliance mc
       JOIN compliance_item ci ON ci.compliance_item_id = mc.compliance_item_id
       JOIN member m ON m.link = mc.member_link
       WHERE m.membership_number = $1 AND m.tenant_id = $2
         AND ci.item_code = 'DRUG_TEST_RESULT'`, [MNUM, SB]);
    ctx.assert(enrolled.rows.length === 1 && enrolled.rows[0].status === 'active',
      'Filing enrolled the member in the item (auto-assign, active)');

    // THE SAFETY MACHINERY: the sentinel status hung its signal, the
    // alert bonus fired, and a stability registry item was filed — the
    // chain the S162 audit found silently dead, proven live here.
    const reg1 = await ctx.fetch(`/v1/stability-registry/member/${MNUM}`);
    ctx.assert(reg1._ok && Array.isArray(reg1.items) && reg1.items.length > 0,
      `Confirmed positive rang the safety machinery — registry item filed (got ${reg1._ok && reg1.items ? reg1.items.length : reg1._status})`);
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

    // ── The exception seam: the six special results file under their
    // OWN item, and the event is dated the DISPOSITION day — proven
    // with a BACKDATED collection. DRUG_TEST_EXCEPTION was born in
    // v159, after every existing participant activated, so the
    // enroll-at-filing path is load-bearing here too. ──
    const yStr = (await db.query(`SELECT (CURRENT_DATE - 1)::text AS d`)).rows[0].d;
    const exMk = await ctx.fetch('/v1/tox-results', { method: 'POST',
      body: { member_number: MNUM, reconcile_reason_code: 'FOR_CAUSE', collection_date: yStr } });
    ctx.assert(exMk._ok, `Backdated result created (collected ${yStr})`);
    const XL = (exMk._ok && exMk.result.link) || 0;
    for (const s of ['SCREEN', 'LAB_CONFIRMED', 'MRO_REVIEW']) {
      const mv = await ctx.fetch(`/v1/tox-results/${XL}/stage`, { method: 'POST', body: { to_stage: s } });
      ctx.assert(mv._ok, `Backdated record advanced to ${s}`);
    }
    const exDisp = await ctx.fetch(`/v1/tox-results/${XL}/stage`, { method: 'POST',
      body: { to_stage: 'DISPOSITION', disposition_code: 'ADULTERATED' } });
    ctx.assert(exDisp._ok, 'Adulterated disposition recorded');
    const hist2 = await ctx.fetch(`/v1/compliance/member/${MNUM}/history`);
    const exEv = (Array.isArray(hist2) ? hist2 : []).find(h => h.item_code === 'DRUG_TEST_EXCEPTION');
    ctx.assert(!!exEv && exEv.status_code === 'ADULTERATED',
      `The exception filed under its OWN item (got ${exEv ? `${exEv.item_code}/${exEv.status_code}` : 'nothing'})`);
    ctx.assert(!!exEv && exEv.result_date === todayStr && exEv.result_date !== yStr,
      `Disposition-dated, NEVER collection-dated (event ${exEv && exEv.result_date}; collected ${yStr})`);
    ctx.assert(Array.isArray(hist2) && hist2.length === 2,
      `Exactly one new event — two total, the anchored record at RECEIVED filed nothing (got ${Array.isArray(hist2) ? hist2.length : hist2._status})`);

    // Enrolled at filing; the item's weight stays 0.00 until Erica's
    // document sets values (deliberate — no composite movement).
    const items = await ctx.fetch(`/v1/compliance/member/${MNUM}`);
    const exItem = (Array.isArray(items) ? items : []).find(i => i.item_code === 'DRUG_TEST_EXCEPTION');
    ctx.assert(!!exItem, 'Filing enrolled the member in Drug Test Exceptions (item born after activations)');
    ctx.assert(!!exItem && exItem.weight === 0,
      `Exception weight stays 0.00 until Erica sets values (got ${exItem && exItem.weight})`);

    // Adulterated is tampering: SENTINEL_REFUSED rang the safety
    // machinery — a NEW registry item beyond the confirmed-positive one
    // (different signal, so "never the same news twice" does not mute it).
    const reg1n = (reg1._ok && Array.isArray(reg1.items)) ? reg1.items.length : -1;
    const reg2 = await ctx.fetch(`/v1/stability-registry/member/${MNUM}`);
    ctx.assert(reg2._ok && Array.isArray(reg2.items) && reg2.items.length > reg1n,
      `Adulterated rang the safety machinery (registry ${reg1n} → ${reg2.items ? reg2.items.length : reg2._status})`);

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

      // A negative files like any disposition: third event, score 0,
      // no sentinel, no new registry noise.
      const hist3 = await ctx.fetch(`/v1/compliance/member/${MNUM}/history`);
      const negEv = (Array.isArray(hist3) ? hist3 : []).find(h => h.status_code === 'NEGATIVE');
      ctx.assert(Array.isArray(hist3) && hist3.length === 3 && !!negEv && Number(negEv.score) === 0,
        `Negative files too: third event, score 0 (got ${Array.isArray(hist3) ? hist3.length : hist3._status} events${negEv ? `, score ${negEv.score}` : ', no NEGATIVE row'})`);

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

      // VOID-AFTER-DISPOSITION: this record had filed its NEGATIVE
      // event — the void marks that event in error through the
      // mark-in-error columns, carrying the void reason. Marked, never
      // deleted: history still shows all three events.
      const vRow = await db.query(
        `SELECT cr.voided_ts, cr.voided_reason FROM compliance_result cr
         JOIN tox_result tr ON tr.filed_compliance_link = cr.link
         WHERE tr.link = $1`, [cmWalk.link])
        .then(r => r.rows[0], () => null); // null until v161 exists
      ctx.assert(vRow && vRow.voided_ts != null && /QA fixture cleanup/.test(vRow.voided_reason || ''),
        `Void-after-disposition marks the filed event in error, with why (got ${vRow ? vRow.voided_reason : 'no filed event'})`);
      const hist4 = await ctx.fetch(`/v1/compliance/member/${MNUM}/history`);
      ctx.assert(Array.isArray(hist4) && hist4.length === 3,
        'The voided event still stands in history — a mark, never a deletion');
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
      await db.end().catch(() => {});
    }
  }
};
