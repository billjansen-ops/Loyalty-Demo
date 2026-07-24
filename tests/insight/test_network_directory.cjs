/**
 * Network Directory Phase 1 — Insight / workforce (Session 154, v128).
 *
 * Erica's spec (PI2_Network_Directory_Build_Specification) is the contract.
 * What this test proves, mapped to her sections:
 *   §3  Two sections, shared data model, separate governance: a program-private
 *       entity never leaks to another program; the IHS pool is shared.
 *   §4  The IHS directory is identical for every program (offered whole or not
 *       at all), and the three-way visibility setting (ihs/program/both) governs
 *       exactly which sections the public view returns.
 *   §5  Listed/Verified: superuser-only transitions; Verified stamps
 *       verified_date (Bill epoch DAY), returning to Listed clears it; a
 *       non-superuser is refused (403) from every IHS-pool write.
 *   §6  Neutral ordering: alphabetical, verification NEVER ranks — an
 *       unverified entity whose name sorts first stays first.
 *   §7/appendix  Cost never rides the listing card (detail view only);
 *       public card rows carry only whitelisted fields.
 *   The detail endpoint refuses entities not visible in the asking program's
 *   directory (no cross-tenant oracle).
 *
 * Self-contained: creates its own entities, entries, and throwaway login;
 * removes them at the end (and the harness snapshot/restore backstops).
 */
