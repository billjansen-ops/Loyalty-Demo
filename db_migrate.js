/**
 * db_migrate.js — Database Migration Runner
 * 
 * Usage: node db_migrate.js
 * 
 * Reads current database version from sysparm (tenant_id=0, key='db_version').
 * Runs each migration function in a transaction.
 * On failure: ROLLBACK, version unchanged, fix and run again.
 * Safe to run multiple times — skips already-applied versions.
 * 
 * To add a migration:
 *   1. Add a new entry to the migrations array at the bottom
 *   2. Bump TARGET_VERSION to match
 *   3. Run: node db_migrate.js
 */

import pg from 'pg';
const { Pool } = pg;

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      user: process.env.DATABASE_USER || 'billjansen',
      database: process.env.DATABASE_NAME || 'loyalty',
      port: parseInt(process.env.DATABASE_PORT || '5432')
    });

// ============================================
// TARGET VERSION — bump this when adding migrations
// ============================================
const TARGET_VERSION = 5;

// ============================================
// VERSION HELPERS
// ============================================

async function getVersion(client, tenantId = 0) {
  const res = await client.query(`
    SELECT sd.value FROM sysparm s
    JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
    WHERE s.tenant_id = $1 AND s.sysparm_key = 'db_version'
    AND sd.category = 'current' AND sd.code = 'version'
  `, [tenantId]);
  return res.rows.length ? parseInt(res.rows[0].value) : 0;
}

async function setVersion(client, version, tenantId = 0) {
  const existing = await client.query(`
    SELECT sd.detail_id FROM sysparm s
    JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
    WHERE s.tenant_id = $1 AND s.sysparm_key = 'db_version'
    AND sd.category = 'current' AND sd.code = 'version'
  `, [tenantId]);

  if (existing.rows.length) {
    await client.query(
      `UPDATE sysparm_detail SET value = $1 WHERE detail_id = $2`,
      [String(version), existing.rows[0].detail_id]
    );
  } else {
    // Create sysparm + detail if first time
    let sysparmId;
    const sp = await client.query(`
      SELECT sysparm_id FROM sysparm
      WHERE tenant_id = $1 AND sysparm_key = 'db_version'
    `, [tenantId]);
    if (sp.rows.length) {
      sysparmId = sp.rows[0].sysparm_id;
    } else {
      const ins = await client.query(`
        INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
        VALUES ($1, 'db_version', 'text', 'Database schema version')
        RETURNING sysparm_id
      `, [tenantId]);
      sysparmId = ins.rows[0].sysparm_id;
    }
    await client.query(`
      INSERT INTO sysparm_detail (sysparm_id, category, code, value)
      VALUES ($1, 'current', 'version', $2)
    `, [sysparmId, String(version)]);
  }
}

// ============================================
// MIGRATIONS — add new ones at the bottom
// ============================================

const migrations = [
  {
    version: 1,
    description: 'Baseline — current database state as of Session 94',
    async run(client) {
      // Nothing to do — everything that exists today is the baseline.
      // This just stamps the database as version 1.
    }
  },
  {
    version: 2,
    description: 'Test migration — no changes, verifies migration runner works',
    async run(client) {
      // Empty on purpose — just proves the version bump works
    }
  },
  {
    version: 3,
    description: 'Test migration 2 — verifies incremental version check',
    async run(client) {
      // Empty on purpose
    }
  },
  {
    version: 4,
    description: 'Create usage_log table for login audit trail',
    async run(client) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS usage_log (
          log_id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES platform_user(user_id),
          tenant_id SMALLINT,
          action VARCHAR(50) NOT NULL,
          ip_address VARCHAR(45),
          user_agent VARCHAR(500),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await client.query('CREATE INDEX IF NOT EXISTS idx_usage_log_created ON usage_log(created_at DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_usage_log_user ON usage_log(user_id)');
    }
  },
  {
    version: 5,
    description: 'Compliance cadence: add cadence_type to both tables, convert member_compliance.cadence from text to numeric',
    async run(client) {
      // 1. Add cadence_type to compliance_item (the rule definition)
      await client.query(`
        ALTER TABLE compliance_item
        ADD COLUMN IF NOT EXISTS cadence_type VARCHAR(10) NOT NULL DEFAULT 'custom'
      `);
      // Backfill: map known cadence_days to named types
      await client.query(`
        UPDATE compliance_item SET cadence_type = CASE
          WHEN cadence_days = 7 THEN 'weekly'
          WHEN cadence_days = 30 THEN 'monthly'
          WHEN cadence_days = 90 THEN 'quarterly'
          WHEN cadence_days = 365 THEN 'yearly'
          ELSE 'custom'
        END
      `);

      // 2. member_compliance: drop old text cadence, add cadence_type + cadence_days
      await client.query(`ALTER TABLE member_compliance DROP COLUMN IF EXISTS cadence`);
      await client.query(`
        ALTER TABLE member_compliance
        ADD COLUMN IF NOT EXISTS cadence_type VARCHAR(10) NOT NULL DEFAULT 'custom'
      `);
      await client.query(`
        ALTER TABLE member_compliance
        ADD COLUMN IF NOT EXISTS cadence_days SMALLINT
      `);

      // 3. Backfill member_compliance from parent compliance_item
      await client.query(`
        UPDATE member_compliance mc
        SET cadence_type = ci.cadence_type,
            cadence_days = ci.cadence_days
        FROM compliance_item ci
        WHERE mc.compliance_item_id = ci.compliance_item_id
      `);
    }
  }
];

// ============================================
// RUNNER
// ============================================

async function migrate() {
  const client = await pool.connect();

  try {
    const currentVersion = await getVersion(client);
    console.log(`\n📦 Database version: ${currentVersion}`);
    console.log(`🎯 Target version:  ${TARGET_VERSION}\n`);

    if (currentVersion >= TARGET_VERSION) {
      console.log('✅ Database is current. Nothing to do.\n');
      return;
    }

    let applied = 0;

    for (const migration of migrations) {
      if (migration.version <= currentVersion) {
        console.log(`  ⏭️  v${migration.version} — ${migration.description} (already applied)`);
        continue;
      }

      console.log(`  🔄 v${migration.version} — ${migration.description}`);

      try {
        await client.query('BEGIN');
        await migration.run(client);
        await setVersion(client, migration.version);
        await client.query('COMMIT');
        console.log(`  ✅ v${migration.version} — done`);
        applied++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ v${migration.version} — FAILED: ${err.message}`);
        console.error(`\n⛔ Migration stopped. Fix the error and run again.\n`);
        process.exit(1);
      }
    }

    const finalVersion = await getVersion(client);
    console.log(`\n✅ Applied ${applied} migration(s). Database now at version ${finalVersion}\n`);

  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
