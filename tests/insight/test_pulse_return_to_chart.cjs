/**
 * Test C19: Pulse completion returns to participant chart
 *
 * Erica feedback (Session 112): "When completing a pulse in the chart it
 * takes you back to the roster — is there a way to be able to just stay
 * in that chart as you complete it." Same complaint applied to the
 * clinic-staff search/row-click path: after completing a pulse on a
 * specific participant, staff want to land on that participant's chart
 * (so they can act on the result), not bounce to the roster.
 *
 * Three entry paths into the pulse flow on clinic.html:
 *   A) Auto-launch from physician_detail (?action=pulse&memberId=…)
 *   B) startPhysicianSearch — staff clicks "Provider Pulse" then searches
 *   C) rowPulse — staff clicks the Pulse button on a roster row
 *
 * All three should set the `pulseReturnToChart` flag so the post-pulse
 * callback (offerCGIS) routes to physician_detail.html for that member
 * instead of refreshing the roster.
 *
 * This test verifies:
 *   1. Static code: clinic.html declares pulseReturnToChart and sets it
 *      in all three entry paths.
 *   2. Static code: offerCGIS branches on the flag and calls
 *      PageContext.navigate('physician_detail.html', …) when set.
 *   3. Browser: auto-launch with action=pulse populates the flag.
 *   4. Browser: invoking offerCGIS with the flag set navigates to
 *      physician_detail.html for the right member.
 */
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'C19: Pulse completion returns to participant chart',

  async run(ctx) {
    const clinicHtmlPath = path.join(__dirname, '..', '..', 'verticals', 'workforce_monitoring', 'clinic.html');
    const clinicSrc = fs.readFileSync(clinicHtmlPath, 'utf8');

    // ── Static checks ──
    ctx.log('--- Static: pulseReturnToChart wiring ---');
    ctx.assert(clinicSrc.includes('let pulseReturnToChart'),
      'clinic.html declares pulseReturnToChart variable');

    // Path A: auto-launch IIFE (action=pulse from physician_detail)
    const autoLaunchMatch = clinicSrc.match(/_ctx\.action === 'pulse'[\s\S]{0,300}pulseReturnToChart\s*=\s*_ctx\.memberId/);
    ctx.assert(!!autoLaunchMatch,
      'Path A (auto-launch): pulseReturnToChart set from _ctx.memberId');

    // Path B: startPhysicianSearch
    const searchMatch = clinicSrc.match(/function startPhysicianSearch\(\)\s*\{[\s\S]{0,400}pulseReturnToChart\s*=/);
    ctx.assert(!!searchMatch,
      'Path B (search): startPhysicianSearch sets pulseReturnToChart');

    // Path C: rowPulse
    const rowMatch = clinicSrc.match(/function rowPulse\([^)]*\)\s*\{[\s\S]{0,300}pulseReturnToChart\s*=/);
    ctx.assert(!!rowMatch,
      'Path C (row click): rowPulse sets pulseReturnToChart');

    // offerCGIS routes back to chart
    ctx.assert(/pulseReturnToChart[\s\S]{0,400}PageContext\.navigate\('physician_detail\.html'/.test(clinicSrc),
      'offerCGIS routes to physician_detail.html when pulseReturnToChart is set');
    // Flag is cleared after consumption (don't leave stale state for the next pulse)
    ctx.assert(/pulseReturnToChart\s*=\s*null/.test(clinicSrc),
      'pulseReturnToChart cleared after consumption');

    // ── Browser tests ──
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser tests — playwright not available');
      return;
    }

    ctx.log('--- Browser: auto-launch sets pulseReturnToChart ---');
    let page;
    try {
      page = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/clinic.html',
        { programId: 13, partnerId: 1, action: 'pulse', memberId: '34' }
      );
      await page.waitForTimeout(2500);

      const flagSet = await page.evaluate(() => {
        return typeof pulseReturnToChart !== 'undefined' && pulseReturnToChart === '34';
      });
      ctx.assert(flagSet === true,
        `pulseReturnToChart populated from action=pulse query (got: ${flagSet})`);

      // Now simulate post-pulse callback. Stub confirm() to decline CGI-S
      // so offerCGIS goes straight to the afterAll() routing branch, and
      // intercept PageContext.navigate to capture where we'd go.
      const navTarget = await page.evaluate(() => {
        window.__navCalls = [];
        const origNavigate = PageContext.navigate;
        PageContext.navigate = function(target, params) {
          window.__navCalls.push({ target, params });
        };
        // Decline the optional CGI-S so the routing branch fires immediately
        window.confirm = () => false;
        try {
          offerCGIS({ membership_number: '34', displayName: 'Test Participant' });
        } finally {
          // restore for any later assertions
          PageContext.navigate = origNavigate;
        }
        return window.__navCalls;
      });

      ctx.assert(Array.isArray(navTarget) && navTarget.length === 1,
        `offerCGIS triggered exactly one navigate (got: ${navTarget.length})`);
      if (navTarget.length) {
        ctx.assert(navTarget[0].target === 'physician_detail.html',
          `navigates to physician_detail.html (got: ${navTarget[0].target})`);
        ctx.assert(navTarget[0].params && navTarget[0].params.memberId === '34',
          `navigates with memberId=34 (got: ${JSON.stringify(navTarget[0].params)})`);
      }

      // Flag should be cleared — a subsequent pulse-from-roster would
      // otherwise inherit stale state and incorrectly route to the chart.
      const flagAfter = await page.evaluate(() => pulseReturnToChart);
      ctx.assert(flagAfter === null,
        `pulseReturnToChart cleared after navigation (got: ${flagAfter})`);
    } catch (e) {
      ctx.assert(false, `Browser test failed — ${e.message.substring(0, 200)}`);
    } finally {
      if (page) await page.close();
    }
  }
};
