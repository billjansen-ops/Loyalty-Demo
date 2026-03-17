// Seed Stability Registry — Demo Data
// Run: node SQL/seed_stability_registry.js
//
// Uses link_tank properly via atomic UPDATE/RETURNING

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '127.0.0.1',
  user: 'billjansen',
  database: 'loyalty',
  port: 5432
});

async function getLink(client) {
  // Atomic link_tank increment for stability_registry (INTEGER, 4-byte)
  const result = await client.query(`
    UPDATE link_tank SET next_link = next_link + 1
    WHERE table_key = 'stability_registry'
    RETURNING next_link - 1 AS link
  `);
  if (result.rows.length === 0) {
    // First use — initialize
    await client.query(`
      INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
      VALUES (0, 'stability_registry', 4, -2147483647)
    `);
    return -2147483648;
  }
  return result.rows[0].link;
}

async function getMemberLink(client, membershipNumber) {
  const result = await client.query(
    `SELECT link FROM member WHERE membership_number = $1 AND tenant_id = 5`,
    [membershipNumber]
  );
  if (!result.rows.length) throw new Error(`Member ${membershipNumber} not found`);
  return result.rows[0].link;
}

function billEpochToday() {
  const epoch = new Date('1959-12-03');
  const today = new Date();
  const days = Math.floor((today - epoch) / 86400000);
  return days - 32768;
}

