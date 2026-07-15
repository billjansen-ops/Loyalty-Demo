/**
 * Tenant molecule readiness — Layer 3 (vertical-specific) boot check.
 *
 * Closes the Session 130 audit gap: pointers.js → verifyTenantMolecules
 * has a three-layer check (platform-required, feature-conditional,
 * vertical-specific). Layers 1 and 2 are exercised every time the
 * server boots with real data. Layer 3 unions the loaded verticals'
 * requiredMolecules exports with the platform list, scoped to tenants
 * whose vertical_key matches the vertical's verticalKey. But the
 * workforce_monitoring vertical's requiredMolecules array has been
 * empty since Phase 2 shipped (Session 127), so Layer 3 has never had
 * anything to check against in production — meaning the code path
 * was plumbed but unexercised.
 *
 * This test exercises it via the TEST_VERTICAL_REQUIRED_MOLECULES env
 * var override on verticals/workforce_monitoring/server/index.js. The
 * override injects a synthetic requirement (a molecule_key no tenant
 * has) so the Layer 3 path has something to fail on. The test then
 * spawns a sidecar server and asserts:
 *
 *   1. Without the override: sidecar boots cleanly (sanity — confirms
 *      the production default is healthy).
 *   2. With the override pointing at a guaranteed-missing molecule:
 *      sidecar refuses to boot, exits 1, and the error message names
 *      the missing molecule and identifies the vertical as the source.
 *
 * If a future regression silently swallows Layer 3 failures (e.g. a
 * caller change that does `try{ verify } catch { continue }`), this
 * test fails immediately instead of waiting for a real vertical to
 * add a requirement and discovering Layer 3 was broken all along.
 */
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Spawn pointers.js with the supplied env overrides, wait for the
// process to exit OR for a deadline, and return { exitCode, output }.
// Used in two modes here: (a) successful boot — the process keeps
// running, we kill it after seeing session_ready, return exitCode=null;
// (b) failed boot — the process self-exits with non-zero, we capture.
function runSidecar(port, extraEnv, mode = 'expect-success', deadlineMs = 30000) {
  return new Promise((resolve) => {
    const child = spawn('node', ['pointers.js'], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PGHOST: process.env.PGHOST || 'localhost',
        PGPORT: process.env.PGPORT || '5432',
        PGUSER: process.env.PGUSER || 'billjansen',
        PGDATABASE: process.env.PGDATABASE || 'loyalty',
        PORT: String(port),
        // Session 142 launch contract: the sidecar must pass the same
        // handshake as any real launch, or it dies at the STARTCHECK gate
        // before reaching the readiness check this test exercises. The ML
        // boot gate is satisfied by the already-running engine on 5050.
        STARTCHECK: 'Pointers',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });

    let resolved = false;
    const finish = (exitCode) => {
      if (resolved) return;
      resolved = true;
      try { child.kill('SIGTERM'); } catch (_) { /* already dead */ }
      resolve({ exitCode, output });
    };

    child.on('exit', code => finish(code));

    if (mode === 'expect-success') {
      // Poll /version until session_ready. Then kill the sidecar
      // (we just wanted to confirm it didn't refuse to start).
      const url = `http://127.0.0.1:${port}/version`;
      const startedAt = Date.now();
      const poll = async () => {
        while (Date.now() - startedAt < deadlineMs && !resolved) {
          try {
            const r = await fetch(url);
            if (r.ok) {
              const body = await r.json();
              if (body.database === 'connected' && body.session_ready === true) {
                return finish(null); // null = ran successfully, killed
              }
            }
          } catch (_) { /* still settling */ }
          await sleep(250);
        }
        if (!resolved) finish('timeout');
      };
      poll();
    } else {
      // expect-failure — let the deadline kill it if it didn't self-exit
      setTimeout(() => finish('timeout'), deadlineMs);
    }
  });
}

module.exports = {
  name: 'Molecule readiness — vertical Layer 3 boot check',

  async run(ctx) {
    // ── 1. Sanity: production default boots cleanly ──────────────
    ctx.log('Step 1: Sidecar boots cleanly with default vertical requiredMolecules (empty array)');
    const okRun = await runSidecar(4101, {});
    ctx.assertEqual(okRun.exitCode, null,
      `Default-config sidecar boots and stays up (exit: ${okRun.exitCode})`);
    if (okRun.exitCode !== null) {
      ctx.log('Boot output (last 2KB):\n' + okRun.output.slice(-2000));
    }

    // ── 2. Layer 3 failure path: inject a missing molecule ───────
    // The override declares a vertical-level requirement for a
    // molecule_key no tenant has. The required_if_sql returns a row
    // for every tenant, so the check runs unconditionally. The
    // feature_label appears in the failure message so we can assert
    // on it.
    ctx.log('Step 2: Sidecar refuses to boot when vertical declares a missing requirement');
    const requirement = [{
      molecule_key: 'NONEXISTENT_LAYER3_TEST_MOLECULE',
      required_if_sql: 'SELECT 1 FROM tenant WHERE tenant_id = $1',
      feature_label: 'layer3 boot-check test fixture',
    }];
    const failRun = await runSidecar(4102, {
      TEST_VERTICAL_REQUIRED_MOLECULES: JSON.stringify(requirement),
    }, 'expect-failure');

    ctx.assertEqual(failRun.exitCode, 1,
      `Sidecar exits 1 when vertical requirement is missing (exit: ${failRun.exitCode})`);
    ctx.assert(
      failRun.output.includes('TENANT MOLECULE READINESS FAILED'),
      `Boot output includes the readiness-failed banner`
    );
    ctx.assert(
      failRun.output.includes('NONEXISTENT_LAYER3_TEST_MOLECULE'),
      `Boot output names the missing molecule`
    );
    ctx.assert(
      failRun.output.includes("vertical 'workforce_monitoring'"),
      `Boot output identifies the vertical as the source of the requirement`
    );
    ctx.assert(
      failRun.output.includes('layer3 boot-check test fixture'),
      `Boot output includes the feature_label from the requirement spec`
    );

    if (failRun.exitCode !== 1) {
      ctx.log('Boot output (last 2KB):\n' + failRun.output.slice(-2000));
    }
  },
};
