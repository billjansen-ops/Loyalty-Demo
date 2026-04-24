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

    // Re-login as Claude for consistency with rest of suite
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
