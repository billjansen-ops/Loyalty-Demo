/**
 * Test C20: Protocol Card Library completeness
 *
 * Erica feedback (Session 112): clicking the T6 badge on a registry item
 * led to a dead end — the detection engine in pointers.js had been
 * shipping registry rows tagged EXTENDED_CARD: 'T6' / PROTOCOL_CARD: 'T6'
 * since Session 100, but T6 was never added to protocolCards.js. The
 * inline modal lookup failed, fell back to opening protocol_cards.html#T6
 * in a new tab, which also had no T6 entry — so the click went nowhere.
 *
 * This test guards against the same regression for any future card. It
 * scans pointers.js (and dominantDriver.js / custauth.js) for every
 * literal card code the detection engine writes, then asserts:
 *   1. Every detected card code has a PROTOCOL_CARDS library entry
 *   2. Every card listed in any CARD_CATEGORIES.cards array exists in
 *      PROTOCOL_CARDS (catches typos / mis-organization)
 *   3. Every card in CARD_PRIORITY exists in PROTOCOL_CARDS
 *   4. Every card in DETECTION_RULES exists in PROTOCOL_CARDS
 *   5. The /v1/protocol-cards endpoint surfaces all of the above
 *   6. The library entries pass minimum quality gates (have summary,
 *      steps, assignment, successMetric, escalationTrigger)
 *
 * Adding a new detection without a library entry will fail #1.
 */
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'C20: Protocol Card Library completeness',

  async run(ctx) {
    const ROOT = path.join(__dirname, '..', '..');
    const POINTERS_PATH = path.join(ROOT, 'pointers.js');
    const VERTICAL_DIR = path.join(ROOT, 'verticals', 'workforce_monitoring', 'tenants', 'wi_php');
    const sources = [
      POINTERS_PATH,
      path.join(VERTICAL_DIR, 'dominantDriver.js'),
      path.join(VERTICAL_DIR, 'custauth.js'),
    ];

    // ── 1. Scan source for literal card codes the detection engine writes ──
    // Patterns: EXTENDED_CARD: 'T6'  /  PROTOCOL_CARD: 'A1'  (single OR double quote)
    const detectedCodes = new Set();
    const pat = /(?:EXTENDED_CARD|PROTOCOL_CARD)\s*:\s*['"]([A-Z][A-Z0-9]{0,3})['"]/g;
    for (const f of sources) {
      if (!fs.existsSync(f)) continue;
      const src = fs.readFileSync(f, 'utf8');
      let m;
      while ((m = pat.exec(src)) !== null) {
        detectedCodes.add(m[1]);
      }
    }
    ctx.assert(detectedCodes.size > 0,
      `Found at least one detection-engine card code (got: ${detectedCodes.size})`);
    ctx.log(`Detection-engine card codes found in source: ${[...detectedCodes].sort().join(', ')}`);

    // ── 2. Fetch the live library via the API the UI uses ──
    const resp = await ctx.fetch('/v1/protocol-cards');
    ctx.assert(resp._ok, 'GET /v1/protocol-cards responds');
    const cards = resp.cards || {};
    const categories = resp.categories || [];
    const cardPriority = resp.cardPriority || [];
    const detectionRules = resp.detectionRules || {};

    // Sanity: detection scan picks up the F1_T5 sweep cards. Other cards
    // (S1, A1-A8, P1-P5, D-series, M-series) flow through variable lookups
    // in dominantDriver.js and are not literal-string detectable — they're
    // covered by the internal-consistency checks (#5) instead.
    for (const expected of ['T5', 'T6', 'F1']) {
      ctx.assert(detectedCodes.has(expected),
        `Detection scan picked up ${expected} (sanity check on the scan regex)`);
    }

    // ── 3. Every detected code has a library entry ──
    const missing = [];
    for (const code of detectedCodes) {
      if (!cards[code]) missing.push(code);
    }
    ctx.assert(missing.length === 0,
      `Every detection-engine card code has a PROTOCOL_CARDS entry (missing: ${missing.join(', ') || 'none'})`);

    // ── 4. T6 specifically (the bug Erica found) ──
    ctx.assert(!!cards.T6, 'T6 is in the library (regression for Erica\'s dead-link bug)');
    if (cards.T6) {
      ctx.assert(cards.T6.id === 'T6', 'T6.id is set');
      ctx.assert(typeof cards.T6.name === 'string' && cards.T6.name.length > 0, 'T6.name is set');
      ctx.assert(cards.T6.category === 'trajectory', `T6.category is trajectory (got: ${cards.T6.category})`);
      ctx.assert(Array.isArray(cards.T6.steps) && cards.T6.steps.length >= 3,
        `T6 has at least 3 protocol steps (got: ${cards.T6.steps?.length})`);
    }
    // T6 appears in the trajectory category's card list
    const trajCat = categories.find(c => c.key === 'trajectory');
    ctx.assert(!!trajCat && Array.isArray(trajCat.cards) && trajCat.cards.includes('T6'),
      'T6 is listed under the Trajectory Archetype category');
    // T6 has a detection rule entry
    ctx.assert(!!detectionRules.T6,
      'T6 has an entry in DETECTION_RULES (so the spec page renders it)');
    // T6 is positioned in CARD_PRIORITY between D3 and T5 (order matters: T6
    // should rank above T5 because the early-warning trigger fires first
    // chronologically; T5 takes over at week 12)
    const t6Idx = cardPriority.indexOf('T6');
    const t5Idx = cardPriority.indexOf('T5');
    ctx.assert(t6Idx >= 0, 'T6 is in CARD_PRIORITY');
    ctx.assert(t5Idx >= 0, 'T5 is in CARD_PRIORITY');
    ctx.assert(t6Idx < t5Idx, `T6 ranks higher than T5 in CARD_PRIORITY (T6=${t6Idx}, T5=${t5Idx})`);

    // ── 5. Internal consistency: every code referenced by category /
    //      priority / detection rule must have a library entry ──
    const categoryRefs = new Set();
    for (const cat of categories) {
      for (const code of (cat.cards || [])) categoryRefs.add(code);
    }
    const orphanCategoryRefs = [...categoryRefs].filter(c => !cards[c]);
    ctx.assert(orphanCategoryRefs.length === 0,
      `Every CARD_CATEGORIES code resolves to a library entry (orphans: ${orphanCategoryRefs.join(', ') || 'none'})`);

    const orphanPriority = cardPriority.filter(c => !cards[c]);
    ctx.assert(orphanPriority.length === 0,
      `Every CARD_PRIORITY code resolves to a library entry (orphans: ${orphanPriority.join(', ') || 'none'})`);

    const orphanRules = Object.keys(detectionRules).filter(c => !cards[c]);
    ctx.assert(orphanRules.length === 0,
      `Every DETECTION_RULES key resolves to a library entry (orphans: ${orphanRules.join(', ') || 'none'})`);

    // ── 6. Quality gate: every library card has the fields the modal
    //      reads. If a future card ships without these fields the inline
    //      modal renders blank sections — catch it here. ──
    const REQUIRED_FIELDS = ['id', 'name', 'category', 'categoryLabel', 'color', 'summary', 'steps', 'assignment', 'successMetric', 'escalationTrigger'];
    const incomplete = [];
    for (const [code, card] of Object.entries(cards)) {
      const missingFields = REQUIRED_FIELDS.filter(f => card[f] === undefined || card[f] === null || card[f] === '');
      if (missingFields.length || !Array.isArray(card.steps) || card.steps.length === 0) {
        incomplete.push(`${code}: ${missingFields.join(',') || 'empty steps'}`);
      }
    }
    ctx.assert(incomplete.length === 0,
      `Every library card has the modal's required fields populated (incomplete: ${incomplete.join(' | ') || 'none'})`);

    // ── 7. Browser: clicking the T6 badge opens the inline modal (does
    //      NOT fall through to a window.open new tab). This was the
    //      user-visible symptom Erica reported. ──
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser test — playwright not available');
      return;
    }

    let page;
    try {
      // Open the action queue (it has the same openProtocolCard helper
      // and is the page Erica was on when she clicked T6).
      page = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/action_queue.html',
        { programId: 13, partnerId: 1 }
      );
      await page.waitForTimeout(2500);

      // Spy on window.open so we can assert it was NOT called (the dead-end fallback)
      const result = await page.evaluate(async () => {
        let openedTab = null;
        const origOpen = window.open;
        window.open = (url) => { openedTab = url; return null; };
        try {
          await openProtocolCard('T6');
          // wait briefly for any async fetch + DOM insert
          await new Promise(r => setTimeout(r, 600));
          const overlay = document.getElementById('protocolCardOverlay');
          return {
            modalShown: !!overlay,
            modalText: overlay ? overlay.innerText.slice(0, 400) : null,
            openedTab,
          };
        } finally {
          window.open = origOpen;
          const overlay = document.getElementById('protocolCardOverlay');
          if (overlay) overlay.remove();
        }
      });

      ctx.assert(result.modalShown === true,
        `Browser: clicking T6 opens the inline protocol-card modal (got modalShown=${result.modalShown})`);
      ctx.assert(result.openedTab === null,
        `Browser: T6 click does NOT fall through to window.open (got: ${result.openedTab})`);
      if (result.modalShown && result.modalText) {
        ctx.assert(result.modalText.includes('T6') || result.modalText.includes('Repeated Moderate'),
          'Browser: modal renders T6 content');
      }
    } catch (e) {
      ctx.assert(false, `Browser test failed — ${e.message.substring(0, 200)}`);
    } finally {
      if (page) await page.close();
    }
  }
};
