import 'dotenv/config';
import { getDbPool } from '../server/pg_db.js';
import { assertSystemConsistency } from '../server/consistency_checker.js';

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

async function wipeMoneyAndTransactionsSafely() {
  console.log('--- SAFE TRANSACTION & MONEY DATA WIPE ---');
  console.log('Target Database:', process.env.TEST_DATABASE_URL);

  // Strict Safety Check: Never run on production
  if (!process.env.TEST_DATABASE_URL.includes('ronav_test_db') && !process.env.TEST_DATABASE_URL.includes('localhost')) {
    throw new Error('SAFETY_ABORT: Target is NOT local test database! Aborting.');
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Wipe only transaction activity and ledger history
    console.log('1. Clearing financial_ledger, transactions, and withdrawals...');
    await client.query(`
      TRUNCATE TABLE financial_ledger, transactions, withdrawals RESTART IDENTITY CASCADE;
    `);

    // 2. Reset all user wallets to clean zero
    console.log('2. Resetting all user wallets to clean 0 balance & 0 holds...');
    await client.query(`
      UPDATE wallets 
      SET balance_paise = 0, 
          held_paise = 0, 
          total_sales_paise = 0, 
          withdrawn_paise = 0, 
          withdrawn_amount = 0.0,
          updated_at = NOW();
    `);

    await client.query('COMMIT');
    console.log('✓ Transaction data cleared and wallets reset successfully.');

    // 3. Verify System Consistency (Rule 1: Wallets == SUM(Ledger) -> 0 == 0)
    console.log('\n3. Verifying system consistency after reset...');
    await assertSystemConsistency({
      pool,
      scenarioName: 'Post-Wipe Fresh Slate Verification'
    });

    console.log('\n🎉 SUCCESS: All accounts, POS terminals, channel rates, and beneficiaries remain intact with a clean 0 balance!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ WIPE FAILED & ROLLED BACK:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

wipeMoneyAndTransactionsSafely();
