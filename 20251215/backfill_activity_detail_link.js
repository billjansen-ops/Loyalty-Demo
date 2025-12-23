// Backfill activity_detail.p_link
// Run after 004_activity_detail_link.sql

import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '127.0.0.1',
  user: 'billjansen',
  database: 'loyalty'
});

async function backfill() {
  await client.connect();
  console.log('Connected to database');

  try {
    // Update all activity_detail rows with their parent activity's link
    const result = await client.query(`
      UPDATE activity_detail ad
      SET p_link = a.link
      FROM activity a
      WHERE ad.activity_id = a.activity_id
    `);

    console.log(`Updated ${result.rowCount} activity_detail rows`);

    // Verify
    const verify = await client.query(`
      SELECT activity_id, molecule_id, p_link 
      FROM activity_detail 
      ORDER BY activity_id, molecule_id 
      LIMIT 10
    `);
    console.log('\nFirst 10 activity_detail rows:');
    console.log(verify.rows);

  } finally {
    await client.end();
  }
}

backfill().catch(console.error);
