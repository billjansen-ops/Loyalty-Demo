/**
 * Admin API (lookups MPA) — robust upsert build v2
 * Start: node api.js
 */
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty',
  port: +(process.env.PGPORT || 5432),
  password: process.env.PGPASSWORD || undefined,
});

// Run a query inside a tenant schema (transaction per call)
async function qTenant(tenant, sql, params = []) {
  const sch = `t_${tenant}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path = ${sch}, public`);
    const res = await client.query(sql, params);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    const msg = `[qTenant error] tenant=${tenant}\nSQL:\n${sql}\nPARAMS:\n${JSON.stringify(params)}\nPG:\n${e.message}`;
    console.error(msg);
    const err = new Error(msg);
    err.status = 500;
    throw err;
  } finally {
    client.release();
  }
}

app.get('/__version', (_req,res)=> res.json({ version: 'robust-upsert-v2' }));

// -------- Carriers --------
app.get('/api/lookup/carriers', async (req,res)=>{
  try {
    const r = await qTenant((req.query.tenant||'delta').trim(),
      `SELECT code,name,alliance,country,is_active,updated_at FROM carriers ORDER BY code`);
    res.json(r.rows);
  } catch (e) { res.status(e.status||500).json({ error: e.message }); }
});

app.get('/api/lookup/carriers/:code', async (req,res)=>{
  try {
    const r = await qTenant((req.query.tenant||'delta').trim(),
      `SELECT code,name,alliance,country,is_active FROM carriers WHERE code=$1`, [req.params.code]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(e.status||500).json({ error: e.message }); }
});

// Robust UPSERT: update-or-insert via CTE (no ON CONFLICT)
app.post('/api/lookup/carriers', async (req,res)=>{
  try {
    const tenant = (req.query.tenant||'delta').trim();
    const { code, name, alliance=null, country=null, is_active=true } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name required' });

    const sql = `
      WITH up AS (
        UPDATE carriers
           SET name = $2,
               alliance = $3,
               country = $4,
               is_active = $5
         WHERE code = $1
         RETURNING code
      )
      INSERT INTO carriers (code, name, alliance, country, is_active)
      SELECT $1, $2, $3, $4, $5
      WHERE NOT EXISTS (SELECT 1 FROM up)
    `;
    await qTenant(tenant, sql, [code.trim(), name.trim(), alliance, country, !!is_active]);
    res.json({ ok: true });
  } catch (e) { res.status(e.status||500).json({ error: e.message }); }
});

app.delete('/api/lookup/carriers/:code', async (req,res)=>{
  try {
    const tenant = (req.query.tenant||'delta').trim();
    await qTenant(tenant, `DELETE FROM carriers WHERE code=$1`, [req.params.code]);
    res.json({ ok: true });
  } catch (e) { res.status(e.status||500).json({ error: e.message }); }
});

// -------- Tiers (unchanged) --------
app.get('/api/lookup/tiers', async (req,res)=>{
  try {
    const r = await qTenant((req.query.tenant||'delta').trim(),
      `SELECT tier_code,name,rank_order,is_active,updated_at FROM tier_levels ORDER BY rank_order,tier_code`);
    res.json(r.rows);
  } catch (e) { res.status(e.status||500).json({ error: e.message }); }
});

app.get('/api/lookup/tiers/:tier_code', async (req,res)=>{
  try {
    const r = await qTenant((req.query.tenant||'delta').trim(),
      `SELECT tier_code,name,rank_order,is_active FROM tier_levels WHERE tier_code=$1`, [req.params.tier_code]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(e.status||500).json({ error: e.message }); }
});

app.post('/api/lookup/tiers', async (req,res)=>{
  try {
    const tenant = (req.query.tenant||'delta').trim();
    const { tier_code, name, rank_order, is_active=true } = req.body;
    if (!tier_code || !name || rank_order===undefined) return res.status(400).json({ error: 'tier_code, name, rank_order required' });
    const sql = `
      WITH up AS (
        UPDATE tier_levels
           SET name = $2,
               rank_order = $3,
               is_active = $4
         WHERE tier_code = $1
         RETURNING tier_code
      )
      INSERT INTO tier_levels (tier_code, name, rank_order, is_active)
      SELECT $1, $2, $3, $4
      WHERE NOT EXISTS (SELECT 1 FROM up)
    `;
    await qTenant(tenant, sql, [tier_code.trim(), name.trim(), +rank_order, !!is_active]);
    res.json({ ok: true });
  } catch (e) { res.status(e.status||500).json({ error: e.message }); }
});


// -------- Airports replace (unchanged) --------
app.post('/api/lookup/airports/replace', async (req,res)=>{
  try {
    const tenant = (req.query.tenant || 'delta').trim();
    const csvText = (req.body.csvText || '').trim();
    if (!csvText) return res.status(400).json({ error: 'csvText required' });

    const tmp = path.join('/tmp', `airports_${tenant}_${Date.now()}.csv`);
    fs.writeFileSync(tmp, csvText, 'utf8');

    const cmd = [
      'psql',
      `-U`, process.env.PGUSER || 'billjansen',
      `-h`, process.env.PGHOST || 'localhost',
      `-d`, process.env.PGDATABASE || 'loyalty',
      `-v`, `TENANT=${tenant}`,
      `-v`, `FILE='${tmp.replace(/'/g,"'\\''")}'`,
      `-f`, `016_airports_replace.sql`
    ].join(' ');

    exec(cmd, { cwd: process.cwd(), env: process.env }, (err, stdout, stderr)=>{
      try { fs.unlinkSync(tmp); } catch(_){}
      if (err) return res.status(500).json({ error: 'psql failed', details: stderr || String(err) });
      res.json({ ok: true, log: stdout });
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// static pages
app.use(express.static(__dirname));

const PORT = +(process.env.PORT || 3000);
app.listen(PORT, ()=> console.log(`Admin API robust-upsert-v2 on http://127.0.0.1:${PORT}`));
