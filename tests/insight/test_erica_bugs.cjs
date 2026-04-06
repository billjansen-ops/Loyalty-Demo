/**
 * Test: Erica's April 5 Bug Fixes
 *
 * Bug 1: Mini PPSI auto-expand (code structure verification)
 * Bug 2: PPSI scoring max_possible based on answer count
 * Bug 3: Compliance goBack() navigates to clinic (code structure verification)
 * Bug 4: Event button calls EventReportModal.open (code structure verification)
 * Bug 5: Notification red dot clears after marking read
 */
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'Erica April 5 Bug Fixes',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '34'; // James Okafor
    const PPSI_SURVEY_LINK = 1;

    // ══════════════════════════════════════════════
    // BUG 1: Mini PPSI auto-expand logic exists
    // ══════════════════════════════════════════════
    ctx.log('--- Bug 1: Mini PPSI auto-expand ---');

    const poserPath = path.join(__dirname, '..', '..', 'verticals', 'workforce_monitoring', 'poser_mobile.html');
    const poserCode = fs.readFileSync(poserPath, 'utf8');

    ctx.assert(poserCode.includes('allSurveyQuestions'), 'poser_mobile.html has allSurveyQuestions variable');
    ctx.assert(poserCode.includes('miniExpanded'), 'poser_mobile.html has miniExpanded flag');
    ctx.assert(poserCode.includes('value >= 2'), 'selectAnswer checks value >= 2 for expansion');
    ctx.assert(poserCode.includes('surveyQuestions = allSurveyQuestions'), 'Expansion swaps in full question set');

    // ══════════════════════════════════════════════
    // BUG 2: PPSI scoring uses dynamic max_possible
    // ══════════════════════════════════════════════
    ctx.log('--- Bug 2: PPSI scoring scale ---');

    const scorePath = path.join(__dirname, '..', '..', 'verticals', 'workforce_monitoring', 'tenants', 'wi_php', 'scorePPSI.js');
    const scoreCode = fs.readFileSync(scorePath, 'utf8');

    ctx.assert(scoreCode.includes('answers.length * 3'), 'scorePPSI uses answers.length * 3 for max_possible');
    ctx.assert(!scoreCode.includes('max_possible: 102'), 'scorePPSI does NOT hardcode max_possible: 102');

    // Test via API: submit mini PPSI (8 answers) and check scoring
    const activityDate = new Date().toISOString().slice(0, 10);
    const surveyResp = await ctx.fetch(`/v1/members/${MEMBER_NUMBER}/surveys`, {
      method: 'POST',
      body: { survey_link: PPSI_SURVEY_LINK, tenant_id: TENANT_ID, activity_date: activityDate }
    });
    ctx.assert(surveyResp._ok, 'Mini PPSI survey created');

    if (surveyResp._ok) {
      const msLink = surveyResp.member_survey_link;
      // Submit only 8 answers (mini PPSI sentinel questions)
      const miniAnswers = Array.from({ length: 8 }, (_, i) => ({
        question_link: i + 1,
        answer: 1
      }));

      const submitResp = await ctx.fetch(`/v1/member-surveys/${msLink}/answers`, {
        method: 'PUT',
        body: { answers: miniAnswers, submit: true, tenant_id: TENANT_ID, activity_date: activityDate }
      });
      ctx.assert(submitResp._ok, 'Mini PPSI submitted successfully');

      if (submitResp.scoring_result) {
        ctx.assertEqual(submitResp.scoring_result.details?.max_possible, 24, 'Mini PPSI max_possible is 24 (8 x 3)');
        ctx.assertEqual(submitResp.scoring_result.points, 8, 'Mini PPSI score is 8 (8 x 1)');
      } else {
        ctx.log('No inline scoring result — scoring may be async');
      }
    }

    // ══════════════════════════════════════════════
    // BUG 3: Compliance goBack uses PageContext.navigate
    // ══════════════════════════════════════════════
    ctx.log('--- Bug 3: Compliance goBack ---');

    const compPath = path.join(__dirname, '..', '..', 'verticals', 'workforce_monitoring', 'compliance_member.html');
    const compCode = fs.readFileSync(compPath, 'utf8');

    ctx.assert(!compCode.includes('document.referrer'), 'compliance_member.html does NOT use document.referrer');
    ctx.assert(compCode.includes("PageContext.navigate('clinic.html'"), 'goBack navigates directly to clinic.html');

    // ══════════════════════════════════════════════
    // BUG 4: Event button calls EventReportModal.open
    // ══════════════════════════════════════════════
    ctx.log('--- Bug 4: Event button on roster ---');

    const clinicPath = path.join(__dirname, '..', '..', 'verticals', 'workforce_monitoring', 'clinic.html');
    const clinicCode = fs.readFileSync(clinicPath, 'utf8');

    ctx.assert(!clinicCode.includes('showEventModal()'), 'clinic.html does NOT call showEventModal()');
    ctx.assert(clinicCode.includes('EventReportModal.open'), 'rowEvent calls EventReportModal.open');

    // ══════════════════════════════════════════════
    // BUG 5: Notification red dot clears on mark read
    // ══════════════════════════════════════════════
    ctx.log('--- Bug 5: Notification red dot ---');

    // Create a test notification — fan out to superuser role (Claude test user is superuser)
    const createResp = await ctx.fetch('/v1/notifications', {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        recipient_role: 'superuser',
        title: 'Test notification for bug 5',
        body: 'This should clear the red dot when marked read',
        severity: 'info',
        source: 'test_harness'
      }
    });
    ctx.assert(createResp._ok, 'Test notification created');

    // Fetch notifications — should have unread
    const beforeRead = await ctx.fetch('/v1/notifications?limit=50');
    ctx.assert(beforeRead._ok, 'Notifications fetched');
    ctx.assert(beforeRead.unread_count > 0, `Unread count > 0 before marking read (got: ${beforeRead.unread_count})`);

    // Find an unread notification to mark
    const unreadNote = (beforeRead.notifications || []).find(n => !n.is_read);
    if (unreadNote) {
      const markResp = await ctx.fetch(`/v1/notifications/${unreadNote.notification_id}/read`, {
        method: 'PATCH'
      });
      ctx.assert(markResp._ok, 'Notification marked as read');

      // Fetch again — unread count should have decreased
      const afterRead = await ctx.fetch('/v1/notifications?limit=50');
      ctx.assert(afterRead._ok, 'Notifications fetched after mark read');
      ctx.assert(afterRead.unread_count < beforeRead.unread_count, `Unread count decreased (before: ${beforeRead.unread_count}, after: ${afterRead.unread_count})`);
    } else {
      ctx.log('No unread notifications found to test mark-read');
    }

    // Verify client-side code does immediate badge update
    const headerPath = path.join(__dirname, '..', '..', 'lp-header.js');
    const headerCode = fs.readFileSync(headerPath, 'utf8');

    ctx.assert(headerCode.includes("badge.style.display = 'none'"), 'clickNotification hides badge when count reaches 0');
    ctx.assert(headerCode.includes('current - 1'), 'clickNotification decrements badge count client-side');

    // ══════════════════════════════════════════════
    // BROWSER TESTS
    // ══════════════════════════════════════════════
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser tests — playwright not available');
      return;
    }

    // ── Browser Bug 4: Event button opens modal ──
    ctx.log('--- Browser: Bug 4 — Event button opens modal ---');
    try {
      const clinicPage = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/clinic.html',
        { programId: 13, partnerId: 1 }
      );
      await clinicPage.waitForTimeout(3000);
      const eventModalVisible = await clinicPage.evaluate(() => {
        if (typeof rowEvent !== 'function') return 'rowEvent not defined';
        rowEvent('34','James','Okafor','Dr');
        return !!document.getElementById('ermOverlay');
      });
      ctx.assert(eventModalVisible === true, `Browser: Event button opens EventReportModal (got: ${eventModalVisible})`);
      await clinicPage.close();
    } catch(e) {
      ctx.assert(false, `Browser: Bug 4 failed — ${e.message.substring(0, 100)}`);
    }

    // ── Browser Bug 3: Compliance back goes to clinic ──
    ctx.log('--- Browser: Bug 3 — Compliance back goes to clinic ---');
    try {
      const compPage = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/compliance_member.html',
        { memberId: '34', programId: 13, partnerId: 1 }
      );
      await compPage.waitForTimeout(3000);
      const hasGoBack = await compPage.evaluate(() => typeof goBack === 'function');
      if (hasGoBack) {
        await compPage.evaluate(() => { goBack(); });
        await compPage.waitForURL(/clinic\.html/, { timeout: 5000 });
        ctx.assert(compPage.url().includes('clinic.html'), 'Browser: Compliance back navigates to clinic.html');
      } else {
        ctx.assert(false, 'Browser: goBack function not found on compliance page');
      }
      await compPage.close();
    } catch(e) {
      ctx.assert(false, `Browser: Bug 3 failed — ${e.message.substring(0, 100)}`);
    }

    // ── Browser Bug 5: Notification badge clears ──
    ctx.log('--- Browser: Bug 5 — Notification badge clears ---');
    try {
      const notifyPage = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/clinic.html',
        { programId: 13, partnerId: 1 }
      );
      await notifyPage.waitForTimeout(3000);
      const badgeBeforeText = await notifyPage.evaluate(() => {
        const b = document.getElementById('lpNotifyBadge');
        return b ? b.textContent : '';
      });
      const markResult = await notifyPage.evaluate(() => {
        if (typeof LPHeader === 'undefined') return 'LPHeader not defined';
        LPHeader.markAllRead();
        return 'ok';
      });
      if (markResult === 'ok') {
        await notifyPage.waitForTimeout(500);
        const badgeHidden = await notifyPage.evaluate(() => {
          const b = document.getElementById('lpNotifyBadge');
          return b ? b.style.display === 'none' : true;
        });
        ctx.assert(badgeHidden, `Browser: Notification badge hidden after markAllRead (was: ${badgeBeforeText})`);
      } else {
        ctx.assert(false, `Browser: ${markResult}`);
      }
      await notifyPage.close();
    } catch(e) {
      ctx.assert(false, `Browser: Bug 5 failed — ${e.message.substring(0, 100)}`);
    }
  }
};
