/**
 * Vetted evaluator directory — Insight / wi_php (WisconsinPATH Stage 3, Session 133).
 *
 * Erica's requirement: participant chooses from a vetted list with costs disclosed
 * up front; out-of-state entries first-class. Three surfaces under test:
 *   1. Staff CRUD (/v1/evaluators) — tenant-gated, duplicate-code 409, cost-range guard.
 *   2. PUBLIC participant list (/v1/evaluator-directory?t=) — anonymous, active-only,
 *      whitelisted fields (no ids, no flags, no tenant internals).
 *   3. The EVALUATOR member molecule (external_list → evaluator, LICENSING_BOARD
 *      pattern) — the chart record of the participant's choice. The load-bearing
 *      assertion is the assign→read-back round-trip (the attaches_to='M' silent-failure
 *      trap, MOLECULES.md §5.2).
 *
 * Also locks in the Session 133 fix to a Session 130 bug: GET /v1/code-context/:token
 * must be reachable WITHOUT a session (the participant on the other end of a referral
 * QR has no login) — it returned 401 before the fix and the Performance Profile
 * pre-fill silently degraded to the blank form.
 *
 * Self-contained: creates its own evaluator + member; harness snapshot/restore wipes.
 */
module.exports = {
  name: 'Insight: Vetted evaluator directory (CRUD, public list, EVALUATOR round-trip)',

  async run(ctx) {
    const tenantId = 5;

    // Anonymous fetch — deliberately NOT ctx.fetch (which carries the test session).
    async function anon(p) {
      const r = await fetch(`${ctx.apiBase}${p}`);
      let body = null;
      try { body = await r.json(); } catch (_) { /* non-JSON */ }
      return { status: r.status, ok: r.ok, body };
    }

    // ── Auth: Claude superuser, switched into Insight ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });
    ctx.assert(sw._ok, 'Switched session into Insight (tenant 5)');

    // ── 1. Staff list: the v99 samples are present ──
    const staffList = await ctx.fetch('/v1/evaluators');
    const codes = (Array.isArray(staffList) ? staffList : []).map(e => e.evaluator_code);
    ctx.assert(['TCAG', 'RMPE', 'GLBH'].every(c => codes.includes(c)),
      `Staff list carries the 3 seeded samples (got: ${codes.join(',')})`);

    // ── 2. CRUD: create, duplicate 409, cost guard 400, update ──
    const created = await ctx.fetch('/v1/evaluators', {
      method: 'POST',
      body: { evaluator_code: 'TESTEV', evaluator_name: 'QA Test Evaluations', credentials: 'MD',
              evaluation_types: 'QA-only evaluation', city: 'Fargo', state: 'ND',
              cost_low: 1000, cost_high: 2000, cost_notes: 'QA note' }
    });
    ctx.assert(created._ok && created.evaluator_id, 'New evaluator created (TESTEV)');
    const testId = created.evaluator_id;

    const dup = await ctx.fetch('/v1/evaluators', {
      method: 'POST', body: { evaluator_code: 'TESTEV', evaluator_name: 'Duplicate' }
    });
    ctx.assert(!dup._ok && dup._status === 409, 'Duplicate evaluator code rejected with 409');

    const badCost = await ctx.fetch('/v1/evaluators', {
      method: 'POST', body: { evaluator_code: 'BADCOST', evaluator_name: 'Backwards Costs', cost_low: 5000, cost_high: 100 }
    });
    ctx.assert(!badCost._ok && badCost._status === 400, 'Backwards cost range rejected with 400');

    const updated = await ctx.fetch(`/v1/evaluators/${testId}`, {
      method: 'PUT', body: { cost_low: 1500, cost_high: 2500 }
    });
    ctx.assert(updated._ok && updated.cost_low === 1500 && updated.cost_high === 2500,
      'Evaluator cost range updates in place');

    // ── 3. Public participant list: anonymous, by key and by id ──
    const pubByKey = await anon('/v1/evaluator-directory?t=wi_php');
    ctx.assert(pubByKey.ok, `Public directory resolves by tenant key with NO session (got ${pubByKey.status})`);
    ctx.assert(pubByKey.body && pubByKey.body.program === 'Wisconsin PHP', 'Public directory names the program');
    const pubNames = (pubByKey.body.evaluators || []).map(e => e.evaluator_name);
    ctx.assert(pubNames.includes('QA Test Evaluations'), 'Active evaluator appears on the public list');

    const pubById = await anon(`/v1/evaluator-directory?t=${tenantId}`);
    ctx.assert(pubById.ok && (pubById.body.evaluators || []).length === (pubByKey.body.evaluators || []).length,
      'Public directory resolves by tenant id to the same list');

    // Whitelist: no internal fields leak to the anonymous surface
    const sample = (pubByKey.body.evaluators || [])[0] || {};
    ctx.assert(!('evaluator_id' in sample) && !('is_active' in sample) && !('tenant_id' in sample),
      'Public rows carry only whitelisted fields (no id / is_active / tenant_id)');
    ctx.assert('cost_low' in sample && 'cost_high' in sample && 'state' in sample,
      'Public rows carry the up-front cost disclosure + location');

    // ── 4. Deactivate → leaves the public list, stays on the staff list ──
    const deact = await ctx.fetch(`/v1/evaluators/${testId}`, { method: 'PUT', body: { is_active: false } });
    ctx.assert(deact._ok && deact.is_active === false, 'Evaluator deactivates');
    const pubAfter = await anon('/v1/evaluator-directory?t=wi_php');
    ctx.assert(!(pubAfter.body.evaluators || []).map(e => e.evaluator_name).includes('QA Test Evaluations'),
      'Inactive evaluator leaves the public list');
    const staffAfter = await ctx.fetch('/v1/evaluators');
    ctx.assert((Array.isArray(staffAfter) ? staffAfter : []).some(e => e.evaluator_id === testId),
      'Inactive evaluator stays on the staff list');

    // ── 5. Public guards ──
    const noT = await anon('/v1/evaluator-directory');
    ctx.assert(noT.status === 400, 'Public directory without a program identifier → 400');
    const badT = await anon('/v1/evaluator-directory?t=not_a_program');
    ctx.assert(badT.status === 404, 'Public directory with an unknown program → 404');

    // ── 6. Session 133 regression lock: code-context is public ──
    // (S130 bug: 401 for anonymous participants → pre-fill silently dead.)
    const cctx = await anon('/v1/code-context/qa-not-a-real-token');
    ctx.assert(cctx.status === 404, `Anonymous /v1/code-context gets the generic 404, not a 401 (got ${cctx.status})`);

    // ── 7. EVALUATOR molecule: chart dropdown + assign → read-back round-trip ──
    const lookup = await ctx.fetch('/v1/lookup-values/EVALUATOR');
    const lookupRows = Array.isArray(lookup) ? lookup : (lookup.values || lookup.rows || []);
    ctx.assert(lookupRows.length >= 3, `EVALUATOR chart dropdown returns the vetted list (got ${lookupRows.length} rows)`);

    const num = await ctx.fetch('/v1/member/next-number');
    const mnum = num.membership_number;
    const member = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: mnum, fname: 'Test', lname: 'EvaluatorPick' }
    });
    ctx.assert(member._ok, `Created Insight member ${mnum}`);

    const save = await ctx.fetch(`/v1/member/${mnum}/molecules`, { method: 'PUT', body: { molecules: { EVALUATOR: 'TCAG' } } });
    ctx.assert(save._ok, 'EVALUATOR (TCAG) saves via PUT /molecules');

    const read = await ctx.fetch(`/v1/member/${mnum}/molecules?tenant_id=${tenantId}`);
    const val = read._ok && read.values ? read.values.EVALUATOR : null;
    ctx.assert(val != null, 'EVALUATOR present after save (round-trip — proves member/M routing, not activity/A)');
    ctx.assert(val === 'TCAG' || String(val).includes('Twin Cities'),
      `EVALUATOR round-trips to the chosen evaluator (got: ${val})`);

    const save2 = await ctx.fetch(`/v1/member/${mnum}/molecules`, { method: 'PUT', body: { molecules: { EVALUATOR: 'GLBH' } } });
    ctx.assert(save2._ok, 'EVALUATOR re-assigns (participant changed their choice)');
    const read2 = await ctx.fetch(`/v1/member/${mnum}/molecules?tenant_id=${tenantId}`);
    const val2 = read2._ok && read2.values ? read2.values.EVALUATOR : null;
    ctx.assert(val2 === 'GLBH' || String(val2).includes('Great Lakes'),
      `EVALUATOR reflects the new choice (got: ${val2})`);

    // ── 8. Delete cleanup path ──
    const del = await ctx.fetch(`/v1/evaluators/${testId}`, { method: 'DELETE' });
    ctx.assert(del._ok && del.deleted === true, 'Evaluator deletes');

    // ── 9. Browser walk (skipped when Playwright is unavailable) ──
    if (!ctx.hasBrowser()) {
      ctx.log('Browser not available — skipping the page walks');
      return;
    }

    // Staff page: renders the seeded rows, zero console errors.
    const page = await ctx.openPage('/verticals/workforce_monitoring/admin_evaluators.html');
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    try {
      await page.evaluate((t) => {
        sessionStorage.setItem('tenant_id', String(t));
        sessionStorage.setItem('tenant_name', 'Wisconsin PHP');
      }, tenantId);
      await page.reload({ waitUntil: 'networkidle' });
      await new Promise(r => setTimeout(r, 800));

      const rowCount = await page.evaluate(() =>
        document.querySelectorAll('#tableBody tr td.code-cell').length);
      ctx.assert(rowCount >= 3, `Admin page renders the evaluator rows (got ${rowCount})`);

      await page.click('#addBtn');   // + Add Evaluator
      const panelOpen = await page.evaluate(() =>
        document.getElementById('editPanel').classList.contains('open'));
      ctx.assert(panelOpen, 'Add Evaluator panel opens');
      await page.evaluate(() => { closePanel(); });

      ctx.assert(errors.length === 0, `Admin page walk has zero console errors${errors.length ? ' — ' + errors[0] : ''}`);

      // Participant page: truly anonymous (cookies cleared), renders the cards.
      await page.context().clearCookies();
      errors.length = 0;
      await page.goto(`${ctx.apiBase}/evaluator-directory?t=wi_php`, { waitUntil: 'networkidle' });
      await new Promise(r => setTimeout(r, 800));

      const pub = await page.evaluate(() => ({
        cards: document.querySelectorAll('#list .card').length,
        badge: (document.getElementById('programBadge') || {}).textContent || '',
        costs: Array.from(document.querySelectorAll('.cost .range')).map(el => el.textContent)
      }));
      ctx.assert(pub.cards >= 3, `Participant page renders evaluator cards with no login (got ${pub.cards})`);
      ctx.assert(pub.badge.includes('Wisconsin PHP'), 'Participant page names the vetting program');
      ctx.assert(pub.costs.some(c => c.includes('$')), 'Cost disclosure is visible up front on the cards');

      // The state filter narrows the list.
      await page.selectOption('#stateFilter', 'MN');
      const mnCards = await page.evaluate(() => document.querySelectorAll('#list .card').length);
      ctx.assert(mnCards >= 1 && mnCards < pub.cards, `State filter narrows the list (${pub.cards} → ${mnCards})`);

      ctx.assert(errors.length === 0, `Participant page walk has zero console errors${errors.length ? ' — ' + errors[0] : ''}`);
    } finally {
      await page.close();
    }
  }
};
