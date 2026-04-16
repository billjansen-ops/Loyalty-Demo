/**
 * Insight Test: Participant Chart UI Features (Browser)
 *
 * Covers the UI features added for Erica's April 11 feedback batch
 * that were missed by the previous test suite. Each bug Erica found
 * corresponds to an assertion here so regressions get caught.
 *
 * Uses Grant Steadman (#53) — the sentinel persona in the demo clinic.
 */
module.exports = {
  name: 'Insight: Participant Chart UI (Mobile removed, Export, Void, Random, Click-through)',

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser tests — Playwright not available');
      return;
    }

    const TENANT_ID = 5;
    const STEADMAN_ID = '53';      // Grant Steadman — SENTINEL case, in demo clinic
    const HOPE_ID = '47';           // Hope Clearwater — compliance data, in demo clinic
    const PROGRAM_ID = 30;          // Insight Recovery & Wellness Center

    // ══════════════════════════════════════════════════════════════
    // 1. Mobile tab removed from staff participant chart
    // ══════════════════════════════════════════════════════════════
    ctx.log('--- Mobile tab removed ---');
    const chartPage = await ctx.openPageWithContext(
      '/verticals/workforce_monitoring/physician_detail.html',
      { memberId: STEADMAN_ID, programId: PROGRAM_ID }
    );
    await chartPage.evaluate(() => sessionStorage.setItem('tenant_id', '5'));
    await chartPage.reload({ waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 2000));

    const headerButtons = await chartPage.evaluate(() =>
      Array.from(document.querySelectorAll('.header-actions button')).map(b => b.textContent.trim())
    );
    ctx.assert(!headerButtons.some(b => b.includes('Mobile')), 'Mobile button removed from staff chart header');

    // ══════════════════════════════════════════════════════════════
    // 2. Export Chart button present on participant chart
    // ══════════════════════════════════════════════════════════════
    ctx.log('--- Export Chart button ---');
    const hasExport = headerButtons.some(b => b.includes('Export'));
    ctx.assert(hasExport, 'Export Chart button present on chart header');

    // Opening the modal should show section checkboxes
    await chartPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.header-actions button')).find(b => b.textContent.includes('Export'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    const exportSections = await chartPage.evaluate(() => {
      const modal = document.getElementById('exportChartModal');
      if (!modal) return [];
      return Array.from(modal.querySelectorAll('input[type=checkbox]')).map(c => c.value);
    });
    const expectedSections = ['registry', 'followups', 'surveys', 'compliance', 'notes', 'meds'];
    for (const s of expectedSections) {
      ctx.assert(exportSections.includes(s), `Export modal has "${s}" section checkbox`);
    }
    await chartPage.evaluate(() => { const m = document.getElementById('exportChartModal'); if (m) m.remove(); });

    // ══════════════════════════════════════════════════════════════
    // 3. Registry click-through opens item detail modal
    // ══════════════════════════════════════════════════════════════
    ctx.log('--- Registry click-through ---');
    const registryItemsCount = await chartPage.evaluate(() =>
      document.querySelectorAll('#registryItems > div').length
    );
    ctx.assert(registryItemsCount > 0, 'Registry items visible on Steadman chart');

    if (registryItemsCount > 0) {
      await chartPage.evaluate(() => document.querySelector('#registryItems > div').click());
      await new Promise(r => setTimeout(r, 4000));

      const modalOpen = await chartPage.evaluate(() => !!document.getElementById('detailOverlay'));
      ctx.assert(modalOpen, 'Registry click navigates to action_queue with detail modal open');

      if (modalOpen) {
        const modalText = await chartPage.evaluate(() => document.getElementById('detailOverlay').innerText);
        ctx.assert(modalText.includes('SENTINEL') || modalText.includes('Sentinel'), 'Deep-linked item modal shows SENTINEL urgency');
        ctx.assert(modalText.includes('Steadman'), 'Deep-linked item modal shows Steadman');
      }
    }
    await chartPage.close();

    // ══════════════════════════════════════════════════════════════
    // 4. View Participant button on follow-up modal
    // ══════════════════════════════════════════════════════════════
    ctx.log('--- View Participant button on follow-up ---');
    const aqPage = await ctx.openPageWithContext(
      '/verticals/workforce_monitoring/action_queue.html',
      { programId: PROGRAM_ID }
    );
    await aqPage.evaluate(() => sessionStorage.setItem('tenant_id', '5'));
    await aqPage.reload({ waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 2000));

    // Switch to followups tab
    const hasFuTab = await aqPage.evaluate(() => !!document.getElementById('tabFollowups'));
    if (hasFuTab) {
      await aqPage.evaluate(() => document.getElementById('tabFollowups').click());
      await new Promise(r => setTimeout(r, 3000));

      const fuCount = await aqPage.evaluate(() => document.querySelectorAll('.fu-item').length);
      if (fuCount > 0) {
        await aqPage.evaluate(() => document.querySelector('.fu-item').click());
        await new Promise(r => setTimeout(r, 2000));
        const modalText = await aqPage.evaluate(() => {
          const m = document.getElementById('detailOverlay');
          return m ? m.innerText : '';
        });
        ctx.assert(modalText.includes('View'), 'Follow-up modal has View Participant button');
      } else {
        ctx.log('  No follow-up rows available to test — skipping button check');
      }
    }
    await aqPage.close();

    // ══════════════════════════════════════════════════════════════
    // 5. Compliance cadence UI shows Schedule Mode with all 3 options
    // ══════════════════════════════════════════════════════════════
    ctx.log('--- Compliance Schedule Mode options ---');
    const compPage = await ctx.openPageWithContext(
      '/verticals/workforce_monitoring/compliance_member.html',
      { memberId: HOPE_ID, programId: PROGRAM_ID }
    );
    await compPage.evaluate(() => sessionStorage.setItem('tenant_id', '5'));
    await compPage.reload({ waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 3000));

    // Open a cadence edit modal (find an edit button)
    const openedCadence = await compPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /edit|change|cadence/i.test(b.textContent));
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (openedCadence) {
      await new Promise(r => setTimeout(r, 2000));
      const modeOptions = await compPage.evaluate(() => {
        const sel = document.getElementById('cadEditMode');
        if (!sel) return [];
        return Array.from(sel.options).map(o => o.value);
      });
      ctx.assert(modeOptions.includes('cadence'), 'Schedule mode has "cadence" option');
      ctx.assert(modeOptions.includes('random'), 'Schedule mode has "random" option');
      ctx.assert(modeOptions.includes('undetermined'), 'Schedule mode has "undetermined" option');
    } else {
      ctx.log('  Could not open cadence edit modal — skipping Schedule Mode check');
    }
    await compPage.close();

    // ══════════════════════════════════════════════════════════════
    // 6. Survey submission creates a Bill epoch datetime (not Unix seconds)
    //    and MEDS reports it as current
    // ══════════════════════════════════════════════════════════════
    ctx.log('--- Survey submission → MEDS completion ---');
    // Find PPSI survey
    const surveys = await ctx.fetch(`/v1/surveys?tenant_id=${TENANT_ID}`);
    const surveyList = surveys.surveys || surveys;
    const ppsi = Array.isArray(surveyList) ? surveyList.find(s => s.survey_code === 'PPSI') : null;
    if (ppsi) {
      // Start + submit a PPSI for Hope Clearwater
      const start = await ctx.fetch(`/v1/members/${HOPE_ID}/surveys`, {
        method: 'POST',
        body: { survey_link: ppsi.link, tenant_id: TENANT_ID }
      });
      ctx.assert(start._ok && start.member_survey_link, 'PPSI survey started');

      const submit = await ctx.fetch(`/v1/member-surveys/${start.member_survey_link}/answers`, {
        method: 'PUT',
        body: { answers: [], submit: true, tenant_id: TENANT_ID }
      });
      ctx.assert(submit._ok, `PPSI survey submitted (status ${submit._status})`);

      // Verify end_ts is in Bill epoch datetime range (not Unix seconds)
      // Unix 2026 ≈ 1.7 billion. Bill epoch datetime for 2026 ≈ 209 million.
      // If submit wrote Unix seconds, end_ts would be > 1 billion.
      const memberSurvey = await ctx.fetch(`/v1/member-surveys/${start.member_survey_link}?tenant_id=${TENANT_ID}`);
      if (memberSurvey._ok && memberSurvey.end_ts) {
        ctx.assert(memberSurvey.end_ts < 500000000, `end_ts is Bill epoch datetime (got ${memberSurvey.end_ts}, Unix would be >1e9)`);
      }
    }

    // ══════════════════════════════════════════════════════════════
    // 7. Mark in Error (void) button appears for supervisors on PPSI detail
    // ══════════════════════════════════════════════════════════════
    ctx.log('--- Mark in Error button (void UI) ---');
    // Patricia Walsh (#37) has historical PPSI submissions with activities
    const walshPage = await ctx.openPageWithContext(
      '/verticals/workforce_monitoring/physician_detail.html',
      { memberId: '37' }
    );
    await walshPage.evaluate(() => sessionStorage.setItem('tenant_id', '5'));
    await walshPage.reload({ waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 3000));

    const ppsiRowClicked = await walshPage.evaluate(() => {
      const rows = document.querySelectorAll('#activityBody tr');
      for (const r of rows) {
        const badge = r.querySelector('.type-badge.survey');
        if (badge) { r.click(); return true; }
      }
      return false;
    });

    if (ppsiRowClicked) {
      await new Promise(r => setTimeout(r, 2500));
      const modalText = await walshPage.evaluate(() => {
        const m = document.getElementById('detailOverlay');
        return m ? m.innerText : '';
      });
      ctx.assert(modalText.includes('Mark in Error') || modalText.includes('VOIDED'),
        'PPSI detail modal shows Mark in Error button (or VOIDED badge)');
    } else {
      ctx.log('  No PPSI activity rows for Walsh — skipping void button check');
    }
    await walshPage.close();
  }
};
