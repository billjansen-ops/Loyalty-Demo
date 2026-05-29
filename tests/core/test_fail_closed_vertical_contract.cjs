/**
 * Fail-closed vertical contract — sidecar harness test.
 *
 * Closes the gap Bill caught in Session 130: the design doc's Phase 2
 * acceptance criterion ("Disabling workforce_monitoring → wi_php login
 * returns the 503 from Decision 2") and Phase 6's matching item
 * ("Delta smoke tests pass with VERTICALS_ENABLED=") were never actually
 * verified end-to-end across six sessions. The middleware-no-op bug hid
 * for four sessions because nothing exercised the scenario the design
 * promised would work.
 *
 * What this test does:
 *   1. Spawns a SECOND pointers.js server on port SIDECAR_PORT with
 *      VERTICALS_ENABLED= (empty) — no verticals loaded at all.
 *   2. Logs in as Claude (wi_php superuser, vertical_key='workforce_monitoring').
 *      Login itself is on the public-routes allow list so it succeeds.
 *   3. Hits an Insight endpoint with the wi_php session cookie. Asserts
 *      the response is 503 with code='VERTICAL_NOT_LOADED' — the exact
 *      shape Design Decision 2 promised. If the middleware regresses
 *      back into a no-op (the Session-127-through-130 bug), the response
 *      will be 200 or 404 instead and this assertion fails.
 *   4. Logs in as DeltaCSR (vertical_key='airline'). Asserts a Delta
 *      endpoint works normally — Delta's vertical_key is for directory
 *      routing only, not a server module, so the fail-closed check
 *      should pass through cleanly.
 *
 * Why a sidecar instead of the main test server: the main server runs
 * with the default VERTICALS_ENABLED=workforce_monitoring so the
 * fail-closed path can't be exercised against it without restarting.
 * Spawning a sidecar lets us verify both the loaded-correctly state
 * (main server, all other tests) and the not-loaded state (this test)
 * in the same suite run.
 */
const { spawn } = require('child_process');
const path = require('path');

