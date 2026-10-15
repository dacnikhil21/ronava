import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { reverseTransaction } from './reversal_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST 7: Transaction Reversals with Ledger Audit Trail ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // Setup hierarchy
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'RONAV Admin', '9966203053', 'ADMIN', NULL),
        ('AREA3001', 'Area Dist', '9848055443', 'DISTRIBUTOR', 'ADM001'),
        ('MID7001', 'Reversal Merchant', '9876543777', 'MERCHANT', 'AREA3001');

      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('ADM001', 0), ('AREA3001', 0), ('MID7001', 0);
    `);

    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', rateBps: 60 });
    await setUserRate(client, { userId: 'AREA3001', channel: 'pinelabs', rateBps: 120 });
    await setUserRate(client, { userId: 'MID7001', channel: 'pinelabs', rateBps: 150 });

    // 1. Process swipe of Rs 10,000 (1,000,000 paise)
    const swipe = await processSwipeTransaction(client, {
      merchantId: 'MID7001',
      amountPaise: 1000000n,
      channel: 'pinelabs',
      refNumber: 'REF-REV-01',
      idempotencyKey: 'IDEMP-REV-1'
    });

    // Check balances before reversal
    const bMerchantBefore = (await getWalletBalances(client, 'MID7001')).balance_paise;
    const bAreaBefore = (await getWalletBalances(client, 'AREA3001')).balance_paise;
    const bAdminBefore = (await getWalletBalances(client, 'ADM001')).balance_paise;

    assert.equal(bMerchantBefore, 985000n);
    assert.equal(bAreaBefore, 6000n);
    assert.equal(bAdminBefore, 9000n);

    // 2. Reverse the transaction
    console.log('Reversing transaction...');
    const revResult = await reverseTransaction(client, {
      txnId: swipe.id,
      reason: 'Customer dispute and chargeback',
      callerId: 'ADM001'
    });

    assert.equal(revResult.status, 'REVERSED');
    assert.equal(revResult.reversing_entries_count, 3, 'Must reverse merchant + area + admin');

    // 3. Verify all balances returned to exactly 0 paise
    const bMerchantAfter = (await getWalletBalances(client, 'MID7001')).balance_paise;
    const bAreaAfter = (await getWalletBalances(client, 'AREA3001')).balance_paise;
    const bAdminAfter = (await getWalletBalances(client, 'ADM001')).balance_paise;

    assert.equal(bMerchantAfter, 0n, 'Merchant wallet must return to 0');
    assert.equal(bAreaAfter, 0n, 'Area wallet must return to 0');
    assert.equal(bAdminAfter, 0n, 'Admin wallet must return to 0');

    // 4. Verify reconciliation across all wallets
    for (const uid of ['MID7001', 'AREA3001', 'ADM001']) {
      const rec = await verifyWalletReconciliation(client, uid);
      assert.equal(rec.reconciled, true, `Wallet ${uid} must remain reconciled`);
      assert.equal(rec.cached_balance_paise, 0n);
      assert.equal(rec.ledger_sum_paise, 0n);
    }

    // 5. Attempting to reverse again must throw
    await assert.rejects(
      async () => {
        await reverseTransaction(client, {
          txnId: swipe.id,
          reason: 'Duplicate reversal attempt',
          callerId: 'ADM001'
        });
      },
      { message: /TRANSACTION_ALREADY_REVERSED/ },
      'Cannot reverse already reversed transaction'
    );

    console.log('✅ TEST 7 PASSED: Transaction reversals with ledger audit trail fully verified.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST 7 FAILED:', err);
  process.exit(1);
});
