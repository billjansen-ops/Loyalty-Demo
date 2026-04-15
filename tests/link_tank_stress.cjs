#!/usr/bin/env node
/**
 * Link Tank Stress Test
 *
 * Hammers getNextLink as fast as possible to measure pure link_tank throughput.
 * Each worker gets its own pg.Client connection and loops:
 *   UPDATE link_tank SET next_link = next_link + 1 WHERE table_key = 'member'
 *   RETURNING next_link - 1 as link, link_bytes
 * Then squishes the result into a 5-byte base-127 encoded string.
 *
 * Tests both single-link and batch modes.
 *
 * Usage: node tests/link_tank_stress.cjs [workers] [seconds]
 *   Default: 8 workers, 10 seconds per mode
 */

const { Client } = require('pg');

const WORKERS = parseInt(process.argv[2]) || 8;
const DURATION_SEC = parseInt(process.argv[3]) || 10;
const TABLE_KEY = 'member';
const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyaltybig',
  port: parseInt(process.env.PGPORT) || 5432
};

function squish(value, bytes) {
  const chars = [];
  let remaining = value;
  for (let i = 0; i < bytes; i++) {
    chars.unshift(String.fromCharCode((remaining % 127) + 1));
    remaining = Math.floor(remaining / 127);
  }
  return chars.join('');
}

async function runSingleMode(workers, durationMs) {
  const counts = new Array(workers.length).fill(0);
  let running = true;

  const workerFn = async (client, idx) => {
    while (running) {
      const result = await client.query(
        `UPDATE link_tank SET next_link = next_link + 1 WHERE table_key = $1 AND tenant_id = $2 RETURNING next_link - 1 as link, link_bytes`,
        [TABLE_KEY, 1]
      );
      if (!result.rows.length) { counts[idx]++; continue; }
      const linkNum = Number(result.rows[0].link);
      const linkBytes = result.rows[0].link_bytes;
      const encoded = squish(linkNum, linkBytes);
      counts[idx]++;
    }
  };

  const promises = workers.map((client, idx) => workerFn(client, idx));
  await new Promise(r => setTimeout(r, durationMs));
  running = false;
  await Promise.allSettled(promises);

  return counts;
}

async function runBatchMode(workers, durationMs, batchSize) {
  const counts = new Array(workers.length).fill(0);
  let running = true;

  const workerFn = async (client, idx) => {
    while (running) {
      const result = await client.query(
        `UPDATE link_tank SET next_link = next_link + ${batchSize} WHERE table_key = $1 AND tenant_id = $2 RETURNING next_link - ${batchSize} as start_link, link_bytes`,
        [TABLE_KEY, 1]
      );
      const startLink = Number(result.rows[0].start_link);
      const linkBytes = result.rows[0].link_bytes;
      // Squish all links in the batch
      for (let i = 0; i < batchSize; i++) {
        const encoded = squish(startLink + i, linkBytes);
        counts[idx]++;
      }
    }
  };

  const promises = workers.map((client, idx) => workerFn(client, idx));
  await new Promise(r => setTimeout(r, durationMs));
  running = false;
  await Promise.allSettled(promises);

  return counts;
}

async function main() {
  console.log(`\n🔗 Link Tank Stress Test`);
  console.log(`   Workers: ${WORKERS}`);
  console.log(`   Duration: ${DURATION_SEC}s per mode`);
  console.log(`   Database: ${DB_CONFIG.database}`);
  console.log(`   Table key: ${TABLE_KEY}\n`);

  // Connect workers
  const clients = [];
  for (let i = 0; i < WORKERS; i++) {
    const client = new Client(DB_CONFIG);
    await client.connect();
    clients.push(client);
  }
  console.log(`   ✅ ${WORKERS} worker connections established\n`);

  // Get starting link value
  const startResult = await clients[0].query(
    `SELECT next_link FROM link_tank WHERE table_key = $1 LIMIT 1`, [TABLE_KEY]
  );
  const startLink = Number(startResult.rows[0].next_link);

  // === Single mode ===
  console.log(`── Single Link Mode (1 link per round-trip) ──`);
  const singleCounts = await runSingleMode(clients, DURATION_SEC * 1000);
  const singleTotal = singleCounts.reduce((a, b) => a + b, 0);
  const singleRate = Math.round(singleTotal / DURATION_SEC);
  console.log(`   Total: ${singleTotal.toLocaleString()} links in ${DURATION_SEC}s`);
  console.log(`   Rate:  ${singleRate.toLocaleString()} links/sec`);
  console.log(`   Per worker: ${singleCounts.map(c => c.toLocaleString()).join(', ')}`);

  // === Batch mode (100) ===
  console.log(`\n── Batch Mode (100 links per round-trip) ──`);
  const batch100Counts = await runBatchMode(clients, DURATION_SEC * 1000, 100);
  const batch100Total = batch100Counts.reduce((a, b) => a + b, 0);
  const batch100Rate = Math.round(batch100Total / DURATION_SEC);
  console.log(`   Total: ${batch100Total.toLocaleString()} links in ${DURATION_SEC}s`);
  console.log(`   Rate:  ${batch100Rate.toLocaleString()} links/sec`);
  console.log(`   Per worker: ${batch100Counts.map(c => c.toLocaleString()).join(', ')}`);

  // === Batch mode (1000) ===
  console.log(`\n── Batch Mode (1000 links per round-trip) ──`);
  const batch1000Counts = await runBatchMode(clients, DURATION_SEC * 1000, 1000);
  const batch1000Total = batch1000Counts.reduce((a, b) => a + b, 0);
  const batch1000Rate = Math.round(batch1000Total / DURATION_SEC);
  console.log(`   Total: ${batch1000Total.toLocaleString()} links in ${DURATION_SEC}s`);
  console.log(`   Rate:  ${batch1000Rate.toLocaleString()} links/sec`);
  console.log(`   Per worker: ${batch1000Counts.map(c => c.toLocaleString()).join(', ')}`);

  // Get ending link value
  const endResult = await clients[0].query(
    `SELECT next_link FROM link_tank WHERE table_key = $1 LIMIT 1`, [TABLE_KEY]
  );
  const endLink = Number(endResult.rows[0].next_link);
  const linksConsumed = endLink - startLink;

  // Summary
  console.log(`\n── Summary ──`);
  console.log(`   Single:     ${singleRate.toLocaleString()} links/sec`);
  console.log(`   Batch 100:  ${batch100Rate.toLocaleString()} links/sec  (${Math.round(batch100Rate / singleRate)}x)`);
  console.log(`   Batch 1000: ${batch1000Rate.toLocaleString()} links/sec  (${Math.round(batch1000Rate / singleRate)}x)`);
  console.log(`   Links consumed: ${linksConsumed.toLocaleString()} (counter advanced from ${startLink.toLocaleString()} to ${endLink.toLocaleString()})`);

  // Cleanup
  for (const client of clients) {
    await client.end();
  }
  console.log(`\n   ✅ Done\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
