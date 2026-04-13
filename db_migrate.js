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
const TARGET_VERSION = 52;

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
      const ML_RISK_LEVEL_MOL = await molId('ML_RISK_LEVEL');

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
        // ML_RISK_LEVEL is storage_size 22 with value_type text_direct
        // Actually ML_RISK_LEVEL uses c1 in "5_data_22" for text — let me check
        // Looking at research: ML_RISK_LEVEL = molecule 134, storage_size 22, value_type text_direct
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
