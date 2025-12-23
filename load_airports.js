import fs from 'fs';
import pg from 'pg';

// Parse DMS format like "44.52.8N" or "093.13.0W" to decimal degrees
function parseCoord(coord) {
  if (!coord || coord.trim() === '') return null;
  
  const match = coord.match(/^(\d+)\.(\d+)\.(\d+\.?\d*)([NSEW])$/);
  if (!match) return null;
  
  const degrees = parseInt(match[1]);
  const minutes = parseFloat(match[2] + '.' + match[3]);
  const direction = match[4];
  
  let decimal = degrees + minutes / 60;
  
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  
  return parseFloat(decimal.toFixed(6));
}

// Proper case: "MINNEAPOLIS-ST PAUL INTL" -> "Minneapolis-St Paul Intl"
function properCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/(?:^|[\s\-\/])(\w)/g, (match, letter) => {
    return match.slice(0, -1) + letter.toUpperCase();
  });
}

// Extract country from RES field like "MINNEAPOLIS ST PL, MN" or "ZURICH, SWITZERLAND"
function parseLocation(res) {
  if (!res) return { city: null, country: null };
  
  const parts = res.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const city = properCase(parts[0]);
    const region = properCase(parts[1]);
    // US states are 2 letters
    if (region.length === 2) {
      return { city, country: 'USA' };
    }
    return { city, country: region };
  }
  return { city: properCase(res), country: null };
}

async function loadAirports() {
  const filePath = process.argv[2] || 'CITIES.TXT';
  
  const client = new pg.Client({
    host: '127.0.0.1',
    user: 'billjansen',
    database: 'loyalty'
  });
  
  await client.connect();
  console.log('Connected to database');
  
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n');
  
  let loaded = 0;
  let skipped = 0;
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim().replace(/\r/g, '');
    if (!line) continue;
    
    const parts = line.split('~');
    if (parts.length < 7) continue;
    
    const code = parts[0];
    const name = parts[4];
    const latStr = parts[5];
    const longStr = parts[6];
    
    // Skip if no name or no coordinates
    if (!name || name === '' || latStr === '' || longStr === '') {
      skipped++;
      continue;
    }
    
    const lat = parseCoord(latStr);
    const lng = parseCoord(longStr);
    
    // Skip if coordinates didn't parse
    if (lat === null || lng === null) {
      skipped++;
      continue;
    }
    
    const { city, country } = parseLocation(parts[2]);
    const properName = properCase(name);
    
    try {
      await client.query(
        `INSERT INTO airports (code, name, city, country, lat, long, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (code) DO NOTHING`,
        [code, properName, city, country, lat, lng]
      );
      loaded++;
    } catch (err) {
      console.error(`Error inserting ${code}:`, err.message);
    }
  }
  
  console.log(`Loaded: ${loaded} airports`);
  console.log(`Skipped: ${skipped} (no coordinates)`);
  
  // Verify a few
  const result = await client.query("SELECT code, name, lat, long FROM airports WHERE code IN ('MSP', 'LGA', 'LAX', 'JFK', 'ORD') ORDER BY code");
  console.log('\nSample airports:');
  for (const row of result.rows) {
    console.log(`  ${row.code}: ${row.name} (${row.lat}, ${row.long})`);
  }
  
  await client.end();
}

loadAirports().catch(console.error);
