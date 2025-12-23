/**
 * server_db.js — self-contained ES module
 * Serves:
 *   GET /v1/health
 *   GET /v1/activities  -> returns rows from Postgres `activity` table
 *
 * No edits required elsewhere. Run with: node server_db.js
 */
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// ---- Postgres pool (adjust only if your local creds differ) ----
const pool = new Pool({
  user: 'billjansen',
  host: 'localhost',
  database: 'loyalty',
  port: 5432,
});

app.get('/v1/health', (req, res) => {
  res.json({ ok: true, service: 'loyalty-demo-db', time: new Date().toISOString() });
});

// Returns latest activity rows as JSON (schema-agnostic)
app.get('/v1/activities', async (req, res) => {
  const limit = Math.max(1, Math.min(parseInt(req.query.limit || '20', 10) || 20, 200));
  try {
    // Try to order by created_at if present; otherwise fall back to unordered
    const client = await pool.connect();
    try {
      // Detect if created_at exists
      const hasCreated = await client.query(
        """select exists (
             select 1 from information_schema.columns
             where table_name='activity' and column_name='created_at'
           ) as present"""
      );
      const orderByCreatedAt = hasCreated.rows[0]?.present === true;
      const sql = orderByCreatedAt
        ? 'select to_jsonb(a) as row from activity a order by a.created_at desc limit $1'
        : 'select to_jsonb(a) as row from activity a limit $1';
      const result = await client.query(sql, [limit]);
      const activities = result.rows.map(r => r.row);
      res.json({ ok: true, count: activities.length, activities });
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`server_db.js listening on http://127.0.0.1:${PORT}`);
});
