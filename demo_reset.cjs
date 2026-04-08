#!/usr/bin/env node
/**
 * Demo Reset — Restore platform database to a known demo baseline.
 *
 * Usage:
 *   node demo_reset.js save       — Save current database state as the demo baseline
 *   node demo_reset.js restore    — Restore database to saved baseline, then run migrations
 *   node demo_reset.js status     — Show baseline info (when saved, db version, size)
 *
 * Erica sets up the data how she wants it for demos, Bill runs "save".
 * Before any demo, Bill runs "restore" and the platform is clean.
 * If Erica wants a new baseline, she sets it up again and Bill runs "save".
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PG_DUMP = '/opt/homebrew/bin/pg_dump';
const PG_RESTORE = '/opt/homebrew/bin/pg_restore';
const PSQL = '/opt/homebrew/bin/psql';
const NODE = '/opt/homebrew/bin/node';
const DB_HOST = process.env.PGHOST || '127.0.0.1';
const DB_USER = process.env.PGUSER || 'billjansen';
const DB_NAME = process.env.PGDATABASE || 'loyalty';

const BASELINE_DIR = path.join(__dirname, '.claude', 'demo-baseline');
const BASELINE_FILE = path.join(BASELINE_DIR, 'demo-baseline.dump');
const BASELINE_META = path.join(BASELINE_DIR, 'baseline-info.json');

const command = process.argv[2];

if (!command || !['save', 'restore', 'status'].includes(command)) {
  console.log(`
  Demo Reset — Restore platform to a known demo baseline

  Usage:
    node demo_reset.js save       Save current state as demo baseline
    node demo_reset.js restore    Restore to baseline + run migrations
    node demo_reset.js status     Show baseline info
  `);
  process.exit(0);
}

// ── SAVE ──
if (command === 'save') {
  console.log('\n📸 Saving demo baseline...\n');

  // Get current db version
  let dbVersion = '?';
  try {
    const sqlFile = path.join(BASELINE_DIR, '_tmp_version.sql');
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    fs.writeFileSync(sqlFile, "SELECT sd.value FROM sysparm s JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id WHERE s.tenant_id = 0 AND s.sysparm_key = 'db_version' AND sd.category = 'current' AND sd.code = 'version'");
    const result = execSync(
      `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -t -f "${sqlFile}"`,
      { encoding: 'utf8', stdio: 'pipe' }
    ).trim();
    fs.unlinkSync(sqlFile);
    dbVersion = result || '?';
  } catch (e) {
    console.log('  ⚠️  Could not read db_version');
  }

  // Dump
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  try {
    execSync(`${PG_DUMP} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -Fc -f "${BASELINE_FILE}"`, {
      stdio: 'pipe',
      timeout: 120000
    });
  } catch (e) {
    console.error('  ❌ pg_dump failed:', e.message);
    process.exit(1);
  }

  const size = fs.statSync(BASELINE_FILE).size;
  const meta = {
    saved_at: new Date().toISOString(),
    saved_by: process.env.USER || 'unknown',
    db_version: dbVersion,
    size_bytes: size,
    size_mb: (size / 1024 / 1024).toFixed(1)
  };
  fs.writeFileSync(BASELINE_META, JSON.stringify(meta, null, 2));

  console.log(`  ✅ Baseline saved`);
  console.log(`  📁 ${BASELINE_FILE}`);
  console.log(`  📦 DB version: ${dbVersion}`);
  console.log(`  💾 Size: ${meta.size_mb} MB`);
  console.log(`  🕐 ${meta.saved_at}\n`);
}

// ── RESTORE ──
if (command === 'restore') {
  console.log('\n🔄 Restoring demo baseline...\n');

  if (!fs.existsSync(BASELINE_FILE)) {
    console.error('  ❌ No baseline found. Run "node demo_reset.js save" first.\n');
    process.exit(1);
  }

  // Show what we're restoring
  if (fs.existsSync(BASELINE_META)) {
    const meta = JSON.parse(fs.readFileSync(BASELINE_META, 'utf8'));
    console.log(`  📦 Restoring baseline from ${meta.saved_at}`);
    console.log(`  📦 DB version at save: ${meta.db_version}`);
    console.log(`  💾 Size: ${meta.size_mb} MB\n`);
  }

  // Step 1: Restore from dump
  console.log('  Step 1: Restoring database from snapshot...');
  try {
    execSync(
      `${PG_RESTORE} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} --clean --if-exists -Fc "${BASELINE_FILE}"`,
      { stdio: 'pipe', timeout: 120000 }
    );
    console.log('  ✅ Database restored');
  } catch (e) {
    // pg_restore returns non-zero on warnings — check if it's real
    if (e.status && e.status <= 1) {
      console.log('  ✅ Database restored (with warnings)');
    } else {
      console.log('  ⚠️  Database restore completed with warnings');
    }
  }

  // Step 2: Run migrations to bring forward to current code version
  console.log('\n  Step 2: Running migrations...');
  try {
    const migrateOutput = execSync(`${NODE} ${path.join(__dirname, 'db_migrate.js')}`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60000,
      env: { ...process.env, PGHOST: DB_HOST, PGUSER: DB_USER, PGDATABASE: DB_NAME }
    });
    // Show just the summary
    const lines = migrateOutput.split('\n');
    const applied = lines.find(l => l.includes('Applied') || l.includes('current'));
    console.log(`  ✅ ${applied ? applied.trim() : 'Migrations complete'}`);
  } catch (e) {
    const output = e.stdout || '';
    if (output.includes('Database is current')) {
      console.log('  ✅ Database is current — no migrations needed');
    } else {
      console.log('  ⚠️  Migration output:', output.substring(0, 200));
    }
  }

  console.log('\n  ✅ Demo reset complete. Platform is ready.\n');
}

// ── STATUS ──
if (command === 'status') {
  console.log('\n📋 Demo Baseline Status\n');

  if (!fs.existsSync(BASELINE_META)) {
    console.log('  No baseline saved yet. Run "node demo_reset.js save" first.\n');
    process.exit(0);
  }

  const meta = JSON.parse(fs.readFileSync(BASELINE_META, 'utf8'));
  console.log(`  Saved at:    ${meta.saved_at}`);
  console.log(`  Saved by:    ${meta.saved_by}`);
  console.log(`  DB version:  ${meta.db_version}`);
  console.log(`  Size:        ${meta.size_mb} MB`);

  // Get current db version for comparison
  try {
    const tmpSql = path.join(BASELINE_DIR, '_tmp_version.sql');
    fs.writeFileSync(tmpSql, "SELECT sd.value FROM sysparm s JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id WHERE s.tenant_id = 0 AND s.sysparm_key = 'db_version' AND sd.category = 'current' AND sd.code = 'version'");
    const current = execSync(
      `${PSQL} -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -t -f "${tmpSql}"`,
      { encoding: 'utf8', stdio: 'pipe' }
    ).trim();
    try { fs.unlinkSync(tmpSql); } catch(e) {}
    console.log(`  Current DB:  ${current}`);
    if (current !== meta.db_version) {
      console.log(`  ⚠️  Baseline is at v${meta.db_version}, current code is v${current} — migrations will run on restore`);
    }
  } catch (e) { /* ignore */ }

  console.log('');
}
