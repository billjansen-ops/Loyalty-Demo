#!/usr/bin/env node
/**
 * Pointer Platform — Test Harness Runner
 *
 * Usage:
 *   node tests/run.cjs                         — run all tests in manifest
 *   node tests/run.cjs insight/test_login_search — run one test
 *
 * Process:
 *   1. Verify server is running
 *   2. Snapshot database (pg_dump)
 *   3. Ensure Claude test user exists
 *   4. Login as Claude, get session cookie
 *   5. Run tests
 *   6. Restore database (pg_restore)
 *   7. Print report
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── Browser (Playwright) ──────────────────────────────────────
let playwright = null;
let browser = null;
let browserContext = null;
try {
  playwright = require('playwright');
} catch (e) {
  // Playwright not installed — browser tests will be skipped
}

// ── Configuration ──────────────────────────────────────────────
const API_BASE = process.env.TEST_API_BASE || 'http://127.0.0.1:4001';
// Mac homebrew installs PG client tools under /opt/homebrew/bin; Linux
// (e.g. GitHub Actions runners) puts them at /usr/bin or on $PATH. Default
// to the homebrew path so Bill's laptop continues to "just work," but let
// CI override via env vars.
const PG_DUMP = process.env.PG_DUMP || '/opt/homebrew/bin/pg_dump';
const PG_RESTORE = process.env.PG_RESTORE || '/opt/homebrew/bin/pg_restore';
const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const NODE_BIN = process.env.NODE_BIN || '/opt/homebrew/bin/node';
const DB_HOST = process.env.DATABASE_HOST || '127.0.0.1';
const DB_USER = process.env.DATABASE_USER || 'billjansen';
const DB_PASSWORD = process.env.DATABASE_PASSWORD || process.env.PGPASSWORD || '';
const DB_NAME = process.env.DATABASE_NAME || 'loyalty';
// Individual tests reach the DB via `process.env.PGDATABASE || 'loyalty'`.
// If the runner targets a non-default DB (dress rehearsals) but PGDATABASE
// isn't set, every test's psql would silently hit the REAL loyalty DB while
// the snapshot/restore protects only DB_NAME — planted rows would survive
// in a database this run never restores (it happened, Session 140). Force
// the two names to agree for everything this process spawns.
process.env.PGDATABASE = DB_NAME;
// One clock (S167): every psql this suite spawns runs its session on the
// MACHINE's timezone, so date_to_molecule_int(CURRENT_DATE) in test SQL
// answers the same "today" the platform's JS date helpers compute.
// Without this, a Postgres server configured in another zone answers a
// different day for part of every day (found in Bangalore: IST machine,
// Central Postgres — every IST morning until 10:30 four tests went red).
// node-pg based tests carry the same pin in their own DB_CONFIG options.
process.env.PGTZ = process.env.PGTZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
const SNAPSHOT_DIR = path.join(__dirname, '..', '.claude', 'test-snapshots');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'pre-test.dump');
const TEST_USER = 'Claude';
const TEST_PASS = 'claude123';

// ── Lanes (parallel execution) ─────────────────────────────────
// The suite used to run 106 tests one at a time against Bill's ONE working
// database — ten minutes on a good day, and every run rewrote the database
// he was working in. Lanes fix both: each lane gets its OWN copy of the
// database and its OWN server, so N tests run at once AND the working
// database is never written to by a test at all (the snapshot that seeds
// the lanes is a read).
//
// The floor is the slowest single test — no number of lanes beats it — so
// the split is longest-first from recorded timings (tests/timings.json,
// rewritten every full run). A test with no recorded time is assumed
// average, which self-corrects after one run.
const LANE_WORKER = process.env.LANE_WORKER || null;   // set only inside workers
const LANE_ID = Number(process.env.LANE_ID || 0);
const LANE_DB_PREFIX = process.env.LANE_DB_PREFIX || 'loyalty_lane';
const LANE_BASE_PORT = Number(process.env.LANE_BASE_PORT || 4101);
const TIMINGS_FILE = path.join(__dirname, 'timings.json');
const REPO_ROOT = path.join(__dirname, '..');

// ── Helpers ────────────────────────────────────────────────────
let sessionCookie = null;

async function apiFetch(urlPath, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (sessionCookie) headers['Cookie'] = sessionCookie;

  const resp = await fetch(`${API_BASE}${urlPath}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  // Capture session cookie
  const setCookie = resp.headers.get('set-cookie');
  if (setCookie) {
    const next = setCookie.split(';')[0];
    if (process.env.DEBUG_COOKIE && next !== sessionCookie) {
      console.log(`  🍪 cookie changed on ${options.method || 'GET'} ${urlPath} (${resp.status})`);
    }
    sessionCookie = next;
  }

  const data = await resp.json().catch(() => ({}));
  data._status = resp.status;
  data._ok = resp.ok;
  return data;
}

function log(msg) { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${'─'.repeat(60)}\n  ${msg}\n${'─'.repeat(60)}`); }

// ── Interrupted runs must not leave test residue (Session 142) ──
// The Delta junk-promotions leak was exactly this: SIGINT/SIGTERM had no
// handler, so a killed run (Ctrl+C, kill, reboot) skipped the restore and
// every mutation the tests had made stayed in the database. Proven live
// before this fix: a run killed 75s in left 13 activities + 9 surveys
// behind. Now: if the snapshot exists and the final restore hasn't run,
// restore before dying (execSync — safe in a handler), then best-effort
// cache refresh so the running server isn't left remembering pre-restore
// data (the Session 138 ghost-cache lesson).
let snapshotTaken = false;
let finalRestoreDone = false;
// In lane mode the tests never touch the working database, so restoring it
// on an interrupt would be worse than doing nothing: it would roll back
// whatever Bill did WHILE the suite ran — which is exactly the freedom
// lanes were built to give him. An interrupted lane run tears down its
// lanes and leaves his database alone.
let laneMode = false;
async function handleInterrupt(sig) {
  console.log(`\n\n🛑 ${sig} — run interrupted.`);
  if (laneMode) {
    console.log('  Tearing down lane databases and servers (your working database was never written to)...');
    try { teardownLanes(); } catch (_) {}
  } else if (snapshotTaken && !finalRestoreDone) {
    console.log('  Restoring database before exit (test residue must not survive an interrupted run)...');
    restoreDatabase();
    try { await refreshServerCaches(); } catch (_) {}
  }
  if (browser) { try { await browser.close(); } catch (_) {} }
  process.exit(130);
}
process.on('SIGINT', () => handleInterrupt('SIGINT'));
process.on('SIGTERM', () => handleInterrupt('SIGTERM'));

// ── Database Snapshot/Restore ──────────────────────────────────
// HARDENED after the 2026-08-05 local-database loss (BI session). The old
// code had three quiet assumptions that finally aligned against us:
//   1. restore trusted pg_restore ("often returns non-zero even on success")
//      and returned TRUE on every failure — a restore that died after the
//      drops and before the rebuild reported "restored (with warnings)";
//   2. snapshot OVERWROTE the single dump file before looking at the
//      database — so the run after a broken restore replaced the only good
//      snapshot with a photograph of the wreckage;
//   3. nothing ever asked the database "are you actually healthy?".
// Now: health is PROBED (core tables present, table count sane) before any
// snapshot and after every restore; snapshots refuse to photograph a sick
// database; the dump is verified and ROTATED (two generations kept); a
// failed restore retries once after clearing other connections and then
// fails THE WHOLE RUN loudly, naming the intact snapshot files.

const SNAPSHOT_PREV = path.join(SNAPSHOT_DIR, 'pre-test.prev.dump');
const SNAPSHOT_PREV2 = path.join(SNAPSHOT_DIR, 'pre-test.prev2.dump');
const HEALTH_MIN_TABLES = 80;   // the platform has ~104; half-demolished runs show ~39

function dbHealth() {
  try {
    const out = execSync(
      `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -tAc "SELECT (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public') || ':' || (SELECT COUNT(*) FROM platform_user) || ':' || (SELECT COUNT(*) FROM member)"`,
      { stdio: 'pipe', timeout: 20000 }).toString().trim();
    const [tables, users, members] = out.split(':').map(Number);
    const ok = tables >= HEALTH_MIN_TABLES && users > 0 && members > 0;
    return { ok, tables, users, members };
  } catch (e) {
    return { ok: false, tables: 0, users: 0, members: 0, error: e.message.substring(0, 160) };
  }
}

function terminateOtherConnections() {
  // Server pools and stray tools hold connections that can make --clean's
  // drops fail mid-restore. Clear them; the harness refreshes server caches
  // (and the pool reconnects lazily) after every restore anyway.
  try {
    execSync(
      `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d postgres -tAc "SELECT COUNT(pg_terminate_backend(pid)) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid()"`,
      { stdio: 'pipe', timeout: 20000 });
  } catch (_) { /* best effort */ }
}

