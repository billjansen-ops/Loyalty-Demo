/**
 * Loyalty Platform Demo API (Bill‑safe, CommonJS)
 * Restored version with API router mounted
 */

const express = require('express');
const cors = require('cors');
const app = express();

// CORS for file:// and cross-origin dev
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");if(req.method==="OPTIONS"){return res.sendStatus(200);}next();});

// Serve static files so activity.html can be loaded same-origin
app.use(express.static(__dirname));
const PORT = process.env.PORT || 4001;

// Allow some common local origins
const allow = new Set(['http://127.0.0.1:4000','http://localhost:4000','http://127.0.0.1:14000','http://localhost:14000']);
app.use((req,res,next)=>{
  const origin = req.headers.origin;
  if(origin && allow.has(origin)) res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// ---- Restore API router mount ----
try {
  const api = require('./api_meltdown');
  app.use('/v1', api);
  app.use('/api', api);
  console.log('Mounted API router.');
} catch (e) {
  console.warn('api.js not found or failed to load:', e.message);
}

// ------- Health -------
app.get(['/health', '/v1/health'], (req, res) => {
  res.json({ ok: true, service: 'loyalty-demo', time: new Date().toISOString() });
});

// ------- Minimal data fallback (for local demo only) -------
const member = { member_id: '2153442807', name: 'Bill Jansen', tenant_id: '1' };

const activities = [
  { activity_date: '2025-10-23', type: 'Flight', miles: 1508, details: { carrier: 'DL', from: 'MSP', to: 'LGA', flight: '104', class: 'F' } },
  { activity_date: '2025-09-01', type: 'Partner', miles: 1250, details: { partner: 'Marriott', ref: '7HF3D', nights: 3, city: 'NYC' } },
  { activity_date: '2025-08-17', type: 'Adjustment', miles: 500, details: { csr: 'JSantana', case: '#88421', reason: 'Policy Exception' } },
  { activity_date: '2025-07-31', type: 'Promotion', miles: 750, details: { name: 'Summer Sprint', cycle: 1, progress: '2/3' } },
];

const balances = { base_miles: 12450, tier_credits: 3200 };

// Retain standalone endpoints (for mock fallback)
app.get('/v1/member/search', (req,res)=>{
  const q=String(req.query.q||'').trim();
  if(!q || q===member.member_id) return res.json([member]);
  return res.json([]);
});
app.get('/v1/member/:id/activities',(req,res)=>{
  const id=req.params.id;
  if(id!==member.member_id) return res.status(404).json({code:'not_found'});
  const limit=parseInt(req.query.limit||'0',10);
  const out=Number.isFinite(limit)&&limit>0?activities.slice(0,limit):activities;
  res.json({member_id:id,activities:out});
});
app.get('/v1/member/:id/balances',(req,res)=>{
  const id=req.params.id;
  if(id!==member.member_id) return res.status(404).json({code:'not_found'});
  res.json({member_id:id,...balances});
});

// Fallback
app.use((req,res)=>{
  res.status(404).json({error:'Not Found',path:req.path});
});

app.listen(PORT,()=>{
  console.log(`API listening on http://127.0.0.1:${PORT}`);
});
