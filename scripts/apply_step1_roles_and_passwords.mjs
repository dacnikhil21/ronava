import pg from 'pg';
import { hashPassword } from '../server/security.js';
import { TEST_PASSWORD } from '../server/test_config.js';

async function run() {
  const pool = new pg.Pool({
    connectionString: 'postgres://postgres:postgres@localhost:5432/ronav_test_db'
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update roles by position in chain without changing any ids, rates or ledger rows
    await client.query(`UPDATE users SET role = 'MASTER' WHERE id = 'MST1002'`);
    await client.query(`UPDATE users SET role = 'MASTER' WHERE id = 'MST1001'`);
    await client.query(`UPDATE users SET role = 'DISTRICT_DISTRIBUTOR' WHERE id = 'DD1001'`);
    await client.query(`UPDATE users SET role = 'DISTRIBUTOR' WHERE id = 'DIST1001'`);
    await client.query(`UPDATE users SET role = 'SUPER_DISTRIBUTOR' WHERE id = 'SD1001'`);
    await client.query(`UPDATE users SET role = 'MERCHANT' WHERE id = 'MID1001'`);

    // 2. Set password to Ronav@123 for all test accounts
    const hashed = hashPassword(TEST_PASSWORD);
    const testAccounts = ['ADM001', 'MST1002', 'MST1001', 'SD1001', 'DD1001', 'DIST1001', 'MID1001'];
    for (const uid of testAccounts) {
      await client.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashed, uid]);
    }

    // 3. Ensure beneficiaries has verified account for MID1001
    await client.query(`
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
      VALUES ('BEN-MID1001-TEST', 'MID1001', 'State Bank of India', '12345678901', 'SBIN0001234', 'D Nik', true, true)
      ON CONFLICT (id) DO UPDATE SET is_verified = true, is_primary = true
    `);

    await client.query('COMMIT');
    console.log('✓ Successfully applied roles and verified setup on ronav_test_db!');

    const res = await client.query('SELECT id, name, role FROM users ORDER BY id');
    console.log('Current users:', res.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error applying setup:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
