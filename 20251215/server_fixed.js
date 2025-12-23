/**
 * server_fixed.js — self-contained ES module
 * Starts Express on :4001 and serves:
 *   GET /v1/health
 *   GET /v1/activities   (mock data)
 */
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/v1/health', (req, res) => {
  res.json({ ok: true, service: 'loyalty-demo', time: new Date().toISOString() });
});

app.get('/v1/activities', (req, res) => {
  res.json({
    ok: true,
    source: 'server_fixed.js',
    activities: [
      { id: 1, type: 'Flight', miles: 1500, note: 'Sample flight' },
      { id: 2, type: 'Hotel', miles: 800, note: 'Sample stay' }
    ]
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`server_fixed.js listening on http://127.0.0.1:${PORT}`);
});
