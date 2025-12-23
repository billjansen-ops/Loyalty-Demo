/**
 * Fixed API router for Loyalty Platform Demo
 * Removes standalone server.listen() and exports app as router
 */

const express = require('express');
const app = express();

app.use(express.json());

// Example routes (from your existing logic)
app.get('/v1/activities', (req, res) => {
  res.json({ ok: true, source: 'api.js', activities: [] });
});

app.post('/v1/activities/accrual', (req, res) => {
  const activity = req.body;
  res.json({ ok: true, action: 'accrual added', activity });
});

// Health route
app.get(['/health', '/v1/health'], (req, res) => {
  res.json({ ok: true, service: 'api.js', time: new Date().toISOString() });
});

// Export the app for mounting in server.js
module.exports = app;
