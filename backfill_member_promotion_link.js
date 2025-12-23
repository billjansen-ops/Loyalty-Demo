// Backfill member_promotion.link/p_link and member_promotion_detail.p_link/activity_link
// Run after 008_member_promotion_links.sql

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

/**
 * getNextLink - Get next link value for a table (mirrors server_db_api.js)
 */
async function getNextLink(tenantId, tableKey) {
  // Try to get existing row with lock
  let result = await client.query(`
    SELECT next_link, link_bytes 
    FROM link_tank 
    WHERE tenant_id = $1 AND table_key = $2 
    FOR UPDATE
  `, [tenantId, tableKey]);
  
  if (result.rows.length === 0) {
    // First time - discover link column length
    const schemaResult = await client.query(`
      SELECT character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = 'link'
    `, [tableKey]);
    
    if (schemaResult.rows.length === 0) {
      throw new Error(`Table ${tableKey} has no link column`);
    }
    
    const linkBytes = schemaResult.rows[0].character_maximum_length;
    
    // Insert new row, start at 1
    await client.query(`
      INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
      VALUES ($1, $2, $3, 1)
    `, [tenantId, tableKey, linkBytes]);
    
    // Now get it with lock
    result = await client.query(`
      SELECT next_link, link_bytes 
      FROM link_tank 
      WHERE tenant_id = $1 AND table_key = $2 
      FOR UPDATE
    `, [tenantId, tableKey]);
  }
  
  const { next_link, link_bytes } = result.rows[0];
  
  // Increment counter
  await client.query(`
    UPDATE link_tank 
    SET next_link = next_link + 1 
    WHERE tenant_id = $1 AND table_key = $2
  `, [tenantId, tableKey]);
  
  return squish(next_link, link_bytes);
}

async function backfill() {
  await client.connect();
  console.log('Connected to database');

  try {
    // ============================================
    // PHASE 1: member_promotion
    // ============================================
    console.log('\n=== PHASE 1: member_promotion ===');
    
    // Get all member_promotion rows with their member's link
    const mpResult = await client.query(`
      SELECT mp.member_promotion_id, mp.tenant_id, mp.member_id, m.link as member_link
      FROM member_promotion mp
      JOIN member m ON mp.member_id = m.member_id
      ORDER BY mp.tenant_id, mp.member_promotion_id
    `);

    console.log(`Found ${mpResult.rows.length} member_promotion rows to backfill`);

    // Map old member_promotion_id → new link (for phase 2)
    const mpLinkMap = new Map();

    for (const row of mpResult.rows) {
      // Get new link from link_tank
      const link = await getNextLink(row.tenant_id, 'member_promotion');
      const pLink = row.member_link;

      await client.query(`
        UPDATE member_promotion 
        SET link = $1, p_link = $2 
        WHERE member_promotion_id = $3
      `, [link, pLink, row.member_promotion_id]);

      // Store mapping for phase 2
      mpLinkMap.set(row.member_promotion_id.toString(), link);
    }

    console.log(`member_promotion backfill complete. ${mpLinkMap.size} links assigned.`);

    // ============================================
    // PHASE 2: member_promotion_detail
    // ============================================
    console.log('\n=== PHASE 2: member_promotion_detail ===');
    
    // Get all member_promotion_detail rows with their activity's link
    const mpdResult = await client.query(`
      SELECT mpd.detail_id, mpd.member_promotion_id, mpd.activity_id, a.link as activity_link
      FROM member_promotion_detail mpd
      LEFT JOIN activity a ON mpd.activity_id = a.activity_id
      ORDER BY mpd.detail_id
    `);

    console.log(`Found ${mpdResult.rows.length} member_promotion_detail rows to backfill`);

    let updated = 0;
    let skipped = 0;

    for (const row of mpdResult.rows) {
      // Get p_link from our map
      const pLink = mpLinkMap.get(row.member_promotion_id.toString());
      
      if (!pLink) {
        console.warn(`No link found for member_promotion_id ${row.member_promotion_id}`);
        skipped++;
        continue;
      }

      // activity_link may be null (for enrollment counting rows)
      const activityLink = row.activity_link || null;

      await client.query(`
        UPDATE member_promotion_detail 
        SET p_link = $1, activity_link = $2 
        WHERE detail_id = $3
      `, [pLink, activityLink, row.detail_id]);

      updated++;
    }

    console.log(`member_promotion_detail backfill complete. ${updated} updated, ${skipped} skipped.`);

    // ============================================
    // VERIFY
    // ============================================
    console.log('\n=== VERIFICATION ===');
    
    const verifyMp = await client.query(`
      SELECT member_promotion_id, link, p_link 
      FROM member_promotion 
      ORDER BY member_promotion_id 
      LIMIT 5
    `);
    console.log('\nmember_promotion (first 5):');
    console.table(verifyMp.rows);

    const verifyMpd = await client.query(`
      SELECT detail_id, p_link, activity_link 
      FROM member_promotion_detail 
      ORDER BY detail_id 
      LIMIT 5
    `);
    console.log('\nmember_promotion_detail (first 5):');
    console.table(verifyMpd.rows);

    const linkTank = await client.query(`
      SELECT * FROM link_tank WHERE table_key = 'member_promotion'
    `);
    console.log('\nlink_tank for member_promotion:');
    console.table(linkTank.rows);

  } finally {
    await client.end();
  }
}

backfill().catch(console.error);