function snapshotDatabase() {
  log('📸 Creating database snapshot...');
  // Never photograph a sick database — that is how the only good snapshot
  // got overwritten with wreckage.
  const health = dbHealth();
  if (!health.ok) {
    log(`❌ REFUSING TO SNAPSHOT: the database looks damaged (${health.tables} tables, ${health.users} users, ${health.members} members${health.error ? ' — ' + health.error : ''}).`);
    log(`   Previous snapshots preserved: ${SNAPSHOT_FILE} / ${SNAPSHOT_PREV} / ${SNAPSHOT_PREV2}`);
    log(`   Recover first (restore a snapshot, or rebuild: baseline + node db_migrate.js).`);
    return false;
  }
  try {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const tmp = SNAPSHOT_FILE + '.new';
    execSync(`${PG_DUMP} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -Fc -f "${tmp}"`, {
      stdio: 'pipe',
      timeout: 60000
    });
    // Verify the dump is a real, full archive before it replaces anything:
    // pg_restore -l lists its objects without touching the database.
    const listing = execSync(`${PG_RESTORE} -l "${tmp}"`, { stdio: 'pipe', timeout: 30000 }).toString();
    const objects = listing.split('\n').filter(l => /^\d+;/.test(l)).length;
    if (objects < HEALTH_MIN_TABLES) {
      fs.rmSync(tmp, { force: true });
      log(`❌ Snapshot verification failed — dump lists only ${objects} objects. Old snapshots untouched.`);
      return false;
    }
    // Rotate: current → prev → prev2 (two generations of lifeboat)
    if (fs.existsSync(SNAPSHOT_PREV)) fs.renameSync(SNAPSHOT_PREV, SNAPSHOT_PREV2);
    if (fs.existsSync(SNAPSHOT_FILE)) fs.renameSync(SNAPSHOT_FILE, SNAPSHOT_PREV);
    fs.renameSync(tmp, SNAPSHOT_FILE);
    const size = fs.statSync(SNAPSHOT_FILE).size;
    log(`✅ Snapshot created and verified (${(size / 1024 / 1024).toFixed(1)} MB, ${objects} objects; two prior generations kept)`);
    return true;
  } catch (e) {
    log(`❌ Snapshot failed: ${e.message}`);
    return false;
  }
}

function restoreDatabase() {
  log('🔄 Restoring database from snapshot...');
  const attempt = () => {
    try {
      execSync(
        `${PG_RESTORE} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} --clean --if-exists -Fc "${SNAPSHOT_FILE}"`,
        { stdio: 'pipe', timeout: 120000 }
      );
      return null;
    } catch (e) {
      return e; // may still be benign drop-warnings — health decides, not the exit code
    }
  };

  let err = attempt();
  let health = dbHealth();
  if (!health.ok) {
    log(`⚠️  Restore left the database unhealthy (${health.tables} tables) — clearing connections and retrying once...`);
    terminateOtherConnections();
    err = attempt();
    health = dbHealth();
  }

  if (health.ok) {
    log(err ? '✅ Database restored (pg_restore warnings, health verified)' : '✅ Database restored (health verified)');
    return true;
  }

  // The one outcome that must never be quiet again.
  log('');
  log('❌❌ RESTORE FAILED AND THE DATABASE IS DAMAGED ❌❌');
  log(`   Health: ${health.tables} tables, ${health.users} users, ${health.members} members (need ≥${HEALTH_MIN_TABLES} tables and both counts > 0)`);
  if (err) log(`   pg_restore said: ${String(err.message).substring(0, 300)}`);
  log(`   INTACT snapshots (do NOT run tests again until restored):`);
  log(`     ${SNAPSHOT_FILE}`);
  if (fs.existsSync(SNAPSHOT_PREV)) log(`     ${SNAPSHOT_PREV}`);
  if (fs.existsSync(SNAPSHOT_PREV2)) log(`     ${SNAPSHOT_PREV2}`);
  log(`   Recover: pg_restore --clean --if-exists -d ${DB_NAME} <snapshot>  (or rebuild: baseline + node db_migrate.js)`);
  return false;
}

