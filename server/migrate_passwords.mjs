// server/migrate_passwords.mjs
// One-time and runtime migration to ensure NO plain-text passwords remain in the PostgreSQL database.
import pg from 'pg';
import { hashPassword } from './security.js';

const connectionString = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
const { Pool } = pg;
const pool = new Pool({ connectionString, ssl: false });

export async function migrateAllPasswordsToHashes() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`SELECT id, password FROM users`);
    let migratedCount = 0;
    for (const row of res.rows) {
      const currentPass = (row.password || '').trim();
      if (currentPass && !currentPass.startsWith('scrypt:')) {
        const hashed = hashPassword(currentPass);
        await client.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashed, row.id]);
        migratedCount++;
      }
    }
    await client.query('COMMIT');
    console.log(`[Password Migration] Successfully verified/migrated ${migratedCount} passwords to scrypt hashes.`);
    return migratedCount;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Password Migration] Error migrating passwords:', err);
    throw err;
  } finally {
    client.release();
  }
}

// If executed directly
if (process.argv[1] && process.argv[1].endsWith('migrate_passwords.mjs')) {
  migrateAllPasswordsToHashes()
    .then((c) => {
      console.log(`Done. ${c} passwords migrated.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
