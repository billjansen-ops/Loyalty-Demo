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
const TARGET_VERSION = 8;

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
  },
  {
    version: 6,
    description: 'Create notification table for platform-wide notification system',
    async run(client) {
      await client.query(`
        CREATE TABLE notification (
          notification_id SERIAL PRIMARY KEY,
          tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          recipient_user_id INTEGER NOT NULL REFERENCES platform_user(user_id),
          severity VARCHAR(10) NOT NULL DEFAULT 'info',
          title VARCHAR(200) NOT NULL,
          body TEXT,
          source VARCHAR(50),
          source_link VARCHAR(20),
          source_page VARCHAR(200),
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ
        )
      `);
      await client.query('CREATE INDEX idx_notification_recipient ON notification(recipient_user_id, is_read, created_at DESC)');
      await client.query('CREATE INDEX idx_notification_tenant ON notification(tenant_id, created_at DESC)');
      // Severity check
      await client.query(`
        ALTER TABLE notification ADD CONSTRAINT notification_severity_check
        CHECK (severity IN ('critical', 'warning', 'info'))
      `);
    }
  },
  {
    version: 7,
    description: 'Add dominant driver columns to stability_registry',
    async run(client) {
      await client.query(`ALTER TABLE stability_registry ADD COLUMN IF NOT EXISTS dominant_driver VARCHAR(15)`);
      await client.query(`ALTER TABLE stability_registry ADD COLUMN IF NOT EXISTS dominant_subdomain VARCHAR(25)`);
      await client.query(`ALTER TABLE stability_registry ADD COLUMN IF NOT EXISTS protocol_card VARCHAR(5)`);
    }
  },
  {
    version: 8,
    description: 'Seed varied dominant driver data on existing registry items for demo',
    async run(client) {
      // Map reason codes to clinically appropriate drivers for demo variety
      const updates = [
        // Patricia Walsh — PPII trending up, Red composite → PPSI burnout and sleep issues
        { link: -2147483644, driver: 'PPSI', subdomain: 'BURNOUT', card: 'A2' },    // PPII_TREND_UP → burnout driving it
        { link: -2147483645, driver: 'PPSI', subdomain: 'WORK', card: 'A3' },       // MISSED_APPOINTMENT → work sustainability
        { link: -2147483646, driver: 'PPSI', subdomain: 'SLEEP', card: 'A1' },      // PPII_RED → sleep collapse

        // David Nguyen — positive drug test, escalation → compliance + events
        { link: -2147483643, driver: 'COMPLIANCE', subdomain: null, card: 'C' },     // SENTINEL_POSITIVE → compliance (correct)
        { link: -2147483641, driver: 'EVENTS', subdomain: null, card: 'D' },         // MONITOR_ESCALATION → event driven
        { link: -2147483642, driver: 'PPSI', subdomain: 'RECOVERY', card: 'A6' },   // MISSED_CHECKIN → recovery/routine disruption

        // Marcus Reed — late drug test, delayed checkin → compliance + isolation
        { link: -2147483648, driver: 'COMPLIANCE', subdomain: null, card: 'C' },     // LATE_DRUG_TEST → compliance (correct)
        { link: -2147483647, driver: 'PPSI', subdomain: 'ISOLATION', card: 'A4' },  // DELAYED_CHECKIN → isolation signal
        { link: -2147483629, driver: 'COMPLIANCE', subdomain: null, card: 'C' },     // SENTINEL → compliance (correct)
        { link: -2147483630, driver: 'EVENTS', subdomain: null, card: 'D' },         // SENTINEL → event (different sentinel cause)

        // Robert Holmberg — missed survey/checkins → purpose + cognitive
        { link: -2147483638, driver: 'PPSI', subdomain: 'PURPOSE', card: 'A7' },    // MISSED_SURVEY → meaning/purpose decline
        { link: -2147483639, driver: 'PPSI', subdomain: 'COGNITIVE', card: 'A5' },  // REPEATED_MISSED_CHECKINS → cognitive load

        // James Okafor — sentinel → pulse safety concern
        { link: -2147483631, driver: 'PULSE', subdomain: 'PROVIDER', card: 'P1' },  // SENTINEL → provider stability concern

        // Michelle Ostrowski — mix of pulse, compliance, PPSI
        { link: -2147483635, driver: 'PULSE', subdomain: 'ENGAGEMENT', card: 'P3' }, // PULSE_QUESTION_3 → treatment engagement
        { link: -2147483636, driver: 'COMPLIANCE', subdomain: null, card: 'C' },     // INCONCLUSIVE_DRUG_TEST → compliance (correct)
        { link: -2147483637, driver: 'PULSE', subdomain: 'MOOD', card: 'P4' },      // PPII_ORANGE → mood + workload
        { link: -2147483620, driver: 'PULSE', subdomain: 'PROVIDER', card: 'P5' },  // SENTINEL → safety concern (P5)
        { link: -2147483621, driver: 'PPSI', subdomain: 'GLOBAL', card: 'A8' },     // YELLOW → global stability
        { link: -2147483625, driver: 'PPSI', subdomain: 'BURNOUT', card: 'A2' },    // ORANGE → burnout

        // Elena Vasquez — keep existing PPSI/SLEEP (already good)
        // Bill Jansen — keep existing PULSE and PPSI/COGNITIVE (already good)
      ];

      for (const u of updates) {
        await client.query(
          `UPDATE stability_registry SET dominant_driver = $1, dominant_subdomain = $2, protocol_card = $3,
           source_stream = COALESCE($1, source_stream) WHERE link = $4`,
          [u.driver, u.subdomain, u.card, u.link]
        );
      }
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
