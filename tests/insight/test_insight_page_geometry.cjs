/**
 * Insight: Erica's daily screens hold up in pixels (Session 152) — and since
 * Session 164, they hold up on a COPIED tenant too (audit standing guard #5).
 *
 * The core geometry test (core/test_page_action_geometry.cjs) pixel-measures
 * 25 admin/edit pages — and ZERO healthcare screens. Session 150's tour found
 * exactly the defect class that gap allows: action bars living INSIDE modal
 * scroll regions, so on a person with real history the buttons scrolled out
 * of sight. Bill's standing ruling: extend the pixel standard to the screens
 * Erica actually uses. This is that extension.
 *
 * THE TWO RUNS (S164): every UI test used to pin tenant 5, so no UI test
 * could catch a copied-tenant regression — the S160-162 bug family's whole
 * signature. The same sweep now runs twice: Wisconsin (the original), then
 * the WPHP sandbox (a copied tenant). The sandbox run builds its own persona
 * through the real doors — enrollment → intake → clinic assignment →
 * instruments → PPSI sittings (the third elevated, so a real registry item
 * files through the detector chain) — because CI's database has the sandbox
 * tenant but not its locally-seeded people (fixtures BUILT, not assumed —
 * the S159 lesson).
 *
 * Standard (same as the core test): 1280x720 viewport; every primary action
 * button fully inside it, measured in pixels — "looks fine" doesn't count.
 * Plus the S150 modal contract, checked structurally AND in pixels: the
 * .modal-actions bar is a pinned SIBLING of the .modal-body scroller, never
 * a child, so its buttons stay reachable no matter how much history grows.
 *
 * Coverage per run — Erica's daily screens plus every modal S150 pinned:
 *   dashboard · intake queue (item detail GROWN past the fold with eight
 *   triage notes, activation, reactivation) · registry/action queue (item
 *   detail, export, new follow-up, follow-up detail when one exists) ·
 *   participant chart · clinic · documents (+ upload dialog) · participant
 *   portal (a clipped-shell page — its offers must render inside the frame).
 *
 * Self-contained: throwaway staff login (both intake positions — Erica's
 * real situation, and the fullest action bars) + one planted person whose
 * intake item is resolved again at the end. Tenants resolve by KEY,
 * personas and programs by NAME or by the run's own fixtures — never
 * hand-entered ids.
 */

const RUNS = [
  // Wisconsin: the original run. Steadman is the chart persona with deep
  // real history; Insight Recovery is his program. Both exist in every
  // environment's baseline (CI included).
  { key: 'wi_php', personaLname: 'Steadman', programMatch: 'Insight Recovery', buildPersona: false },
  // The sandbox: a COPIED tenant (link_tank ids, Pacific TZ). No baseline
  // people anywhere but local — the run builds its persona through the
  // real doors and measures the same screens.
  { key: 'wphp_sandbox', personaLname: 'GeometryTest', programMatch: null, buildPersona: true },
];

module.exports = {
  name: "Insight: Erica's daily screens hold up in pixels — on Wisconsin AND a copied tenant (audit guard #5)",

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('browser not available — Insight geometry sweep skipped');
      return;
    }
    for (const cfg of RUNS) {
      ctx.log(`════════ SWEEP: ${cfg.key} ════════`);
      await sweepTenant(ctx, cfg);
    }
  }
};

