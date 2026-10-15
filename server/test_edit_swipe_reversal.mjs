import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';
import { processSwipeTransaction, editSwipeTransaction } from './transaction_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST: Editing a Swipe after Commission Credit ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // Setup hierarchy: Admin (0.60%) -> Master (0.80%) -> SD (1.00%) -> Dist (1.20%) -> Area (1.50%) -> Merchant (1.50%)
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'RONAV Admin', '9966203053', 'ADMIN', NULL),
        ('AREA3001', 'Area Dist', '9848055443', 'DISTRIBUTOR', 'ADM001'),
        ('MID8001', 'Edit Merchant', '9876543888', 'MERCHANT', 'AREA3001');

      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('ADM001', 0), ('AREA3001', 0), ('MID8001', 0);
    `);

    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', rateBps: 60 });
    await setUserRate(client, { userId: 'AREA3001', channel: 'pinelabs', rateBps: 120 });
    await setUserRate(client, { userId: 'MID8001', channel: 'pinelabs', rateBps: 150 });

    // 1. Merchant accidentally swipes Rs 10,000 (1,000,000 paise) instead of Rs 8,000
    console.log('1. Posting initial erroneous swipe of Rs 10,000...');
    const originalSwipe = await processSwipeTransaction(client, {
      merchantId: 'MID8001',
      amountPaise: 1000000n,
      channel: 'pinelabs',
      refNumber: 'REF-ORIGINAL-10K',
      slipNumber: 'SLIP-ORIG-1',
      idempotencyKey: 'IDEMP-ORIG-1'
    });

    const merchantBalOrig = (await getWalletBalances(client, 'MID8001')).balance_paise;
    const areaBalOrig = (await getWalletBalances(client, 'AREA3001')).balance_paise;
    const adminBalOrig = (await getWalletBalances(client, 'ADM001')).balance_paise;

    assert.equal(merchantBalOrig, 985000n, 'Merchant gets Rs 9,850');
    assert.equal(areaBalOrig, 6000n, 'Area gets Rs 60');
    assert.equal(adminBalOrig, 9000n, 'Admin gets Rs 90');

    // 2. Admin edits the swipe: corrects amount from Rs 10,000 to Rs 8,000 (800,000 paise)
    console.log('2. Editing swipe to corrected amount Rs 8,000 (reversing old, posting new)...');
    const editResult = await editSwipeTransaction(client, {
      oldTxnId: originalSwipe.id,
      correctedAmountPaise: 800000n, // Rs 8,000
      reason: 'Merchant entered Rs 10,000 by mistake instead of Rs 8,000',
      callerId: 'ADM001'
    });

    assert.equal(editResult.old_status, 'REVERSED');
    assert.equal(editResult.new_transaction.amount_paise, 800000n);

    // Expected on Rs 8,000 (800,000 paise) at 1.50% fee:
    // Merchant fee = 1.50% of 8,000 = Rs 120 (12,000 paise).
    // Merchant Net = 8,000 - 120 = Rs 7,880 (788,000 paise).
    // Area (120 - 60 = 60 bps) = 8,000 * 60 / 10000 = Rs 48 (4,800 paise).
    // Admin = 120 - 48 = Rs 72 (7,200 paise).
    const merchantBalNew = (await getWalletBalances(client, 'MID8001')).balance_paise;
    const areaBalNew = (await getWalletBalances(client, 'AREA3001')).balance_paise;
    const adminBalNew = (await getWalletBalances(client, 'ADM001')).balance_paise;

    assert.equal(merchantBalNew, 788000n, 'Merchant wallet must now be exactly Rs 7,880');
    assert.equal(areaBalNew, 4800n, 'Area wallet must now be exactly Rs 48');
    assert.equal(adminBalNew, 7200n, 'Admin wallet must now be exactly Rs 72');

    // Invariant holds
    assert.equal(areaBalNew + adminBalNew, 12000n, 'Total fee Rs 120 accounted for');

    // 3. Verify ledger immutability & audit trail:
    // Ledger must contain:
    // - Original credit (MID: +985000, Area: +6000, Admin: +9000)
    // - Reversing entries (MID: -985000, Area: -6000, Admin: -9000)
    // - Corrected entries (MID: +788000, Area: +4800, Admin: +7200)
    const allLedgerRows = await client.query(
      `SELECT user_id, type, amount_paise FROM financial_ledger ORDER BY id ASC`
    );
    assert.equal(allLedgerRows.rows.length, 9, 'Must have 9 immutable ledger entries (3 original + 3 reversed + 3 corrected)');

    // 4. Reconciliation check across all wallets
    for (const uid of ['MID8001', 'AREA3001', 'ADM001']) {
      const rec = await verifyWalletReconciliation(client, uid);
      assert.equal(rec.reconciled, true, `Wallet ${uid} must reconcile`);
    }

    console.log('✅ TEST PASSED: Editing swipe creates reversing entries for all uplines then posts corrected entries.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
