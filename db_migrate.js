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
const TARGET_VERSION = 13;

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
  },
  {
    version: 9,
    description: 'Create registry_followup table for outcome tracking',
    async run(client) {
      await client.query(`
        CREATE TABLE registry_followup (
          followup_id SERIAL PRIMARY KEY,
          registry_link INTEGER NOT NULL REFERENCES stability_registry(link),
          tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          followup_type VARCHAR(20) NOT NULL,
          scheduled_date SMALLINT NOT NULL,
          completed_date SMALLINT,
          completed_ts TIMESTAMP,
          completed_by INTEGER REFERENCES platform_user(user_id),
          outcome VARCHAR(15),
          pathway_answers JSONB,
          notes TEXT,
          created_ts TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT followup_type_check CHECK (followup_type IN ('2wk','4wk','8wk','weekly','48h','compliance_period')),
          CONSTRAINT followup_outcome_check CHECK (outcome IS NULL OR outcome IN ('improving','stable','declining','escalated'))
        )
      `);
      await client.query('CREATE INDEX idx_followup_registry ON registry_followup(registry_link)');
      await client.query('CREATE INDEX idx_followup_scheduled ON registry_followup(tenant_id, completed_ts NULLS FIRST, scheduled_date)');
    }
  },
  {
    version: 10,
    description: 'Seed follow-ups for existing registry items with dominant drivers',
    async run(client) {
      // Get all registry items that have a dominant driver and protocol card
      const items = await client.query(`
        SELECT link, tenant_id, urgency, dominant_driver, created_date
        FROM stability_registry
        WHERE dominant_driver IS NOT NULL AND protocol_card IS NOT NULL
      `);

      for (const item of items.rows) {
        let schedule;
        if (item.urgency === 'SENTINEL') {
          // 48h, then weekly x3
          schedule = [
            { type: '48h', offset: 2 },
            { type: 'weekly', offset: 9 },
            { type: 'weekly', offset: 16 },
            { type: 'weekly', offset: 23 }
          ];
        } else if (item.urgency === 'RED') {
          // weekly x4, then 4wk, 8wk
          schedule = [
            { type: 'weekly', offset: 7 },
            { type: 'weekly', offset: 14 },
            { type: 'weekly', offset: 21 },
            { type: 'weekly', offset: 28 },
            { type: '4wk', offset: 56 },
            { type: '8wk', offset: 84 }
          ];
        } else {
          // Yellow/Orange: 2wk, 4wk, 8wk
          schedule = [
            { type: '2wk', offset: 14 },
            { type: '4wk', offset: 28 },
            { type: '8wk', offset: 56 }
          ];
        }

        for (const s of schedule) {
          await client.query(`
            INSERT INTO registry_followup (registry_link, tenant_id, followup_type, scheduled_date)
            VALUES ($1, $2, $3, $4)
          `, [item.link, item.tenant_id, s.type, item.created_date + s.offset]);
        }
      }
    }
  },
  {
    version: 11,
    description: 'Add pattern-based trigger signal types, promotions, and rules',
    async run(client) {
      const TENANT = 5;

      // 1. Add PROTECTIVE_COLLAPSE signal type (PPII_TREND_UP and PPII_SPIKE already exist)
      await client.query(`
        INSERT INTO signal_type (tenant_id, signal_code, signal_name, description)
        VALUES ($1, 'PROTECTIVE_COLLAPSE', 'Protective Factor Collapse', 'Isolation, Recovery, and Purpose domains all declining over consecutive surveys')
        ON CONFLICT (tenant_id, signal_code) DO NOTHING
      `, [TENANT]);

      // 2. Get SR_YELLOW action_id (pattern triggers create Yellow-urgency items)
      const eraResult = await client.query(`SELECT action_id FROM external_result_action WHERE tenant_id = $1 AND action_code = 'SR_YELLOW'`, [TENANT]);
      const srYellowId = eraResult.rows[0].action_id;

      // 3. Create rules, promotions, and results for each pattern signal
      const patterns = [
        { signal: 'PPII_TREND_UP', code: 'TREND_UP_ALERT', name: 'PPII Trend Up — Registry Alert', desc: 'PPII rising for 3+ consecutive periods' },
        { signal: 'PPII_SPIKE', code: 'SPIKE_ALERT', name: 'PPII Spike — Registry Alert', desc: 'PPII jumped 15+ points in one period' },
        { signal: 'PROTECTIVE_COLLAPSE', code: 'PROTECT_ALERT', name: 'Protective Collapse — Registry Alert', desc: 'Isolation, Recovery, Purpose all worsening' },
      ];

      for (const p of patterns) {
        // Check if promotion already exists
        const existing = await client.query(`SELECT 1 FROM promotion WHERE tenant_id = $1 AND promotion_code = $2`, [TENANT, p.code]);
        if (existing.rows.length > 0) continue;

        // Create rule
        const ruleResult = await client.query(`
          INSERT INTO rule DEFAULT VALUES RETURNING rule_id
        `);
        const ruleId = ruleResult.rows[0].rule_id;

        // Create rule criteria: SIGNAL equals pattern signal
        await client.query(`
          INSERT INTO rule_criteria (rule_id, molecule_key, operator, value, label, sort_order)
          VALUES ($1, 'SIGNAL', 'equals', $2, $3, 1)
        `, [ruleId, JSON.stringify(p.signal), `Signal = ${p.signal}`]);

        // Create promotion
        const promoResult = await client.query(`
          INSERT INTO promotion (tenant_id, promotion_code, promotion_name, start_date, end_date, is_active, enrollment_type, count_type, goal_amount, reward_type)
          VALUES ($1, $2, $3, '2026-01-01', '2099-12-31', true, 'A', 'activities', 1, 'external')
          RETURNING promotion_id
        `, [TENANT, p.code, p.name]);
        const promoId = promoResult.rows[0].promotion_id;

        // Link rule to promotion
        await client.query(`UPDATE promotion SET rule_id = $1 WHERE promotion_id = $2`, [ruleId, promoId]);

        // Create promotion result → SR_YELLOW external action
        await client.query(`
          INSERT INTO promotion_result (promotion_id, tenant_id, result_type, result_description, result_reference_id, sort_order)
          VALUES ($1, $2, 'external', $3, $4, 1)
        `, [promoId, TENANT, p.desc, srYellowId]);
      }
    }
  },
  {
    version: 12,
    description: 'Seed pattern-triggered registry items for demo',
    async run(client) {
      const TENANT = 5;

      // Get member links for physicians we want to add pattern items to
      const members = await client.query(`
        SELECT link, membership_number, fname FROM member WHERE tenant_id = $1 AND fname IN ('Elena', 'Robert', 'Patricia')
      `, [TENANT]);

      const memberMap = {};
      for (const m of members.rows) memberMap[m.fname] = m;

      // Get today's Bill epoch
      const epoch = new Date(1959, 11, 3);
      const today = Math.floor((Date.now() - epoch.getTime()) / (24 * 60 * 60 * 1000)) - 32768;

      const items = [
        // Elena Vasquez — PPII trending up over 3 weeks
        { member: 'Elena', urgency: 'YELLOW', reason: 'PPII_TREND_UP', text: 'PPII rising for 3 consecutive periods (22 → 28 → 33)', driver: 'PPSI', subdomain: 'BURNOUT', card: 'A2', daysAgo: 3 },
        // Robert Holmberg — PPII spike
        { member: 'Robert', urgency: 'YELLOW', reason: 'PPII_SPIKE', text: 'PPII jumped 18 points in one period (threshold: 15)', driver: 'EVENTS', subdomain: null, card: 'D', daysAgo: 5 },
        // Patricia Walsh — Protective collapse
        { member: 'Patricia', urgency: 'YELLOW', reason: 'PROTECTIVE_COLLAPSE', text: 'Isolation, Recovery, and Purpose scores all worsening over 2 consecutive surveys', driver: 'PPSI', subdomain: 'ISOLATION', card: 'A4', daysAgo: 2 },
      ];

      for (const item of items) {
        const m = memberMap[item.member];
        if (!m) continue;

        // Get next link from link_tank
        const linkResult = await client.query(`UPDATE link_tank SET next_link = next_link + 1 WHERE tenant_id = 0 AND table_key = 'stability_registry' RETURNING next_link - 1 as link`);
        const link = parseInt(linkResult.rows[0].link);
        const createdDate = today - item.daysAgo;
        const slaDeadline = `NOW() - INTERVAL '${item.daysAgo} days' + INTERVAL '72 hours'`;

        await client.query(`
          INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, sla_hours, sla_deadline, created_date, created_ts, status, dominant_driver, dominant_subdomain, protocol_card)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 72, NOW() - INTERVAL '${item.daysAgo} days' + INTERVAL '72 hours', $8, NOW() - INTERVAL '${item.daysAgo} days', 'O', $9, $10, $11)
        `, [link, m.link, TENANT, item.urgency, item.driver, item.reason, item.text, createdDate, item.driver, item.subdomain, item.card]);

        // Schedule follow-ups (Yellow = 2wk, 4wk, 8wk)
        const fuSchedule = [
          { type: '2wk', offset: 14 },
          { type: '4wk', offset: 28 },
          { type: '8wk', offset: 56 }
        ];
        for (const s of fuSchedule) {
          await client.query(`
            INSERT INTO registry_followup (registry_link, tenant_id, followup_type, scheduled_date)
            VALUES ($1, $2, $3, $4)
          `, [link, TENANT, s.type, createdDate + s.offset]);
        }
      }
    }
  },
  {
    version: 13,
    description: 'Create physician_annotation table for score feedback',
    async run(client) {
      await client.query(`
        CREATE TABLE physician_annotation (
          annotation_id SERIAL PRIMARY KEY,
          member_link CHARACTER(5) NOT NULL REFERENCES member(link),
          tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          annotation_date SMALLINT NOT NULL,
          annotation_text TEXT NOT NULL,
          created_by_member BOOLEAN NOT NULL DEFAULT TRUE,
          created_by_user_id INTEGER REFERENCES platform_user(user_id),
          created_ts TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await client.query('CREATE INDEX idx_annotation_member ON physician_annotation(member_link, annotation_date DESC)');
      await client.query('CREATE INDEX idx_annotation_tenant ON physician_annotation(tenant_id, created_ts DESC)');
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
