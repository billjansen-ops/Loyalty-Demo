/**
 * Insight: Erica's daily screens hold up in pixels (Session 152).
 *
 * The core geometry test (core/test_page_action_geometry.cjs) pixel-measures
 * 25 admin/edit pages — and ZERO healthcare screens. Session 150's tour found
 * exactly the defect class that gap allows: action bars living INSIDE modal
 * scroll regions, so on a person with real history the buttons scrolled out
 * of sight. Bill's standing ruling: extend the pixel standard to the screens
 * Erica actually uses. This is that extension.
 *
 * Standard (same as the core test): 1280x720 viewport; every primary action
 * button fully inside it, measured in pixels — "looks fine" doesn't count.
 * Plus the S150 modal contract, checked structurally AND in pixels: the
 * .modal-actions bar is a pinned SIBLING of the .modal-body scroller, never
 * a child, so its buttons stay reachable no matter how much history grows.
 *
 * Coverage — Erica's daily screens plus every modal S150 pinned:
 *   dashboard · intake queue (item detail GROWN past the fold with eight
 *   triage notes, activation, reactivation) · registry/action queue (item
 *   detail, export, new follow-up, follow-up detail when one exists) ·
 *   participant chart · clinic · documents (+ upload dialog) · participant
 *   portal (a clipped-shell page — its offers must render inside the frame).
 *
 * Self-contained: throwaway staff login (both intake positions — Erica's
 * real situation, and the fullest action bars) + one planted registrant
 * whose intake item is resolved again at the end. Personas and programs
 * resolve by NAME (Steadman, Insight Recovery) — never hand-entered ids.
 */