async function seed() {
  const client = await pool.connect();
  const today = billEpochToday();

  try {
    console.log('Seeding Stability Registry demo data...\n');

    // ========== #36 Reed: YELLOW — early warning ==========
    const reed = await getMemberLink(client, '36');
    let link;

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'YELLOW', 'COMP', 'LATE_DRUG_TEST', 'Drug test completed late — 3 days past window', 28, 72, NOW() - INTERVAL '3 days' + INTERVAL '72 hours', $3, NOW() - INTERVAL '3 days', 'O')
    `, [link, reed, today - 3]);
    console.log('  Reed: YELLOW — late drug test');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'YELLOW', 'COMP', 'DELAYED_CHECKIN', 'Monitoring check-in delayed — 5 days late', 28, 72, NOW() - INTERVAL '1 day' + INTERVAL '72 hours', $3, NOW() - INTERVAL '1 day', 'O')
    `, [link, reed, today - 1]);
    console.log('  Reed: YELLOW — delayed check-in');

    // ========== #37 Walsh: RED — the escalation case ==========
    const walsh = await getMemberLink(client, '37');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'RED', 'COMPOSITE', 'PPII_RED', 'PPII composite score 83 — acute risk threshold exceeded', 83, 24, NOW() - INTERVAL '4 hours' + INTERVAL '24 hours', $3, NOW() - INTERVAL '4 hours', 'O')
    `, [link, walsh, today]);
    console.log('  Walsh: RED — PPII 83');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'YELLOW', 'COMP', 'MISSED_APPOINTMENT', 'Missed therapy appointment — second occurrence this month', 71, 72, NOW() - INTERVAL '5 days' + INTERVAL '72 hours', $3, NOW() - INTERVAL '5 days', 'O')
    `, [link, walsh, today - 5]);
    console.log('  Walsh: YELLOW — missed appointment');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'ORANGE', 'COMPOSITE', 'PPII_TREND_UP', 'PPII upward trend: +14 over 3 weeks (69 to 76 to 83)', 76, 48, NOW() - INTERVAL '7 days' + INTERVAL '48 hours', $3, NOW() - INTERVAL '7 days', 'O')
    `, [link, walsh, today - 7]);
    console.log('  Walsh: ORANGE — upward trend');

    // ========== #38 Nguyen: SENTINEL — the dramatic case ==========
    const nguyen = await getMemberLink(client, '38');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'SENTINEL', 'COMP', 'SENTINEL_POSITIVE', 'Confirmed positive drug test — GC/MS confirmed. Immediate program review required.', 14, 0, NOW() - INTERVAL '2 hours', $3, NOW() - INTERVAL '2 hours', 'O')
    `, [link, nguyen, today]);
    console.log('  Nguyen: SENTINEL — confirmed positive');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'YELLOW', 'COMP', 'MISSED_CHECKIN', 'Missed monitoring check-in — no contact for 10 days', 14, 72, NOW() - INTERVAL '10 days' + INTERVAL '72 hours', $3, NOW() - INTERVAL '10 days', 'O')
    `, [link, nguyen, today - 10]);
    console.log('  Nguyen: YELLOW — missed check-in');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'ORANGE', 'COMP', 'MONITOR_ESCALATION', 'Monitoring status escalated to elevated review', 14, 48, NOW() - INTERVAL '5 days' + INTERVAL '48 hours', $3, NOW() - INTERVAL '5 days', 'O')
    `, [link, nguyen, today - 5]);
    console.log('  Nguyen: ORANGE — monitoring escalation');

    // ========== #39 Vasquez: GREEN — resolved Yellow (success story) ==========
    const vasquez = await getMemberLink(client, '39');

    // Get a staff user for the assigned_to field
    const staffResult = await client.query(`SELECT user_id FROM platform_user WHERE tenant_id = 5 LIMIT 1`);
    const staffId = staffResult.rows.length ? staffResult.rows[0].user_id : null;

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status, assigned_to, assigned_ts, resolved_ts, resolution_code, resolution_notes)
      VALUES ($1, $2, 5, 'YELLOW', 'PPSI', 'PPSI_ELEVATED', 'PPSI survey score elevated — sleep and burnout domains flagged', 38, 72, NOW() - INTERVAL '14 days' + INTERVAL '72 hours', $3, NOW() - INTERVAL '14 days', 'R', $4, NOW() - INTERVAL '13 days', NOW() - INTERVAL '10 days', 'WORKED', 'Coordinator outreach completed. Physician connected with peer support. Follow-up survey showed improvement. Score returned to Green range.')
    `, [link, vasquez, today - 14, staffId]);
    console.log('  Vasquez: RESOLVED YELLOW — success story');

    // ========== #40 Holmberg: YELLOW — disengagement ==========
    const holmberg = await getMemberLink(client, '40');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'YELLOW', 'COMP', 'REPEATED_MISSED_CHECKINS', 'Third missed monitoring check-in this month — disengagement pattern', 13, 72, NOW() - INTERVAL '2 days' + INTERVAL '72 hours', $3, NOW() - INTERVAL '2 days', 'O')
    `, [link, holmberg, today - 2]);
    console.log('  Holmberg: YELLOW — repeated missed check-ins');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'YELLOW', 'MEDS', 'MISSED_SURVEY', 'No PPSI survey submitted in 12 days — MEDS detection', 13, 72, NOW() - INTERVAL '1 day' + INTERVAL '72 hours', $3, NOW() - INTERVAL '1 day', 'O')
    `, [link, holmberg, today - 1]);
    console.log('  Holmberg: YELLOW — missed survey (MEDS)');

    // ========== #41 Ostrowski: ORANGE — multiple concerns ==========
    const ostrowski = await getMemberLink(client, '41');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'ORANGE', 'COMPOSITE', 'PPII_ORANGE', 'PPII composite score 67 — destabilizing threshold', 67, 48, NOW() - INTERVAL '1 day' + INTERVAL '48 hours', $3, NOW() - INTERVAL '1 day', 'O')
    `, [link, ostrowski, today - 1]);
    console.log('  Ostrowski: ORANGE — PPII 67');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'YELLOW', 'COMP', 'INCONCLUSIVE_DRUG_TEST', 'Drug test result inconclusive — dilute specimen, retest ordered', 58, 72, NOW() - INTERVAL '5 days' + INTERVAL '72 hours', $3, NOW() - INTERVAL '5 days', 'O')
    `, [link, ostrowski, today - 5]);
    console.log('  Ostrowski: YELLOW — inconclusive drug test');

    link = await getLink(client);
    await client.query(`
      INSERT INTO stability_registry (link, member_link, tenant_id, urgency, source_stream, reason_code, reason_text, score_at_creation, sla_hours, sla_deadline, created_date, created_ts, status)
      VALUES ($1, $2, 5, 'YELLOW', 'PULSE', 'PULSE_QUESTION_3', 'Provider Pulse: clinician scored "Significant concern" on mood stability', 58, 72, NOW() - INTERVAL '7 days' + INTERVAL '72 hours', $3, NOW() - INTERVAL '7 days', 'O')
    `, [link, ostrowski, today - 7]);
    console.log('  Ostrowski: YELLOW — Pulse question scored 3');

    console.log('\nDone! 15 registry items seeded.');
    console.log('  Okafor (#34): Green — no items');
    console.log('  Chen (#35): Green — no items');
    console.log('  Reed (#36): 2 open Yellow');
    console.log('  Walsh (#37): 3 open (1 Red, 1 Orange, 1 Yellow)');
    console.log('  Nguyen (#38): 3 open (1 Sentinel, 1 Orange, 1 Yellow)');
    console.log('  Vasquez (#39): 1 resolved Yellow');
    console.log('  Holmberg (#40): 2 open Yellow');
    console.log('  Ostrowski (#41): 3 open (1 Orange, 2 Yellow)');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
