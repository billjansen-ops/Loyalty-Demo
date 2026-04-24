/**
 * Core Platform Test: Multi-Counter Promotions (v56)
 * Creates promotions with >1 counter and verifies AND/OR joiner qualification.
 * Uses Delta airline tenant (tenant_id=1).
 */
module.exports = {
  name: 'Core: Multi-Counter Promotions',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1003'; // same test member as test_promotion_engine

    await ctx.fetch('/v1/auth/login', {
      method: 'POST',
      body: { username: 'DeltaCSR', password: 'DeltaCSR' }
    });
    ctx.log('Logged in as DeltaCSR');

    // ── 1. Create an OR-joiner multi-counter promo: 1 activity OR 10000 miles ──
    ctx.log('Step 1: Create multi-counter OR promotion');
    const orPromoCode = `MC-OR-${Date.now()}`;
    const createOrResp = await ctx.fetch('/v1/promotions', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        promotion_code: orPromoCode,
        promotion_name: 'Multi-Counter OR Test',
        promotion_description: 'Complete 1 flight OR earn 3000 miles',
        start_date: '2020-01-01',
        end_date: '2030-12-31',
        is_active: true,
        enrollment_type: 'A',
        allow_member_enrollment: false,
        reward_type: 'external',
        reward_amount: null,
        counter_joiner: 'OR',
        counters: [
          { count_type: 'activities', goal_amount: 1, sort_order: 0 },
          { count_type: 'miles', goal_amount: 3000, sort_order: 1 }
        ],
        // Legacy single-counter mirror fields
        count_type: 'activities',
        goal_amount: 1,
        process_limit_count: 1
      }
    });
    ctx.assert(createOrResp._ok, 'POST /v1/promotions accepts OR multi-counter');
    const orPromoId = createOrResp.promotion_id;
    ctx.log(`  Created OR promotion id=${orPromoId}`);

    // ── 2. Verify GET returns the counters array ──
    const getOrResp = await ctx.fetch(`/v1/promotions/${orPromoId}?tenant_id=${tenantId}`);
    ctx.assert(Array.isArray(getOrResp.counters) && getOrResp.counters.length === 2,
      'GET /v1/promotions/:id returns 2 counters');
    ctx.assert(getOrResp.counter_joiner === 'OR', 'counter_joiner preserved as OR');
    ctx.log(`  counters: ${getOrResp.counters.map(c => `${c.goal_amount} ${c.count_type}`).join(', ')}`);

    // ── 3. Create an AND-joiner promo: 1 activity AND 10000 miles ──
    ctx.log('Step 2: Create multi-counter AND promotion');
    const andPromoCode = `MC-AND-${Date.now()}`;
    const createAndResp = await ctx.fetch('/v1/promotions', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        promotion_code: andPromoCode,
        promotion_name: 'Multi-Counter AND Test',
        promotion_description: 'Complete 1 flight AND earn 3000 miles',
        start_date: '2020-01-01',
        end_date: '2030-12-31',
        is_active: true,
        enrollment_type: 'A',
        allow_member_enrollment: false,
        reward_type: 'external',
        reward_amount: null,
        counter_joiner: 'AND',
        counters: [
          { count_type: 'activities', goal_amount: 1, sort_order: 0 },
          { count_type: 'miles', goal_amount: 3000, sort_order: 1 }
        ],
        count_type: 'activities',
        goal_amount: 1,
        process_limit_count: 1
      }
    });
    ctx.assert(createAndResp._ok, 'POST /v1/promotions accepts AND multi-counter');
    const andPromoId = createAndResp.promotion_id;
    ctx.log(`  Created AND promotion id=${andPromoId}`);

    // ── 4. Post a single short flight for member 1003 (~200 miles MSP→ORD) ──
    ctx.log('Step 3: Post single short-haul accrual');
    const accrualResp = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-07',
        base_points: 300,
        CARRIER: 'DL',
        ORIGIN: 'MSP',
        DESTINATION: 'ORD',
        FLIGHT_NUMBER: 101,
        FARE_CLASS: 'Y',
        MQD: 50,
        SEAT_TYPE: 'W'
      }
    });
    ctx.assert(accrualResp._ok, 'Short-haul accrual created');

    // ── 5. Check promo states ──
    ctx.log('Step 4: Check OR vs AND qualification after 1 short-haul flight');
    const promosResp = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const promos = Array.isArray(promosResp) ? promosResp : (promosResp.promotions || []);

    const orPromoEnrollment = promos.find(p => p.promotion_id === orPromoId);
    ctx.assert(orPromoEnrollment, 'OR promo enrollment exists after accrual');
    if (orPromoEnrollment) {
      ctx.log(`  OR promo: qualified=${!!orPromoEnrollment.qualify_date}`);
      ctx.log(`    counters: ${orPromoEnrollment.counters.map(c => `${c.progress_counter}/${c.goal_amount} ${c.count_type}`).join(' | ')}`);
      // The activity counter should have hit 1 (goal=1); OR joiner → whole promo qualifies.
      ctx.assert(!!orPromoEnrollment.qualify_date, 'OR promo qualifies when ANY counter hits goal');
    }

    const andPromoEnrollment = promos.find(p => p.promotion_id === andPromoId);
    ctx.assert(andPromoEnrollment, 'AND promo enrollment exists after accrual');
    if (andPromoEnrollment) {
      ctx.log(`  AND promo: qualified=${!!andPromoEnrollment.qualify_date}`);
      ctx.log(`    counters: ${andPromoEnrollment.counters.map(c => `${c.progress_counter}/${c.goal_amount} ${c.count_type}`).join(' | ')}`);
      // Activity counter hits 1, miles counter only ~200 (goal 10000) — AND not yet satisfied.
      ctx.assert(!andPromoEnrollment.qualify_date, 'AND promo does NOT qualify when only one counter hits goal');
      const activityCounter = andPromoEnrollment.counters.find(c => c.count_type === 'activities');
      const milesCounter = andPromoEnrollment.counters.find(c => c.count_type === 'miles');
      ctx.assert(activityCounter && Number(activityCounter.progress_counter) >= 1, 'AND activity counter reached goal');
      ctx.assert(milesCounter && Number(milesCounter.progress_counter) < 3000, 'AND miles counter still below goal');
    }

    // ── 6. Post a long-haul flight (~10000+ miles) to push AND over the line ──
    ctx.log('Step 5: Post a long-haul accrual (LAX→HNL) to cross miles goal');
    await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-08',
        base_points: 5000,
        CARRIER: 'DL',
        ORIGIN: 'JFK',
        DESTINATION: 'LAX',
        FLIGHT_NUMBER: 102,
        FARE_CLASS: 'Y',
        MQD: 600,
        SEAT_TYPE: 'W'
      }
    });
    await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-04-09',
        base_points: 5500,
        CARRIER: 'DL',
        ORIGIN: 'LAX',
        DESTINATION: 'HNL',
        FLIGHT_NUMBER: 103,
        FARE_CLASS: 'Y',
        MQD: 600,
        SEAT_TYPE: 'W'
      }
    });

    const promosResp2 = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const promos2 = Array.isArray(promosResp2) ? promosResp2 : (promosResp2.promotions || []);
    const andAfter = promos2.find(p => p.promotion_id === andPromoId);
    if (andAfter) {
      ctx.log(`  AND promo after 3 flights: qualified=${!!andAfter.qualify_date}`);
      ctx.log(`    counters: ${andAfter.counters.map(c => `${c.progress_counter}/${c.goal_amount} ${c.count_type}`).join(' | ')}`);
      ctx.assert(!!andAfter.qualify_date, 'AND promo qualifies once ALL counters hit goal');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Browser-level assertions — verify the UI actually renders multi-counter
    // ─────────────────────────────────────────────────────────────────────
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser assertions — Playwright not available');
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      return;
    }

    // ── Browser: admin promotion edit page loads the multi-counter promo ──
    ctx.log('Step 6: Admin edit page — verify Count tab shows 2 counter rows');
    const adminPage = await ctx.openPage(`/admin_promotion_edit.html?id=${orPromoId}`);
    await adminPage.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'DeltaCSR', password: 'DeltaCSR' })
      });
      sessionStorage.setItem('tenant_id', '1');
    });
    await adminPage.goto(adminPage.url());
    await new Promise(r => setTimeout(r, 2500));

    const tabInfo = await adminPage.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.promo-tab')).map(t => ({
        label: (t.textContent || '').trim().replace(/\s+/g, ' '),
        active: t.classList.contains('active'),
        dataTab: t.dataset.tab
      }));
      const counterRows = document.querySelectorAll('#countersList .result-item').length;
      const joinerVisible = document.getElementById('counterJoinerRow')?.style.display !== 'none';
      const joinerValue = document.getElementById('counterJoiner')?.value;
      return { tabs, counterRows, joinerVisible, joinerValue };
    });
    ctx.assert(tabInfo.tabs.length === 3, `Admin edit page has 3 tabs (got ${tabInfo.tabs.length})`);
    const tabLabels = tabInfo.tabs.map(t => t.dataTab).join(',');
    ctx.assert(tabLabels === 'criteria,count,result', `Tab order: criteria, count, result (got: ${tabLabels})`);
    ctx.assert(tabInfo.counterRows === 2, `Count tab renders 2 counter rows (got ${tabInfo.counterRows})`);
    ctx.assert(tabInfo.joinerVisible, 'Joiner dropdown visible when 2+ counters');
    ctx.assert(tabInfo.joinerValue === 'OR', `Joiner value reflects saved OR (got ${tabInfo.joinerValue})`);

    // ── Browser: click Count tab, verify it activates ──
    ctx.log('Step 7: Click Count tab and verify panel switches');
    const afterClick = await adminPage.evaluate(() => {
      document.querySelector('[data-tab="count"]').click();
      const activeTab = document.querySelector('.promo-tab.active')?.dataset.tab;
      const activePanelId = document.querySelector('.promo-tab-panel.active')?.id;
      return { activeTab, activePanelId };
    });
    ctx.assert(afterClick.activeTab === 'count', `Count tab active after click (got ${afterClick.activeTab})`);
    ctx.assert(afterClick.activePanelId === 'countPanel', `countPanel active (got ${afterClick.activePanelId})`);

    // ── Browser: Add Counter dialog click-through ──
    ctx.log('Step 7b: Add Counter dialog — open, fill, save');
    await adminPage.evaluate(() => {
      document.querySelector('[onclick="openAddCounterDialog()"]').click();
    });
    await new Promise(r => setTimeout(r, 500));
    const dialogOpen = await adminPage.evaluate(() => {
      return document.getElementById('counterDialog').classList.contains('active');
    });
    ctx.assert(dialogOpen, 'Add Counter dialog opens on button click');

    // Pick type=activities and goal=7, then Save
    await adminPage.evaluate(() => {
      document.getElementById('counterTypeSelect').value = 'activities';
      document.getElementById('counterTypeSelect').dispatchEvent(new Event('change'));
      document.getElementById('counterGoalAmount').value = '7';
      document.querySelector('[onclick="saveCounter()"]').click();
    });
    await new Promise(r => setTimeout(r, 500));

    const afterAdd = await adminPage.evaluate(() => {
      return {
        dialogOpen: document.getElementById('counterDialog').classList.contains('active'),
        counterRows: document.querySelectorAll('#countersList .result-item').length,
        countTabBadge: document.getElementById('countTabBadge')?.textContent
      };
    });
    ctx.assert(!afterAdd.dialogOpen, 'Dialog closes after Save Counter');
    ctx.assert(afterAdd.counterRows === 3, `Counter list now has 3 rows (got ${afterAdd.counterRows})`);
    ctx.assert(afterAdd.countTabBadge === '3', `Count tab badge updated to 3 (got ${afterAdd.countTabBadge})`);

    // ── Browser: Edit Counter ──
    ctx.log('Step 7c: Edit counter — change goal, save, verify update');
    await adminPage.evaluate(() => {
      // Edit the first counter
      const btns = document.querySelectorAll('#countersList .result-item button');
      for (const b of btns) {
        if ((b.textContent || '').includes('Edit')) { b.click(); return; }
      }
    });
    await new Promise(r => setTimeout(r, 400));
    await adminPage.evaluate(() => {
      document.getElementById('counterGoalAmount').value = '99';
      document.querySelector('[onclick="saveCounter()"]').click();
    });
    await new Promise(r => setTimeout(r, 400));
    const afterEdit = await adminPage.evaluate(() => {
      const firstRow = document.querySelector('#countersList .result-item');
      return (firstRow?.textContent || '').replace(/\s+/g, ' ').trim();
    });
    ctx.assert(afterEdit.includes('99'), `Edited counter shows goal=99 (got: ${afterEdit.slice(0, 100)})`);

    // ── Browser: Delete Counter ──
    ctx.log('Step 7d: Delete counter — confirm and verify removal');
    // Stub confirm() to auto-accept
    await adminPage.evaluate(() => { window.confirm = () => true; });
    await adminPage.evaluate(() => {
      const btns = document.querySelectorAll('#countersList .result-item button');
      for (const b of btns) {
        if ((b.textContent || '').includes('Delete')) { b.click(); return; }
      }
    });
    await new Promise(r => setTimeout(r, 400));
    const afterDelete = await adminPage.evaluate(() => {
      return {
        rows: document.querySelectorAll('#countersList .result-item').length,
        badge: document.getElementById('countTabBadge')?.textContent
      };
    });
    ctx.assert(afterDelete.rows === 2, `Counter deleted (2 rows left, got ${afterDelete.rows})`);
    ctx.assert(afterDelete.badge === '2', `Count badge updated after delete (got ${afterDelete.badge})`);

    await adminPage.close();

    // ── Browser: CSR member page renders stacked per-counter progress bars ──
    ctx.log('Step 8: CSR member page — verify multi-counter progress bars render');
    const csrPage = await ctx.openPage(`/csr_member.html?memberId=${memberId}`);
    await csrPage.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'DeltaCSR', password: 'DeltaCSR' })
      });
      sessionStorage.setItem('tenant_id', '1');
    });
    await csrPage.goto(csrPage.url());
    await new Promise(r => setTimeout(r, 3000));

    // Click Promotions tab if there is one (csr_member has multiple tabs)
    await csrPage.evaluate(() => {
      const tabs = document.querySelectorAll('button, [onclick], a');
      for (const t of tabs) {
        const txt = (t.textContent || '').toLowerCase();
        if (txt.includes('promotion') && !txt.includes('manage')) {
          t.click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    const csrInfo = await csrPage.evaluate((code) => {
      // Find the row for our promo code
      const rows = document.querySelectorAll('#promotionsTableBody tr');
      for (const row of rows) {
        if ((row.textContent || '').includes(code)) {
          return {
            found: true,
            hasJoinerLabel: (row.textContent || '').toUpperCase().includes('JOINED BY OR'),
            progressTrackCount: row.querySelectorAll('.progress-track').length,
            text: (row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300)
          };
        }
      }
      return { found: false };
    }, 'MC-OR-');
    ctx.assert(csrInfo.found, 'CSR page shows the OR multi-counter promo row');
    if (csrInfo.found) {
      ctx.log(`  CSR row text: ${csrInfo.text}`);
      ctx.assert(csrInfo.hasJoinerLabel, 'CSR row shows "Joined by OR" label');
      ctx.assert(csrInfo.progressTrackCount >= 2, `CSR row has ≥2 progress tracks for 2 counters (got ${csrInfo.progressTrackCount})`);
    }

    // ── Browser: open Activities modal, verify per-counter breakdown ──
    ctx.log('Step 9: Activities modal — verify per-counter contributions render');
    const modalInfo = await csrPage.evaluate((code) => {
      const rows = document.querySelectorAll('#promotionsTableBody tr');
      for (const row of rows) {
        if ((row.textContent || '').includes(code)) {
          const actBtn = row.querySelector('button.btn-activities');
          if (actBtn) { actBtn.click(); return { clicked: true }; }
        }
      }
      return { clicked: false };
    }, 'MC-OR-');
    ctx.assert(modalInfo.clicked, 'Activities button clicked on multi-counter row');

    await new Promise(r => setTimeout(r, 1500));

    const modal = await csrPage.evaluate(() => {
      const content = document.getElementById('activitiesContent');
      if (!content) return { present: false };
      // Column header should change to "Contribution" for multi-counter
      const headers = Array.from(content.querySelectorAll('th')).map(th => (th.textContent || '').trim());
      const rowCells = Array.from(content.querySelectorAll('tbody tr td:last-child'))
        .map(td => (td.innerHTML || '').trim());
      return {
        present: true,
        headers,
        rowCells,
        text: (content.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400)
      };
    });
    ctx.assert(modal.present, 'Activities modal rendered');
    const contributionHeader = modal.headers[modal.headers.length - 1];
    ctx.assert(contributionHeader === 'Contribution',
      `Multi-counter modal uses generic "Contribution" header (got "${contributionHeader}")`);
    // Each row should contain BOTH "activit" and "mile" in its contribution cell (per-counter breakdown)
    const mixedCells = modal.rowCells.filter(html =>
      /activit/i.test(html) && /mile|skymile/i.test(html));
    ctx.assert(mixedCells.length > 0,
      `At least one row shows both 'activity' and 'miles' contributions (got ${mixedCells.length})`);

    await csrPage.close();

    // ── API-level assertions for the per-activity Promo Contributions endpoint
    // (the data that powers the "📋" promo-contributions modal on each activity
    // row). Deterministic — no browser needed.
    ctx.log('Step 9b: GET /v1/activities/:link/promotions returns per-counter rows with labels');
    // Find the first accrual activity link for member 1003 from our test run
    const actsResp = await ctx.fetch(`/v1/member/${memberId}/activities?tenant_id=${tenantId}`);
    const actsList = Array.isArray(actsResp) ? actsResp : (actsResp.activities || []);
    const aLink = (actsList.find(a => a.activity_type === 'A') || {}).link;
    ctx.assert(!!aLink, 'Found an accrual activity to probe');
    if (aLink) {
      const contribResp = await ctx.fetch(`/v1/activities/${encodeURIComponent(aLink)}/promotions?tenant_id=${tenantId}`);
      ctx.assert(Array.isArray(contribResp.contributions), 'Contributions array returned');
      const rows = contribResp.contributions || [];
      // Every row must have the fields the UI expects
      const shapeOk = rows.every(r =>
        'count_type' in r && 'promotion_code' in r && 'progress_counter' in r
        && 'goal_amount' in r && 'counter_joiner' in r && 'counter_molecule_label' in r);
      ctx.assert(shapeOk, 'Every contribution row has the fields the UI renders');
      // If the activity hit our multi-counter OR test promo on both counters,
      // there should be ≥2 rows for that promo_id with the same counter_joiner='OR'
      const byPromo = rows.reduce((m, r) => { (m[r.promotion_id] = m[r.promotion_id] || []).push(r); return m; }, {});
      const multiRows = Object.values(byPromo).find(rs => rs.length >= 2);
      if (multiRows) {
        const joiners = new Set(multiRows.map(r => r.counter_joiner));
        ctx.assert(joiners.size === 1, 'All rows for one promo share the same counter_joiner');
        ctx.assert(['AND','OR'].includes([...joiners][0]), 'counter_joiner is AND or OR');
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PUT edit flow — change joiner, adjust counters, add a third counter
    // ─────────────────────────────────────────────────────────────────────
    ctx.log('Step 10: PUT /v1/promotions/:id with counters[] array (edit flow)');
    // Re-login as DeltaCSR after browser test teardown
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });

    // Create a fresh UN-enrolled promo for counter-editing (enrolled promos are
    // locked by the grandfather rule — see 409 assertions below).
    const editPromoCode = `MC-E-${Date.now()}`; // keep ≤20 chars (VARCHAR(20))
    const editCreateResp = await ctx.fetch('/v1/promotions', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        promotion_code: editPromoCode,
        promotion_name: 'Edit Test',
        promotion_description: 'For PUT edit testing',
        start_date: '2020-01-01', end_date: '2030-12-31',
        is_active: false, // inactive so auto-enroll skips this promo
        enrollment_type: 'R', // restricted — no auto enrollment
        allow_member_enrollment: false,
        reward_type: 'external', reward_amount: null,
        counter_joiner: 'OR',
        counters: [{ count_type: 'activities', goal_amount: 1, sort_order: 0 }],
        count_type: 'activities', goal_amount: 1, process_limit_count: 1
      }
    });
    const editPromoId = editCreateResp.promotion_id;

    const putResp = await ctx.fetch(`/v1/promotions/${editPromoId}`, {
      method: 'PUT',
      body: {
        tenant_id: tenantId,
        promotion_code: editPromoCode,
        promotion_name: 'Edit Test (renamed)',
        promotion_description: 'Edited via PUT',
        start_date: '2020-01-01', end_date: '2030-12-31',
        is_active: false, enrollment_type: 'R', allow_member_enrollment: false,
        rule_id: null,
        reward_type: 'external', reward_amount: null,
        reward_tier_id: null, reward_promotion_id: null,
        counter_joiner: 'AND',
        counters: [
          { count_type: 'activities', goal_amount: 2, sort_order: 0 },
          { count_type: 'miles', goal_amount: 1500, sort_order: 1 },
          { count_type: 'activities', goal_amount: 5, sort_order: 2 }
        ],
        process_limit_count: 1,
        duration_type: null, duration_end_date: null, duration_days: null,
        point_type_id: null
      }
    });
    ctx.assert(putResp._ok || putResp.promotion_id, 'PUT /v1/promotions accepts counters[] update on un-enrolled promo');

    const getAfterPut = await ctx.fetch(`/v1/promotions/${editPromoId}?tenant_id=${tenantId}`);
    ctx.assert(getAfterPut.counter_joiner === 'AND', `PUT changed counter_joiner to AND (got ${getAfterPut.counter_joiner})`);
    ctx.assert(getAfterPut.counters.length === 3, `PUT replaced with 3 counters (got ${getAfterPut.counters.length})`);
    ctx.assert(getAfterPut.promotion_name === 'Edit Test (renamed)', 'PUT updated promotion_name');
    const goals = getAfterPut.counters.map(c => Number(c.goal_amount)).sort((a,b)=>a-b);
    ctx.assert(JSON.stringify(goals) === '[2,5,1500]', `PUT set counter goals correctly (got ${JSON.stringify(goals)})`);

    // Grandfather rule: PUT with different counters on an enrolled promo → 409
    ctx.log('Step 10b: Grandfather rule — PUT counter change on enrolled promo rejected');
    const grandfatherResp = await ctx.fetch(`/v1/promotions/${orPromoId}`, {
      method: 'PUT',
      body: {
        tenant_id: tenantId,
        promotion_code: orPromoCode,
        promotion_name: 'Should Not Apply',
        start_date: '2020-01-01', end_date: '2030-12-31',
        is_active: true, enrollment_type: 'A', allow_member_enrollment: false,
        rule_id: null,
        reward_type: 'external', reward_amount: null,
        reward_tier_id: null, reward_promotion_id: null,
        counter_joiner: 'AND',
        counters: [{ count_type: 'activities', goal_amount: 99, sort_order: 0 }],
        process_limit_count: 1,
        duration_type: null, duration_end_date: null, duration_days: null,
        point_type_id: null
      }
    });
    ctx.assert(grandfatherResp._status === 409,
      `Counter change on enrolled promo returns 409 (got ${grandfatherResp._status})`);
    ctx.assert((grandfatherResp.error || '').toLowerCase().includes('grandfather'),
      'Error message mentions grandfather rule');

    // PUT with same counters on enrolled promo should still work (metadata-only edit)
    const metaOnlyResp = await ctx.fetch(`/v1/promotions/${orPromoId}`, {
      method: 'PUT',
      body: {
        tenant_id: tenantId,
        promotion_code: orPromoCode,
        promotion_name: 'Multi-Counter OR Test (metadata edit)',
        start_date: '2020-01-01', end_date: '2030-12-31',
        is_active: true, enrollment_type: 'A', allow_member_enrollment: false,
        rule_id: null,
        reward_type: 'external', reward_amount: null,
        reward_tier_id: null, reward_promotion_id: null,
        counter_joiner: 'OR',
        counters: [
          { count_type: 'activities', goal_amount: 1, sort_order: 0 },
          { count_type: 'miles', goal_amount: 3000, sort_order: 1 }
        ],
        process_limit_count: 1,
        duration_type: null, duration_end_date: null, duration_days: null,
        point_type_id: null
      }
    });
    ctx.assert(metaOnlyResp._ok || metaOnlyResp.promotion_id,
      'Metadata-only PUT on enrolled promo succeeds (counters unchanged)');

    // ─────────────────────────────────────────────────────────────────────
    // Activity-delete cascade on a multi-counter promo
    // ─────────────────────────────────────────────────────────────────────
    ctx.log('Step 11: Activity-delete cascade reverses progress per counter');
    // Create a FRESH multi-counter OR promo that the member isn't yet qualified for.
    // Important: use a high mile goal so neither counter is already qualified when we delete.
    const delPromoCode = `MC-D-${Date.now()}`;
    const createDelResp = await ctx.fetch('/v1/promotions', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        promotion_code: delPromoCode,
        promotion_name: 'Multi-Counter Delete Test',
        promotion_description: 'For cascade testing',
        start_date: '2020-01-01',
        end_date: '2030-12-31',
        is_active: true,
        enrollment_type: 'A',
        allow_member_enrollment: false,
        reward_type: 'external',
        reward_amount: null,
        counter_joiner: 'OR',
        counters: [
          { count_type: 'activities', goal_amount: 10, sort_order: 0 },   // far from goal
          { count_type: 'miles', goal_amount: 999999, sort_order: 1 }     // far from goal
        ],
        count_type: 'activities', goal_amount: 10,  // legacy POST validation fields
        process_limit_count: 1
      }
    });
    const delPromoId = createDelResp.promotion_id;

    // Post an accrual that advances BOTH counters (activity + miles)
    const delAcc = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId, activity_date: '2026-04-12', base_points: 1200,
        CARRIER:'DL', ORIGIN:'MSP', DESTINATION:'ATL', FLIGHT_NUMBER:800, FARE_CLASS:'Y', MQD:150, SEAT_TYPE:'W'
      }
    });
    ctx.assert(delAcc._ok || delAcc.link, 'Accrual for delete test posted');
    const delActivityLink = delAcc.link;

    const promosBeforeDelete = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const delPromoBefore = (Array.isArray(promosBeforeDelete) ? promosBeforeDelete : (promosBeforeDelete.promotions || []))
      .find(p => p.promotion_id === delPromoId);
    const actBefore = delPromoBefore.counters.find(c => c.count_type === 'activities');
    const milesBefore = delPromoBefore.counters.find(c => c.count_type === 'miles');
    ctx.assert(Number(actBefore.progress_counter) === 1, `Activity counter at 1 before delete (got ${actBefore.progress_counter})`);
    ctx.assert(Number(milesBefore.progress_counter) > 0, `Miles counter advanced before delete (got ${milesBefore.progress_counter})`);

    // Delete the activity
    const delResp = await ctx.fetch(`/v1/activities/${encodeURIComponent(delActivityLink)}?user_id=1`, {
      method: 'DELETE'
    });
    ctx.assert(delResp._ok || delResp.type === 'A', 'DELETE /v1/activities succeeds');

    // Verify both counters rolled back
    const promosAfterDelete = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const delPromoAfter = (Array.isArray(promosAfterDelete) ? promosAfterDelete : (promosAfterDelete.promotions || []))
      .find(p => p.promotion_id === delPromoId);
    const actAfter = delPromoAfter.counters.find(c => c.count_type === 'activities');
    const milesAfter = delPromoAfter.counters.find(c => c.count_type === 'miles');
    ctx.assert(Number(actAfter.progress_counter) === 0, `Activity counter rolled back to 0 (got ${actAfter.progress_counter})`);
    ctx.assert(Number(milesAfter.progress_counter) === 0, `Miles counter rolled back to 0 (got ${milesAfter.progress_counter})`);
    ctx.log(`  Deleted activity caused per-counter rollback: activities ${actBefore.progress_counter}→${actAfter.progress_counter}, miles ${milesBefore.progress_counter}→${milesAfter.progress_counter}`);

    // ─────────────────────────────────────────────────────────────────────
    // Enrollment counter + activity counter mixed under AND joiner
    // ─────────────────────────────────────────────────────────────────────
    ctx.log('Step 12: Mixed enrollment+activity counters under AND joiner');
    const mixedPromoCode = `MC-M-${Date.now()}`;
    const mixedResp = await ctx.fetch('/v1/promotions', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        promotion_code: mixedPromoCode,
        promotion_name: 'Enroll AND Fly',
        promotion_description: 'Enroll (auto) AND fly 1 flight',
        start_date: '2020-01-01',
        end_date: '2030-12-31',
        is_active: true,
        enrollment_type: 'A',
        allow_member_enrollment: false,
        reward_type: 'external',
        reward_amount: null,
        counter_joiner: 'AND',
        counters: [
          { count_type: 'enrollments', goal_amount: 1, sort_order: 0 },
          { count_type: 'activities', goal_amount: 1, sort_order: 1 }
        ],
        count_type: 'enrollments', goal_amount: 1,  // legacy POST validation fields
        process_limit_count: 1
      }
    });
    const mixedPromoId = mixedResp.promotion_id;

    // Use admin manual-enroll to enroll member 1003 — enrollment counter should auto-seed
    // to goal; activity counter should stay at 0; promo should NOT be qualified yet (AND).
    const enrollResp = await ctx.fetch(
      `/v1/members/${memberId}/promotions/${mixedPromoId}/enroll`,
      { method: 'POST', body: { tenant_id: tenantId } }
    );
    ctx.assert(enrollResp._ok || enrollResp.member_promotion_id, 'Admin manual enroll succeeds');

    const afterEnroll = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const mixedAfter = (Array.isArray(afterEnroll) ? afterEnroll : (afterEnroll.promotions || []))
      .find(p => p.promotion_id === mixedPromoId);
    ctx.assert(mixedAfter, 'Mixed promo enrollment row exists');
    const enrCounter = mixedAfter.counters.find(c => c.count_type === 'enrollments');
    const actCounter = mixedAfter.counters.find(c => c.count_type === 'activities');
    ctx.assert(Number(enrCounter.progress_counter) === 1, `Enrollment counter auto-seeded to 1 (got ${enrCounter.progress_counter})`);
    ctx.assert(!!enrCounter.qualify_date, 'Enrollment counter has qualify_date set');
    ctx.assert(Number(actCounter.progress_counter) === 0, `Activity counter still 0 (got ${actCounter.progress_counter})`);
    ctx.assert(!mixedAfter.qualify_date, 'Promo NOT qualified yet (AND — activity counter still at 0)');

    // Post an activity — AND joiner should now qualify the promo.
    await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId, activity_date: '2026-04-11', base_points: 500,
        CARRIER:'DL', ORIGIN:'MSP', DESTINATION:'ORD', FLIGHT_NUMBER:801, FARE_CLASS:'Y', MQD:50, SEAT_TYPE:'W'
      }
    });
    const afterActivity = await ctx.fetch(`/v1/members/${memberId}/promotions?tenant_id=${tenantId}`);
    const mixedQualified = (Array.isArray(afterActivity) ? afterActivity : (afterActivity.promotions || []))
      .find(p => p.promotion_id === mixedPromoId);
    ctx.assert(!!mixedQualified.qualify_date, 'Promo qualifies once activity counter hits goal (AND joiner satisfied)');

    // ─────────────────────────────────────────────────────────────────────
    // Browser: Save Promotion — end-to-end author a new multi-counter promo
    // ─────────────────────────────────────────────────────────────────────
    if (!ctx.hasBrowser()) {
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      return;
    }
    ctx.log('Step 13: Author a new multi-counter promo via the admin UI (Save button)');
    const authorPage = await ctx.openPage('/admin_promotion_edit.html');
    await authorPage.evaluate(async () => {
      await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'DeltaCSR', password: 'DeltaCSR' })
      });
      sessionStorage.setItem('tenant_id', '1');
    });
    await authorPage.goto(authorPage.url());
    await new Promise(r => setTimeout(r, 2500));

    // Intercept alert() so a validation failure won't block the test
    await authorPage.evaluate(() => { window.alert = (msg) => { window.__lastAlert = msg; }; });

    const uiPromoCode = `UI-${Date.now()}`.slice(0, 20);
    await authorPage.evaluate((code) => {
      document.getElementById('promotionCode').value = code;
      document.getElementById('promotionName').value = 'UI-Authored Multi';
      document.getElementById('startDate').value = '2025-01-01';
      document.getElementById('endDate').value = '2030-12-31';
      document.getElementById('enrollmentType').value = 'A';
      document.getElementById('status').value = 'active';
    }, uiPromoCode);

    // Add two counters via the dialog
    for (const [type, goal] of [['activities', 4], ['miles', 2500]]) {
      await authorPage.evaluate(() => {
        document.querySelector('[onclick="openAddCounterDialog()"]').click();
      });
      await new Promise(r => setTimeout(r, 400));
      await authorPage.evaluate(([t, g]) => {
        document.getElementById('counterTypeSelect').value = t;
        document.getElementById('counterTypeSelect').dispatchEvent(new Event('change'));
        document.getElementById('counterGoalAmount').value = String(g);
        document.querySelector('[onclick="saveCounter()"]').click();
      }, [type, goal]);
      await new Promise(r => setTimeout(r, 400));
    }

    // Set joiner to OR
    await authorPage.evaluate(() => {
      document.getElementById('counterJoiner').value = 'OR';
    });

    // Click Save Promotion
    await authorPage.evaluate(() => {
      document.querySelector('[onclick="savePromotion()"]').click();
    });
    await new Promise(r => setTimeout(r, 1500));

    const alertMsg = await authorPage.evaluate(() => window.__lastAlert);
    if (alertMsg) ctx.log(`  alert: ${alertMsg}`);

    // Verify server side — promo exists with 2 counters + OR joiner
    const uiProbe = await ctx.fetch(`/v1/promotions?tenant_id=${tenantId}`);
    const uiList = Array.isArray(uiProbe) ? uiProbe : (uiProbe.promotions || []);
    const uiSaved = uiList.find(p => p.promotion_code === uiPromoCode);
    ctx.assert(!!uiSaved, `UI Save created promo with code ${uiPromoCode}`);
    if (uiSaved) {
      ctx.assert(uiSaved.counter_joiner === 'OR', `UI-saved counter_joiner=OR (got ${uiSaved.counter_joiner})`);
      ctx.assert(uiSaved.counters?.length === 2, `UI-saved has 2 counters (got ${uiSaved.counters?.length})`);
      const uiGoals = (uiSaved.counters || []).map(c => Number(c.goal_amount)).sort((a,b)=>a-b);
      ctx.assert(JSON.stringify(uiGoals) === '[4,2500]', `UI-saved goals [4, 2500] (got ${JSON.stringify(uiGoals)})`);
    }

    await authorPage.close();

    // Re-login as Claude for consistency with rest of suite
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
