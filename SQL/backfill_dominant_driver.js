/**
 * backfill_dominant_driver.js — Populate dominant_driver, dominant_subdomain, protocol_card
 * on existing stability_registry items.
 *
 * Usage: node SQL/backfill_dominant_driver.js
 *
 * For each registry item, uses current stream scores and prior-period scores
 * to identify the dominant driver. Demo data doesn't have precise timestamps,
 * so we use the full activity history for each member.
 */

import pg from 'pg';
import { analyzeDominantDriver } from '../verticals/workforce_monitoring/tenants/wi_php/dominantDriver.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://billjansen@127.0.0.1:5432/loyalty'
});

async function backfill() {
  const client = await pool.connect();

  try {
    // Get all registry items missing dominant_driver
    const items = await client.query(`
      SELECT sr.link, sr.member_link, sr.tenant_id, sr.reason_code
      FROM stability_registry sr
      WHERE sr.dominant_driver IS NULL
      ORDER BY sr.created_ts
    `);

    console.log(`Found ${items.rows.length} registry items to backfill`);

    // Get molecule IDs for wi_php (tenant 5)
    const molIds = await client.query(`
      SELECT molecule_key, molecule_id FROM molecule_def
      WHERE tenant_id = 5 AND molecule_key IN ('MEMBER_SURVEY_LINK', 'MEMBER_POINTS', 'PULSE_RESPONDENT_LINK', 'COMP_RESULT', 'ACCRUAL_TYPE')
    `);
    const mid = {};
    for (const r of molIds.rows) mid[r.molecule_key] = r.molecule_id;

    let updated = 0;

    for (const item of items.rows) {
      const { link, member_link: memberLink, tenant_id: tenantId } = item;

      try {
        // Current: most recent score per stream
        const ppsiCurr = await client.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $4
            AND NOT EXISTS (SELECT 1 FROM "5_data_4" d4b WHERE d4b.p_link = a.link AND d4b.molecule_id = $3)
          ORDER BY a.activity_date DESC LIMIT 1
        `, [mid.MEMBER_SURVEY_LINK, mid.MEMBER_POINTS, mid.PULSE_RESPONDENT_LINK, memberLink]);
        const ppsiRaw = ppsiCurr.rows.length ? Number(ppsiCurr.rows[0].score) : null;

        // Prior: second most recent
        const ppsiPrev = await client.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $4
            AND NOT EXISTS (SELECT 1 FROM "5_data_4" d4b WHERE d4b.p_link = a.link AND d4b.molecule_id = $3)
          ORDER BY a.activity_date DESC LIMIT 1 OFFSET 1
        `, [mid.MEMBER_SURVEY_LINK, mid.MEMBER_POINTS, mid.PULSE_RESPONDENT_LINK, memberLink]);
        const ppsiRawPrior = ppsiPrev.rows.length ? Number(ppsiPrev.rows[0].score) : null;

        const pulseCurr = await client.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $3
          ORDER BY a.activity_date DESC LIMIT 1
        `, [mid.PULSE_RESPONDENT_LINK, mid.MEMBER_POINTS, memberLink]);
        const pulseRaw = pulseCurr.rows.length ? Number(pulseCurr.rows[0].score) : null;

        const pulsePrev = await client.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $3
          ORDER BY a.activity_date DESC LIMIT 1 OFFSET 1
        `, [mid.PULSE_RESPONDENT_LINK, mid.MEMBER_POINTS, memberLink]);
        const pulseRawPrior = pulsePrev.rows.length ? Number(pulsePrev.rows[0].score) : null;

        const compCurr = await client.query(`
          SELECT SUM(sub.score) AS comp_score FROM (
            SELECT COALESCE(d54.n1, 0) AS score
            FROM activity a
            JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
            LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
            WHERE a.activity_type = 'A' AND a.p_link = $3
            ORDER BY a.activity_date DESC LIMIT 6
          ) sub
        `, [mid.COMP_RESULT, mid.MEMBER_POINTS, memberLink]);
        const compRaw = compCurr.rows.length && compCurr.rows[0].comp_score !== null
          ? Number(compCurr.rows[0].comp_score) : null;

        const compPrev = await client.query(`
          SELECT SUM(sub.score) AS comp_score FROM (
            SELECT COALESCE(d54.n1, 0) AS score
            FROM activity a
            JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
            LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
            WHERE a.activity_type = 'A' AND a.p_link = $3
            ORDER BY a.activity_date DESC LIMIT 6 OFFSET 6
          ) sub
        `, [mid.COMP_RESULT, mid.MEMBER_POINTS, memberLink]);
        const compRawPrior = compPrev.rows.length && compPrev.rows[0].comp_score !== null
          ? Number(compPrev.rows[0].comp_score) : null;

        const eventCurr = await client.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_1" d1 ON d1.p_link = a.link AND d1.molecule_id = $1
          JOIN molecule_value_embedded_list mvel ON mvel.molecule_id = d1.molecule_id AND mvel.link = d1.c1 AND mvel.code = 'EVENT'
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $3
          ORDER BY a.activity_date DESC LIMIT 1
        `, [mid.ACCRUAL_TYPE, mid.MEMBER_POINTS, memberLink]);
        const eventRaw = eventCurr.rows.length ? Number(eventCurr.rows[0].score) : null;

        const eventPrev = await client.query(`
          SELECT COALESCE(d54.n1, 0) AS score
          FROM activity a
          JOIN "5_data_1" d1 ON d1.p_link = a.link AND d1.molecule_id = $1
          JOIN molecule_value_embedded_list mvel ON mvel.molecule_id = d1.molecule_id AND mvel.link = d1.c1 AND mvel.code = 'EVENT'
          LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
          WHERE a.activity_type = 'A' AND a.p_link = $3
          ORDER BY a.activity_date DESC LIMIT 1 OFFSET 1
        `, [mid.ACCRUAL_TYPE, mid.MEMBER_POINTS, memberLink]);
        const eventRawPrior = eventPrev.rows.length ? Number(eventPrev.rows[0].score) : null;

        // Run driver analysis
        const result = await analyzeDominantDriver(
          client, memberLink, tenantId,
          { ppsiRaw, pulseRaw, compRaw, eventRaw },
          { ppsiRaw: ppsiRawPrior, pulseRaw: pulseRawPrior, compRaw: compRawPrior, eventRaw: eventRawPrior }
        );

        if (result.dominant_driver) {
          await client.query(`
            UPDATE stability_registry
            SET dominant_driver = $1, dominant_subdomain = $2, protocol_card = $3,
                source_stream = COALESCE($1, source_stream)
            WHERE link = $4
          `, [result.dominant_driver, result.dominant_subdomain, result.protocol_card, link]);

          updated++;
          console.log(`  ✅ link=${link}: ${result.dominant_driver}${result.dominant_subdomain ? '/' + result.dominant_subdomain : ''} → ${result.protocol_card}`);
        } else {
          console.log(`  ⚠️ link=${link}: no driver identified (insufficient data)`);
        }

      } catch (err) {
        console.error(`  ❌ link=${link}: ${err.message}`);
      }
    }

    console.log(`\nDone. Updated ${updated} of ${items.rows.length} registry items.`);

  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
