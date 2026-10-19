import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';

async function testNewBankAccount() {
  console.log('--- TEST: New Bank Account at Withdrawal Request Time ---');
  const pool = getDbPool();
  const client = await pool.connect();

  try {
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
  }
}

testNewBankAccount().catch(err => {
  console.error('EXPECTED FAILING TEST:', err.message);
  process.exit(1);
});