module.exports = {
  name: 'Insight: Network Directory Phase 1 (two sections, visibility, Listed/Verified, neutral order)',

  async run(ctx) {
    const WI = 5, WA = 6;

    async function anon(p) {
      const r = await fetch(`${ctx.apiBase}${p}`);
      let body = null;
      try { body = await r.json(); } catch (_) { /* non-JSON */ }
      return { status: r.status, ok: r.ok, body };
    }

    // ── Auth: Claude superuser in Wisconsin ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WI } });
    ctx.assert(sw._ok, 'Switched session into Wisconsin (tenant 5)');

    // ── 0. Config from v128 ──
    const types = await ctx.fetch('/v1/network-directory/types');
    ctx.assert(Array.isArray(types) && types.length >= 9, `Taxonomy has the 9 seeded types (got ${Array.isArray(types) ? types.length : 'none'})`);
    const treatmentType = types.find(t => t.type_code === 'TREATMENT');
    const coachingType = types.find(t => t.type_code === 'COACHING');
    ctx.assert(!!treatmentType && !!coachingType, 'TREATMENT and COACHING types present');

    const settings = await ctx.fetch('/v1/network-directory/settings');
    ctx.assert(settings._ok && ['ihs', 'program', 'both'].includes(settings.visibility),
      `Visibility setting reads a legal value (got ${settings.visibility})`);

    // ── 1. Create entities: two IHS-pool (superuser) + one program-private ──
    // Names chosen so the UNVERIFIED one sorts alphabetically FIRST — the
    // neutral-ordering assert below fails if verification ever ranks.
    const ihsA = await ctx.fetch('/v1/network-directory/admin/entities', {
      method: 'POST',
      body: { scope: 'ihs', entity_code: 'QA_ND_AAA', entity_name: 'QA AAA Unverified Center',
              entity_type_id: treatmentType.entity_type_id, city: 'Madison', state: 'WI' }
    });
    ctx.assert(ihsA._ok && ihsA.tenant_id === 0 && ihsA.ihs_status === 'L',
      'IHS entity created in the shared pool, born Listed');
    const ihsB = await ctx.fetch('/v1/network-directory/admin/entities', {
      method: 'POST',
      body: { scope: 'ihs', entity_code: 'QA_ND_ZZZ', entity_name: 'QA ZZZ Verified Center',
              entity_type_id: treatmentType.entity_type_id, city: 'Chicago', state: 'IL',
              virtual_available: true, cost_low: 4000, cost_high: 9000 }
    });
    ctx.assert(ihsB._ok, 'Second IHS entity created');
    const priv = await ctx.fetch('/v1/network-directory/admin/entities', {
      method: 'POST',
      body: { scope: 'program', entity_code: 'QA_ND_PRIV', entity_name: 'QA Local Coach',
              entity_type_id: coachingType.entity_type_id, city: 'Milwaukee', state: 'WI' }
    });
    ctx.assert(priv._ok && priv.tenant_id === WI && priv.ihs_status === null,
      'Program-private entity belongs to Wisconsin and carries NO IHS status');

    const dup = await ctx.fetch('/v1/network-directory/admin/entities', {
      method: 'POST', body: { scope: 'ihs', entity_code: 'QA_ND_AAA', entity_name: 'Duplicate', entity_type_id: treatmentType.entity_type_id }
    });
    ctx.assert(!dup._ok && dup._status === 409, 'Duplicate entity code rejected with 409');
    const badCost = await ctx.fetch('/v1/network-directory/admin/entities', {
      method: 'POST', body: { scope: 'program', entity_code: 'QA_ND_BAD', entity_name: 'Backwards', entity_type_id: coachingType.entity_type_id, cost_low: 900, cost_high: 100 }
    });
    ctx.assert(!badCost._ok && badCost._status === 400, 'Backwards cost range rejected with 400');

    // ── 2. Verified transition stamps and clears the date ──
    const toV = await ctx.fetch(`/v1/network-directory/admin/entities/${ihsB.entity_id}`, {
      method: 'PUT', body: { ihs_status: 'V' }
    });
    ctx.assert(toV._ok && toV.ihs_status === 'V' && Number.isInteger(toV.verified_date),
      `Marking Verified stamps verified_date (got ${toV.verified_date})`);
    const backToL = await ctx.fetch(`/v1/network-directory/admin/entities/${ihsB.entity_id}`, {
      method: 'PUT', body: { ihs_status: 'L' }
    });
    ctx.assert(backToL._ok && backToL.ihs_status === 'L' && backToL.verified_date === null,
      'Returning to Listed clears verified_date');
    const reV = await ctx.fetch(`/v1/network-directory/admin/entities/${ihsB.entity_id}`, {
      method: 'PUT', body: { ihs_status: 'V' }
    });
    ctx.assert(reV._ok && reV.ihs_status === 'V', 'Re-verified for the ordering and badge checks');

    // ── 3. Wisconsin's program list: add shared + private, duplicate 409 ──
    const addShared = await ctx.fetch('/v1/network-directory/program-list', { method: 'POST', body: { entity_id: ihsB.entity_id } });
    ctx.assert(addShared._ok && addShared.added, 'Shared IHS entity added to the program list');
    const addPriv = await ctx.fetch('/v1/network-directory/program-list', { method: 'POST', body: { entity_id: priv.entity_id } });
    ctx.assert(addPriv._ok, 'Private entity added to the program list');
    const dupAdd = await ctx.fetch('/v1/network-directory/program-list', { method: 'POST', body: { entity_id: priv.entity_id } });
    ctx.assert(!dupAdd._ok && dupAdd._status === 409, 'Adding the same entity twice → plain 409');

    // ── 4. Public view (anonymous): sections, whitelist, neutral order ──
    const pubWi = await anon('/v1/network-directory?t=wi_php');
    ctx.assert(pubWi.ok && pubWi.body.program === 'Wisconsin PHP', 'Public view resolves by tenant key, names the program');
    const progNames = pubWi.body.program_section.map(e => e.entity_name);
    ctx.assert(progNames.includes('QA Local Coach') && progNames.includes('QA ZZZ Verified Center'),
      `Program section carries both list entries (got: ${progNames.join(', ')})`);
    const ihsNames = pubWi.body.ihs_section.map(e => e.entity_name);
    ctx.assert(ihsNames.includes('QA AAA Unverified Center') && ihsNames.includes('QA ZZZ Verified Center'),
      'IHS section carries both pool entities');
    ctx.assert(!ihsNames.includes('QA Local Coach'), 'Private entity NEVER appears in the IHS section');

    // Neutral ordering (§6): the unverified AAA center sorts before the
    // Verified ZZZ center. If verification ranked, this flips.
    const aaaIdx = ihsNames.indexOf('QA AAA Unverified Center');
    const zzzIdx = ihsNames.indexOf('QA ZZZ Verified Center');
    ctx.assert(aaaIdx < zzzIdx, `Ordering is neutral alphabetical — verification does not rank (AAA at ${aaaIdx}, ZZZ at ${zzzIdx})`);

    // Card whitelist (appendix): no cost on the card, no internals; badge
    // data (ihs_status) present so "one entity, two relationships" renders.
    const card = pubWi.body.ihs_section[aaaIdx];
    ctx.assert(!('cost_low' in card) && !('cost_high' in card) && !('cost_notes' in card),
      'Cost never rides the listing card');
    ctx.assert(!('tenant_id' in card) && !('entity_code' in card) && !('is_active' in card),
      'Card rows carry only whitelisted public fields');
    const progVerified = pubWi.body.program_section.find(e => e.entity_name === 'QA ZZZ Verified Center');
    ctx.assert(progVerified && progVerified.ihs_status === 'V',
      'A program-list row carries its IHS verification state (one entity, two relationships)');

    // ── 5. The IHS pool is identical for Washington; the private entity is not ──
    const pubWa = await anon('/v1/network-directory?t=wa_php');
    ctx.assert(pubWa.ok, 'Washington public view loads');
    const waIhs = pubWa.body.ihs_section.map(e => e.entity_name);
    ctx.assert(waIhs.includes('QA AAA Unverified Center') && waIhs.includes('QA ZZZ Verified Center'),
      'Washington sees the SAME IHS pool (offered whole)');
    ctx.assert(!pubWa.body.program_section.map(e => e.entity_name).includes('QA Local Coach') &&
               !waIhs.includes('QA Local Coach'),
      "Wisconsin's private entity is invisible to Washington everywhere");

    // ── 6. Detail endpoint: cost in detail, no cross-tenant oracle ──
    const detail = await anon(`/v1/network-directory/entity/${ihsB.entity_id}?t=wi_php`);
    ctx.assert(detail.ok && detail.body.cost_low === 4000 && detail.body.on_program_list === true,
      'Detail view carries the cost + on-program-list flag');
    const privDetailWi = await anon(`/v1/network-directory/entity/${priv.entity_id}?t=wi_php`);
    ctx.assert(privDetailWi.ok, "Private entity's detail is reachable from its own program");
    const privDetailWa = await anon(`/v1/network-directory/entity/${priv.entity_id}?t=wa_php`);
    ctx.assert(privDetailWa.status === 404, "Private entity's detail answers 404 to another program (no oracle)");

    // ── 7. The three-way setting governs the public view ──
    async function setVis(v) {
      const r = await ctx.fetch('/v1/network-directory/settings', { method: 'PUT', body: { visibility: v } });
      ctx.assert(r._ok && r.visibility === v, `Visibility set to '${v}'`);
    }
    await setVis('program');
    let view = await anon('/v1/network-directory?t=wi_php');
    ctx.assert(view.body.visibility === 'program' && view.body.ihs_section.length === 0 && view.body.program_section.length > 0,
      "'program' hides the IHS section, keeps the program's list");
    await setVis('ihs');
    view = await anon('/v1/network-directory?t=wi_php');
    ctx.assert(view.body.program_section.length === 0 && view.body.ihs_section.length > 0,
      "'ihs' hides the program section, keeps the IHS network");
    await setVis('both');
    const badVis = await ctx.fetch('/v1/network-directory/settings', { method: 'PUT', body: { visibility: 'everything' } });
    ctx.assert(!badVis._ok && badVis._status === 400, 'Illegal visibility value rejected with 400');

    // ── 8. Washington's list is its own; it can adopt the shared entity ──
    const swWa = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WA } });
    ctx.assert(swWa._ok, 'Switched session into Washington (tenant 6)');
    const waAdd = await ctx.fetch('/v1/network-directory/program-list', { method: 'POST', body: { entity_id: ihsB.entity_id } });
    ctx.assert(waAdd._ok, 'Washington adds the shared IHS entity to ITS OWN list');
    const waAddPriv = await ctx.fetch('/v1/network-directory/program-list', { method: 'POST', body: { entity_id: priv.entity_id } });
    ctx.assert(!waAddPriv._ok && waAddPriv._status === 404,
      "Washington cannot add Wisconsin's private entity (404, no oracle)");
    const waList = await ctx.fetch('/v1/network-directory/program-list');
    ctx.assert(waList.length === 1, `Washington's list is its own (1 entry, got ${waList.length})`);
    const waEntry = waList[0];

    // ── 9. Delete refusal while any program references the entity ──
    const delRefused = await ctx.fetch(`/v1/network-directory/admin/entities/${ihsB.entity_id}`, { method: 'DELETE' });
    ctx.assert(!delRefused._ok && delRefused._status === 409,
      'Deleting an entity on program lists is refused with a plain-English 409');

    // ── 10. Non-superuser: every IHS-pool write is refused ──
    const swBack = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WI } });
    ctx.assert(swBack._ok, 'Back in Wisconsin for the role-gate check');
    const mkUser = await ctx.fetch('/v1/users', {
      method: 'POST',
      body: { username: 'QA_ND_Staff', password: 'qa-nd-154!', display_name: 'QA Directory Staff', tenant_id: WI, role: 'admin' }
    });
    ctx.assert(mkUser._ok && mkUser.user_id, 'Throwaway program-staff login created');
    const staffLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'QA_ND_Staff', password: 'qa-nd-154!' } });
    ctx.assert(staffLogin._ok && staffLogin.role !== 'superuser', 'Logged in as program staff (not superuser)');

    const staffIhsCreate = await ctx.fetch('/v1/network-directory/admin/entities', {
      method: 'POST', body: { scope: 'ihs', entity_code: 'QA_ND_ROGUE', entity_name: 'Rogue IHS Entry', entity_type_id: treatmentType.entity_type_id }
    });
    ctx.assert(!staffIhsCreate._ok && staffIhsCreate._status === 403,
      'Program staff cannot create IHS network entities (403)');
    const staffVerify = await ctx.fetch(`/v1/network-directory/admin/entities/${ihsA.entity_id}`, {
      method: 'PUT', body: { ihs_status: 'V' }
    });
    ctx.assert(!staffVerify._ok && staffVerify._status === 403,
      'Program staff cannot change Listed/Verified (403) — verification belongs to IHS');
    const staffProgCreate = await ctx.fetch('/v1/network-directory/admin/entities', {
      method: 'POST', body: { scope: 'program', entity_code: 'QA_ND_OWN', entity_name: 'QA Staff Own Entity', entity_type_id: coachingType.entity_type_id }
    });
    ctx.assert(staffProgCreate._ok && staffProgCreate.tenant_id === WI,
      'Program staff CAN create entities on their own shelf');

    // ── 11. Public guards ──
    const noT = await anon('/v1/network-directory');
    ctx.assert(noT.status === 400, 'Public view without a program identifier → 400');
    const badT = await anon('/v1/network-directory?t=not_a_program');
    ctx.assert(badT.status === 404, 'Public view with an unknown program → 404');

    // ── 12. Cleanup through the platform doors (Claude again) ──
    const relogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(relogin._ok, 'Claude re-login for cleanup');
    await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WA } });
    const waDel = await ctx.fetch(`/v1/network-directory/program-list/${waEntry.entry_id}`, { method: 'DELETE' });
    ctx.assert(waDel._ok, "Washington's entry removed");
    await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WI } });
    const wiList = await ctx.fetch('/v1/network-directory/program-list');
    for (const e of wiList) {
      const r = await ctx.fetch(`/v1/network-directory/program-list/${e.entry_id}`, { method: 'DELETE' });
      ctx.assert(r._ok, `Wisconsin entry ${e.entry_id} removed`);
    }
    for (const id of [ihsA.entity_id, ihsB.entity_id, priv.entity_id, staffProgCreate.entity_id]) {
      const r = await ctx.fetch(`/v1/network-directory/admin/entities/${id}`, { method: 'DELETE' });
      ctx.assert(r._ok && r.deleted, `Entity ${id} deleted once unreferenced`);
    }

    // ── 13. Browser walk (skipped when Playwright is unavailable) ──
    if (!ctx.hasBrowser()) {
      ctx.log('Browser not available — skipping the page walks');
      return;
    }

    // Re-plant a minimal pair for the walk: one Verified + one Listed in the pool.
    const walkA = await ctx.fetch('/v1/network-directory/admin/entities', {
      method: 'POST', body: { scope: 'ihs', entity_code: 'QA_WALK_L', entity_name: 'QA Walk Listed Center', entity_type_id: treatmentType.entity_type_id, city: 'Madison', state: 'WI' }
    });
    const walkB = await ctx.fetch('/v1/network-directory/admin/entities', {
      method: 'POST', body: { scope: 'ihs', entity_code: 'QA_WALK_V', entity_name: 'QA Walk Verified Center', entity_type_id: treatmentType.entity_type_id, city: 'Chicago', state: 'IL' }
    });
    ctx.assert(walkA._ok && walkB._ok, 'Walk entities planted');
    await ctx.fetch(`/v1/network-directory/admin/entities/${walkB.entity_id}`, { method: 'PUT', body: { ihs_status: 'V' } });

    const page = await ctx.openPage('/network-directory?t=wi_php');
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    try {
      await page.context().clearCookies();   // the participant page is truly anonymous
      await page.goto(`${ctx.apiBase}/network-directory?t=wi_php`, { waitUntil: 'networkidle' });
      await new Promise(r => setTimeout(r, 800));

      const walk = await page.evaluate(() => ({
        headings: Array.from(document.querySelectorAll('.section h2')).map(h => h.textContent),
        cards: document.querySelectorAll('.card').length,
        verifiedBadges: Array.from(document.querySelectorAll('.badge.verified')).map(b => b.textContent),
        selfReported: Array.from(document.querySelectorAll('.self-reported')).map(s => s.textContent),
        warningChars: document.getElementById('content').textContent.includes('⚠')
      }));
      ctx.assert(walk.headings.includes('Insight Health Solutions network'),
        'Participant page renders the IHS section with its normative heading');
      ctx.assert(walk.cards >= 2, `Participant page renders the entity cards anonymously (got ${walk.cards})`);
      ctx.assert(walk.verifiedBadges.some(b => b.includes('Verified by Insight Health Solutions')),
        'Verified badge reads exactly per the normative copy');
      ctx.assert(walk.selfReported.some(s => s.includes('Self reported. Not independently reviewed by IHS.')),
        'Listed entities carry the quiet self-reported attribution');
      ctx.assert(!walk.warningChars, 'No warning treatment anywhere near a Listed entity');

      // The verified-only filter is participant-applied and narrows the list.
      await page.click('#verifiedOnly');
      const afterFilter = await page.evaluate(() => document.querySelectorAll('.card').length);
      ctx.assert(afterFilter < walk.cards && afterFilter >= 1,
        `Verified-only filter narrows the list (${walk.cards} → ${afterFilter})`);

      // Detail view: cost appears only here, with the confirm-fee instruction.
      await page.click('.card');
      await new Promise(r => setTimeout(r, 500));
      const det = await page.evaluate(() => ({
        open: document.getElementById('overlay').classList.contains('open'),
        text: document.getElementById('detailBody').textContent
      }));
      ctx.assert(det.open, 'Listing detail opens');
      ctx.assert(errors.length === 0, `Participant page walk has zero console errors${errors.length ? ' — ' + errors[0] : ''}`);
    } finally {
      await page.close();
    }

    // Walk cleanup.
    for (const id of [walkA.entity_id, walkB.entity_id]) {
      await ctx.fetch(`/v1/network-directory/admin/entities/${id}`, { method: 'DELETE' });
    }
  }
};