module.exports = {
  name: "Insight: Erica's daily screens hold up in pixels (action geometry + pinned modal bars)",

  async run(ctx) {
    const TENANT = 5;
    if (!ctx.hasBrowser()) {
      ctx.log('browser not available — Insight geometry sweep skipped');
      return;
    }

    // ── Setup (API): Claude superuser, real data resolved by name ──
    const claude = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'Claude', password: 'claude123' }
    });
    ctx.assert(claude._ok, 'Claude login (setup)');

    const roster = await ctx.fetch('/v1/wellness/members');
    const steadman = (roster.members || []).find(m => m.lname === 'Steadman');
    ctx.assert(steadman, 'Grant Steadman resolved by name (the chart persona with real history)');
    const STEADMAN_ID = String(steadman.membership_number);

    const partners = await ctx.fetch(`/v1/partners?tenant_id=${TENANT}`);
    let PROGRAM_ID = null;
    for (const p of (Array.isArray(partners) ? partners : [])) {
      const progs = await ctx.fetch(`/v1/partners/${p.partner_id}/programs?tenant_id=${TENANT}`);
      const hit = (Array.isArray(progs) ? progs : []).find(g => (g.program_name || '').includes('Insight Recovery'));
      if (hit) { PROGRAM_ID = hit.program_id; break; }
    }
    ctx.assert(PROGRAM_ID, 'Insight Recovery & Wellness Center program resolved by name');

    // Throwaway staff login holding BOTH intake positions — Erica's real
    // situation, and the configuration that renders the fullest action bars.
    const stamp = Math.floor(Math.random() * 1e9);
    const uname = `test_geo_${stamp}`;
    const staff = await ctx.fetch('/v1/users', {
      method: 'POST',
      body: { username: uname, password: 'geopass1', display_name: 'Geometry Walk', tenant_id: TENANT, role: 'admin' }
    });
    ctx.assert(staff._ok && staff.user_id, 'throwaway staff login created');
    const pos1 = await ctx.fetch(`/v1/users/${staff.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['CASEMAN', PROGRAM_ID] }
    });
    const pos2 = await ctx.fetch(`/v1/users/${staff.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['MEDDIR', PROGRAM_ID] }
    });
    ctx.assert(pos1._ok && pos2._ok, 'both intake positions assigned (CM + MD)');

    // Plant one registrant — enrollment files a CM intake item — then grow
    // the item with eight triage notes so the modal body GENUINELY overflows
    // at 720px. Short content passes the pixel check even with broken CSS;
    // the S150 defect only shows on a person with real history.
    const num = await ctx.fetch('/v1/member/next-number');
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: num.membership_number, fname: 'Gigi', lname: 'GeometryTest' }
    });
    ctx.assert(created._ok, `planted registrant enrolled (#${num.membership_number})`);
    const q = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
    const planted = (q.items || []).find(i => (i.member_name || '').includes('GeometryTest'));
    ctx.assert(planted, 'enrollment filed the intake item');

    // Notes are position-gated — write them as the staff login.
    const asStaff = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: uname, password: 'geopass1' }
    });
    ctx.assert(asStaff._ok, 'staff login works (API)');
    let notesOk = 0;
    for (let i = 1; i <= 8; i++) {
      const n = await ctx.fetch(`/v1/intake-items/${planted.link}/notes`, {
        method: 'POST',
        body: { note_text: `Geometry stress note ${i} of 8 — deliberately long enough to wrap onto several lines at modal width, so the triage-notes list pushes the modal body well past the 720-pixel fold and the pinned action bar has to earn its keep.` }
      });
      if (n._ok) notesOk++;
    }
    ctx.assertEqual(notesOk, 8, 'eight triage notes planted — the item detail body will overflow');

    // ── Browser: the staff login, at the pixel standard's viewport ──
    const page = await ctx.openPage('/login.html');
    page.on('dialog', async (d) => { try { await d.accept(); } catch (_) {} });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
    await page.setViewportSize({ width: 1280, height: 720 });
    const origin = new URL(page.url()).origin;
    await page.evaluate(async (u) => {
      await fetch('/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ username: u, password: 'geopass1' })
      });
      sessionStorage.setItem('tenant_id', '5');
      sessionStorage.setItem('tenant_name', 'Insight Health Solutions');
    }, uname);

    // Pixel-measure the buttons a selector finds: each visible one must sit
    // fully inside the viewport.
    const measure = (selector) => page.evaluate((sel) => {
      const out = [];
      for (const b of document.querySelectorAll(sel)) {
        const r = b.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        out.push({
          text: (b.textContent || '').trim().slice(0, 24),
          top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight,
          ok: r.top >= 0 && r.bottom <= window.innerHeight
        });
      }
      return out;
    }, selector);
    const assertOnScreen = (label, rows, minCount = 1) => {
      ctx.assert(rows.length >= minCount, `${label} — expected buttons present (${rows.length} >= ${minCount})`);
      const off = rows.filter(r => !r.ok);
      ctx.assert(off.length === 0,
        `${label} — every button inside 1280x720 (${off.length ? 'OFF-SCREEN: ' + JSON.stringify(off.slice(0, 2)) : rows.length + ' measured'})`);
    };

    // The S150 modal contract, structural AND pixel: the action bar is a
    // pinned SIBLING of the scroller (never a child), and its buttons sit
    // inside the viewport.
    const modalGeometry = () => page.evaluate(() => {
      const overlay = document.getElementById('detailOverlay');
      if (!overlay) return { open: false };
      const bar = overlay.querySelector('.modal-actions');
      const body = overlay.querySelector('.modal-body');
      const btns = bar ? [...bar.querySelectorAll('button')] : [];
      return {
        open: true,
        hasBar: !!bar,
        barInScroller: !!(bar && body && body.contains(bar)),
        bodyOverflows: !!(body && body.scrollHeight > body.clientHeight + 1),
        buttons: btns.map(b => {
          const r = b.getBoundingClientRect();
          return {
            text: (b.textContent || '').trim().slice(0, 24),
            top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight,
            ok: r.top >= 0 && r.bottom <= window.innerHeight
          };
        })
      };
    });
    const assertModal = (label, g, expectOverflow = false) => {
      ctx.assert(g.open, `${label} — modal opened`);
      if (!g.open) return;
      ctx.assert(g.hasBar && !g.barInScroller, `${label} — action bar is a pinned sibling of the scroller, not inside it`);
      if (expectOverflow) ctx.assert(g.bodyOverflows, `${label} — body genuinely overflows (the stress is real, not trivially passing)`);
      const off = (g.buttons || []).filter(b => !b.ok);
      ctx.assert(g.buttons.length >= 1 && off.length === 0,
        `${label} — action buttons inside the viewport (${off.length ? 'OFF-SCREEN: ' + JSON.stringify(off.slice(0, 2)) : g.buttons.length + ' measured'})`);
    };
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    try {
      // ═══ 1. Dashboard — her landing page ═══
      ctx.log('1: dashboard');
      await page.goto(`${origin}/verticals/workforce_monitoring/dashboard.html`, { waitUntil: 'networkidle', timeout: 20000 });
      await wait(3000);
      ctx.assert(!/login/.test(page.url()), 'dashboard did not bounce to login');
      assertOnScreen('dashboard Invite button', await measure('button[onclick*="ReferParticipant.open"]'));

      // ═══ 2. Intake Queue — header doors + the three S150-pinned modals ═══
      ctx.log('2: intake queue + its three modals');
      await page.goto(`${origin}/verticals/workforce_monitoring/intake_queue.html`, { waitUntil: 'networkidle', timeout: 20000 });
      await wait(3000);
      assertOnScreen('intake queue Invite/Enroll doors',
        await measure('button[onclick*="ReferParticipant.open"], button[onclick*="enrollFromQueue"]'), 2);

      // Item detail — grown past the fold with the eight planted notes.
      await page.evaluate((link) => openItemByLink(link), planted.link);
      await wait(1800);
      assertModal('intake item detail (grown with history)', await modalGeometry(), true);

      // Activation — opened from the same item context.
      await page.evaluate((n) => startActivation(String(n)), num.membership_number);
      await wait(1200);
      assertModal('activation modal', await modalGeometry());

      // Reactivation — the S149 name-search modal.
      await page.evaluate(() => { closeModal(); startReactivation(); });
      await wait(1200);
      assertModal('reactivation modal', await modalGeometry());
      await page.evaluate(() => closeModal());

      // ═══ 3. Registry (action queue) — header + the four S150-pinned modals ═══
      ctx.log('3: registry + its four modals');
      await page.goto(`${origin}/verticals/workforce_monitoring/action_queue.html`, { waitUntil: 'networkidle', timeout: 20000 });
      await wait(3000);
      assertOnScreen('registry header buttons',
        await measure('button[onclick*="showExportModal"], button[onclick*="loadRegistry"]'), 2);

      // Item detail — the page's own list is the truth for what's openable.
      const openLink = await page.evaluate(() => (allItems.find(i => i.status !== 'R') || {}).link || null);
      ctx.assert(openLink, 'registry page holds at least one open item');
      if (openLink) {
        await page.evaluate((l) => showItemDetailByLink(l), openLink);
        await wait(1500);
        assertModal('registry item detail', await modalGeometry());
        await page.evaluate(() => closeModal());
      }

      // Export modal.
      await page.evaluate(() => showExportModal());
      await wait(1000);
      assertModal('registry export modal', await modalGeometry());
      await page.evaluate(() => closeModal());

      // Follow-ups tab: the create dialog always, the detail when one exists.
      await page.evaluate(() => switchTab('followups'));
      await wait(2000);
      await page.evaluate(() => openNewFollowupDialog());
      await wait(1000);
      assertModal('new follow-up dialog', await modalGeometry());
      await page.evaluate(() => closeModal());
      const fuId = await page.evaluate(() => (allFollowups[0] || {}).followup_id || null);
      if (fuId) {
        await page.evaluate((id) => showFollowupDetail(id), fuId);
        await wait(1200);
        assertModal('follow-up detail modal', await modalGeometry());
        await page.evaluate(() => closeModal());
      } else {
        ctx.log('no follow-ups on this database — follow-up detail modal not measured this run');
      }

      // ═══ 4. Participant chart — the action row on a person with real history ═══
      ctx.log('4: participant chart');
      await page.evaluate((c) => sessionStorage.setItem('lp_page_context', JSON.stringify(c)),
        { memberId: STEADMAN_ID, programId: PROGRAM_ID });
      await page.goto(`${origin}/verticals/workforce_monitoring/physician_detail.html`, { waitUntil: 'networkidle', timeout: 20000 });
      await wait(4000);
      ctx.assert(await page.evaluate(() => document.body.innerText.includes('Steadman')),
        'chart loaded the participant');
      assertOnScreen('chart action row', await measure('.action-btn-sm'), 4);

      // ═══ 5. Clinic — the roster she manages ═══
      ctx.log('5: clinic');
      await page.evaluate((c) => sessionStorage.setItem('lp_page_context', JSON.stringify(c)), { programId: PROGRAM_ID });
      await page.goto(`${origin}/verticals/workforce_monitoring/clinic.html`, { waitUntil: 'networkidle', timeout: 20000 });
      await wait(3500);
      ctx.assert(await page.evaluate(() => document.querySelectorAll('#memberTableBody tr').length > 0),
        'clinic roster rendered');
      assertOnScreen('clinic header buttons',
        await measure('button[onclick*="ReferParticipant.open"], button[onclick*="enrollNew"], button[onclick*="exportRoster"]'), 3);

      // ═══ 6. Documents — the page and its upload dialog ═══
      ctx.log('6: documents + upload dialog');
      await page.goto(`${origin}/verticals/workforce_monitoring/documents.html`, { waitUntil: 'networkidle', timeout: 20000 });
      await wait(2500);
      assertOnScreen('documents Add button', await measure('.upload-btn'));
      await page.evaluate(() => openUpload());
      await wait(1200);
      assertOnScreen('upload dialog actions', await measure('.ddm-actions button'), 2);

      // ═══ 7. Participant portal — a clipped-shell page (overflow:hidden):
      //        anything outside the frame is UNREACHABLE, not below the fold ═══
      ctx.log('7: participant portal');
      await page.goto(`${origin}/verticals/workforce_monitoring/physician_portal.html`, { waitUntil: 'networkidle', timeout: 20000 });
      await wait(1500);
      await page.evaluate((m) => {
        physician = { membership_number: m.num, fname: m.fname, lname: m.lname, title: '' };
        showPortal();
      }, { num: STEADMAN_ID, fname: steadman.fname, lname: steadman.lname });
      await wait(2500);
      const offers = await page.evaluate(() => document.querySelectorAll('#assessmentList .assess-row').length);
      ctx.assert(offers >= 1, `portal offers assessments (${offers} rows)`);
      const firstTake = (await measure('#assessmentList .assess-take')).slice(0, 1);
      assertOnScreen('portal first survey offer', firstTake);

      // ═══ 8. The whole sweep ran without page errors ═══
      const realErrors = pageErrors.filter(t => !t.includes('favicon'));
      ctx.assert(realErrors.length === 0,
        `no uncaught page errors during the sweep (${JSON.stringify(realErrors.slice(0, 3))})`);
    } finally {
      await page.close();
    }

    // ── Cleanup: resolve the planted intake item so later tests in the same
    //    run never count our residue in the open queue. The item sits in
    //    CM review, so the valid own-stage disposition is route_resources
    //    (close_file is an MD-stage action and is rightly refused here). ──
    const closed = await ctx.fetch(`/v1/intake-items/${planted.link}/actions`, {
      method: 'POST', body: { action: 'route_resources', reason: 'Geometry test cleanup — planted item resolved.' }
    });
    ctx.assert(closed._ok, `planted intake item resolved (no open-queue residue for later tests) (${closed._status})`);
  }
};
