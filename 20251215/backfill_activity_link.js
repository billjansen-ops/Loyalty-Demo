// Backfill activity.link and activity.p_link
// Run after 003_activity_link.sql

import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '127.0.0.1',
  user: 'billjansen',
  database: 'loyalty'
});

function squish(value, bytes) {
  const chars = [];
  let remaining = value;
  for (let i = 0; i < bytes; i++) {
    chars.unshift(String.fromCharCode((remaining % 127) + 1));
    remaining = Math.floor(remaining / 127);
  }
  return chars.join('');
}

async function backfill() {
  await client.connect();
  console.log('Connected to database');

  try {
    // Get all activities with their member's link
    const result = await client.query(`
      SELECT a.activity_id, m.tenant_id, a.member_id, m.link as member_link
      FROM activity a
      JOIN member m ON a.member_id = m.member_id
      ORDER BY m.tenant_id, a.activity_id
    `);

    console.log(`Found ${result.rows.length} activities to backfill`);

    // Track max activity_id per tenant for link_tank
    const maxByTenant = {};

    for (const row of result.rows) {
      const activityLink = squish(row.activity_id, 5);
      const pLink = row.member_link;

      await client.query(`
        UPDATE activity 
        SET link = $1, p_link = $2 
        WHERE activity_id = $3
      `, [activityLink, pLink, row.activity_id]);

      // Track max per tenant
      const tenantId = row.tenant_id;
      const activityId = parseInt(row.activity_id, 10);
      if (!maxByTenant[tenantId] || activityId > maxByTenant[tenantId]) {
        maxByTenant[tenantId] = activityId;
      }
    }

    console.log('Backfill complete');
    console.log('Max activity_id by tenant:', maxByTenant);

    // Prime link_tank for each tenant
    for (const [tenantId, maxId] of Object.entries(maxByTenant)) {
      const nextLink = maxId + 1;
      
      // Check if row exists
      const existing = await client.query(`
        SELECT * FROM link_tank WHERE tenant_id = $1 AND table_key = 'activity'
      `, [tenantId]);

      if (existing.rows.length > 0) {
        await client.query(`
          UPDATE link_tank SET next_link = $1, link_bytes = 5
          WHERE tenant_id = $2 AND table_key = 'activity'
        `, [nextLink, tenantId]);
        console.log(`Updated link_tank for tenant ${tenantId}: next_link = ${nextLink}`);
      } else {
        await client.query(`
          INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
          VALUES ($1, 'activity', 5, $2)
        `, [tenantId, nextLink]);
        console.log(`Inserted link_tank for tenant ${tenantId}: next_link = ${nextLink}`);
      }
    }

    // Verify
    const verify = await client.query(`
      SELECT activity_id, link, p_link 
      FROM activity 
      ORDER BY activity_id 
      LIMIT 10
    `);
    console.log('\nFirst 10 activities:');
    console.log(verify.rows);

  } finally {
    await client.end();
  }
}

backfill().catch(console.error);
