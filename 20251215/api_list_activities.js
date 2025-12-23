import express from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  user: 'billjansen',
  host: 'localhost',
  database: 'loyalty',
  port: 5432
});

router.get('/v1/activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const result = await pool.query(
      'SELECT activity_id, member_id, point_type, points, description, created_at FROM activity ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    res.json({ ok: true, activities: result.rows });
  } catch (err) {
    console.error('Error in /v1/activities:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;