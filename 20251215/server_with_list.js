/**
 * server_with_list.js — ready-to-run version, automatically loads api_list_activities.js
 */

import express from 'express';
import cors from 'cors';
import './api_list_activities.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/v1/health', (req, res) => {
  res.json({ ok: true, service: 'loyalty-demo', time: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Server with /v1/activities listening on http://127.0.0.1:${PORT}`));
