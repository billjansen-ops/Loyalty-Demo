/**
 * Workforce Monitoring — Protocol Card reference library endpoints.
 *
 * Phase 6 of the Insight server extraction. Moved from pointers.js
 * (formerly L26411 + L26422). See docs/INSIGHT_EXTRACTION_DESIGN.md.
 *
 * The two dynamic `await import('./verticals/workforce_monitoring/...')`
 * calls in the original have been replaced with a single static
 * vertical-internal import at the top of this file (allowed by
 * Decision 7 — vertical-internal imports are fine, only platform→
 * vertical imports are the layering violation).
 */

import {
  PROTOCOL_CARDS,
  CARD_CATEGORIES,
  RESPONSE_TIMELINE,
  CARD_PRIORITY,
  DETECTION_RULES
} from '../tenants/wi_php/protocolCards.js';

export function register(app, ctx) {
  // GET /v1/protocol-cards — all protocol cards with full clinical content
  app.get('/v1/protocol-cards', async (req, res) => {
    try {
      res.json({
        cards: PROTOCOL_CARDS,
        categories: CARD_CATEGORIES,
        responseTimeline: RESPONSE_TIMELINE,
        cardPriority: CARD_PRIORITY,
        detectionRules: DETECTION_RULES
      });
    } catch (err) {
      console.error('Protocol cards load error:', err);
      res.status(500).json({ error: 'Failed to load protocol cards' });
    }
  });

  // GET /v1/protocol-cards/:cardId — single protocol card by ID
  app.get('/v1/protocol-cards/:cardId', async (req, res) => {
    try {
      const card = PROTOCOL_CARDS[req.params.cardId.toUpperCase()];
      if (!card) return res.status(404).json({ error: 'Protocol card not found' });
      res.json({ card, responseTimeline: RESPONSE_TIMELINE });
    } catch (err) {
      console.error('Protocol card load error:', err);
      res.status(500).json({ error: 'Failed to load protocol card' });
    }
  });
}

export default { register };
