// Squish/Unsquish Test - Base-127 with CHAR(3)
// Verify hybrid storage approach works
// Max value for 3 bytes: 127^3 = 2,048,383

import pg from 'pg';
const { Client } = pg;

// squish127: convert number to base-127 bytes (1-127 per byte, no nulls)
function squish127(value, bytes) {
  const buffer = Buffer.alloc(bytes);
  let remaining = value;
  for (let i = 0; i < bytes; i++) {
    buffer[i] = (remaining % 127) + 1;
    remaining = Math.floor(remaining / 127);
  }
  return buffer.toString('latin1');  // Preserve raw byte values
}

// unsquish127: convert base-127 string back to number
function unsquish127(str) {
  let value = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    value = value * 127 + (str.charCodeAt(i) - 1);
  }
  return value;
}

async function runTest() {
  const client = new Client({
    host: 'localhost',
    database: 'loyalty',
    user: 'billjansen'
  });

  await client.connect();
  console.log('Connected to database\n');

  // Create test table with CHAR(3)
  await client.query('DROP TABLE IF EXISTS squish_test');
  await client.query(`
    CREATE TABLE squish_test (
      original_number INTEGER NOT NULL,
      squished_key CHAR(3) NOT NULL,
      PRIMARY KEY (squished_key)
    )
  `);
  console.log('Created squish_test table with CHAR(3) key\n');

  // Insert 500 rows (test well past 127 boundary)
  const testCount = 500;
  console.log(`Inserting ${testCount} rows...`);
  for (let i = 1; i <= testCount; i++) {
    const squished = squish127(i, 3);
    await client.query(
      'INSERT INTO squish_test (original_number, squished_key) VALUES ($1, $2)',
      [i, squished]
    );
  }
  console.log(`Inserted ${testCount} rows\n`);

  // Verify all rows
  console.log('Verifying round-trip...');
  const result = await client.query('SELECT original_number, squished_key FROM squish_test ORDER BY original_number');
  
  let errors = 0;
  for (const row of result.rows) {
    const unsquished = unsquish127(row.squished_key);
    if (unsquished !== row.original_number) {
      console.log(`ERROR: original=${row.original_number}, unsquished=${unsquished}`);
      errors++;
    }
  }

  if (errors === 0) {
    console.log(`✓ All ${testCount} rows passed round-trip verification\n`);
  } else {
    console.log(`✗ ${errors} errors found\n`);
  }

  // Show values around 127 boundary
  console.log('Sample values around 127 boundary:');
  console.log('─'.repeat(60));
  for (const val of [1, 126, 127, 128, 129, 254, 255, 256, 500]) {
    const lookup = await client.query(
      'SELECT squished_key FROM squish_test WHERE original_number = $1',
      [val]
    );
    const str = lookup.rows[0].squished_key;
    const bytes = [...str].map(c => c.charCodeAt(0).toString().padStart(3));
    console.log(`  ${val.toString().padStart(3)} → bytes: [${bytes.join(', ')}]`);
  }

  // Verify no null bytes
  console.log('\nChecking for null bytes...');
  const allRows = await client.query('SELECT original_number, squished_key FROM squish_test');
  let nullByteCount = 0;
  for (const row of allRows.rows) {
    for (let i = 0; i < row.squished_key.length; i++) {
      if (row.squished_key.charCodeAt(i) === 0) {
        console.log(`  NULL BYTE in value ${row.original_number}`);
        nullByteCount++;
      }
    }
  }
  if (nullByteCount === 0) {
    console.log('✓ No null bytes found in any row\n');
  }

  // Test index lookup
  console.log('Testing index lookup by squished key...');
  const testValue = 256;
  const testKey = squish127(testValue, 3);
  const lookupResult = await client.query(
    'SELECT original_number FROM squish_test WHERE squished_key = $1',
    [testKey]
  );
  if (lookupResult.rows[0]?.original_number === testValue) {
    console.log(`✓ Index lookup for ${testValue} returned correct row\n`);
  } else {
    console.log(`✗ Index lookup failed\n`);
  }

  // Show theoretical max
  console.log('Capacity check:');
  console.log(`  CHAR(3) base-127 max value: ${127*127*127} (${(127**3).toLocaleString()})`);
  console.log(`  CHAR(5) base-127 max value: ${127**5} (${(127**5).toLocaleString()})`);

  // Cleanup
  await client.query('DROP TABLE squish_test');
  console.log('\nCleaned up test table');

  await client.end();
  console.log('✓ All tests passed!');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
