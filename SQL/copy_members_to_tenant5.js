/**
 * copy_members_to_tenant5.js
 * Copies Delta (tenant 1) members into Wisconsin PHP (tenant 5) with fresh links.
 * Run from project root: node sql/copy_members_to_tenant5.js
 */

import pkg from 'pg';
const { Client } = pkg;

function squish(value, bytes) {
  const chars = [];
  let remaining = value;
  for (let i = 0; i < bytes; i++) {
    chars.unshift(String.fromCharCode((remaining % 127) + 1));
    remaining = Math.floor(remaining / 127);
  }
  return chars.join('');
}

async function getNextLink(client, tableKey) {
  const result = await client.query(`
    UPDATE link_tank
    SET next_link = next_link + 1
    WHERE table_key = $1
    RETURNING next_link - 1 AS current_link, link_bytes
  `, [tableKey]);

  if (result.rows.length === 0) {
    const schema = await client.query(`
      SELECT character_maximum_length
      FROM information_schema.columns
      WHERE table_name = $1 AND column_name = 'link'
    `, [tableKey]);
    const linkBytes = schema.rows[0].character_maximum_length;
    await client.query(`
      INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
      VALUES (0, $1, $2, 2)
      ON CONFLICT (tenant_id, table_key) DO UPDATE SET next_link = link_tank.next_link + 1
    `, [tableKey, linkBytes]);
    return squish(1, linkBytes);
  }

  const { current_link, link_bytes } = result.rows[0];
  return squish(Number(current_link), link_bytes);
}

async function main() {
  const client = new Client({ database: 'loyalty' });
  await client.connect();

  try {
    const { rows: members } = await client.query(
      `SELECT fname, lname, middle_initial, address1, address2, city, state, zip, zip_plus4,
              phone, email, is_active, membership_number, enroll_date, active_through_date
       FROM member WHERE tenant_id = 1 ORDER BY link`
    );

    console.log(`Found ${members.length} members in tenant 1. Copying to tenant 5...`);

    let copied = 0;
    let skipped = 0;

    for (const m of members) {
      if (m.email) {
        const exists = await client.query(
          'SELECT 1 FROM member WHERE tenant_id = 5 AND email = $1', [m.email]
        );
        if (exists.rows.length) { skipped++; continue; }
      }

      const link = await getNextLink(client, 'member');
      await client.query(`
        INSERT INTO member (
          tenant_id, fname, lname, middle_initial,
          address1, address2, city, state, zip, zip_plus4,
          phone, email, is_active, membership_number,
          link, enroll_date, active_through_date
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `, [
        5, m.fname, m.lname, m.middle_initial,
        m.address1, m.address2, m.city, m.state, m.zip, m.zip_plus4,
        m.phone, m.email, m.is_active, m.membership_number,
        link, m.enroll_date, m.active_through_date
      ]);
      copied++;
    }

    console.log(`Done. Copied: ${copied}, Skipped (already exist): ${skipped}`);

    const { rows: verify } = await client.query(
      'SELECT COUNT(*) AS count FROM member WHERE tenant_id = 5'
    );
    const { rows: tank } = await client.query(
      `SELECT next_link FROM link_tank WHERE table_key = 'member'`
    );
    console.log(`Tenant 5 member count: ${verify[0].count}`);
    console.log(`Link tank next_link (member): ${tank[0]?.next_link}`);

  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