// The restore puts the DATABASE back — but the running server still remembers
// everything the tests created (promotions, bonuses, molecules). Left stale,
// the very next real accrual can match a ghost promotion and die on its
// foreign key (Session 138: Bill's first post-suite flight did exactly that).
// So after every restore, log back in fresh (the restore invalidated our old
// session) and tell the server to reload its caches from the restored data.
async function refreshServerCaches() {
  log('🧠 Refreshing server caches (server memory must match the restored database)...');
  try {
    sessionCookie = null;
    const login = await apiFetch('/v1/auth/login', {
      method: 'POST', body: { username: TEST_USER, password: TEST_PASS }
    });
    if (!login._ok) {
      // CI's snapshot predates the test user, so this login can fail there —
      // harmless (nobody uses that server afterwards). On a dev machine it
      // means the server is still running on stale memory: say so, loudly.
      log(`⚠️  Cache-refresh login failed (${login._status}) — if you keep using this server, RESTART it first`);
      return false;
    }
    const r = await apiFetch('/v1/admin/cache/refresh', { method: 'POST' });
    if (r.ok) {
      log('✅ Server caches refreshed — server memory matches the database again');
      return true;
    }
    log(`⚠️  Cache refresh failed (${r._status}) — if you keep using this server, RESTART it first`);
    return false;
  } catch (e) {
    log(`⚠️  Cache refresh failed: ${e.message} — if you keep using this server, RESTART it first`);
    return false;
  }
}

// ── Test User Setup ────────────────────────────────────────────
async function ensureTestUser() {
  log('👤 Checking Claude test user...');

  // Try to login — if it works, user exists
  const loginResult = await apiFetch('/v1/auth/login', {
    method: 'POST',
    body: { username: TEST_USER, password: TEST_PASS }
  });

  if (loginResult._ok) {
    log(`✅ Claude test user exists (${loginResult.role})`);
    return true;
  }

  // User doesn't exist or wrong password — create via psql
  log('  Creating Claude test user...');
  try {
    const bcryptHash = execSync(
      `cd "${path.join(__dirname, '..')}" && ${NODE_BIN} -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('${TEST_PASS}', 10));"`,
      { encoding: 'utf8', stdio: 'pipe' }
    ).trim().split('\n').pop(); // Last line is the hash (skip deprecation warnings)

    execSync(
      `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -c "INSERT INTO platform_user (username, password_hash, display_name, tenant_id, role, link) SELECT '${TEST_USER}', '${bcryptHash}', 'Claude (System)', 5, 'superuser', COALESCE((SELECT MAX(link)+1 FROM platform_user), 100) WHERE NOT EXISTS (SELECT 1 FROM platform_user WHERE username = '${TEST_USER}'); UPDATE link_tank SET next_link = GREATEST(next_link, (SELECT COALESCE(MAX(link)::bigint, next_link - 1) + 1 FROM platform_user)) WHERE table_key = 'platform_user';"`,
      { stdio: 'pipe' }
    );

    // Try login again
    const retryLogin = await apiFetch('/v1/auth/login', {
      method: 'POST',
      body: { username: TEST_USER, password: TEST_PASS }
    });

    if (retryLogin._ok) {
      log('✅ Claude test user created and verified');
      return true;
    }

    log('❌ Could not create or login as Claude test user');
    return false;
  } catch (e) {
    log(`❌ Test user setup failed: ${e.message}`);
    return false;
  }
}

// Open the login form. Deliberately NOT 'networkidle' — that waits for a
// half-second of total network silence, which is both slow (measured 586ms
// vs 81ms for the same page) and FRAGILE: under load the quiet window can
// simply never arrive, and the navigation fails on a page that is perfectly
// fine. It was the single cause of every browser-test timeout when the
// suite gained parallel lanes. What the harness actually needs is the form,
// so wait for the form.
async function gotoLoginForm(page) {
  await page.goto(`${API_BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#username', { timeout: 15000 });
}

// ── Post-login landing ─────────────────────────────────────────
// Where a login lands depends on the ACCOUNT SHAPE, and the harness user is a
// superuser: a superuser lands on menu.html (the platform menu is
// where the tenant switcher lives — it is a superuser's home by design, and
// guarding it against them is what took the switcher away). Program-bound
// accounts still land on their vertical dashboard. This helper only waits for
// "logged in and off the form" — it deliberately does NOT assert WHICH landing,
// because that contract is proven by the tests that exist for it
// (test_login_no_home_program, test_tenant_chooser, test_auth). Pinning one
// landing here is what put 45 tests on a 10-second timeout apiece.
async function waitForLanding(page) {
  await page.waitForURL(/\/(menu|dashboard)\.html(\?|#|$)/, { timeout: 10000 });
}

// Hold the machine awake for the duration of the run. Twice on 2026-08-05
// a full run was destroyed by the laptop sleeping mid-suite: the network
// stack suspends, every in-flight page load dies, and tests report
// twenty-minute "durations" and ERR_INTERNET_DISCONNECTED failures that
// have nothing to do with the code. The results looked like real failures
// and cost an afternoon of chasing them. caffeinate is killed with us
// (-w our pid), so it can never outlive the run and leave the machine
// awake. Idle sleep only — closing the lid still sleeps, and nothing in
// software changes that.
function keepAwake() {
  if (process.platform !== 'darwin') return null;
  try {
    const { spawn } = require('child_process');
    const proc = spawn('caffeinate', ['-dimsu', '-w', String(process.pid)], {
      stdio: 'ignore',
      detached: true
    });
    proc.unref();
    return proc;
  } catch (e) {
    return null;   // never fail a run because caffeinate is missing
  }
}

// ── Lane plumbing ──────────────────────────────────────────────
const laneServers = [];   // { id, db, port, proc }
let lanesCreated = [];    // db names to drop on teardown

function laneDbName(id) { return `${LANE_DB_PREFIX}_${id}`; }
function lanePort(id) { return LANE_BASE_PORT + id; }

function psqlAdmin(sql, timeout = 120000) {
  // Administrative statements (CREATE/DROP DATABASE) cannot run inside the
  // database being acted on — connect to 'postgres' instead.
  return execSync(
    `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d postgres -v ON_ERROR_STOP=1 -c "${sql.replace(/"/g, '\\"')}"`,
    { stdio: 'pipe', timeout }
  ).toString();
}

