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
import { getNextLink } from './get_next_link.js';

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
const TARGET_VERSION = 64;

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
  },
  {
    version: 14,
    description: 'Create notification_rule table for event-to-recipient routing',
    async run(client) {
      await client.query(`
        CREATE TABLE notification_rule (
          rule_id SERIAL PRIMARY KEY,
          tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          event_type VARCHAR(30) NOT NULL,
          recipient_type VARCHAR(20) NOT NULL,
          recipient_role VARCHAR(30),
          notify_member BOOLEAN NOT NULL DEFAULT FALSE,
          severity VARCHAR(10) NOT NULL DEFAULT 'info',
          title_template VARCHAR(200) NOT NULL,
          body_template TEXT,
          timing_offset_hours INTEGER NOT NULL DEFAULT 0,
          repeat_hours INTEGER,
          repeat_count SMALLINT DEFAULT 1,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          CONSTRAINT nr_severity_check CHECK (severity IN ('critical','warning','info')),
          CONSTRAINT nr_recipient_type_check CHECK (recipient_type IN ('role','member','all_clinical'))
        )
      `);
      await client.query('CREATE INDEX idx_notif_rule_event ON notification_rule(tenant_id, event_type, is_active)');

      // Add delivery channel columns to notification table
      await client.query('ALTER TABLE notification ADD COLUMN IF NOT EXISTS channel VARCHAR(10) DEFAULT \'in_app\'');
      await client.query('ALTER TABLE notification ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(15) DEFAULT \'delivered\'');
      await client.query('ALTER TABLE notification ADD COLUMN IF NOT EXISTS member_link CHARACTER(5)');
      await client.query('ALTER TABLE notification ADD COLUMN IF NOT EXISTS batch_id INTEGER');
      await client.query('ALTER TABLE notification ADD COLUMN IF NOT EXISTS event_type VARCHAR(30)');
    }
  },
  {
    version: 15,
    description: 'Seed notification rules per Erica specifications (March 22, 2026)',
    async run(client) {
      const TENANT = 5;
      const rules = [
        // Drug test — positive/concerning → clinical-authority + case manager
        { event: 'DRUG_TEST_POSITIVE', recip: 'role', role: 'clinical-authority', severity: 'critical', title: 'Drug Test Alert', body: 'A positive or concerning drug test result requires review.', offset: 0 },
        { event: 'DRUG_TEST_POSITIVE', recip: 'role', role: 'case-manager', severity: 'critical', title: 'Drug Test Alert', body: 'A positive or concerning drug test result requires review.', offset: 0 },

        // Missed survey — physician only, 3 notifications (deadline, +24h, +48h)
        { event: 'SURVEY_MISSED', recip: 'member', role: null, severity: 'warning', title: 'Survey Reminder', body: 'Your weekly survey is due. Please complete it at your earliest convenience.', offset: 0, member: true },
        { event: 'SURVEY_MISSED', recip: 'member', role: null, severity: 'warning', title: 'Survey Overdue', body: 'Your weekly survey is now 24 hours overdue.', offset: 24, member: true },
        { event: 'SURVEY_MISSED', recip: 'member', role: null, severity: 'warning', title: 'Survey Overdue — 48 Hours', body: 'Your weekly survey is now 48 hours overdue. Please complete it immediately.', offset: 48, member: true },

        // P5 Safety Concern → ALL clinical staff
        { event: 'P5_SAFETY', recip: 'all_clinical', role: null, severity: 'critical', title: 'P5 Safety Concern', body: 'A P5 safety concern has been identified. Immediate review required.', offset: 0 },

        // Compliance deadline approaching → physician only (3 days before + day-of)
        { event: 'COMPLIANCE_DEADLINE', recip: 'member', role: null, severity: 'info', title: 'Compliance Deadline Approaching', body: 'A compliance item is due in 3 days.', offset: -72, member: true },
        { event: 'COMPLIANCE_DEADLINE', recip: 'member', role: null, severity: 'warning', title: 'Compliance Deadline Today', body: 'A compliance item is due today.', offset: 0, member: true },

        // MEDS escalation → clinical staff
        { event: 'MEDS_ALERT', recip: 'all_clinical', role: null, severity: 'critical', title: 'MEDS Alert', body: 'Missing event detection has triggered an escalation.', offset: 0 },

        // Randomized drug test assignment → physician
        { event: 'DRUG_TEST_ASSIGNED', recip: 'member', role: null, severity: 'info', title: 'Drug Test Notification', body: 'You have been selected for a drug test. Please report as instructed.', offset: 0, member: true },

        // Registry item created → assigned clinical authority
        { event: 'REGISTRY_CREATED', recip: 'role', role: 'clinical-authority', severity: 'warning', title: 'New Registry Item', body: 'A new stability registry item has been created and requires attention.', offset: 0 },

        // Follow-up overdue → assigned clinical authority
        { event: 'FOLLOWUP_OVERDUE', recip: 'role', role: 'clinical-authority', severity: 'warning', title: 'Follow-up Overdue', body: 'A scheduled follow-up check is overdue.', offset: 0 },
      ];

      for (const r of rules) {
        await client.query(`
          INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role, notify_member, severity, title_template, body_template, timing_offset_hours, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        `, [TENANT, r.event, r.recip, r.role || null, r.member || false, r.severity, r.title, r.body || null, r.offset]);
      }
    }
  },
  {
    version: 16,
    description: 'Add member_label sysparm for configurable member terminology',
    async run(client) {
      const TENANT = 5;
      // Create sysparm entry
      const spResult = await client.query(`
        INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
        VALUES ($1, 'member_label', 'text', 'Display label for members (e.g., Physician, First Responder, Nurse)')
        ON CONFLICT (tenant_id, sysparm_key) DO NOTHING
        RETURNING sysparm_id
      `, [TENANT]);

      if (spResult.rows.length) {
        await client.query(`
          INSERT INTO sysparm_detail (sysparm_id, value)
          VALUES ($1, 'Physician')
        `, [spResult.rows[0].sysparm_id]);
      }

      // Also add plural form
      const spResult2 = await client.query(`
        INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
        VALUES ($1, 'member_label_plural', 'text', 'Plural display label for members (e.g., Physicians, First Responders, Nurses)')
        ON CONFLICT (tenant_id, sysparm_key) DO NOTHING
        RETURNING sysparm_id
      `, [TENANT]);

      if (spResult2.rows.length) {
        await client.query(`
          INSERT INTO sysparm_detail (sysparm_id, value)
          VALUES ($1, 'Physicians')
        `, [spResult2.rows[0].sysparm_id]);
      }
    }
  },
  {
    version: 17,
    description: 'Create IS_CLINICIAN and ASSIGNED_CLINICIAN molecule definitions',
    async run(client) {
      const TENANT = 5;

      // IS_CLINICIAN — presence-based boolean (storage_size=0, stored in 5_data_0)
      await client.query(`
        INSERT INTO molecule_def (molecule_key, label, value_kind, scalar_type, tenant_id, context, attaches_to, storage_size, value_type, description, is_static, molecule_type)
        VALUES ('IS_CLINICIAN', 'Clinician', 'value', NULL, $1, 'member', 'M', 0, NULL, 'Presence indicates this member is a clinician, not a monitored physician', true, 'D')
        ON CONFLICT (tenant_id, molecule_key) DO NOTHING
      `, [TENANT]);

      // ASSIGNED_CLINICIAN — link to clinician member record (storage_size=5, stored in 5_data_5)
      await client.query(`
        INSERT INTO molecule_def (molecule_key, label, value_kind, scalar_type, tenant_id, context, attaches_to, storage_size, value_type, description, is_static, molecule_type)
        VALUES ('ASSIGNED_CLINICIAN', 'Assigned Clinician', 'value', NULL, $1, 'member', 'M', 5, 'link', 'Link to clinician member record. Multiple allowed per physician.', true, 'D')
        ON CONFLICT (tenant_id, molecule_key) DO NOTHING
      `, [TENANT]);
    }
  },
  {
    version: 18,
    description: 'Seed test clinician members and assign to physicians',
    async run(client) {
      const TENANT = 5;

      // Base-127 squish function (same as pointers.js)
      function squish(value, bytes) {
        const chars = [];
        let remaining = value;
        for (let i = 0; i < bytes; i++) {
          chars.unshift(String.fromCharCode((remaining % 127) + 1));
          remaining = Math.floor(remaining / 127);
        }
        return chars.join('');
      }

      // Get the IS_CLINICIAN and ASSIGNED_CLINICIAN molecule IDs
      const isClinRes = await client.query(`SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'IS_CLINICIAN'`, [TENANT]);
      const assignRes = await client.query(`SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'ASSIGNED_CLINICIAN'`, [TENANT]);
      if (!isClinRes.rows.length || !assignRes.rows.length) throw new Error('Clinician molecules not found');
      const IS_CLINICIAN_MOL = isClinRes.rows[0].molecule_id;
      const ASSIGNED_CLINICIAN_MOL = assignRes.rows[0].molecule_id;

      // Get PARTNER_PROGRAM molecule ID for clinic assignment
      const ppRes = await client.query(`SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'PARTNER_PROGRAM'`, [TENANT]);
      const PP_MOL = ppRes.rows[0].molecule_id;

      // Get the clinic assignment from an existing physician
      const clinicRef = await client.query(`
        SELECT d22.n1, d22.n2 FROM "5_data_22" d22
        JOIN member m ON m.link = d22.p_link
        WHERE d22.molecule_id = $1 AND d22.attaches_to = 'M' AND m.tenant_id = $2
        LIMIT 1
      `, [PP_MOL, TENANT]);

      // Create two test clinicians
      const clinicians = [
        { fname: 'Sarah', lname: 'Mitchell', title: 'Dr.', email: 'sarah.mitchell@wiphp.org', membership_number: '101' },
        { fname: 'David', lname: 'Chen', title: 'Dr.', email: 'david.chen@wiphp.org', membership_number: '102' }
      ];

      const epoch = new Date(1959, 11, 3);
      const today = Math.floor((Date.now() - epoch.getTime()) / (24 * 60 * 60 * 1000)) - 32768;

      const clinicianLinks = [];
      for (const c of clinicians) {
        // Get next member link via link_tank, then squish to 5-byte base-127
        const linkResult = await client.query(`UPDATE link_tank SET next_link = next_link + 1 WHERE tenant_id = $1 AND table_key = 'member' RETURNING next_link - 1 as link, link_bytes`, [TENANT]);
        const linkNum = Number(linkResult.rows[0].link);
        const linkBytes = linkResult.rows[0].link_bytes;
        const memberLink = squish(linkNum, linkBytes);

        // Insert member record
        await client.query(`
          INSERT INTO member (link, tenant_id, fname, lname, title, email, membership_number, enroll_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [memberLink, TENANT, c.fname, c.lname, c.title, c.email, c.membership_number, today]);

        // Set IS_CLINICIAN molecule (presence in 5_data_0)
        await client.query(`
          INSERT INTO "5_data_0" (p_link, molecule_id, attaches_to)
          VALUES ($1, $2, 'M')
        `, [memberLink, IS_CLINICIAN_MOL]);

        // Assign to same clinic as physicians
        if (clinicRef.rows.length) {
          await client.query(`
            INSERT INTO "5_data_22" (p_link, molecule_id, attaches_to, n1, n2)
            VALUES ($1, $2, 'M', $3, $4)
          `, [memberLink, PP_MOL, clinicRef.rows[0].n1, clinicRef.rows[0].n2]);
        }

        clinicianLinks.push(memberLink);
      }

      // Assign physicians to clinicians
      const mitchell = clinicianLinks[0];
      const chen = clinicianLinks[1];

      const mitchellPhysicians = await client.query(`SELECT link FROM member WHERE tenant_id = $1 AND lname IN ('Walsh','Vasquez','Holmberg','Ostrowski')`, [TENANT]);
      const chenPhysicians = await client.query(`SELECT link FROM member WHERE tenant_id = $1 AND lname IN ('Reed','Nguyen','Okafor','Jansen')`, [TENANT]);

      for (const p of mitchellPhysicians.rows) {
        await client.query(`
          INSERT INTO "5_data_5" (p_link, molecule_id, c1, attaches_to)
          VALUES ($1, $2, $3, 'M')
        `, [p.link, ASSIGNED_CLINICIAN_MOL, mitchell]);
      }

      for (const p of chenPhysicians.rows) {
        await client.query(`
          INSERT INTO "5_data_5" (p_link, molecule_id, c1, attaches_to)
          VALUES ($1, $2, $3, 'M')
        `, [p.link, ASSIGNED_CLINICIAN_MOL, chen]);
      }
    }
  },
  {
    version: 19,
    description: 'Fix clinician test data — remove Dr. title (clinicians are case managers, not doctors)',
    async run(client) {
      await client.query(`UPDATE member SET title = NULL WHERE membership_number IN ('101','102') AND tenant_id = 5`);
    }
  },
  {
    version: 20,
    description: 'Convergent Validation Anchor Battery — 6 instruments (PROMIS Sleep 8a, Stanford PFI, Mini-Z, UCLA-3, CFQ, CGI-S)',
    async run(client) {
      const T = 5; // tenant_id

      // --- New question categories for anchor instruments ---
      // Reuse existing: SLEEP(1), BURNOUT(2), ISOLATION(4), COGNITIVE(5), RECOVERY(6), PURPOSE(7), PROVIDER(12)
      // New categories needed for PFI subscales and Mini-Z subscales
      const newCats = [
        { link: 13, code: 'PFI_FULFILL',   name: 'Professional Fulfillment (PFI)' },
        { link: 14, code: 'PFI_EXHAUST',   name: 'Work Exhaustion (PFI)' },
        { link: 15, code: 'PFI_DISENGAGE', name: 'Interpersonal Disengagement (PFI)' },
        { link: 16, code: 'MINIZ_WORK_ENV', name: 'Supportive Work Environment (Mini-Z)' },
        { link: 17, code: 'MINIZ_BURNOUT', name: 'Burnout Self-Classification (Mini-Z)' },
        { link: 18, code: 'MINIZ_PACE',    name: 'Work Pace / EMR Stress (Mini-Z)' },
        { link: 19, code: 'CGIS',          name: 'Clinical Global Impression — Severity' }
      ];
      for (const c of newCats) {
        await client.query(
          `INSERT INTO survey_question_category (link, tenant_id, category_code, category_name, status) VALUES ($1,$2,$3,$4,'A')`,
          [c.link, T, c.code, c.name]
        );
      }

      // --- 6 new surveys ---
      const surveys = [
        { link: 3,  code: 'PROMIS8A',  name: 'PROMIS Sleep Disturbance 8a',          resp: 'S', score: 'scorePromis8a.js',   cadence: 30 },
        { link: 4,  code: 'PFI',       name: 'Stanford Professional Fulfillment Index', resp: 'S', score: 'scoreStanfordPFI.js', cadence: 30 },
        { link: 5,  code: 'MINIZ',     name: 'Mini-Z Burnout and Worklife Survey',    resp: 'S', score: 'scoreMiniZ.js',     cadence: 30 },
        { link: 6,  code: 'UCLA3',     name: 'UCLA Loneliness Scale (3-Item)',         resp: 'S', score: 'scoreUCLA3.js',     cadence: 30 },
        { link: 7,  code: 'CFQ8',      name: 'Cognitive Failures Questionnaire (8-Item)', resp: 'S', score: 'scoreCFQ.js',   cadence: 30 },
        { link: 8,  code: 'CGIS',      name: 'Clinical Global Impression — Severity',  resp: 'C', score: 'scoreCGIS.js',     cadence: 30 }
      ];
      for (const s of surveys) {
        await client.query(
          `INSERT INTO survey (link, tenant_id, survey_code, survey_name, respondent_type, status, score_function, cadence_days)
           VALUES ($1,$2,$3,$4,$5,'A',$6,$7)`,
          [s.link, T, s.code, s.name, s.resp, s.score, s.cadence]
        );
      }

      // Helper: insert question + answers + question_list entry
      let qLink = 49;   // next after existing max (48)
      let aLink = 193;   // next after existing max (192)
      let qlLink = 49;   // next after existing max (48)

      async function addQ(surveyLink, catLink, questionText, answerOptions, displayOrder) {
        const thisQ = qLink++;
        await client.query(
          `INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status)
           VALUES ($1,$2,$3,$4,true,false,'A')`,
          [thisQ, T, catLink, questionText]
        );
        for (let i = 0; i < answerOptions.length; i++) {
          const ao = answerOptions[i];
          await client.query(
            `INSERT INTO survey_question_answer (link, question_link, answer_text, answer_value, display_order, status)
             VALUES ($1,$2,$3,$4,$5,'A')`,
            [aLink++, thisQ, ao.text, ao.value, i + 1]
          );
        }
        await client.query(
          `INSERT INTO survey_question_list (link, tenant_id, survey_link, question_link, display_order, status)
           VALUES ($1,$2,$3,$4,$5,'A')`,
          [qlLink++, T, surveyLink, thisQ, displayOrder]
        );
      }

      // =============================
      // INSTRUMENT 1: PROMIS Sleep 8a (survey link 3, category SLEEP = 1)
      // =============================
      const promisScale1 = [
        { text: 'Very poor', value: 1 }, { text: 'Poor', value: 2 }, { text: 'Fair', value: 3 },
        { text: 'Good', value: 4 }, { text: 'Very good', value: 5 }
      ];
      const promisScale2 = [
        { text: 'Not at all', value: 5 }, { text: 'A little bit', value: 4 }, { text: 'Somewhat', value: 3 },
        { text: 'Quite a bit', value: 2 }, { text: 'Very much', value: 1 }
      ];
      // Items 2 and 8 are reverse-scored (favorable wording) — higher value = better sleep
      const promisScale2Rev = [
        { text: 'Not at all', value: 1 }, { text: 'A little bit', value: 2 }, { text: 'Somewhat', value: 3 },
        { text: 'Quite a bit', value: 4 }, { text: 'Very much', value: 5 }
      ];

      await addQ(3, 1, 'My sleep quality was...', promisScale1, 1);
      await addQ(3, 1, 'My sleep was refreshing', promisScale2Rev, 2);
      await addQ(3, 1, 'I had a problem with my sleep', promisScale2, 3);
      await addQ(3, 1, 'I had difficulty falling asleep', promisScale2, 4);
      await addQ(3, 1, 'My sleep was restless', promisScale2, 5);
      await addQ(3, 1, 'I tried hard to get to sleep', promisScale2, 6);
      await addQ(3, 1, 'I worried about not being able to fall asleep', promisScale2, 7);
      await addQ(3, 1, 'I was satisfied with my sleep', promisScale2Rev, 8);

      // =============================
      // INSTRUMENT 2: Stanford PFI (survey link 4)
      // =============================
      const pfiScale04 = [
        { text: 'Not at all true', value: 0 }, { text: 'Somewhat true', value: 1 },
        { text: 'Moderately true', value: 2 }, { text: 'Very true', value: 3 },
        { text: 'Completely true', value: 4 }
      ];
      const pfiScaleExhaust = [
        { text: 'Not at all', value: 0 }, { text: 'Slightly', value: 1 },
        { text: 'Moderately', value: 2 }, { text: 'Very much', value: 3 },
        { text: 'Extremely', value: 4 }
      ];

      // Professional Fulfillment (items 1-6) — cat 13
      const pfiFulfillItems = [
        'I feel happy at work',
        'I feel worthwhile at work',
        'My work is satisfying to me',
        'I feel in control when dealing with difficult problems at work',
        'My work is meaningful to me',
        'I feel connected to my work'
      ];
      for (let i = 0; i < pfiFulfillItems.length; i++) {
        await addQ(4, 13, pfiFulfillItems[i], pfiScale04, i + 1);
      }

      // Work Exhaustion (items 7-10) — cat 14
      const pfiExhaustItems = [
        'I feel physically exhausted at work',
        'I feel emotionally exhausted at work',
        'I feel worn out at work',
        'I feel burned out from work'
      ];
      for (let i = 0; i < pfiExhaustItems.length; i++) {
        await addQ(4, 14, pfiExhaustItems[i], pfiScaleExhaust, 7 + i);
      }

      // Interpersonal Disengagement (items 11-16) — cat 15
      const pfiDisengageItems = [
        'I have become less interested in interacting with patients',
        'I have become less interested in interacting with colleagues',
        'I have become more callous toward people since I took this job',
        'I worry that this job is hardening me emotionally',
        'I feel less empathetic with my patients',
        'I have become distant from my patients'
      ];
      for (let i = 0; i < pfiDisengageItems.length; i++) {
        await addQ(4, 15, pfiDisengageItems[i], pfiScaleExhaust, 11 + i);
      }

      // =============================
      // INSTRUMENT 3: Mini-Z (survey link 5)
      // =============================
      const agreeScale = [
        { text: 'Strongly agree', value: 1 }, { text: 'Agree', value: 2 },
        { text: 'Neutral', value: 3 }, { text: 'Disagree', value: 4 },
        { text: 'Strongly disagree', value: 5 }
      ];
      const poorOptimal = [
        { text: 'Poor', value: 1 }, { text: 'Below average', value: 2 },
        { text: 'Average', value: 3 }, { text: 'Good', value: 4 },
        { text: 'Optimal', value: 5 }
      ];
      const burnoutScale = [
        { text: 'I enjoy my work, no symptoms', value: 1 },
        { text: 'Under stress but not burned out', value: 2 },
        { text: 'Definitely burning out, e.g. emotional exhaustion', value: 3 },
        { text: 'Symptoms won\'t go away, think about frustrations a lot', value: 4 },
        { text: 'Completely burned out, may need help', value: 5 }
      ];
      const calmChaotic = [
        { text: 'Calm', value: 1 }, { text: 'Somewhat calm', value: 2 },
        { text: 'Average', value: 3 }, { text: 'Somewhat chaotic', value: 4 },
        { text: 'Hectic/chaotic', value: 5 }
      ];
      const excessiveMinimal = [
        { text: 'Excessive', value: 1 }, { text: 'High', value: 2 },
        { text: 'Average', value: 3 }, { text: 'Low', value: 4 },
        { text: 'Minimal/none', value: 5 }
      ];

      // Supportive Work Environment (items 1-2) — cat 16
      await addQ(5, 16, 'Overall, I am satisfied with my current job', agreeScale, 1);
      await addQ(5, 16, 'I feel a great deal of stress because of my job', agreeScale, 2);

      // Burnout self-classification (item 3) — cat 17
      await addQ(5, 17, 'Using your own definition of burnout, please select one:', burnoutScale, 3);

      // Supportive Work Environment (items 4-5) — cat 16
      await addQ(5, 16, 'My control over my workload is:', poorOptimal, 4);
      await addQ(5, 16, 'Sufficiency of time for completing my work is:', poorOptimal, 5);

      // Work Pace / EMR Stress (items 6-10) — cat 18
      await addQ(5, 18, 'Which number best describes the atmosphere in your primary work area?', calmChaotic, 6);
      await addQ(5, 18, 'My professional values are well aligned with those of my direct leaders', agreeScale, 7);
      await addQ(5, 18, 'The degree to which my care team works efficiently together is:', poorOptimal, 8);
      await addQ(5, 18, 'The amount of time I spend on work at home is:', excessiveMinimal, 9);
      await addQ(5, 18, 'My work day is mainly frustrating', agreeScale, 10);

      // =============================
      // INSTRUMENT 4: UCLA-3 (survey link 6, category ISOLATION = 4)
      // =============================
      const uclaScale = [
        { text: 'Hardly ever', value: 1 }, { text: 'Some of the time', value: 2 },
        { text: 'Often', value: 3 }
      ];

      await addQ(6, 4, 'How often do you feel that you lack companionship?', uclaScale, 1);
      await addQ(6, 4, 'How often do you feel left out?', uclaScale, 2);
      await addQ(6, 4, 'How often do you feel isolated from others?', uclaScale, 3);

      // =============================
      // INSTRUMENT 5: CFQ Selected (survey link 7, category COGNITIVE = 5)
      // =============================
      const cfqScale = [
        { text: 'Never', value: 0 }, { text: 'Very rarely', value: 1 },
        { text: 'Occasionally', value: 2 }, { text: 'Quite often', value: 3 },
        { text: 'Very often', value: 4 }
      ];

      await addQ(7, 5, 'Do you read something and find you haven\'t been thinking about it and must read it again?', cfqScale, 1);
      await addQ(7, 5, 'Do you fail to hear people speaking to you when you are doing something else?', cfqScale, 2);
      await addQ(7, 5, 'Do you have trouble making up your mind?', cfqScale, 3);
      await addQ(7, 5, 'Do you find you forget appointments?', cfqScale, 4);
      await addQ(7, 5, 'Do you find you forget where you put something like a newspaper or a book?', cfqScale, 5);
      await addQ(7, 5, 'Do you daydream when you ought to be listening to something?', cfqScale, 6);
      await addQ(7, 5, 'Do you find you forget people\'s names?', cfqScale, 7);
      await addQ(7, 5, 'Do you start doing one thing at home and get distracted into doing something else unintentionally?', cfqScale, 8);

      // =============================
      // INSTRUMENT 6: CGI-S (survey link 8, category CGIS = 19)
      // =============================
      const cgisScale = [
        { text: 'Normal, not at all unstable', value: 1 },
        { text: 'Borderline concern', value: 2 },
        { text: 'Mildly unstable', value: 3 },
        { text: 'Moderately unstable', value: 4 },
        { text: 'Markedly unstable', value: 5 },
        { text: 'Severely unstable', value: 6 },
        { text: 'Among the most extremely unstable', value: 7 }
      ];

      await addQ(8, 19, 'Considering your total clinical experience with this physician participant, how would you rate their current overall stability?', cgisScale, 1);
    }
  },

  // ==========================================
  // v21 — Batch Runner: job registry + run log
  // ==========================================
  {
    version: 21,
    description: 'Scheduled jobs core — scheduled_job registry and scheduled_job_log tables',
    async run(client) {
      // Clean up if batch_job tables exist from earlier version of this migration
      await client.query('DROP TABLE IF EXISTS batch_job_log');
      await client.query('DROP TABLE IF EXISTS batch_job');

      // scheduled_job: registered jobs per tenant
      await client.query(`
        CREATE TABLE scheduled_job (
          scheduled_job_id SERIAL PRIMARY KEY,
          tenant_id       SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          job_code        VARCHAR(30) NOT NULL,
          job_name        VARCHAR(100) NOT NULL,
          job_description VARCHAR(500),
          interval_minutes INTEGER NOT NULL DEFAULT 1440,
          is_active       BOOLEAN NOT NULL DEFAULT TRUE,
          last_run_at     TIMESTAMPTZ,
          next_run_at     TIMESTAMPTZ,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(tenant_id, job_code)
        )
      `);
      await client.query('CREATE INDEX idx_scheduled_job_tenant ON scheduled_job(tenant_id, is_active)');
      await client.query('CREATE INDEX idx_scheduled_job_next_run ON scheduled_job(next_run_at) WHERE is_active = TRUE');

      // scheduled_job_log: one row per run
      await client.query(`
        CREATE TABLE scheduled_job_log (
          log_id            SERIAL PRIMARY KEY,
          scheduled_job_id  INTEGER NOT NULL REFERENCES scheduled_job(scheduled_job_id),
          tenant_id         SMALLINT NOT NULL,
          run_source        VARCHAR(20) NOT NULL DEFAULT 'daily',
          started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          finished_at       TIMESTAMPTZ,
          records_analyzed  INTEGER DEFAULT 0,
          records_processed INTEGER DEFAULT 0,
          items_flagged     INTEGER DEFAULT 0,
          status            VARCHAR(10) NOT NULL DEFAULT 'running',
          error_message     TEXT
        )
      `);
      await client.query('CREATE INDEX idx_scheduled_job_log_job ON scheduled_job_log(scheduled_job_id, started_at DESC)');
      await client.query('CREATE INDEX idx_scheduled_job_log_tenant ON scheduled_job_log(tenant_id, started_at DESC)');
    }
  },
  {
    version: 22,
    description: 'MEDS — add meds_next_due to member, register MEDS job for Insight tenant',
    async run(client) {
      // Add meds_next_due column — SMALLINT Bill epoch, default 2137 sentinel (far future = nothing due)
      const sentinel2137 = (() => {
        const epoch = new Date(1959, 11, 3);
        const target = new Date(2137, 0, 1);
        const days = Math.floor((target - epoch) / (1000 * 60 * 60 * 24));
        return days - 32768; // Bill epoch offset
      })();

      await client.query(`ALTER TABLE member ADD COLUMN IF NOT EXISTS meds_next_due SMALLINT NOT NULL DEFAULT ${sentinel2137}`);
      await client.query('CREATE INDEX IF NOT EXISTS idx_member_meds_next_due ON member(tenant_id, meds_next_due)');

      // Register MEDS as first scheduled job for Insight (tenant 5)
      await client.query(`
        INSERT INTO scheduled_job (tenant_id, job_code, job_name, job_description, interval_minutes, is_active)
        VALUES (5, 'MEDS', 'Missing Event Detection', 'Scans members for overdue surveys and compliance items. Fires notifications and creates registry items for consecutive misses.', 1440, TRUE)
        ON CONFLICT (tenant_id, job_code) DO NOTHING
      `);
    }
  },
  {
    version: 23,
    description: 'MEDS notification rules — survey overdue, compliance overdue, consecutive miss',
    async run(client) {
      const T = 5;
      const rules = [
        // Survey overdue → assigned clinician
        { event: 'MEDS_SURVEY_OVERDUE', recip: 'role', role: 'clinician', severity: 'warning',
          title: 'Overdue Assessment', body: 'A scheduled assessment has not been completed.' },
        // Compliance overdue → assigned clinician
        { event: 'MEDS_COMPLIANCE_OVERDUE', recip: 'role', role: 'clinician', severity: 'warning',
          title: 'Overdue Compliance Item', body: 'A compliance item has not been completed by its due date.' },
        // Consecutive misses → all clinical staff (escalation)
        { event: 'MEDS_CONSECUTIVE_MISS', recip: 'all_clinical', role: null, severity: 'critical',
          title: 'Consecutive Missed Events', body: 'A member has 3 or more consecutive missed events. Immediate attention required.' },
      ];

      for (const r of rules) {
        await client.query(`
          INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role, notify_member, severity, title_template, body_template, timing_offset_hours, is_active)
          VALUES ($1, $2, $3, $4, false, $5, $6, $7, 0, true)
        `, [T, r.event, r.recip, r.role, r.severity, r.title, r.body]);
      }
    }
  },
  {
    version: 24,
    description: 'Add preferred_start_time to scheduled_job for time-of-day scheduling',
    async run(client) {
      await client.query(`ALTER TABLE scheduled_job ADD COLUMN preferred_start_time TIME DEFAULT '06:00:00'`);
    }
  },
  {
    version: 27,
    description: 'Create ML_RISK_SCORE molecule (5_data_22: N1=risk score 0-100, N2=date Bill epoch). Written by ML predictive risk engine when score changes.',
    async run(client) {
      const existing = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = 5 AND molecule_key = 'ML_RISK_SCORE'`
      );
      if (existing.rows.length === 0) {
        // Create molecule from scratch (Heroku)
        await client.query(`
          INSERT INTO molecule_def (molecule_key, label, value_kind, scalar_type, tenant_id, context,
            is_static, is_permanent, is_required, is_active, description, molecule_id, decimal_places,
            can_be_promotion_counter, system_required, input_type, molecule_type, value_structure,
            storage_size, value_type, attaches_to)
          VALUES ('ML_RISK_SCORE', 'ML Predictive Risk Score', 'value', 'numeric', 5, 'member',
            false, false, false, true,
            'Predictive destabilization risk score from ML model (0-100). Written only when score changes. Multiple instances form trajectory.',
            133, 0, false, false, 'P', 'D', 'single', 22, 'numeric', 'M')
        `);
      } else {
        // Molecule exists (local) — clean up old 5_data_2 rows and fix storage_size
        await client.query(`DELETE FROM "5_data_2" WHERE molecule_id = 133`);
        await client.query(`UPDATE molecule_def SET storage_size = 22 WHERE molecule_id = 133`);
      }
    }
  },
  {
    version: 28,
    description: 'Ensure ML_RISK_SCORE molecule exists (fix: v27 ran before molecule creation was added to migration)',
    async run(client) {
      const existing = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = 5 AND molecule_key = 'ML_RISK_SCORE'`
      );
      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO molecule_def (molecule_key, label, value_kind, scalar_type, tenant_id, context,
            is_static, is_permanent, is_required, is_active, description, molecule_id, decimal_places,
            can_be_promotion_counter, system_required, input_type, molecule_type, value_structure,
            storage_size, value_type, attaches_to)
          VALUES ('ML_RISK_SCORE', 'ML Predictive Risk Score', 'value', 'numeric', 5, 'member',
            false, false, false, true,
            'Predictive destabilization risk score from ML model (0-100). Written only when score changes. Multiple instances form trajectory.',
            133, 0, false, false, 'P', 'D', 'single', 22, 'numeric', 'M')
        `);
      }
    }
  },
  {
    version: 29,
    description: 'Add ANCHOR_SURVEY to ACCRUAL_TYPE molecule values (fixes CGI-S and anchor battery submit failure)',
    async run(client) {
      // Get ACCRUAL_TYPE molecule_id for tenant 5
      const molResult = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = 5 AND molecule_key = 'ACCRUAL_TYPE'`
      );
      if (molResult.rows.length === 0) {
        console.log('  ⚠️ ACCRUAL_TYPE molecule not found — skipping');
        return;
      }
      const moleculeId = molResult.rows[0].molecule_id;

      // Check if ANCHOR_SURVEY already exists
      const existing = await client.query(
        `SELECT value_id FROM molecule_value_text WHERE molecule_id = $1 AND text_value = 'ANCHOR_SURVEY'`,
        [moleculeId]
      );
      if (existing.rows.length === 0) {
        // Find next value_id
        const maxResult = await client.query(
          `SELECT COALESCE(MAX(value_id), 0) as max_id FROM molecule_value_text WHERE molecule_id = $1`,
          [moleculeId]
        );
        const nextId = maxResult.rows[0].max_id + 1;
        await client.query(
          `INSERT INTO molecule_value_text (molecule_id, value_id, text_value) VALUES ($1, $2, 'ANCHOR_SURVEY')`,
          [moleculeId, nextId]
        );
        console.log(`  ✅ Added ANCHOR_SURVEY as value_id ${nextId} to ACCRUAL_TYPE molecule`);
      } else {
        console.log('  ⏭️ ANCHOR_SURVEY already exists in ACCRUAL_TYPE');
      }
    }
  },
  {
    version: 30,
    description: 'Extended protocol cards — EXTENDED_CARD molecule, promotion rules, stability_registry column',
    async run(client) {
      const TENANT = 5;

      // ── 1. Create EXTENDED_CARD molecule (internal_list, storage_size=1) ──
      const molResult = await client.query(`
        INSERT INTO molecule_def (
          molecule_key, label, value_kind, scalar_type, lookup_table_key, tenant_id, context,
          is_static, is_permanent, is_required, is_active, description, display_order,
          molecule_type, value_structure, storage_size, value_type, attaches_to, input_type
        ) VALUES (
          'EXTENDED_CARD', 'Extended Protocol Card', 'internal_list', NULL, NULL, $1, 'activity',
          false, false, false, true, 'Extended protocol card detected by pattern analysis (M1-M3, T1-T5, F1, D2-D3)', 0,
          'D', 'single', 1, 'code', 'A', 'P'
        ) RETURNING molecule_id
      `, [TENANT]);
      const extCardMolId = molResult.rows[0].molecule_id;
      console.log(`  ✅ EXTENDED_CARD molecule created: molecule_id=${extCardMolId}`);

      // ── 2. Molecule value lookup row ──
      await client.query(`
        INSERT INTO molecule_value_lookup (
          molecule_id, table_name, id_column, code_column, label_column,
          maintenance_page, maintenance_description, is_tenant_specific,
          column_order, column_type, decimal_places, col_description,
          value_type, lookup_table_key, value_kind, scalar_type, context,
          storage_size, attaches_to
        ) VALUES (
          $1, NULL, NULL, NULL, NULL,
          NULL, NULL, true,
          1, 'internal_list', 0, 'Extended protocol card code',
          'code', NULL, 'internal_list', NULL, 'activity',
          1, 'A'
        )
      `, [extCardMolId]);

      // ── 3. Internal list values (molecule_value_text) ──
      const extCards = [
        { code: 'M1', label: 'Multi-Stream Convergence', sort: 1 },
        { code: 'M2', label: 'Co-Dominant Streams', sort: 2 },
        { code: 'M3', label: 'Self-Report / Observer Discordance', sort: 3 },
        { code: 'T1', label: 'Slow Burn', sort: 4 },
        { code: 'T2', label: 'Acute Spike', sort: 5 },
        { code: 'T3', label: 'Oscillator', sort: 6 },
        { code: 'T4', label: 'Silent Disengagement', sort: 7 },
        { code: 'T5', label: 'Chronic Low-Grade', sort: 8 },
        { code: 'F1', label: 'Intervention Failure', sort: 9 },
        { code: 'D2', label: 'Compound Events', sort: 10 },
        { code: 'D3', label: 'State-Dependent Event', sort: 11 },
      ];
      for (const card of extCards) {
        await client.query(`
          INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order, is_active)
          VALUES ($1, $2, $3, $4, true)
        `, [extCardMolId, card.code, card.label, card.sort]);
      }
      console.log(`  ✅ ${extCards.length} embedded list values created`);

      // ── 4. Add EXTENDED_CARD to accrual composite ──
      const compResult = await client.query(`
        SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = 'A'
      `, [TENANT]);
      if (compResult.rows.length > 0) {
        const compositeLink = compResult.rows[0].link;

        // Check if already added
        const existingDetail = await client.query(
          `SELECT 1 FROM composite_detail WHERE p_link = $1 AND molecule_id = $2`,
          [compositeLink, extCardMolId]
        );
        if (existingDetail.rows.length === 0) {
          const nextLink = await getNextLink(client, TENANT, 'composite_detail');

          await client.query(`
            INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
            VALUES ($1, $2, $3, false, false, NULL, 10)
          `, [nextLink, compositeLink, extCardMolId]);

          console.log(`  ✅ EXTENDED_CARD added to composite_detail (link=${nextLink})`);
        } else {
          console.log(`  ⏭️ EXTENDED_CARD already in composite_detail`);
        }
      }

      // ── 5. Add extended_card column to stability_registry ──
      await client.query(`
        ALTER TABLE stability_registry ADD COLUMN IF NOT EXISTS extended_card VARCHAR(3)
      `);
      console.log(`  ✅ extended_card column added to stability_registry`);

      // ── 6. Get external_result_action IDs for each urgency level ──
      const actionIds = {};
      for (const code of ['SR_YELLOW', 'SR_ORANGE', 'SR_RED', 'SR_SENTINEL']) {
        const r = await client.query(
          `SELECT action_id FROM external_result_action WHERE tenant_id = $1 AND action_code = $2`,
          [TENANT, code]
        );
        if (r.rows.length > 0) actionIds[code] = r.rows[0].action_id;
      }

      // ── 7. Create promotion rules for each extended card ──
      // T2 (Acute Spike) auto-elevates to Orange; all others start at Yellow
      const cardPromotions = [
        { code: 'M1', promoCode: 'EXT_M1', name: 'Multi-Stream Convergence — Registry Alert', desc: '3+ PPSI domains elevated above trailing baseline', action: 'SR_YELLOW' },
        { code: 'M2', promoCode: 'EXT_M2', name: 'Co-Dominant Streams — Registry Alert', desc: 'Top two stream contributions within 5 percentage points', action: 'SR_YELLOW' },
        { code: 'M3', promoCode: 'EXT_M3', name: 'Self-Report/Observer Discordance — Registry Alert', desc: 'Provider Pulse exceeds PPSI by >15 points for 2+ months', action: 'SR_YELLOW' },
        { code: 'T1', promoCode: 'EXT_T1', name: 'Slow Burn — Registry Alert', desc: 'Cumulative 6-week PPSI increase 15+ with no single-week spike >8', action: 'SR_YELLOW' },
        { code: 'T2', promoCode: 'EXT_T2', name: 'Acute Spike — Registry Alert', desc: 'Single-week PPSI increase >15 OR 2-week increase >20', action: 'SR_ORANGE' },
        { code: 'T3', promoCode: 'EXT_T3', name: 'Oscillator — Registry Alert', desc: 'PPSI crosses same tier boundary 3+ times in 12 weeks', action: 'SR_YELLOW' },
        { code: 'T4', promoCode: 'EXT_T4', name: 'Silent Disengagement — Registry Alert', desc: 'PPSI <25 AND external indicators elevated', action: 'SR_ORANGE' },
        { code: 'T5', promoCode: 'EXT_T5', name: 'Chronic Low-Grade — Registry Alert', desc: 'Yellow tier for 12+ consecutive weeks with completed intervention', action: 'SR_YELLOW' },
        { code: 'F1', promoCode: 'EXT_F1', name: 'Intervention Failure — Registry Alert', desc: 'Escalation trigger fires on active protocol card', action: 'SR_YELLOW' },
        { code: 'D2', promoCode: 'EXT_D2', name: 'Compound Events — Registry Alert', desc: '2+ events within 14-day window', action: 'SR_YELLOW' },
        { code: 'D3', promoCode: 'EXT_D3', name: 'State-Dependent Event — Registry Alert', desc: 'Event while participant is at Yellow or Orange tier', action: 'SR_YELLOW' },
      ];

      for (const cp of cardPromotions) {
        // Skip if promotion already exists
        const existing = await client.query(
          `SELECT 1 FROM promotion WHERE tenant_id = $1 AND promotion_code = $2`,
          [TENANT, cp.promoCode]
        );
        if (existing.rows.length > 0) continue;

        // Create rule
        const ruleResult = await client.query(`INSERT INTO rule DEFAULT VALUES RETURNING rule_id`);
        const ruleId = ruleResult.rows[0].rule_id;

        // Create rule criteria: EXTENDED_CARD equals card code
        await client.query(`
          INSERT INTO rule_criteria (rule_id, molecule_key, operator, value, label, sort_order)
          VALUES ($1, 'EXTENDED_CARD', 'equals', $2, $3, 1)
        `, [ruleId, JSON.stringify(cp.code), `Extended Card = ${cp.code}`]);

        // Create promotion
        const promoResult = await client.query(`
          INSERT INTO promotion (tenant_id, promotion_code, promotion_name, start_date, end_date, is_active, enrollment_type, count_type, goal_amount, reward_type)
          VALUES ($1, $2, $3, '2026-01-01', '2099-12-31', true, 'A', 'activities', 1, 'external')
          RETURNING promotion_id
        `, [TENANT, cp.promoCode, cp.name]);
        const promoId = promoResult.rows[0].promotion_id;

        // Link rule to promotion
        await client.query(`UPDATE promotion SET rule_id = $1 WHERE promotion_id = $2`, [ruleId, promoId]);

        // Create promotion result → external action at appropriate urgency
        const actionId = actionIds[cp.action];
        if (actionId) {
          await client.query(`
            INSERT INTO promotion_result (promotion_id, tenant_id, result_type, result_description, result_reference_id, sort_order)
            VALUES ($1, $2, 'external', $3, $4, 1)
          `, [promoId, TENANT, cp.desc, actionId]);
        }

        console.log(`  ✅ Promotion ${cp.promoCode} created (rule_id=${ruleId}, action=${cp.action})`);
      }
    }
  },
  {
    version: 31,
    description: 'Fix link_tank corruption — consolidate composite_detail link_tank to single tenant_id=0 row, re-insert EXTENDED_CARD composite_detail with proper link',
    async run(client) {
      // Session 99 fix: broken v30 + direct SQL created 3 link_tank rows for
      // composite_detail (tenant_id 1, 3, 5). getNextLink expects ONE row with
      // tenant_id=0 for everything except member_number. Clean up all bad rows.

      // 1. Delete ALL composite_detail rows from link_tank (they're all wrong)
      const deleted = await client.query(`
        DELETE FROM link_tank WHERE table_key = 'composite_detail'
      `);
      console.log(`  ✅ Deleted ${deleted.rowCount} bad link_tank rows for composite_detail`);

      // 2. Delete the bad composite_detail row inserted by broken v30 (EXTENDED_CARD)
      const TENANT = 5;
      const compResult = await client.query(`
        SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = 'A'
      `, [TENANT]);

      if (compResult.rows.length > 0) {
        const compositeLink = compResult.rows[0].link;
        const molResult = await client.query(`
          SELECT molecule_id FROM molecule_def WHERE molecule_key = 'EXTENDED_CARD' AND tenant_id = $1
        `, [TENANT]);

        if (molResult.rows.length > 0) {
          const extCardMolId = molResult.rows[0].molecule_id;

          const delDetail = await client.query(`
            DELETE FROM composite_detail WHERE p_link = $1 AND molecule_id = $2
          `, [compositeLink, extCardMolId]);
          if (delDetail.rowCount > 0) {
            console.log(`  ✅ Deleted bad composite_detail row for EXTENDED_CARD`);
          }

          // 3. Insert correct link_tank row (tenant_id=0) with next_link past current max
          const maxResult = await client.query(`SELECT MAX(link) as max_link FROM composite_detail`);
          const maxLink = maxResult.rows[0].max_link;
          // next_link should be one past the current max
          await client.query(`
            INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
            VALUES (0, 'composite_detail', 2, $1)
          `, [maxLink + 1]);
          console.log(`  ✅ Inserted correct link_tank row (tenant_id=0, next_link=${maxLink + 1})`);

          // 4. Re-insert EXTENDED_CARD using proper getNextLink
          const nextLink = await getNextLink(client, TENANT, 'composite_detail');
          await client.query(`
            INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
            VALUES ($1, $2, $3, false, false, NULL, 10)
          `, [nextLink, compositeLink, extCardMolId]);
          console.log(`  ✅ Re-inserted EXTENDED_CARD composite_detail with proper link (${nextLink})`);
        }
      }
    }
  },
  {
    version: 32,
    description: 'PPSI safety alerts — note_alert column on survey, PPSI_NOTE_ENTERED notification rule',
    async run(client) {
      const T = 5; // Wisconsin PHP tenant

      // 1. Add note_alert boolean to survey table
      await client.query(`
        ALTER TABLE survey
        ADD COLUMN IF NOT EXISTS note_alert BOOLEAN NOT NULL DEFAULT FALSE
      `);

      // 2. Enable note_alert for PPSI survey
      await client.query(`
        UPDATE survey SET note_alert = TRUE WHERE survey_code = 'PPSI' AND tenant_id = $1
      `, [T]);
      console.log('  ✅ note_alert column added to survey, enabled for PPSI');

      // 3. Add PPSI_NOTE_ENTERED notification rule — all clinical staff, critical severity
      await client.query(`
        INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role, notify_member, severity, title_template, body_template, timing_offset_hours, is_active)
        VALUES ($1, 'PPSI_NOTE_ENTERED', 'all_clinical', NULL, FALSE, 'critical',
                '⚠️ PPSI Note — {member_name}',
                '{member_name} added a note on their weekly check-in: {detail}',
                0, TRUE)
      `, [T]);
      console.log('  ✅ PPSI_NOTE_ENTERED notification rule created (all_clinical, critical)');

      // 4. Create survey_note_review table — tracks staff review of survey notes
      //    activity_link is CHAR(5) — activity links are 5-byte squished pointers, not integers
      await client.query(`
        CREATE TABLE IF NOT EXISTS survey_note_review (
          review_id       SERIAL PRIMARY KEY,
          activity_link   CHARACTER(5) NOT NULL,
          member_link     CHARACTER(5) NOT NULL,
          tenant_id       SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          review_status   VARCHAR(20) NOT NULL DEFAULT 'pending',
          reviewed_by     INTEGER REFERENCES platform_user(user_id),
          reviewed_at     TIMESTAMPTZ,
          review_notes    TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_note_review_member ON survey_note_review(member_link, tenant_id, review_status)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_note_review_pending ON survey_note_review(tenant_id, review_status, created_at DESC)
      `);
      console.log('  ✅ survey_note_review table created');
    }
  },
  {
    version: 33,
    description: 'Fix survey_note_review.activity_link type — CHAR(5) not INTEGER (activity links are 5-byte squished pointers)',
    async run(client) {
      await client.query(`
        ALTER TABLE survey_note_review ALTER COLUMN activity_link TYPE CHARACTER(5)
      `);
      console.log('  ✅ survey_note_review.activity_link changed to CHAR(5)');
    }
  },
  {
    version: 34,
    description: 'F1/T5 batch detection — scheduled job + EXTENDED_CARD_DETECTED notification rule',
    async run(client) {
      const T = 5; // Wisconsin PHP tenant

      // Register F1_T5 scheduled job (daily, same as MEDS)
      await client.query(`
        INSERT INTO scheduled_job (tenant_id, job_code, job_name, job_description, interval_minutes, is_active)
        VALUES ($1, 'F1_T5', 'F1/T5 Extended Card Detection', 'Daily batch scan for Chronic Borderline (T5: Yellow 12+ weeks with completed follow-up) and Intervention Failure (F1: declining/escalated follow-up outcome on open registry item). Creates registry items with extended card assignments.', 1440, TRUE)
        ON CONFLICT (tenant_id, job_code) DO NOTHING
      `, [T]);
      console.log('  ✅ F1_T5 scheduled job registered');

      // Notification rule for extended card detection (routes to all clinical staff)
      await client.query(`
        INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role, notify_member, severity, title_template, body_template, timing_offset_hours, is_active)
        VALUES ($1, 'EXTENDED_CARD_DETECTED', 'all_clinical', NULL, false, 'critical', 'Extended Protocol Card Detected', 'An extended destabilization pattern has been detected and a new protocol card assigned.', 0, true)
        ON CONFLICT DO NOTHING
      `, [T]);
      console.log('  ✅ EXTENDED_CARD_DETECTED notification rule created');
    }
  },
  {
    version: 35,
    description: 'Notification delivery system — delivery queue, delivery config, scheduled jobs',
    async run(client) {
      // notification_delivery — one notification can produce multiple deliveries (email, sms, push)
      await client.query(`
        CREATE TABLE notification_delivery (
          delivery_id SERIAL PRIMARY KEY,
          notification_id INTEGER REFERENCES notification(notification_id),
          tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          recipient_user_id INTEGER NOT NULL REFERENCES platform_user(user_id),
          channel VARCHAR(10) NOT NULL,
          status VARCHAR(15) NOT NULL DEFAULT 'pending',
          severity VARCHAR(10) NOT NULL DEFAULT 'info',
          title VARCHAR(200),
          body TEXT,
          held_reason VARCHAR(30),
          digest_batch_id INTEGER,
          attempt_count SMALLINT NOT NULL DEFAULT 0,
          last_attempt_at TIMESTAMPTZ,
          sent_at TIMESTAMPTZ,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT nd_channel_check CHECK (channel IN ('email','sms','push')),
          CONSTRAINT nd_status_check CHECK (status IN ('pending','queued','sent','failed','held','digested')),
          CONSTRAINT nd_severity_check CHECK (severity IN ('critical','warning','info'))
        )
      `);
      await client.query('CREATE INDEX idx_nd_status ON notification_delivery(status, created_at)');
      await client.query('CREATE INDEX idx_nd_tenant ON notification_delivery(tenant_id, status, created_at DESC)');
      await client.query('CREATE INDEX idx_nd_recipient ON notification_delivery(recipient_user_id, status, created_at DESC)');
      await client.query('CREATE INDEX idx_nd_notification ON notification_delivery(notification_id)');
      await client.query('CREATE INDEX idx_nd_digest ON notification_delivery(digest_batch_id) WHERE digest_batch_id IS NOT NULL');
      console.log('  ✅ notification_delivery table created');

      // notification_delivery_config — per-tenant delivery settings
      await client.query(`
        CREATE TABLE notification_delivery_config (
          config_id SERIAL PRIMARY KEY,
          tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          timezone VARCHAR(40) NOT NULL DEFAULT 'America/Chicago',
          window_start TIME NOT NULL DEFAULT '07:00',
          window_end TIME NOT NULL DEFAULT '21:00',
          digest_hour SMALLINT NOT NULL DEFAULT 8,
          email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          max_retries SMALLINT NOT NULL DEFAULT 3,
          CONSTRAINT ndc_tenant_unique UNIQUE (tenant_id)
        )
      `);
      console.log('  ✅ notification_delivery_config table created');

      // Seed config for Wisconsin PHP (tenant 5)
      await client.query(`
        INSERT INTO notification_delivery_config (tenant_id, timezone, window_start, window_end, digest_hour, email_enabled, sms_enabled, push_enabled, max_retries)
        VALUES (5, 'America/Chicago', '07:00', '21:00', 8, TRUE, TRUE, TRUE, 3)
      `);
      console.log('  ✅ Delivery config seeded for tenant 5 (Wisconsin PHP — Central time)');

      // Register NOTIFY_DELIVER scheduled job — runs every 5 minutes
      await client.query(`
        INSERT INTO scheduled_job (tenant_id, job_code, job_name, job_description, interval_minutes, is_active)
        VALUES (5, 'NOTIFY_DELIVER', 'Notification Delivery', 'Processes pending notification deliveries — sends via configured channels. Releases held items when delivery window opens. Retries failed deliveries up to max_retries.', 5, TRUE)
        ON CONFLICT (tenant_id, job_code) DO NOTHING
      `);
      console.log('  ✅ NOTIFY_DELIVER scheduled job registered (every 5 min)');

      // Register NOTIFY_DIGEST scheduled job — runs daily
      await client.query(`
        INSERT INTO scheduled_job (tenant_id, job_code, job_name, job_description, interval_minutes, is_active)
        VALUES (5, 'NOTIFY_DIGEST', 'Notification Digest', 'Daily digest — bundles warning/info deliveries from last 24 hours into a single digest per recipient per channel.', 1440, TRUE)
        ON CONFLICT (tenant_id, job_code) DO NOTHING
      `);
      console.log('  ✅ NOTIFY_DIGEST scheduled job registered (daily)');
    }
  },
  {
    version: 36,
    description: 'Platform error log table — persistent error/warning tracking for silent failure remediation',
    async run(client) {
      await client.query(`
        CREATE TABLE error_log (
          log_id SERIAL PRIMARY KEY,
          severity VARCHAR(10) NOT NULL DEFAULT 'error',
          source VARCHAR(100) NOT NULL,
          message VARCHAR(500) NOT NULL,
          detail TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT el_severity_check CHECK (severity IN ('error','warn','info'))
        )
      `);
      await client.query('CREATE INDEX idx_error_log_created ON error_log(created_at DESC)');
      await client.query('CREATE INDEX idx_error_log_severity ON error_log(severity, created_at DESC)');
      console.log('  ✅ error_log table created');
    }
  },
  {
    version: 37,
    description: 'PPSI_Q3_ALERT promotion — PPSI individual question scored 3 triggers YELLOW registry item',
    async run(client) {
      const T = 5; // Wisconsin PHP tenant

      // Create rule
      const ruleResult = await client.query(`INSERT INTO rule DEFAULT VALUES RETURNING rule_id`);
      const ruleId = ruleResult.rows[0].rule_id;

      // Add criteria: SIGNAL equals PPSI_Q3
      await client.query(
        `INSERT INTO rule_criteria (rule_id, molecule_key, operator, value, label, sort_order)
         VALUES ($1, 'SIGNAL', 'equals', '"PPSI_Q3"', 'PPSI Question Score 3', 1)`,
        [ruleId]
      );

      // Create promotion (matches PULSE_Q3_ALERT pattern — external reward, auto-enroll, goal=1, unlimited repeats)
      const promoResult = await client.query(
        `INSERT INTO promotion (tenant_id, promotion_code, promotion_name, start_date, end_date, is_active, enrollment_type, rule_id, count_type, goal_amount, reward_type, process_limit_count)
         VALUES ($1, 'PPSI_Q3_ALERT', 'PPSI Q3 — Registry Alert', '2026-01-01', '2050-12-31', true, 'A', $2, 'activities', 1, 'external', 9999)
         RETURNING promotion_id`,
        [T, ruleId]
      );
      const promoId = promoResult.rows[0].promotion_id;

      // Add promotion result: external action SR_YELLOW (action_id=4)
      await client.query(
        `INSERT INTO promotion_result (promotion_id, tenant_id, result_type, result_reference_id, result_description, sort_order)
         VALUES ($1, $2, 'external', 4, 'PPSI individual question scored 3', 0)`,
        [promoId, T]
      );

      console.log(`  ✅ PPSI_Q3_ALERT promotion created (promotion_id=${promoId}, rule_id=${ruleId}, external action=SR_YELLOW)`);
    }
  },
  {
    version: 38,
    description: 'Configurable clinician label + update member label to Participant',
    async run(client) {
      const TENANT = 5;

      // Update member_label: Physician → Participant
      await client.query(`
        UPDATE sysparm_detail sd
        SET value = 'Participant'
        FROM sysparm sp
        WHERE sd.sysparm_id = sp.sysparm_id
          AND sp.tenant_id = $1 AND sp.sysparm_key = 'member_label'
      `, [TENANT]);

      // Update member_label_plural: Physicians → Participants
      await client.query(`
        UPDATE sysparm_detail sd
        SET value = 'Participants'
        FROM sysparm sp
        WHERE sd.sysparm_id = sp.sysparm_id
          AND sp.tenant_id = $1 AND sp.sysparm_key = 'member_label_plural'
      `, [TENANT]);

      // Create clinician_label sysparm
      const spResult = await client.query(`
        INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
        VALUES ($1, 'clinician_label', 'text', 'Display label for clinicians (e.g., Clinician, Health Support Staff)')
        ON CONFLICT (tenant_id, sysparm_key) DO NOTHING
        RETURNING sysparm_id
      `, [TENANT]);

      if (spResult.rows.length) {
        await client.query(`
          INSERT INTO sysparm_detail (sysparm_id, value)
          VALUES ($1, 'Health Support Staff')
        `, [spResult.rows[0].sysparm_id]);
      }

      // Create clinician_label_plural sysparm
      const spResult2 = await client.query(`
        INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
        VALUES ($1, 'clinician_label_plural', 'text', 'Plural display label for clinicians')
        ON CONFLICT (tenant_id, sysparm_key) DO NOTHING
        RETURNING sysparm_id
      `, [TENANT]);

      if (spResult2.rows.length) {
        await client.query(`
          INSERT INTO sysparm_detail (sysparm_id, value)
          VALUES ($1, 'Health Support Staff')
        `, [spResult2.rows[0].sysparm_id]);
      }
    }
  },
  {
    version: 39,
    description: 'Rename clinician_label → staff_label (generic term for any tenant)',
    async run(client) {
      await client.query(`UPDATE sysparm SET sysparm_key = 'staff_label' WHERE sysparm_key = 'clinician_label'`);
      await client.query(`UPDATE sysparm SET sysparm_key = 'staff_label_plural' WHERE sysparm_key = 'clinician_label_plural'`);
      await client.query(`UPDATE sysparm SET description = 'Display label for staff roles (e.g., Clinician, Health Support Staff, Case Manager)' WHERE sysparm_key = 'staff_label'`);
      await client.query(`UPDATE sysparm SET description = 'Plural display label for staff roles' WHERE sysparm_key = 'staff_label_plural'`);
    }
  },
  {
    version: 40,
    description: 'FULL_PPSI_REQUESTED flag molecule — coordinator requests full 34-question PPSI for a participant',
    async run(client) {
      const TENANT = 5;
      await client.query(`
        INSERT INTO molecule_def (molecule_key, label, value_kind, scalar_type, tenant_id, context, attaches_to, storage_size, value_type, description, is_static, molecule_type)
        VALUES ('FULL_PPSI_REQUESTED', 'Full PPSI Requested', 'value', NULL, $1, 'member', 'M', 0, NULL, 'Flag: coordinator requested full 34-question PPSI instead of mini. Cleared after completion.', false, 'D')
        ON CONFLICT (tenant_id, molecule_key) DO NOTHING
      `, [TENANT]);
    }
  },
  {
    version: 41,
    description: 'Licensing board lookup table + LICENSING_BOARD molecule for participant grouping',
    async run(client) {
      const TENANT = 5;

      // ── 1. Create licensing_board lookup table ──
      await client.query(`
        CREATE TABLE IF NOT EXISTS licensing_board (
          licensing_board_id SERIAL PRIMARY KEY,
          tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          board_code VARCHAR(20) NOT NULL,
          board_name VARCHAR(100) NOT NULL,
          profession VARCHAR(100),
          is_active BOOLEAN NOT NULL DEFAULT true,
          UNIQUE(tenant_id, board_code)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_licensing_board_tenant ON licensing_board(tenant_id)`);
      console.log('  ✅ licensing_board table created');

      // ── 2. Seed Wisconsin boards ──
      const boards = [
        { code: 'MEB', name: 'Medical Examining Board', profession: 'Physician' },
        { code: 'PACB', name: 'Physician Assistant Affiliated Credentialing Board', profession: 'Physician Assistant' },
        { code: 'DEB', name: 'Dentistry Examining Board', profession: 'Dentist' },
        { code: 'PEB', name: 'Pharmacy Examining Board', profession: 'Pharmacist' },
        { code: 'SBN', name: 'State Board of Nursing', profession: 'Nurse' }
      ];
      for (const b of boards) {
        await client.query(`
          INSERT INTO licensing_board (tenant_id, board_code, board_name, profession)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (tenant_id, board_code) DO NOTHING
        `, [TENANT, b.code, b.name, b.profession]);
      }
      console.log('  ✅ 5 Wisconsin licensing boards seeded');

      // ── 3. Create LICENSING_BOARD molecule (storage_size 2, key, external_list → licensing_board) ──
      const molResult = await client.query(`
        INSERT INTO molecule_def (
          molecule_key, label, value_kind, scalar_type, tenant_id, context, attaches_to,
          storage_size, value_type, description, is_static, molecule_type
        ) VALUES (
          'LICENSING_BOARD', 'Licensing Board', 'external_list', NULL, $1, 'member', 'M',
          2, 'key', 'Licensing board overseeing this participant (e.g., Medical Examining Board)', false, 'D'
        )
        ON CONFLICT (tenant_id, molecule_key) DO NOTHING
        RETURNING molecule_id
      `, [TENANT]);

      if (molResult.rows.length) {
        const molId = molResult.rows[0].molecule_id;
        console.log(`  ✅ LICENSING_BOARD molecule created: molecule_id=${molId}`);

        // ── 4. Molecule value lookup — links molecule to licensing_board table ──
        await client.query(`
          INSERT INTO molecule_value_lookup (
            molecule_id, table_name, id_column, code_column, label_column,
            maintenance_page, maintenance_description, is_tenant_specific,
            column_order, column_type, decimal_places, col_description,
            value_type, lookup_table_key, value_kind, scalar_type, context,
            storage_size, attaches_to
          ) VALUES (
            $1, 'licensing_board', 'licensing_board_id', 'board_code', 'board_name',
            'admin_licensing_boards.html', 'Manage licensing boards', true,
            1, 'database_ref', 0, 'Licensing Board',
            'key', 'licensing_board', 'external_list', NULL, 'member',
            2, 'M'
          )
        `, [molId]);
        console.log('  ✅ molecule_value_lookup row created');
      } else {
        console.log('  ⏭️  LICENSING_BOARD molecule already exists');
      }
    }
  },
  {
    version: 42,
    description: 'Add molecule_value_lookup row for ASSIGNED_CLINICIAN (fixes 500 on clinician assignment)',
    async run(client) {
      const TENANT = 5;
      const molResult = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'ASSIGNED_CLINICIAN'`, [TENANT]
      );
      if (!molResult.rows.length) throw new Error('ASSIGNED_CLINICIAN molecule not found');
      const molId = molResult.rows[0].molecule_id;

      // Check if lookup row already exists
      const existing = await client.query(
        `SELECT 1 FROM molecule_value_lookup WHERE molecule_id = $1`, [molId]
      );
      if (!existing.rows.length) {
        await client.query(`
          INSERT INTO molecule_value_lookup (
            molecule_id, table_name, id_column, code_column, label_column,
            maintenance_page, maintenance_description, is_tenant_specific,
            column_order, column_type, decimal_places, col_description,
            value_type, lookup_table_key, value_kind, scalar_type, context,
            storage_size, attaches_to
          ) VALUES (
            $1, NULL, NULL, NULL, NULL,
            NULL, 'Link to clinician member record', false,
            1, 'link_ref', 0, 'Clinician Link',
            'link', NULL, 'value', NULL, 'member',
            5, 'M'
          )
        `, [molId]);
        console.log('  ✅ ASSIGNED_CLINICIAN molecule_value_lookup row created');
      } else {
        console.log('  ⏭️  ASSIGNED_CLINICIAN lookup row already exists');
      }
    }
  },

  // ── v43: Claude system user for automated testing ──
  {
    version: 43,
    description: 'Create Claude system user for automated testing',
    async run(client) {
      const existing = await client.query(`SELECT 1 FROM platform_user WHERE username = 'Claude'`);
      if (existing.rows.length === 0) {
        // bcrypt hash of 'claude123'
        const hash = '$2b$10$u8l3wOzm05bA5C8gOx0EWOCTn412OUsIdgCQ2m0vXixBCPbq9efuS';
        const linkResult = await client.query(`SELECT COALESCE(MAX(link)+1, 100) as next_link FROM platform_user`);
        const link = linkResult.rows[0].next_link;
        await client.query(`
          INSERT INTO platform_user (username, password_hash, display_name, tenant_id, role, link)
          VALUES ('Claude', $1, 'Claude (System)', 5, 'superuser', $2)
        `, [hash, link]);
        console.log(`  ✅ Claude system user created (link=${link})`);
      } else {
        console.log('  ⏭️  Claude system user already exists');
      }
    }
  },

  // ── v44: Trigger signals #4 (Repeated Moderate) + #13 (Missed Survey) ──
  {
    version: 44,
    description: 'Add REPEATED_MODERATE and MISSED_SURVEY signal types',
    async run(client) {
      const T = 5;

      await client.query(`
        INSERT INTO signal_type (tenant_id, signal_code, signal_name, description)
        VALUES ($1, 'REPEATED_MODERATE', 'Repeated Moderate (3+ Weeks)', 'Yellow or Orange tier status for 3+ consecutive weeks — early warning before chronic T5')
        ON CONFLICT (tenant_id, signal_code) DO NOTHING
      `, [T]);
      console.log('  ✅ REPEATED_MODERATE signal type ensured');

      await client.query(`
        INSERT INTO signal_type (tenant_id, signal_code, signal_name, description)
        VALUES ($1, 'MISSED_SURVEY', 'Missed Survey (MEDS)', 'No survey submitted within expected cadence window — MEDS detection')
        ON CONFLICT (tenant_id, signal_code) DO NOTHING
      `, [T]);
      console.log('  ✅ MISSED_SURVEY signal type ensured');
    }
  },

  // ── v45: Fix Delta activity processing sysparms — auto-calculate flight miles ──
  {
    version: 45,
    description: 'Fix Delta activity type A sysparms: points_mode=calculated, calc_function=calculateFlightMiles',
    async run(client) {
      const T = 1; // Delta tenant

      // Find the activity_processing sysparm for Delta
      const spResult = await client.query(
        `SELECT s.sysparm_id FROM sysparm s WHERE s.tenant_id = $1 AND s.sysparm_key = 'activity_processing'`, [T]
      );
      if (!spResult.rows.length) {
        console.log('  ⚠️  No activity_processing sysparm found for Delta — skipping');
        return;
      }
      const sysparmId = spResult.rows[0].sysparm_id;

      await client.query(
        `UPDATE sysparm_detail SET value = 'calculated' WHERE sysparm_id = $1 AND category = 'A' AND code = 'points_mode'`,
        [sysparmId]
      );
      console.log('  ✅ points_mode = calculated');

      await client.query(
        `UPDATE sysparm_detail SET value = 'calculateFlightMiles' WHERE sysparm_id = $1 AND category = 'A' AND code = 'calc_function'`,
        [sysparmId]
      );
      console.log('  ✅ calc_function = calculateFlightMiles');
    }
  },

  // ── v46: Bonus Result Engine foundation (Delta first) ──
  {
    version: 46,
    description: 'Create bonus_result table, Delta BONUS_RESULT molecule, and seed Delta legacy bonus rows',
    async run(client) {
      const DELTA = 1;

      await client.query(`
        CREATE TABLE IF NOT EXISTS bonus_result (
          bonus_result_id SERIAL PRIMARY KEY,
          bonus_id INTEGER NOT NULL REFERENCES bonus(bonus_id) ON DELETE CASCADE,
          tenant_id SMALLINT NOT NULL,
          result_type VARCHAR(20) NOT NULL CHECK (result_type IN ('points', 'external')),
          result_amount INTEGER,
          amount_type VARCHAR(10),
          result_reference_id INTEGER,
          result_description VARCHAR(200),
          point_type_id INTEGER REFERENCES point_type(point_type_id),
          sort_order SMALLINT DEFAULT 0
        )
      `);
      console.log('  ✅ bonus_result table ensured');

      await client.query(`CREATE INDEX IF NOT EXISTS idx_bonus_result_bonus ON bonus_result(bonus_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bonus_result_tenant ON bonus_result(tenant_id, bonus_id, sort_order)`);
      console.log('  ✅ bonus_result indexes ensured');

      const existingMol = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'BONUS_RESULT'`,
        [DELTA]
      );

      let bonusResultMoleculeId = existingMol.rows[0]?.molecule_id || null;
      if (!bonusResultMoleculeId) {
        const insertMol = await client.query(`
          INSERT INTO molecule_def (
            molecule_key, label, value_kind, scalar_type, tenant_id, context, attaches_to,
            storage_size, value_type, description, is_static, molecule_type
          ) VALUES (
            'BONUS_RESULT', 'Bonus Result', 'external_list', NULL, $1, 'activity', 'A',
            2, 'key', 'Audit trail for non-point bonus results fired on an activity', false, 'D'
          )
          RETURNING molecule_id
        `, [DELTA]);
        bonusResultMoleculeId = insertMol.rows[0].molecule_id;
        console.log(`  ✅ Delta BONUS_RESULT molecule created: molecule_id=${bonusResultMoleculeId}`);
      } else {
        console.log('  ⏭️  Delta BONUS_RESULT molecule already exists');
      }

      const existingLookup = await client.query(
        `SELECT 1 FROM molecule_value_lookup WHERE molecule_id = $1 AND column_order = 1`,
        [bonusResultMoleculeId]
      );
      if (!existingLookup.rows.length) {
        await client.query(`
          INSERT INTO molecule_value_lookup (
            molecule_id, table_name, id_column, code_column, label_column,
            maintenance_page, maintenance_description, is_tenant_specific,
            column_order, column_type, decimal_places, col_description,
            value_type, lookup_table_key, value_kind, scalar_type, context,
            storage_size, attaches_to
          ) VALUES (
            $1, 'bonus_result', 'bonus_result_id', 'bonus_result_id', 'result_description',
            'admin_bonus_edit.html', 'Manage bonus results', true,
            1, 'database_ref', 0, 'Bonus Result',
            'key', 'bonus_result', 'external_list', NULL, 'activity',
            2, 'A'
          )
        `, [bonusResultMoleculeId]);
        console.log('  ✅ Delta BONUS_RESULT lookup row created');
      } else {
        console.log('  ⏭️  Delta BONUS_RESULT lookup row already exists');
      }

      const seedResult = await client.query(`
        INSERT INTO bonus_result (
          bonus_id, tenant_id, result_type, result_amount,
          amount_type, result_description, point_type_id, sort_order
        )
        SELECT
          b.bonus_id,
          b.tenant_id,
          'points',
          b.bonus_amount,
          b.bonus_type,
          b.bonus_description,
          b.point_type_id,
          0
        FROM bonus b
        WHERE b.tenant_id = $1
          AND b.bonus_type IN ('fixed', 'percent')
          AND NOT EXISTS (
            SELECT 1 FROM bonus_result br WHERE br.bonus_id = b.bonus_id
          )
      `, [DELTA]);
      console.log(`  ✅ Seeded ${seedResult.rowCount} Delta bonus_result row(s) from legacy bonuses`);
    }
  },

  // ── v47: Soft-delete (mark-in-error) + random-scheduled drug tests ──
  {
    version: 47,
    description: 'Soft-delete columns on member_survey/compliance_result + random-scheduled fields on member_compliance',
    async run(client) {
      // Soft-delete / mark-in-error for surveys (PPSI, Provider Pulse)
      await client.query(`
        ALTER TABLE member_survey
          ADD COLUMN IF NOT EXISTS voided_ts TIMESTAMP NULL,
          ADD COLUMN IF NOT EXISTS voided_by INTEGER NULL,
          ADD COLUMN IF NOT EXISTS voided_reason TEXT NULL
      `);
      console.log('  ✅ member_survey: voided_ts/voided_by/voided_reason');

      // Soft-delete / mark-in-error for compliance results (drug tests, etc.)
      await client.query(`
        ALTER TABLE compliance_result
          ADD COLUMN IF NOT EXISTS voided_ts TIMESTAMP NULL,
          ADD COLUMN IF NOT EXISTS voided_by INTEGER NULL,
          ADD COLUMN IF NOT EXISTS voided_reason TEXT NULL
      `);
      console.log('  ✅ compliance_result: voided_ts/voided_by/voided_reason');

      // Index to speed up "non-voided" filters
      await client.query(`CREATE INDEX IF NOT EXISTS idx_member_survey_voided ON member_survey(voided_ts) WHERE voided_ts IS NULL`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_compliance_result_voided ON compliance_result(voided_ts) WHERE voided_ts IS NULL`);
      console.log('  ✅ Partial indexes on voided_ts (non-voided rows)');

      // Random-scheduled drug tests (system picks the date; MEDS checks against it)
      // schedule_mode: 'cadence' (default — existing behavior) or 'random' (system-scheduled)
      // next_scheduled_date: Bill-epoch SMALLINT; only used when schedule_mode='random'
      await client.query(`
        ALTER TABLE member_compliance
          ADD COLUMN IF NOT EXISTS schedule_mode VARCHAR(10) NOT NULL DEFAULT 'cadence',
          ADD COLUMN IF NOT EXISTS next_scheduled_date SMALLINT NULL
      `);
      // Add check constraint if it doesn't exist
      const conCheck = await client.query(`
        SELECT 1 FROM pg_constraint
        WHERE conname = 'member_compliance_schedule_mode_check'
      `);
      if (!conCheck.rows.length) {
        await client.query(`
          ALTER TABLE member_compliance
            ADD CONSTRAINT member_compliance_schedule_mode_check
            CHECK (schedule_mode IN ('cadence', 'random'))
        `);
      }
      console.log('  ✅ member_compliance: schedule_mode + next_scheduled_date');
    }
  },

  // ── v48: Clean up stray test bonus_result row added outside of db_migrate during Session 105 ──
  {
    version: 48,
    description: 'Remove stray DIAMOND50 "Flat bonus kicker" test bonus_result row (was added via API during testing)',
    async run(client) {
      const del = await client.query(`
        DELETE FROM bonus_result
        WHERE bonus_id = 17
          AND tenant_id = 1
          AND result_description = 'Flat bonus kicker (updated)'
      `);
      console.log(`  ✅ Removed ${del.rowCount} stray test bonus_result row(s) from DIAMOND50`);
    }
  },

  // ── v49: Insight Recovery & Wellness Center — demo clinic with 11 engineered personas + 2 staff ──
  {
    version: 49,
    description: 'Seed demo clinic: Insight Recovery & Wellness Center — 11 participants + 2 staff with engineered states per Erica April 11',
    async run(client) {
      const TENANT = 5;

      // Base-127 squish (same as pointers.js and v18)
      function squish(value, bytes) {
        const chars = [];
        let remaining = value;
        for (let i = 0; i < bytes; i++) {
          chars.unshift(String.fromCharCode((remaining % 127) + 1));
          remaining = Math.floor(remaining / 127);
        }
        return chars.join('');
      }

      // Bill-epoch today
      const epoch = new Date(1959, 11, 3);
      const today = Math.floor((Date.now() - epoch.getTime()) / (24 * 60 * 60 * 1000)) - 32768;

      // Helper: get next member link
      async function nextMemberLink() {
        const r = await client.query(
          `UPDATE link_tank SET next_link = next_link + 1 WHERE tenant_id = $1 AND table_key = 'member' RETURNING next_link - 1 as link, link_bytes`,
          [TENANT]
        );
        return squish(Number(r.rows[0].link), r.rows[0].link_bytes);
      }

      // Helper: get next registry link
      async function nextRegistryLink() {
        const r = await client.query(
          `UPDATE link_tank SET next_link = next_link + 1 WHERE tenant_id = 0 AND table_key = 'stability_registry' RETURNING next_link - 1 as link`
        );
        return parseInt(r.rows[0].link);
      }

      // Helper: get next compliance_result link
      async function nextCompResultLink() {
        const r = await client.query(
          `UPDATE link_tank SET next_link = next_link + 1 WHERE tenant_id = 0 AND table_key = 'compliance_result' RETURNING next_link - 1 as link`
        );
        return parseInt(r.rows[0].link);
      }

      // Helper: get next membership_number
      async function nextMemberNum() {
        const r = await client.query(
          `UPDATE link_tank SET next_link = next_link + 1 WHERE tenant_id = $1 AND table_key = 'member_number' RETURNING next_link - 1 as link`,
          [TENANT]
        );
        return String(Number(r.rows[0].link));
      }

      // ── 1. Create partner + program ──
      // Check if partner already exists (idempotent re-run safety)
      let partnerRes = await client.query(`SELECT partner_id FROM partner WHERE tenant_id = $1 AND partner_code = 'IRWC'`, [TENANT]);
      if (!partnerRes.rows.length) {
        partnerRes = await client.query(`
          INSERT INTO partner (tenant_id, partner_code, partner_name, is_active)
          VALUES ($1, 'IRWC', 'Insight Recovery & Wellness Center', true)
          RETURNING partner_id
        `, [TENANT]);
      }
      const partnerId = partnerRes.rows[0].partner_id;

      let programRes = await client.query(`SELECT program_id FROM partner_program WHERE partner_id = $1 AND program_code = 'MAIN'`, [partnerId]);
      if (!programRes.rows.length) {
        programRes = await client.query(`
          INSERT INTO partner_program (partner_id, program_code, program_name, earning_type, is_active)
          VALUES ($1, 'MAIN', 'Main Program', 'V', true)
          RETURNING program_id
        `, [partnerId]);
      }
      const programId = programRes.rows[0].program_id;
      console.log(`  ✅ Clinic: Insight Recovery & Wellness Center (partner_id=${partnerId}, program_id=${programId})`);

      // ── 2. Look up molecule IDs ──
      const molId = async (key) => {
        const r = await client.query(`SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = $2`, [TENANT, key]);
        if (!r.rows.length) throw new Error(`Molecule ${key} not found for tenant ${TENANT}`);
        return r.rows[0].molecule_id;
      };
      const PP_MOL = await molId('PARTNER_PROGRAM');
      const IS_CLINICIAN_MOL = await molId('IS_CLINICIAN');
      const ASSIGNED_CLINICIAN_MOL = await molId('ASSIGNED_CLINICIAN');
      const ML_RISK_SCORE_MOL = await molId('ML_RISK_SCORE');

      // ── 3. Create 11 participants ──
      const personas = [
        // { fname, lname, role, riskLevel, riskScore, registryItems, trend, notes }
        { fname: 'Grace',    lname: 'Newfield',    role: 'green-clean',   riskLevel: 'low',      riskScore: 12 },
        { fname: 'Hope',     lname: 'Clearwater',  role: 'green-comply',  riskLevel: 'low',      riskScore: 18 },
        { fname: 'Victor',   lname: 'Stillman',    role: 'yellow-meds',   riskLevel: 'moderate', riskScore: 42 },
        { fname: 'Dawn',     lname: 'Shepherd',    role: 'orange-fu',     riskLevel: 'moderate', riskScore: 55 },
        { fname: 'Sterling', lname: 'Brightwell',  role: 'red-overdue',   riskLevel: 'high',     riskScore: 78 },
        { fname: 'Faith',    lname: 'Mercer',      role: 'green-notes',   riskLevel: 'low',      riskScore: 15 },
        { fname: 'Phoenix',  lname: 'Ashmore',     role: 'yellow-alert',  riskLevel: 'moderate', riskScore: 48 },
        { fname: 'Grant',    lname: 'Steadman',    role: 'sentinel',      riskLevel: 'high',     riskScore: 88 },
        { fname: 'Haven',    lname: 'Restor',      role: 'green-done',    riskLevel: 'low',      riskScore: 10 },
        { fname: 'Joy',      lname: 'Summerlin',   role: 'orange-urgent', riskLevel: 'moderate', riskScore: 62 },
        { fname: 'Solace',   lname: 'Greystone',   role: 'yellow-chain',  riskLevel: 'moderate', riskScore: 45 }
      ];

      const memberLinks = {};
      for (const p of personas) {
        const link = await nextMemberLink();
        const num = await nextMemberNum();
        await client.query(`
          INSERT INTO member (link, tenant_id, fname, lname, title, membership_number, enroll_date, is_active)
          VALUES ($1, $2, $3, $4, 'Dr.', $5, $6, true)
        `, [link, TENANT, p.fname, p.lname, num, today - 180]); // enrolled ~6 months ago

        // Assign to clinic
        await client.query(`
          INSERT INTO "5_data_22" (p_link, molecule_id, attaches_to, n1, n2)
          VALUES ($1, $2, 'M', $3, $4)
        `, [link, PP_MOL, partnerId, programId]);

        // Set ML risk score
        await client.query(`
          INSERT INTO "5_data_22" (p_link, molecule_id, attaches_to, n1, n2)
          VALUES ($1, $2, 'M', $3, $4)
        `, [link, ML_RISK_SCORE_MOL, p.riskScore, today]);

        // Set ML risk level (text_direct in 5_data_22 uses c1 column)
        // ML risk score stored; ML_RISK_LEVEL computed dynamically from score
        // text_direct molecules skip encoding — raw text goes to the appropriate text column

        memberLinks[p.role] = { link, num, fname: p.fname, lname: p.lname, ...p };
      }
      console.log(`  ✅ 11 participants created`);

      // ── 4. Create 2 staff members ──
      const staffA = { fname: 'Sarah', lname: 'Chen' };
      const staffB = { fname: 'Marcus', lname: 'Rivera' };
      const staffLinks = {};

      for (const s of [staffA, staffB]) {
        const link = await nextMemberLink();
        const num = await nextMemberNum();
        await client.query(`
          INSERT INTO member (link, tenant_id, fname, lname, membership_number, enroll_date, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, true)
        `, [link, TENANT, s.fname, s.lname, num, today - 365]);

        // Mark as clinician
        await client.query(`INSERT INTO "5_data_0" (p_link, molecule_id, attaches_to) VALUES ($1, $2, 'M')`, [link, IS_CLINICIAN_MOL]);

        // Assign to clinic
        await client.query(`INSERT INTO "5_data_22" (p_link, molecule_id, attaches_to, n1, n2) VALUES ($1, $2, 'M', $3, $4)`, [link, PP_MOL, partnerId, programId]);

        staffLinks[s.lname] = link;
      }
      console.log(`  ✅ 2 staff members created (Sarah Chen, Marcus Rivera)`);

      // ── 5. Assign staff to participants ──
      // Staff A (Chen): Grace Newfield + Hope Clearwater (both green, light caseload)
      for (const role of ['green-clean', 'green-comply']) {
        await client.query(`INSERT INTO "5_data_5" (p_link, molecule_id, c1, attaches_to) VALUES ($1, $2, $3, 'M')`,
          [memberLinks[role].link, ASSIGNED_CLINICIAN_MOL, staffLinks.Chen]);
      }
      // Staff B (Rivera): all 9 remaining participants
      for (const role of ['yellow-meds', 'orange-fu', 'red-overdue', 'green-notes', 'yellow-alert', 'sentinel', 'green-done', 'orange-urgent', 'yellow-chain']) {
        await client.query(`INSERT INTO "5_data_5" (p_link, molecule_id, c1, attaches_to) VALUES ($1, $2, $3, 'M')`,
          [memberLinks[role].link, ASSIGNED_CLINICIAN_MOL, staffLinks.Rivera]);
      }
      console.log(`  ✅ Staff assignments: Chen (2 green), Rivera (9 mixed)`);

      // ── 6. Compliance items — assign to all participants ──
      const compItems = await client.query(`SELECT compliance_item_id, item_code, cadence_days FROM compliance_item WHERE tenant_id = $1 AND status = 'active'`, [TENANT]);
      for (const role in memberLinks) {
        const m = memberLinks[role];
        for (const ci of compItems.rows) {
          // Drug test items get 'random' schedule_mode for certain participants
          const isRandom = (ci.item_code === 'DRUG_TEST_COMP' || ci.item_code === 'DRUG_TEST_RESULT') && ['yellow-meds', 'orange-urgent'].includes(role);
          await client.query(`
            INSERT INTO member_compliance (member_link, compliance_item_id, status, start_date, tenant_id, cadence_type, cadence_days, schedule_mode)
            VALUES ($1, $2, 'active', CURRENT_DATE - INTERVAL '90 days', $3, 'custom', $4, $5)
            ON CONFLICT (member_link, compliance_item_id) DO NOTHING
          `, [m.link, ci.compliance_item_id, TENANT, isRandom ? null : ci.cadence_days, isRandom ? 'random' : 'cadence']);
        }
      }
      console.log(`  ✅ Compliance items assigned to all participants`);

      // ── 7. Seed compliance results for Hope Clearwater (green-comply) ──
      const hopeLink = memberLinks['green-comply'].link;
      const drugTestComp = compItems.rows.find(c => c.item_code === 'DRUG_TEST_COMP');
      const drugTestResult = compItems.rows.find(c => c.item_code === 'DRUG_TEST_RESULT');
      if (drugTestComp && drugTestResult) {
        // 3 completed drug tests: -60, -30, -7 days ago
        for (const daysAgo of [60, 30, 7]) {
          const crLink1 = await nextCompResultLink();
          const completedStatus = await client.query(`SELECT status_id FROM compliance_item_status WHERE compliance_item_id = $1 AND status_code = 'COMPLETED'`, [drugTestComp.compliance_item_id]);
          if (completedStatus.rows.length) {
            await client.query(`
              INSERT INTO compliance_result (link, member_compliance_id, status_id, tenant_id, result_date)
              SELECT $1, mc.member_compliance_id, $3, $4, $5
              FROM member_compliance mc WHERE mc.member_link = $6 AND mc.compliance_item_id = $2
            `, [crLink1, drugTestComp.compliance_item_id, completedStatus.rows[0].status_id, TENANT, today - daysAgo, hopeLink]);
          }
          const crLink2 = await nextCompResultLink();
          const negStatus = await client.query(`SELECT status_id FROM compliance_item_status WHERE compliance_item_id = $1 AND status_code = 'NEGATIVE'`, [drugTestResult.compliance_item_id]);
          if (negStatus.rows.length) {
            await client.query(`
              INSERT INTO compliance_result (link, member_compliance_id, status_id, tenant_id, result_date)
              SELECT $1, mc.member_compliance_id, $3, $4, $5
              FROM member_compliance mc WHERE mc.member_link = $6 AND mc.compliance_item_id = $2
            `, [crLink2, drugTestResult.compliance_item_id, negStatus.rows[0].status_id, TENANT, today - daysAgo, hopeLink]);
          }
        }
      }
      console.log(`  ✅ Hope Clearwater: 3 completed drug tests with negative results`);

      // ── 8. Registry items + follow-ups ──
      // Each persona that needs a registry item gets one here
      const registryItems = [
        // Victor Stillman — YELLOW, protocol card A2, MEDS driver
        { role: 'yellow-meds',    urgency: 'YELLOW',   driver: 'MEDS',      subdomain: null,             card: 'A2', daysAgo: 10, sla: 72 },
        // Dawn Shepherd — ORANGE, protocol card P4 (Pulse-driven)
        { role: 'orange-fu',      urgency: 'ORANGE',   driver: 'PULSE',     subdomain: 'PROVIDER_CONCERN', card: 'P4', daysAgo: 5,  sla: 48 },
        // Sterling Brightwell — RED, overdue follow-up
        { role: 'red-overdue',    urgency: 'RED',      driver: 'COMPOSITE', subdomain: null,             card: null, daysAgo: 21, sla: 24 },
        // Phoenix Ashmore — YELLOW (for alert bell)
        { role: 'yellow-alert',   urgency: 'YELLOW',   driver: 'COMPLIANCE',subdomain: 'DRUG_TEST',      card: null, daysAgo: 3,  sla: 72 },
        // Grant Steadman — SENTINEL, protocol card D2
        { role: 'sentinel',       urgency: 'SENTINEL', driver: 'EVENTS',    subdomain: 'CRITICAL_EVENT', card: 'D2', daysAgo: 0,  sla: 0 },
        // Joy Summerlin — ORANGE, "few hours left" SLA
        { role: 'orange-urgent',  urgency: 'ORANGE',   driver: 'PPSI',      subdomain: 'BURNOUT',        card: null, daysAgo: 1,  sla: 48 },
        // Solace Greystone — YELLOW, overdue + chain of follow-ups
        { role: 'yellow-chain',   urgency: 'YELLOW',   driver: 'PPSI',      subdomain: 'COGNITIVE',      card: null, daysAgo: 60, sla: 72 },
        // Haven Restor — resolved item (for "completed" demo, not currently open)
        { role: 'green-done',     urgency: 'YELLOW',   driver: 'PPSI',      subdomain: 'ISOLATION',      card: null, daysAgo: 90, sla: 72, resolved: true }
      ];

      for (const ri of registryItems) {
        const m = memberLinks[ri.role];
        const regLink = await nextRegistryLink();
        const createdDate = today - ri.daysAgo;
        const slaDeadline = ri.sla === 0
          ? `NOW() - INTERVAL '${ri.daysAgo} days'`
          : `NOW() - INTERVAL '${ri.daysAgo} days' + INTERVAL '${ri.sla} hours'`;
        const status = ri.resolved ? 'R' : 'O';

        await client.query(`
          INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, sla_hours, sla_deadline, created_date, created_ts, status, dominant_driver, dominant_subdomain, protocol_card)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${slaDeadline}, $9, NOW() - INTERVAL '${ri.daysAgo} days', '${status}', $10, $11, $12)
        `, [regLink, m.link, TENANT, ri.urgency, ri.driver, 'SR_' + ri.urgency,
            `${ri.driver} detection for ${m.fname} ${m.lname}`,
            ri.sla, createdDate, ri.driver, ri.subdomain || null, ri.card || null]);

        if (ri.resolved) {
          await client.query(`
            UPDATE stability_registry SET resolved_ts = NOW() - INTERVAL '30 days', resolution_code = 'WORKED', resolution_notes = 'Participant showed improvement through protocol adherence'
            WHERE link = $1
          `, [regLink]);
        }

        // Schedule follow-ups based on urgency
        let fuSchedule;
        if (ri.urgency === 'SENTINEL') {
          fuSchedule = [{ type: '48h', offset: 2 }, { type: 'weekly', offset: 9 }, { type: 'weekly', offset: 16 }, { type: 'weekly', offset: 23 }];
        } else if (ri.urgency === 'RED') {
          fuSchedule = [{ type: 'weekly', offset: 7 }, { type: 'weekly', offset: 14 }, { type: 'weekly', offset: 21 }, { type: 'weekly', offset: 28 }, { type: '4wk', offset: 56 }, { type: '8wk', offset: 84 }];
        } else {
          fuSchedule = [{ type: '2wk', offset: 14 }, { type: '4wk', offset: 28 }, { type: '8wk', offset: 56 }];
        }

        for (const s of fuSchedule) {
          const fuDate = createdDate + s.offset;
          // If resolved, mark some follow-ups as completed
          if (ri.resolved && fuDate < today - 30) {
            await client.query(`
              INSERT INTO registry_followup (registry_link, tenant_id, followup_type, scheduled_date, completed_date, completed_ts, outcome, notes)
              VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${90 - s.offset} days', 'improving', 'Participant stable, adherent to protocol')
            `, [regLink, TENANT, s.type, fuDate, fuDate + 2]);
          } else {
            await client.query(`
              INSERT INTO registry_followup (registry_link, tenant_id, followup_type, scheduled_date)
              VALUES ($1, $2, $3, $4)
            `, [regLink, TENANT, s.type, fuDate]);
          }
        }

        // For Solace Greystone (60 days ago, yellow-chain): mark first follow-up as completed
        if (ri.role === 'yellow-chain') {
          await client.query(`
            UPDATE registry_followup SET completed_date = $1, completed_ts = NOW() - INTERVAL '46 days', outcome = 'stable', notes = 'Participant maintaining but not improving. Continue monitoring.'
            WHERE registry_link = $2 AND followup_type = '2wk'
          `, [createdDate + 16, regLink]);
        }

        // For Sterling Brightwell (RED, 21 days ago): first follow-up is overdue
        // The weekly at offset 7 = day 14 ago, should be overdue — it already is because scheduled_date < today and no completion
      }
      console.log(`  ✅ ${registryItems.length} registry items + follow-ups created`);

      // ── 9. Annotations (notes) for Faith Mercer (green-notes) ──
      const faithLink = memberLinks['green-notes'].link;
      // Note from participant
      await client.query(`
        INSERT INTO physician_annotation (member_link, tenant_id, annotation_date, annotation_text, created_by_member, created_by_user_id)
        VALUES ($1, $2, $3, 'Feeling much better this week. Sleep has improved significantly since starting the new routine. Grateful for the support.', true, null)
      `, [faithLink, TENANT, today - 3]);
      // Note from care team
      await client.query(`
        INSERT INTO physician_annotation (member_link, tenant_id, annotation_date, annotation_text, created_by_member, created_by_user_id)
        VALUES ($1, $2, $3, 'Participant is engaged and showing consistent improvement. Recommend continuing current protocol. Follow-up scheduled for next month.', false, null)
      `, [faithLink, TENANT, today - 1]);
      console.log(`  ✅ Faith Mercer: participant note + care team note`);

      // ── 10. Notification for Phoenix Ashmore (yellow-alert) — unread alert bell ──
      // Find a platform_user for the notification recipient (any active staff user)
      const userRes = await client.query(`SELECT user_id FROM platform_user WHERE tenant_id = $1 AND is_active = true LIMIT 1`, [TENANT]);
      if (userRes.rows.length) {
        const userId = userRes.rows[0].user_id;
        const ashLink = memberLinks['yellow-alert'].link;
        await client.query(`
          INSERT INTO notification (tenant_id, recipient_user_id, severity, title, body, source, event_type, channel, is_read, member_link)
          VALUES ($1, $2, 'warning', 'Compliance Alert: Dr. Phoenix Ashmore', 'Drug test compliance issue detected — please review participant chart.', 'MEDS', 'MEDS_COMPLIANCE_OVERDUE', 'in_app', false, $3)
        `, [TENANT, userId, ashLink]);
        console.log(`  ✅ Phoenix Ashmore: unread notification created`);
      }

      console.log(`  ✅ Demo clinic seed complete: 11 participants, 2 staff, ${registryItems.length} registry items`);
    }
  },

  // ── v50: Random drug test lottery — tracking columns + scheduled job registration ──
  {
    version: 50,
    description: 'Random drug test: last_selected_date + days_since_selected on member_compliance, RANDOM_DRUG_TEST scheduled job, undetermined appointments cadence type',
    async run(client) {
      const TENANT = 5;

      // Tracking columns for random selection lottery
      await client.query(`
        ALTER TABLE member_compliance
          ADD COLUMN IF NOT EXISTS last_selected_date SMALLINT NULL,
          ADD COLUMN IF NOT EXISTS days_since_selected SMALLINT NOT NULL DEFAULT 0
      `);
      console.log('  ✅ member_compliance: last_selected_date + days_since_selected');

      // Add "undetermined" to schedule_mode check constraint
      await client.query(`ALTER TABLE member_compliance DROP CONSTRAINT IF EXISTS member_compliance_schedule_mode_check`);
      await client.query(`ALTER TABLE member_compliance ADD CONSTRAINT member_compliance_schedule_mode_check CHECK (schedule_mode IN ('cadence', 'random', 'undetermined'))`);
      console.log('  ✅ schedule_mode check updated: cadence, random, undetermined');

      // Register RANDOM_DRUG_TEST scheduled job (daily 5 AM, 1440 min interval)
      const existing = await client.query(`SELECT 1 FROM scheduled_job WHERE job_code = 'RANDOM_DRUG_TEST' AND tenant_id = $1`, [TENANT]);
      if (!existing.rows.length) {
        await client.query(`
          INSERT INTO scheduled_job (tenant_id, job_code, job_name, interval_minutes, preferred_start_time, is_active)
          VALUES ($1, 'RANDOM_DRUG_TEST', 'Random Drug Test Selection', 1440, '05:00:00', true)
        `, [TENANT]);
        console.log('  ✅ RANDOM_DRUG_TEST scheduled job registered (daily 5 AM)');
      } else {
        console.log('  ⏭️  RANDOM_DRUG_TEST job already registered');
      }

      // Register DRUG_TEST_MISSED scheduled job (daily 5 PM sweep)
      const existingMissed = await client.query(`SELECT 1 FROM scheduled_job WHERE job_code = 'DRUG_TEST_MISSED' AND tenant_id = $1`, [TENANT]);
      if (!existingMissed.rows.length) {
        await client.query(`
          INSERT INTO scheduled_job (tenant_id, job_code, job_name, interval_minutes, preferred_start_time, is_active)
          VALUES ($1, 'DRUG_TEST_MISSED', 'Drug Test Missed Sweep', 1440, '17:00:00', true)
        `, [TENANT]);
        console.log('  ✅ DRUG_TEST_MISSED scheduled job registered (daily 5 PM)');
      } else {
        console.log('  ⏭️  DRUG_TEST_MISSED job already registered');
      }
    }
  },

  // ── v51: Fix MEDS dedup bug + clean up duplicate registry items ──
  {
    version: 51,
    description: 'Clean up duplicate MEDS registry items (dedup checked reason_code=MISSED_SURVEY but createRegistryItem stored SR_YELLOW — never matched)',
    async run(client) {
      const TENANT = 5;

      // For each member with multiple open MEDS items, keep the oldest one and delete the rest.
      // First delete orphaned follow-ups, then the registry items.
      const dupes = await client.query(`
        WITH ranked AS (
          SELECT sr.link,
                 ROW_NUMBER() OVER (PARTITION BY sr.member_link ORDER BY sr.created_ts ASC) as rn
          FROM stability_registry sr
          WHERE sr.tenant_id = $1 AND sr.source_stream = 'MEDS' AND sr.status = 'O'
        )
        SELECT link FROM ranked WHERE rn > 1
      `, [TENANT]);

      if (dupes.rows.length) {
        const dupeLinks = dupes.rows.map(r => r.link);

        // Delete follow-ups tied to duplicate items
        const fuDel = await client.query(`
          DELETE FROM registry_followup WHERE registry_link = ANY($1)
        `, [dupeLinks]);
        console.log(`  ✅ Deleted ${fuDel.rowCount} follow-ups from duplicate MEDS items`);

        // Delete the duplicate registry items
        const regDel = await client.query(`
          DELETE FROM stability_registry WHERE link = ANY($1)
        `, [dupeLinks]);
        console.log(`  ✅ Deleted ${regDel.rowCount} duplicate MEDS registry items (kept 1 per member)`);
      } else {
        console.log('  ⏭️  No duplicate MEDS items found');
      }
    }
  },

  // ── v52: Compliance config per Erica — program status no cadence, drug test results mirror testing ──
  {
    version: 52,
    description: 'Program status: remove cadence (team-driven only). Drug test results: remove own cadence (mirrors testing schedule, not independent)',
    async run(client) {
      const TENANT = 5;

      // Program status — no cadence; only changes when team flags an issue
      const ps = await client.query(`
        UPDATE compliance_item SET cadence_days = NULL
        WHERE tenant_id = $1 AND item_code = 'PROGRAM_STATUS' AND cadence_days IS NOT NULL
      `, [TENANT]);
      console.log(`  ✅ PROGRAM_STATUS cadence cleared (${ps.rowCount} row${ps.rowCount !== 1 ? 's' : ''})`);

      // Also clear cadence on member_compliance rows for PROGRAM_STATUS
      const psMc = await client.query(`
        UPDATE member_compliance SET cadence_days = NULL
        WHERE tenant_id = $1 AND compliance_item_id = (
          SELECT compliance_item_id FROM compliance_item WHERE tenant_id = $1 AND item_code = 'PROGRAM_STATUS'
        ) AND cadence_days IS NOT NULL
      `, [TENANT]);
      console.log(`  ✅ PROGRAM_STATUS member_compliance cadence cleared (${psMc.rowCount} row${psMc.rowCount !== 1 ? 's' : ''})`);

      // Drug test results — no independent cadence; results only expected when a test is ordered
      const dr = await client.query(`
        UPDATE compliance_item SET cadence_days = NULL
        WHERE tenant_id = $1 AND item_code = 'DRUG_TEST_RESULT' AND cadence_days IS NOT NULL
      `, [TENANT]);
      console.log(`  ✅ DRUG_TEST_RESULT cadence cleared (${dr.rowCount} row${dr.rowCount !== 1 ? 's' : ''})`);

      // Clear cadence on member_compliance rows for DRUG_TEST_RESULT
      const drMc = await client.query(`
        UPDATE member_compliance SET cadence_days = NULL
        WHERE tenant_id = $1 AND compliance_item_id = (
          SELECT compliance_item_id FROM compliance_item WHERE tenant_id = $1 AND item_code = 'DRUG_TEST_RESULT'
        ) AND cadence_days IS NOT NULL
      `, [TENANT]);
      console.log(`  ✅ DRUG_TEST_RESULT member_compliance cadence cleared (${drMc.rowCount} row${drMc.rowCount !== 1 ? 's' : ''})`);
    }
  },

  // ── v53: Fix demo clinic program name — "Main Program" → actual clinic name ──
  {
    version: 53,
    description: 'Rename demo clinic program from "Main Program" to "Insight Recovery & Wellness Center" so dashboard navigation shows the clinic name',
    async run(client) {
      const result = await client.query(`
        UPDATE partner_program SET program_name = 'Insight Recovery & Wellness Center'
        WHERE partner_id = (SELECT partner_id FROM partner WHERE partner_code = 'IRWC' AND tenant_id = 5)
          AND program_code = 'MAIN'
      `);
      console.log(`  ✅ Program renamed (${result.rowCount} row)`);
    }
  },

  // ── v54: Fix PARTNER_PROGRAM molecule encoding for demo clinic members ──
  {
    version: 54,
    description: 'Fix demo clinic PARTNER_PROGRAM values — stored raw (17,30) instead of offset-encoded (17-32768, 30-32768)',
    async run(client) {
      const TENANT = 5;

      // Get the PARTNER_PROGRAM molecule_id
      const molRes = await client.query(`SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'PARTNER_PROGRAM'`, [TENANT]);
      const PP_MOL = molRes.rows[0].molecule_id;

      // Get partner_id and program_id for the demo clinic
      const partnerRes = await client.query(`SELECT partner_id FROM partner WHERE tenant_id = $1 AND partner_code = 'IRWC'`, [TENANT]);
      const partnerId = partnerRes.rows[0].partner_id;
      const programRes = await client.query(`SELECT program_id FROM partner_program WHERE partner_id = $1 AND program_code = 'MAIN'`, [partnerId]);
      const programId = programRes.rows[0].program_id;

      // Offset encoding for 2-byte key: value - 32768
      const encodedPartner = partnerId - 32768;
      const encodedProgram = programId - 32768;

      // Fix all rows that have raw values (positive n1/n2 matching our partner/program)
      const fix = await client.query(`
        UPDATE "5_data_22"
        SET n1 = $1, n2 = $2
        WHERE molecule_id = $3 AND attaches_to = 'M'
          AND n1 = $4 AND n2 = $5
      `, [encodedPartner, encodedProgram, PP_MOL, partnerId, programId]);

      console.log(`  ✅ Fixed ${fix.rowCount} PARTNER_PROGRAM molecule rows (${partnerId},${programId} → ${encodedPartner},${encodedProgram})`);
    }
  },

  // ── v55: Convert member_survey.start_ts and end_ts from Unix seconds to Bill epoch datetime ──
  {
    version: 55,
    description: 'Convert member_survey timestamps from Unix seconds to Bill epoch datetime (10-second blocks via timestamp_to_audit_ts)',
    async run(client) {
      // Verify conversion is correct on a sample row before bulk update
      const sample = await client.query(`
        SELECT start_ts,
               to_timestamp(start_ts) as readable,
               timestamp_to_audit_ts(to_timestamp(start_ts)) as converted,
               audit_ts_to_timestamp(timestamp_to_audit_ts(to_timestamp(start_ts))) as round_trip
        FROM member_survey
        WHERE start_ts IS NOT NULL
        LIMIT 1
      `);
      if (sample.rows.length) {
        const s = sample.rows[0];
        console.log(`  ℹ️  Sample: unix=${s.start_ts} → readable=${s.readable} → bill_epoch=${s.converted} → round_trip=${s.round_trip}`);
      }

      // Convert start_ts
      const startResult = await client.query(`
        UPDATE member_survey
        SET start_ts = timestamp_to_audit_ts(to_timestamp(start_ts))
        WHERE start_ts IS NOT NULL
      `);
      console.log(`  ✅ start_ts converted: ${startResult.rowCount} rows`);

      // Convert end_ts
      const endResult = await client.query(`
        UPDATE member_survey
        SET end_ts = timestamp_to_audit_ts(to_timestamp(end_ts))
        WHERE end_ts IS NOT NULL
      `);
      console.log(`  ✅ end_ts converted: ${endResult.rowCount} rows`);
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v56: Multi-counter promotions
  //
  // Moves "what to count" from a single set of columns on `promotion` to a
  // child table `promo_wt_count` (1-N rows per promotion). Each enrolled
  // member gets a per-counter progress row in `member_promo_wt_count`.
  // Progress and goal now live per-counter; `member_promotion` keeps only
  // lifecycle fields (enrolled_date, qualify_date, etc). The detail-row FK
  // shifts from member_promotion → member_promo_wt_count so one activity can
  // contribute to multiple counters on the same promo (each as its own row).
  //
  // Migration is a strict 1-to-1 copy: every existing promotion becomes a
  // promotion with exactly one counter. Behavior is preserved for existing
  // rows. Verification queries inside the transaction check row counts and
  // preserved sums; any mismatch throws and the transaction rolls back.
  //
  // Design doc: docs/MULTI_COUNTER_PROMOTIONS_DESIGN.md
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 56,
    description: 'Multi-counter promotions — promo_wt_count + member_promo_wt_count tables, 1-to-1 data copy, drop legacy columns',
    async run(client) {
      // ── Pre-migration snapshot for verification ──
      const pre = await client.query(`
        SELECT
          (SELECT count(*)::int FROM promotion) AS n_promotion,
          (SELECT count(*)::int FROM member_promotion) AS n_member_promotion,
          (SELECT count(*)::int FROM member_promotion_detail) AS n_detail,
          (SELECT COALESCE(sum(progress_counter), 0) FROM member_promotion) AS total_progress,
          (SELECT COALESCE(sum(goal_amount), 0) FROM member_promotion) AS total_member_goal,
          (SELECT COALESCE(sum(goal_amount), 0) FROM promotion) AS total_promo_goal
      `);
      const snap = pre.rows[0];
      console.log(`  ℹ️  Pre-migration: ${snap.n_promotion} promotions, ${snap.n_member_promotion} enrolled members, ${snap.n_detail} detail rows`);
      console.log(`  ℹ️  Pre-migration sums: progress=${snap.total_progress}, member_goal=${snap.total_member_goal}, promo_goal=${snap.total_promo_goal}`);

      // ── Step 1: Create promo_wt_count ──
      await client.query(`
        CREATE TABLE promo_wt_count (
          wt_count_id                   INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          promotion_id                  INTEGER     NOT NULL REFERENCES promotion(promotion_id) ON DELETE CASCADE,
          tenant_id                     SMALLINT    NOT NULL REFERENCES tenant(tenant_id),
          count_type                    VARCHAR(20) NOT NULL,
          counter_molecule_id           SMALLINT    REFERENCES molecule_def(molecule_id),
          counter_token_adjustment_id   INTEGER     REFERENCES adjustment(adjustment_id),
          goal_amount                   NUMERIC     NOT NULL,
          sort_order                    SMALLINT    NOT NULL DEFAULT 0,
          CONSTRAINT promo_wt_count_count_type_check
            CHECK (count_type IN ('activities','miles','enrollments','molecules','tokens')),
          CONSTRAINT promo_wt_count_goal_amount_check
            CHECK (goal_amount > 0),
          CONSTRAINT promo_wt_count_molecule_counter_required
            CHECK ((count_type = 'molecules' AND counter_molecule_id IS NOT NULL)
                OR (count_type <> 'molecules' AND counter_molecule_id IS NULL)),
          CONSTRAINT promo_wt_count_token_counter_required
            CHECK ((count_type = 'tokens' AND counter_token_adjustment_id IS NOT NULL)
                OR (count_type <> 'tokens' AND counter_token_adjustment_id IS NULL))
        )
      `);
      await client.query(`CREATE INDEX idx_promo_wt_count_promotion ON promo_wt_count(promotion_id)`);
      await client.query(`CREATE INDEX idx_promo_wt_count_tenant ON promo_wt_count(tenant_id)`);
      console.log(`  ✅ Created promo_wt_count`);

      // ── Step 2: Create member_promo_wt_count ──
      await client.query(`
        CREATE TABLE member_promo_wt_count (
          member_wt_count_id    BIGINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          member_promotion_id   BIGINT    NOT NULL REFERENCES member_promotion(member_promotion_id) ON DELETE CASCADE,
          wt_count_id           INTEGER   NOT NULL REFERENCES promo_wt_count(wt_count_id),
          tenant_id             SMALLINT  NOT NULL REFERENCES tenant(tenant_id),
          progress_counter      NUMERIC   NOT NULL DEFAULT 0,
          goal_amount           NUMERIC   NOT NULL,
          qualify_date          DATE,
          CONSTRAINT mpwc_unique_per_member_counter UNIQUE (member_promotion_id, wt_count_id)
        )
      `);
      await client.query(`CREATE INDEX idx_mpwc_member_promotion ON member_promo_wt_count(member_promotion_id)`);
      await client.query(`CREATE INDEX idx_mpwc_wt_count ON member_promo_wt_count(wt_count_id)`);
      console.log(`  ✅ Created member_promo_wt_count`);

      // ── Step 3: Copy existing promotion counters into promo_wt_count ──
      // Every existing promotion becomes a promotion with exactly one counter
      // carrying the old count_type/counter_*/goal_amount.
      const wtInsert = await client.query(`
        INSERT INTO promo_wt_count (promotion_id, tenant_id, count_type, counter_molecule_id, counter_token_adjustment_id, goal_amount, sort_order)
        SELECT promotion_id, tenant_id, count_type, counter_molecule_id, counter_token_adjustment_id, goal_amount, 0
        FROM promotion
      `);
      console.log(`  ✅ Copied ${wtInsert.rowCount} promotion(s) into promo_wt_count (one counter each)`);

      // ── Step 4: Copy each member_promotion's progress into member_promo_wt_count ──
      // Each enrolled member gets one row pointing at the single wt_count that
      // was created above for that promotion. goal_amount snapshot preserved;
      // qualify_date copied so members who already qualified stay qualified.
      const mpwcInsert = await client.query(`
        INSERT INTO member_promo_wt_count (member_promotion_id, wt_count_id, tenant_id, progress_counter, goal_amount, qualify_date)
        SELECT mp.member_promotion_id, pwc.wt_count_id, mp.tenant_id, mp.progress_counter, mp.goal_amount, mp.qualify_date
        FROM member_promotion mp
        JOIN promo_wt_count pwc ON pwc.promotion_id = mp.promotion_id
      `);
      console.log(`  ✅ Copied ${mpwcInsert.rowCount} member_promotion(s) into member_promo_wt_count`);

      // ── Step 5: Repoint member_promotion_detail.member_promotion_id → member_wt_count_id ──
      await client.query(`ALTER TABLE member_promotion_detail ADD COLUMN member_wt_count_id BIGINT`);

      const detailUpdate = await client.query(`
        UPDATE member_promotion_detail mpd
        SET member_wt_count_id = mpwc.member_wt_count_id
        FROM member_promo_wt_count mpwc
        WHERE mpwc.member_promotion_id = mpd.member_promotion_id
      `);
      console.log(`  ✅ Repointed ${detailUpdate.rowCount} detail row(s) to member_wt_count_id`);

      // Verify no NULL member_wt_count_id before enforcing NOT NULL
      const nullCheck = await client.query(`
        SELECT count(*)::int AS n FROM member_promotion_detail WHERE member_wt_count_id IS NULL
      `);
      if (nullCheck.rows[0].n > 0) {
        throw new Error(`${nullCheck.rows[0].n} member_promotion_detail row(s) have NULL member_wt_count_id — aborting`);
      }

      await client.query(`ALTER TABLE member_promotion_detail ALTER COLUMN member_wt_count_id SET NOT NULL`);
      await client.query(`
        ALTER TABLE member_promotion_detail
        ADD CONSTRAINT member_promotion_detail_wt_count_fk
          FOREIGN KEY (member_wt_count_id) REFERENCES member_promo_wt_count(member_wt_count_id) ON DELETE CASCADE
      `);

      // Swap primary key: (member_promotion_id, activity_link) → (member_wt_count_id, activity_link)
      await client.query(`ALTER TABLE member_promotion_detail DROP CONSTRAINT member_promotion_detail_pkey`);
      await client.query(`ALTER TABLE member_promotion_detail ADD PRIMARY KEY (member_wt_count_id, activity_link)`);

      // Drop old FK + column (idx_promotion_detail_promotion drops automatically with column)
      await client.query(`ALTER TABLE member_promotion_detail DROP CONSTRAINT member_promotion_detail_member_promotion_id_fkey`);
      await client.query(`ALTER TABLE member_promotion_detail DROP COLUMN member_promotion_id`);
      console.log(`  ✅ member_promotion_detail repointed`);

      // ── Step 6: Add counter_joiner to promotion (and snapshot column on member_promotion) ──
      await client.query(`
        ALTER TABLE promotion
        ADD COLUMN counter_joiner VARCHAR(3) NOT NULL DEFAULT 'AND'
          CHECK (counter_joiner IN ('AND','OR'))
      `);
      await client.query(`
        ALTER TABLE member_promotion
        ADD COLUMN counter_joiner VARCHAR(3) NOT NULL DEFAULT 'AND'
          CHECK (counter_joiner IN ('AND','OR'))
      `);
      console.log(`  ✅ Added counter_joiner to promotion and member_promotion (default 'AND')`);

      // ── Step 7: Drop legacy check constraints on promotion that referenced columns we're dropping ──
      await client.query(`ALTER TABLE promotion DROP CONSTRAINT promotion_count_type_check`);
      await client.query(`ALTER TABLE promotion DROP CONSTRAINT promotion_molecule_counter_required`);
      await client.query(`ALTER TABLE promotion DROP CONSTRAINT promotion_token_counter_required`);
      await client.query(`ALTER TABLE promotion DROP CONSTRAINT promotion_goal_amount_check`);

      // Drop legacy FKs (the columns referenced go away next)
      await client.query(`ALTER TABLE promotion DROP CONSTRAINT promotion_counter_molecule_fk`);
      await client.query(`ALTER TABLE promotion DROP CONSTRAINT promotion_counter_token_adjustment_id_fkey`);

      // ── Step 8: Drop legacy columns from promotion ──
      await client.query(`ALTER TABLE promotion DROP COLUMN count_type`);
      await client.query(`ALTER TABLE promotion DROP COLUMN counter_molecule_id`);
      await client.query(`ALTER TABLE promotion DROP COLUMN counter_token_adjustment_id`);
      await client.query(`ALTER TABLE promotion DROP COLUMN goal_amount`);
      console.log(`  ✅ Dropped legacy counter columns from promotion`);

      // ── Step 9: Drop legacy columns from member_promotion ──
      await client.query(`ALTER TABLE member_promotion DROP COLUMN progress_counter`);
      await client.query(`ALTER TABLE member_promotion DROP COLUMN goal_amount`);
      console.log(`  ✅ Dropped progress_counter and goal_amount from member_promotion`);

      // ── Step 10: Post-migration verification ──
      const post = await client.query(`
        SELECT
          (SELECT count(*)::int FROM promo_wt_count) AS n_wt_count,
          (SELECT count(*)::int FROM member_promo_wt_count) AS n_mpwc,
          (SELECT count(*)::int FROM member_promotion_detail) AS n_detail,
          (SELECT COALESCE(sum(progress_counter), 0) FROM member_promo_wt_count) AS total_progress,
          (SELECT COALESCE(sum(goal_amount), 0) FROM member_promo_wt_count) AS total_member_goal,
          (SELECT COALESCE(sum(goal_amount), 0) FROM promo_wt_count) AS total_promo_goal
      `);
      const after = post.rows[0];
      console.log(`  ℹ️  Post-migration: ${after.n_wt_count} counters, ${after.n_mpwc} member-counters, ${after.n_detail} detail rows`);
      console.log(`  ℹ️  Post-migration sums: progress=${after.total_progress}, member_goal=${after.total_member_goal}, promo_goal=${after.total_promo_goal}`);

      // Assert row counts preserved (1-to-1 migration)
      if (after.n_wt_count !== snap.n_promotion) {
        throw new Error(`Row count mismatch: promo_wt_count=${after.n_wt_count}, expected=${snap.n_promotion} (1 per promotion)`);
      }
      if (after.n_mpwc !== snap.n_member_promotion) {
        throw new Error(`Row count mismatch: member_promo_wt_count=${after.n_mpwc}, expected=${snap.n_member_promotion} (1 per enrolled member)`);
      }
      if (after.n_detail !== snap.n_detail) {
        throw new Error(`Row count mismatch: member_promotion_detail=${after.n_detail}, expected=${snap.n_detail} (should be unchanged)`);
      }

      // Assert sums preserved (no progress or goal should disappear)
      if (String(after.total_progress) !== String(snap.total_progress)) {
        throw new Error(`Sum mismatch: progress_counter total=${after.total_progress}, expected=${snap.total_progress}`);
      }
      if (String(after.total_member_goal) !== String(snap.total_member_goal)) {
        throw new Error(`Sum mismatch: member goal_amount total=${after.total_member_goal}, expected=${snap.total_member_goal}`);
      }
      if (String(after.total_promo_goal) !== String(snap.total_promo_goal)) {
        throw new Error(`Sum mismatch: promotion goal_amount total=${after.total_promo_goal}, expected=${snap.total_promo_goal}`);
      }

      console.log(`  ✅ Verification passed: row counts and sums preserved`);
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v57 — Move hardcoded PPII stream weights to sysparm so the clinical
  // architect can adjust them via an admin page. Seeds each tenant that has
  // a PPII scorer (currently only wi_php, tenant_id=5) with the values Erica
  // confirmed March 11, 2026. Other tenants are left alone.
  //
  // The weights live in a single sysparm row per tenant (sysparm_key =
  // 'ppii_weights') with one sysparm_detail row per stream (category='stream',
  // code in {pulse, ppsi, compliance, events}, value = decimal weight).
  // scorePPII.js reads from the cache with the hardcoded defaults as fallback.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 57,
    description: 'PPII stream weights moved to sysparm (editable via admin UI)',
    async run(client) {
      // wi_php tenant_id = 5. Seed only for tenants that run PPII scoring.
      // Hardcoded values from scorePPII.js PPII_WEIGHTS (Erica-confirmed March 11).
      const seed = [
        { tenantId: 5, pulse: 0.35, ppsi: 0.25, compliance: 0.25, events: 0.15 }
      ];

      for (const s of seed) {
        // Skip if this tenant already has a ppii_weights sysparm (re-run safety)
        const existing = await client.query(
          `SELECT sysparm_id FROM sysparm WHERE tenant_id = $1 AND sysparm_key = 'ppii_weights'`,
          [s.tenantId]
        );
        let sysparmId;
        if (existing.rows.length === 0) {
          const r = await client.query(
            `INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
             VALUES ($1, 'ppii_weights', 'json', 'PPII stream weights — must sum to 1.0')
             RETURNING sysparm_id`,
            [s.tenantId]
          );
          sysparmId = r.rows[0].sysparm_id;
          console.log(`  ✅ Created sysparm ppii_weights for tenant_id=${s.tenantId} (sysparm_id=${sysparmId})`);
        } else {
          sysparmId = existing.rows[0].sysparm_id;
          console.log(`  ⏭️  sysparm ppii_weights already exists for tenant_id=${s.tenantId}`);
        }

        for (const [code, value] of [['pulse', s.pulse], ['ppsi', s.ppsi], ['compliance', s.compliance], ['events', s.events]]) {
          // Upsert — preserve any value an admin may have already set
          const existingDetail = await client.query(
            `SELECT 1 FROM sysparm_detail WHERE sysparm_id = $1 AND category = 'stream' AND code = $2`,
            [sysparmId, code]
          );
          if (existingDetail.rows.length === 0) {
            await client.query(
              `INSERT INTO sysparm_detail (sysparm_id, category, code, value)
               VALUES ($1, 'stream', $2, $3)`,
              [sysparmId, code, String(value)]
            );
          }
        }

        // Verify sum = 1.0
        const sumCheck = await client.query(
          `SELECT COALESCE(SUM(CAST(value AS numeric)), 0) AS total
             FROM sysparm_detail WHERE sysparm_id = $1 AND category = 'stream'`,
          [sysparmId]
        );
        const total = Number(sumCheck.rows[0].total);
        if (Math.abs(total - 1.0) > 0.001) {
          throw new Error(`PPII weights for tenant_id=${s.tenantId} sum to ${total}, expected 1.0`);
        }
        console.log(`  ✅ PPII stream weights for tenant_id=${s.tenantId}: pulse=${s.pulse}, ppsi=${s.ppsi}, compliance=${s.compliance}, events=${s.events} (sum=${total.toFixed(3)})`);
      }
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v58 — PPII streams config-driven refactor.
  //
  // Replaces the v57 sysparm-backed weight storage with a five-table model:
  //   ppii_stream                      — per-tenant dictionary of streams
  //                                      (code, label, max_value, source_function)
  //   ppii_weight_set                  — versioned weight bundles
  //                                      (effective_from, changed_by_user, change_note,
  //                                       is_current)
  //   ppii_weight_set_value            — actual weights (one row per set+stream)
  //   ppii_score_history               — snapshot per PPII calc (for audit feature,
  //                                      built but unused until phase 2)
  //   ppii_score_history_component     — per-stream raw values for each snapshot
  //
  // Migrates existing wi_php (tenant_id=5) sysparm 'ppii_weights' values into the
  // new ppii_stream + ppii_weight_set + ppii_weight_set_value rows, then drops
  // the sysparm row.
  //
  // Stream max values come from PPII_MAXIMA in scorePPII.js. Source function names
  // refer to entries in the ppiiStreamFetchers registry that pointers.js exposes.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 58,
    description: 'PPII streams + weight sets + score history (config-driven refactor)',
    async run(client) {
      // ── 1. Tables ─────────────────────────────────────────────────────────
      await client.query(`
        CREATE TABLE ppii_stream (
          ppii_stream_id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          tenant_id        SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          code             VARCHAR(20) NOT NULL,
          label            VARCHAR(50) NOT NULL,
          max_value        NUMERIC NOT NULL CHECK (max_value > 0),
          source_function  VARCHAR(50) NOT NULL,
          is_active        BOOLEAN NOT NULL DEFAULT true,
          sort_order       SMALLINT NOT NULL DEFAULT 0,
          added_in_phase   VARCHAR(20),
          UNIQUE (tenant_id, code)
        )
      `);
      console.log('  ✅ ppii_stream created');

      await client.query(`
        CREATE TABLE ppii_weight_set (
          weight_set_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          tenant_id        SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          effective_from   TIMESTAMP NOT NULL,
          changed_by_user  INTEGER REFERENCES platform_user(user_id),
          change_note      TEXT,
          is_current       BOOLEAN NOT NULL DEFAULT false
        )
      `);
      // Partial unique index — at most one current weight set per tenant.
      await client.query(`
        CREATE UNIQUE INDEX ppii_weight_set_current_per_tenant
          ON ppii_weight_set(tenant_id) WHERE is_current = true
      `);
      console.log('  ✅ ppii_weight_set created (with partial unique index on is_current)');

      await client.query(`
        CREATE TABLE ppii_weight_set_value (
          weight_set_id    INTEGER NOT NULL REFERENCES ppii_weight_set(weight_set_id) ON DELETE CASCADE,
          stream_code      VARCHAR(20) NOT NULL,
          weight           NUMERIC NOT NULL CHECK (weight BETWEEN 0 AND 1),
          PRIMARY KEY (weight_set_id, stream_code)
        )
      `);
      console.log('  ✅ ppii_weight_set_value created');

      await client.query(`
        CREATE TABLE ppii_score_history (
          history_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          tenant_id        SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          p_link           CHAR(5) NOT NULL,
          computed_at      TIMESTAMP NOT NULL,
          ppii_score       SMALLINT NOT NULL CHECK (ppii_score BETWEEN 0 AND 100),
          weight_set_id    INTEGER NOT NULL REFERENCES ppii_weight_set(weight_set_id),
          trigger_type     VARCHAR(30)
        )
      `);
      await client.query(`
        CREATE INDEX ppii_score_history_member_recent
          ON ppii_score_history(p_link, computed_at DESC)
      `);
      console.log('  ✅ ppii_score_history created (with member+computed_at index)');

      await client.query(`
        CREATE TABLE ppii_score_history_component (
          history_id       BIGINT NOT NULL REFERENCES ppii_score_history(history_id) ON DELETE CASCADE,
          stream_code      VARCHAR(20) NOT NULL,
          raw_value        NUMERIC NOT NULL,
          PRIMARY KEY (history_id, stream_code)
        )
      `);
      console.log('  ✅ ppii_score_history_component created');

      // ── 2. Seed ppii_stream for wi_php ────────────────────────────────────
      // Max values from scorePPII.js PPII_MAXIMA. Source function names are
      // registry keys in pointers.js ppiiStreamFetchers (added in code refactor).
      const wiPhpStreams = [
        { code: 'pulse',      label: 'Provider Pulse', max: 42,  fn: 'fetchPulseRaw',      sort: 1, phase: 'pilot' },
        { code: 'ppsi',       label: 'PPSI Survey',    max: 102, fn: 'fetchPpsiRaw',       sort: 2, phase: 'pilot' },
        { code: 'compliance', label: 'Compliance',     max: 18,  fn: 'fetchComplianceRaw', sort: 3, phase: 'pilot' },
        { code: 'events',     label: 'Event Reporting',max: 3,   fn: 'fetchEventsRaw',     sort: 4, phase: 'pilot' },
      ];
      const tenantId = 5;
      for (const s of wiPhpStreams) {
        await client.query(
          `INSERT INTO ppii_stream (tenant_id, code, label, max_value, source_function, is_active, sort_order, added_in_phase)
           VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
          [tenantId, s.code, s.label, s.max, s.fn, s.sort, s.phase]
        );
      }
      console.log(`  ✅ Seeded ${wiPhpStreams.length} ppii_stream rows for tenant_id=${tenantId}`);

      // ── 3. Migrate sysparm ppii_weights → ppii_weight_set ─────────────────
      // Read the existing v57 sysparm rows so we don't lose any admin-edited
      // values. Falls back to the v57 seed defaults if the sysparm row is
      // missing (fresh install path — shouldn't happen post-v57 but safe).
      const sysparmResult = await client.query(`
        SELECT sd.code, CAST(sd.value AS NUMERIC) AS weight
          FROM sysparm s
          JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
         WHERE s.tenant_id = $1
           AND s.sysparm_key = 'ppii_weights'
           AND sd.category = 'stream'
      `, [tenantId]);

      let migrated = sysparmResult.rows;
      if (migrated.length === 0) {
        console.log(`  ⚠ No sysparm ppii_weights for tenant_id=${tenantId} — using v57 defaults`);
        migrated = [
          { code: 'pulse',      weight: 0.35 },
          { code: 'ppsi',       weight: 0.25 },
          { code: 'compliance', weight: 0.25 },
          { code: 'events',     weight: 0.15 },
        ];
      }

      // Verify every migrated stream code corresponds to a registered stream.
      const knownCodes = new Set(wiPhpStreams.map(s => s.code));
      for (const row of migrated) {
        if (!knownCodes.has(row.code)) {
          throw new Error(`sysparm ppii_weights has stream code '${row.code}' not in ppii_stream — refusing to migrate`);
        }
      }

      // Verify sum is 1.0 before creating the weight set.
      const sum = migrated.reduce((s, r) => s + Number(r.weight), 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new Error(`Migrated weights for tenant_id=${tenantId} sum to ${sum}, expected 1.0`);
      }

      const wsResult = await client.query(
        `INSERT INTO ppii_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current)
         VALUES ($1, NOW(), NULL, $2, true)
         RETURNING weight_set_id`,
        [tenantId, 'Initial weight set migrated from sysparm ppii_weights (v58 migration)']
      );
      const weightSetId = wsResult.rows[0].weight_set_id;
      console.log(`  ✅ Created ppii_weight_set #${weightSetId} for tenant_id=${tenantId}`);

      for (const row of migrated) {
        await client.query(
          `INSERT INTO ppii_weight_set_value (weight_set_id, stream_code, weight)
           VALUES ($1, $2, $3)`,
          [weightSetId, row.code, row.weight]
        );
      }
      console.log(`  ✅ Inserted ${migrated.length} ppii_weight_set_value rows (sum=${sum.toFixed(3)})`);

      // ── 4. Drop the v57 sysparm 'ppii_weights' row ────────────────────────
      // The new tables are now the source of truth. sysparm_detail rows
      // cascade-delete via FK ON DELETE CASCADE on sysparm_id.
      const dropResult = await client.query(
        `DELETE FROM sysparm WHERE sysparm_key = 'ppii_weights' RETURNING sysparm_id, tenant_id`
      );
      console.log(`  ✅ Dropped ${dropResult.rowCount} sysparm 'ppii_weights' row(s) (now lives in ppii_weight_set)`);

      // ── 5. In-transaction verification ────────────────────────────────────
      const verify = await client.query(`
        SELECT ws.tenant_id,
               COUNT(*) AS row_count,
               SUM(wsv.weight) AS total_weight
          FROM ppii_weight_set ws
          JOIN ppii_weight_set_value wsv USING (weight_set_id)
         WHERE ws.is_current = true
         GROUP BY ws.tenant_id
      `);
      for (const row of verify.rows) {
        const total = Number(row.total_weight);
        if (Math.abs(total - 1.0) > 0.001) {
          throw new Error(`Verification failed: tenant_id=${row.tenant_id} weights sum to ${total}, expected 1.0`);
        }
        console.log(`  ✅ Verified tenant_id=${row.tenant_id}: ${row.row_count} weight rows summing to ${total.toFixed(3)}`);
      }

      // Verify every weight_set_value.stream_code points at a real ppii_stream row.
      const orphanCheck = await client.query(`
        SELECT wsv.stream_code, ws.tenant_id
          FROM ppii_weight_set_value wsv
          JOIN ppii_weight_set ws USING (weight_set_id)
          LEFT JOIN ppii_stream ps
            ON ps.tenant_id = ws.tenant_id AND ps.code = wsv.stream_code
         WHERE ps.ppii_stream_id IS NULL
      `);
      if (orphanCheck.rows.length > 0) {
        throw new Error(`Orphaned weight rows referencing missing ppii_stream codes: ${JSON.stringify(orphanCheck.rows)}`);
      }
      console.log('  ✅ All weight_set_value rows reference valid ppii_stream codes');
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v59 — PPSI subdomain section weights (config-driven, mirrors v58 pattern).
  //
  // Adds three tables for the PPSI section-weight editor:
  //   ppsi_subdomain                       — per-tenant dictionary of sections
  //   ppsi_subdomain_weight_set            — versioned weight bundles (with
  //                                          is_factory_default flag for the
  //                                          Restore Defaults baseline)
  //   ppsi_subdomain_weight_set_value      — per-section weights (sum=1.0)
  //
  // Seeds the 8 wi_php PPSI sections (codes match survey_question_category.
  // category_code that scorePPSI / dominantDriver / extendedCardDetector
  // already join on: SLEEP, BURNOUT, WORK, ISOLATION, COGNITIVE, RECOVERY,
  // PURPOSE, GLOBAL).
  //
  // Seeds TWO weight sets for tenant 5: a factory-default row (equal 1/8
  // weights, is_factory_default=true, is_current=false) that the Restore
  // Defaults button reads from, and an editable current row (also equal
  // weights, is_factory_default=false, is_current=true). They diverge once
  // Erica edits.
  //
  // Existing member_survey.score values (PPSI raw sums) are NOT recomputed —
  // historical scores are preserved as calculated at submission time.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 59,
    description: 'PPSI subdomain weights + Option A section-normalized math',
    async run(client) {
      // ── 1. Tables ─────────────────────────────────────────────────────────
      await client.query(`
        CREATE TABLE ppsi_subdomain (
          subdomain_id     SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          tenant_id        SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          code             VARCHAR(20) NOT NULL,
          label            VARCHAR(50) NOT NULL,
          question_count   SMALLINT NOT NULL CHECK (question_count > 0),
          max_value        NUMERIC NOT NULL CHECK (max_value > 0),
          sort_order       SMALLINT NOT NULL DEFAULT 0,
          is_active        BOOLEAN NOT NULL DEFAULT true,
          UNIQUE (tenant_id, code)
        )
      `);
      console.log('  ✅ ppsi_subdomain created');

      await client.query(`
        CREATE TABLE ppsi_subdomain_weight_set (
          weight_set_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          tenant_id            SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          effective_from       TIMESTAMP NOT NULL,
          changed_by_user      INTEGER REFERENCES platform_user(user_id),
          change_note          TEXT,
          is_current           BOOLEAN NOT NULL DEFAULT false,
          is_factory_default   BOOLEAN NOT NULL DEFAULT false
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX ppsi_weight_set_current_per_tenant
          ON ppsi_subdomain_weight_set(tenant_id) WHERE is_current = true
      `);
      await client.query(`
        CREATE UNIQUE INDEX ppsi_weight_set_factory_per_tenant
          ON ppsi_subdomain_weight_set(tenant_id) WHERE is_factory_default = true
      `);
      console.log('  ✅ ppsi_subdomain_weight_set created (with partial unique indexes on is_current and is_factory_default)');

      await client.query(`
        CREATE TABLE ppsi_subdomain_weight_set_value (
          weight_set_id    INTEGER NOT NULL REFERENCES ppsi_subdomain_weight_set(weight_set_id) ON DELETE CASCADE,
          subdomain_code   VARCHAR(20) NOT NULL,
          weight           NUMERIC NOT NULL CHECK (weight BETWEEN 0 AND 1),
          PRIMARY KEY (weight_set_id, subdomain_code)
        )
      `);
      console.log('  ✅ ppsi_subdomain_weight_set_value created');

      // ── 2. Seed ppsi_subdomain for wi_php ─────────────────────────────────
      // Codes match the survey_question_category.category_code values that
      // scorePPSI.js / dominantDriver.js / extendedCardDetector.js already use.
      // Question counts and max values come from scorePPSI.js header comment.
      const wiPhpSubdomains = [
        { code: 'SLEEP',     label: 'Sleep Stability',                qs: 5, sort: 1 },
        { code: 'BURNOUT',   label: 'Emotional Exhaustion / Burnout', qs: 5, sort: 2 },
        { code: 'WORK',      label: 'Work Sustainability',            qs: 5, sort: 3 },
        { code: 'ISOLATION', label: 'Isolation + Support',            qs: 5, sort: 4 },
        { code: 'COGNITIVE', label: 'Cognitive Load',                 qs: 5, sort: 5 },
        { code: 'RECOVERY',  label: 'Recovery / Routine Stability',   qs: 4, sort: 6 },
        { code: 'PURPOSE',   label: 'Meaning + Purpose',              qs: 4, sort: 7 },
        { code: 'GLOBAL',    label: 'Global Stability Check',         qs: 1, sort: 8 },
      ];
      const tenantId = 5;
      for (const s of wiPhpSubdomains) {
        await client.query(
          `INSERT INTO ppsi_subdomain (tenant_id, code, label, question_count, max_value, sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [tenantId, s.code, s.label, s.qs, s.qs * 3, s.sort]
        );
      }
      const totalQs = wiPhpSubdomains.reduce((n, s) => n + s.qs, 0);
      const totalMax = wiPhpSubdomains.reduce((n, s) => n + s.qs * 3, 0);
      console.log(`  ✅ Seeded ${wiPhpSubdomains.length} ppsi_subdomain rows for tenant_id=${tenantId} (${totalQs} questions, max=${totalMax})`);

      // ── 3. Seed two weight sets: factory-default + current ───────────────
      // Both equal weights initially. They diverge once Erica edits.
      const equalWeight = 1 / wiPhpSubdomains.length; // 0.125
      const codes = wiPhpSubdomains.map(s => s.code);

      // Factory-default row — anchor for Restore Defaults. is_current=false.
      const factoryResult = await client.query(
        `INSERT INTO ppsi_subdomain_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current, is_factory_default)
         VALUES ($1, NOW(), NULL, $2, false, true)
         RETURNING weight_set_id`,
        [tenantId, 'Factory default — equal weights across all 8 PPSI subdomains (Erica baseline)']
      );
      const factoryId = factoryResult.rows[0].weight_set_id;
      for (const code of codes) {
        await client.query(
          `INSERT INTO ppsi_subdomain_weight_set_value (weight_set_id, subdomain_code, weight)
           VALUES ($1, $2, $3)`,
          [factoryId, code, equalWeight]
        );
      }
      console.log(`  ✅ Created factory-default ppsi_subdomain_weight_set #${factoryId} (equal weights, is_factory_default=true)`);

      // Current row — editable. Seeded with same equal weights initially.
      const currentResult = await client.query(
        `INSERT INTO ppsi_subdomain_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current, is_factory_default)
         VALUES ($1, NOW(), NULL, $2, true, false)
         RETURNING weight_set_id`,
        [tenantId, 'Initial PPSI subdomain weight set (v59 migration) — equal weights']
      );
      const currentId = currentResult.rows[0].weight_set_id;
      for (const code of codes) {
        await client.query(
          `INSERT INTO ppsi_subdomain_weight_set_value (weight_set_id, subdomain_code, weight)
           VALUES ($1, $2, $3)`,
          [currentId, code, equalWeight]
        );
      }
      console.log(`  ✅ Created current ppsi_subdomain_weight_set #${currentId} (equal weights, is_current=true)`);

      // ── 4. In-transaction verification ────────────────────────────────────
      const verify = await client.query(`
        SELECT ws.tenant_id,
               ws.weight_set_id,
               ws.is_current,
               ws.is_factory_default,
               COUNT(*) AS row_count,
               SUM(wsv.weight) AS total_weight
          FROM ppsi_subdomain_weight_set ws
          JOIN ppsi_subdomain_weight_set_value wsv USING (weight_set_id)
         WHERE ws.tenant_id = $1
         GROUP BY ws.tenant_id, ws.weight_set_id, ws.is_current, ws.is_factory_default
         ORDER BY ws.weight_set_id
      `, [tenantId]);
      for (const row of verify.rows) {
        const total = Number(row.total_weight);
        if (Math.abs(total - 1.0) > 0.001) {
          throw new Error(`Verification failed: weight_set_id=${row.weight_set_id} weights sum to ${total}, expected 1.0`);
        }
        const tag = [row.is_current && 'CURRENT', row.is_factory_default && 'FACTORY'].filter(Boolean).join('+') || 'historical';
        console.log(`  ✅ Verified weight_set_id=${row.weight_set_id} [${tag}]: ${row.row_count} rows summing to ${total.toFixed(3)}`);
      }

      // Verify every weight_set_value.subdomain_code points at a real ppsi_subdomain row.
      const orphanCheck = await client.query(`
        SELECT wsv.subdomain_code, ws.tenant_id
          FROM ppsi_subdomain_weight_set_value wsv
          JOIN ppsi_subdomain_weight_set ws USING (weight_set_id)
          LEFT JOIN ppsi_subdomain ps
            ON ps.tenant_id = ws.tenant_id AND ps.code = wsv.subdomain_code
         WHERE ps.subdomain_id IS NULL
      `);
      if (orphanCheck.rows.length > 0) {
        throw new Error(`Orphaned weight rows referencing missing ppsi_subdomain codes: ${JSON.stringify(orphanCheck.rows)}`);
      }
      console.log('  ✅ All weight_set_value rows reference valid ppsi_subdomain codes');

      // Sanity: confirm the partial unique indexes work — exactly one current,
      // exactly one factory-default for tenant 5.
      const dupCheck = await client.query(`
        SELECT
          SUM(CASE WHEN is_current = true THEN 1 ELSE 0 END) AS current_count,
          SUM(CASE WHEN is_factory_default = true THEN 1 ELSE 0 END) AS factory_count
          FROM ppsi_subdomain_weight_set
         WHERE tenant_id = $1
      `, [tenantId]);
      const { current_count, factory_count } = dupCheck.rows[0];
      if (Number(current_count) !== 1) throw new Error(`Expected 1 is_current row, found ${current_count}`);
      if (Number(factory_count) !== 1) throw new Error(`Expected 1 is_factory_default row, found ${factory_count}`);
      console.log(`  ✅ Tenant ${tenantId}: exactly 1 current + 1 factory_default weight set`);
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v60 — PPSI math version flag.
  //
  // The PPSI scorer is changing from raw-sum (0..102) to Option A (per-section
  // normalize → weight → sum → ×100, range 0..100). Old surveys were scored
  // under the legacy method; new ones get Option A. Their MEMBER_POINTS molecule
  // (5_data_54.n1) values share one column but represent two different metrics,
  // so readers need to know which one each row uses.
  //
  // This migration:
  //   1. Adds member_survey.score_math_version (1=legacy raw sum, 2=Option A).
  //      All existing rows backfill to 1 via DEFAULT.
  //   2. Updates ppii_stream.max_value=100 for the 'ppsi' stream so the
  //      composite math sees a single normalized scale. fetchPpsiRaw now
  //      branches on score_math_version: v=1 rows return raw*100/102, v=2
  //      rows return raw as-is.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 60,
    description: 'PPSI math version flag — track legacy raw-sum vs Option A per survey',
    async run(client) {
      // ── 1. Add score_math_version column ──────────────────────────────────
      await client.query(`
        ALTER TABLE member_survey
          ADD COLUMN score_math_version SMALLINT NOT NULL DEFAULT 1
          CHECK (score_math_version BETWEEN 1 AND 9)
      `);
      console.log('  ✅ member_survey.score_math_version added (default=1 for legacy rows)');

      const ms = await client.query(`SELECT COUNT(*) AS n FROM member_survey`);
      console.log(`  ✅ ${ms.rows[0].n} existing member_survey rows defaulted to score_math_version=1`);

      // ── 2. Update PPSI stream max_value to 100 ────────────────────────────
      // fetchPpsiRaw will normalize legacy v=1 raw sums (0..102) to 0..100 on
      // read. v=2 rows are already 0..100. With max_value=100, composer math
      // is consistent across both.
      const update = await client.query(`
        UPDATE ppii_stream SET max_value = 100
         WHERE code = 'ppsi'
         RETURNING tenant_id, code, max_value
      `);
      for (const row of update.rows) {
        console.log(`  ✅ ppii_stream max_value=${row.max_value} for tenant_id=${row.tenant_id} code=${row.code}`);
      }

      // ── 3. Verify ─────────────────────────────────────────────────────────
      const verify = await client.query(`
        SELECT score_math_version, COUNT(*) AS row_count
          FROM member_survey
         GROUP BY score_math_version
         ORDER BY score_math_version
      `);
      for (const row of verify.rows) {
        console.log(`  ✅ ${row.row_count} member_survey rows at score_math_version=${row.score_math_version}`);
      }
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v61 — Backfill PPSI history component raw_value from 0..102 → 0..100.
  //
  // ppii_score_history_component was written by recordPpiiSnapshot with the
  // ppsiRaw value at calc time. Pre-v60 ppsiRaw was the legacy raw sum on a
  // 0..102 scale; v60 onward it's normalized to 0..100 (math-version-aware).
  // The recalculate-everyone endpoint reads these components and multiplies
  // by current weights with PPII_MAXIMA.ppsi=100 — so legacy 102-scale rows
  // would over-normalize. Rescaling once here brings every row onto the new
  // 100-scale.
  //
  // Bounded scope: only stream_code='ppsi' rows; the other streams (pulse=42,
  // compliance=18, events=3) are unchanged.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 61,
    description: 'Rescale legacy PPSI score-history components from 0..102 to 0..100',
    async run(client) {
      const result = await client.query(`
        UPDATE ppii_score_history_component
           SET raw_value = ROUND(raw_value * 100.0 / 102.0)
         WHERE stream_code = 'ppsi'
        RETURNING history_id
      `);
      console.log(`  ✅ Rescaled ${result.rowCount} ppsi component row(s) to 0..100`);

      const verify = await client.query(`
        SELECT MIN(raw_value) AS min_raw,
               MAX(raw_value) AS max_raw,
               COUNT(*)       AS row_count
          FROM ppii_score_history_component
         WHERE stream_code = 'ppsi'
      `);
      const v = verify.rows[0];
      if (Number(v.row_count) > 0 && Number(v.max_raw) > 100) {
        throw new Error(`Verification failed: max ppsi raw_value after rescale = ${v.max_raw}, expected ≤ 100`);
      }
      console.log(`  ✅ ppsi raw_value range now [${v.min_raw}, ${v.max_raw}] across ${v.row_count} component rows`);
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v62 — wi_php (Insight) CSR templates parity with the Delta pattern.
  //
  // Cleans up + extends the Wisconsin PHP tenant's input/display templates so
  // the CSR activity page can render Member-profile rows, edit healthcare-
  // specific member attributes (clinic / licensing board / assigned staff /
  // is_clinician), and accept Adjustment activities — all of which Delta has
  // and wi_php was missing or had broken.
  //
  // Specifically:
  //   1. Drop the two duplicate-and-empty M-type display templates that were
  //      left over from earlier seeding (template_id 20 and 21 — both have
  //      template_type='E', activity_type='M', and zero lines).
  //   2. Insert a clean Member Profile (E) display template + 1 line.
  //   3. Insert a Member Profile (V) display template + 4 lines.
  //   4. Add LICENSING_BOARD, ASSIGNED_CLINICIAN, IS_CLINICIAN fields to the
  //      existing "Physician Member Template" (M-type input). PARTNER_PROGRAM
  //      stays as the first field, but its width drops 100→50 so the new
  //      board field fits beside it on the same row.
  //   5. Insert a J-type "Healthcare Adjustment Entry" input template +
  //      single ADJUSTMENT field (mirrors Delta's J input exactly).
  //   6. Insert J-type Adjustment display templates E + V (mirrors Delta).
  //
  // Schema-only changes for templates — no schema migrations needed; all of
  // these tables exist already.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 62,
    description: 'wi_php CSR templates: fix M-display dup + add Member/Adjustment templates',
    async run(client) {
      const tenantId = 5;

      // ── 0. Repair any stale sequences ─────────────────────────────────────
      // display_template_line_line_id_seq is at 57 but MAX(line_id) is 58 —
      // a row was inserted manually outside the sequence at some point, so
      // nextval() collides on the very next INSERT. Re-anchor all four
      // sequences to MAX+1 before we INSERT below. setval(..., false) makes
      // the next nextval() return the supplied value, so we pass MAX(id)+1
      // to skip past anything already there.
      const seqs = [
        ['display_template_template_id_seq',         'display_template',         'template_id'],
        ['display_template_line_line_id_seq',        'display_template_line',    'line_id'],
        ['input_template_template_id_seq',           'input_template',           'template_id'],
        ['input_template_field_field_id_seq',        'input_template_field',     'field_id'],
        ['input_template_line_line_id_seq',          'input_template_line',      'line_id']
      ];
      for (const [seq, tbl, col] of seqs) {
        const m = await client.query(`SELECT COALESCE(MAX(${col}), 0) AS max_id FROM ${tbl}`);
        const target = Number(m.rows[0].max_id) + 1;
        await client.query(`SELECT setval($1, $2, false)`, [seq, target]);
      }
      console.log(`  ✅ Re-anchored ${seqs.length} sequences past their current MAX values`);

      // ── 1. Drop duplicate empty M-type display templates ──────────────────
      // ON DELETE CASCADE on display_template_line takes care of orphaned lines
      // automatically. We delete by tenant + template_type='E' + activity_type='M'
      // *and* zero line count, so we don't accidentally drop a populated row a
      // human added later.
      const dropRes = await client.query(`
        DELETE FROM display_template
         WHERE tenant_id = $1
           AND template_type = 'E'
           AND activity_type = 'M'
           AND template_id NOT IN (
             SELECT template_id FROM display_template_line
           )
        RETURNING template_id
      `, [tenantId]);
      console.log(`  ✅ Dropped ${dropRes.rowCount} empty M-type display template(s) — ids: [${dropRes.rows.map(r => r.template_id).join(', ')}]`);

      // ── 2. Member Profile Efficient (E) — single-line dashboard skim ──────
      const meRes = await client.query(`
        INSERT INTO display_template (tenant_id, template_name, template_type, activity_type, is_active)
        VALUES ($1, 'Member Profile Efficient', 'E', 'M', true)
        RETURNING template_id
      `, [tenantId]);
      const mEId = meRes.rows[0].template_id;
      await client.query(`
        INSERT INTO display_template_line (template_id, line_number, template_string)
        VALUES ($1, 10, $2)
      `, [
        mEId,
        '[T,"Clinic: "],[M,PARTNER_PROGRAM,"Description"],[T,"   Board: "],[M,LICENSING_BOARD,"Description"],[T,"   Staff: "],[M,ASSIGNED_CLINICIAN,"Description"]'
      ]);
      console.log(`  ✅ Created Member Profile Efficient (E,M) template_id=${mEId} with 1 line`);

      // ── 3. Member Profile Verbose (V) — multi-line clinical context ───────
      const mvRes = await client.query(`
        INSERT INTO display_template (tenant_id, template_name, template_type, activity_type, is_active)
        VALUES ($1, 'Member Profile Verbose', 'V', 'M', true)
        RETURNING template_id
      `, [tenantId]);
      const mVId = mvRes.rows[0].template_id;
      const mvLines = [
        [10, '[T,"Clinic: "],[M,PARTNER_PROGRAM,"Both"]'],
        [20, '[T,"Licensing Board: "],[M,LICENSING_BOARD,"Both"]'],
        [30, '[T,"Assigned Staff: "],[M,ASSIGNED_CLINICIAN,"Description"],[T,"   Tier: "],[M,TIER,"Description"]'],
        [40, '[T,"ML Risk: "],[M,ML_RISK_LEVEL,"Description"],[T," ("],[M,ML_RISK_SCORE,"Code"],[T,"%, conf "],[M,ML_CONFIDENCE,"Code"],[T,")"]']
      ];
      for (const [n, str] of mvLines) {
        await client.query(
          `INSERT INTO display_template_line (template_id, line_number, template_string) VALUES ($1, $2, $3)`,
          [mVId, n, str]
        );
      }
      console.log(`  ✅ Created Member Profile Verbose (V,M) template_id=${mVId} with ${mvLines.length} lines`);

      // ── 4. Expand the Physician Member input template ─────────────────────
      // Before: 1 row with PARTNER_PROGRAM at start_pos=1, width=100.
      // After:  Row 10 → PARTNER_PROGRAM (1, 50) + LICENSING_BOARD (51, 50)
      //         Row 20 → ASSIGNED_CLINICIAN (1, 50) + IS_CLINICIAN (51, 50)
      // Resolve template_id by name+tenant — IDENTITY column means we can't
      // hardcode it across environments.
      const physMemRes = await client.query(`
        SELECT template_id FROM input_template
         WHERE tenant_id = $1 AND activity_type = 'M' AND template_name = 'Physician Member Template'
      `, [tenantId]);
      if (physMemRes.rows.length === 0) {
        throw new Error('Expected Physician Member Template input row not found');
      }
      const physMemId = physMemRes.rows[0].template_id;

      // Shrink existing PARTNER_PROGRAM row to width 50 so a second field fits
      // alongside it on row 10.
      await client.query(`
        UPDATE input_template_field
           SET display_width = 50, display_label = 'Clinic'
         WHERE template_id = $1 AND molecule_key = 'PARTNER_PROGRAM'
      `, [physMemId]);
      console.log(`  ✅ Resized PARTNER_PROGRAM field on Physician Member input (width 100 → 50, label "Clinic")`);

      const physMemNewFields = [
        // [row_number, sort_order, molecule_key, label, start_pos, width, enterable, is_required]
        [10, 20, 'LICENSING_BOARD',     'Licensing Board',     51,  50, 'Y', false],
        [20, 10, 'ASSIGNED_CLINICIAN',  'Assigned Staff',       1,  50, 'Y', false],
        [20, 20, 'IS_CLINICIAN',        'Is Clinician',        51,  50, 'Y', false]
      ];
      for (const [row, sort, mol, label, start, width, ent, req] of physMemNewFields) {
        await client.query(`
          INSERT INTO input_template_field
            (template_id, row_number, sort_order, molecule_key, display_label, start_position, display_width, enterable, is_required)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [physMemId, row, sort, mol, label, start, width, ent, req]);
      }
      console.log(`  ✅ Added ${physMemNewFields.length} fields to Physician Member input template_id=${physMemId}`);

      // ── 5. J-type Healthcare Adjustment input template (mirror Delta) ─────
      const adjInputRes = await client.query(`
        INSERT INTO input_template (tenant_id, template_name, activity_type, is_active)
        VALUES ($1, 'Healthcare Adjustment Entry', 'J', true)
        RETURNING template_id
      `, [tenantId]);
      const adjInputId = adjInputRes.rows[0].template_id;
      await client.query(`
        INSERT INTO input_template_field
          (template_id, row_number, sort_order, molecule_key, display_label, start_position, display_width, enterable, is_required)
        VALUES ($1, 10, 1, 'ADJUSTMENT', NULL, 1, 50, 'Y', true)
      `, [adjInputId]);
      console.log(`  ✅ Created Healthcare Adjustment Entry (J) input template_id=${adjInputId}`);

      // ── 6. J-type Adjustment display templates E + V (mirror Delta) ───────
      const adjEffRes = await client.query(`
        INSERT INTO display_template (tenant_id, template_name, template_type, activity_type, is_active)
        VALUES ($1, 'Adjustment Efficient', 'E', 'J', true)
        RETURNING template_id
      `, [tenantId]);
      const adjEffId = adjEffRes.rows[0].template_id;
      await client.query(
        `INSERT INTO display_template_line (template_id, line_number, template_string) VALUES ($1, 10, '[M,ADJUSTMENT,"Both"]')`,
        [adjEffId]
      );
      console.log(`  ✅ Created Adjustment Efficient (E,J) display template_id=${adjEffId}`);

      const adjVerRes = await client.query(`
        INSERT INTO display_template (tenant_id, template_name, template_type, activity_type, is_active)
        VALUES ($1, 'Adjustment Verbose', 'V', 'J', true)
        RETURNING template_id
      `, [tenantId]);
      const adjVerId = adjVerRes.rows[0].template_id;
      await client.query(
        `INSERT INTO display_template_line (template_id, line_number, template_string) VALUES ($1, 10, '[M,ADJUSTMENT,"Both"]'), ($1, 20, '[M,ACTIVITY_COMMENT,"Code"]')`,
        [adjVerId]
      );
      console.log(`  ✅ Created Adjustment Verbose (V,J) display template_id=${adjVerId} with 2 lines`);

      // ── 7. In-transaction sanity verification ─────────────────────────────
      const verifyDisplay = await client.query(`
        SELECT template_type, activity_type, COUNT(*) AS template_count
          FROM display_template
         WHERE tenant_id = $1
         GROUP BY template_type, activity_type
         ORDER BY activity_type, template_type
      `, [tenantId]);
      console.log('  ── Display templates after migration ──');
      for (const r of verifyDisplay.rows) {
        console.log(`     ${r.activity_type} ${r.template_type}: ${r.template_count}`);
      }
      // Each (activity_type, template_type) for wi_php should be unique now.
      for (const r of verifyDisplay.rows) {
        if (Number(r.template_count) !== 1) {
          throw new Error(`Verification failed: tenant ${tenantId} has ${r.template_count} display templates for activity_type=${r.activity_type} template_type=${r.template_type}`);
        }
      }

      const verifyInput = await client.query(`
        SELECT activity_type, COUNT(*) AS template_count
          FROM input_template
         WHERE tenant_id = $1
         GROUP BY activity_type
         ORDER BY activity_type
      `, [tenantId]);
      console.log('  ── Input templates after migration ──');
      for (const r of verifyInput.rows) {
        console.log(`     ${r.activity_type}: ${r.template_count}`);
      }
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v63 — Reverse v62: wi_php uses only A-type activities, drop all J/M templates.
  //
  // v62 mistakenly created J (Adjustment) and M (Promotion / Member Profile)
  // templates for wi_php based on a misread of the activity_type semantics.
  // wi_php is a "main activity only" tenant — every healthcare event is an
  // A-type accrual. There are no J adjustments and no M promotions, so the
  // J/M templates render against activity types that don't exist for the
  // tenant.
  //
  // This migration removes every non-A template for tenant 5, including:
  //   - The 4 display templates v62 added (Member Profile E + V, Adjustment
  //     E + V).
  //   - The Healthcare Adjustment Entry input template v62 added.
  //   - The pre-existing Physician Member Template input template (template
  //     6) — it predates this session, but lives under the same flawed
  //     premise that wi_php has M-type activities.
  //
  // Deletes are scoped by (tenant_id, activity_type IN ('J','M')) rather than
  // hardcoded template_ids so the migration stays correct if these IDs differ
  // across environments. ON DELETE CASCADE on display_template_line and
  // input_template_field handles the children automatically.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 63,
    description: 'wi_php cleanup: drop J/M templates — tenant only uses A-type activities',
    async run(client) {
      const tenantId = 5;

      // ── 1. Drop non-A display templates ───────────────────────────────────
      const dispRes = await client.query(`
        DELETE FROM display_template
         WHERE tenant_id = $1 AND activity_type IN ('J','M')
        RETURNING template_id, template_name, template_type, activity_type
      `, [tenantId]);
      console.log(`  ✅ Dropped ${dispRes.rowCount} non-A display template(s):`);
      for (const r of dispRes.rows) {
        console.log(`     id=${r.template_id} (${r.activity_type} ${r.template_type}) "${r.template_name}"`);
      }

      // ── 2. Drop non-A input templates ─────────────────────────────────────
      const inpRes = await client.query(`
        DELETE FROM input_template
         WHERE tenant_id = $1 AND activity_type IN ('J','M')
        RETURNING template_id, template_name, activity_type
      `, [tenantId]);
      console.log(`  ✅ Dropped ${inpRes.rowCount} non-A input template(s):`);
      for (const r of inpRes.rows) {
        console.log(`     id=${r.template_id} (${r.activity_type}) "${r.template_name}"`);
      }

      // ── 3. Verify final state ─────────────────────────────────────────────
      const verifyDisplay = await client.query(`
        SELECT activity_type, template_type, COUNT(*) AS cnt
          FROM display_template
         WHERE tenant_id = $1
         GROUP BY activity_type, template_type
         ORDER BY activity_type, template_type
      `, [tenantId]);
      console.log('  ── Display templates remaining ──');
      for (const r of verifyDisplay.rows) {
        console.log(`     ${r.activity_type} ${r.template_type}: ${r.cnt}`);
        if (r.activity_type !== 'A') {
          throw new Error(`Verification failed: tenant ${tenantId} still has ${r.activity_type}-type display template after cleanup`);
        }
      }

      const verifyInput = await client.query(`
        SELECT activity_type, COUNT(*) AS cnt
          FROM input_template
         WHERE tenant_id = $1
         GROUP BY activity_type
         ORDER BY activity_type
      `, [tenantId]);
      console.log('  ── Input templates remaining ──');
      for (const r of verifyInput.rows) {
        console.log(`     ${r.activity_type}: ${r.cnt}`);
        if (r.activity_type !== 'A') {
          throw new Error(`Verification failed: tenant ${tenantId} still has ${r.activity_type}-type input template after cleanup`);
        }
      }

      console.log(`  ✅ wi_php now A-only: ${verifyDisplay.rows.length} display template(s), ${verifyInput.rows.length} input template(s)`);
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v64 — Seed engineered PPSI history for the Insight Recovery clinic.
  //
  // v49 created the Recovery clinic personas with registry items + follow-ups
  // + drug-test data, but never seeded any PPSI surveys for them. Their
  // physician_detail charts show no trend graph (correctly — there's nothing
  // to plot), no PPSI scores in wellness/members, no PPII composite. Erica
  // flagged it during testing.
  //
  // For each participant who needs PPSI history, this migration writes 4
  // weekly surveys with answer patterns engineered to produce a score
  // trajectory that matches their assigned registry persona. Joy gets a
  // recent BURNOUT spike, Solace a recent COGNITIVE spike, Haven shows
  // recovery from earlier ISOLATION elevation, Sterling shows progressive
  // composite decline, etc. Healthy controls get a stable low baseline.
  //
  // Skipped:
  //   - Victor Stillman (#48) — his persona IS missed surveys (MEDS driver),
  //     so he correctly has no history.
  //   - Sarah Chen, Marcus Rivera — they are clinical staff (IS_CLINICIAN),
  //     not participants.
  //
  // Each survey writes:
  //   - 1 member_survey row (score_math_version=2 — Option A)
  //   - 34 member_survey_answer rows (one per PPSI question)
  //   - 1 activity row (type='A')
  //   - molecules: ACCRUAL_TYPE='SURVEY', MEMBER_SURVEY_LINK→msLink,
  //     MEMBER_POINTS=Option-A-score
  //   - 1 ppii_score_history row + per-stream component rows so the
  //     "Previous PPII" chart line works
  //
  // Score is computed in JS using the same Option A math the live scorer
  // uses (per-section sum / max → fraction × weight → sum × 100), against
  // the tenant's CURRENT ppsi_subdomain_weight_set values. That guarantees
  // the seeded score equals what re-running the scorer on the same answers
  // would produce.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 64,
    description: 'Seed engineered PPSI history for Insight Recovery participants (Erica feedback — trend graphs)',
    async run(client) {
      const TENANT = 5;

      // ── Bill epoch today (SMALLINT days since 1959-12-03, offset −32768)
      const epoch = new Date(1959, 11, 3);
      const today = Math.floor((Date.now() - epoch.getTime()) / (24 * 60 * 60 * 1000)) - 32768;

      // ── Squish encoder (matches v49 / pointers.js)
      function squish(value, bytes) {
        const chars = [];
        let remaining = value;
        for (let i = 0; i < bytes; i++) {
          chars.unshift(String.fromCharCode((remaining % 127) + 1));
          remaining = Math.floor(remaining / 127);
        }
        return chars.join('');
      }

      // ── Link allocator — use the platform's shared getNextLink.
      // It auto-discovers link column type and self-creates the link_tank
      // row on first call, so we don't need to know per-table whether the
      // link is INTEGER, SMALLINT, or squished CHAR.

      // ── Resolve PPSI survey + its 34 questions, indexed by category
      const ppsiSurvey = await client.query(
        `SELECT link FROM survey WHERE tenant_id=$1 AND survey_code='PPSI'`,
        [TENANT]
      );
      if (!ppsiSurvey.rows.length) throw new Error('PPSI survey not found for tenant 5');
      const ppsiSurveyLink = ppsiSurvey.rows[0].link;

      // The 34 PPSI questions are q_link 1..34 in this seed (verified in
      // current data; per scorePPSI.js spec: SLEEP/BURNOUT/WORK/ISOLATION/
      // COGNITIVE 5 each, RECOVERY/PURPOSE 4 each, GLOBAL 1).
      const ppsiQuestions = await client.query(
        `SELECT sq.link AS qlink, sqc.category_code
           FROM survey_question sq
           JOIN survey_question_category sqc ON sqc.link = sq.category_link
          WHERE sq.tenant_id = $1 AND sq.link BETWEEN 1 AND 34
          ORDER BY sq.link`,
        [TENANT]
      );
      if (ppsiQuestions.rows.length !== 34) {
        throw new Error(`Expected 34 PPSI questions for tenant ${TENANT}, found ${ppsiQuestions.rows.length}`);
      }
      // Build category → [qlink list] map
      const QBY = {};
      for (const r of ppsiQuestions.rows) {
        if (!QBY[r.category_code]) QBY[r.category_code] = [];
        QBY[r.category_code].push(r.qlink);
      }

      // ── Per-section max values (matches scorePPSI.js header + ppsi_subdomain)
      const SECTION_MAX = {
        SLEEP: 15, BURNOUT: 15, WORK: 15, ISOLATION: 15, COGNITIVE: 15,
        RECOVERY: 12, PURPOSE: 12, GLOBAL: 3
      };

      // ── Current section weights (Option A math source of truth)
      const wRows = await client.query(
        `SELECT wsv.subdomain_code, wsv.weight
           FROM ppsi_subdomain_weight_set ws
           JOIN ppsi_subdomain_weight_set_value wsv USING (weight_set_id)
          WHERE ws.tenant_id=$1 AND ws.is_current=true`,
        [TENANT]
      );
      const WEIGHTS = {};
      let weightSetId = null;
      for (const r of wRows.rows) WEIGHTS[r.subdomain_code] = Number(r.weight);
      const cwsRow = await client.query(
        `SELECT weight_set_id FROM ppsi_subdomain_weight_set WHERE tenant_id=$1 AND is_current=true`,
        [TENANT]
      );
      weightSetId = cwsRow.rows[0]?.weight_set_id;
      const ppiiCwsRow = await client.query(
        `SELECT weight_set_id FROM ppii_weight_set WHERE tenant_id=$1 AND is_current=true`,
        [TENANT]
      );
      const ppiiWeightSetId = ppiiCwsRow.rows[0]?.weight_set_id;
      if (!ppiiWeightSetId) throw new Error('No current ppii_weight_set for tenant 5 (need it for ppii_score_history.weight_set_id)');

      // ── Pattern definitions: each pattern produces a per-section answer
      // value (each question in the section gets that same value). Returns
      // null for sections we want randomized; here all uniform for
      // reproducibility.
      const PATTERNS = {
        // Stable low baseline. All 1s except GLOBAL which gets 0.
        healthy:           { SLEEP: 1, BURNOUT: 1, WORK: 1, ISOLATION: 1, COGNITIVE: 1, RECOVERY: 1, PURPOSE: 1, GLOBAL: 0 },
        // Burnout-driven elevation. BURNOUT all 3, others mild.
        burnout_spike:     { SLEEP: 2, BURNOUT: 3, WORK: 2, ISOLATION: 1, COGNITIVE: 1, RECOVERY: 1, PURPOSE: 1, GLOBAL: 1 },
        // Cognitive elevation. COGNITIVE all 3, others mild.
        cognitive_spike:   { SLEEP: 1, BURNOUT: 1, WORK: 1, ISOLATION: 1, COGNITIVE: 3, RECOVERY: 1, PURPOSE: 1, GLOBAL: 1 },
        // Isolation elevation (Haven's earlier state).
        isolation_spike:   { SLEEP: 1, BURNOUT: 1, WORK: 1, ISOLATION: 3, COGNITIVE: 1, RECOVERY: 1, PURPOSE: 1, GLOBAL: 1 },
        // Composite high — Sterling's recent state.
        composite_high:    { SLEEP: 2, BURNOUT: 2, WORK: 2, ISOLATION: 2, COGNITIVE: 3, RECOVERY: 2, PURPOSE: 2, GLOBAL: 2 },
        // Recovering — Haven's "after" state (back near baseline).
        recovering:        { SLEEP: 1, BURNOUT: 1, WORK: 1, ISOLATION: 1, COGNITIVE: 1, RECOVERY: 1, PURPOSE: 1, GLOBAL: 0 }
      };

      // ── Apply pattern → returns { answers: { qlink: '0'..'3' }, optionAScore: 0..100 }
      function applyPattern(patternName) {
        const p = PATTERNS[patternName];
        if (!p) throw new Error(`Unknown pattern '${patternName}'`);
        const answers = {};
        const sectionSums = {};
        for (const cat of Object.keys(SECTION_MAX)) {
          const v = p[cat];
          sectionSums[cat] = 0;
          for (const qlink of (QBY[cat] || [])) {
            answers[qlink] = String(v);
            sectionSums[cat] += v;
          }
        }
        // Option A score: per-section fraction × weight, summed, × 100.
        let weighted = 0;
        for (const cat of Object.keys(SECTION_MAX)) {
          const max = SECTION_MAX[cat];
          const w = Number(WEIGHTS[cat] ?? 0);
          if (max > 0 && (QBY[cat] || []).length > 0) {
            weighted += (sectionSums[cat] / max) * w;
          }
        }
        const optionAScore = Math.round(weighted * 100);
        return { answers, sectionSums, optionAScore };
      }

      // ── Per-participant survey config
      // Each entry: an array of [offsetDays, patternName] tuples. Earliest
      // offset first, most recent last.
      const PLAN = [
        // Joy Summerlin — ORANGE, PPSI/BURNOUT — recent burnout spike
        { mn: '55', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['1', 'burnout_spike']] },
        // Solace Greystone — YELLOW, PPSI/COGNITIVE — recent cognitive spike
        { mn: '56', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['2', 'cognitive_spike']] },
        // Haven Restor — resolved YELLOW, PPSI/ISOLATION — recovery trajectory
        { mn: '54', surveys: [['28', 'isolation_spike'], ['21', 'isolation_spike'], ['14', 'recovering'], ['3', 'recovering']] },
        // Sterling Brightwell — RED, COMPOSITE — progressive decline
        { mn: '50', surveys: [['28', 'healthy'], ['21', 'burnout_spike'], ['14', 'burnout_spike'], ['1', 'composite_high']] },
        // Dawn Shepherd — ORANGE, PULSE driver — flat baseline (PPSI not the story)
        { mn: '49', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['5', 'healthy']] },
        // Phoenix Ashmore — YELLOW, COMPLIANCE driver — flat baseline
        { mn: '52', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['3', 'healthy']] },
        // Grant Steadman — SENTINEL, EVENTS driver — flat baseline
        { mn: '53', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['1', 'healthy']] },
        // Hope Clearwater — green-comply (drug tests) — stable
        { mn: '47', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['7', 'healthy']] },
        // Grace Newfield — green control — stable
        { mn: '46', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['7', 'healthy']] },
        // Faith Mercer — green control — stable
        { mn: '51', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['7', 'healthy']] }
      ];

      // ── Resolve molecule_ids
      const mols = await client.query(
        `SELECT molecule_key, molecule_id FROM molecule_def
          WHERE tenant_id=$1
            AND molecule_key IN ('MEMBER_POINTS', 'MEMBER_SURVEY_LINK', 'ACCRUAL_TYPE')`,
        [TENANT]
      );
      const MID = {};
      for (const r of mols.rows) MID[r.molecule_key] = r.molecule_id;
      // ACCRUAL_TYPE='SURVEY' encoded squish: value_id=1, c1 = chr(value_id+1) = chr(2)
      const ACCRUAL_SURVEY_C1 = String.fromCharCode(2);

      // ── Resolve member links + names for the planned participants
      const memberRows = await client.query(
        `SELECT link, membership_number, fname, lname FROM member
          WHERE tenant_id=$1 AND membership_number = ANY($2::varchar[])`,
        [TENANT, PLAN.map(p => p.mn)]
      );
      const MBYNUM = {};
      for (const r of memberRows.rows) MBYNUM[r.membership_number] = r;
      for (const p of PLAN) {
        if (!MBYNUM[p.mn]) throw new Error(`Recovery participant #${p.mn} not found in tenant ${TENANT}`);
      }

      // ── Drive the seed
      let surveysWritten = 0, answersWritten = 0, activitiesWritten = 0, snapshotsWritten = 0;
      for (const p of PLAN) {
        const m = MBYNUM[p.mn];
        for (const [offsetDays, patternName] of p.surveys) {
          const offset = Number(offsetDays);
          const billDay = today - offset;
          // member_survey.start_ts / end_ts is in 10-second blocks since Bill
          // epoch (per v55). 1 day = 8640 such blocks.
          const startTs = (billDay + 32768) * 8640;
          const endTs = startTs;
          const { answers, sectionSums, optionAScore } = applyPattern(patternName);

          // 1) member_survey row (link returned as raw INTEGER)
          const msLink = await getNextLink(client, TENANT, 'member_survey');
          await client.query(
            `INSERT INTO member_survey (link, member_link, survey_link, start_ts, end_ts, score_math_version)
             VALUES ($1, $2, $3, $4, $5, 2)`,
            [msLink, m.link, ppsiSurveyLink, startTs, endTs]
          );
          surveysWritten++;

          // 2) member_survey_answer rows × 34 (links are raw INTEGER)
          for (const [qlinkStr, ans] of Object.entries(answers)) {
            const qlink = parseInt(qlinkStr);
            const aLink = await getNextLink(client, TENANT, 'member_survey_answer');
            await client.query(
              `INSERT INTO member_survey_answer (link, member_survey_link, question_link, answer)
               VALUES ($1, $2, $3, $4)`,
              [aLink, msLink, qlink, ans]
            );
            answersWritten++;
          }

          // 3) activity row (link returned as squish-encoded CHAR(5))
          const actLink = await getNextLink(client, TENANT, 'activity');
          await client.query(
            `INSERT INTO activity (link, p_link, activity_date, activity_type)
             VALUES ($1, $2, $3, 'A')`,
            [actLink, m.link, billDay]
          );
          activitiesWritten++;

          // 3a) MEMBER_POINTS molecule (5_data_54.n1 = score)
          await client.query(
            `INSERT INTO "5_data_54" (p_link, attaches_to, molecule_id, c1, n1) VALUES ($1, 'A', $2, $3, $4)`,
            [actLink, MID.MEMBER_POINTS, '', optionAScore]
          );
          // 3b) MEMBER_SURVEY_LINK molecule (5_data_4.n1 = msLink)
          await client.query(
            `INSERT INTO "5_data_4" (p_link, attaches_to, molecule_id, n1) VALUES ($1, 'A', $2, $3)`,
            [actLink, MID.MEMBER_SURVEY_LINK, msLink]
          );
          // 3c) ACCRUAL_TYPE molecule (5_data_1.c1 = squish-encoded SURVEY)
          await client.query(
            `INSERT INTO "5_data_1" (p_link, attaches_to, molecule_id, c1) VALUES ($1, 'A', $2, $3)`,
            [actLink, MID.ACCRUAL_TYPE, ACCRUAL_SURVEY_C1]
          );

          // 4) ppii_score_history snapshot — composite is just the PPSI
          // contribution since this is a SURVEY trigger and other streams
          // are absent at seed time. weight_set_id is the CURRENT ppii
          // weight set so the chart's "Previous" rule treats these as
          // current-snapshot data (not stale).
          const histRes = await client.query(
            `INSERT INTO ppii_score_history (tenant_id, p_link, computed_at, ppii_score, weight_set_id, trigger_type)
             VALUES ($1, $2, NOW() - INTERVAL '${offset} days', $3, $4, 'SURVEY')
             RETURNING history_id`,
            [TENANT, m.link, optionAScore, ppiiWeightSetId]
          );
          const historyId = histRes.rows[0].history_id;
          await client.query(
            `INSERT INTO ppii_score_history_component (history_id, stream_code, raw_value)
             VALUES ($1, 'ppsi', $2)`,
            [historyId, optionAScore]
          );
          snapshotsWritten++;
        }
      }

      console.log(`  ✅ Seeded ${PLAN.length} Recovery participant${PLAN.length === 1 ? '' : 's'}:`);
      for (const p of PLAN) {
        const m = MBYNUM[p.mn];
        console.log(`     #${p.mn} ${m.fname} ${m.lname}: ${p.surveys.length} surveys, patterns ${p.surveys.map(s => s[1]).join(' → ')}`);
      }
      console.log(`  ✅ Total writes: ${surveysWritten} member_survey, ${answersWritten} member_survey_answer, ${activitiesWritten} activity, ${snapshotsWritten} ppii_score_history`);
      console.log(`  ℹ️  Skipped Victor Stillman (#48) — his persona IS missed surveys`);

      // ── Verification
      const verify = await client.query(
        `SELECT COUNT(*) AS c FROM member_survey ms
           JOIN survey s ON s.link = ms.survey_link
          WHERE ms.member_link IN (
                  SELECT link FROM member WHERE tenant_id=$1 AND membership_number = ANY($2::varchar[])
                )
            AND s.survey_code = 'PPSI'
            AND ms.score_math_version = 2`,
        [TENANT, PLAN.map(p => p.mn)]
      );
      const expected = PLAN.reduce((n, p) => n + p.surveys.length, 0);
      const got = Number(verify.rows[0].c);
      if (got !== expected) {
        throw new Error(`Verification failed: expected ${expected} new PPSI surveys, found ${got}`);
      }
      console.log(`  ✅ Verified ${got} PPSI surveys (score_math_version=2) for Recovery participants`);

      // Score range sanity
      const range = await client.query(
        `SELECT MIN(d54.n1) AS lo, MAX(d54.n1) AS hi
           FROM "5_data_54" d54
           JOIN activity a ON a.link = d54.p_link
          WHERE a.p_link IN (
                  SELECT link FROM member WHERE tenant_id=$1 AND membership_number = ANY($2::varchar[])
                )
            AND d54.molecule_id = $3
            AND a.activity_date >= $4`,
        [TENANT, PLAN.map(p => p.mn), MID.MEMBER_POINTS, today - 30]
      );
      console.log(`  ✅ MEMBER_POINTS for new accruals: range [${range.rows[0].lo}..${range.rows[0].hi}] (Option A scale 0..100)`);
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
