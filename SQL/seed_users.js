// Seed initial platform users with proper bcrypt hashes
// Run: node database/seed_users.js

import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

const pool = new Pool({
  host: '127.0.0.1',
  user: 'billjansen',
  database: 'loyalty',
  port: 5432
});

const BCRYPT_ROUNDS = 10;

const seedUsers = [
  { username: 'Bill', password: 'Billy', display_name: 'Bill', tenant_id: null, role: 'superuser' },
  { username: 'DeltaCSR', password: 'DeltaCSR', display_name: 'Delta CSR', tenant_id: 1, role: 'csr' },
  { username: 'DeltaADMIN', password: 'DeltaADMIN', display_name: 'Delta Admin', tenant_id: 1, role: 'admin' }
];

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('Seeding platform users...\n');
    
    for (const user of seedUsers) {
      // Check if user exists
      const existing = await client.query(
        'SELECT user_id FROM platform_user WHERE username = $1',
        [user.username]
      );
      
      if (existing.rows.length > 0) {
        console.log(`  ⏭️  ${user.username} already exists, skipping`);
        continue;
      }
      
      // Hash password
      const hash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
      
      // Insert user
      await client.query(`
        INSERT INTO platform_user (username, password_hash, display_name, tenant_id, role)
        VALUES ($1, $2, $3, $4, $5)
      `, [user.username, hash, user.display_name, user.tenant_id, user.role]);
      
      console.log(`  ✅ Created ${user.username} (${user.role})`);
    }
    
    console.log('\nDone!');
    
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
