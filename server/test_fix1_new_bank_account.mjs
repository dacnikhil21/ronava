import assert from 'node:assert/strict';

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_scratch_db';

if (process.env.TEST_DATABASE_URL.includes('ronav_test_db')) {
  throw new Error('SAFETY_VIOLATION: Refusing to run destructive test_fix1_new_bank_account on ronav_test_db! Must use ronav_scratch_db.');
}

import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';

async function testNewBankAccount() {
  console.log('--- TEST: New Bank Account at Withdrawal Request Time ---');
  
  // Initialize scratch test database with clean schema and seed DD1001 with legitimate balance
  await resetTestDatabase(process.env.TEST_DATABASE_URL);

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id, status)
      VALUES ('DD1001', 'DD1001 District Partner', '9848099887', 'DISTRICT_DISTRIBUTOR', NULL, 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);
    await client.query(`
      INSERT INTO wallets (user_id, balance_paise, held_paise, total_sales_paise, withdrawn_paise)
      VALUES ('DD1001', 986000, 0, 0, 0)
      ON CONFLICT (user_id) DO UPDATE SET balance_paise = 986000, held_paise = 0;
    `);
    await client.query(`
      INSERT INTO financial_ledger (user_id, type, amount_paise, channel, reference_id, reference_type, created_by)
      VALUES ('DD1001', 'swipe_credit', 986000, 'pinelabs', 'INITIAL-SEED-DD1001', 'SWIPE', 'TEST')
      ON CONFLICT DO NOTHING;
    `);

    // DD1001 has balance_paise = 986000
    // Try requesting withdrawal with newly typed bank details (no existing beneficiary)
    const typedBank = {
      merchantId: 'DD1001',
      amountPaise: 100000n, // Rs 1,000
      channel: 'pinelabs',
      settlementType: 'T1',
      bankName: 'HDFC Bank',
      accountNumber: '998877665544',
      ifsc: 'HDFC0001234',
      holderName: 'DD1001 District Partner'
    };

    const res = await processWithdrawalRequest(client, typedBank);
    assert.ok(res.id, 'Withdrawal ID must be returned');
    assert.equal(res.status, 'PENDING');
    assert.ok(res.beneficiary_id, 'Beneficiary ID must be created and linked');

    // Verify beneficiary row exists in DB
    const benRes = await client.query('SELECT * FROM beneficiaries WHERE id = $1', [res.beneficiary_id]);
    assert.equal(benRes.rows.length, 1, 'Beneficiary row must exist in DB');
    assert.equal(benRes.rows[0].account_number, '998877665544');
    assert.equal(benRes.rows[0].holder_name, 'DD1001 District Partner');

    console.log('✓ TEST PASSED: processWithdrawalRequest auto-created and linked typed bank account.');
  } finally {
    client.release();
    await pool.end();
  }
}

testNewBankAccount()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('EXPECTED FAILING TEST:', err.message);
    process.exit(1);
  });
