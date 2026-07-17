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
const TARGET_VERSION = 116;

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
      // UTC-arithmetic to avoid the DST off-by-one bug pointers.js v126 fixed.
      // Local-y/m/d → Date.UTC → exact day-count via Math.round.
      const _now = new Date();
      const today = Math.round((Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate()) - Date.UTC(1959, 11, 3)) / 86400000) - 32768;

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

      // UTC-arithmetic to avoid the DST off-by-one bug pointers.js v126 fixed.
      // Local-y/m/d → Date.UTC → exact day-count via Math.round.
      const _now = new Date();
      const today = Math.round((Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate()) - Date.UTC(1959, 11, 3)) / 86400000) - 32768;

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
            'verticals/workforce_monitoring/admin_licensing_boards.html', 'Manage licensing boards', true,  // lint-allow: licensing board admin lives in the vertical
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
      // UTC-arithmetic to avoid the DST off-by-one bug pointers.js v126 fixed.
      // Local-y/m/d → Date.UTC → exact day-count via Math.round.
      const _now = new Date();
      const today = Math.round((Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate()) - Date.UTC(1959, 11, 3)) / 86400000) - 32768;

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
  // Design doc: docs/design/MULTI_COUNTER_PROMOTIONS_DESIGN.md
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
      // UTC-arithmetic to avoid the DST off-by-one bug pointers.js v126 fixed.
      // Local-y/m/d → Date.UTC → exact day-count via Math.round.
      const _now = new Date();
      const today = Math.round((Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate()) - Date.UTC(1959, 11, 3)) / 86400000) - 32768;

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
      // Recovery personas resolved by NAME, not membership_number — the
      // Recovery clinic seed (v49) runs at different times in different
      // environments and Postgres sequences allocate different numbers
      // (e.g. local has Grace Newfield at #46, Heroku has her at #53).
      // Name-based resolution makes this migration environment-portable.
      const PLAN = [
        // Joy Summerlin — ORANGE, PPSI/BURNOUT — recent burnout spike
        { fname: 'Joy', lname: 'Summerlin', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['1', 'burnout_spike']] },
        // Solace Greystone — YELLOW, PPSI/COGNITIVE — recent cognitive spike
        { fname: 'Solace', lname: 'Greystone', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['2', 'cognitive_spike']] },
        // Haven Restor — resolved YELLOW, PPSI/ISOLATION — recovery trajectory
        { fname: 'Haven', lname: 'Restor', surveys: [['28', 'isolation_spike'], ['21', 'isolation_spike'], ['14', 'recovering'], ['3', 'recovering']] },
        // Sterling Brightwell — RED, COMPOSITE — progressive decline
        { fname: 'Sterling', lname: 'Brightwell', surveys: [['28', 'healthy'], ['21', 'burnout_spike'], ['14', 'burnout_spike'], ['1', 'composite_high']] },
        // Dawn Shepherd — ORANGE, PULSE driver — flat baseline (PPSI not the story)
        { fname: 'Dawn', lname: 'Shepherd', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['5', 'healthy']] },
        // Phoenix Ashmore — YELLOW, COMPLIANCE driver — flat baseline
        { fname: 'Phoenix', lname: 'Ashmore', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['3', 'healthy']] },
        // Grant Steadman — SENTINEL, EVENTS driver — flat baseline
        { fname: 'Grant', lname: 'Steadman', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['1', 'healthy']] },
        // Hope Clearwater — green-comply (drug tests) — stable
        { fname: 'Hope', lname: 'Clearwater', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['7', 'healthy']] },
        // Grace Newfield — green control — stable
        { fname: 'Grace', lname: 'Newfield', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['7', 'healthy']] },
        // Faith Mercer — green control — stable
        { fname: 'Faith', lname: 'Mercer', surveys: [['28', 'healthy'], ['21', 'healthy'], ['14', 'healthy'], ['7', 'healthy']] }
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

      // ── Resolve member links + names for the planned participants (by name)
      const fnames = PLAN.map(p => p.fname);
      const lnames = PLAN.map(p => p.lname);
      const memberRows = await client.query(
        `SELECT link, membership_number, fname, lname FROM member
          WHERE tenant_id=$1 AND fname = ANY($2::varchar[]) AND lname = ANY($3::varchar[])`,
        [TENANT, fnames, lnames]
      );
      const MBYNAME = {};
      for (const r of memberRows.rows) MBYNAME[`${r.fname}|${r.lname}`] = r;
      for (const p of PLAN) {
        const key = `${p.fname}|${p.lname}`;
        if (!MBYNAME[key]) throw new Error(`Recovery participant ${p.fname} ${p.lname} not found in tenant ${TENANT}`);
      }
      // Compat shim: downstream loop uses `p.mn` and `MBYNUM[p.mn]` — alias them.
      const MBYNUM = MBYNAME;
      for (const p of PLAN) p.mn = `${p.fname}|${p.lname}`;

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

      // ── Verification (uses resolved member links rather than re-resolving
      // by membership_number — membership numbers vary per environment.
      // member.link / member_survey.member_link are CHAR(5) squish; pass as
      // text[] and let PG coerce.)
      const memberLinks = PLAN.map(p => MBYNUM[p.mn].link);
      const verify = await client.query(
        `SELECT COUNT(*) AS c FROM member_survey ms
           JOIN survey s ON s.link = ms.survey_link
          WHERE ms.member_link = ANY($1::text[])
            AND s.survey_code = 'PPSI'
            AND ms.score_math_version = 2`,
        [memberLinks]
      );
      const expected = PLAN.reduce((n, p) => n + p.surveys.length, 0);
      const got = Number(verify.rows[0].c);
      if (got !== expected) {
        throw new Error(`Verification failed: expected ${expected} new PPSI surveys, found ${got}`);
      }
      console.log(`  ✅ Verified ${got} PPSI surveys (score_math_version=2) for Recovery participants`);

      // Score range sanity (uses resolved member links — see verification above)
      const range = await client.query(
        `SELECT MIN(d54.n1) AS lo, MAX(d54.n1) AS hi
           FROM "5_data_54" d54
           JOIN activity a ON a.link = d54.p_link
          WHERE a.p_link = ANY($1::text[])
            AND d54.molecule_id = $2
            AND a.activity_date >= $3`,
        [memberLinks, MID.MEMBER_POINTS, today - 30]
      );
      console.log(`  ✅ MEMBER_POINTS for new accruals: range [${range.rows[0].lo}..${range.rows[0].hi}] (Option A scale 0..100)`);
    }
  },
  // v65 — Rename PPSI_Q3 labels in user-facing places (Session 113, Erica
  // feedback): "When we see 'PPSI Question Score 3' after a change in the
  // PPSI weights were created what does this mean?" The label was
  // confusing — "Question Score 3" reads like Question #3 had a score, but
  // it actually means "any single PPSI item scored 3 (max severity)".
  //
  // Internal signal code stays 'PPSI_Q3' (criterion match value, scorePPSI.js
  // signals array, audit history) — only the human-readable label changes.
  {
    version: 65,
    description: 'Rename PPSI_Q3 user-facing labels — "Severe Item Response" (Erica feedback)',
    async run(client) {
      const TENANT = 5;
      const NEW_CRITERION_LABEL  = 'PPSI Severe Item Response';
      const NEW_PROMOTION_NAME   = 'PPSI Severe Item — Registry Alert';
      const NEW_RESULT_DESCRIPTION = 'Severe response on a single PPSI item (any item scored 3 of 3)';

      // 1) rule_criteria.label — what the promotion-edit admin page shows
      const critRes = await client.query(
        `UPDATE rule_criteria
            SET label = $1
          WHERE molecule_key = 'SIGNAL'
            AND value::text LIKE '%PPSI_Q3%'
            AND label = 'PPSI Question Score 3'
          RETURNING rule_id`,
        [NEW_CRITERION_LABEL]
      );
      console.log(`  ✅ rule_criteria.label updated: ${critRes.rowCount} row(s)`);

      // 2) promotion.promotion_name — shown in promotion list + recent-changes
      const promoRes = await client.query(
        `UPDATE promotion
            SET promotion_name = $1
          WHERE tenant_id = $2
            AND promotion_code = 'PPSI_Q3_ALERT'
          RETURNING promotion_id`,
        [NEW_PROMOTION_NAME, TENANT]
      );
      console.log(`  ✅ promotion.promotion_name updated: ${promoRes.rowCount} row(s)`);

      // 3) promotion_result.result_description — feeds into stability_registry.reason_text
      //    for items created GOING FORWARD. Existing items keep their original
      //    reason_text (that's audit history; don't rewrite history).
      const resRes = await client.query(
        `UPDATE promotion_result
            SET result_description = $1
          WHERE tenant_id = $2
            AND promotion_id IN (
              SELECT promotion_id FROM promotion
               WHERE tenant_id = $2 AND promotion_code = 'PPSI_Q3_ALERT'
            )
            AND result_description = 'PPSI individual question scored 3'
          RETURNING promotion_id`,
        [NEW_RESULT_DESCRIPTION, TENANT]
      );
      console.log(`  ✅ promotion_result.result_description updated: ${resRes.rowCount} row(s)`);
    }
  },

  // v66 — Day-of-week scheduling flags on promotion, mirroring what bonus
  // already has. Seven NOT NULL DEFAULT true columns: existing rows pick up
  // the defaults so current behavior (promotion fires on every day of week)
  // is preserved. The promotion engine consults these the same way the bonus
  // engine does (skip evaluation if the day flag for activity day is false).
  {
    version: 66,
    description: 'Add day-of-week apply_* flags to promotion (mirrors bonus)',
    async run(client) {
      await client.query(`
        ALTER TABLE promotion
          ADD COLUMN apply_sunday    BOOLEAN NOT NULL DEFAULT true,
          ADD COLUMN apply_monday    BOOLEAN NOT NULL DEFAULT true,
          ADD COLUMN apply_tuesday   BOOLEAN NOT NULL DEFAULT true,
          ADD COLUMN apply_wednesday BOOLEAN NOT NULL DEFAULT true,
          ADD COLUMN apply_thursday  BOOLEAN NOT NULL DEFAULT true,
          ADD COLUMN apply_friday    BOOLEAN NOT NULL DEFAULT true,
          ADD COLUMN apply_saturday  BOOLEAN NOT NULL DEFAULT true
      `);
      console.log('  ✅ promotion: added 7 apply_* day-of-week columns (all default true)');
    }
  },

  // v67 — Convert the 25 wi_php alert promotions into bonuses. Alert events
  // (PPII Red/Orange/Yellow, sentinels, Pulse Q3, PPSI Q3, pattern triggers,
  // extended cards M1..D3) are single-activity, fires-once signal matches —
  // a bonus pattern, not a promotion pattern. Promotions were used originally
  // because bonuses couldn't dispatch external actions; the Session 105
  // Bonus Result Engine fixed that. This migration creates one bonus per
  // alert (reusing the existing rule_id and external_result_action mapping),
  // creates one bonus_result row per bonus dispatching to the same
  // SR_SENTINEL/SR_RED/SR_ORANGE/SR_YELLOW handler, and marks the old
  // promotions inactive. The signal-based trigger mechanism in custauth.js
  // is engine-agnostic — the second-activity-via-HTTP carries the SIGNAL/
  // EXTENDED_CARD molecule and the bonus engine catches it the same way
  // evaluatePromotions did. Historical member_promotion rows are left
  // untouched as a record of past alerts.
  //
  // Also widens bonus.bonus_code (10→20) and bonus.bonus_description
  // (30→100) to match the promotion table — prior gap caused codes like
  // SENT_POS_ALERT (14 chars) and 30+ char descriptions to not fit.
  {
    version: 67,
    description: 'Convert 25 wi_php alert promotions to bonuses (with Bonus Result Engine)',
    async run(client) {
      // 1. Widen bonus columns to match promotion column widths.
      await client.query(`ALTER TABLE bonus ALTER COLUMN bonus_code TYPE VARCHAR(20)`);
      await client.query(`ALTER TABLE bonus ALTER COLUMN bonus_description TYPE VARCHAR(100)`);
      console.log('  ✅ bonus: widened bonus_code → VARCHAR(20), bonus_description → VARCHAR(100)');

      // 2. Fetch the 25 alert promotions joined with their single result row.
      const alertPromos = await client.query(`
        SELECT p.promotion_id, p.promotion_code, p.promotion_name, p.rule_id,
               p.start_date, p.end_date,
               pr.result_reference_id, pr.result_description
        FROM promotion p
        JOIN promotion_result pr ON pr.promotion_id = p.promotion_id
        WHERE p.tenant_id = 5
          AND p.reward_type = 'external'
          AND p.is_active = true
        ORDER BY p.promotion_id
      `);

      if (alertPromos.rows.length !== 25) {
        throw new Error(
          `Expected 25 active alert promotions in tenant 5; found ${alertPromos.rows.length}. ` +
          `Aborting migration so the conversion shape can be re-verified before running.`
        );
      }
      console.log(`  Found ${alertPromos.rows.length} alert promotions to convert`);

      // 3. For each, create bonus + bonus_result, deactivate the old promotion.
      let converted = 0;
      for (const p of alertPromos.rows) {
        const bonusInsert = await client.query(
          `INSERT INTO bonus (
             bonus_code, bonus_description, start_date, end_date, is_active,
             bonus_type, bonus_amount, rule_id, tenant_id,
             apply_sunday, apply_monday, apply_tuesday, apply_wednesday,
             apply_thursday, apply_friday, apply_saturday
           )
           VALUES ($1, $2, $3, $4, true, 'fixed', 0, $5, 5,
                   true, true, true, true, true, true, true)
           RETURNING bonus_id`,
          [p.promotion_code, p.promotion_name, p.start_date, p.end_date, p.rule_id]
        );
        const bonusId = bonusInsert.rows[0].bonus_id;

        await client.query(
          `INSERT INTO bonus_result (
             bonus_id, tenant_id, result_type,
             result_reference_id, result_description, sort_order
           )
           VALUES ($1, 5, 'external', $2, $3, 0)`,
          [bonusId, p.result_reference_id, p.result_description]
        );

        await client.query(
          `UPDATE promotion SET is_active = false WHERE promotion_id = $1`,
          [p.promotion_id]
        );

        converted++;
      }
      console.log(`  ✅ Converted ${converted} alert promotions → bonuses (with external result rows)`);
      console.log(`  ✅ Original promotions left in place but marked is_active=false (audit history preserved)`);
    }
  },

  // v68 — Add BONUS_RESULT molecule to wi_php (tenant 5). The bonus engine's
  // external-dispatch branch (pointers.js applyBonusToActivity) silently
  // skips the action handler if the tenant has no BONUS_RESULT molecule:
  //   if (!bonusResultMoleculeId || !result.bonus_result_id) continue;
  // The molecule serves as the audit-trail marker that "bonus_result X fired
  // on activity Y" — written by insertActivityMolecule on the parent activity.
  // The Bonus Result Engine was rolled out for Delta originally, so only
  // tenant_id=1 had this molecule. v67 wired up the bonus_result rows for
  // wi_php but the engine couldn't dispatch without the molecule. This adds
  // it. Schema mirrors Delta exactly (molecule_id=140 for tenant 1):
  //   attaches_to='A', storage_size=2, value_type='key',
  //   value_kind='external_list', scalar_type=NULL, molecule_type='D'.
  // Required companion molecule_value_lookup row also added — points the
  // encoder/decoder at the bonus_result table.
  {
    version: 68,
    description: 'Add BONUS_RESULT molecule for wi_php (tenant 5) so bonus engine can dispatch external results',
    async run(client) {
      // 1. Create molecule_def row.
      const molInsert = await client.query(`
        INSERT INTO molecule_def (
          molecule_key, label, value_kind, scalar_type, tenant_id, context,
          is_static, is_permanent, is_required, is_active, description,
          attaches_to, storage_size, value_type, molecule_type, value_structure
        )
        VALUES (
          'BONUS_RESULT', 'Bonus Result', 'external_list', NULL, 5, 'activity',
          false, false, false, true,
          'Audit trail for non-point bonus results fired on an activity',
          'A', 2, 'key', 'D', 'single'
        )
        RETURNING molecule_id
      `);
      const moleculeId = molInsert.rows[0].molecule_id;
      console.log(`  ✅ molecule_def: BONUS_RESULT created for tenant 5 (molecule_id=${moleculeId})`);

      // 2. Companion molecule_value_lookup row (points encoder/decoder at bonus_result table).
      await client.query(`
        INSERT INTO molecule_value_lookup (
          molecule_id, table_name, id_column, code_column, label_column,
          maintenance_page, maintenance_description, is_tenant_specific,
          column_order, column_type, decimal_places, col_description,
          value_type, lookup_table_key, value_kind, scalar_type, context,
          storage_size, attaches_to
        )
        VALUES (
          $1, 'bonus_result', 'bonus_result_id', 'bonus_result_id', 'result_description',
          'admin_bonus_edit.html', 'Manage bonus results', true,
          1, 'database_ref', 0, 'Bonus Result',
          'key', 'bonus_result', 'external_list', NULL, 'activity',
          2, 'A'
        )
      `, [moleculeId]);
      console.log('  ✅ molecule_value_lookup: bonus_result table mapping created for tenant 5');
    }
  },

  // v69 — Move the hardcoded urgency-to-SLA map out of createRegistryItem (JS)
  // into data on external_result_action. Adds two columns (urgency + sla_hours)
  // and backfills the existing 4 rows. Going forward, every external action
  // that creates a registry item carries its own urgency band and SLA — so
  // future tenants/states can have e.g. SR_RED with a 12-hour SLA without
  // any code change. Step 1 of the platform's data-not-code expansion prep.
  {
    version: 69,
    description: 'Add urgency + sla_hours columns to external_result_action (move out of createRegistryItem JS)',
    async run(client) {
      await client.query(`
        ALTER TABLE external_result_action
          ADD COLUMN urgency   VARCHAR(10),
          ADD COLUMN sla_hours INTEGER
      `);
      console.log('  ✅ external_result_action: added urgency, sla_hours columns');

      // Backfill existing rows by action_code. Idempotent on the four known codes;
      // any future rows will be set by the admin creating them.
      const backfill = [
        { code: 'SR_SENTINEL', urgency: 'SENTINEL', sla: 0 },
        { code: 'SR_RED',      urgency: 'RED',      sla: 24 },
        { code: 'SR_ORANGE',   urgency: 'ORANGE',   sla: 48 },
        { code: 'SR_YELLOW',   urgency: 'YELLOW',   sla: 72 }
      ];
      for (const b of backfill) {
        const r = await client.query(
          `UPDATE external_result_action SET urgency = $1, sla_hours = $2
           WHERE action_code = $3`,
          [b.urgency, b.sla, b.code]
        );
        console.log(`  ✅ ${b.code} → urgency=${b.urgency}, sla_hours=${b.sla} (${r.rowCount} row(s))`);
      }
    }
  },

  // v70 — Move the hardcoded follow-up schedule library out of pointers.js
  // (scheduleFollowups function) into a new followup_schedule table. Step 2
  // of the data-not-code expansion prep. Each row defines one follow-up step
  // for either an urgency level (SENTINEL/RED/ORANGE/YELLOW) or an extended
  // card override (T1/T5). scheduleFollowups becomes a thin SELECT + insert
  // loop. Behavior on day one is identical because we seed the existing
  // hardcoded schedules verbatim for tenant 5.
  {
    version: 70,
    description: 'Create followup_schedule table and seed wi_php schedules (mirrors prior hardcoded JS)',
    async run(client) {
      await client.query(`
        CREATE TABLE followup_schedule (
          schedule_id    SERIAL PRIMARY KEY,
          tenant_id      SMALLINT NOT NULL,
          urgency        VARCHAR(10),
          extended_card  VARCHAR(5),
          step_order     SMALLINT NOT NULL,
          followup_type  VARCHAR(20) NOT NULL,
          offset_days    SMALLINT NOT NULL,
          is_active      BOOLEAN NOT NULL DEFAULT true,
          CONSTRAINT followup_schedule_one_key
            CHECK ((urgency IS NOT NULL AND extended_card IS NULL)
                OR (urgency IS NULL AND extended_card IS NOT NULL))
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX idx_followup_schedule_urgency
          ON followup_schedule (tenant_id, urgency, step_order)
          WHERE extended_card IS NULL
      `);
      await client.query(`
        CREATE UNIQUE INDEX idx_followup_schedule_card
          ON followup_schedule (tenant_id, extended_card, step_order)
          WHERE urgency IS NULL
      `);
      console.log('  ✅ followup_schedule table created with partial unique indexes');

      // Seed wi_php (tenant 5) — exact transcription of prior hardcoded JS.
      const TENANT = 5;
      const schedules = [
        { urgency: 'SENTINEL', steps: [
          { type: '48h',    offset: 2 },
          { type: 'weekly', offset: 9 },
          { type: 'weekly', offset: 16 },
          { type: 'weekly', offset: 23 }
        ]},
        { urgency: 'RED', steps: [
          { type: 'weekly', offset: 7 },
          { type: 'weekly', offset: 14 },
          { type: 'weekly', offset: 21 },
          { type: 'weekly', offset: 28 },
          { type: '4wk',    offset: 56 },
          { type: '8wk',    offset: 84 }
        ]},
        { urgency: 'ORANGE', steps: [
          { type: '2wk', offset: 14 },
          { type: '4wk', offset: 28 },
          { type: '8wk', offset: 56 }
        ]},
        { urgency: 'YELLOW', steps: [
          { type: '2wk', offset: 14 },
          { type: '4wk', offset: 28 },
          { type: '8wk', offset: 56 }
        ]},
        { card: 'T1', steps: [
          { type: '2wk', offset: 14 },
          { type: '4wk', offset: 28 },
          { type: '8wk', offset: 56 },
          { type: '8wk', offset: 84 }
        ]},
        { card: 'T5', steps: [
          { type: '4wk', offset: 28 },
          { type: '4wk', offset: 56 },
          { type: '4wk', offset: 84 }
        ]}
      ];

      let totalRows = 0;
      for (const s of schedules) {
        for (let i = 0; i < s.steps.length; i++) {
          const step = s.steps[i];
          await client.query(
            `INSERT INTO followup_schedule
               (tenant_id, urgency, extended_card, step_order, followup_type, offset_days)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [TENANT, s.urgency || null, s.card || null, i + 1, step.type, step.offset]
          );
          totalRows++;
        }
        const label = s.urgency ? `urgency=${s.urgency}` : `extended_card=${s.card}`;
        console.log(`  ✅ seeded ${label}: ${s.steps.length} step(s)`);
      }
      console.log(`  ✅ Total followup_schedule rows seeded for tenant 5: ${totalRows}`);
    }
  },

  // v71 — Create admin_settings table (key/value, per-tenant) and seed the
  // PPII threshold bands (RED 75 / ORANGE 55 / YELLOW 35) that were previously
  // hardcoded as the PPII_THRESHOLDS const in custauth.js. Step 3 of the
  // data-not-code expansion prep. Custauth POST_ACCRUAL will load these at
  // runtime instead of using the JS constants — same fallback pattern as the
  // existing pattern_* threshold keys (which already query admin_settings
  // with a try/catch fallback because the table didn't exist before today).
  //
  // Bonus: we also seed the pattern_* keys with their current defaults, so
  // the pattern triggers stop running on the "table doesn't exist, use
  // hardcoded fallback" path and start running on explicit admin-tunable
  // values. Behavior is unchanged on day one because the seeded values
  // equal the prior defaults.
  {
    version: 71,
    description: 'Create admin_settings table; seed PPII thresholds + pattern trigger thresholds for tenant 5',
    async run(client) {
      await client.query(`
        CREATE TABLE admin_settings (
          setting_id     SERIAL PRIMARY KEY,
          tenant_id      SMALLINT NOT NULL,
          setting_key    VARCHAR(50) NOT NULL,
          setting_value  TEXT NOT NULL,
          description    TEXT,
          updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, setting_key)
        )
      `);
      await client.query(`CREATE INDEX idx_admin_settings_tenant ON admin_settings (tenant_id)`);
      console.log('  ✅ admin_settings table created');

      const TENANT = 5;
      const seeds = [
        // PPII threshold bands — minimum composite score at which each signal fires.
        { key: 'ppii_red_threshold',      value: '75', desc: 'PPII composite at or above this fires PPII_RED signal (default 75)' },
        { key: 'ppii_orange_threshold',   value: '55', desc: 'PPII composite at or above this (and below RED) fires PPII_ORANGE (default 55)' },
        { key: 'ppii_yellow_threshold',   value: '35', desc: 'PPII composite at or above this (and below ORANGE) fires PPII_YELLOW (default 35)' },
        // Pattern-based trigger thresholds — already expected by custauth.js with try/catch fallback.
        { key: 'pattern_trend_periods',      value: '3',  desc: 'Number of consecutive rising periods to fire PPII_TREND_UP (default 3)' },
        { key: 'pattern_spike_delta',        value: '15', desc: 'Point jump in one period to fire PPII_SPIKE (default 15)' },
        { key: 'pattern_protective_periods', value: '2',  desc: 'Consecutive surveys with Isolation/Recovery/Purpose all worsening to fire PROTECTIVE_COLLAPSE (default 2)' },
      ];

      for (const s of seeds) {
        await client.query(
          `INSERT INTO admin_settings (tenant_id, setting_key, setting_value, description)
           VALUES ($1, $2, $3, $4)`,
          [TENANT, s.key, s.value, s.desc]
        );
        console.log(`  ✅ seeded ${s.key} = ${s.value}`);
      }
    }
  },

  // v72 — Move the severity-3 event trigger out of custauth.js PRE_ACCRUAL
  // (hardcoded `>= 3` threshold + literal 'EVENT_SEVERITY_3' signal name)
  // into two admin_settings keys. Step 4 of the data-not-code expansion
  // prep — rides on the admin_settings table created in v71. A new state
  // can now set its own severity threshold (e.g. a population where
  // anything >= 2 is sentinel-worthy) without code changes.
  {
    version: 72,
    description: 'Seed event severity threshold + signal name for tenant 5 in admin_settings',
    async run(client) {
      const TENANT = 5;
      const seeds = [
        { key: 'event_severity_threshold',    value: '3',                  desc: 'Minimum EVENT base_points (severity) that fires the severity signal in PRE_ACCRUAL (default 3)' },
        { key: 'event_severity_signal_name',  value: 'EVENT_SEVERITY_3',   desc: 'SIGNAL value attached to an EVENT activity when severity threshold is met' },
      ];
      for (const s of seeds) {
        await client.query(
          `INSERT INTO admin_settings (tenant_id, setting_key, setting_value, description)
           VALUES ($1, $2, $3, $4)`,
          [TENANT, s.key, s.value, s.desc]
        );
        console.log(`  ✅ seeded ${s.key} = ${s.value}`);
      }
    }
  },

  // v73 — Migrate the 8 admin_settings rows into sysparm + sysparm_detail
  // (the platform's canonical tenant-config store) and drop admin_settings.
  // v71 created admin_settings as a parallel config table because the prior
  // custauth.js was already querying it via a try/catch fallback — but
  // sysparm is the right home per platform convention (per master doc:
  // "Tenant-wide configuration lives in sysparm_detail"). Three sysparm
  // rows replace the 8 flat keys, grouping the values that belong together:
  //   - sysparm_key='ppii_thresholds' (numeric): 3 band cutoffs
  //   - sysparm_key='pattern_triggers' (numeric): 3 detection thresholds
  //   - sysparm_key='event_severity' (text): threshold + signal name
  // custauth.js gets rewritten in the same commit to query sysparm.
  {
    version: 73,
    description: 'Migrate admin_settings → sysparm + sysparm_detail; drop admin_settings',
    async run(client) {
      const TENANT = 5;
      const groups = [
        {
          key: 'ppii_thresholds',
          value_type: 'numeric',
          description: 'PPII composite band cutoffs (red/orange/yellow) — minimum composite to fire each signal',
          details: [
            { category: 'band', code: 'red',    value: '75', sort_order: 1 },
            { category: 'band', code: 'orange', value: '55', sort_order: 2 },
            { category: 'band', code: 'yellow', value: '35', sort_order: 3 },
          ]
        },
        {
          key: 'pattern_triggers',
          value_type: 'numeric',
          description: 'Pattern-based trigger detection thresholds for PPII_TREND_UP / PPII_SPIKE / PROTECTIVE_COLLAPSE',
          details: [
            { category: 'threshold', code: 'trend_periods',      value: '3',  sort_order: 1 },
            { category: 'threshold', code: 'spike_delta',        value: '15', sort_order: 2 },
            { category: 'threshold', code: 'protective_periods', value: '2',  sort_order: 3 },
          ]
        },
        {
          key: 'event_severity',
          value_type: 'text',
          description: 'PRE_ACCRUAL event severity → SIGNAL trigger. threshold is the minimum base_points; signal_name is the SIGNAL value attached',
          details: [
            { category: 'trigger', code: 'threshold',   value: '3',                sort_order: 1 },
            { category: 'trigger', code: 'signal_name', value: 'EVENT_SEVERITY_3', sort_order: 2 },
          ]
        },
      ];

      for (const g of groups) {
        const sp = await client.query(
          `INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
           VALUES ($1, $2, $3, $4)
           RETURNING sysparm_id`,
          [TENANT, g.key, g.value_type, g.description]
        );
        const sysparmId = sp.rows[0].sysparm_id;
        for (const d of g.details) {
          await client.query(
            `INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [sysparmId, d.category, d.code, d.value, d.sort_order]
          );
        }
        console.log(`  ✅ sysparm ${g.key}: ${g.details.length} detail row(s) seeded`);
      }

      await client.query(`DROP TABLE admin_settings`);
      console.log('  ✅ admin_settings table dropped — sysparm is now the only tenant-config store');
    }
  },

  // v74 — Drop three dead config tables that the audit found had zero code
  // references. They predate sysparm or were never wired up:
  //   - settings (no tenant_id, 3 rows: company_name/program_name/unit_label)
  //   - x_tenant_settings (1 Delta row, "x_" deprecation prefix)
  //   - x_tenant_terms (3 Delta rows: points_label/tier_label/status_label,
  //     "x_" deprecation prefix)
  // Anything genuinely needed from these tables would live in sysparm now.
  {
    version: 74,
    description: 'Drop three dead config tables: settings, x_tenant_settings, x_tenant_terms',
    async run(client) {
      const drops = ['settings', 'x_tenant_settings', 'x_tenant_terms'];
      for (const t of drops) {
        await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
        console.log(`  ✅ dropped ${t}`);
      }
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v75 — wi_php: re-create Member Profile input template with LICENSING_BOARD.
  //
  // Background: v62 created a wi_php M-type "Physician Member Template" with
  // LICENSING_BOARD / ASSIGNED_CLINICIAN / IS_CLINICIAN. v63 then dropped all
  // wi_php J/M templates on the misread that 'M' meant "promotion" — it does
  // not. 'M' is the activity_type used by input_template to drive the
  // member-attached "Additional Information" section in csr_member.html (same
  // way Delta's template_id=4 "Member Profile Attributes" drives Passport).
  //
  // Why now: csr_member.html has been carrying a hardcoded Licensing Board
  // dropdown bolted into the profile form for every tenant. The right pattern
  // is the molecule-driven template that already powers Passport for Delta.
  // The LICENSING_BOARD molecule (id=139, value_kind=external_list, lookup
  // wired to the licensing_board catalog) and the storage path (getMoleculeRows
  // / insertMoleculeRow / encodeMolecule) already exist — only the input
  // template was missing.
  //
  // Scope kept minimal: only LICENSING_BOARD goes in for now. Future
  // healthcare member fields (ASSIGNED_CLINICIAN, IS_CLINICIAN, etc.) can be
  // appended to this same template when their UI is needed; not in scope today.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 75,
    description: 'wi_php: re-create Member Profile (M) input template with LICENSING_BOARD field',
    async run(client) {
      const tenantId = 5;

      // Safety: refuse to double-insert if an M-type template already exists
      // for wi_php (e.g. if v63 was later reverted by hand).
      const existing = await client.query(
        `SELECT template_id, template_name FROM input_template
          WHERE tenant_id = $1 AND activity_type = 'M'`,
        [tenantId]
      );
      if (existing.rows.length > 0) {
        console.log(`  ⏭️  wi_php already has M-type input template(s); skipping creation:`);
        for (const r of existing.rows) {
          console.log(`     id=${r.template_id} "${r.template_name}"`);
        }
        return;
      }

      const tplRes = await client.query(`
        INSERT INTO input_template (tenant_id, template_name, activity_type, is_active)
        VALUES ($1, 'Member Profile Attributes', 'M', true)
        RETURNING template_id
      `, [tenantId]);
      const tplId = tplRes.rows[0].template_id;
      console.log(`  ✅ Created wi_php Member Profile Attributes (M) input template_id=${tplId}`);

      await client.query(`
        INSERT INTO input_template_field
          (template_id, row_number, sort_order, molecule_key, display_label,
           start_position, display_width, enterable, is_required)
        VALUES ($1, 10, 1, 'LICENSING_BOARD', 'Licensing Board', 1, 50, 'Y', false)
      `, [tplId]);
      console.log(`  ✅ Added LICENSING_BOARD field to template_id=${tplId}`);
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v76 — Move meds_next_due off the platform-shared member table into a
  // scoped member_meds table.
  //
  // Background: meds_next_due was added as a SMALLINT NOT NULL column on
  // member (default 31910 sentinel = "never") to support Insight's MEDS
  // scheduling. Every member in every tenant carries it, even tenants that
  // have nothing to do with healthcare. Bill's directive: Insight-specific
  // fields must not live on Delta members.
  //
  // New shape: member_meds (member_link PK, tenant_id, meds_next_due) —
  // present only for members that have a meaningful (non-sentinel) value.
  // Delta members at sentinel get no row. The bulk-scan that the MEDS
  // scheduler runs becomes a scan over member_meds (much smaller, same
  // (tenant_id, meds_next_due) btree).
  //
  // Backfill copies non-sentinel rows; sentinel rows are deliberately
  // excluded (no row = "no MEDS scheduled" in the new model). Code path
  // changes in pointers.js: 10 read/write sites moved off member.meds_next_due
  // onto member_meds.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 76,
    description: 'Move meds_next_due off member into scoped member_meds table',
    async run(client) {
      const SENTINEL_2137 = 31910; // matches the original ADD COLUMN default (= 01/01/2137 in Bill epoch)

      // 1. Create the scoped table.
      await client.query(`
        CREATE TABLE IF NOT EXISTS member_meds (
          member_link    CHAR(5)  PRIMARY KEY REFERENCES member(link) ON DELETE CASCADE,
          tenant_id      SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          meds_next_due  SMALLINT NOT NULL
        )
      `);
      console.log('  ✅ member_meds table created');

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_member_meds_tenant_due
          ON member_meds(tenant_id, meds_next_due)
      `);
      console.log('  ✅ idx_member_meds_tenant_due index created');

      // 2. Backfill: only members with meaningful (non-sentinel) values.
      //    Sentinel-valued rows (= "nothing scheduled") are equivalent to
      //    "no row" in the new model, so they're deliberately excluded.
      //    This naturally excludes every Delta member (all at sentinel by default).
      const backfill = await client.query(`
        INSERT INTO member_meds (member_link, tenant_id, meds_next_due)
        SELECT link, tenant_id, meds_next_due
          FROM member
         WHERE meds_next_due IS NOT NULL AND meds_next_due <> $1
        ON CONFLICT (member_link) DO NOTHING
      `, [SENTINEL_2137]);
      console.log(`  ✅ Backfilled ${backfill.rowCount} member_meds row(s) (non-sentinel only)`);

      // Sanity report per tenant
      const perTenant = await client.query(`
        SELECT t.tenant_key, COUNT(mm.*) AS rows_in_member_meds
          FROM tenant t
          LEFT JOIN member_meds mm ON mm.tenant_id = t.tenant_id
         GROUP BY t.tenant_key ORDER BY t.tenant_key
      `);
      for (const r of perTenant.rows) {
        console.log(`     ${r.tenant_key}: ${r.rows_in_member_meds} row(s) in member_meds`);
      }

      // 3. Drop the column from member. This also drops idx_member_meds_next_due
      //    that was created alongside it.
      await client.query(`ALTER TABLE member DROP COLUMN IF EXISTS meds_next_due`);
      console.log('  ✅ member.meds_next_due column dropped');
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v77 — Update molecule_value_lookup.maintenance_page paths for healthcare-
  // specific admin pages that moved from project root into the vertical
  // folder (verticals/workforce_monitoring/) in Session 126.
  //
  // Only one row in molecule_value_lookup carries a maintenance_page that
  // pointed at a moved page: LICENSING_BOARD (lookup_id=94 →
  // admin_licensing_boards.html). The original seed at db_migrate.js:1719
  // was updated to write the new path so fresh DBs come up correct; this
  // migration covers existing DBs that already ran the original seed.
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 77,
    description: 'Update molecule_value_lookup maintenance_page for moved admin pages',
    async run(client) {
      const updates = [
        ['admin_licensing_boards.html', 'verticals/workforce_monitoring/admin_licensing_boards.html'],  // lint-allow: v77 re-points migration to the moved file
      ];
      let total = 0;
      for (const [oldPath, newPath] of updates) {
        const r = await client.query(
          `UPDATE molecule_value_lookup SET maintenance_page = $1 WHERE maintenance_page = $2 RETURNING lookup_id`,
          [newPath, oldPath]
        );
        console.log(`  ✅ ${oldPath} → ${newPath} (${r.rowCount} row(s) updated)`);
        total += r.rowCount;
      }
      console.log(`  ✅ Total ${total} maintenance_page row(s) re-pointed`);
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // v78 — Make external_result_action.function_name nullable.
  //
  // function_name was NOT NULL since the table was created — every action had
  // to dispatch to a registered server-side function. But the common case for
  // an airline/hotel tenant adding an external result (e.g. "Free Drink
  // Coupon — issued") doesn't need a function: the bonus just notes that the
  // result happened in the audit trail (the BONUS_RESULT molecule already
  // records it on the parent activity), with no extra server-side processing.
  // Requiring a function for that case forces the admin to invent a no-op
  // handler name. Now optional; engine dispatch is already null-safe (typeof
  // externalActionHandlers[null] is 'undefined' so the branch is skipped).
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 78,
    description: 'Make external_result_action.function_name nullable (function is optional)',
    async run(client) {
      await client.query(`ALTER TABLE external_result_action ALTER COLUMN function_name DROP NOT NULL`);
      console.log('  ✅ external_result_action.function_name now nullable');
    }
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    version: 79,
    description: 'Member Composites (M) — seed M composite as the authority for tenant-specific member fields (Delta PASSPORT, Insight LICENSING_BOARD) + consolidate composite link_tank',
    async run(client) {
      // ── 1. Consolidate the `composite` link_tank to a single global row ──
      // composite.link is a GLOBAL primary key, but link_tank carried two stale
      // per-tenant rows (tenant 1 and tenant 3). getNextLink('composite') updates
      // EVERY row matching table_key='composite' and returns rows[0] (order
      // undefined); the tenant-3 row's next_link (-32765) pointed at an
      // already-used link, so the next composite created through getNextLink could
      // collide on composite_pkey and fail. Same bug + same fix already applied to
      // composite_detail in v31: collapse to one tenant_id=0 row whose next_link =
      // MAX(existing link) + 1 (links count upward from -32768 toward 0).
      await client.query(`DELETE FROM link_tank WHERE table_key = 'composite'`);
      await client.query(`
        INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
        SELECT 0, 'composite', 2, COALESCE(MAX(link), -32768) + 1 FROM composite
      `);
      console.log('  ✅ Consolidated composite link_tank to a single global tenant_id=0 row');

      // ── 2. Seed the M composite for each tenant that exposes a member field ──
      // M composites do for member molecule fields what A composites do for
      // activity fields: the composite is the AUTHORITY; the member input template
      // (activity_type='M') is layout-only and may only reference fields in it.
      // Only the CSR-enterable profile fields belong here (the ones the member
      // input template exposes) — NOT every context='member' molecule (ML scores,
      // clinician flags, derived references are written by other code paths).
      // Resolve molecule_id by KEY (ids differ across environments). Both fields
      // seeded is_required = false (Bill, Session 117 decision 3).
      const seeds = [
        { tenant: 1, moleculeKey: 'PASSPORT',        description: 'Member Profile Fields' },
        { tenant: 5, moleculeKey: 'LICENSING_BOARD', description: 'Member Profile Fields' }
      ];

      for (const seed of seeds) {
        // Resolve the molecule id by key for this tenant (NOT hardcoded).
        const molRes = await client.query(
          `SELECT molecule_id FROM molecule_def
           WHERE tenant_id = $1 AND molecule_key = $2 AND context = 'member'`,
          [seed.tenant, seed.moleculeKey]
        );
        if (molRes.rows.length === 0) {
          console.log(`  ⏭️  tenant ${seed.tenant}: molecule ${seed.moleculeKey} not found — skipping`);
          continue;
        }
        const moleculeId = molRes.rows[0].molecule_id;

        // Create the M composite if missing (UNIQUE tenant_id+composite_type).
        let compositeLink;
        const existing = await client.query(
          `SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = 'M'`,
          [seed.tenant]
        );
        if (existing.rows.length > 0) {
          compositeLink = existing.rows[0].link;
          console.log(`  ⏭️  tenant ${seed.tenant}: M composite already exists (link=${compositeLink})`);
        } else {
          compositeLink = await getNextLink(client, seed.tenant, 'composite');
          await client.query(
            `INSERT INTO composite (link, tenant_id, composite_type, description)
             VALUES ($1, $2, 'M', $3)`,
            [compositeLink, seed.tenant, seed.description]
          );
          console.log(`  ✅ tenant ${seed.tenant}: created M composite (link=${compositeLink})`);
        }

        // Add the molecule to the composite (idempotent on UNIQUE p_link+molecule_id).
        const detailExists = await client.query(
          `SELECT 1 FROM composite_detail WHERE p_link = $1 AND molecule_id = $2`,
          [compositeLink, moleculeId]
        );
        if (detailExists.rows.length === 0) {
          const detailLink = await getNextLink(client, seed.tenant, 'composite_detail');
          await client.query(
            `INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, sort_order)
             VALUES ($1, $2, $3, false, false, 1)`,
            [detailLink, compositeLink, moleculeId]
          );
          console.log(`  ✅ tenant ${seed.tenant}: added ${seed.moleculeKey} to M composite (detail link=${detailLink})`);
        } else {
          console.log(`  ⏭️  tenant ${seed.tenant}: ${seed.moleculeKey} already in M composite`);
        }
      }
    }
  },
  // ----------------------------------------------------------------------------
  {
    version: 80,
    description: 'Consolidate member link_tank to a single global row (fix duplicate-PK on enroll — same drift class as composite v79)',
    async run(client) {
      // member.link is a GLOBAL primary key, but link_tank carried per-tenant
      // 'member' rows. getNextLink('member') is global — it updates EVERY row
      // matching table_key='member' and returns rows[0] (order undefined). When a
      // stale row pointed behind the global max link, getNextLink handed out an
      // already-used link and enroll failed with a duplicate-PK 500. Same bug +
      // same fix as composite (v79): collapse to one tenant_id=0 row whose
      // next_link is past the global max member link.
      //
      // member.link is a squished 5-byte base-127 CHAR. Decode every link to find
      // the true global max, then set next_link = max(decoded)+1, and also respect
      // any existing counter already further ahead (harmless gaps). This recomputes
      // from actual data, so it is correct + idempotent on any environment — a
      // no-op rewrite on a clean DB, a repair on a drifted one.
      function unsquish(str) {
        const s = (str || '').padEnd(5, ' ');   // CHAR(5): restore any trimmed trailing 0x20 bytes
        let v = 0;
        for (let i = 0; i < s.length; i++) v = v * 127 + (s.charCodeAt(i) - 1);
        return v;
      }
      const links = await client.query('SELECT link FROM member');
      let maxVal = -1;
      for (const row of links.rows) {
        const v = unsquish(row.link);
        if (v > maxVal) maxVal = v;
      }
      let nextLink = maxVal + 1;
      const existing = await client.query(`SELECT next_link FROM link_tank WHERE table_key = 'member'`);
      for (const r of existing.rows) {
        if (r.next_link > nextLink) nextLink = r.next_link;
      }

      await client.query(`DELETE FROM link_tank WHERE table_key = 'member'`);
      await client.query(
        `INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link) VALUES (0, 'member', 5, $1)`,
        [nextLink]
      );
      console.log(`  Consolidated member link_tank to one global tenant_id=0 row (next_link=${nextLink}, max used link=${maxVal})`);
    }
  },
  {
    version: 81,
    description: 'RLS Stage 1 — INERT no-op (collapsed Session 124; see note). Originally provisioned the app_rls login.',
    async run(client) {
      // NO-OP (collapsed in Session 124). Session 123 built the RLS backstop
      // (v81 app_rls role, v82 tenant_isolation policies) then reverted it (v83).
      // The NET effect of v81→v83 is ZERO — the database at v83 is byte-for-byte
      // identical to v80. The original v81 created a LOGIN role WITH A PASSWORD,
      // which managed Postgres (Heroku/Amazon RDS) refuses with "must be a member
      // of rds_password to alter passwords" — so the real migration could never run
      // on Heroku and froze ALL deploys at v80. Collapsed to a no-op so every
      // environment (existing local already at v83, fresh DB, CI, Heroku) converges
      // on the same RLS-free state at v83. Local already ran the real v81 and won't
      // re-run this. The full RLS design + DDL is preserved in
      // docs/RLS_BACKSTOP_DESIGN.md and git history (commit b27ca88).
      void client;
      console.log('  v81 inert no-op (RLS backstop collapsed — net effect of v81→v83 is zero; see note)');
    }
  },
  {
    version: 82,
    description: 'RLS Stage 2 — INERT no-op (collapsed Session 124; see v81 note). Originally added tenant_isolation policies.',
    async run(client) {
      // NO-OP (collapsed in Session 124). See the v81 note above for the full
      // reasoning: v81→v82 built the RLS backstop, v83 removed it, net effect zero.
      // The original v82 enabled RLS + created tenant_isolation policies on 56
      // tenant-scoped tables; v83 dropped all of it. Collapsed here so the chain
      // applies cleanly on managed Postgres (where v81 could not run) and every
      // environment lands RLS-free at v83. DDL preserved in
      // docs/RLS_BACKSTOP_DESIGN.md + git (commit b27ca88).
      void client;
      console.log('  v82 inert no-op (RLS tenant_isolation policies collapsed — see v81 note)');
    }
  },
  {
    version: 83,
    description: 'Remove RLS tenant-isolation backstop (Session 123 reversal) — drop tenant_isolation policies + app_rls role; restore original decorative member RLS.',
    async run(client) {
      // Reversal of v81 (app_rls role) + v82 (tenant_isolation policies). The
      // backstop guarded against a future forgotten tenant filter, but the platform
      // already isolates tenants in code (Session 121) + has cross-tenant regression
      // tests (Session 122), and the enforcement implementation cost real write
      // performance. This returns the database to its pre-v81/v82 state.
      const TENANT_TABLES = [
        'adjustment', 'alias_composite', 'audit_entity_type', 'badge', 'bonus',
        'bonus_result', 'carriers', 'compliance_item', 'compliance_result',
        'composite', 'display_template', 'external_result_action',
        'followup_schedule', 'input_template', 'licensing_board', 'member',
        'member_alias', 'member_compliance', 'member_meds', 'member_promo_wt_count',
        'member_promotion', 'molecule_def', 'molecule_value_embedded_list',
        'notification', 'notification_delivery', 'notification_delivery_config',
        'notification_rule', 'partner', 'physician_annotation', 'platform_user',
        'point_expiration_rule', 'point_type', 'ppii_score_history', 'ppii_stream',
        'ppii_weight_set', 'ppsi_subdomain', 'ppsi_subdomain_weight_set',
        'promo_wt_count', 'promotion', 'promotion_result', 'pulse_respondent',
        'redemption_rule', 'registry_followup', 'scheduled_job', 'scheduled_job_log',
        'signal_type', 'stability_registry', 'survey', 'survey_note_review',
        'survey_question', 'survey_question_category', 'survey_question_list',
        'sysparm', 'tenant', 'tier_definition', 'usage_log'
      ];
      for (const t of TENANT_TABLES) {
        await client.query(`DROP POLICY IF EXISTS ${t}_tenant_isolation ON public.${t}`);
        // Original state: only `member` had RLS enabled. Disable it everywhere else.
        if (t !== 'member') {
          await client.query(`ALTER TABLE public.${t} DISABLE ROW LEVEL SECURITY`);
        }
      }
      // Restore member's original decorative policy (member kept RLS enabled, and was
      // the only table with it, before v82). Harmless — the app connects as owner.
      await client.query(`DROP POLICY IF EXISTS member_rls_tenant ON public.member`);
      await client.query(`CREATE POLICY member_rls_tenant ON public.member USING (tenant_id = app_current_tenant_id())`);

      // Drop the app_rls role, best-effort. The role is cluster-global; if it still
      // holds grants in ANOTHER database (e.g. a local copy that also ran v82), the
      // DROP can't succeed from here — a SAVEPOINT keeps that failure from aborting
      // the rest of this migration. A lingering unused login is harmless.
      const roleExists = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = 'app_rls'`);
      if (roleExists.rows.length) {
        await client.query(`SAVEPOINT drop_app_rls`);
        try {
          await client.query(`DROP OWNED BY app_rls`);   // revoke grants + default privileges in THIS db
          await client.query(`DROP ROLE app_rls`);
          await client.query(`RELEASE SAVEPOINT drop_app_rls`);
          console.log('  Dropped app_rls role + its grants');
        } catch (e) {
          await client.query(`ROLLBACK TO SAVEPOINT drop_app_rls`);
          console.warn(`  app_rls role kept (likely has grants in another database): ${e.message} — harmless unused login`);
        }
      }
      console.log(`  Removed tenant_isolation policies on ${TENANT_TABLES.length} tables; restored original member RLS`);
    }
  },
  {
    version: 84,
    description: 'General-purpose code table (4-byte link PK) — referral/access codes with JSONB context',
    async run(client) {
      // First Tier-4 (4-byte INTEGER link) entity on the platform. A general-purpose
      // record any function can mint: a QR/referral/access code with a lifecycle
      // window + usage cap, plus per-code context carried in JSONB.
      //   - link       4-byte INTEGER PK, minted via link_tank (getNextLink('code')).
      //                link_tank auto-registers this table on first getNextLink call
      //                (discovers INTEGER → link_bytes 4), so no manual seed here.
      //   - code       the PUBLIC opaque token (16-byte base58, gen_code.js). Globally
      //                unique — resolve looks it up with no tenant context at scan time.
      //   - code_type  which function owns it (PP_REFERRAL, OER_OBSERVER, …) so many
      //                functions coexist and each queries its own.
      //   - start/end  Bill-epoch SMALLINT validity window (platform date standard).
      //   - max_uses / used_count  usage cap (max_uses NULL = unlimited).
      //   - status     A active / R revoked.
      //   - context    named value pairs the function carries (affiliation, track, …).
      //                JSONB, NOT molecules: this is carry-only per-record context the
      //                platform doesn't right-size / dedup / rule-evaluate. (See the
      //                molecules-vs-JSONB rule.)
      await client.query(`
        CREATE TABLE IF NOT EXISTS code (
          link        INTEGER  PRIMARY KEY,
          code        TEXT     NOT NULL,
          code_type   TEXT     NOT NULL,
          tenant_id   SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          start_date  SMALLINT,
          end_date    SMALLINT,
          max_uses    SMALLINT,
          used_count  SMALLINT NOT NULL DEFAULT 0,
          status      CHAR(1)  NOT NULL DEFAULT 'A',
          context     JSONB    NOT NULL DEFAULT '{}'::jsonb
        )
      `);
      console.log('  ✅ code table created');

      // The public token is looked up on every resolve — globally unique + indexed.
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_code_code ON code(code)`);
      // Each function lists its own codes by (tenant, type).
      await client.query(`CREATE INDEX IF NOT EXISTS idx_code_tenant_type ON code(tenant_id, code_type)`);
      console.log('  ✅ idx_code_code + idx_code_tenant_type created');
    }
  },
  {
    version: 85,
    description: 'WisconsinPATH Stage 1 — REFERRAL_SOURCE member molecule (internal_list: Self-referral / Employer / Board-mandated) for participant classification',
    async run(client) {
      const TENANT = 5;

      // Referral classification hangs on the PARTICIPANT (attaches_to='M'): how they
      // entered the program. Unlike the carry-only referral context on the `code` row
      // (JSONB, v84), this value is queried + behavior-driving on the member (dashboard
      // segmentation, safe-haven status, board-reporting eligibility) — so it is a
      // molecule. Internal_list (fixed code set; values in molecule_value_text) — the
      // member analog of STATE (mol 127), NOT the activity ACCRUAL_TYPE.
      //
      // ⚠️ A member molecule MUST have a molecule_value_lookup row. getMoleculeStorageInfo
      // reads context/attaches_to from there and SILENTLY defaults to activity/'A' when
      // it is missing — which would store rows as attaches_to='A' and make every member
      // read (attaches_to='M') come back empty, with no error. See docs/BEFORE_YOU_WRITE.md.

      // ── 1. molecule_def (guarded insert — molecule_def has no unique constraint to ON CONFLICT on) ──
      let mol = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'REFERRAL_SOURCE'`,
        [TENANT]
      );
      if (!mol.rows.length) {
        // Omitted columns take molecule_def defaults that already match STATE:
        // input_type 'P', value_structure 'single', is_active true, is_required false,
        // is_static false, molecule_type 'D', scalar_type NULL.
        await client.query(`
          INSERT INTO molecule_def (
            molecule_key, label, value_kind, tenant_id, context, attaches_to,
            storage_size, value_type, description
          ) VALUES (
            'REFERRAL_SOURCE', 'Referral Source', 'internal_list', $1, 'member', 'M',
            1, 'code',
            'How the participant entered the program (self / employer / board-mandated) — drives dashboard segmentation, safe-haven status, and board-reporting eligibility'
          )
        `, [TENANT]);
        mol = await client.query(
          `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'REFERRAL_SOURCE'`,
          [TENANT]
        );
        console.log(`  ✅ REFERRAL_SOURCE molecule_def created (molecule_id=${mol.rows[0].molecule_id})`);
      } else {
        console.log(`  ⏭️  REFERRAL_SOURCE molecule_def already exists (molecule_id=${mol.rows[0].molecule_id})`);
      }
      const molId = mol.rows[0].molecule_id;

      // ── 2. molecule_value_lookup — MANDATORY for a member molecule (mirrors STATE lookup_id 85) ──
      const lookExists = await client.query(
        `SELECT 1 FROM molecule_value_lookup WHERE molecule_id = $1`, [molId]
      );
      if (!lookExists.rows.length) {
        await client.query(`
          INSERT INTO molecule_value_lookup (
            molecule_id, is_tenant_specific, column_order, decimal_places, col_description,
            value_type, value_kind, scalar_type, context, storage_size, attaches_to
          ) VALUES (
            $1, true, 1, 0, 'How the participant entered the program',
            'code', 'internal_list', NULL, 'member', 1, 'M'
          )
        `, [molId]);
        console.log('  ✅ REFERRAL_SOURCE molecule_value_lookup row created (context=member, attaches_to=M)');
      } else {
        console.log('  ⏭️  REFERRAL_SOURCE molecule_value_lookup row already exists');
      }

      // ── 3. molecule_value_text — the three predefined values ──
      // text_value is the stored code; display_label shows in the UI. The producer's
      // referral code carries the display string ('Self-referral'/'Employer'/
      // 'Board-mandated'); registration maps it onto these codes.
      const values = [
        { code: 'SELF',  label: 'Self-referral',  sort: 1 },
        { code: 'EMP',   label: 'Employer',       sort: 2 },
        { code: 'BOARD', label: 'Board-mandated', sort: 3 }
      ];
      for (const v of values) {
        const ex = await client.query(
          `SELECT 1 FROM molecule_value_text WHERE molecule_id = $1 AND text_value = $2`,
          [molId, v.code]
        );
        if (!ex.rows.length) {
          await client.query(`
            INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order, is_active)
            VALUES ($1, $2, $3, $4, true)
          `, [molId, v.code, v.label, v.sort]);
          console.log(`  ✅ value ${v.code} (${v.label}) added`);
        } else {
          console.log(`  ⏭️  value ${v.code} already exists`);
        }
      }

      // ── 4. Add to the tenant-5 member composite (M) so enroll/update validates it ──
      // The M composite is the authority for tenant-specific member fields (v79). It
      // already exists for tenant 5 (created alongside LICENSING_BOARD). Mirror v79.
      const comp = await client.query(
        `SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = 'M'`,
        [TENANT]
      );
      if (comp.rows.length) {
        const compositeLink = comp.rows[0].link;
        const detailExists = await client.query(
          `SELECT 1 FROM composite_detail WHERE p_link = $1 AND molecule_id = $2`,
          [compositeLink, molId]
        );
        if (!detailExists.rows.length) {
          const detailLink = await getNextLink(client, TENANT, 'composite_detail');
          await client.query(`
            INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, sort_order)
            VALUES ($1, $2, $3, false, false, 2)
          `, [detailLink, compositeLink, molId]);
          console.log(`  ✅ REFERRAL_SOURCE added to tenant-5 M composite (detail link=${detailLink})`);
        } else {
          console.log('  ⏭️  REFERRAL_SOURCE already in tenant-5 M composite');
        }
      } else {
        console.log('  ⚠️  tenant-5 M composite not found — skipping composite add (expected v79 to have created it)');
      }
    }
  },
  {
    version: 86,
    description: 'WisconsinPATH Stage 1 — add REFERRAL_SOURCE to the wi_php Member Profile (M) input template so it shows/edits on the participant profile (completes v85)',
    async run(client) {
      const tenantId = 5;

      // v85 put REFERRAL_SOURCE in the M *composite* (the authority — PUT validates
      // against it). This adds it to the M *input template* (the profile FORM layout).
      // GET /v1/member/:id/molecules surfaces ONLY input-template fields, so without
      // this the field can be saved but never displayed. Mirrors LICENSING_BOARD (v75).
      const tpl = await client.query(
        `SELECT template_id FROM input_template WHERE tenant_id = $1 AND activity_type = 'M' AND is_active = true`,
        [tenantId]
      );
      if (!tpl.rows.length) {
        console.log('  ⚠️  wi_php M input template not found — skipping (expected v75 to have created it)');
        return;
      }
      const tplId = tpl.rows[0].template_id;

      const exists = await client.query(
        `SELECT 1 FROM input_template_field WHERE template_id = $1 AND molecule_key = 'REFERRAL_SOURCE'`,
        [tplId]
      );
      if (exists.rows.length) {
        console.log('  ⏭️  REFERRAL_SOURCE already on the M input template');
        return;
      }

      // row_number 20 places it after LICENSING_BOARD (row 10, from v75).
      await client.query(`
        INSERT INTO input_template_field
          (template_id, row_number, sort_order, molecule_key, display_label,
           start_position, display_width, enterable, is_required)
        VALUES ($1, 20, 1, 'REFERRAL_SOURCE', 'Referral Source', 1, 50, 'Y', false)
      `, [tplId]);
      console.log(`  ✅ Added REFERRAL_SOURCE field to wi_php M input template_id=${tplId}`);
    }
  },
  {
    version: 87,
    description: 'Repair internal-list value_ids to per-molecule 1..N (global-sequence-default overflow) + add value_id range CHECK (1-127)',
    async run(client) {
      // Root cause: internal-list values store a per-molecule value_id, squished into a
      // single-byte cell — so the code must be 1-127 and numbered per molecule. But
      // molecule_value_text.value_id DEFAULTS to a GLOBAL sequence (now past 127); any list
      // seeded via a raw INSERT (not the first-available allocator) inherited value_ids >127
      // that silently overflow the byte on save. This repairs every such list, then locks it
      // down with a CHECK so a bad insert fails loudly instead of corrupting silently.

      // 1. Renumber every internal list that has a value_id > 127, PER MOLECULE, preserving
      //    display order. Skip (loudly) any that already has stored data — those need a
      //    data-aware migration, not a blind renumber. (All internal lists are storage_size 1
      //    → 5_data_1; the scan that found these confirmed zero stored rows for each.)
      const broken = await client.query(`
        SELECT md.molecule_id, md.molecule_key, md.tenant_id
        FROM molecule_def md
        WHERE md.value_kind = 'internal_list'
          AND EXISTS (
            SELECT 1 FROM molecule_value_text mvt
            WHERE mvt.molecule_id = md.molecule_id AND mvt.value_id > 127
          )
        ORDER BY md.molecule_id
      `);

      for (const m of broken.rows) {
        const stored = await client.query(
          `SELECT COUNT(*)::int AS n FROM "5_data_1" WHERE molecule_id = $1`, [m.molecule_id]
        );
        if (stored.rows[0].n > 0) {
          console.log(`  ⚠️  ${m.molecule_key} (mol ${m.molecule_id}) has ${stored.rows[0].n} stored row(s) — SKIPPING renumber (needs a data-aware migration)`);
          continue;
        }

        const vals = await client.query(
          `SELECT text_value, display_label, sort_order
           FROM molecule_value_text WHERE molecule_id = $1
           ORDER BY sort_order NULLS LAST, value_id`,
          [m.molecule_id]
        );
        await client.query(`DELETE FROM molecule_value_text WHERE molecule_id = $1`, [m.molecule_id]);
        let i = 1;
        for (const v of vals.rows) {
          await client.query(
            `INSERT INTO molecule_value_text (molecule_id, value_id, text_value, display_label, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [m.molecule_id, i, v.text_value, v.display_label, v.sort_order]
          );
          i++;
        }
        console.log(`  ✅ ${m.molecule_key} (mol ${m.molecule_id}) renumbered to 1..${i - 1}`);
      }

      // 2. Now that every row is 1-127, add the guard. Idempotent (guard on pg_constraint).
      const hasCheck = await client.query(
        `SELECT 1 FROM pg_constraint WHERE conname = 'molecule_value_text_value_id_range'`
      );
      if (!hasCheck.rows.length) {
        await client.query(
          `ALTER TABLE molecule_value_text
             ADD CONSTRAINT molecule_value_text_value_id_range CHECK (value_id BETWEEN 1 AND 127)`
        );
        console.log('  ✅ CHECK (value_id BETWEEN 1 AND 127) added to molecule_value_text');
      } else {
        console.log('  ⏭️  value_id range CHECK already present');
      }
    }
  },
  {
    version: 88,
    description: 'Widen the staff-login link from 2-byte SMALLINT to 4-byte INTEGER (platform_user.link + audit_log_1..5.user_link) so molecules can hang on users',
    async run(client) {
      // Molecules-on-users foundation (Session 128, design: docs/MOLECULE_PARENT_GENERALIZATION.md).
      // A molecule attaches to a parent's link. The staff-login link (platform_user.link) is a
      // 2-byte SMALLINT allocated from a GLOBAL pool (−32768…32767 ≈ 65K values across all tenants);
      // the only ceiling is the physical column width — the link-tank allocator just increments and
      // never checks a bound (verified: get_next_link.js returns the raw number for 2- OR 4-byte,
      // so the tank's link_bytes=2 is harmless and stays untouched). Widening is trivial now
      // (5 links allocated, all near −32768) and expensive later.
      //
      // The link is copied into audit_log_*.user_link (who did this) for attribution — those 5
      // copies must widen too so the audit join (a.user_link = u.link) keeps matching. Full sweep
      // confirmed these are the ONLY 6 columns holding the user link; NO foreign key references
      // platform_user.link (all 9 FKs point at user_id). Widening a whole-number column is lossless.

      const targets = [
        { table: 'platform_user', column: 'link' },
        { table: 'audit_log_1',   column: 'user_link' },
        { table: 'audit_log_2',   column: 'user_link' },
        { table: 'audit_log_3',   column: 'user_link' },
        { table: 'audit_log_4',   column: 'user_link' },
        { table: 'audit_log_5',   column: 'user_link' }
      ];

      for (const t of targets) {
        const cur = await client.query(
          `SELECT data_type FROM information_schema.columns
           WHERE table_name = $1 AND column_name = $2`,
          [t.table, t.column]
        );
        if (cur.rows.length === 0) {
          throw new Error(`Expected column ${t.table}.${t.column} not found`);
        }
        if (cur.rows[0].data_type === 'integer') {
          console.log(`  ⏭️  ${t.table}.${t.column} already integer`);
          continue;
        }
        if (cur.rows[0].data_type !== 'smallint') {
          throw new Error(`${t.table}.${t.column} is ${cur.rows[0].data_type}, expected smallint — refusing to widen`);
        }
        await client.query(`ALTER TABLE "${t.table}" ALTER COLUMN "${t.column}" TYPE integer`);
        console.log(`  ✅ ${t.table}.${t.column} widened smallint → integer`);
      }
    }
  },
  {
    version: 89,
    description: 'molecule_def.parent_bytes — a molecule declares its parent key size (1-5) so the engine routes to {parent_bytes}_data_* instead of assuming 5',
    async run(client) {
      // Molecules-on-users, step 2 (design: docs/MOLECULE_PARENT_GENERALIZATION.md).
      // A molecule attaches to a parent via that parent's link. Storage tables are named
      // {parent_key_bytes}_data_{column_widths}; the code hardcoded the leading "5" because
      // both existing parents (member, activity) use a 5-byte CHAR(5) link. This adds an
      // explicit per-molecule declaration of the parent's key size so the engine can route to
      // 4_data_* (user, 4-byte INTEGER link), 2_data_*, etc. DEFAULT 5 means every existing
      // molecule keeps landing in 5_data_* — zero behavior change for member/activity/Delta.
      const has = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'molecule_def' AND column_name = 'parent_bytes'
      `);
      if (has.rows.length) {
        console.log('  ⏭️  molecule_def.parent_bytes already present');
        return;
      }
      await client.query(`
        ALTER TABLE molecule_def
          ADD COLUMN parent_bytes SMALLINT NOT NULL DEFAULT 5
          CHECK (parent_bytes BETWEEN 1 AND 5)
      `);
      console.log('  ✅ molecule_def.parent_bytes added (SMALLINT NOT NULL DEFAULT 5, CHECK 1-5)');
    }
  },
  {
    version: 90,
    description: 'molecule_value_lookup.list_source_molecule_id — an internal-list column can borrow another molecule\'s value list (one list, no double entry)',
    async run(client) {
      // Shared-list pointer (Session 128). An internal-list column stores a 1-byte
      // value_id resolved against molecule_value_text BY MOLECULE ID. This column lets
      // a list column say "use THAT molecule's list instead of my own" — e.g. the
      // position/clinic molecule's position column borrows the POSITION molecule's list.
      // The list is then entered and maintained in exactly one place (the owner molecule);
      // borrowers never hold their own copy, so the lists can't drift. NULL (the default)
      // = own list, exactly today's behavior for every existing molecule.
      const has = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'molecule_value_lookup' AND column_name = 'list_source_molecule_id'
      `);
      if (has.rows.length) {
        console.log('  ⏭️  molecule_value_lookup.list_source_molecule_id already present');
        return;
      }
      await client.query(`
        ALTER TABLE molecule_value_lookup
          ADD COLUMN list_source_molecule_id SMALLINT NULL
          REFERENCES molecule_def(molecule_id)
      `);
      console.log('  ✅ molecule_value_lookup.list_source_molecule_id added (nullable FK → molecule_def)');
    }
  },
  {
    version: 91,
    description: 'Delete orphan molecule definitions ML_RISK_LEVEL + ML_CONFIDENCE (wi_php) — abandoned design, never wired',
    async run(client) {
      // Session 128 audit finding, approved by Bill Session 129. Both molecules
      // were seeded in v49 but never got columns, never stored data, and nothing
      // in the code references them — the ML pipeline stores ML_RISK_SCORE and
      // computes the level from the score dynamically (see the v49 comment).
      // Resolve by molecule_key, never molecule_id (ids diverge across
      // environments). Idempotent: zero rows deleted is a clean no-op.
      const tenantId = 5;
      const keys = ['ML_RISK_LEVEL', 'ML_CONFIDENCE'];

      const defs = await client.query(
        `SELECT molecule_id, molecule_key FROM molecule_def
         WHERE tenant_id = $1 AND molecule_key = ANY($2)`,
        [tenantId, keys]
      );
      if (defs.rows.length === 0) {
        console.log('  ⏭️  ML_RISK_LEVEL / ML_CONFIDENCE already absent — nothing to do');
        return;
      }
      const ids = defs.rows.map(r => r.molecule_id);

      // Defensive cleanup of satellite rows. Locally both are bare definitions
      // (no lookup rows, no values, no stored data), but Heroku ran the same
      // history at different ids — clean the same satellites there.
      await client.query('DELETE FROM molecule_value_lookup WHERE molecule_id = ANY($1)', [ids]);
      await client.query('DELETE FROM molecule_value_text WHERE molecule_id = ANY($1)', [ids]);
      const storageTable = await client.query(`SELECT to_regclass('"5_data_22"') AS t`);
      if (storageTable.rows[0].t) {
        await client.query('DELETE FROM "5_data_22" WHERE molecule_id = ANY($1)', [ids]);
      }

      const del = await client.query(
        'DELETE FROM molecule_def WHERE molecule_id = ANY($1) RETURNING molecule_key',
        [ids]
      );
      console.log(`  ✅ Deleted orphan molecule definition(s): ${del.rows.map(r => r.molecule_key).join(', ')}`);
    }
  },
  {
    version: 92,
    description: 'POSITION + POSITIONCLINIC parity — delete the UI-created pair, recreate molecules/values/shared-list/4_data tables in one migration (Heroku path)',
    async run(client) {
      // The plan from Session 128, executed Session 129 on Bill's go. Bill created
      // POSITION (staff roles) and POSITIONCLINIC (role@clinic) through the admin UI
      // to flush out the page bugs (it did). This migration is the real record:
      // delete the UI-created pair + their 4_data_* tables, recreate everything
      // here, so local and Heroku converge through the same path. Resolve by
      // molecule_key, NEVER molecule_id (sequences diverge across environments).
      // Shape decision (Bill, Session 129): position + clinic (12) — real use will
      // tell us if the health-system level (122) is needed; nothing stored yet.
      const tenantId = 5;

      // ── 1. Delete the UI-created pair (no-op on Heroku, where they never existed)
      const old = await client.query(
        `SELECT molecule_id FROM molecule_def
         WHERE tenant_id = $1 AND molecule_key IN ('POSITION','POSITIONCLINIC')`,
        [tenantId]
      );
      if (old.rows.length) {
        const ids = old.rows.map(r => r.molecule_id);
        await client.query('DELETE FROM molecule_value_text WHERE molecule_id = ANY($1)', [ids]);
        await client.query('DELETE FROM molecule_value_lookup WHERE molecule_id = ANY($1)', [ids]);
        await client.query('DELETE FROM molecule_def WHERE molecule_id = ANY($1)', [ids]);
        console.log(`  ✅ Deleted UI-created POSITION/POSITIONCLINIC (ids ${ids.join(', ')})`);
      } else {
        console.log('  ⏭️  No UI-created POSITION/POSITIONCLINIC found (fresh environment)');
      }
      await client.query('DROP TABLE IF EXISTS "4_data_1"');
      await client.query('DROP TABLE IF EXISTS "4_data_12"');

      // ── 2. Recreate the molecule definitions (faithful to the UI-created shape)
      const pos = await client.query(`
        INSERT INTO molecule_def (tenant_id, molecule_key, label, value_kind, value_type,
          storage_size, parent_bytes, context, attaches_to, molecule_type, input_type,
          value_structure, is_active, display_order)
        VALUES ($1, 'POSITION', 'Position', 'internal_list', 'code',
          '1', 4, 'none', NULL, 'D', 'P', 'single', true, 0)
        RETURNING molecule_id
      `, [tenantId]);
      const posId = pos.rows[0].molecule_id;

      const pc = await client.query(`
        INSERT INTO molecule_def (tenant_id, molecule_key, label, description, value_kind,
          value_type, storage_size, parent_bytes, context, attaches_to, molecule_type,
          input_type, value_structure, is_active, display_order)
        VALUES ($1, 'POSITIONCLINIC', 'Clinic Position', 'These are positions within a clinic',
          'internal_list', 'code', '12', 4, 'none', NULL, 'D', 'P', 'single', true, 0)
        RETURNING molecule_id
      `, [tenantId]);
      const pcId = pc.rows[0].molecule_id;

      // ── 3. Column definitions. POSITIONCLINIC col 1 BORROWS POSITION's list
      // (list_source_molecule_id) — one list, maintained on POSITION only.
      await client.query(`
        INSERT INTO molecule_value_lookup (molecule_id, column_order, column_type,
          col_description, value_type, value_kind, context, storage_size, is_tenant_specific)
        VALUES ($1, 1, 'internal_list', 'Position List', 'code', 'internal_list', 'none', '1', true)
      `, [posId]);
      await client.query(`
        INSERT INTO molecule_value_lookup (molecule_id, column_order, column_type,
          col_description, value_type, value_kind, context, storage_size,
          is_tenant_specific, list_source_molecule_id)
        VALUES ($1, 1, 'internal_list_shared', 'The position', 'code', 'internal_list',
          'none', '12', true, $2)
      `, [pcId, posId]);
      await client.query(`
        INSERT INTO molecule_value_lookup (molecule_id, column_order, column_type,
          col_description, value_type, value_kind, scalar_type, context, storage_size,
          is_tenant_specific, table_name, lookup_table_key, id_column, code_column, label_column)
        VALUES ($1, 2, 'database_ref', 'The partner Program', 'numeric', 'external_list',
          'numeric', 'none', '12', true, 'partner_program', 'partner_program',
          'program_id', 'program_code', 'program_name')
      `, [pcId]);

      // ── 4. POSITION's values — explicit per-molecule value_id 1..N (never the
      // global default; see MOLECULES.md §5.3).
      const values = [[1, 'CASEMAN', 'Case Manager'], [2, 'MEDDIR', 'Medical Director'], [3, 'CLINICIAN', 'Clinician']];
      for (const [vid, code, label] of values) {
        await client.query(`
          INSERT INTO molecule_value_text (molecule_id, value_id, text_value, display_label)
          VALUES ($1, $2, $3, $4)
        `, [posId, vid, code, label]);
      }

      // ── 5. The 4-byte-parent storage tables (p_link integer = staff-login link).
      await client.query(`
        CREATE TABLE "4_data_1" (
          p_link      integer      NOT NULL,
          molecule_id smallint     NOT NULL,
          attaches_to character(1) NOT NULL DEFAULT 'A',
          c1          character(1)
        )
      `);
      await client.query('CREATE INDEX idx_4_data_1_attaches ON "4_data_1" (attaches_to, p_link)');
      await client.query('CREATE INDEX idx_4_data_1_plink ON "4_data_1" (p_link, molecule_id)');
      await client.query(`
        CREATE TABLE "4_data_12" (
          p_link      integer      NOT NULL,
          molecule_id smallint     NOT NULL,
          attaches_to character(1) NOT NULL DEFAULT 'A',
          c1          character(1),
          n1          smallint
        )
      `);
      await client.query('CREATE INDEX idx_4_data_12_attaches ON "4_data_12" (attaches_to, p_link)');
      await client.query('CREATE INDEX idx_4_data_12_plink ON "4_data_12" (p_link, molecule_id)');

      console.log(`  ✅ Recreated POSITION (id ${posId}, 3 values) + POSITIONCLINIC (id ${pcId}, borrows ${posId}'s list) + 4_data_1 + 4_data_12`);
    }
  },
  {
    version: 93,
    description: 'Claude system account off tenant 5 — platform accounts are tenant-less, never tenant staff',
    async run(client) {
      // Session 129, Bill: "Claude cannot be on this list." The Claude system
      // login was parked on the Wisconsin tenant as an old convenience, which
      // put a robot account in Erica's staff roster. Platform accounts are
      // tenant-less (like Bill's). Idempotent; a no-op where no such row exists.
      const r = await client.query(
        `UPDATE platform_user SET tenant_id = NULL
         WHERE username = 'Claude' AND role = 'superuser' AND tenant_id IS NOT NULL
         RETURNING user_id`
      );
      console.log(r.rowCount
        ? `  ✅ Claude system account is now tenant-less (user_id ${r.rows[0].user_id})`
        : '  ⏭️  Claude system account already tenant-less or absent — nothing to do');
    }
  },
  {
    version: 94,
    description: 'Restore Claude system account to tenant 5 — v93 reverted; the role guards deliver the requirement without it',
    async run(client) {
      // Session 129, same day as v93. Making the system account tenant-less
      // turned out to ripple much further than the staff list — login routing,
      // the browser-test sign-in flow, and notification delivery all treat the
      // account as Insight staff. Bill's actual requirement ("Claude cannot be
      // on Erica's list") is fully delivered by the server-side guards shipped
      // with this session: a tenant admin's user list excludes superusers, and
      // every user endpoint refuses a non-superuser targeting a superuser
      // account. So: account restored, guards kept. Net effect of v93+v94 on
      // any fresh environment: nothing. (Same pattern as the RLS v81-v83 story.)
      const r = await client.query(
        `UPDATE platform_user SET tenant_id = 5
         WHERE username = 'Claude' AND role = 'superuser' AND tenant_id IS NULL
         RETURNING user_id`
      );
      console.log(r.rowCount
        ? `  ✅ Claude system account restored to tenant 5 (user_id ${r.rows[0].user_id})`
        : '  ⏭️  Claude system account already tenant-bound or absent — nothing to do');
    }
  },
  {
    version: 95,
    description: 'WisconsinPATH Stage 1 — registration review queue config: REG_REVIEW action, signup promotion trigger, position-routed notification, SLA job',
    async run(client) {
      // The registration review queue (Session 129 design, Erica's routing:
      // Case-Manager-first, escalate to Medical Director). The TRIGGER is pure
      // configuration: enrolling a member runs evaluateEnrollmentPromotions,
      // which qualifies an enrollment-counter promotion and dispatches its
      // external result -> createRegistryItem. Everything resolves by CODE,
      // never id (sequences diverge across environments).
      const tenantId = 5;

      // 1. Allow notification rules to route by POSITION (the staff-login
      // molecule from v92). recipient_role carries "MOLECULEKEY:CODE".
      await client.query(`ALTER TABLE notification_rule DROP CONSTRAINT IF EXISTS nr_recipient_type_check`);
      await client.query(`
        ALTER TABLE notification_rule ADD CONSTRAINT nr_recipient_type_check
        CHECK (recipient_type::text = ANY (ARRAY['role','member','all_clinical','position']))
      `);
      console.log('  ✅ notification_rule.recipient_type now allows position');

      // 2. The external action: what happens when the trigger fires.
      await client.query(`
        INSERT INTO external_result_action (tenant_id, action_code, action_name, function_name, description, is_active, urgency, sla_hours)
        SELECT $1, 'REG_REVIEW', 'New Registration Review', 'createRegistryItem',
               'New participant registration awaiting case-manager review', true, 'YELLOW', 48
        WHERE NOT EXISTS (SELECT 1 FROM external_result_action WHERE tenant_id = $1 AND action_code = 'REG_REVIEW')
      `, [tenantId]);
      const action = await client.query(
        `SELECT action_id FROM external_result_action WHERE tenant_id = $1 AND action_code = 'REG_REVIEW'`, [tenantId]);
      const actionId = action.rows[0].action_id;

      // 3. The signup trigger: an enrollment-counter promotion whose external
      // result is the REG_REVIEW action. Auto-enrolls at signup, qualifies
      // immediately (goal 1, seeded by the act of enrolling), fires once.
      const promoExists = await client.query(
        `SELECT promotion_id FROM promotion WHERE tenant_id = $1 AND promotion_code = 'REG_REVIEW'`, [tenantId]);
      let promoId;
      if (promoExists.rows.length) {
        promoId = promoExists.rows[0].promotion_id;
        console.log('  ⏭️  REG_REVIEW promotion already present');
      } else {
        const promo = await client.query(`
          INSERT INTO promotion (tenant_id, promotion_code, promotion_name, promotion_description,
            start_date, end_date, is_active, enrollment_type, counter_joiner, reward_type, process_limit_count)
          VALUES ($1, 'REG_REVIEW', 'Registration Review Trigger',
            'Creates a registration review item when a new participant enrolls',
            CURRENT_DATE, '2099-12-31', true, 'A', 'AND', 'external', 1)
          RETURNING promotion_id
        `, [tenantId]);
        promoId = promo.rows[0].promotion_id;
        await client.query(`
          INSERT INTO promo_wt_count (promotion_id, tenant_id, count_type, goal_amount, sort_order)
          VALUES ($1, $2, 'enrollments', 1, 0)
        `, [promoId, tenantId]);
        await client.query(`
          INSERT INTO promotion_result (promotion_id, tenant_id, result_type, result_description, result_reference_id, sort_order)
          VALUES ($1, $2, 'external', 'New registration review', $3, 0)
        `, [promoId, tenantId, actionId]);
        console.log(`  ✅ REG_REVIEW signup trigger promotion created (id ${promoId})`);
      }

      // 4. Notification: new registration review -> everyone holding the
      // Case Manager position (POSITIONCLINIC value CASEMAN, any clinic).
      await client.query(`
        INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role,
          severity, title_template, body_template, is_active)
        SELECT $1, 'REGISTRY_REG_REVIEW', 'position', 'POSITIONCLINIC:CASEMAN',
          'warning', 'New registration awaiting review',
          '{member_name} has registered and is awaiting case-manager review.', true
        WHERE NOT EXISTS (SELECT 1 FROM notification_rule WHERE tenant_id = $1 AND event_type = 'REGISTRY_REG_REVIEW')
      `, [tenantId]);

      // 5. Escalation notification: overdue or case-manager escalation ->
      // everyone holding the Medical Director position.
      await client.query(`
        INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role,
          severity, title_template, body_template, is_active)
        SELECT $1, 'REG_REVIEW_ESCALATED', 'position', 'POSITIONCLINIC:MEDDIR',
          'critical', 'Registration review escalated',
          'A registration review for {member_name} needs Medical Director attention. {detail}', true
        WHERE NOT EXISTS (SELECT 1 FROM notification_rule WHERE tenant_id = $1 AND event_type = 'REG_REVIEW_ESCALATED')
      `, [tenantId]);
      console.log('  ✅ Notification rules: REGISTRY_REG_REVIEW -> Case Managers, REG_REVIEW_ESCALATED -> Medical Directors');

      // 6. The overdue clock: daily scan (manually runnable from Scheduled Jobs).
      await client.query(`
        INSERT INTO scheduled_job (tenant_id, job_code, job_name, job_description, interval_minutes, is_active)
        SELECT $1, 'REG_REVIEW_SLA', 'Registration Review SLA Check',
          'Flags and escalates registration reviews still open past their SLA deadline', 1440, true
        WHERE NOT EXISTS (SELECT 1 FROM scheduled_job WHERE tenant_id = $1 AND job_code = 'REG_REVIEW_SLA')
      `, [tenantId]);
      console.log('  ✅ REG_REVIEW_SLA scheduled job registered');
    }
  },

  // v96 — Instrument library, part 1 (WisconsinPATH Stage 2 opener):
  // PHQ-9 + GAD-7 (both PUBLIC DOMAIN — free to use, published scoring) as data,
  // plus catalog metadata on the survey table so the admin list reads like a
  // library (purpose: screening vs monitoring; license status). PHQ-9 item 9
  // (self-harm) gets its own question category (PHQ9_SI) so the scorer can spot
  // a positive answer and raise PHQ9_SI_POSITIVE → alert bonus → RED registry
  // item (24h SLA) through the existing signal→bonus→registry rails.
  // Screening instruments carry cadence_days = NULL — MEDS already filters
  // `cadence_days IS NOT NULL AND > 0`, so they never produce missed-survey
  // alerts. All links resolved dynamically (MAX+1) and rows guarded by code —
  // sequences and link maxes diverge between local and Heroku.
  {
    version: 96,
    description: 'Instrument library part 1 — PHQ-9 + GAD-7 (public domain) + catalog metadata (purpose / license status) + PHQ-9 self-harm alert wiring',
    async run(client) {
      const T = 5; // Wisconsin PHP tenant

      // --- 1. Catalog metadata columns (platform-wide, nullable) ---
      await client.query(`ALTER TABLE survey ADD COLUMN IF NOT EXISTS instrument_purpose VARCHAR(20)`);
      await client.query(`ALTER TABLE survey ADD COLUMN IF NOT EXISTS license_status VARCHAR(20)`);
      console.log('  ✅ survey: instrument_purpose + license_status columns added');

      // --- 2. Backfill the existing 8 wi_php instruments ---
      // PPSI + Provider Pulse are Insight's own instruments (owned). The 6
      // anchor-battery instruments stay license_status NULL — their licensing
      // labels are Erica's to confirm, not ours to guess.
      await client.query(
        `UPDATE survey SET instrument_purpose = 'monitoring', license_status = 'owned'
         WHERE tenant_id = $1 AND survey_code IN ('PPSI','PROVPULSE')`, [T]);
      await client.query(
        `UPDATE survey SET instrument_purpose = 'monitoring'
         WHERE tenant_id = $1 AND survey_code IN ('PROMIS8A','PFI','MINIZ','UCLA3','CFQ8','CGIS')
           AND instrument_purpose IS NULL`, [T]);
      console.log('  ✅ Existing 8 instruments backfilled (anchors: license left for Erica to confirm)');

      // --- 3. SCREENING accrual-type value (v29 ANCHOR_SURVEY pattern) ---
      const molResult = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'ACCRUAL_TYPE'`, [T]);
      if (molResult.rows.length) {
        const moleculeId = molResult.rows[0].molecule_id;
        const existing = await client.query(
          `SELECT value_id FROM molecule_value_text WHERE molecule_id = $1 AND text_value = 'SCREENING'`,
          [moleculeId]);
        if (!existing.rows.length) {
          const maxResult = await client.query(
            `SELECT COALESCE(MAX(value_id), 0) AS max_id FROM molecule_value_text WHERE molecule_id = $1`,
            [moleculeId]);
          await client.query(
            `INSERT INTO molecule_value_text (molecule_id, value_id, text_value) VALUES ($1, $2, 'SCREENING')`,
            [moleculeId, maxResult.rows[0].max_id + 1]);
          console.log(`  ✅ Added SCREENING as value_id ${maxResult.rows[0].max_id + 1} to ACCRUAL_TYPE`);
        } else {
          console.log('  ⏭️  SCREENING already exists in ACCRUAL_TYPE');
        }
      } else {
        console.log('  ⚠️ ACCRUAL_TYPE molecule not found — skipping SCREENING value');
      }

      // --- 4. Question categories (resolve by code; create only if missing) ---
      async function ensureCategory(code, name) {
        const found = await client.query(
          `SELECT link FROM survey_question_category WHERE tenant_id = $1 AND category_code = $2`, [T, code]);
        if (found.rows.length) return found.rows[0].link;
        const next = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey_question_category`);
        await client.query(
          `INSERT INTO survey_question_category (link, tenant_id, category_code, category_name, status)
           VALUES ($1, $2, $3, $4, 'A')`, [next.rows[0].l, T, code, name]);
        console.log(`  ✅ Category ${code} created (link=${next.rows[0].l})`);
        return next.rows[0].l;
      }
      const catPHQ9   = await ensureCategory('PHQ9',    'Depression Screening (PHQ-9)');
      const catPHQ9SI = await ensureCategory('PHQ9_SI', 'Self-Harm Risk (PHQ-9 Item 9)');
      const catGAD7   = await ensureCategory('GAD7',    'Anxiety Screening (GAD-7)');

      // --- 5. The two surveys (guard by survey_code; links dynamic) ---
      async function ensureSurvey(code, name, description, scoreFn) {
        const found = await client.query(
          `SELECT link FROM survey WHERE tenant_id = $1 AND survey_code = $2`, [T, code]);
        if (found.rows.length) { console.log(`  ⏭️  Survey ${code} already exists`); return null; }
        const next = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey`);
        await client.query(
          `INSERT INTO survey (link, tenant_id, survey_code, survey_name, survey_description,
                               respondent_type, status, score_function, cadence_days,
                               instrument_purpose, license_status)
           VALUES ($1, $2, $3, $4, $5, 'S', 'A', $6, NULL, 'screening', 'public_domain')`,
          [next.rows[0].l, T, code, name, description, scoreFn]);
        console.log(`  ✅ Survey ${code} created (link=${next.rows[0].l})`);
        return next.rows[0].l;
      }
      const phq9Link = await ensureSurvey('PHQ9', 'Patient Health Questionnaire (PHQ-9)',
        'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
        'scorePHQ9.js');
      const gad7Link = await ensureSurvey('GAD7', 'Generalized Anxiety Disorder Scale (GAD-7)',
        'Over the last 2 weeks, how often have you been bothered by the following problems?',
        'scoreGAD7.js');

      // --- 6. Questions + answers + list rows (only when the survey is new) ---
      const freqScale = [
        { text: 'Not at all', value: 0 }, { text: 'Several days', value: 1 },
        { text: 'More than half the days', value: 2 }, { text: 'Nearly every day', value: 3 }
      ];
      async function addQ(surveyLink, catLink, questionText, displayOrder) {
        const q = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey_question`);
        const qL = q.rows[0].l;
        await client.query(
          `INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status)
           VALUES ($1, $2, $3, $4, true, false, 'A')`, [qL, T, catLink, questionText]);
        for (let i = 0; i < freqScale.length; i++) {
          const a = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey_question_answer`);
          await client.query(
            `INSERT INTO survey_question_answer (link, question_link, answer_text, answer_value, display_order, status)
             VALUES ($1, $2, $3, $4, $5, 'A')`, [a.rows[0].l, qL, freqScale[i].text, freqScale[i].value, i + 1]);
        }
        const ql = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey_question_list`);
        await client.query(
          `INSERT INTO survey_question_list (link, tenant_id, survey_link, question_link, display_order, status)
           VALUES ($1, $2, $3, $4, $5, 'A')`, [ql.rows[0].l, T, surveyLink, qL, displayOrder]);
      }

      if (phq9Link) {
        const phq9Items = [
          'Little interest or pleasure in doing things',
          'Feeling down, depressed, or hopeless',
          'Trouble falling or staying asleep, or sleeping too much',
          'Feeling tired or having little energy',
          'Poor appetite or overeating',
          'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
          'Trouble concentrating on things, such as reading the newspaper or watching television',
          'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual'
        ];
        for (let i = 0; i < phq9Items.length; i++) await addQ(phq9Link, catPHQ9, phq9Items[i], i + 1);
        // Item 9 — its own category so the scorer can detect a positive answer.
        await addQ(phq9Link, catPHQ9SI,
          'Thoughts that you would be better off dead or of hurting yourself in some way', 9);
        console.log('  ✅ PHQ-9: 9 items seeded (item 9 in its own PHQ9_SI category)');
      }

      if (gad7Link) {
        const gad7Items = [
          'Feeling nervous, anxious, or on edge',
          'Not being able to stop or control worrying',
          'Worrying too much about different things',
          'Trouble relaxing',
          'Being so restless that it is hard to sit still',
          'Becoming easily annoyed or irritable',
          'Feeling afraid as if something awful might happen'
        ];
        for (let i = 0; i < gad7Items.length; i++) await addQ(gad7Link, catGAD7, gad7Items[i], i + 1);
        console.log('  ✅ GAD-7: 7 items seeded');
      }

      // --- 7. PHQ9_SI_POSITIVE signal type ---
      await client.query(
        `INSERT INTO signal_type (tenant_id, signal_code, signal_name, description, is_active)
         SELECT $1, 'PHQ9_SI_POSITIVE', 'PHQ-9 Self-Harm Item Positive',
                'PHQ-9 item 9 (thoughts of self-harm) answered above "Not at all"', true
         WHERE NOT EXISTS (SELECT 1 FROM signal_type WHERE tenant_id = $1 AND signal_code = 'PHQ9_SI_POSITIVE')`,
        [T]);
      console.log('  ✅ PHQ9_SI_POSITIVE signal type registered');

      // --- 8. Alert bonus: SIGNAL = PHQ9_SI_POSITIVE → SR_RED registry item (24h SLA) ---
      const bonusExists = await client.query(
        `SELECT bonus_id FROM bonus WHERE tenant_id = $1 AND bonus_code = 'PHQ9_SI_ALERT'`, [T]);
      if (!bonusExists.rows.length) {
        const srRed = await client.query(
          `SELECT action_id FROM external_result_action WHERE tenant_id = $1 AND action_code = 'SR_RED'`, [T]);
        if (!srRed.rows.length) throw new Error('SR_RED external action not found for tenant 5');

        const ruleResult = await client.query(`INSERT INTO rule DEFAULT VALUES RETURNING rule_id`);
        const ruleId = ruleResult.rows[0].rule_id;
        await client.query(
          `INSERT INTO rule_criteria (rule_id, molecule_key, operator, value, label, sort_order)
           VALUES ($1, 'SIGNAL', 'equals', '"PHQ9_SI_POSITIVE"', 'PHQ-9 self-harm item positive', 1)`,
          [ruleId]);
        const bonusInsert = await client.query(
          `INSERT INTO bonus (bonus_code, bonus_description, start_date, end_date, is_active,
                              bonus_type, bonus_amount, rule_id, tenant_id,
                              apply_sunday, apply_monday, apply_tuesday, apply_wednesday,
                              apply_thursday, apply_friday, apply_saturday)
           VALUES ('PHQ9_SI_ALERT', 'PHQ-9 Self-Harm Item — Registry Alert', '2026-01-01', '2050-12-31',
                   true, 'fixed', 0, $1, $2, true, true, true, true, true, true, true)
           RETURNING bonus_id`, [ruleId, T]);
        await client.query(
          `INSERT INTO bonus_result (bonus_id, tenant_id, result_type, result_reference_id, result_description, sort_order)
           VALUES ($1, $2, 'external', $3, 'PHQ-9 item 9 positive — immediate clinical review', 0)`,
          [bonusInsert.rows[0].bonus_id, T, srRed.rows[0].action_id]);
        console.log(`  ✅ PHQ9_SI_ALERT bonus created (rule ${ruleId} → SR_RED, 24h SLA)`);
      } else {
        console.log('  ⏭️  PHQ9_SI_ALERT bonus already exists');
      }
    }
  }
