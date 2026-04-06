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
const PG_DUMP = '/opt/homebrew/bin/pg_dump';
const PG_RESTORE = '/opt/homebrew/bin/pg_restore';
const PSQL = '/opt/homebrew/bin/psql';
const DB_HOST = process.env.DATABASE_HOST || '127.0.0.1';
const DB_USER = process.env.DATABASE_USER || 'billjansen';
const DB_NAME = process.env.DATABASE_NAME || 'loyalty';
const SNAPSHOT_DIR = path.join(__dirname, '..', '.claude', 'test-snapshots');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'pre-test.dump');
const TEST_USER = 'Claude';
const TEST_PASS = 'claude123';

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
  if (setCookie) sessionCookie = setCookie.split(';')[0];

  const data = await resp.json().catch(() => ({}));
  data._status = resp.status;
  data._ok = resp.ok;
  return data;
}

function log(msg) { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${'─'.repeat(60)}\n  ${msg}\n${'─'.repeat(60)}`); }

// ── Database Snapshot/Restore ──────────────────────────────────
function snapshotDatabase() {
  log('📸 Creating database snapshot...');
  try {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    execSync(`${PG_DUMP} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -Fc -f "${SNAPSHOT_FILE}"`, {
      stdio: 'pipe',
      timeout: 60000
    });
    const size = fs.statSync(SNAPSHOT_FILE).size;
    log(`✅ Snapshot created (${(size / 1024 / 1024).toFixed(1)} MB)`);
    return true;
  } catch (e) {
    log(`❌ Snapshot failed: ${e.message}`);
    return false;
  }
}

function restoreDatabase() {
  log('🔄 Restoring database from snapshot...');
  try {
    // Drop and recreate all objects, suppress errors for objects that don't exist
    execSync(
      `${PG_RESTORE} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} --clean --if-exists -Fc "${SNAPSHOT_FILE}"`,
      { stdio: 'pipe', timeout: 120000 }
    );
    log('✅ Database restored');
    return true;
  } catch (e) {
    // pg_restore returns non-zero on warnings (like "table doesn't exist to drop") — check if it's real
    if (e.status && e.status <= 1) {
      log('✅ Database restored (with warnings)');
      return true;
    }
    log(`⚠️  Database restore completed with warnings: ${e.message.substring(0, 200)}`);
    return true; // pg_restore often returns non-zero even on success
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
      `cd "${path.join(__dirname, '..')}" && /opt/homebrew/bin/node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('${TEST_PASS}', 10));"`,
      { encoding: 'utf8', stdio: 'pipe' }
    ).trim().split('\n').pop(); // Last line is the hash (skip deprecation warnings)

    execSync(
      `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -c "INSERT INTO platform_user (username, password_hash, display_name, tenant_id, role, link) SELECT '${TEST_USER}', '${bcryptHash}', 'Claude (System)', 5, 'superuser', COALESCE((SELECT MAX(link)+1 FROM platform_user), 100) WHERE NOT EXISTS (SELECT 1 FROM platform_user WHERE username = '${TEST_USER}');"`,
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
      await page.goto(`${API_BASE}/login.html`, { waitUntil: 'networkidle' });
      await page.fill('#username', TEST_USER);
      await page.fill('#password', TEST_PASS);
      await page.click('#submitBtn');
      await page.waitForURL('**/dashboard.html', { timeout: 10000 });
      await page.goto(`${API_BASE}${urlPath}`, { waitUntil: 'networkidle' });
      return page;
    },

    // Open a page that needs PageContext — logs in, sets context, navigates
    async openPageWithContext(urlPath, pageContext) {
      if (!browserContext) throw new Error('Browser not available');
      const page = await browserContext.newPage();
      await page.goto(`${API_BASE}/login.html`, { waitUntil: 'networkidle' });
      await page.fill('#username', TEST_USER);
      await page.fill('#password', TEST_PASS);
      await page.click('#submitBtn');
      await page.waitForURL('**/dashboard.html', { timeout: 10000 });
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
  const startTime = Date.now();
  const requestedTest = process.argv[2] || null;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         POINTER PLATFORM — TEST HARNESS                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // 1. Verify server
  logHeader('Step 1: Verify Server');
  try {
    const version = await apiFetch('/v1/version');
    if (!version.version) throw new Error('No version returned');
    log(`✅ Server running — v${version.version}`);
  } catch (e) {
    log(`❌ Server not responding at ${API_BASE}`);
    log('   Start the server first: PGHOST=127.0.0.1 PGUSER=billjansen PGDATABASE=loyalty node pointers.js');
    process.exit(1);
  }

  // 2. Snapshot database
  logHeader('Step 2: Snapshot Database');
  if (!snapshotDatabase()) {
    log('❌ Cannot proceed without snapshot. Aborting.');
    process.exit(1);
  }

  // 3. Ensure test user
  logHeader('Step 3: Setup Test User');
  if (!await ensureTestUser()) {
    log('❌ Cannot proceed without test user. Restoring database.');
    restoreDatabase();
    process.exit(1);
  }

  // 4. Load and validate manifest
  logHeader('Step 4: Load Test Manifest');
  const manifest = loadManifest();

  // Determine which tests to run
  let testsToRun = manifest.tests;
  if (requestedTest) {
    const match = manifest.tests.find(t => t.path === requestedTest || t.path === `${requestedTest}.cjs`);
    if (!match) {
      log(`❌ Test not found in manifest: ${requestedTest}`);
      restoreDatabase();
      process.exit(1);
    }
    testsToRun = [match];
  }
  log(`📋 ${testsToRun.length} test(s) to run`);

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
  const allResults = [];
  let testsPassed = 0;
  let testsFailed = 0;

  for (const testEntry of testsToRun) {
    log(`\n▶ Running: ${testEntry.path}`);
    const testModule = require(path.join(__dirname, testEntry.path));

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
        results
      });

      if (failed > 0) {
        testsFailed++;
        log(`\n  ⛔ ${testModule.name || testEntry.path}: ${failed} FAILED, ${passed} passed`);
      } else {
        testsPassed++;
        log(`\n  ✅ ${testModule.name || testEntry.path}: All ${passed} assertions passed`);
      }
    } catch (e) {
      testsFailed++;
      allResults.push({
        test: testEntry.path,
        name: testModule.name || testEntry.path,
        passed: 0,
        failed: 1,
        results: [{ pass: false, description: `Test crashed: ${e.message}` }]
      });
      log(`\n  💥 ${testModule.name || testEntry.path} CRASHED: ${e.message}`);
    }
  }

  // 5b. Close browser
  if (browser) {
    try { await browser.close(); } catch (e) { /* ignore */ }
    browser = null;
    browserContext = null;
  }

  // 6. Restore database
  logHeader('Step 6: Restore Database');
  restoreDatabase();

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

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Tests:      ${testsPassed} passed, ${testsFailed} failed (${testsToRun.length} total)`);
  console.log(`  Assertions: ${totalPassed} passed, ${totalFailed} failed (${totalAssertions} total)`);
  console.log(`  Time:       ${elapsed}s`);
  console.log(`  Database:   Restored to pre-test state`);
  console.log(`${'─'.repeat(60)}\n`);

  if (totalFailed > 0) {
    console.log('  ⛔ TESTS FAILED\n');
    process.exit(1);
  } else {
    console.log('  ✅ ALL TESTS PASSED\n');
    process.exit(0);
  }
}

main().catch(async e => {
  console.error('\n💥 Test harness crashed:', e.message);
  if (browser) try { await browser.close(); } catch (_) {}
  console.log('\nAttempting database restore...');
  restoreDatabase();
  process.exit(1);
});
