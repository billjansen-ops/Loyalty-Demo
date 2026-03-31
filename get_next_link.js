/**
 * get_next_link.js — Shared link allocation function
 *
 * Used by pointers.js and db_migrate.js (and any future caller).
 * Allocates the next link value from link_tank atomically.
 *
 * RULE: NEVER allocate links with raw SQL. Always use this function.
 */

/**
 * squish - Convert number to base-127 encoded string (local copy for independence)
 */
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
 * getNextLink - Get next link value for a table (atomic, self-maintaining)
 * @param {object} client - Database client (pg Client or Pool)
 * @param {number} tenantId - Tenant ID
 * @param {string} tableKey - Table name (e.g., 'member', 'activity')
 * @returns {Promise<string|number>} - Link value (squished string for CHAR, raw number for SMALLINT/INTEGER/BIGINT)
 *
 * HYBRID APPROACH:
 * - member_number: per-tenant (uses tenant_id column in WHERE)
 * - everything else: global (ignores tenant_id)
 *
 * On first call for a table_key:
 *   1. Queries information_schema for link column length
 *   2. Inserts row into link_tank with proper initial value
 */
export async function getNextLink(client, tenantId, tableKey) {
  // Try atomic increment first
  let result;
  if (tableKey === 'member_number') {
    result = await client.query(`
      UPDATE link_tank
      SET next_link = next_link + 1
      WHERE table_key = $1 AND tenant_id = $2
      RETURNING next_link - 1 as current_link, link_bytes
    `, [tableKey, tenantId]);
  } else {
    result = await client.query(`
      UPDATE link_tank
      SET next_link = next_link + 1
      WHERE table_key = $1
      RETURNING next_link - 1 as current_link, link_bytes
    `, [tableKey]);
  }

  if (result.rows.length === 0) {
    // First time for this key - discover link column type/length
    let linkBytes;

    if (tableKey === 'member_number') {
      // member_number is always 8-byte BIGINT (raw counter)
      linkBytes = 8;
    } else {
      // Discover from schema
      const schemaResult = await client.query(`
        SELECT data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'link'
      `, [tableKey]);

      if (schemaResult.rows.length === 0) {
        throw new Error(`Table ${tableKey} has no link column`);
      }

      const { data_type, character_maximum_length } = schemaResult.rows[0];

      if (data_type === 'smallint') {
        linkBytes = 2;
      } else if (data_type === 'integer') {
        linkBytes = 4;
      } else if (data_type === 'character') {
        linkBytes = character_maximum_length;
      } else {
        throw new Error(`Unsupported link column type: ${data_type}`);
      }
    }

    // Insert new row with proper initial value based on link type
    // For 2/4 byte numeric: prime with offset so first link is the minimum value
    // For 1/3/5 byte CHAR: start at 1
    let initialNextLink, firstLink;

    if (linkBytes === 2) {
      // SMALLINT: first link is -32768, next_link starts at -32767
      initialNextLink = -32767;
      firstLink = -32768;
    } else if (linkBytes === 4) {
      // INTEGER: first link is -2147483648, next_link starts at -2147483647
      initialNextLink = -2147483647;
      firstLink = -2147483648;
    } else if (linkBytes === 8) {
      // BIGINT: raw counter starting at 1
      initialNextLink = 2;
      firstLink = 1;
    } else {
      // CHAR(1,3,5): squished, start at 1
      initialNextLink = 2;
      firstLink = 1;
    }

    try {
      // member_number: use actual tenant_id; everything else: use 0
      const insertTenantId = (tableKey === 'member_number') ? tenantId : 0;
      await client.query(`
        INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
        VALUES ($1, $2, $3, $4)
      `, [insertTenantId, tableKey, linkBytes, initialNextLink]);

      // Return first link value
      if (linkBytes === 8) return firstLink;
      if (linkBytes === 2 || linkBytes === 4) return firstLink;
      return squish(firstLink, linkBytes);

    } catch (insertErr) {
      // Race condition - another caller inserted, retry the update
      if (tableKey === 'member_number') {
        result = await client.query(`
          UPDATE link_tank
          SET next_link = next_link + 1
          WHERE table_key = $1 AND tenant_id = $2
          RETURNING next_link - 1 as current_link, link_bytes
        `, [tableKey, tenantId]);
      } else {
        result = await client.query(`
          UPDATE link_tank
          SET next_link = next_link + 1
          WHERE table_key = $1
          RETURNING next_link - 1 as current_link, link_bytes
        `, [tableKey]);
      }
    }
  }

  const { current_link, link_bytes } = result.rows[0];

  // Return value based on link_bytes
  if (link_bytes === 8) {
    return current_link;  // Raw BIGINT counter
  }
  if (link_bytes === 2 || link_bytes === 4) {
    return current_link;  // Return raw number
  }
  return squish(current_link, link_bytes);
}