const SIDECAR_PORT = 4099;
const SIDECAR_URL = `http://127.0.0.1:${SIDECAR_PORT}`;
const PROJECT_ROOT = path.join(__dirname, '..', '..');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(url, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch (_) { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

module.exports = {
  name: 'Fail-closed vertical contract (sidecar VERTICALS_ENABLED=)',

  async run(ctx) {
    ctx.log(`Spawning sidecar pointers.js on port ${SIDECAR_PORT} with VERTICALS_ENABLED= (empty)`);

    // The test runner inherits the user's shell env, which on a fresh
    // terminal may not have PG* vars set (the main server's DB
    // connection was bootstrapped by bash bootstrap/start.sh which
    // exports them inline). Mirror what start.sh does — the sidecar
    // needs to connect to the same DB as the main test server.
    const sidecar = spawn('node', ['pointers.js'], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PGHOST: process.env.PGHOST || 'localhost',
        PGPORT: process.env.PGPORT || '5432',
        PGUSER: process.env.PGUSER || 'billjansen',
        PGDATABASE: process.env.PGDATABASE || 'loyalty',
        PORT: String(SIDECAR_PORT),
        VERTICALS_ENABLED: '', // explicit empty — no verticals loaded
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let bootLog = '';
    sidecar.stdout.on('data', d => { bootLog += d.toString(); });
    sidecar.stderr.on('data', d => { bootLog += d.toString(); });

    const killSidecar = () => {
      try { sidecar.kill('SIGTERM'); } catch (_) { /* already dead */ }
    };
    // Defensive cleanup: even if the test crashes mid-flight, don't leak
    // the child process. The test runner doesn't share its process tree
    // with the sidecar otherwise.
    const exitHandler = () => killSidecar();
    process.once('exit', exitHandler);
    process.once('SIGINT', exitHandler);

    try {
      // ── 1. Wait for boot ──────────────────────────────────────────
      const booted = await waitForServer(`${SIDECAR_URL}/version`, 30000);
      ctx.assert(booted, `Sidecar booted within 30s on port ${SIDECAR_PORT}`);
      if (!booted) {
        ctx.log('Sidecar boot log (last 2KB):\n' + bootLog.slice(-2000));
        return;
      }

      // ── 2. wi_php session — log in succeeds (login is public) ─────
      ctx.log('Step 2: wi_php login should succeed (login is on public-routes allow list)');
      const wiphpLogin = await fetch(`${SIDECAR_URL}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Claude', password: 'claude123' }),
      });
      ctx.assertEqual(wiphpLogin.status, 200, 'wi_php login returns 200');
      const wiphpCookie = wiphpLogin.headers.get('set-cookie');
      ctx.assert(!!wiphpCookie, 'wi_php login returns Set-Cookie header');
      const wiphpLoginBody = await wiphpLogin.json();
      ctx.assertEqual(wiphpLoginBody.vertical_key, 'workforce_monitoring',
        'Login response carries vertical_key=workforce_monitoring');

      // ── 3. wi_php session hits Insight endpoint → 503 VERTICAL_NOT_LOADED ──
      ctx.log('Step 3: wi_php session hits Insight endpoint → expect 503 VERTICAL_NOT_LOADED');
      const wiphpHit = await fetch(`${SIDECAR_URL}/v1/wellness/members?tenant_id=5`, {
        headers: { Cookie: wiphpCookie.split(';')[0] },
      });
      ctx.assertEqual(wiphpHit.status, 503,
        `wi_php session on Insight endpoint returns 503 when vertical unloaded (got ${wiphpHit.status})`);
      const wiphpBody = await wiphpHit.json();
      ctx.assertEqual(wiphpBody.code, 'VERTICAL_NOT_LOADED',
        `Response code is VERTICAL_NOT_LOADED (got ${wiphpBody.code})`);
      ctx.assert(
        typeof wiphpBody.error === 'string' && wiphpBody.error.includes('workforce_monitoring'),
        `Error message names the missing vertical (got: ${wiphpBody.error})`
      );

      // ── 4. Delta session — log in succeeds ────────────────────────
      ctx.log('Step 4: Delta login should succeed');
      const deltaLogin = await fetch(`${SIDECAR_URL}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'DeltaCSR', password: 'DeltaCSR' }),
      });
      ctx.assertEqual(deltaLogin.status, 200, 'Delta login returns 200');
      const deltaCookie = deltaLogin.headers.get('set-cookie');
      ctx.assert(!!deltaCookie, 'Delta login returns Set-Cookie header');
      const deltaLoginBody = await deltaLogin.json();
      ctx.assertEqual(deltaLoginBody.vertical_key, 'airline',
        'Delta login response carries vertical_key=airline');

      // ── 5. Delta session hits a Delta endpoint → 200 ─────────────
      // Delta's vertical_key='airline' is for directory routing only —
      // no verticals/airline/server/index.js exists, so the middleware's
      // knownServerVerticals check passes through cleanly. This is the
      // Phase 6 fix that distinguishes "directory-routing vertical_key"
      // from "vertical_key with a server module".
      ctx.log('Step 5: Delta session hits Delta endpoint → expect 200 (vertical_key=airline has no server module)');
      const deltaHit = await fetch(`${SIDECAR_URL}/v1/brands?tenant_id=1`, {
        headers: { Cookie: deltaCookie.split(';')[0] },
      });
      ctx.assertEqual(deltaHit.status, 200,
        `Delta session passes through fail-closed when no verticals loaded (got ${deltaHit.status})`);
      const deltaBody = await deltaHit.json();
      ctx.assert(Array.isArray(deltaBody) || Array.isArray(deltaBody.brands),
        'Delta /v1/brands returns an array (no VERTICAL_NOT_LOADED block)');

      // ── 6. Sanity — Delta session attempting an Insight endpoint ─
      // The session's vertical_key is 'airline' which is not in
      // knownServerVerticals, so the middleware passes through. The
      // wellness endpoint doesn't exist on this server because the
      // vertical isn't loaded, so we'd expect 404. (Not 503 — the
      // session vertical_key isn't the missing one; the route just
      // isn't registered.) This catches a regression where the
      // middleware would 503 Delta sessions on any endpoint that
      // happens to be vertical-only.
      ctx.log('Step 6: Delta session hits Insight endpoint → expect 404 (route not registered), NOT 503');
      const deltaOnInsight = await fetch(`${SIDECAR_URL}/v1/wellness/members?tenant_id=1`, {
        headers: { Cookie: deltaCookie.split(';')[0] },
      });
      ctx.assertEqual(deltaOnInsight.status, 404,
        `Delta session on missing Insight endpoint returns 404, not 503 (got ${deltaOnInsight.status})`);

    } finally {
      ctx.log('Cleaning up sidecar');
      killSidecar();
      process.removeListener('exit', exitHandler);
      process.removeListener('SIGINT', exitHandler);
      // Give the OS a moment to release the port for the next test run.
      await sleep(500);
    }
  },
};
