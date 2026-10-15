import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { 
  postLedgerEntry, 
  getWalletBalances, 
  verifyWalletReconciliation 
} from './ledger_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST 2: Append-Only Financial Ledger & Immutability Trigger ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // Insert test user & wallet
    await client.query(`
      INSERT INTO users (id, name, mobile, role) 
      VALUES ('MID3001', 'Ravi General Store', '9876543210', 'MERCHANT');
      INSERT INTO wallets (user_id, balance_paise, held_paise) 
      VALUES ('MID3001', 0, 0);
    `);

    // 1. Post a swipe credit of Rs 9,850 (985000 paise)
    await client.query('BEGIN');
    const entry1 = await postLedgerEntry(client, {
      userId: 'MID3001',
      type: 'swipe_credit',
      amountPaise: 985000n, // Rs 9850.00
      referenceId: 'TXN-001',
      referenceType: 'SWIPE',
      channel: 'pinelabs',
      metadata: { gross_paise: 1000000, fee_paise: 15000 },
      createdBy: 'SYSTEM'
    });
    await client.query('COMMIT');

    assert.equal(entry1.type, 'swipe_credit');
    assert.equal(BigInt(entry1.amount_paise), 985000n);

    // Verify wallet balance is 985,000 paise
    const balance1 = await getWalletBalances(client, 'MID3001');
    assert.equal(balance1.balance_paise, 985000n);
    assert.equal(balance1.available_balance_paise, 985000n);

    // Verify reconciliation
    const recon1 = await verifyWalletReconciliation(client, 'MID3001');
    assert.equal(recon1.reconciled, true);
    assert.equal(recon1.cached_balance_paise, recon1.ledger_sum_paise);

    // 2. Post a withdrawal hold of Rs 5,000 (500000 paise)
    await client.query('BEGIN');
    await postLedgerEntry(client, {
      userId: 'MID3001',
      type: 'withdrawal_hold',
      amountPaise: -500000n,
      referenceId: 'WTH-001',
      referenceType: 'WITHDRAWAL',
      channel: 'pinelabs',
      metadata: { requested_paise: 500000 },
      createdBy: 'MID3001'
    });
    await client.query('COMMIT');

    const balance2 = await getWalletBalances(client, 'MID3001');
    assert.equal(balance2.balance_paise, 485000n); // 985,000 - 500,000 = 485,000 paise (Rs 4,850)

    const recon2 = await verifyWalletReconciliation(client, 'MID3001');
    assert.equal(recon2.reconciled, true);

    // 3. Test Immutability Trigger: Attempting to UPDATE ledger must FAIL
    await assert.rejects(
      async () => {
        await client.query(`UPDATE financial_ledger SET amount_paise = 999999 WHERE id = $1`, [entry1.id]);
      },
      { message: /IMMUTABLE_RECORD/ },
      'Trigger must block any UPDATE on financial_ledger'
    );

    // 4. Test Immutability Trigger: Attempting to DELETE ledger must FAIL
    await assert.rejects(
      async () => {
        await client.query(`DELETE FROM financial_ledger WHERE id = $1`, [entry1.id]);
      },
      { message: /IMMUTABLE_RECORD/ },
      'Trigger must block any DELETE on financial_ledger'
    );

    console.log('✅ TEST 2 PASSED: Append-only financial ledger with DB trigger and reconciliation.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST 2 FAILED:', err);
  process.exit(1);
});
