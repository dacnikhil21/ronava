import 'dotenv/config';
import { db } from './server/db.js';
import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

console.log('🧹 Starting Purge of All Test Cases in Hierarchy...\n');

// 1. SQLite Cleanup
try {
  const testIds = ['SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008'];
  const testUsers = db.prepare(`
    SELECT id, name, role FROM users 
    WHERE LOWER(name) LIKE '%test%' 
       OR LOWER(id) LIKE '%test%'
       OR id IN ('SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008')
  `).all();

  const allTestIds = Array.from(new Set([...testIds, ...testUsers.map(u => u.id)]));
  console.log(`Found ${allTestIds.length} test accounts in SQLite database:`, allTestIds);

  if (allTestIds.length > 0) {
    const placeholders = allTestIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM transactions WHERE merchant_id IN (${placeholders}) OR notes LIKE '%test%'`).run(...allTestIds);
    db.prepare(`DELETE FROM wallets WHERE user_id IN (${placeholders})`).run(...allTestIds);
    db.prepare(`DELETE FROM merchant_pos WHERE merchant_id IN (${placeholders})`).run(...allTestIds);
    db.prepare(`DELETE FROM withdrawals WHERE merchant_id IN (${placeholders})`).run(...allTestIds);
    db.prepare(`DELETE FROM beneficiaries WHERE merchant_id IN (${placeholders})`).run(...allTestIds);
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...allTestIds);
    console.log('✓ SQLite test data deleted successfully.');
  }
} catch (e) {
  console.warn('SQLite cleanup warning:', e.message);
}

// 2. PostgreSQL Cleanup
if (databaseUrl) {
  try {
    const pool = new Pool({ connectionString: databaseUrl, ssl: false });
    const client = await pool.connect();
    console.log('Connected to PostgreSQL (ronav_db)...');

    const delRes = await client.query(`
      DELETE FROM transactions WHERE merchant_id IN ('SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008') OR merchant_id ILIKE '%test%' OR notes ILIKE '%test%';
      DELETE FROM wallets WHERE user_id IN ('SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008') OR user_id ILIKE '%test%';
      DELETE FROM merchant_pos WHERE merchant_id IN ('SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008') OR merchant_id ILIKE '%test%';
      DELETE FROM withdrawals WHERE merchant_id IN ('SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008') OR merchant_id ILIKE '%test%';
      DELETE FROM beneficiaries WHERE merchant_id IN ('SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008') OR merchant_id ILIKE '%test%';
      DELETE FROM users WHERE id IN ('SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008') OR name ILIKE '%test%' OR id ILIKE '%test%';
    `);
    client.release();
    await pool.end();
    console.log('✓ PostgreSQL test data deleted successfully.');
  } catch (e) {
    console.warn('PostgreSQL cleanup warning:', e.message);
  }
}

console.log('\n✨ All test cases in hierarchy purged successfully!');
