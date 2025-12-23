/**
 * server_db_static.js — ES module
 * - Serves static files from project root (so /activity.html works)
 * - Provides /v1/health and /v1/activities from Postgres
 */
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();

// Serve static files (HTML/CSS/JS) from current directory
app.use(express.static('.'));

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'billjansen',
  host: 'localhost',
  database: 'loyalty',
  port: 5432,
});

app.get('/v1/health', (req, res) => {
  res.json({ ok: true, service: 'loyalty-demo-db', time: new Date().toISOString() });
});

app.get('/v1/activities', async (req, res) => {
  const limit = Math.max(1, Math.min(parseInt(req.query.limit || '20', 10) || 20, 200));
  try {
    let sql = 'select to_jsonb(a) as row from activity a order by a.created_at desc limit $1';
    let result;
    try {
      result = await pool.query(sql, [limit]);
    } catch (e) {
      sql = 'select to_jsonb(a) as row from activity a limit $1';
      result = await pool.query(sql, [limit]);
    }
    const activities = result.rows.map(r => r.row);
    res.json({ ok: true, count: activities.length, activities });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`server_db_static.js serving static files and API on http://127.0.0.1:${PORT}`);
});
