/**
 * Insight: the public Performance Profile page's scoring snapshot cannot
 * drift from the live config (Session 164 — the audit's parked decision (a),
 * Bill's ruling: fix it).
 *
 * performance_profile.html is a QR-reachable, NO-LOGIN demo page (Tom's
 * Dr. Stadler demo, S122). Its PPSI section weights and band cutoffs are
 * deliberately baked into the page: a no-login page cannot call the weight
 * endpoints — S163 (audit 1.4) locked those to own-tenant/superuser, and a
 * public door for live clinical config would walk that hardening back.
 *
 * So the snapshot stays — but it can no longer lie. This guard diffs the
 * page's PPSI_WEIGHTS and PPSI_TIERS against the live wi_php current weight
 * set and ppii_thresholds. If clinical config changes, the suite goes red
 * naming exactly what to update in the page.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = {
  name: 'Insight: performance_profile.html snapshot matches live scoring config (drift guard)',

  async run(ctx) {
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    const sql = (q) => execSync(
      `${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -t -A -c "${q.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }).toString().trim();

    const file = path.join(__dirname, '..', '..', 'verticals', 'workforce_monitoring', 'performance_profile.html');
    const html = fs.readFileSync(file, 'utf8');

    // ── The page's snapshot, parsed from source ──
    const wm = html.match(/var PPSI_WEIGHTS = \{([^}]+)\}/);
    ctx.assert(!!wm, 'PPSI_WEIGHTS snapshot found in performance_profile.html');
    const pageWeights = {};
    for (const m of wm[1].matchAll(/([A-Z]+)\s*:\s*([\d.]+)/g)) pageWeights[m[1]] = Number(m[2]);

    const tm = html.match(/var PPSI_TIERS = \[([\s\S]*?)\];/);
    ctx.assert(!!tm, 'PPSI_TIERS snapshot found in performance_profile.html');
    const pageTiers = [...tm[1].matchAll(/\{min:\s*(\d+),\s*max:\s*(\d+)/g)].map(m => ({ min: +m[1], max: +m[2] }));
    ctx.assertEqual(pageTiers.length, 4, 'page snapshot carries four bands');

    // ── The live config (wi_php — the program the demo mirrors) ──
    const liveWeights = {};
    for (const row of sql(
      `SELECT v.subdomain_code || '|' || v.weight FROM ppsi_subdomain_weight_set ws
       JOIN ppsi_subdomain_weight_set_value v ON v.weight_set_id = ws.weight_set_id
       JOIN tenant t ON t.tenant_id = ws.tenant_id
       WHERE t.tenant_key = 'wi_php' AND ws.is_current = true`).split('\n').filter(Boolean)) {
      const [code, w] = row.split('|');
      liveWeights[code] = Number(w);
    }
    ctx.assert(Object.keys(liveWeights).length >= 8, `live wi_php current weight set loads (${Object.keys(liveWeights).length} sections)`);

    const thresholds = {};
    for (const row of sql(
      `SELECT sd.code || '|' || sd.value FROM sysparm s
       JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
       JOIN tenant t ON t.tenant_id = s.tenant_id
       WHERE t.tenant_key = 'wi_php' AND s.sysparm_key = 'ppii_thresholds'`).split('\n').filter(Boolean)) {
      const [code, v] = row.split('|');
      thresholds[code] = Number(v);
    }
    ctx.assert(thresholds.yellow && thresholds.orange && thresholds.red, 'live ppii_thresholds load (yellow/orange/red)');

    // ── The contract: snapshot == live, value for value ──
    const drift = [];
    for (const code of new Set([...Object.keys(pageWeights), ...Object.keys(liveWeights)])) {
      if (pageWeights[code] !== liveWeights[code]) drift.push(`${code}: page ${pageWeights[code]} vs live ${liveWeights[code]}`);
    }
    ctx.assert(drift.length === 0,
      `PPSI_WEIGHTS snapshot matches the live wi_php weight set${drift.length ? ' — DRIFTED, update performance_profile.html: ' + drift.join(', ') : ''}`);

    const bandsOk =
      pageTiers[0].min === 0 && pageTiers[0].max === thresholds.yellow - 1 &&
      pageTiers[1].min === thresholds.yellow && pageTiers[1].max === thresholds.orange - 1 &&
      pageTiers[2].min === thresholds.orange && pageTiers[2].max === thresholds.red - 1 &&
      pageTiers[3].min === thresholds.red && pageTiers[3].max === 100;
    ctx.assert(bandsOk,
      `PPSI_TIERS bands match live ppii_thresholds (${thresholds.yellow}/${thresholds.orange}/${thresholds.red})` +
      (bandsOk ? '' : ` — DRIFTED, page has ${JSON.stringify(pageTiers)}; update performance_profile.html`));

    // Weights must still sum to 1.0 (the page multiplies fractions by section
    // weight and scales x100 — a broken sum silently rescales every score).
    const sum = Object.values(liveWeights).reduce((a, b) => a + b, 0);
    ctx.assert(Math.abs(sum - 1.0) < 1e-9, `live weight set sums to 1.0 (${sum})`);
  }
};
