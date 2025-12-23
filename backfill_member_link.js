// Backfill member.link with squished member_id values
// Run AFTER 001_link_tank.sql

import pg from 'pg';
const { Client } = pg;

// squish - Convert number to base-127 encoded string (big-endian)
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
  const client = new Client({
    host: '127.0.0.1',
    database: 'loyalty',
    user: 'billjansen'
  });

  await client.connect();
  console.log('Connected to database\n');

  // Get all members that need backfill
  const members = await client.query(`
    SELECT member_id, tenant_id FROM member WHERE link IS NULL ORDER BY member_id
  `);
  
  console.log(`Found ${members.rows.length} members to backfill`);

  // Update each member
  let count = 0;
  for (const row of members.rows) {
    const link = squish(row.member_id, 5);
    await client.query(`UPDATE member SET link = $1 WHERE member_id = $2`, [link, row.member_id]);
    count++;
    if (count % 1000 === 0) {
      console.log(`  Updated ${count} members...`);
    }
  }
  console.log(`Updated ${count} members\n`);

  // Get MAX member_id per tenant and prime link_tank
  const tenants = await client.query(`
    SELECT tenant_id, COALESCE(MAX(member_id), 0) as max_id 
    FROM member 
    GROUP BY tenant_id
  `);

  for (const row of tenants.rows) {
    const tenantId = row.tenant_id;
    const maxId = parseInt(row.max_id, 10);
    const nextLink = maxId + 1;

    await client.query(`
      INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
      VALUES ($1, 'member', 5, $2)
      ON CONFLICT (tenant_id, table_key) DO UPDATE SET next_link = EXCLUDED.next_link
    `, [tenantId, nextLink]);
    
    console.log(`Primed link_tank: tenant ${tenantId} member next_link = ${nextLink}`);
  }

  // Verify
  const verify = await client.query(`
    SELECT COUNT(*) as total, COUNT(link) as with_link FROM member
  `);
  console.log(`\nVerification: ${verify.rows[0].with_link} of ${verify.rows[0].total} members have link`);

  await client.end();
  console.log('\nBackfill complete');
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