async function sweepTenant(ctx, cfg) {
  // ── Setup (API): Claude superuser, session bound to THIS run's tenant ──
  const claude = await ctx.fetch('/v1/auth/login', {
    method: 'POST', body: { username: 'Claude', password: 'claude123' }
  });
  ctx.assert(claude._ok, `[${cfg.key}] Claude login (setup)`);

  const tenants = await ctx.fetch('/v1/tenants');
  const tenantList = Array.isArray(tenants) ? tenants : (tenants.tenants || []);
  const tenantRow = tenantList.find(t => t.tenant_key === cfg.key);
  ctx.assert(!!tenantRow, `[${cfg.key}] tenant resolved by KEY, never a hardcoded number`);
  if (!tenantRow) return;
  const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantRow.tenant_id } });
  ctx.assert(sw._ok && sw.tenant, `[${cfg.key}] session switched into the tenant`);
  const TENANT = tenantRow.tenant_id;
  const TENANT_NAME = (sw.tenant && sw.tenant.name) || tenantRow.name || cfg.key;

  // ── Program: by name where the run names one (Wisconsin), otherwise the
  //    first active clinic — the sandbox persona is activated INTO it, which
  //    makes its roster non-empty by construction. ──
  const partners = await ctx.fetch(`/v1/partners?tenant_id=${TENANT}`);
  let PROGRAM_ID = null, PARTNER_ID = null;
  for (const p of (Array.isArray(partners) ? partners : [])) {
    const progs = await ctx.fetch(`/v1/partners/${p.partner_id}/programs?tenant_id=${TENANT}`);
    const list = Array.isArray(progs) ? progs : [];
    const hit = cfg.programMatch
      ? list.find(g => (g.program_name || '').includes(cfg.programMatch))
      : list.find(g => g.is_active !== false);
    if (hit) { PROGRAM_ID = hit.program_id; PARTNER_ID = p.partner_id; break; }
  }
  ctx.assert(PROGRAM_ID, `[${cfg.key}] program resolved (${cfg.programMatch || 'first active clinic'})`);

  // Throwaway staff login holding BOTH intake positions — Erica's real
  // situation, and the configuration that renders the fullest action bars.
  const stamp = Math.floor(Math.random() * 1e9);
  const uname = `test_geo_${stamp}`;
  const staff = await ctx.fetch('/v1/users', {
    method: 'POST',
    body: { username: uname, password: 'geopass1', display_name: 'Geometry Walk', tenant_id: TENANT, role: 'admin' }
  });
  ctx.assert(staff._ok && staff.user_id, `[${cfg.key}] throwaway staff login created`);
  const pos1 = await ctx.fetch(`/v1/users/${staff.user_id}/molecule-rows/POSITIONCLINIC`, {
    method: 'POST', body: { values: ['CASEMAN', PROGRAM_ID] }
  });
  const pos2 = await ctx.fetch(`/v1/users/${staff.user_id}/molecule-rows/POSITIONCLINIC`, {
    method: 'POST', body: { values: ['MEDDIR', PROGRAM_ID] }
  });
  ctx.assert(pos1._ok && pos2._ok, `[${cfg.key}] both intake positions assigned (CM + MD)`);

  // Plant one registrant — enrollment files a CM intake item — then grow
  // the item with eight triage notes so the modal body GENUINELY overflows
  // at 720px. Short content passes the pixel check even with broken CSS;
  // the S150 defect only shows on a person with real history.
  const num = await ctx.fetch('/v1/member/next-number');
  const created = await ctx.fetch('/v1/member', {
    method: 'POST', body: { membership_number: num.membership_number, fname: 'Gigi', lname: 'GeometryTest' }
  });
  ctx.assert(created._ok, `[${cfg.key}] planted registrant enrolled (#${num.membership_number})`);
  const q = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
  const planted = (q.items || []).find(i => (i.member_name || '').includes('GeometryTest'));
  ctx.assert(planted, `[${cfg.key}] enrollment filed the intake item`);

  // Notes are position-gated — write them as the staff login.
  const asStaff = await ctx.fetch('/v1/auth/login', {
    method: 'POST', body: { username: uname, password: 'geopass1' }
  });
  ctx.assert(asStaff._ok, `[${cfg.key}] staff login works (API)`);
  let notesOk = 0;
  for (let i = 1; i <= 8; i++) {
    const n = await ctx.fetch(`/v1/intake-items/${planted.link}/notes`, {
      method: 'POST',
      body: { note_text: `Geometry stress note ${i} of 8 — deliberately long enough to wrap onto several lines at modal width, so the triage-notes list pushes the modal body well past the 720-pixel fold and the pinned action bar has to earn its keep.` }
    });
    if (n._ok) notesOk++;
  }
  ctx.assertEqual(notesOk, 8, `[${cfg.key}] eight triage notes planted — the item detail body will overflow`);

  // ── The chart/portal persona ──
  // Wisconsin: an existing member with deep history, resolved by NAME.
  // Sandbox: the planted person themselves — activated mid-sweep (below).
  let personaId = String(num.membership_number);
  let personaFname = 'Gigi', personaLname = 'GeometryTest';
  if (!cfg.buildPersona) {
    const roster = await ctx.fetch('/v1/wellness/members');
    const persona = (roster.members || []).find(m => m.lname === cfg.personaLname);
    ctx.assert(persona, `[${cfg.key}] ${cfg.personaLname} resolved by name (the chart persona with real history)`);
    if (!persona) return;
    personaId = String(persona.membership_number);
    personaFname = persona.fname; personaLname = persona.lname;
  }

  // ── Browser: the staff login, at the pixel standard's viewport ──
  const page = await ctx.openPage('/login.html');
  page.on('dialog', async (d) => { try { await d.accept(); } catch (_) {} });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
  await page.setViewportSize({ width: 1280, height: 720 });
  const origin = new URL(page.url()).origin;
  await page.evaluate(async (a) => {
    await fetch('/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ username: a.uname, password: 'geopass1' })
    });
    sessionStorage.setItem('tenant_id', String(a.tenant));
    sessionStorage.setItem('tenant_name', a.tenantName);
  }, { uname, tenant: TENANT, tenantName: TENANT_NAME });

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
    ctx.assert(rows.length >= minCount, `[${cfg.key}] ${label} — expected buttons present (${rows.length} >= ${minCount})`);
    const off = rows.filter(r => !r.ok);
    ctx.assert(off.length === 0,
      `[${cfg.key}] ${label} — every button inside 1280x720 (${off.length ? 'OFF-SCREEN: ' + JSON.stringify(off.slice(0, 2)) : rows.length + ' measured'})`);
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
    ctx.assert(g.open, `[${cfg.key}] ${label} — modal opened`);
    if (!g.open) return;
    ctx.assert(g.hasBar && !g.barInScroller, `[${cfg.key}] ${label} — action bar is a pinned sibling of the scroller, not inside it`);
    if (expectOverflow) ctx.assert(g.bodyOverflows, `[${cfg.key}] ${label} — body genuinely overflows (the stress is real, not trivially passing)`);
    const off = (g.buttons || []).filter(b => !b.ok);
    ctx.assert(g.buttons.length >= 1 && off.length === 0,
      `[${cfg.key}] ${label} — action buttons inside the viewport (${off.length ? 'OFF-SCREEN: ' + JSON.stringify(off.slice(0, 2)) : g.buttons.length + ' measured'})`);
  };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  try {
    // ═══ 1. Dashboard — her landing page ═══
    ctx.log(`1: dashboard (${cfg.key})`);
    await page.goto(`${origin}/verticals/workforce_monitoring/dashboard.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await wait(3000);
    ctx.assert(!/login/.test(page.url()), `[${cfg.key}] dashboard did not bounce to login`);
    assertOnScreen('dashboard Invite button', await measure('button[onclick*="ReferParticipant.open"]'));

    // ═══ 2. Intake Queue — header doors + the three S150-pinned modals ═══
    ctx.log(`2: intake queue + its three modals (${cfg.key})`);
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

    // ═══ 2b. SANDBOX ONLY: build the persona's real history through the
    //     real doors, between the intake screens (which needed the item
    //     OPEN) and the registry/chart/clinic/portal screens (which need a
    //     participant with sittings and an open registry item).
    //     The staff enroll door already stamped PARTICIPANT (Phase-1
    //     semantics — the activation door rightly 409s "already active"),
    //     so what the persona still needs is the CLINIC: the member
    //     molecule-rows door, same shape as the staff-position assignment. ═══
    if (cfg.buildPersona) {
      ctx.log(`2b: building the sandbox persona through real doors (${cfg.key})`);
      const clin = await ctx.fetch(`/v1/members/${personaId}/molecule-rows/PARTNER_PROGRAM`, {
        method: 'POST', body: { values: [PARTNER_ID, PROGRAM_ID] }
      });
      ctx.assert(clin._ok, `[${cfg.key}] persona assigned to the clinic (${clin._status}${clin.error ? ': ' + clin.error : ''})`);

      // Expected instruments: weekly PPSI (the portal's offer list).
      let inst = await ctx.fetch(`/v1/members/${personaId}/instruments`, {
        method: 'POST', body: { survey_code: 'PPSI', mode: 'cadence' }
      });
      if (!inst._ok) inst = await ctx.fetch(`/v1/members/${personaId}/instruments`, {
        method: 'POST', body: { survey_code: 'PPSI' }
      });
      ctx.assert(inst._ok, `[${cfg.key}] PPSI expected-instrument assigned (${inst._status})`);

      // Three PPSI sittings: two quiet, then one elevated (all answers 2 —
      // never 3, which would ring the separate severe-single-item watchdog).
      // The elevated composite crosses a band threshold, so a REAL registry
      // item files through the detector chain the audit revived — the same
      // machinery the registry screen is about to be measured against.
      const surveys = await ctx.fetch(`/v1/surveys?tenant_id=${TENANT}`);
      const surveyList = Array.isArray(surveys) ? surveys : (surveys.surveys || []);
      const ppsi = surveyList.find(s => s.survey_code === 'PPSI');
      ctx.assert(!!ppsi, `[${cfg.key}] PPSI resolves by CODE (link ${ppsi ? ppsi.link : '—'} — link_tank region)`);
      const questions = await ctx.fetch(`/v1/surveys/${ppsi.link}/questions?tenant_id=${TENANT}`);
      ctx.assert(Array.isArray(questions) && questions.length > 0, `[${cfg.key}] PPSI questions load (${(questions || []).length})`);
      let sittingsOk = 0;
      for (const level of [0, 0, 2]) {
        const activityDate = new Date().toLocaleDateString('en-CA');
        const sResp = await ctx.fetch(`/v1/members/${personaId}/surveys`, {
          method: 'POST', body: { survey_link: ppsi.link, tenant_id: TENANT, activity_date: activityDate }
        });
        if (!sResp._ok) break;
        const answers = questions.map(qq => ({ question_link: qq.question_link, answer: level }));
        const sub = await ctx.fetch(`/v1/member-surveys/${sResp.member_survey_link}/answers`, {
          method: 'PUT', body: { answers, submit: true, tenant_id: TENANT, activity_date: activityDate }
        });
        if (sub._ok) sittingsOk++;
        await wait(1500); // POST_ACCRUAL settle
      }
      ctx.assertEqual(sittingsOk, 3, `[${cfg.key}] three PPSI sittings submitted (real history for chart + portal)`);

      const reg = await ctx.fetch(`/v1/stability-registry/member/${personaId}?tenant_id=${TENANT}`);
      const regItems = Array.isArray(reg.items || reg) ? (reg.items || reg) : [];
      ctx.assert(regItems.length >= 1,
        `[${cfg.key}] the elevated sitting filed a real registry item through the detector chain (${regItems.map(i => i.reason_code).join(', ') || 'none'})`);
    }

    // ═══ 3. Registry (action queue) — header + the four S150-pinned modals ═══
    ctx.log(`3: registry + its four modals (${cfg.key})`);
    await page.goto(`${origin}/verticals/workforce_monitoring/action_queue.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await wait(3000);
    assertOnScreen('registry header buttons',
      await measure('button[onclick*="showExportModal"], button[onclick*="loadRegistry"]'), 2);

    // Item detail — the page's own list is the truth for what's openable.
    const openLink = await page.evaluate(() => (allItems.find(i => i.status !== 'R') || {}).link || null);
    ctx.assert(openLink, `[${cfg.key}] registry page holds at least one open item`);
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
      ctx.log(`no follow-ups on this database — follow-up detail modal not measured this run (${cfg.key})`);
    }

    // ═══ 4. Participant chart — the action row on a person with real history ═══
    ctx.log(`4: participant chart (${cfg.key})`);
    await page.evaluate((c) => sessionStorage.setItem('lp_page_context', JSON.stringify(c)),
      { memberId: personaId, programId: PROGRAM_ID });
    await page.goto(`${origin}/verticals/workforce_monitoring/physician_detail.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await wait(4000);
    ctx.assert(await page.evaluate((ln) => document.body.innerText.includes(ln), personaLname),
      `[${cfg.key}] chart loaded the participant`);
    assertOnScreen('chart action row', await measure('.action-btn-sm'), 4);

    // ═══ 5. Clinic — the roster she manages ═══
    ctx.log(`5: clinic (${cfg.key})`);
    await page.evaluate((c) => sessionStorage.setItem('lp_page_context', JSON.stringify(c)), { programId: PROGRAM_ID });
    await page.goto(`${origin}/verticals/workforce_monitoring/clinic.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await wait(3500);
    ctx.assert(await page.evaluate(() => document.querySelectorAll('#memberTableBody tr').length > 0),
      `[${cfg.key}] clinic roster rendered`);
    assertOnScreen('clinic header buttons',
      await measure('button[onclick*="ReferParticipant.open"], button[onclick*="enrollNew"], button[onclick*="exportRoster"]'), 3);

    // ═══ 6. Documents — the page and its upload dialog ═══
    ctx.log(`6: documents + upload dialog (${cfg.key})`);
    await page.goto(`${origin}/verticals/workforce_monitoring/documents.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await wait(2500);
    assertOnScreen('documents Add button', await measure('.upload-btn'));
    await page.evaluate(() => openUpload());
    await wait(1200);
    assertOnScreen('upload dialog actions', await measure('.ddm-actions button'), 2);

    // ═══ 7. Participant portal — a clipped-shell page (overflow:hidden):
    //        anything outside the frame is UNREACHABLE, not below the fold ═══
    ctx.log(`7: participant portal (${cfg.key})`);
    await page.goto(`${origin}/verticals/workforce_monitoring/physician_portal.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await wait(1500);
    await page.evaluate((m) => {
      physician = { membership_number: m.num, fname: m.fname, lname: m.lname, title: '' };
      showPortal();
    }, { num: personaId, fname: personaFname, lname: personaLname });
    await wait(2500);
    const offers = await page.evaluate(() => document.querySelectorAll('#assessmentList .assess-row').length);
    ctx.assert(offers >= 1, `[${cfg.key}] portal offers assessments (${offers} rows)`);
    const firstTake = (await measure('#assessmentList .assess-take')).slice(0, 1);
    assertOnScreen('portal first survey offer', firstTake);

    // ═══ 8. The whole sweep ran without page errors ═══
    const realErrors = pageErrors.filter(t => !t.includes('favicon'));
    ctx.assert(realErrors.length === 0,
      `[${cfg.key}] no uncaught page errors during the sweep (${JSON.stringify(realErrors.slice(0, 3))})`);
  } finally {
    await page.close();
  }

  // ── Cleanup: no open-queue or registry residue for later tests. ──
  // The item sits in CM review, so the valid own-stage disposition is
  // route_resources (close_file is an MD-stage action, rightly refused).
  const closed = await ctx.fetch(`/v1/intake-items/${planted.link}/actions`, {
    method: 'POST', body: { action: 'route_resources', reason: 'Geometry test cleanup — planted item resolved.' }
  });
  ctx.assert(closed._ok, `[${cfg.key}] planted intake item resolved (no open-queue residue for later tests) (${closed._status})`);
  if (cfg.buildPersona) {
    // Resolve the registry items the elevated sitting filed.
    const reg = await ctx.fetch(`/v1/stability-registry/member/${personaId}?tenant_id=${TENANT}`);
    const regItems = Array.isArray(reg.items || reg) ? (reg.items || reg) : [];
    const open = regItems.filter(i => i.status !== 'R');
    let resolved = 0;
    for (const item of open) {
      const r = await ctx.fetch(`/v1/stability-registry/${item.link}`, {
        method: 'PUT', body: { status: 'R', resolution_notes: 'Geometry test cleanup — planted persona resolved.' }
      });
      if (r._ok) resolved++;
    }
    ctx.assert(resolved === open.length,
      `[${cfg.key}] planted registry items resolved (${resolved}/${open.length} — no residue for later tests)`);
  }
}
