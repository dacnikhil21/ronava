import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { postLedgerEntry } from './ledger_engine.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST: Withdrawal Beneficiary Validation & Raw Account Rejection ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // Setup two merchants: M1 and M2
    await client.query(`
      INSERT INTO users (id, name, mobile, role) VALUES
        ('M1', 'Merchant 1', '9876543001', 'MERCHANT'),
        ('M2', 'Merchant 2', '9876543002', 'MERCHANT');

      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('M1', 0), ('M2', 0);

      -- M1 approved beneficiary
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified) VALUES
        ('BEN-M1-REAL', 'M1', 'State Bank of India', '111122223333', 'SBIN0001234', 'Merchant One', true),
        ('BEN-M1-UNVERIFIED', 'M1', 'ICICI Bank', '444455556666', 'ICIC0001234', 'Merchant One', false),
        ('BEN-M2-REAL', 'M2', 'HDFC Bank', '999988887777', 'HDFC0001234', 'Merchant Two', true);
    `);

    // Fund M1 with Rs 10,000 (1,000,000 paise)
    await client.query('BEGIN');
    await postLedgerEntry(client, {
      userId: 'M1',
      type: 'swipe_credit',
      amountPaise: 1000000n,
      referenceId: 'FUND-M1',
      channel: 'pinelabs'
    });
    await client.query('COMMIT');

    // TEST 1: Request with raw account number & IFSC, but NO beneficiary_id
    console.log('1. Testing raw account number in request (no beneficiary_id)...');
    await assert.rejects(
      async () => {
        await processWithdrawalRequest(client, {
          merchantId: 'M1',
          amountPaise: 50000n,
          // Intentionally omitting beneficiaryId, passing raw bank details
          account_number: '987654321098',
          ifsc: 'SBIN0009999',
          bank_name: 'Raw Injected Bank'
        });
      },
      { message: /BENEFICIARY_REQUIRED/ },
      'Server must reject raw bank details without approved beneficiary ID'
    );

    // TEST 2: Request with beneficiary_id that belongs to another merchant (M2's beneficiary)
    console.log("2. Testing beneficiary_id belonging to another merchant...");
    await assert.rejects(
      async () => {
        await processWithdrawalRequest(client, {
          merchantId: 'M1', // M1 is caller
          amountPaise: 50000n,
          beneficiaryId: 'BEN-M2-REAL' // Belongs to M2!
        });
      },
      { message: /INVALID_BENEFICIARY/ },
      'Server must reject beneficiary belonging to another merchant'
    );

    // TEST 3: Request with unverified beneficiary
    console.log("3. Testing unverified beneficiary...");
    await assert.rejects(
      async () => {
        await processWithdrawalRequest(client, {
          merchantId: 'M1',
          amountPaise: 50000n,
          beneficiaryId: 'BEN-M1-UNVERIFIED'
        });
      },
      { message: /UNVERIFIED_BENEFICIARY/ },
      'Server must reject unverified beneficiary'
    );

    // TEST 4: Request with valid beneficiary belonging to M1 + raw tampered bank info in body
    console.log("4. Testing valid beneficiary with tampered raw bank info in request...");
    const successfulWth = await processWithdrawalRequest(client, {
      merchantId: 'M1',
      amountPaise: 50000n, // Rs 500
      beneficiaryId: 'BEN-M1-REAL',
      // Tampered payload trying to divert money:
      account_number: 'TAMPERED_ACCOUNT_9999',
      ifsc: 'TAMPERED_IFSC'
    });

    assert.equal(successfulWth.beneficiary_id, 'BEN-M1-REAL');

    // Verify stored withdrawal record in DB:
    const wthRow = (await client.query(`SELECT * FROM withdrawals WHERE id = $1`, [successfulWth.id])).rows[0];
    assert.equal(wthRow.beneficiary_id, 'BEN-M1-REAL');

    // Verify ledger metadata uses database beneficiary details, NOT client tampered details
    const ledgerRow = (await client.query(`SELECT metadata FROM financial_ledger WHERE reference_id = $1`, [successfulWth.id])).rows[0];
    assert.equal(ledgerRow.metadata.beneficiary_id, 'BEN-M1-REAL');
    assert.equal(ledgerRow.metadata.account_number_masked, '3333'); // Last 4 of real DB account '111122223333'
    assert.equal(ledgerRow.metadata.ifsc, 'SBIN0001234'); // Real DB IFSC

    console.log('✅ TEST PASSED: Only approved beneficiaries belonging to caller are accepted; raw account numbers rejected.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