// Build one lane database from the snapshot the orchestrator just took.
// Serialised DROP/CREATE (Postgres takes a lock on the catalog), parallel
// restore — the restore is the slow part and it is per-database.
function createLaneDatabase(id) {
  const db = laneDbName(id);
  psqlAdmin(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();`, 30000);
  psqlAdmin(`DROP DATABASE IF EXISTS ${db};`);
  psqlAdmin(`CREATE DATABASE ${db} OWNER ${DB_USER};`);
  lanesCreated.push(db);
  return db;
}

function restoreIntoLane(db) {
  try {
    execSync(
      `${PG_RESTORE} -h ${DB_HOST} -U ${DB_USER} -d ${db} --no-owner -Fc "${SNAPSHOT_FILE}"`,
      { stdio: 'pipe', timeout: 300000 }
    );
  } catch (e) {
    // pg_restore exits non-zero on benign notices; health is what decides.
  }
  // ANALYZE, or every query in this lane is planned BLIND. pg_restore
  // loads rows but no statistics, and the planner without statistics
  // guesses — sequential scans where the working database uses an index.
  // Measured: without this, individual tests ran 2–5× SLOWER in a lane
  // than they did against the working database, and two lanes finished
  // the suite slower than no lanes at all. Cheap (a few seconds) and
  // correct for any freshly restored database.
  execSync(`${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${db} -c "ANALYZE"`, { stdio: 'pipe', timeout: 300000 });

  const count = execSync(
    `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${db} -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"`,
    { stdio: 'pipe', timeout: 30000 }
  ).toString().trim();
  if (Number(count) < HEALTH_MIN_TABLES) {
    throw new Error(`lane database ${db} came up with only ${count} tables (need ≥${HEALTH_MIN_TABLES})`);
  }
  return Number(count);
}

// Start one lane's server. Same handshake start.sh uses; its own port and
// its own database. The ML service on 5050 is shared deliberately — it is a
// stateless predictor, so lanes may all talk to the one instance.
function startLaneServer(id, db) {
  const { spawn } = require('child_process');
  const port = lanePort(id);
  const proc = spawn(NODE_BIN, ['pointers.js'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PGHOST: DB_HOST,
      PGUSER: DB_USER,
      PGDATABASE: db,
      DATABASE_NAME: db,
      PORT: String(port),
      STARTCHECK: 'Pointers',
      RATE_LIMIT_DISABLED: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const logPath = path.join(SNAPSHOT_DIR, `lane${id}-server.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });
  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);
  const server = { id, db, port, proc, logPath };
  laneServers.push(server);
  return server;
}

async function waitForLaneServer(server, deadlineMs = 120000) {
  const started = Date.now();  // elapsed-time measurement, not a date
  let lastState = 'no response';
  while (Date.now() - started < deadlineMs) {
    if (server.proc.exitCode !== null) {
      throw new Error(`lane ${server.id} server exited (code ${server.proc.exitCode}) — see ${server.logPath}`);
    }
    try {
      // /version (NOT /v1/version) is the endpoint carrying session_ready —
      // the "logins will actually work" signal the harness has always used.
      const r = await fetch(`http://127.0.0.1:${server.port}/version`);
      if (r.ok) {
        const v = await r.json();
        if (v.session_ready) return v;
        lastState = `up (v${v.version}) but session_ready=false`;
      }
    } catch (e) { lastState = 'no response'; }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`lane ${server.id} server never became ready (${lastState}) — see ${server.logPath}`);
}

function teardownLanes() {
  for (const s of laneServers) {
    try { s.proc.kill('SIGTERM'); } catch (e) { /* already gone */ }
  }
  // Give them a moment to release their connections, then drop.
  try { execSync('sleep 1'); } catch (e) { /* ignore */ }
  for (const db of lanesCreated) {
    try {
      psqlAdmin(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();`, 30000);
      psqlAdmin(`DROP DATABASE IF EXISTS ${db};`, 60000);
    } catch (e) {
      log(`⚠️  Could not drop lane database ${db}: ${String(e.message).substring(0, 120)}`);
    }
  }
  laneServers.length = 0;
  lanesCreated = [];
}

// Longest-first bin packing. The slowest test sets the floor, so it must
// start first; everything else fills in behind it.
function assignTestsToLanes(tests, laneCount) {
  let timings = {};
  try { timings = JSON.parse(fs.readFileSync(TIMINGS_FILE, 'utf8')); } catch (e) { /* first run */ }
  const known = Object.values(timings).filter(n => typeof n === 'number' && n > 0);
  const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 5000;

  // A test that BORROWS another test's fixtures must land in the same lane
  // — separate lanes have separate databases, so the thing it is borrowing
  // simply would not exist. Declared in the manifest as "lane_group", which
  // makes the coupling a recorded fact instead of a lucky ordering. (The
  // selection-engine test has no members of its own: it uses the sandbox
  // members the monitoring-core test creates immediately before it. There
  // are ZERO paradigm-free sandbox members in a clean database.)
  // Ungrouped tests are their own group of one.
  const groups = new Map();
  for (const t of tests) {
    const key = t.lane_group || `__solo__${t.path}`;
    if (!groups.has(key)) groups.set(key, { entries: [], ms: 0 });
    const g = groups.get(key);
    g.entries.push(t);
    g.ms += timings[t.path] || fallback;
  }
  const weighted = [...groups.values()].sort((a, b) => b.ms - a.ms);

  const lanes = Array.from({ length: laneCount }, () => ({ tests: [], ms: 0 }));
  for (const w of weighted) {
    const lightest = lanes.reduce((min, l) => (l.ms < min.ms ? l : min), lanes[0]);
    lightest.tests.push(...w.entries);
    lightest.ms += w.ms;
  }

  // Longest-first decides WHICH lane; the manifest decides the ORDER INSIDE
  // one. Some tests only pass because a test that disturbs their fixtures
  // runs after them, and the manifest order is what has always guaranteed
  // that. Packing alone reordered them and three tests went red for a
  // reason that had nothing to do with the code (composite counts, cascade
  // balances, the horizon census). Restoring manifest order within a lane
  // gives every pair of tests in the SAME lane their original relative
  // order; a pair split ACROSS lanes cannot interfere at all, because
  // lanes have separate databases.
  const order = new Map(tests.map((t, i) => [t.path, i]));
  for (const lane of lanes) lane.tests.sort((a, b) => order.get(a.path) - order.get(b.path));
  return lanes;
}

function saveTimings(allResults) {
  let timings = {};
  try { timings = JSON.parse(fs.readFileSync(TIMINGS_FILE, 'utf8')); } catch (e) { /* first run */ }
  for (const r of allResults) {
    // Only record clean runs — a test that crashed on a stalled page load
    // (laptop asleep, network dropped) would otherwise poison the balance
    // with a twenty-minute "duration" forever.
    if (typeof r.ms === 'number' && r.failed === 0) timings[r.test] = r.ms;
  }
  try { fs.writeFileSync(TIMINGS_FILE, JSON.stringify(timings, null, 2) + '\n'); } catch (e) { /* never fail the run over timings */ }
}

// ── Test Context ───────────────────────────────────────────────
function createTestContext() {
  const results = [];

  return {
    apiBase: API_BASE,
    sessionCookie,

    // Authenticated fetch
    async fetch(urlPath, options) {
      return apiFetch(urlPath, options);
    },

    // Assert with description
    assert(condition, description) {
      if (condition) {
        results.push({ pass: true, description });
        log(`  ✅ ${description}`);
      } else {
        results.push({ pass: false, description });
        log(`  ❌ FAIL: ${description}`);
      }
    },

    // Assert equality
    assertEqual(actual, expected, description) {
      const pass = actual === expected;
      results.push({ pass, description: `${description} (expected: ${expected}, got: ${actual})` });
      if (pass) {
        log(`  ✅ ${description}`);
      } else {
        log(`  ❌ FAIL: ${description} — expected: ${expected}, got: ${actual}`);
      }
    },

    // Log info (no assert)
    log(msg) { log(`  ℹ️  ${msg}`); },

    // Browser available?
    hasBrowser() { return !!browserContext; },

    // Open a page — logs in on the same page, then navigates
    async openPage(urlPath) {
      if (!browserContext) throw new Error('Browser not available');
      const page = await browserContext.newPage();
      await gotoLoginForm(page);
      await page.fill('#username', TEST_USER);
      await page.fill('#password', TEST_PASS);
      await page.click('#submitBtn');
      await waitForLanding(page);
      await page.goto(`${API_BASE}${urlPath}`, { waitUntil: 'networkidle' });
      return page;
    },

    // Open a page that needs PageContext — logs in, sets context, navigates
    async openPageWithContext(urlPath, pageContext) {
      if (!browserContext) throw new Error('Browser not available');
      const page = await browserContext.newPage();
      await gotoLoginForm(page);
      await page.fill('#username', TEST_USER);
      await page.fill('#password', TEST_PASS);
      await page.click('#submitBtn');
      await waitForLanding(page);
      await page.evaluate((ctx) => {
        sessionStorage.setItem('lp_page_context', JSON.stringify(ctx));
      }, pageContext);
      await page.goto(`${API_BASE}${urlPath}`, { waitUntil: 'networkidle' });
      return page;
    },

    // Get results
    getResults() { return results; }
  };
}

// ── Manifest Validation ────────────────────────────────────────
function loadManifest() {
  const manifestPath = path.join(__dirname, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    log('❌ manifest.json not found');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Verify all test files exist
  let missing = 0;
  for (const entry of manifest.tests) {
    const testPath = path.join(__dirname, entry.path);
    if (!fs.existsSync(testPath)) {
      log(`❌ MANIFEST ERROR: Test file missing: ${entry.path}`);
      missing++;
    }
  }
  if (missing > 0) {
    log(`\n❌ ${missing} test file(s) listed in manifest.json do not exist. Fix before running.`);
    process.exit(1);
  }

  return manifest;
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  // A lane worker skips every orchestration step — no lint, no snapshot,
  // no restore. It was handed a database and a server; it runs its slice.
  if (LANE_WORKER) return runWorkerMode();

  const startTime = Date.now();
  const args = process.argv.slice(2);
  const laneFlagIndex = args.findIndex(a => a === '--lanes');
  let laneCount = Number(process.env.LANES || 0);
  if (laneFlagIndex !== -1) {
    laneCount = Number(args[laneFlagIndex + 1]);
    args.splice(laneFlagIndex, 2);
  }
  const requestedTest = args[0] || null;
  // Default: four lanes on a developer machine, two on a small CI runner.
  // More lanes than cores just makes them fight each other.
  if (!laneCount) {
    const cores = require('os').cpus().length;
    laneCount = cores >= 8 ? 4 : 2;
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         POINTER PLATFORM — TEST HARNESS                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (keepAwake()) log('☕ Holding the machine awake for this run (idle sleep only — closing the lid still sleeps)');

  // 0. Pre-flight: anti-pattern lint. Fails fast on platform→vertical
  // leakage or known bug-shaped patterns (see tests/lint-anti-patterns.cjs).
  // Flipped from report-only to fail-on-match at the end of Phase 6
  // (Session 130) once the Insight-server extraction landed clean.
  logHeader('Pre-flight: Anti-pattern Lint');
  try {
    execSync(`node ${path.join(__dirname, 'lint-anti-patterns.cjs')}`, { stdio: 'inherit' });
  } catch (e) {
    log('❌ Anti-pattern lint failed — fix the match above, add a // lint-allow comment with a reason, or move the offending code into a vertical.');
    process.exit(1);
  }

  // 1. Verify server
  logHeader('Step 1: Verify Server');
  // Answering the port is NOT ready (Session 142): the boot chain now
  // includes the ML engine gate, so listen is up well before sessions
  // activate. /version's session_ready is the "logins will work" signal —
  // wait for it, or step 3's login fails on a server that's still booting
  // (exactly what broke CI run 29378066640).
  {
    const READY_DEADLINE_MS = 90000;
    const started = Date.now();  // elapsed-time measurement, not a date
    let ready = false, lastState = 'no response';
    while (Date.now() - started < READY_DEADLINE_MS) {
      try {
        const v = await apiFetch('/version');
        if (v.session_ready) {
          log(`✅ Server running and ready — v${v.version}`);
          ready = true;
          break;
        }
        lastState = `up (v${v.version}) but still booting — session_ready=false`;
      } catch (e) {
        lastState = 'no response';
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!ready) {
      log(`❌ Server not ready at ${API_BASE} after ${READY_DEADLINE_MS / 1000}s (${lastState})`);
      log('   Start the server first: bash bootstrap/start.sh');
      process.exit(1);
    }
  }

  // 2. Snapshot database
  logHeader('Step 2: Snapshot Database');
  if (!snapshotDatabase()) {
    log('❌ Cannot proceed without snapshot. Aborting.');
    process.exit(1);
  }
  snapshotTaken = true;  // from here on, an interrupt restores before exiting

  // 3. Load and validate manifest
  logHeader('Step 3: Load Test Manifest');
  const manifest = loadManifest();

  // Determine which tests to run
  let testsToRun = manifest.tests;
  if (requestedTest) {
    const exact = manifest.tests.find(t => t.path === requestedTest || t.path === `${requestedTest}.cjs`);
    if (exact) {
      testsToRun = [exact];
    } else {
      // Not an exact path — treat it as a filter, so `insight/` runs every
      // Insight test and `molecule` runs every molecule test. Comma-separated
      // filters are unioned, keeping manifest order.
      const parts = requestedTest.split(',').map(s => s.trim()).filter(Boolean);
      const matches = manifest.tests.filter(t => parts.some(p => t.path.includes(p)));
      if (!matches.length) {
        log(`❌ No test in the manifest matches: ${requestedTest}`);
        process.exit(1);
      }
      testsToRun = matches;
    }
  }
  log(`📋 ${testsToRun.length} test(s) to run`);

  const RESULTS_LOG = path.join(__dirname, 'last_run.log');
  const logResultLine = makeResultLogger(RESULTS_LOG);
  try {
    fs.writeFileSync(RESULTS_LOG, `Test run started ${new Date().toISOString()} — ${testsToRun.length} test(s)\n`);
  } catch (e) { /* never fail the run over the log */ }

  // 4. Lanes, unless there is only one test to run (a single test in its
  // own lane costs a database build for nothing — run it the old way).
  if (laneCount > 1 && testsToRun.length > 1) {
    laneMode = true;
    return runLanes(testsToRun, laneCount, startTime, logResultLine);
  }

  // ── Sequential path: one database, the working one, restored after ──
  logHeader('Step 4a: Setup Test User');
  if (!await ensureTestUser()) {
    log('❌ Cannot proceed without test user. Restoring database.');
    restoreDatabase();
    await refreshServerCaches();
    process.exit(1);
  }

  // 4b. Launch browser (if playwright available)
  if (playwright) {
    logHeader('Step 4b: Launch Browser');
    try {
      browser = await playwright.chromium.launch({ headless: true });
      browserContext = await browser.newContext();
      log('✅ Headless Chromium launched');
    } catch (e) {
      log(`⚠️  Browser launch failed: ${e.message} — browser tests will be skipped`);
      browser = null;
      browserContext = null;
    }
  } else {
    log('ℹ️  Playwright not installed — browser tests will be skipped');
  }

  // 5. Run tests
  logHeader('Step 5: Run Tests');
  const { allResults, testsPassed, testsFailed } = await runTestList(testsToRun, logResultLine);

  // 5b. Close browser
  if (browser) {
    try { await browser.close(); } catch (e) { /* ignore */ }
    browser = null;
    browserContext = null;
  }

  await finishRun({ allResults, testsPassed, testsFailed, testsToRun, startTime, logResultLine, restoreMain: true });
}

// The per-test loop, shared by the single-test path and by every lane
// worker. Each test gets a fresh login and a fresh context; a crash is
// recorded against the test that crashed and the run continues.
async function runTestList(testsToRun, logResultLine) {
  const allResults = [];
  let testsPassed = 0;
  let testsFailed = 0;

  for (const testEntry of testsToRun) {
    log(`\n▶ Running: ${testEntry.path}`);
    const testModule = require(path.join(__dirname, testEntry.path));
    // Per-test wall clock. Elapsed-time measurement, NOT a date — Date.now()
    // subtraction is the right tool here and platformToday() is not (see
    // BEFORE_YOU_WRITE: the ban is on deriving CALENDAR DAYS this way).
    const testStarted = Date.now();

    // Re-login before each test to ensure fresh session
    sessionCookie = null;
    const relogin = await apiFetch('/v1/auth/login', {
      method: 'POST',
      body: { username: TEST_USER, password: TEST_PASS }
    });
    if (!relogin._ok) {
      log(`❌ Could not login before test: ${relogin.error || relogin._status}`);
      testsFailed++;
      allResults.push({ test: testEntry.path, name: testModule.name || testEntry.path, passed: 0, failed: 1, results: [{ pass: false, description: 'Pre-test login failed' }] });
      logResultLine(`❌ ${testEntry.path}: Pre-test login failed`);
      continue;
    }

    const ctx = createTestContext();

    try {
      await testModule.run(ctx);
      const results = ctx.getResults();
      const passed = results.filter(r => r.pass).length;
      const failed = results.filter(r => !r.pass).length;

      allResults.push({
        test: testEntry.path,
        name: testModule.name || testEntry.path,
        passed,
        failed,
        results,
        ms: Date.now() - testStarted
      });

      if (failed > 0) {
        testsFailed++;
        log(`\n  ⛔ ${testModule.name || testEntry.path}: ${failed} FAILED, ${passed} passed`);
        logResultLine(`❌ ${testEntry.path} (${testModule.name || testEntry.path}): ${failed} FAILED, ${passed} passed`);
        for (const a of results.filter(a => !a.pass)) {
          logResultLine(`   ↳ FAIL: ${a.description}`);
        }
      } else {
        testsPassed++;
        log(`\n  ✅ ${testModule.name || testEntry.path}: All ${passed} assertions passed`);
        logResultLine(`✅ ${testEntry.path}: ${passed} passed (${((Date.now() - testStarted) / 1000).toFixed(1)}s)`);
      }
    } catch (e) {
      testsFailed++;
      allResults.push({
        test: testEntry.path,
        name: testModule.name || testEntry.path,
        passed: 0,
        failed: 1,
        results: [{ pass: false, description: `Test crashed: ${e.message}` }],
        ms: Date.now() - testStarted
      });
      log(`\n  💥 ${testModule.name || testEntry.path} CRASHED: ${e.message}`);
      // The first stack frame names the failing LINE — without it a crash
      // in a 600-line test is a treasure hunt (S167; the name-never-lost
      // rule of S163, extended to the crash site).
      log(`     ${String(e.stack || '').split('\n')[1] || ''}`);
      logResultLine(`💥 ${testEntry.path} CRASHED: ${e.message}`);
      logResultLine(`   ${String(e.stack || '').split('\n')[1] || ''}`);
    }
  }

  return { allResults, testsPassed, testsFailed };
}

// Restore (when this run mutated the working database), then report.
async function finishRun({ allResults, testsPassed, testsFailed, testsToRun, startTime, logResultLine, restoreMain }) {
  // 6. Restore database + bring the server's memory back in line with it
  if (restoreMain) {
    logHeader('Step 6: Restore Database');
    if (!restoreDatabase()) {
      // A damaged database must dominate the exit: whatever the tests said,
      // NOTHING may run against this state — not another suite, not the app.
      await refreshServerCaches().catch(() => {});
      process.exit(2);
    }
    await refreshServerCaches();
    finalRestoreDone = true;  // an interrupt after this point has nothing to clean up
  }

  // 7. Report
  logHeader('RESULTS');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalAssertions = allResults.reduce((sum, r) => sum + r.passed + r.failed, 0);
  const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);

  console.log('');
  for (const r of allResults) {
    const icon = r.failed > 0 ? '❌' : '✅';
    console.log(`  ${icon} ${r.name}: ${r.passed} passed, ${r.failed} failed`);
    if (r.failed > 0) {
      for (const a of r.results.filter(a => !a.pass)) {
        console.log(`     ↳ FAIL: ${a.description}`);
      }
    }
  }

  // Where the time actually goes. Without this the only honest answer to
  // "why does the suite take ten minutes" is a guess — and the guess was
  // wrong the first time it was made (the browser logins are ~14% of the
  // run, not the bulk of it). Slowest first; the tail is noise.
  if (testsToRun.length > 1) {
    const timed = allResults.filter(r => typeof r.ms === 'number').sort((a, b) => b.ms - a.ms);
    const totalMs = timed.reduce((s, r) => s + r.ms, 0);
    console.log(`\n  Slowest tests (${(totalMs / 1000).toFixed(0)}s in tests; the rest is snapshot/restore/boot):`);
    for (const r of timed.slice(0, 10)) {
      const share = totalMs ? ((r.ms / totalMs) * 100).toFixed(0) : '0';
      console.log(`     ${((r.ms) / 1000).toFixed(1).padStart(6)}s  ${String(share).padStart(2)}%  ${r.test}`);
    }
    logResultLine(`\nSlowest tests (${(totalMs / 1000).toFixed(0)}s total in tests):`);
    for (const r of timed.slice(0, 20)) {
      logResultLine(`   ${((r.ms) / 1000).toFixed(1).padStart(6)}s  ${r.test}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Tests:      ${testsPassed} passed, ${testsFailed} failed (${testsToRun.length} total)`);
  console.log(`  Assertions: ${totalPassed} passed, ${totalFailed} failed (${totalAssertions} total)`);
  console.log(`  Time:       ${elapsed}s`);
  console.log(`  Database:   ${restoreMain ? 'Restored to pre-test state' : 'Working database never written to (tests ran in lane copies)'}`);
  console.log(`${'─'.repeat(60)}\n`);

  // Feed the balancer for next time.
  saveTimings(allResults);

  logResultLine(`\nSummary: ${testsPassed}/${testsToRun.length} tests passed, ${totalPassed}/${totalAssertions} assertions passed, ${elapsed}s`);
  logResultLine(totalFailed > 0 ? 'RESULT: FAILED' : 'RESULT: ALL PASSED');

  if (totalFailed > 0) {
    console.log('  ⛔ TESTS FAILED\n');
    console.log(`  Full per-test results: tests/last_run.log\n`);
    process.exit(1);
  } else {
    console.log('  ✅ ALL TESTS PASSED\n');
    process.exit(0);
  }
}

function makeResultLogger(file) {
  return (line) => {
    try { fs.appendFileSync(file, line + '\n'); } catch (e) { /* never fail the run over the log */ }
  };
}

// ── Worker mode ────────────────────────────────────────────────
// One lane: its own database, its own server, its own browser. Runs the
// slice of tests it was handed and writes results as JSON for the
// orchestrator. It never snapshots and never restores — the lane database
// is disposable and the working database is not its business.
async function runWorkerMode() {
  const slice = JSON.parse(fs.readFileSync(process.env.LANE_TESTS_FILE, 'utf8'));
  const resultsFile = process.env.LANE_RESULTS_FILE;
  const laneLog = path.join(SNAPSHOT_DIR, `lane${LANE_ID}-tests.log`);
  const logResultLine = makeResultLogger(laneLog);
  try { fs.writeFileSync(laneLog, `Lane ${LANE_ID} — ${slice.length} test(s) — db ${DB_NAME} — ${API_BASE}\n`); } catch (e) { /* ignore */ }

  if (!await ensureTestUser()) {
    fs.writeFileSync(resultsFile, JSON.stringify({ fatal: `lane ${LANE_ID}: could not create the test user` }));
    process.exit(1);
  }

  if (playwright) {
    try {
      browser = await playwright.chromium.launch({ headless: true });
      browserContext = await browser.newContext();
    } catch (e) {
      browser = null; browserContext = null;
    }
  }

  const { allResults, testsPassed, testsFailed } = await runTestList(slice, logResultLine);

  if (browser) { try { await browser.close(); } catch (e) { /* ignore */ } }
  fs.writeFileSync(resultsFile, JSON.stringify({ allResults, testsPassed, testsFailed }));
  process.exit(0);
}

// ── Orchestrator: the parallel path ────────────────────────────
async function runLanes(testsToRun, laneCount, startTime, logResultLine) {
  const lanes = assignTestsToLanes(testsToRun, laneCount);
  const active = lanes.filter(l => l.tests.length > 0);

  logHeader(`Step 5: Run Tests — ${active.length} lanes`);
  for (let i = 0; i < active.length; i++) {
    log(`  lane ${i}: ${active[i].tests.length} tests (~${(active[i].ms / 1000).toFixed(0)}s predicted)`);
  }
  log(`  Floor is the slowest single test — lanes cannot beat it.`);

  // Build each lane's database from the snapshot, then boot its server.
  logHeader('Step 4c: Build Lane Databases + Servers');
  const built = [];
  for (let i = 0; i < active.length; i++) {
    const db = createLaneDatabase(i);
    built.push({ i, db });
  }
  await Promise.all(built.map(async ({ i, db }) => {
    const tables = await new Promise((resolve, reject) => {
      try { resolve(restoreIntoLane(db)); } catch (e) { reject(e); }
    });
    log(`  ✅ lane ${i} database ready (${tables} tables)`);
  }));

  const servers = built.map(({ i, db }) => startLaneServer(i, db));
  await Promise.all(servers.map(async (s) => {
    const v = await waitForLaneServer(s);
    log(`  ✅ lane ${s.id} server ready on ${s.port} — v${v.version}`);
  }));

  // Fan out.
  const { spawn } = require('child_process');
  const tmpDir = fs.mkdtempSync(path.join(SNAPSHOT_DIR, 'lanes-'));
  const runs = active.map((lane, i) => new Promise((resolve) => {
    const testsFile = path.join(tmpDir, `lane${i}-tests.json`);
    const resultsFile = path.join(tmpDir, `lane${i}-results.json`);
    fs.writeFileSync(testsFile, JSON.stringify(lane.tests));
    const proc = spawn(NODE_BIN, [__filename], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        LANE_WORKER: '1',
        LANE_ID: String(i),
        LANE_TESTS_FILE: testsFile,
        LANE_RESULTS_FILE: resultsFile,
        TEST_API_BASE: `http://127.0.0.1:${lanePort(i)}`,
        DATABASE_NAME: laneDbName(i),
        PGDATABASE: laneDbName(i)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const out = fs.createWriteStream(path.join(SNAPSHOT_DIR, `lane${i}-worker.log`), { flags: 'w' });
    proc.stdout.pipe(out);
    proc.stderr.pipe(out);
    proc.on('exit', () => {
      try {
        resolve(JSON.parse(fs.readFileSync(resultsFile, 'utf8')));
      } catch (e) {
        resolve({ fatal: `lane ${i} produced no results — see .claude/test-snapshots/lane${i}-worker.log` });
      }
    });
  }));

  const laneResults = await Promise.all(runs);

  // Merge, keeping the manifest's order so the report reads the same as
  // it always has regardless of which lane ran what.
  const byPath = new Map();
  let testsPassed = 0, testsFailed = 0;
  for (const r of laneResults) {
    if (r.fatal) {
      log(`❌ ${r.fatal}`);
      testsFailed++;
      continue;
    }
    testsPassed += r.testsPassed;
    testsFailed += r.testsFailed;
    for (const t of r.allResults) byPath.set(t.test, t);
  }
  const allResults = testsToRun.map(t => byPath.get(t.path)).filter(Boolean);

  for (const r of allResults) {
    if (r.failed > 0) {
      logResultLine(`❌ ${r.test} (${r.name}): ${r.failed} FAILED, ${r.passed} passed`);
      for (const a of r.results.filter(a => !a.pass)) logResultLine(`   ↳ FAIL: ${a.description}`);
    } else {
      logResultLine(`✅ ${r.test}: ${r.passed} passed (${(r.ms / 1000).toFixed(1)}s)`);
    }
  }

  teardownLanes();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }

  await finishRun({ allResults, testsPassed, testsFailed, testsToRun, startTime, logResultLine, restoreMain: false });
}

main().catch(async e => {
  console.error('\n💥 Test harness crashed:', e.message);
  if (browser) try { await browser.close(); } catch (_) {}
  if (laneMode) {
    console.log('Tearing down lanes (your working database was never written to)...');
    try { teardownLanes(); } catch (_) {}
    process.exit(1);
  }
  if (snapshotTaken && !finalRestoreDone) {
    console.log('\nAttempting database restore...');
    restoreDatabase();
    try { await refreshServerCaches(); } catch (_) {}
  }
  process.exit(1);
});
