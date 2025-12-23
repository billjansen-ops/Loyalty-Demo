/**
 * api_meltdown_v2.js — defines GET /v1/activities to match frontend exactly.
 */

const express = require('express');
const app = express();

app.get('/v1/activities', (req, res) => {
  res.json({
    ok: true,
    source: 'api_meltdown_v2.js',
    activities: [
      { id: 1, type: 'Flight', miles: 1500, note: 'Sample flight activity' },
      { id: 2, type: 'Hotel', miles: 800, note: 'Sample hotel stay' }
    ]
  });
});

module.exports = app;
