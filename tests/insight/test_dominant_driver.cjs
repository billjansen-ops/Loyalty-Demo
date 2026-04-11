/**
 * Test C6/C7: Dominant Driver Analysis + Protocol Card Assignment
 *
 * Verifies that stability registry items have:
 *   - dominant_driver set (PPSI, PULSE, COMPLIANCE, or EVENTS)
 *   - protocol_card assigned (A1-A8, P1-P5, C, D)
 *   - extended_card when applicable (T1-T4, M1-M3, D2-D3)
 *
 * Uses existing registry items — does not create new ones.
 */
module.exports = {
  name: 'C6/C7: Dominant Driver + Protocol Card Assignment',

  async run(ctx) {
    const TENANT_ID = 5;

    // ── Fetch all registry items ──
    ctx.log('--- Fetch stability registry ---');
    const regResp = await ctx.fetch(`/v1/stability-registry?tenant_id=${TENANT_ID}&include_resolved=true`);
    ctx.assert(regResp._ok, 'Stability registry endpoint responds');

    const items = regResp.items || regResp;
    ctx.assert(Array.isArray(items) && items.length > 0, `Registry has items (got: ${Array.isArray(items) ? items.length : 0})`);

    if (!items.length) return;

    // ── Verify dominant driver values ──
    ctx.log('--- Verify dominant drivers ---');
    const validDrivers = ['PPSI', 'PULSE', 'COMPLIANCE', 'EVENTS', 'COMPOSITE', 'MEDS', null];
    let withDriver = 0;
    let withCard = 0;
    let withExtended = 0;

    for (const item of items) {
      if (item.dominant_driver) {
        withDriver++;
        if (!validDrivers.includes(item.dominant_driver)) {
          ctx.assert(false, `Invalid driver: ${item.dominant_driver} on item ${item.link}`);
        }
      }
      if (item.protocol_card) withCard++;
      if (item.extended_card) withExtended++;
    }

    ctx.assert(withDriver > 0, `${withDriver} of ${items.length} items have dominant_driver`);
    ctx.assert(withCard > 0, `${withCard} of ${items.length} items have protocol_card`);
    ctx.log(`${withExtended} of ${items.length} items have extended_card`);

    // ── Verify protocol card values ──
    ctx.log('--- Verify protocol cards ---');
    const validBaseCards = ['A', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'B', 'P1', 'P2', 'P3', 'P4', 'P5', 'C', 'D', 'S1', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'M1', 'M2', 'M3', 'D2', 'D3', 'F1'];
    const validExtended = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'M1', 'M2', 'M3', 'D2', 'D3', 'F1', null];

    for (const item of items) {
      if (item.protocol_card) {
        ctx.assert(validBaseCards.includes(item.protocol_card),
          `Valid base card: ${item.protocol_card} (member: ${item.membership_number})`);
      }
      if (item.extended_card) {
        ctx.assert(validExtended.includes(item.extended_card),
          `Valid extended card: ${item.extended_card} (member: ${item.membership_number})`);
      }
    }

    // ── Verify driver-to-card consistency ──
    ctx.log('--- Verify driver-card consistency ---');
    for (const item of items) {
      if (item.dominant_driver === 'PPSI' && item.protocol_card) {
        ctx.assert(item.protocol_card.startsWith('A'),
          `PPSI driver → A-series card (got: ${item.protocol_card}, member: ${item.membership_number})`);
      }
      if (item.dominant_driver === 'PULSE' && item.protocol_card) {
        ctx.assert(item.protocol_card === 'B' || item.protocol_card.startsWith('P'),
          `PULSE driver → B or P-series card (got: ${item.protocol_card}, member: ${item.membership_number})`);
      }
      if (item.dominant_driver === 'COMPLIANCE' && item.protocol_card) {
        ctx.assert(item.protocol_card === 'C',
          `COMPLIANCE driver → C card (got: ${item.protocol_card}, member: ${item.membership_number})`);
      }
      if (item.dominant_driver === 'EVENTS' && item.protocol_card) {
        ctx.assert(item.protocol_card === 'D' || item.protocol_card === 'D2' || item.protocol_card === 'D3',
          `EVENTS driver → D card (got: ${item.protocol_card}, member: ${item.membership_number})`);
      }
    }

    // ── Verify protocol card library has all referenced cards ──
    ctx.log('--- Verify protocol card library ---');
    const libResp = await ctx.fetch(`/v1/protocol-cards?tenant_id=${TENANT_ID}`);
    ctx.assert(libResp._ok, 'Protocol card library endpoint responds');

    const cards = libResp.cards || libResp;
    if (Array.isArray(cards)) {
      ctx.assert(cards.length >= 20, `Protocol card library has ${cards.length} cards (expected 20+)`);
      const cardCodes = cards.map(c => c.card_code || c.code);

      // Check that all cards referenced by registry items exist in library
      const referencedCards = new Set();
      for (const item of items) {
        if (item.protocol_card) referencedCards.add(item.protocol_card);
        if (item.extended_card) referencedCards.add(item.extended_card);
      }
      for (const code of referencedCards) {
        ctx.assert(cardCodes.includes(code), `Referenced card ${code} exists in library`);
      }
    }

    // ── Verify registry items have required fields ──
    ctx.log('--- Verify registry item structure ---');
    const sample = items[0];
    ctx.assert(sample.urgency, `Item has urgency (got: ${sample.urgency})`);
    ctx.assert(sample.status, `Item has status (got: ${sample.status})`);
    ctx.assert(sample.reason_code, `Item has reason_code (got: ${sample.reason_code})`);
    ctx.assert(sample.created_ts || sample.created_date, 'Item has created timestamp');

    // ══════════════════════════════════════════════
    // BROWSER: Verify action queue shows driver + protocol cards
    // ══════════════════════════════════════════════
    if (!ctx.hasBrowser()) { ctx.log('Skipping browser tests — playwright not available'); return; }

    ctx.log('--- Browser: Action queue shows drivers + cards ---');
    try {
      const page = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/action_queue.html',
        { programId: 13, partnerId: 1 }
      );
      await page.waitForTimeout(3000);
      const hasRegistryItems = await page.evaluate(() => {
        const items = document.querySelectorAll('.qi-card, .queue-item, tr');
        return items.length > 2; // header + at least one item
      });
      ctx.assert(hasRegistryItems, 'Browser: Action queue displays registry items');

      const pageText = await page.evaluate(() => document.body.innerText);
      const hasDriverInfo = pageText.includes('PPSI') || pageText.includes('PULSE') || pageText.includes('COMPLIANCE') || pageText.includes('EVENTS');
      ctx.assert(hasDriverInfo, 'Browser: Action queue shows dominant driver labels');
      await page.close();
    } catch(e) {
      ctx.assert(false, `Browser: Action queue failed — ${e.message.substring(0, 100)}`);
    }

    ctx.log('--- Browser: Protocol card library loads ---');
    try {
      const page = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/protocol_cards.html',
        { programId: 13, partnerId: 1 }
      );
      await page.waitForTimeout(3000);
      const hasCards = await page.evaluate(() => {
        return document.querySelectorAll('.card, .protocol-card, [data-card-code]').length > 0 ||
               document.body.innerText.includes('A1') || document.body.innerText.includes('Protocol');
      });
      ctx.assert(hasCards, 'Browser: Protocol card library page loads with cards');
      await page.close();
    } catch(e) {
      ctx.assert(false, `Browser: Protocol cards failed — ${e.message.substring(0, 100)}`);
    }
  }
};