,
  {
    version: 97,
    description: 'Per-participant instrument assignment (member_instrument) — Stage 2 part 2 plumbing',
    run: async (client) => {
      // Who takes which instrument, on what schedule. Mirrors the proven
      // member_compliance per-member pattern. Semantics (Session 131 design,
      // agreed with Bill):
      //   - A member with NO rows keeps today's behavior: expected to complete
      //     every active cadenced survey of the tenant (backward compatible —
      //     deploy day changes nothing for existing participants).
      //   - A member with ANY active rows is expected to complete EXACTLY the
      //     assigned instruments.
      //   - mode 'cadence': recurring; cadence_days NULL = use the survey's
      //     default cadence. mode 'one_time': screening-at-intake — due once
      //     from start_date, satisfied forever by a completion on/after it.
      // start_date is a Bill-epoch day; the default uses the platform SQL
      // helper so a plain INSERT gets "today" correctly.
      await client.query(`
        CREATE TABLE IF NOT EXISTS member_instrument (
          member_instrument_id SERIAL PRIMARY KEY,
          member_link CHAR(5) NOT NULL,
          survey_link SMALLINT NOT NULL REFERENCES survey(link),
          tenant_id SMALLINT NOT NULL,
          status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
          mode VARCHAR(10) NOT NULL DEFAULT 'cadence' CHECK (mode IN ('cadence', 'one_time')),
          cadence_days SMALLINT,
          start_date SMALLINT NOT NULL DEFAULT public.date_to_molecule_int(CURRENT_DATE),
          UNIQUE (member_link, survey_link)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_member_instrument_member ON member_instrument (member_link)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_member_instrument_tenant ON member_instrument (tenant_id)`);
      console.log('  ✅ member_instrument created (per-participant instrument assignment)');
    }
  },
  {
    version: 98,
    description: 'Declared accrual context keys (sysparm) — the composite closure check',
    run: async (client) => {
      // Session 132: the accrual endpoint now enforces the composite as a
      // CLOSED contract — any payload field that is not a composite molecule
      // is rejected instead of silently discarded. Some pipelines legitimately
      // send carry-only context that is consumed in flight (createRegistryItem
      // reads it) and never stored as a molecule. Those keys are DECLARED here
      // per tenant, not free-form. Adding a context key for a tenant is an
      // INSERT, never a code change.
      //
      // wi_php: the PPII composite-recalc accrual (custauth POST_ACCRUAL)
      // carries the dominant-driver analysis to the registry item.
      const TENANT = 5;
      const sp = await client.query(
        `INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
         VALUES ($1, 'accrual_context_keys', 'text',
                 'Payload keys allowed on POST /accruals beyond the composite: carry-only pipeline context, consumed in flight, never stored as molecules')
         ON CONFLICT (tenant_id, sysparm_key) DO NOTHING
         RETURNING sysparm_id`,
        [TENANT]
      );
      if (sp.rows.length) {
        const sysparmId = sp.rows[0].sysparm_id;
        const keys = ['DOMINANT_DRIVER', 'DOMINANT_SUBDOMAIN', 'PROTOCOL_CARD'];
        for (let i = 0; i < keys.length; i++) {
          await client.query(
            `INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
             VALUES ($1, 'context', $2, 'allowed', $3)`,
            [sysparmId, keys[i], i + 1]
          );
        }
        console.log(`  ✅ sysparm accrual_context_keys: ${keys.length} carry-only keys declared for wi_php`);
      } else {
        console.log('  ⏭️  sysparm accrual_context_keys already present — skipped');
      }
    }
  },
  {
    version: 99,
    description: 'WisconsinPATH Stage 3 — vetted evaluator directory: evaluator table + samples + EVALUATOR member molecule + M composite/template',
    async run(client) {
      const TENANT = 5;

      // Stage 3 of the WisconsinPATH plan (Erica's requirement): "Where an
      // independent diagnostic evaluation is indicated, the participant chooses
      // from a vetted list with costs disclosed up front." Her operational note:
      // no in-state Wisconsin evaluator currently exists, so the directory must
      // support out-of-state options — hence city/state on every entry.
      //
      // Shape mirrors licensing_board (v41), the proven pattern for a lookup
      // table behind an external-list member molecule. Costs are a disclosed
      // range in whole dollars (cost_low..cost_high) + a free-text note for
      // the messy parts ("travel not included").

      // ── 1. evaluator table ──
      await client.query(`
        CREATE TABLE IF NOT EXISTS evaluator (
          evaluator_id SERIAL PRIMARY KEY,
          tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          evaluator_code VARCHAR(20) NOT NULL,
          evaluator_name VARCHAR(100) NOT NULL,
          organization VARCHAR(100),
          credentials VARCHAR(100),
          evaluation_types VARCHAR(200),
          city VARCHAR(50),
          state CHAR(2),
          phone VARCHAR(25),
          email VARCHAR(100),
          website VARCHAR(200),
          cost_low INTEGER,
          cost_high INTEGER,
          cost_notes VARCHAR(200),
          is_active BOOLEAN NOT NULL DEFAULT true,
          UNIQUE(tenant_id, evaluator_code)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_evaluator_tenant ON evaluator(tenant_id)`);
      console.log('  ✅ evaluator table created');

      // ── 2. Seed sample entries (clearly labeled — Erica replaces these via
      //       the maintenance page; real vetted names + costs are her call).
      //       All out-of-state per the operational note. ──
      const samples = [
        { code: 'TCAG', name: 'SAMPLE — Twin Cities Assessment Group', org: 'Twin Cities Assessment Group',
          cred: 'PhD, LP', types: 'Comprehensive psychological + substance use evaluation',
          city: 'Minneapolis', state: 'MN', phone: '(555) 010-1001', email: 'referrals@example.org',
          web: 'https://example.org/tcag', lo: 3800, hi: 5200, note: 'Travel not included' },
        { code: 'RMPE', name: 'SAMPLE — Rocky Mountain Physician Evaluations', org: 'Rocky Mountain Physician Evaluations',
          cred: 'MD, ABPN', types: 'Fitness-for-duty + neuropsychological evaluation',
          city: 'Denver', state: 'CO', phone: '(555) 010-1002', email: 'intake@example.org',
          web: 'https://example.org/rmpe', lo: 5000, hi: 7500, note: 'Multi-day on-site evaluation' },
        { code: 'GLBH', name: 'SAMPLE — Great Lakes Behavioral Health Associates', org: 'Great Lakes Behavioral Health Associates',
          cred: 'PsyD', types: 'Substance use + return-to-work evaluation',
          city: 'Chicago', state: 'IL', phone: '(555) 010-1003', email: 'scheduling@example.org',
          web: 'https://example.org/glbh', lo: 3200, hi: 4800, note: null }
      ];
      for (const s of samples) {
        await client.query(`
          INSERT INTO evaluator (tenant_id, evaluator_code, evaluator_name, organization, credentials,
                                 evaluation_types, city, state, phone, email, website,
                                 cost_low, cost_high, cost_notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          ON CONFLICT (tenant_id, evaluator_code) DO NOTHING
        `, [TENANT, s.code, s.name, s.org, s.cred, s.types, s.city, s.state, s.phone, s.email, s.web, s.lo, s.hi, s.note]);
      }
      console.log(`  ✅ ${samples.length} sample evaluators seeded (labeled SAMPLE — replaced via the maintenance page)`);

      // ── 3. EVALUATOR member molecule (external_list → evaluator table).
      //       Mirrors LICENSING_BOARD (v41): storage_size 2, value_type 'key'
      //       (SERIAL id → offset encoding). Guarded insert — molecule_def has
      //       no unique constraint to ON CONFLICT on (v85 pattern). ──
      let mol = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'EVALUATOR'`,
        [TENANT]
      );
      if (!mol.rows.length) {
        await client.query(`
          INSERT INTO molecule_def (
            molecule_key, label, value_kind, scalar_type, tenant_id, context, attaches_to,
            storage_size, value_type, description, is_static, molecule_type
          ) VALUES (
            'EVALUATOR', 'Evaluator', 'external_list', NULL, $1, 'member', 'M',
            2, 'key',
            'Vetted evaluator the participant chose for an independent diagnostic evaluation (Stage 3)',
            false, 'D'
          )
        `, [TENANT]);
        mol = await client.query(
          `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'EVALUATOR'`,
          [TENANT]
        );
        console.log(`  ✅ EVALUATOR molecule_def created (molecule_id=${mol.rows[0].molecule_id})`);
      } else {
        console.log(`  ⏭️  EVALUATOR molecule_def already exists (molecule_id=${mol.rows[0].molecule_id})`);
      }
      const molId = mol.rows[0].molecule_id;

      // ── 4. molecule_value_lookup — MANDATORY for a member molecule (§5.2:
      //       without it the field silently stores as attaches_to='A' and every
      //       member read comes back empty). Mirrors LICENSING_BOARD's row. ──
      const lookExists = await client.query(
        `SELECT 1 FROM molecule_value_lookup WHERE molecule_id = $1`, [molId]
      );
      if (!lookExists.rows.length) {
        await client.query(`
          INSERT INTO molecule_value_lookup (
            molecule_id, table_name, id_column, code_column, label_column,
            maintenance_page, maintenance_description, is_tenant_specific,
            column_order, column_type, decimal_places, col_description,
            value_type, lookup_table_key, value_kind, scalar_type, context,
            storage_size, attaches_to
          ) VALUES (
            $1, 'evaluator', 'evaluator_id', 'evaluator_code', 'evaluator_name',
            'verticals/workforce_monitoring/admin_evaluators.html', 'Manage vetted evaluators', true,  -- lint-allow: evaluator admin lives in the vertical
            1, 'database_ref', 0, 'Evaluator',
            'key', 'evaluator', 'external_list', NULL, 'member',
            2, 'M'
          )
        `, [molId]);
        console.log('  ✅ EVALUATOR molecule_value_lookup row created (context=member, attaches_to=M)');
      } else {
        console.log('  ⏭️  EVALUATOR molecule_value_lookup row already exists');
      }

      // ── 5. Add to the tenant-5 member composite (M) so enroll/update
      //       validates it (v85 pattern). ──
      const comp = await client.query(
        `SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = 'M'`,
        [TENANT]
      );
      if (comp.rows.length) {
        const compositeLink = comp.rows[0].link;
        const detailExists = await client.query(
          `SELECT 1 FROM composite_detail WHERE p_link = $1 AND molecule_id = $2`,
          [compositeLink, molId]
        );
        if (!detailExists.rows.length) {
          const detailLink = await getNextLink(client, TENANT, 'composite_detail');
          await client.query(`
            INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, sort_order)
            VALUES ($1, $2, $3, false, false, 3)
          `, [detailLink, compositeLink, molId]);
          console.log(`  ✅ EVALUATOR added to tenant-5 M composite (detail link=${detailLink})`);
        } else {
          console.log('  ⏭️  EVALUATOR already in tenant-5 M composite');
        }
      } else {
        console.log('  ⚠️  tenant-5 M composite not found — skipping composite add (expected v79 to have created it)');
      }

      // ── 6. Add to the M input template so it shows/edits on the participant
      //       profile (v86 pattern; §5.5 — composite-only fields save but never
      //       display). row_number 30 places it after REFERRAL_SOURCE (20). ──
      const tpl = await client.query(
        `SELECT template_id FROM input_template WHERE tenant_id = $1 AND activity_type = 'M' AND is_active = true`,
        [TENANT]
      );
      if (tpl.rows.length) {
        const tplId = tpl.rows[0].template_id;
        const fieldExists = await client.query(
          `SELECT 1 FROM input_template_field WHERE template_id = $1 AND molecule_key = 'EVALUATOR'`,
          [tplId]
        );
        if (!fieldExists.rows.length) {
          await client.query(`
            INSERT INTO input_template_field
              (template_id, row_number, sort_order, molecule_key, display_label,
               start_position, display_width, enterable, is_required)
            VALUES ($1, 30, 1, 'EVALUATOR', 'Evaluator', 1, 50, 'Y', false)
          `, [tplId]);
          console.log(`  ✅ Added EVALUATOR field to wi_php M input template_id=${tplId}`);
        } else {
          console.log('  ⏭️  EVALUATOR already on the M input template');
        }
      } else {
        console.log('  ⚠️  wi_php M input template not found — skipping (expected v75 to have created it)');
      }
    }
  },
  {
    version: 100,
    description: 'Template molecule references carry a column number (default 1) — stamp display template lines + input_template_field.column_number',
    async run(client) {
      // The molecule contract platform-wide: a reference names a molecule and
      // optionally a column; no column means column 1. This migration makes
      // every EXISTING template reference explicit.
      //
      // Display templates store bracket strings — stamp [M,KEY,"..."] to
      // [M,KEY,1,"..."]. The renderer still treats a missing column as 1
      // (safety net), so a line this UPDATE misses renders exactly as before.
      // Idempotent: a stamped reference no longer matches the pattern.
      const res = await client.query(`
        UPDATE display_template_line
           SET template_string = regexp_replace(template_string, '\\[M,(\\w+),"', '[M,\\1,1,"', 'g')
         WHERE template_string ~ '\\[M,\\w+,"'
      `);
      console.log(`  ✅ display_template_line: ${res.rowCount} line(s) stamped to explicit column 1`);

      // Input templates store structured rows — the reference gains a real
      // column_number, DEFAULT 1, so every existing field means column 1
      // with no data rewrite at all.
      await client.query(`
        ALTER TABLE input_template_field
          ADD COLUMN IF NOT EXISTS column_number SMALLINT NOT NULL DEFAULT 1
      `);
      console.log('  ✅ input_template_field.column_number added (default 1)');
    }
  },
  {
    version: 101,
    description: 'Rule criteria carry a column number (default 1) — the molecule contract applied to the bonus/promotion rules engine',
    async run(client) {
      // Same contract as v100 gave the templates: a criterion references a
      // molecule and optionally a column; no column means column 1. DEFAULT 1
      // makes every existing criterion mean column 1 with no data rewrite —
      // bonus and promotion rules evaluate exactly as before.
      await client.query(`
        ALTER TABLE rule_criteria
          ADD COLUMN IF NOT EXISTS column_number SMALLINT NOT NULL DEFAULT 1
      `);
      console.log('  ✅ rule_criteria.column_number added (default 1)');
    }
  },
  {
    version: 102,
    description: 'Normalize FULL_PPSI_REQUESTED flag rows to the member side (attaches_to M)',
    async run(client) {
      // FULL_PPSI_REQUESTED is a MEMBER flag, but it has no molecule_value_lookup
      // row, so the old generic write path defaulted its stored rows to the
      // activity side (attaches_to 'A' — the MOLECULES.md §5.2 trap). Reads never
      // noticed because they didn't filter the side. Session 135's flag helpers
      // take the side from the definition ('M'), so any rows written the old way
      // must move to 'M' or they'd read as "not requested". Idempotent; zero rows
      // is a no-op (the local database had none — Heroku may).
      const mol = await client.query(`
        SELECT d.molecule_id FROM molecule_def d
        JOIN tenant t ON t.tenant_id = d.tenant_id AND t.tenant_key = 'wi_php'
        WHERE d.molecule_key = 'FULL_PPSI_REQUESTED'
      `);
      if (!mol.rows.length) {
        console.log('  ⏭️  FULL_PPSI_REQUESTED not defined — nothing to normalize');
        return;
      }
      const result = await client.query(
        `UPDATE "5_data_0" SET attaches_to = 'M' WHERE molecule_id = $1 AND attaches_to = 'A'`,
        [mol.rows[0].molecule_id]
      );
      console.log(`  ✅ FULL_PPSI_REQUESTED rows moved to the member side: ${result.rowCount}`);
    }
  },
  {
    version: 103,
    description: 'System-molecule true-up — the engine\'s system molecules get the SAME shape on every tenant (missing defs created, missing column metadata copied, system_required set)',
    async run(client) {
      // The platform has two molecule kinds in one table: tenant molecules
      // (real per-tenant differences) and SYSTEM molecules the engine itself
      // writes/reads, which must be identical everywhere. The copies drifted:
      // MEMBER_POINTS had column metadata on tenants 1+3 only; United/Ferrari
      // lacked the bonus-linkage defs entirely (a latent break the moment
      // their first bonus fires); tenant 3's MEMBER_POINTS wasn't flagged
      // system_required. Tenant 1 is the reference; everything resolves by
      // molecule_key (ids differ per environment). Idempotent throughout.
      const SYSTEM_KEYS = [
        'IS_DELETED', 'MEMBER_POINTS',
        'BONUS_RULE_ID', 'BONUS_ACTIVITY_LINK', 'BONUS_ACTIVITY_ID', 'BONUS_RESULT',
        'MEMBER_PROMOTION', 'PROMOTION'
      ];
      const tenants = await client.query(`SELECT tenant_id FROM tenant WHERE is_active = true ORDER BY tenant_id`);

      for (const key of SYSTEM_KEYS) {
        const ref = await client.query(
          `SELECT molecule_id FROM molecule_def WHERE tenant_id = 1 AND UPPER(molecule_key) = $1 AND is_active = true`,
          [key]);
        if (!ref.rows.length) {
          console.log(`  ⏭️  ${key}: no tenant-1 reference — skipped`);
          continue;
        }
        const refId = ref.rows[0].molecule_id;
        let created = 0, lookupsCopied = 0;

        for (const t of tenants.rows) {
          // 1. The definition — create it where missing (full copy of tenant 1's,
          //    including parent_bytes, which the older auto-provision copy missed).
          if (t.tenant_id !== 1) {
            const ins = await client.query(`
              INSERT INTO molecule_def (
                molecule_key, label, value_kind, scalar_type, lookup_table_key, tenant_id,
                context, is_static, is_permanent, is_required, is_active, foreign_schema,
                description, display_order, sample_code, sample_description, decimal_places,
                ref_table_name, ref_field_name, ref_function_name, parent_molecule_key,
                parent_fk_field, can_be_promotion_counter, display_width, list_context,
                system_required, input_type, molecule_type, value_structure, storage_size,
                value_type, attaches_to, param1_label, param2_label, param3_label, param4_label,
                parent_bytes
              )
              SELECT
                molecule_key, label, value_kind, scalar_type, lookup_table_key, $1,
                context, is_static, is_permanent, is_required, is_active, foreign_schema,
                description, display_order, sample_code, sample_description, decimal_places,
                ref_table_name, ref_field_name, ref_function_name, parent_molecule_key,
                parent_fk_field, can_be_promotion_counter, display_width, list_context,
                system_required, input_type, molecule_type, value_structure, storage_size,
                value_type, attaches_to, param1_label, param2_label, param3_label, param4_label,
                parent_bytes
              FROM molecule_def
              WHERE molecule_id = $2
                AND NOT EXISTS (
                  SELECT 1 FROM molecule_def
                  WHERE tenant_id = $1 AND UPPER(molecule_key) = $3 AND is_active = true
                )
            `, [t.tenant_id, refId, key]);
            created += ins.rowCount;
          }

          // 2. The column metadata — copy tenant 1's lookup rows to any copy
          //    that has none (the MOLECULES.md §5.2 metadata gap).
          const copy = await client.query(`
            INSERT INTO molecule_value_lookup (
              molecule_id, column_order, value_type, lookup_table_key, value_kind,
              scalar_type, context, storage_size, attaches_to, ref_table_name,
              ref_field_name, ref_function_name, table_name, id_column, code_column,
              label_column, maintenance_page, maintenance_description,
              is_tenant_specific, decimal_places, col_description
            )
            SELECT
              d.molecule_id, l.column_order, l.value_type, l.lookup_table_key, l.value_kind,
              l.scalar_type, l.context, l.storage_size, l.attaches_to, l.ref_table_name,
              l.ref_field_name, l.ref_function_name, l.table_name, l.id_column, l.code_column,
              l.label_column, l.maintenance_page, l.maintenance_description,
              l.is_tenant_specific, l.decimal_places, l.col_description
            FROM molecule_value_lookup l
            JOIN molecule_def d
              ON d.tenant_id = $1 AND UPPER(d.molecule_key) = $2 AND d.is_active = true
            WHERE l.molecule_id = $3
              AND NOT EXISTS (
                SELECT 1 FROM molecule_value_lookup x WHERE x.molecule_id = d.molecule_id
              )
          `, [t.tenant_id, key, refId]);
          lookupsCopied += copy.rowCount;
        }

        // 3. Every copy is flagged system_required so the boot layer (auto-
        //    provision + the deepened shape check) owns these keys from now on.
        await client.query(
          `UPDATE molecule_def SET system_required = true WHERE UPPER(molecule_key) = $1 AND is_active = true AND system_required = false`,
          [key]);

        console.log(`  ✅ ${key}: defs created ${created}, column-metadata rows copied ${lookupsCopied}, system_required set everywhere`);
      }
    }
  },
  {
    version: 104,
    description: 'Drop redundant molecule-storage indexes — the standalone (p_link) indexes duplicated by the (p_link, molecule_id) composites, and idx_activity_link duplicated by the activity primary key',
    async run(client) {
      // Two provable redundancies, no query-plan loss (verified on the 17 GB
      // loyaltybig: indexes are ~57% of an activity's on-disk footprint):
      //  1. idx_activity_link is btree(link) — an exact duplicate of the
      //     activity primary key, also btree(link).
      //  2. On the original base storage tables (5_data_1/2/3/4/5/54) a
      //     standalone btree(p_link) index sits alongside btree(p_link,
      //     molecule_id). The composite serves every p_link-only lookup by the
      //     leading-column rule, so the standalone one is dead weight. Newer
      //     tables (4_data_*, 5_data_22/222/…) name their COMPOSITE "..._plink"
      //     and have no standalone p_link index — the shape test below (single
      //     key column == p_link, AND a separate p_link+molecule_id composite
      //     exists) skips them. Detected by shape, not name, so it's correct in
      //     every environment regardless of which storage tables exist.
      // Idempotent: DROP IF EXISTS + a shape query that only finds live ones.
      // We deliberately KEEP the (attaches_to, p_link) indexes pending real
      // query-traffic stats on the live DB.

      await client.query('DROP INDEX IF EXISTS idx_activity_link');

      const redundant = await client.query(`
        SELECT i.relname AS idxname, t.relname AS tbl
        FROM pg_class t
        JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
        JOIN pg_index ix ON ix.indrelid = t.oid
        JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE t.relname ~ '^[0-9]+_data_[0-9]+$'
          AND NOT ix.indisprimary AND NOT ix.indisunique
          AND ix.indnatts = 1
          AND (SELECT a.attname FROM pg_attribute a
               WHERE a.attrelid = t.oid AND a.attnum = ix.indkey[0]) = 'p_link'
          AND EXISTS (
            SELECT 1 FROM pg_index c
            WHERE c.indrelid = t.oid AND c.indnatts >= 2
              AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = c.indkey[0]) = 'p_link'
              AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = c.indkey[1]) = 'molecule_id'
          )
        ORDER BY t.relname
      `);
      for (const r of redundant.rows) {
        await client.query(`DROP INDEX IF EXISTS "${r.idxname}"`);
        console.log(`  ✅ dropped redundant p_link index ${r.idxname} on ${r.tbl}`);
      }
      console.log(`  Dropped idx_activity_link + ${redundant.rows.length} redundant storage index(es)`);
    }
  },
  {
    version: 105,
    description: 'ML_RISK_SCORE side normalization — add its missing molecule_value_lookup rows (the §5.2 trap) and restamp member-link rows from A to M, so the Session-137 side-filtered reads see one coherent history',
    async run(client) {
      // ML_RISK_SCORE is a MEMBER molecule (def attaches_to 'M') that was
      // created without molecule_value_lookup rows — the §5.2 trap. The live
      // scoring path therefore stamped new rows with the storage-info default
      // 'A' even though they sit on member links, while the seeded rows carry
      // the correct 'M'. Unfiltered reads mixed both piles; the Session-137
      // side-filtered reads (resolveRowSide: definition side when the lookup
      // row is missing) resolve 'M' — so the 'A'-stamped rows must join the
      // 'M' pile or the score history loses them.
      //
      // Resolved by molecule_key per tenant (never molecule_id — sequences
      // diverge across environments). Idempotent: lookup rows insert only
      // when absent; the restamp only touches 'A' rows on member links.
      const defs = await client.query(
        `SELECT molecule_id, tenant_id, value_type FROM molecule_def WHERE UPPER(molecule_key) = 'ML_RISK_SCORE'`
      );
      for (const def of defs.rows) {
        const cols = [
          { order: 1, description: 'Risk score' },
          { order: 2, description: 'Score date' }
        ];
        for (const col of cols) {
          const exists = await client.query(
            `SELECT 1 FROM molecule_value_lookup WHERE molecule_id = $1 AND column_order = $2`,
            [def.molecule_id, col.order]
          );
          if (exists.rows.length === 0) {
            // value_type copies the definition's ('numeric') so encoding is
            // byte-identical to the pre-lookup fallback path.
            await client.query(
              `INSERT INTO molecule_value_lookup
                 (molecule_id, column_order, col_description, value_type, value_kind, scalar_type, context, attaches_to, storage_size)
               VALUES ($1, $2, $3, $4, 'value', 'numeric', 'member', 'M', 2)`,
              [def.molecule_id, col.order, col.description, def.value_type]
            );
            console.log(`  ✅ tenant ${def.tenant_id}: added ML_RISK_SCORE lookup row for column ${col.order}`);
          }
        }
        const restamped = await client.query(
          `UPDATE "5_data_22" SET attaches_to = 'M'
           WHERE molecule_id = $1 AND attaches_to = 'A'
             AND p_link IN (SELECT link FROM member WHERE tenant_id = $2)`,
          [def.molecule_id, def.tenant_id]
        );
        console.log(`  ✅ tenant ${def.tenant_id}: restamped ${restamped.rowCount} ML_RISK_SCORE row(s) from 'A' to 'M'`);
      }
      if (defs.rows.length === 0) {
        console.log('  (no ML_RISK_SCORE definition on this database — nothing to do)');
      }
    }
  },
  {
    version: 106,
    description: 'Entity-type registry — link_tank becomes the keeper of the 1-byte "who do I belong to" codes (activity 64, alias 75, member 76 — the numbers the stored letters already encode); molecule defs name their parent table; the 4_data placeholder byte becomes the login table\'s true code',
    async run(client) {
      // The registry (Session 136 design, Session 137 build): every table a
      // molecule can attach to gets a 1-byte entity code, kept on its
      // link_tank row — link tank is used here purely as the existing
      // directory of table names; NOTHING about link allocation changes.
      //
      // The three legacy codes are chosen so the letters already stored in
      // every molecule row ARE those codes in the platform's 1-byte encoding
      // (squish: chr(code % 127 + 1)): 'A' = 64, 'L' = 75, 'M' = 76. Zero
      // storage rows rewritten for the legacy world.
      //
      // Code rules: 1-127, unique, never null on a registered row; 31 is
      // banned outright (it encodes as the blank character); new codes mint
      // above the highest assigned, so they land at 77+ (all printable).

      await client.query(`ALTER TABLE link_tank ADD COLUMN IF NOT EXISTS entity_id SMALLINT`);
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE link_tank ADD CONSTRAINT link_tank_entity_id_valid
            CHECK (entity_id IS NULL OR (entity_id BETWEEN 1 AND 127 AND entity_id <> 31));
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
      `);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_link_tank_entity_id
                          ON link_tank (entity_id) WHERE entity_id IS NOT NULL`);

      // Seed the three legacy parents on their existing rows (matched by
      // table name only — the registry never looks at tenant).
      const seeds = [['activity', 64], ['member_alias', 75], ['member', 76]];
      for (const [tableKey, code] of seeds) {
        await client.query(
          `UPDATE link_tank SET entity_id = $2 WHERE table_key = $1 AND entity_id IS DISTINCT FROM $2`,
          [tableKey, code]
        );
        console.log(`  ✅ ${tableKey} = entity code ${code}`);
      }

      // Staff logins get the first minted code: next free above the highest
      // assigned, skipping the reserved set {31, 64, 75, 76}. (77 today.)
      const existing = await client.query(
        `SELECT entity_id FROM link_tank WHERE table_key = 'platform_user' AND entity_id IS NOT NULL`);
      let puCode;
      if (existing.rows.length) {
        puCode = existing.rows[0].entity_id; // already registered (rerun)
      } else {
        const mx = await client.query(`SELECT COALESCE(MAX(entity_id), 0) AS mx FROM link_tank`);
        puCode = Number(mx.rows[0].mx) + 1;
        while ([31, 64, 75, 76].includes(puCode)) puCode++;
        await client.query(
          `UPDATE link_tank SET entity_id = $1 WHERE table_key = 'platform_user'`, [puCode]);
      }
      console.log(`  ✅ platform_user = entity code ${puCode}`);

      // Molecule definitions name their parent table's entity code. NULL for
      // the 5-byte member/activity/alias world (side resolved per row);
      // REQUIRED for own-table parents — every existing non-5-byte molecule
      // is a user molecule (POSITION / POSITIONCLINIC).
      await client.query(`ALTER TABLE molecule_def ADD COLUMN IF NOT EXISTS parent_entity_id SMALLINT`);
      const defsSet = await client.query(
        `UPDATE molecule_def SET parent_entity_id = $1
         WHERE COALESCE(parent_bytes, 5) <> 5 AND parent_entity_id IS NULL`, [puCode]);
      console.log(`  ✅ ${defsSet.rowCount} non-5-byte molecule def(s) now name platform_user as parent`);

      // Retire the placeholder: the 4_data rows' 'A' never meant "activity" —
      // it meant "the column doesn't matter here". Now every row's byte tells
      // the truth. (4_data_12 has one row today; 4_data_1 is empty; both
      // statements are idempotent and safe if the tables are absent.)
      for (const tbl of ['4_data_1', '4_data_12']) {
        const exists = await client.query(`SELECT to_regclass($1) AS t`, [`"${tbl}"`]);
        if (!exists.rows[0].t) continue;
        const restamped = await client.query(
          `UPDATE "${tbl}" SET attaches_to = CHR($1 % 127 + 1) WHERE attaches_to = 'A'`, [puCode]);
        if (restamped.rowCount > 0) {
          console.log(`  ✅ ${tbl}: restamped ${restamped.rowCount} row(s) from the 'A' placeholder to the login table's code`);
        }
      }
    }
  },
  {
    version: 107,
    description: 'Three uniqueness guards the code already assumes (2026-07 platform audit Tier 1): one point bucket per member+rule, one OPEN promotion enrollment per member+promotion, one membership number per tenant',
    async run(client) {
      // Audit findings 1.1 (related hardening) + 1.3: the code trusts these
      // three invariants everywhere but nothing in the database enforced
      // them. Zero violations exist today (verified before writing this) —
      // the guards make the trust true forever. If any duplicate has crept
      // in on this database, fail LOUDLY with the offenders named, so the
      // fix is a deliberate cleanup, never a silent skip.

      // 1) member_point_bucket — findOrCreatePointBucket finds by
      //    (p_link, rule_id); expire_date is derived from the rule. Two
      //    concurrent accruals could both miss the find and double-insert.
      const bucketDups = await client.query(`
        SELECT encode(p_link::bytea, 'hex') AS member_hex, rule_id, COUNT(*) AS n
        FROM member_point_bucket GROUP BY p_link, rule_id HAVING COUNT(*) > 1`);
      if (bucketDups.rows.length > 0) {
        throw new Error(
          `member_point_bucket has ${bucketDups.rows.length} member+rule pair(s) with more than one bucket ` +
          `(first: member ${bucketDups.rows[0].member_hex}, rule ${bucketDups.rows[0].rule_id}, ${bucketDups.rows[0].n} buckets). ` +
          `These must be merged (sum accrued/redeemed into one bucket, repoint MEMBER_POINTS molecules) before this guard can be applied.`);
      }
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_member_point_bucket_member_rule
                          ON member_point_bucket (p_link, rule_id)`);
      // The old non-unique index on the same two columns is now fully
      // shadowed by the unique one — same lookups, one fewer index.
      await client.query(`DROP INDEX IF EXISTS idx_member_point_bucket_rule`);
      console.log('  ✅ member_point_bucket: one bucket per member+rule (unique index; shadowed non-unique dropped)');

      // 2) member_promotion — repeatable promotions legitimately create a
      //    row per completion, so the guard is PARTIAL: at most one OPEN
      //    (not-yet-qualified) enrollment per member+promotion. This is the
      //    invariant the enrollment check-then-act code assumes.
      const openDups = await client.query(`
        SELECT encode(p_link::bytea, 'hex') AS member_hex, promotion_id, COUNT(*) AS n
        FROM member_promotion WHERE qualify_date IS NULL
        GROUP BY p_link, promotion_id HAVING COUNT(*) > 1`);
      if (openDups.rows.length > 0) {
        throw new Error(
          `member_promotion has ${openDups.rows.length} member+promotion pair(s) with more than one OPEN enrollment ` +
          `(first: member ${openDups.rows[0].member_hex}, promotion ${openDups.rows[0].promotion_id}, ${openDups.rows[0].n} open rows). ` +
          `Resolve the duplicate enrollments before this guard can be applied.`);
      }
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_member_promotion_open
                          ON member_promotion (p_link, promotion_id) WHERE qualify_date IS NULL`);
      console.log('  ✅ member_promotion: one OPEN enrollment per member+promotion (partial unique index)');

      // 3) member — resolveMember and 67 call sites take rows[0] on trust;
      //    membership numbers must actually be unique within a tenant.
      //
      // Known live duplicate, repaired before the guard (found by the
      // Session 140 dress rehearsal against the Heroku copy): Erica's
      // July-6 walkthrough double-submitted the "Joy Sunshine" test
      // registration on tenant 5 — two member rows created 30µs apart,
      // BOTH numbered 90, each carrying real review-queue history (one
      // dispositioned ADVANCED, one RESOURCES). Neither row is deleted;
      // the RESOURCES copy takes the tenant's next free number, the
      // ADVANCED copy keeps 90 (Bill's call, 2026-07-11). Resolved by
      // name + registry disposition, never by link or id (those diverge
      // across environments); a database without the twins (local, CI
      // from-scratch) falls straight through. If the twins exist but the
      // disposition can't pick exactly one row, we do NOT guess — the
      // loud failure below names the offenders instead.
      const joyTwins = await client.query(`
        SELECT link FROM member
        WHERE tenant_id = 5 AND fname = 'Joy' AND lname = 'Sunshine'
          AND membership_number IN (
            SELECT membership_number FROM member
            WHERE tenant_id = 5 AND fname = 'Joy' AND lname = 'Sunshine'
            GROUP BY membership_number HAVING COUNT(*) > 1)`);
      if (joyTwins.rows.length === 2) {
        const resourcesCopy = await client.query(`
          SELECT m.link FROM member m
          JOIN stability_registry sr ON sr.member_link = m.link
          WHERE m.tenant_id = 5 AND m.fname = 'Joy' AND m.lname = 'Sunshine'
            AND sr.reason_code = 'REG_REVIEW' AND sr.resolution_code = 'RESOURCES'`);
        if (resourcesCopy.rows.length === 1) {
          const next = await client.query(`
            SELECT (MAX(membership_number::bigint) + 1)::text AS n
            FROM member WHERE tenant_id = 5 AND membership_number ~ '^[0-9]+$'`);
          await client.query(
            `UPDATE member SET membership_number = $1 WHERE link = $2`,
            [next.rows[0].n, resourcesCopy.rows[0].link]);
          console.log(`  ✅ Joy Sunshine double-registration repaired: RESOURCES copy renumbered to ${next.rows[0].n}, ADVANCED copy keeps its number`);
        }
      }
      const memberDups = await client.query(`
        SELECT tenant_id, membership_number, COUNT(*) AS n
        FROM member GROUP BY tenant_id, membership_number HAVING COUNT(*) > 1`);
      if (memberDups.rows.length > 0) {
        throw new Error(
          `member has ${memberDups.rows.length} duplicated membership number(s) ` +
          `(first: tenant ${memberDups.rows[0].tenant_id}, number ${memberDups.rows[0].membership_number}, ${memberDups.rows[0].n} rows). ` +
          `Renumber the duplicates before this guard can be applied.`);
      }
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_member_tenant_membership_number
                          ON member (tenant_id, membership_number)`);
      await client.query(`DROP INDEX IF EXISTS idx_member_tenant_membership_number`);
      console.log('  ✅ member: one membership number per tenant (unique index; shadowed non-unique dropped)');
    }
  },
  {
    version: 108,
    description: 'Delete the half-built BT test molecule on Delta (label "bills test" — definition saved pre-hardening without its storage table; Bill\'s call, Session 138)',
    async run(client) {
      // BT (tenant 1) was created through the old admin flow before
      // createMoleculeComplete existed: the definition and its three column
      // rows were saved, but the 5_data_345 storage table never was. It has
      // zero stored values, sits in no composite, and no rule references it.
      // Resolved by molecule_key + tenant, NEVER by molecule_id (sequences
      // diverge across environments); a database without it skips cleanly.
      const def = await client.query(
        `SELECT molecule_id, storage_size, COALESCE(parent_bytes, 5) AS parent_bytes
         FROM molecule_def WHERE tenant_id = 1 AND UPPER(molecule_key) = 'BT'`);
      if (def.rows.length === 0) {
        console.log('  (no BT molecule on this database — nothing to do)');
        return;
      }
      const { molecule_id, storage_size, parent_bytes } = def.rows[0];

      // Storage rows first — only if the table actually exists (locally it
      // never did; another environment might differ).
      const tbl = `"${parent_bytes}_data_${storage_size}"`;
      const reg = await client.query(`SELECT to_regclass($1) AS t`, [tbl]);
      if (reg.rows[0].t) {
        const wiped = await client.query(`DELETE FROM ${tbl} WHERE molecule_id = $1`, [molecule_id]);
        console.log(`  ✅ ${tbl}: ${wiped.rowCount} stored row(s) removed`);
      }

      // Child rows, then the definition.
      const lk = await client.query(`DELETE FROM molecule_value_lookup WHERE molecule_id = $1`, [molecule_id]);
      const tx = await client.query(`DELETE FROM molecule_value_text WHERE molecule_id = $1`, [molecule_id]);
      const cd = await client.query(`DELETE FROM composite_detail WHERE molecule_id = $1`, [molecule_id]);
      await client.query(`DELETE FROM molecule_def WHERE molecule_id = $1`, [molecule_id]);
      console.log(`  ✅ BT deleted (lookup rows: ${lk.rowCount}, values: ${tx.rowCount}, composite rows: ${cd.rowCount})`);
    }
  },
  {
    version: 109,
    description: 'True up the platform_user link counter — a past deploy inserted the Claude system login directly (MAX(link)+1, bypassing the link tank), leaving the tank pointing at an already-used link; the next real staff-login creation 500s once on the collision (found by the Session 140 dress rehearsal against the Heroku copy)',
    async run(client) {
      // The tank is the only allocator the code uses (getNextLink), so the
      // repair is one-directional: the counter may only move FORWARD to
      // MAX(link)+1. GREATEST keeps a healthy tank untouched, so this is
      // idempotent and a no-op on any database whose counter is already
      // ahead (local, CI from-scratch). The harness backdoor that caused
      // this now advances the tank itself (tests/run.cjs, same session).
      const before = await client.query(
        `SELECT next_link FROM link_tank WHERE table_key = 'platform_user'`);
      const res = await client.query(`
        UPDATE link_tank
        SET next_link = GREATEST(next_link, (SELECT COALESCE(MAX(link)::bigint, next_link - 1) + 1 FROM platform_user))
        WHERE table_key = 'platform_user'
        RETURNING next_link`);
      if (res.rows.length === 0) {
        throw new Error(`link_tank has no platform_user row — cannot true up the login link counter`);
      }
      const was = before.rows[0]?.next_link, now = res.rows[0].next_link;
      console.log(String(was) === String(now)
        ? `  ✅ platform_user link counter already healthy (next ${now})`
        : `  ✅ platform_user link counter advanced ${was} → ${now} (was pointing at an existing login's link)`);
    }
  },
  {
    version: 110,
    description: "Deactivate Delta's 17 junk test promotions (Session 139 discovery, Bill approved the exact-code list Session 140) — test-generator residue leaked April–June 2026; every accrual paid to evaluate all of them (~2/3 of Delta's per-accrual promotion work)",
    async run(client) {
      // DEACTIVATE, never delete — enrollment history references these
      // promotions. Exact-code list (shown to and approved by Bill), never a
      // pattern match at run time: a pattern could catch a future legitimate
      // code; this list can only ever touch these 17. A database without
      // some of them (fresh CI build; Heroku's residue history differs)
      // skips those cleanly and says what it found.
      const JUNK_CODES = [
        'DOW-241440', 'DOW-244470', 'DOW-40642',
        'MC-AND-1777239102838', 'MC-AND-1779942274495',
        'MC-AND-1780021261991', 'MC-AND-1783008061390',
        'MC-D-1777239119927', 'MC-D-1779942292638',
        'MC-M-1777239120107', 'MC-M-1779942292706',
        'MC-OR-1777239102804', 'MC-OR-1779942274383',
        'MC-OR-1780021261949', 'MC-OR-1783008061357',
        'UI-1777239124039', 'UI-1779942296640'
      ];
      const res = await client.query(
        `UPDATE promotion SET is_active = false
         WHERE tenant_id = 1 AND is_active = true AND promotion_code = ANY($1)
         RETURNING promotion_code`,
        [JUNK_CODES]);
      console.log(`  ✅ ${res.rowCount} of ${JUNK_CODES.length} junk test promotion(s) deactivated on Delta` +
        (res.rowCount < JUNK_CODES.length ? ' (the rest not present or already inactive on this database)' : ''));
      const remaining = await client.query(
        `SELECT COUNT(*)::int AS n FROM promotion WHERE tenant_id = 1 AND is_active = true`);
      console.log(`  ✅ Delta now has ${remaining.rows[0].n} active promotion(s)`);
    }
  },
  {
    version: 111,
    description: "Intake Rebuild Phase 1 (Erica's intake spec, Session 142) — INTAKE_STATUS member molecule (11 values, backfilled to Participant), intake_item/intake_note tables, open REG_REVIEW conversion out of the Stability Registry, REG_REVIEW dispatch → createIntakeItem, intake notification rules + SLA job, intake_sla config",
    async run(client) {
      const TENANT = 5;

      // Erica's intake spec (PI2_Intake_Workflow_Build_Specification.docx,
      // adopted whole — the design contract locked Session 141): intake is
      // ADMINISTRATIVE work on registrants and does not belong on the
      // Stability Registry (a clinical surface). One population, one truth:
      // every person carries exactly one INTAKE_STATUS; 'Participant' is the
      // eleventh value (a separate flag was weighed and REJECTED — two facts
      // that can drift). Intake work items get their OWN table so they can
      // never pollute clinical tier counts.

      // ── 1. INTAKE_STATUS molecule_def (internal_list, member, 1 byte) ──
      // Guarded insert — molecule_def has no unique constraint to ON CONFLICT
      // on (v85 pattern). Resolved by molecule_key, never by id.
      let mol = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'INTAKE_STATUS'`,
        [TENANT]
      );
      if (!mol.rows.length) {
        await client.query(`
          INSERT INTO molecule_def (
            molecule_key, label, value_kind, tenant_id, context, attaches_to,
            storage_size, value_type, description
          ) VALUES (
            'INTAKE_STATUS', 'Intake Status', 'internal_list', $1, 'member', 'M',
            1, 'code',
            'Where this person stands in the intake lifecycle (Erica''s ten stages + Participant). The roster is status=Participant; the Intake Queue is the open registrant statuses. Changed ONLY by intake actions and (later) participant activation — never a free-form profile field.'
          )
        `, [TENANT]);
        mol = await client.query(
          `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'INTAKE_STATUS'`,
          [TENANT]
        );
        console.log(`  ✅ INTAKE_STATUS molecule_def created (molecule_id=${mol.rows[0].molecule_id})`);
      } else {
        console.log(`  ⏭️  INTAKE_STATUS molecule_def already exists (molecule_id=${mol.rows[0].molecule_id})`);
      }
      const molId = mol.rows[0].molecule_id;

      // ── 2. molecule_value_lookup — MANDATORY for a member molecule (§5.2:
      //      without it the field silently stores as attaches_to='A' and every
      //      member read comes back empty). Mirrors REFERRAL_SOURCE (v85). ──
      const lookExists = await client.query(
        `SELECT 1 FROM molecule_value_lookup WHERE molecule_id = $1`, [molId]
      );
      if (!lookExists.rows.length) {
        await client.query(`
          INSERT INTO molecule_value_lookup (
            molecule_id, is_tenant_specific, column_order, decimal_places, col_description,
            value_type, value_kind, scalar_type, context, storage_size, attaches_to
          ) VALUES (
            $1, true, 1, 0, 'Intake lifecycle status',
            'code', 'internal_list', NULL, 'member', 1, 'M'
          )
        `, [molId]);
        console.log('  ✅ INTAKE_STATUS molecule_value_lookup row created (context=member, attaches_to=M)');
      } else {
        console.log('  ⏭️  INTAKE_STATUS molecule_value_lookup row already exists');
      }

      // ── 3. The eleven values — EXPLICIT per-molecule value_id 1..11 (§5.3:
      //      the default is a global sequence past 127; letting it assign
      //      silently overflows the one-byte cell). Codes are stable; labels
      //      are Erica's stage names verbatim (spec §5) + Participant. ──
      const STATUSES = [
        { id: 1,  code: 'REGISTERED',  label: 'Registered' },
        { id: 2,  code: 'CM_REVIEW',   label: 'Case manager review' },
        { id: 3,  code: 'MD_REVIEW',   label: 'Medical director review' },
        { id: 4,  code: 'RESOURCES',   label: 'Routed to resources' },
        { id: 5,  code: 'SCREENING',   label: 'In screening' },
        { id: 6,  code: 'EVALUATION',  label: 'In evaluation' },
        { id: 7,  code: 'TREATMENT',   label: 'In treatment' },
        { id: 8,  code: 'REACTIVATION', label: 'Pending reactivation' },
        { id: 9,  code: 'DECLINED',    label: 'Declined' },
        { id: 10, code: 'CLOSED',      label: 'Closed' },
        { id: 11, code: 'PARTICIPANT', label: 'Participant' }
      ];
      for (const s of STATUSES) {
        await client.query(`
          INSERT INTO molecule_value_text (molecule_id, value_id, text_value, display_label, sort_order, is_active)
          VALUES ($1, $2, $3, $4, $2, true)
          ON CONFLICT (molecule_id, value_id) DO NOTHING
        `, [molId, s.id, s.code, s.label]);
      }
      console.log(`  ✅ ${STATUSES.length} INTAKE_STATUS values seeded (explicit value_id 1..11)`);

      // ── 4. M composite ONLY — deliberately NOT the input template. The
      //      composite authorizes the field (server writes validate); leaving
      //      it OFF the profile form means nobody can hand-edit a lifecycle
      //      status — it moves only through intake actions (§5.5 in reverse,
      //      on purpose). ──
      const comp = await client.query(
        `SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = 'M'`,
        [TENANT]
      );
      if (comp.rows.length) {
        const compositeLink = comp.rows[0].link;
        const detailExists = await client.query(
          `SELECT 1 FROM composite_detail WHERE p_link = $1 AND molecule_id = $2`,
          [compositeLink, molId]
        );
        if (!detailExists.rows.length) {
          const detailLink = await getNextLink(client, TENANT, 'composite_detail');
          await client.query(`
            INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, sort_order)
            VALUES ($1, $2, $3, false, false, 9)
          `, [detailLink, compositeLink, molId]);
          console.log(`  ✅ INTAKE_STATUS added to tenant-5 M composite (detail link=${detailLink})`);
        } else {
          console.log('  ⏭️  INTAKE_STATUS already in tenant-5 M composite');
        }
      } else {
        console.log('  ⚠️  tenant-5 M composite not found — skipping composite add');
      }

      // ── 5. Backfill: every existing wi_php member is a Participant on day
      //      one (the locked contract — Erica's live participants unchanged).
      //      Raw storage INSERT is migration-only territory (v102/v105
      //      precedent); the stored byte for an internal-list value is the
      //      value_id squished: chr(value_id + 1) → PARTICIPANT (11) = chr(12).
      //      Round-trip verified by tests/insight/test_intake_rebuild.cjs. ──
      const backfill = await client.query(`
        INSERT INTO "5_data_1" (p_link, attaches_to, molecule_id, c1)
        SELECT m.link, 'M', $1, chr(12)
        FROM member m
        WHERE m.tenant_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM "5_data_1" d
            WHERE d.p_link = m.link AND d.molecule_id = $1 AND d.attaches_to = 'M'
          )
      `, [molId, TENANT]);
      console.log(`  ✅ ${backfill.rowCount} member(s) backfilled to INTAKE_STATUS = Participant`);

      // ── 6. The intake work-item table — its OWN table, never
      //      stability_registry (separation by construction). Fields per the
      //      spec §8/A.4: review type, named owner, sent-by (the MD return
      //      path needs it), the SLA clock from registration, outreach,
      //      status/resolution. Stage and referral source are NOT duplicated
      //      here — they live on the member (INTAKE_STATUS / REFERRAL_SOURCE
      //      molecules); the queue joins them (one truth, no drift).
      //      Links mint via getNextLink('intake_item') — link_tank
      //      auto-registers the table on first allocation (v84 pattern). ──
      await client.query(`
        CREATE TABLE IF NOT EXISTS intake_item (
          link INTEGER PRIMARY KEY,
          member_link CHAR(5) NOT NULL REFERENCES member(link),
          tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
          review_type VARCHAR(2) NOT NULL DEFAULT 'CM' CHECK (review_type IN ('CM','MD')),
          assigned_to INTEGER REFERENCES platform_user(user_id),
          assigned_ts TIMESTAMP,
          sent_by INTEGER REFERENCES platform_user(user_id),
          sent_ts TIMESTAMP,
          registered_ts TIMESTAMP NOT NULL DEFAULT NOW(),
          created_date SMALLINT NOT NULL,
          sla_deadline TIMESTAMP,
          outreach_ts TIMESTAMP,
          outreach_by INTEGER REFERENCES platform_user(user_id),
          overdue_notified_ts TIMESTAMP,
          status CHAR(1) NOT NULL DEFAULT 'O',
          resolution_code VARCHAR(20),
          resolution_notes TEXT,
          resolved_ts TIMESTAMP,
          resolved_by INTEGER REFERENCES platform_user(user_id)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_tenant_open ON intake_item (tenant_id, status) WHERE status <> 'R'`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_member ON intake_item (member_link)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_sla ON intake_item (sla_deadline) WHERE status <> 'R'`);
      console.log('  ✅ intake_item table created');

      // Triage notes: attributed and dated (spec A.4) — a list, not one text
      // blob. They surface on the item, the registrant chart, and the audit.
      await client.query(`
        CREATE TABLE IF NOT EXISTS intake_note (
          note_id SERIAL PRIMARY KEY,
          intake_link INTEGER NOT NULL REFERENCES intake_item(link) ON DELETE CASCADE,
          tenant_id SMALLINT NOT NULL,
          author_user_id INTEGER REFERENCES platform_user(user_id),
          note_ts TIMESTAMP NOT NULL DEFAULT NOW(),
          note_text TEXT NOT NULL
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_note_item ON intake_note (intake_link)`);
      console.log('  ✅ intake_note table created');

      // ── 7. Convert existing OPEN registration reviews out of the registry.
      //      status 'A' + an assignee means the old Escalate already sent it
      //      to the Medical Director → review_type MD; plain open → CM.
      //      The original registry rows are resolved (TO_INTAKE), never
      //      deleted — audit history intact, invisible to tier counts. ──
      const openReviews = await client.query(`
        SELECT link, member_link, tenant_id, status, assigned_to, assigned_ts,
               sla_deadline, created_date, created_ts
        FROM stability_registry
        WHERE reason_code = 'REG_REVIEW' AND status <> 'R'
        ORDER BY created_ts
      `);
      for (const r of openReviews.rows) {
        const newLink = await getNextLink(client, r.tenant_id, 'intake_item');
        const toMD = r.status === 'A' && r.assigned_to != null;
        await client.query(`
          INSERT INTO intake_item (link, member_link, tenant_id, review_type,
            assigned_to, assigned_ts, sent_ts, registered_ts, created_date, sla_deadline)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [newLink, r.member_link, r.tenant_id, toMD ? 'MD' : 'CM',
            r.assigned_to, r.assigned_ts, toMD ? r.assigned_ts : null,
            r.created_ts, r.created_date, r.sla_deadline]);
        await client.query(`
          UPDATE stability_registry
          SET status = 'R', resolution_code = 'TO_INTAKE', resolved_ts = NOW(),
              resolution_notes = 'Converted to intake item ' || $2 || ' (v111 intake rebuild)'
          WHERE link = $1
        `, [r.link, String(newLink)]);
      }
      console.log(`  ✅ ${openReviews.rows.length} open registration review(s) converted to intake items`);

      // ── 8. New registrations now create INTAKE items, not registry items:
      //      repoint the REG_REVIEW external action at the intake handler
      //      (registered by verticals/workforce_monitoring/server/intake.js). ──
      const repoint = await client.query(`
        UPDATE external_result_action SET function_name = 'createIntakeItem'
        WHERE action_code = 'REG_REVIEW' AND function_name = 'createRegistryItem'
      `);
      console.log(`  ✅ REG_REVIEW external action repointed to createIntakeItem (${repoint.rowCount} row)`);

      // ── 9. Notification rules follow the rebuild. The two v95 rules are
      //      renamed to intake events (recipients unchanged: new items →
      //      Case Managers; MD referrals → Medical Directors), and two new
      //      rules cover the return path and the overdue flag. ──
      await client.query(`
        UPDATE notification_rule
        SET event_type = 'INTAKE_ITEM_CREATED'
        WHERE event_type = 'REGISTRY_REG_REVIEW'
      `);
      await client.query(`
        UPDATE notification_rule
        SET event_type = 'INTAKE_SENT_MD',
            title_template = 'Registration sent for Medical Director review',
            body_template = '{member_name}: {detail}'
        WHERE event_type = 'REG_REVIEW_ESCALATED'
      `);
      await client.query(`
        INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role,
          severity, title_template, body_template, is_active)
        SELECT $1, 'INTAKE_SENT_BACK', 'position', 'POSITIONCLINIC:CASEMAN',
          'warning', 'Registration sent back by the Medical Director',
          '{member_name}: {detail}', true
        WHERE NOT EXISTS (SELECT 1 FROM notification_rule WHERE tenant_id = $1 AND event_type = 'INTAKE_SENT_BACK')
      `, [TENANT]);
      await client.query(`
        INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role,
          severity, title_template, body_template, is_active)
        SELECT $1, 'INTAKE_OVERDUE', 'position', 'POSITIONCLINIC:CASEMAN',
          'warning', 'Registration review overdue',
          '{member_name}: the outreach clock has run out. {detail}', true
        WHERE NOT EXISTS (SELECT 1 FROM notification_rule WHERE tenant_id = $1 AND event_type = 'INTAKE_OVERDUE')
      `, [TENANT]);
      console.log('  ✅ Notification rules: INTAKE_ITEM_CREATED/INTAKE_SENT_BACK/INTAKE_OVERDUE → Case Managers, INTAKE_SENT_MD → Medical Directors');

      // ── 10. The SLA job becomes the intake SLA job. Default behavior per
      //       the contract (Erica's open decision, Bill's default until she
      //       answers): overdue FLAGS and notifies the case managers — it
      //       does NOT auto-escalate to the Medical Director. Configurable. ──
      await client.query(`
        UPDATE scheduled_job
        SET job_code = 'INTAKE_SLA', job_name = 'Intake SLA Check',
            job_description = 'Notifies case managers of intake items past their outreach deadline. Auto-escalation to the Medical Director is OFF by default (sysparm intake_sla / auto_escalate).'
        WHERE job_code = 'REG_REVIEW_SLA'
      `);
      console.log('  ✅ REG_REVIEW_SLA scheduled job renamed to INTAKE_SLA');

      // ── 11. Tunable knobs live in config tables, not JS constants:
      //       the two-business-day standard, the due-soon window, and the
      //       overdue behavior switch. ──
      let sp = await client.query(
        `SELECT sysparm_id FROM sysparm WHERE tenant_id = $1 AND sysparm_key = 'intake_sla'`, [TENANT]);
      if (!sp.rows.length) {
        sp = await client.query(`
          INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
          VALUES ($1, 'intake_sla', 'group', 'Intake SLA configuration: outreach clock (business days), due-soon window (hours), overdue auto-escalation')
          RETURNING sysparm_id
        `, [TENANT]);
        const spId = sp.rows[0].sysparm_id;
        const knobs = [
          ['sla', 'business_days', '2'],
          ['sla', 'due_soon_hours', '12'],
          ['sla', 'auto_escalate', 'false']
        ];
        for (const [cat, code, value] of knobs) {
          await client.query(
            `INSERT INTO sysparm_detail (sysparm_id, category, code, value) VALUES ($1, $2, $3, $4)`,
            [spId, cat, code, value]);
        }
        console.log('  ✅ intake_sla config seeded (business_days=2, due_soon_hours=12, auto_escalate=false)');
      } else {
        console.log('  ⏭️  intake_sla config already exists');
      }
    }
  },
  {
    version: 112,
    description: "ML_ENGINE_DOWN critical notification rule (Session 142, Bill's rule: database and ML engine are both required — the platform refuses to boot without them; a mid-run ML death auto-restarts with durable logging, and when the restart budget is exhausted this rule tells the tenant's admins that fresh risk scoring is offline)",
    async run(client) {
      const TENANT = 5;
      await client.query(`
        INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role,
          severity, title_template, body_template, is_active)
        SELECT $1, 'ML_ENGINE_DOWN', 'role', 'admin', 'critical',
          'Predictive risk engine is OFFLINE',
          'The ML engine died and could not be restarted automatically. Fresh risk scoring is offline until it is brought back. {detail}', true
        WHERE NOT EXISTS (SELECT 1 FROM notification_rule WHERE tenant_id = $1 AND event_type = 'ML_ENGINE_DOWN')
      `, [TENANT]);
      console.log('  ✅ ML_ENGINE_DOWN notification rule → tenant admins (critical)');
    }
  },
  {
    version: 113,
    description: "Intake Phase 2 (Session 143) — Columbia C-SSRS screener + positive→SENTINEL wire (the ONE intake→registry connection, Erica's spec §3) + INTAKE_ACTIVATED notification rule",
    async run(client) {
      const T = 5; // Wisconsin PHP tenant

      // --- 1. Question categories: three escalating levels, so the scorer
      //        can read severity from category_code (the PHQ9_SI pattern) ---
      async function ensureCategory(code, name) {
        const found = await client.query(
          `SELECT link FROM survey_question_category WHERE tenant_id = $1 AND category_code = $2`, [T, code]);
        if (found.rows.length) return found.rows[0].link;
        const next = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey_question_category`);
        await client.query(
          `INSERT INTO survey_question_category (link, tenant_id, category_code, category_name, status)
           VALUES ($1, $2, $3, $4, 'A')`, [next.rows[0].l, T, code, name]);
        console.log(`  ✅ Category ${code} created (link=${next.rows[0].l})`);
        return next.rows[0].l;
      }
      const catIdea = await ensureCategory('CSSRS_IDEA', 'Suicidal Ideation (C-SSRS 1-2)');
      const catPlan = await ensureCategory('CSSRS_PLAN', 'Ideation with Method/Intent/Plan (C-SSRS 3-5)');
      const catAct  = await ensureCategory('CSSRS_ACT',  'Suicidal Behavior (C-SSRS 6)');

      // --- 2. The survey. Clinician-administered (respondent_type C — intake
      //        staff perform it, like Provider Pulse), screening purpose,
      //        cadence NULL (MEDS-exempt). License label left for Erica to
      //        confirm, same as the anchor battery. ---
      let cssrsLink = null;
      const found = await client.query(
        `SELECT link FROM survey WHERE tenant_id = $1 AND survey_code = 'CSSRS'`, [T]);
      if (found.rows.length) {
        console.log('  ⏭️  Survey CSSRS already exists');
      } else {
        const next = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey`);
        cssrsLink = next.rows[0].l;
        await client.query(
          `INSERT INTO survey (link, tenant_id, survey_code, survey_name, survey_description,
                               respondent_type, status, score_function, cadence_days,
                               instrument_purpose, license_status)
           VALUES ($1, $2, 'CSSRS', 'Columbia Suicide Severity Rating Scale (Screener)',
                   'Ask the person each question as written. In the past month:',
                   'C', 'A', 'scoreCSSRS.js', NULL, 'screening', NULL)`,
          [cssrsLink, T]);
        console.log(`  ✅ Survey CSSRS created (link=${cssrsLink})`);
      }

      // --- 3. The six screener items, Yes/No (only when the survey is new) ---
      if (cssrsLink) {
        const yesNo = [{ text: 'Yes', value: 1 }, { text: 'No', value: 0 }];
        async function addQ(catLink, questionText, displayOrder) {
          const q = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey_question`);
          const qL = q.rows[0].l;
          await client.query(
            `INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status)
             VALUES ($1, $2, $3, $4, true, false, 'A')`, [qL, T, catLink, questionText]);
          for (let i = 0; i < yesNo.length; i++) {
            const a = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey_question_answer`);
            await client.query(
              `INSERT INTO survey_question_answer (link, question_link, answer_text, answer_value, display_order, status)
               VALUES ($1, $2, $3, $4, $5, 'A')`, [a.rows[0].l, qL, yesNo[i].text, yesNo[i].value, i + 1]);
          }
          const ql = await client.query(`SELECT COALESCE(MAX(link), 0) + 1 AS l FROM survey_question_list`);
          await client.query(
            `INSERT INTO survey_question_list (link, tenant_id, survey_link, question_link, display_order, status)
             VALUES ($1, $2, $3, $4, $5, 'A')`, [ql.rows[0].l, T, cssrsLink, qL, displayOrder]);
        }
        await addQ(catIdea, 'Have you wished you were dead or wished you could go to sleep and not wake up?', 1);
        await addQ(catIdea, 'Have you actually had any thoughts of killing yourself?', 2);
        await addQ(catPlan, 'Have you been thinking about how you might do this?', 3);
        await addQ(catPlan, 'Have you had these thoughts and had some intention of acting on them?', 4);
        await addQ(catPlan, 'Have you started to work out or worked out the details of how to kill yourself? Do you intend to carry out this plan?', 5);
        await addQ(catAct, 'Have you ever done anything, started to do anything, or prepared to do anything to end your life?', 6);
        console.log('  ✅ C-SSRS: 6 items seeded (Yes/No, three escalation categories)');
      }

      // --- 4. CSSRS_POSITIVE signal type ---
      await client.query(
        `INSERT INTO signal_type (tenant_id, signal_code, signal_name, description, is_active)
         SELECT $1, 'CSSRS_POSITIVE', 'Columbia Screener Positive',
                'Any C-SSRS screener item answered Yes (threshold is protocol-tunable)', true
         WHERE NOT EXISTS (SELECT 1 FROM signal_type WHERE tenant_id = $1 AND signal_code = 'CSSRS_POSITIVE')`,
        [T]);
      console.log('  ✅ CSSRS_POSITIVE signal type registered');

      // --- 5. Alert bonus: SIGNAL = CSSRS_POSITIVE → SR_SENTINEL registry
      //        item. The ONE deliberate intake→registry wire: it fires for a
      //        REGISTRANT at intake exactly as it would for a participant. ---
      const bonusExists = await client.query(
        `SELECT bonus_id FROM bonus WHERE tenant_id = $1 AND bonus_code = 'CSSRS_ALERT'`, [T]);
      if (!bonusExists.rows.length) {
        const srSentinel = await client.query(
          `SELECT action_id FROM external_result_action WHERE tenant_id = $1 AND action_code = 'SR_SENTINEL'`, [T]);
        if (!srSentinel.rows.length) throw new Error('SR_SENTINEL external action not found for tenant 5');

        const ruleResult = await client.query(`INSERT INTO rule DEFAULT VALUES RETURNING rule_id`);
        const ruleId = ruleResult.rows[0].rule_id;
        await client.query(
          `INSERT INTO rule_criteria (rule_id, molecule_key, operator, value, label, sort_order)
           VALUES ($1, 'SIGNAL', 'equals', '"CSSRS_POSITIVE"', 'Columbia screener positive', 1)`,
          [ruleId]);
        const bonusInsert = await client.query(
          `INSERT INTO bonus (bonus_code, bonus_description, start_date, end_date, is_active,
                              bonus_type, bonus_amount, rule_id, tenant_id,
                              apply_sunday, apply_monday, apply_tuesday, apply_wednesday,
                              apply_thursday, apply_friday, apply_saturday)
           VALUES ('CSSRS_ALERT', 'Columbia Screener Positive — SENTINEL Alert', '2026-01-01', '2050-12-31',
                   true, 'fixed', 0, $1, $2, true, true, true, true, true, true, true)
           RETURNING bonus_id`, [ruleId, T]);
        await client.query(
          `INSERT INTO bonus_result (bonus_id, tenant_id, result_type, result_reference_id, result_description, sort_order)
           VALUES ($1, $2, 'external', $3, 'Positive Columbia screening — immediate clinical attention', 0)`,
          [bonusInsert.rows[0].bonus_id, T, srSentinel.rows[0].action_id]);
        console.log(`  ✅ CSSRS_ALERT bonus created (rule ${ruleId} → SR_SENTINEL)`);
      } else {
        console.log('  ⏭️  CSSRS_ALERT bonus already exists');
      }

      // --- 6. INTAKE_ACTIVATED notification rule — the conversion moment
      //        tells the case managers their registrant joined the roster ---
      await client.query(`
        INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role,
          severity, title_template, body_template, is_active)
        SELECT $1, 'INTAKE_ACTIVATED', 'position', 'POSITIONCLINIC:CASEMAN',
          'info', 'Registrant activated as participant',
          '{member_name}: {detail}', true
        WHERE NOT EXISTS (SELECT 1 FROM notification_rule WHERE tenant_id = $1 AND event_type = 'INTAKE_ACTIVATED')
      `, [T]);
      console.log('  ✅ INTAKE_ACTIVATED notification rule → Case Managers');
    }
  },
  {
    version: 114,
    description: "MEDS notification dedup (Session 143) — the 'Consecutive Missed Events' flood: notifications gain an opt-in dedup_key (one alert per NEW missed period, never one per scan) and the MEDS templates finally NAME the member",
    async run(client) {
      const T = 5; // Wisconsin PHP tenant

      // --- 1. The dedup column: a caller-supplied state key. When present,
      //        fireNotificationEvent refuses to deliver the same key twice —
      //        the daily scan and every chart-load re-check stay silent
      //        until the state actually changes. ---
      await client.query(`ALTER TABLE notification ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(80)`);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_notification_dedup
        ON notification (tenant_id, dedup_key) WHERE dedup_key IS NOT NULL
      `);
      console.log('  ✅ notification.dedup_key + partial index');

      // --- 2. The MEDS templates name the member (Erica's complaint: a
      //        critical that names nobody). Same {member_name}: {detail}
      //        shape the intake rules use; meds.js populates both. ---
      const templates = [
        ['MEDS_SURVEY_OVERDUE', '{member_name}: {detail}'],
        ['MEDS_COMPLIANCE_OVERDUE', '{member_name}: {detail}'],
        ['MEDS_CONSECUTIVE_MISS', '{member_name}: {detail}. Immediate attention required.']
      ];
      for (const [event, body] of templates) {
        await client.query(
          `UPDATE notification_rule SET body_template = $2 WHERE tenant_id = $1 AND event_type = $3`,
          [T, body, event]);
      }
      console.log('  ✅ MEDS rule bodies now carry {member_name}: {detail}');

      // --- 2b. The two overdue WARNING rules routed to role='clinician' —
      //        a role platform_user's CHECK constraint does not allow, so
      //        no login has ever held it and these rules have delivered to
      //        NOBODY since they were seeded. Route them by position to the
      //        Case Managers (the same recipients the intake overdue clock
      //        notifies — the people who chase missed check-ins). Data, not
      //        code: Erica can re-route anytime. The critical
      //        MEDS_CONSECUTIVE_MISS stays all_clinical, unchanged. ---
      await client.query(
        `UPDATE notification_rule
         SET recipient_type = 'position', recipient_role = 'POSITIONCLINIC:CASEMAN'
         WHERE tenant_id = $1 AND event_type IN ('MEDS_SURVEY_OVERDUE', 'MEDS_COMPLIANCE_OVERDUE')
           AND recipient_type = 'role' AND recipient_role = 'clinician'`,
        [T]);
      console.log('  ✅ Overdue warnings repointed: dead role=clinician → position Case Manager');

      // --- 3. Delete the flood (Bill's call, 2026-07-14): every MEDS
      //        overdue/consecutive notification from before the fix — they
      //        are identical, name no member, and carry nothing anyone
      //        could act on. Pre-fix rows are exactly the ones with no
      //        dedup_key. The clinical record (registry items) is untouched;
      //        this is only the bell's inbox. Delivery records first (the
      //        FK has no cascade). ---
      const MEDS_EVENTS = ['MEDS_CONSECUTIVE_MISS', 'MEDS_SURVEY_OVERDUE', 'MEDS_COMPLIANCE_OVERDUE'];
      const delDeliveries = await client.query(
        `DELETE FROM notification_delivery
         WHERE notification_id IN (
           SELECT notification_id FROM notification
           WHERE tenant_id = $1 AND event_type = ANY($2) AND dedup_key IS NULL
         )`,
        [T, MEDS_EVENTS]);
      const delNotifs = await client.query(
        `DELETE FROM notification
         WHERE tenant_id = $1 AND event_type = ANY($2) AND dedup_key IS NULL`,
        [T, MEDS_EVENTS]);
      console.log(`  ✅ Flood deleted: ${delNotifs.rowCount} notifications + ${delDeliveries.rowCount} delivery records`);
    }
  },
  {
    version: 115,
    description: "Credentials (Session 143, Tom + Erica's confirmed design) — CREDENTIAL member molecule: ONE flat list (never coupled to boards — Tom), multiple per person, Tom's starting set, displayed after the name ('Jane Smith, MD'), managed on a Program Settings page, retire-not-delete honored",
    async run(client) {
      const TENANT = 5;

      // ── 1. CREDENTIAL molecule_def (internal_list, member, 1 byte) —
      //      the v111 INTAKE_STATUS pattern: guarded insert, resolved by
      //      molecule_key, never by id. ──
      let mol = await client.query(
        `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'CREDENTIAL'`,
        [TENANT]
      );
      if (!mol.rows.length) {
        await client.query(`
          INSERT INTO molecule_def (
            molecule_key, label, value_kind, tenant_id, context, attaches_to,
            storage_size, value_type, description
          ) VALUES (
            'CREDENTIAL', 'Credential', 'internal_list', $1, 'member', 'M',
            1, 'code',
            'Professional credentials, displayed after the name ("Jane Smith, MD"). ONE flat list, deliberately never partitioned by board or profession (Tom: a maxillofacial surgeon holds DDS under the medical board). A person may hold several — one row each. Managed on Program Settings -> Credentials; retire-not-delete.'
          )
        `, [TENANT]);
        mol = await client.query(
          `SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = 'CREDENTIAL'`,
          [TENANT]
        );
        console.log(`  ✅ CREDENTIAL molecule_def created (molecule_id=${mol.rows[0].molecule_id})`);
      } else {
        console.log(`  ⏭️  CREDENTIAL molecule_def already exists (molecule_id=${mol.rows[0].molecule_id})`);
      }
      const molId = mol.rows[0].molecule_id;

      // ── 2. molecule_value_lookup — MANDATORY for a member molecule
      //      (MOLECULES.md §5.2). ──
      const lookExists = await client.query(
        `SELECT 1 FROM molecule_value_lookup WHERE molecule_id = $1`, [molId]
      );
      if (!lookExists.rows.length) {
        await client.query(`
          INSERT INTO molecule_value_lookup (
            molecule_id, is_tenant_specific, column_order, decimal_places, col_description,
            value_type, value_kind, scalar_type, context, storage_size, attaches_to
          ) VALUES (
            $1, true, 1, 0, 'Professional credential',
            'code', 'internal_list', NULL, 'member', 1, 'M'
          )
        `, [molId]);
        console.log('  ✅ CREDENTIAL molecule_value_lookup row created (context=member, attaches_to=M)');
      } else {
        console.log('  ⏭️  CREDENTIAL molecule_value_lookup row already exists');
      }

      // ── 3. Tom's starting set — EXPLICIT per-molecule value_id 1..14
      //      (§5.3). Codes are stable and compact; labels are the exact
      //      rendering after the name. Erica's team grows the list on the
      //      Credentials page — adding one there is data, never code. ──
      const CREDENTIALS = [
        { id: 1,  code: 'MD',    label: 'MD' },
        { id: 2,  code: 'DO',    label: 'DO' },
        { id: 3,  code: 'MBBS',  label: 'MBBS' },
        { id: 4,  code: 'MBCHB', label: 'MBChB' },
        { id: 5,  code: 'MBBCH', label: 'MBBCh' },
        { id: 6,  code: 'BMBS',  label: 'BMBS' },
        { id: 7,  code: 'BMBCH', label: 'BM BCh' },
        { id: 8,  code: 'PAC',   label: 'PA-C' },
        { id: 9,  code: 'LPN',   label: 'LPN' },
        { id: 10, code: 'RN',    label: 'RN' },
        { id: 11, code: 'NP',    label: 'NP' },
        { id: 12, code: 'DDS',   label: 'DDS' },
        { id: 13, code: 'DMD',   label: 'DMD' },
        { id: 14, code: 'BDS',   label: 'BDS' }
      ];
      for (const c of CREDENTIALS) {
        await client.query(`
          INSERT INTO molecule_value_text (molecule_id, value_id, text_value, display_label, sort_order, is_active)
          VALUES ($1, $2, $3, $4, $2, true)
          ON CONFLICT (molecule_id, value_id) DO NOTHING
        `, [molId, c.id, c.code, c.label]);
      }
      console.log(`  ✅ ${CREDENTIALS.length} credentials seeded (explicit value_id 1..14)`);

      // ── 4. M composite ONLY — deliberately NOT the input template (the
      //      v111 INTAKE_STATUS pattern): the composite authorizes the
      //      field; credentials move through their own multi-row door
      //      (the profile form's single-value upsert can't hold several). ──
      const comp = await client.query(
        `SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = 'M'`,
        [TENANT]
      );
      if (comp.rows.length) {
        const compositeLink = comp.rows[0].link;
        const detailExists = await client.query(
          `SELECT 1 FROM composite_detail WHERE p_link = $1 AND molecule_id = $2`,
          [compositeLink, molId]
        );
        if (!detailExists.rows.length) {
          const detailLink = await getNextLink(client, TENANT, 'composite_detail');
          await client.query(`
            INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, sort_order)
            VALUES ($1, $2, $3, false, false, 10)
          `, [detailLink, compositeLink, molId]);
          console.log(`  ✅ CREDENTIAL added to tenant-5 M composite (detail link=${detailLink})`);
        } else {
          console.log('  ⏭️  CREDENTIAL already in tenant-5 M composite');
        }
      } else {
        console.log('  ⚠️  tenant-5 M composite not found — skipping composite add');
      }
    }
  },
  {
    version: 116,
    description: "Stand up wa_php (Session 144, WASHINGTON) — the second workforce state: full configuration copy from wi_php (no people, no member data), Washington branding + Washington licensing boards. The multi-tenant thesis made real: a new state is configuration, not construction.",
    async run(client) {
      // ── 0. Resolve source by KEY (never a hardcoded id), guard the rerun. ──
      const srcQ = await client.query(`SELECT tenant_id FROM tenant WHERE tenant_key = 'wi_php'`);
      if (!srcQ.rows.length) throw new Error("Source tenant wi_php not found — cannot stand up wa_php");
      const SRC = srcQ.rows[0].tenant_id;

      const existQ = await client.query(`SELECT tenant_id FROM tenant WHERE tenant_key = 'wa_php'`);
      if (existQ.rows.length) {
        console.log('  ⏭️  wa_php already exists — nothing to do');
        return;
      }

      // The tenant_id sequence lags the hand-seeded tenants (1-5) — true it
      // up first (same story on Heroku; harmless when already current).
      await client.query(`SELECT setval('tenant_tenant_id_seq', (SELECT MAX(tenant_id) FROM tenant))`);
      const tgtQ = await client.query(
        `INSERT INTO tenant (tenant_key, name, vertical_key, is_active)
         VALUES ('wa_php', 'Washington PHP', 'workforce_monitoring', true)
         RETURNING tenant_id`
      );
      const TGT = tgtQ.rows[0].tenant_id;
      console.log(`  ✅ Tenant wa_php created (tenant_id=${TGT})`);

      // ── 1. sysparm + details. Branding is NOT copied — Washington gets its
      //      own (evergreen primary; company name per the program). Everything
      //      else (ppii_thresholds, pattern_triggers, event_severity,
      //      accrual_context_keys, ...) copies verbatim — per-state tuning is
      //      exactly what these rows are FOR; kickoff adjusts values, not code. ──
      const sysparms = await client.query(
        `SELECT sysparm_id, sysparm_key, value_type, description FROM sysparm
         WHERE tenant_id = $1 AND sysparm_key <> 'branding'`, [SRC]);
      for (const sp of sysparms.rows) {
        const ins = await client.query(
          `INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
           VALUES ($1, $2, $3, $4) RETURNING sysparm_id`,
          [TGT, sp.sysparm_key, sp.value_type, sp.description]);
        await client.query(
          `INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
           SELECT $1, category, code, value, sort_order FROM sysparm_detail WHERE sysparm_id = $2`,
          [ins.rows[0].sysparm_id, sp.sysparm_id]);
      }
      const brandIns = await client.query(
        `INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
         VALUES ($1, 'branding', 'json', 'Tenant branding') RETURNING sysparm_id`, [TGT]);
      const BRAND = [
        ['text', 'company_name', 'Washington PHP', 1],
        ['text', 'alt', 'Washington Physicians Health Program', 2],
        ['color', 'primary', '#166534', 3],
        ['color', 'accent', '#b45309', 4]
      ];
      for (const [cat, code, value, ord] of BRAND) {
        await client.query(
          `INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
           VALUES ($1, $2, $3, $4, $5)`, [brandIns.rows[0].sysparm_id, cat, code, value, ord]);
      }
      console.log(`  ✅ ${sysparms.rows.length} sysparm groups copied + Washington branding`);

      // ── 2. point_type (map old→new id for everything that references it). ──
      const ptMap = new Map();
      const pts = await client.query(`SELECT * FROM point_type WHERE tenant_id = $1`, [SRC]);
      for (const pt of pts.rows) {
        const ins = await client.query(
          `INSERT INTO point_type (tenant_id, point_type_code, point_type_name, redemption_priority, display_order, status)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING point_type_id`,
          [TGT, pt.point_type_code, pt.point_type_name, pt.redemption_priority, pt.display_order, pt.status]);
        ptMap.set(pt.point_type_id, ins.rows[0].point_type_id);
      }
      console.log(`  ✅ ${ptMap.size} point type(s) copied`);

      // ── 3. Molecules: defs, then lookups (list_source_molecule_id remapped
      //      AFTER all defs exist — POSITIONCLINIC borrows POSITION's list),
      //      then values with their EXACT per-molecule value_id (§5.3 — the
      //      one-byte cell; letting the sequence assign silently overflows). ──
      const molMap = new Map();
      const defs = await client.query(`SELECT * FROM molecule_def WHERE tenant_id = $1 ORDER BY molecule_id`, [SRC]);
      for (const d of defs.rows) {
        const ins = await client.query(
          `INSERT INTO molecule_def (
             tenant_id, molecule_key, label, description, attaches_to, context,
             storage_size, value_type, value_kind, scalar_type, lookup_table_key,
             display_width, is_permanent, molecule_type, value_structure,
             ref_function_name, ref_table_name, ref_field_name,
             system_required, parent_bytes, parent_entity_id,
             is_static, is_required, is_active, foreign_schema, display_order,
             sample_code, sample_description, decimal_places,
             parent_molecule_key, parent_fk_field, can_be_promotion_counter,
             list_context, input_type, param1_label, param2_label, param3_label, param4_label
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
           RETURNING molecule_id`,
          [TGT, d.molecule_key, d.label, d.description, d.attaches_to, d.context,
           d.storage_size, d.value_type, d.value_kind, d.scalar_type, d.lookup_table_key,
           d.display_width, d.is_permanent, d.molecule_type, d.value_structure,
           d.ref_function_name, d.ref_table_name, d.ref_field_name,
           d.system_required || false, d.parent_bytes || 5, d.parent_entity_id,
           d.is_static, d.is_required, d.is_active, d.foreign_schema, d.display_order,
           d.sample_code, d.sample_description, d.decimal_places,
           d.parent_molecule_key, d.parent_fk_field, d.can_be_promotion_counter,
           d.list_context, d.input_type, d.param1_label, d.param2_label, d.param3_label, d.param4_label]);
        molMap.set(d.molecule_id, ins.rows[0].molecule_id);
      }
      let lookups = 0, values = 0;
      for (const [oldId, newId] of molMap) {
        const looks = await client.query(`SELECT * FROM molecule_value_lookup WHERE molecule_id = $1 ORDER BY column_order`, [oldId]);
        for (const l of looks.rows) {
          const listSrc = l.list_source_molecule_id ? (molMap.get(l.list_source_molecule_id) || null) : null;
          await client.query(
            `INSERT INTO molecule_value_lookup (
               molecule_id, table_name, id_column, code_column, label_column,
               maintenance_page, maintenance_description, is_tenant_specific,
               column_order, column_type, decimal_places, col_description,
               value_type, lookup_table_key, value_kind, scalar_type, context,
               storage_size, attaches_to, ref_table_name, ref_field_name,
               ref_function_name, list_source_molecule_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
            [newId, l.table_name, l.id_column, l.code_column, l.label_column,
             l.maintenance_page, l.maintenance_description, l.is_tenant_specific,
             l.column_order, l.column_type, l.decimal_places, l.col_description,
             l.value_type, l.lookup_table_key, l.value_kind, l.scalar_type, l.context,
             l.storage_size, l.attaches_to, l.ref_table_name, l.ref_field_name,
             l.ref_function_name, listSrc]);
          lookups++;
        }
        const vals = await client.query(`SELECT * FROM molecule_value_text WHERE molecule_id = $1 ORDER BY value_id`, [oldId]);
        for (const v of vals.rows) {
          await client.query(
            `INSERT INTO molecule_value_text (molecule_id, value_id, text_value, display_label, sort_order, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [newId, v.value_id, v.text_value, v.display_label, v.sort_order, v.is_active]);
          values++;
        }
      }
      console.log(`  ✅ ${molMap.size} molecules copied (${lookups} lookup rows, ${values} list values, value_ids preserved)`);

      // ── 4. Composites + details (links via getNextLink — never raw SQL). ──
      const compMap = new Map();
      const comps = await client.query(`SELECT * FROM composite WHERE tenant_id = $1`, [SRC]);
      for (const c of comps.rows) {
        const newLink = await getNextLink(client, TGT, 'composite');
        await client.query(
          `INSERT INTO composite (link, tenant_id, composite_type, description, validate_function, point_type_molecule_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newLink, TGT, c.composite_type, c.description, c.validate_function,
           c.point_type_molecule_id ? (molMap.get(c.point_type_molecule_id) || null) : null]);
        compMap.set(c.link, newLink);
        const dets = await client.query(`SELECT * FROM composite_detail WHERE p_link = $1 ORDER BY sort_order`, [c.link]);
        for (const cd of dets.rows) {
          const dLink = await getNextLink(client, TGT, 'composite_detail');
          await client.query(
            `INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [dLink, newLink, molMap.get(cd.molecule_id), cd.is_required, cd.is_calculated, cd.calc_function, cd.sort_order]);
        }
      }
      console.log(`  ✅ ${compMap.size} composites copied with details`);

      // ── 5. Input templates + fields (molecule_key rides as a string;
      //      composite_link remapped when present). ──
      const its = await client.query(`SELECT * FROM input_template WHERE tenant_id = $1`, [SRC]);
      for (const t of its.rows) {
        const ins = await client.query(
          `INSERT INTO input_template (tenant_id, template_name, activity_type, is_active)
           VALUES ($1, $2, $3, $4) RETURNING template_id`,
          [TGT, t.template_name, t.activity_type, t.is_active]);
        await client.query(
          `INSERT INTO input_template_field (
             template_id, row_number, molecule_key, start_position, display_width,
             field_width, enterable, system_generated, is_required, display_label,
             sort_order, composite_link, column_number)
           SELECT $1, row_number, molecule_key, start_position, display_width,
             field_width, enterable, system_generated, is_required, display_label,
             sort_order, $3, column_number
           FROM input_template_field WHERE template_id = $2`,
          [ins.rows[0].template_id, t.template_id,
           null /* composite_link unused on wi_php templates; null verified pre-write */]);
      }
      console.log(`  ✅ ${its.rows.length} input templates copied`);

      // ── 6. Display templates + lines (molecule KEYS live inside the line
      //      strings — nothing to remap). ──
      const dts = await client.query(`SELECT * FROM display_template WHERE tenant_id = $1`, [SRC]);
      for (const t of dts.rows) {
        const ins = await client.query(
          `INSERT INTO display_template (tenant_id, template_name, template_type, is_active, activity_type)
           VALUES ($1, $2, $3, $4, $5) RETURNING template_id`,
          [TGT, t.template_name, t.template_type, t.is_active, t.activity_type]);
        await client.query(
          `INSERT INTO display_template_line (template_id, line_number, template_string)
           SELECT $1, line_number, template_string FROM display_template_line WHERE template_id = $2`,
          [ins.rows[0].template_id, t.template_id]);
      }
      console.log(`  ✅ ${dts.rows.length} display templates copied`);

      // ── 7. The survey catalog: categories → questions → surveys → lists
      //      (links via getNextLink; score_function is a filename string —
      //      the scorers are the vertical's shared clinical engine now). ──
      const catMap = new Map(), qMap = new Map(), svMap = new Map();
      const cats = await client.query(`SELECT * FROM survey_question_category WHERE tenant_id = $1`, [SRC]);
      for (const c of cats.rows) {
        const nl = await getNextLink(client, TGT, 'survey_question_category');
        await client.query(
          `INSERT INTO survey_question_category (link, tenant_id, category_code, category_name, status)
           VALUES ($1, $2, $3, $4, $5)`, [nl, TGT, c.category_code, c.category_name, c.status]);
        catMap.set(c.link, nl);
      }
      const qs = await client.query(`SELECT * FROM survey_question WHERE tenant_id = $1`, [SRC]);
      for (const q of qs.rows) {
        const nl = await getNextLink(client, TGT, 'survey_question');
        await client.query(
          `INSERT INTO survey_question (link, tenant_id, category_link, question, is_required, allow_multiple, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [nl, TGT, q.category_link ? catMap.get(q.category_link) : null, q.question, q.is_required, q.allow_multiple, q.status]);
        qMap.set(q.link, nl);
      }
      const svs = await client.query(`SELECT * FROM survey WHERE tenant_id = $1`, [SRC]);
      for (const s of svs.rows) {
        const nl = await getNextLink(client, TGT, 'survey');
        await client.query(
          `INSERT INTO survey (link, tenant_id, survey_code, survey_name, survey_description, respondent_type,
             status, score_function, cadence_days, note_alert, instrument_purpose, license_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [nl, TGT, s.survey_code, s.survey_name, s.survey_description, s.respondent_type,
           s.status, s.score_function, s.cadence_days, s.note_alert, s.instrument_purpose, s.license_status]);
        svMap.set(s.link, nl);
      }
      const sqls = await client.query(`SELECT * FROM survey_question_list WHERE tenant_id = $1`, [SRC]);
      for (const l of sqls.rows) {
        const nl = await getNextLink(client, TGT, 'survey_question_list');
        await client.query(
          `INSERT INTO survey_question_list (link, tenant_id, survey_link, question_link, display_order, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [nl, TGT, svMap.get(l.survey_link), qMap.get(l.question_link), l.display_order, l.status]);
      }
      console.log(`  ✅ Survey catalog copied: ${svs.rows.length} instruments, ${qs.rows.length} questions, ${cats.rows.length} categories`);

      // ── 8. Compliance items + statuses. ──
      const cis = await client.query(`SELECT * FROM compliance_item WHERE tenant_id = $1`, [SRC]);
      for (const ci of cis.rows) {
        const ins = await client.query(
          `INSERT INTO compliance_item (tenant_id, item_code, item_name, weight, status, cadence_days, cadence_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING compliance_item_id`,
          [TGT, ci.item_code, ci.item_name, ci.weight, ci.status, ci.cadence_days, ci.cadence_type]);
        await client.query(
          `INSERT INTO compliance_item_status (compliance_item_id, status_code, score, is_sentinel, sort_order)
           SELECT $1, status_code, score, is_sentinel, sort_order FROM compliance_item_status WHERE compliance_item_id = $2`,
          [ins.rows[0].compliance_item_id, ci.compliance_item_id]);
      }
      console.log(`  ✅ ${cis.rows.length} compliance items copied with statuses`);

      // ── 9. Signal types. ──
      await client.query(
        `INSERT INTO signal_type (tenant_id, signal_code, signal_name, description, is_active)
         SELECT $1, signal_code, signal_name, description, is_active FROM signal_type WHERE tenant_id = $2`,
        [TGT, SRC]);
      console.log('  ✅ Signal types copied');

      // ── 10. External result actions (map action_id — bonus_result references it). ──
      const actMap = new Map();
      const acts = await client.query(`SELECT * FROM external_result_action WHERE tenant_id = $1`, [SRC]);
      for (const a of acts.rows) {
        const ins = await client.query(
          `INSERT INTO external_result_action (tenant_id, action_code, action_name, function_name, description, is_active, urgency, sla_hours)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING action_id`,
          [TGT, a.action_code, a.action_name, a.function_name, a.description, a.is_active, a.urgency, a.sla_hours]);
        actMap.set(a.action_id, ins.rows[0].action_id);
      }
      console.log(`  ✅ ${actMap.size} external result actions copied`);

      // ── 11. Rules + criteria (shared copier for bonuses, promotions,
      //      the expiration rule). ──
      async function copyRule(oldRuleId) {
        if (!oldRuleId) return null;
        const newRule = await client.query(`INSERT INTO rule DEFAULT VALUES RETURNING rule_id`);
        const newRuleId = newRule.rows[0].rule_id;
        await client.query(
          `INSERT INTO rule_criteria (rule_id, molecule_key, operator, value, label, joiner, sort_order,
             param1_value, param2_value, param3_value, param4_value, column_number)
           SELECT $1, molecule_key, operator, value, label, joiner, sort_order,
             param1_value, param2_value, param3_value, param4_value, column_number
           FROM rule_criteria WHERE rule_id = $2`, [newRuleId, oldRuleId]);
        return newRuleId;
      }

      // ── 12. Bonuses (active only) + their results. ──
      const bonuses = await client.query(`SELECT * FROM bonus WHERE tenant_id = $1 AND is_active = true`, [SRC]);
      for (const b of bonuses.rows) {
        const newRuleId = await copyRule(b.rule_id);
        const ins = await client.query(
          `INSERT INTO bonus (bonus_code, bonus_description, start_date, end_date, is_active, bonus_type,
             bonus_amount, rule_id, tenant_id, apply_sunday, apply_monday, apply_tuesday, apply_wednesday,
             apply_thursday, apply_friday, apply_saturday, required_tier_id, point_type_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING bonus_id`,
          [b.bonus_code, b.bonus_description, b.start_date, b.end_date, b.is_active, b.bonus_type,
           b.bonus_amount, newRuleId, TGT, b.apply_sunday, b.apply_monday, b.apply_tuesday, b.apply_wednesday,
           b.apply_thursday, b.apply_friday, b.apply_saturday, b.required_tier_id,
           b.point_type_id ? (ptMap.get(b.point_type_id) || null) : null]);
        const results = await client.query(`SELECT * FROM bonus_result WHERE bonus_id = $1 ORDER BY sort_order`, [b.bonus_id]);
        for (const r of results.rows) {
          await client.query(
            `INSERT INTO bonus_result (bonus_id, tenant_id, result_type, result_amount, amount_type,
               result_reference_id, result_description, point_type_id, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [ins.rows[0].bonus_id, TGT, r.result_type, r.result_amount, r.amount_type,
             r.result_reference_id ? (actMap.get(r.result_reference_id) || null) : null,
             r.result_description, r.point_type_id ? (ptMap.get(r.point_type_id) || null) : null, r.sort_order]);
        }
      }
      console.log(`  ✅ ${bonuses.rows.length} active bonuses copied with rules + results`);

      // ── 13. Active promotions + counters (REG_REVIEW — the enroll trigger). ──
      const promos = await client.query(`SELECT * FROM promotion WHERE tenant_id = $1 AND is_active = true`, [SRC]);
      for (const p of promos.rows) {
        const newRuleId = await copyRule(p.rule_id);
        const ins = await client.query(
          `INSERT INTO promotion (tenant_id, promotion_code, promotion_name, promotion_description,
             start_date, end_date, is_active, enrollment_type, allow_member_enrollment, rule_id,
             reward_type, reward_amount, reward_tier_id, reward_promotion_id, process_limit_count,
             duration_type, duration_end_date, duration_days, point_type_id, counter_joiner,
             apply_sunday, apply_monday, apply_tuesday, apply_wednesday, apply_thursday, apply_friday, apply_saturday)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
           RETURNING promotion_id`,
          [TGT, p.promotion_code, p.promotion_name, p.promotion_description,
           p.start_date, p.end_date, p.is_active, p.enrollment_type, p.allow_member_enrollment, newRuleId,
           p.reward_type, p.reward_amount, p.reward_tier_id, null /* reward_promotion_id: no cascades in the active set */,
           p.process_limit_count, p.duration_type, p.duration_end_date, p.duration_days,
           p.point_type_id ? (ptMap.get(p.point_type_id) || null) : null, p.counter_joiner,
           p.apply_sunday, p.apply_monday, p.apply_tuesday, p.apply_wednesday, p.apply_thursday, p.apply_friday, p.apply_saturday]);
        const counters = await client.query(`SELECT * FROM promo_wt_count WHERE promotion_id = $1 ORDER BY sort_order`, [p.promotion_id]);
        for (const cRow of counters.rows) {
          await client.query(
            `INSERT INTO promo_wt_count (promotion_id, tenant_id, count_type, counter_molecule_id, counter_token_adjustment_id, goal_amount, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [ins.rows[0].promotion_id, TGT, cRow.count_type,
             cRow.counter_molecule_id ? (molMap.get(cRow.counter_molecule_id) || null) : null,
             cRow.counter_token_adjustment_id, cRow.goal_amount, cRow.sort_order]);
        }
      }
      console.log(`  ✅ ${promos.rows.length} active promotion(s) copied with counters`);

      // ── 14. Notification rules, follow-up schedule, delivery config
      //      (timezone → Pacific). ──
      await client.query(
        `INSERT INTO notification_rule (tenant_id, event_type, recipient_type, recipient_role, notify_member,
           severity, title_template, body_template, timing_offset_hours, repeat_hours, repeat_count, is_active)
         SELECT $1, event_type, recipient_type, recipient_role, notify_member,
           severity, title_template, body_template, timing_offset_hours, repeat_hours, repeat_count, is_active
         FROM notification_rule WHERE tenant_id = $2`, [TGT, SRC]);
      await client.query(
        `INSERT INTO followup_schedule (tenant_id, urgency, extended_card, step_order, followup_type, offset_days, is_active)
         SELECT $1, urgency, extended_card, step_order, followup_type, offset_days, is_active
         FROM followup_schedule WHERE tenant_id = $2`, [TGT, SRC]);
      await client.query(
        `INSERT INTO notification_delivery_config (tenant_id, timezone, window_start, window_end, digest_hour,
           email_enabled, sms_enabled, push_enabled, max_retries)
         SELECT $1, 'America/Los_Angeles', window_start, window_end, digest_hour,
           email_enabled, sms_enabled, push_enabled, max_retries
         FROM notification_delivery_config WHERE tenant_id = $2`, [TGT, SRC]);
      console.log('  ✅ Notification rules, follow-up schedule, delivery config (Pacific time) copied');

      // ── 15. PPII streams + current weight set; PPSI subdomains + current/
      //      factory weight sets (values key by CODE — no remapping). ──
      await client.query(
        `INSERT INTO ppii_stream (tenant_id, code, label, max_value, source_function, is_active, sort_order, added_in_phase)
         SELECT $1, code, label, max_value, source_function, is_active, sort_order, added_in_phase
         FROM ppii_stream WHERE tenant_id = $2`, [TGT, SRC]);
      const pwsets = await client.query(`SELECT * FROM ppii_weight_set WHERE tenant_id = $1 AND is_current = true`, [SRC]);
      for (const ws of pwsets.rows) {
        const ins = await client.query(
          `INSERT INTO ppii_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current)
           VALUES ($1, $2, NULL, 'Washington stand-up — copied from Wisconsin current set (v116)', true)
           RETURNING weight_set_id`, [TGT, ws.effective_from]);
        await client.query(
          `INSERT INTO ppii_weight_set_value (weight_set_id, stream_code, weight)
           SELECT $1, stream_code, weight FROM ppii_weight_set_value WHERE weight_set_id = $2`,
          [ins.rows[0].weight_set_id, ws.weight_set_id]);
      }
      await client.query(
        `INSERT INTO ppsi_subdomain (tenant_id, code, label, question_count, max_value, sort_order, is_active)
         SELECT $1, code, label, question_count, max_value, sort_order, is_active
         FROM ppsi_subdomain WHERE tenant_id = $2`, [TGT, SRC]);
      const swsets = await client.query(
        `SELECT * FROM ppsi_subdomain_weight_set WHERE tenant_id = $1 AND (is_current = true OR is_factory_default = true)`, [SRC]);
      for (const ws of swsets.rows) {
        const ins = await client.query(
          `INSERT INTO ppsi_subdomain_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current, is_factory_default)
           VALUES ($1, $2, NULL, 'Washington stand-up — copied from Wisconsin (v116)', $3, $4)
           RETURNING weight_set_id`, [TGT, ws.effective_from, ws.is_current, ws.is_factory_default]);
        await client.query(
          `INSERT INTO ppsi_subdomain_weight_set_value (weight_set_id, subdomain_code, weight)
           SELECT $1, subdomain_code, weight FROM ppsi_subdomain_weight_set_value WHERE weight_set_id = $2`,
          [ins.rows[0].weight_set_id, ws.weight_set_id]);
      }
      console.log('  ✅ PPII/PPSI streams, subdomains, weight sets copied');

      // ── 16. Washington's licensing boards — the state-specific content
      //      (NOT copied from Wisconsin). WPHP serves physicians, PAs,
      //      dentists, podiatrists, veterinarians; board names to CONFIRM
      //      at kickoff. ──
      const WA_BOARDS = [
        ['WMC',  'Washington Medical Commission', 'Physician / Physician Assistant'],
        ['BOMS', 'WA Board of Osteopathic Medicine and Surgery', 'Osteopathic Physician'],
        ['DQAC', 'WA Dental Quality Assurance Commission', 'Dentist'],
        ['PODB', 'WA Podiatric Medical Board', 'Podiatric Physician'],
        ['VBOG', 'WA Veterinary Board of Governors', 'Veterinarian']
      ];
      for (const [code, name, prof] of WA_BOARDS) {
        await client.query(
          `INSERT INTO licensing_board (tenant_id, board_code, board_name, profession, is_active)
           VALUES ($1, $2, $3, $4, true)`, [TGT, code, name, prof]);
      }
      console.log(`  ✅ ${WA_BOARDS.length} Washington licensing boards seeded (names to confirm at kickoff)`);

      // ── 17. Scheduled jobs (fresh clocks — never inherit Wisconsin's
      //      run history). ──
      await client.query(
        `INSERT INTO scheduled_job (tenant_id, job_code, job_name, job_description, interval_minutes, is_active, preferred_start_time)
         SELECT $1, job_code, job_name, job_description, interval_minutes, is_active, preferred_start_time
         FROM scheduled_job WHERE tenant_id = $2`, [TGT, SRC]);
      console.log('  ✅ Scheduled jobs copied (fresh clocks)');

      // ── 18. Point expiration rule (its rule + criteria copied like a
      //      bonus rule). ──
      const pers = await client.query(`SELECT * FROM point_expiration_rule WHERE tenant_id = $1`, [SRC]);
      for (const per of pers.rows) {
        const newRuleId = await copyRule(per.rule_id);
        await client.query(
          `INSERT INTO point_expiration_rule (rule_key, start_date, end_date, expiration_date, description, rule_id, tenant_id, point_type_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [per.rule_key, per.start_date, per.end_date, per.expiration_date, per.description, newRuleId, TGT,
           per.point_type_id ? (ptMap.get(per.point_type_id) || null) : null]);
      }
      console.log(`  ✅ ${pers.rows.length} point expiration rule(s) copied`);

      // NOT copied, deliberately: members and all member data, evaluators
      // (Wisconsin's sample rows), platform_user logins (the tenant-chooser
      // story owns those), tier_definition (wi_php has none), minted codes.
      console.log('  🏔️  wa_php stands. Configuration, not construction.');
    }
  },
];


// ============================================
// RUNNER
// ============================================

// Paced progress display (Bill watches migrations run on each database copy):
// each applied version announces itself, holds, runs, announces completion, holds.
// Already-applied versions skip with no pause, so a current database zooms through.
// Always on — opt out explicitly with MIGRATE_NO_PAUSE=1 (CI sets this; a full
// from-scratch replay would otherwise add minutes of idle holds).
const PACED = !process.env.MIGRATE_NO_PAUSE;
const HOLD_MS = 2000;
function hold() { return PACED ? new Promise(r => setTimeout(r, HOLD_MS)) : Promise.resolve(); }

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

      console.log(`\n  🔄 Starting Version ${migration.version} — ${migration.description}`);
      await hold();

      try {
        await client.query('BEGIN');
        await migration.run(client);
        await setVersion(client, migration.version);
        await client.query('COMMIT');
        console.log(`  ✅ Version ${migration.version} complete`);
        await hold();
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
