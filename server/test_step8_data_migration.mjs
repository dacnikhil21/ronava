import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { migrateHistoricalDataToLedger } from './migration_engine.js';
import { verifyWalletReconciliation } from './ledger_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST 8: Historical Data Migration to Ledger ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // 1. Setup legacy data: Users, Transactions, and Withdrawals
    await client.query(`
      INSERT INTO users (id, name, mobile, role) VALUES
        ('LEGACY_M1', 'Legacy Merchant 1', '9876540001', 'MERCHANT'),
        ('LEGACY_M2', 'Legacy Merchant 2', '9876540002', 'MERCHANT');

      -- Old wallet balances in paise (e.g. M1 had Rs 8,000, M2 had Rs 4,500)
      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('LEGACY_M1', 800000),
        ('LEGACY_M2', 450000);

      -- Legacy transactions:
      -- M1: swipe Rs 10,000 (1,000,000 paise)
      -- M2: swipe Rs 5,000 (500,000 paise)
      INSERT INTO transactions (id, merchant_id, amount_paise, customer_charge_paise, net_amount_paise, type, channel, status) VALUES
        ('TXN-LEGACY-01', 'LEGACY_M1', 1000000, 0, 1000000, 'POS_SWIPE', 'pinelabs', 'APPROVED'),
        ('TXN-LEGACY-02', 'LEGACY_M2', 500000, 0, 500000, 'POS_SWIPE', 'pinelabs', 'APPROVED');

      -- Legacy withdrawals:
      -- M1 withdrew Rs 2,000 (200,000 paise)
      -- M2 withdrew Rs 500 (50,000 paise)
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified) VALUES
        ('BEN-LEG-01', 'LEGACY_M1', 'SBI', '111', 'SBIN0001', 'M1', true),
        ('BEN-LEG-02', 'LEGACY_M2', 'HDFC', '222', 'HDFC0001', 'M2', true);

      INSERT INTO withdrawals (id, merchant_id, amount_paise, fee_paise, net_payout_paise, beneficiary_id, channel, status) VALUES
        ('WTH-LEGACY-01', 'LEGACY_M1', 200000, 0, 200000, 'BEN-LEG-01', 'pinelabs', 'APPROVED'),
        ('WTH-LEGACY-02', 'LEGACY_M2', 50000, 0, 50000, 'BEN-LEG-02', 'pinelabs', 'APPROVED');
    `);

    // 2. Run Migration
    console.log('Running migration...');
    const migrationReport = await migrateHistoricalDataToLedger(client);

    assert.equal(migrationReport.total_migrated_txns, 2);
    assert.equal(migrationReport.total_migrated_withdrawals, 2);
    assert.equal(migrationReport.users_compared.length, 2);

    // M1: net 1,000,000 - 200,000 = 800,000 paise (Rs 8,000). Before was 800,000. Mismatch = false!
    const m1Report = migrationReport.users_compared.find(u => u.user_id === 'LEGACY_M1');
    assert.equal(m1Report.before_balance_paise, 800000n);
    assert.equal(m1Report.ledger_sum_paise, 800000n);
    assert.equal(m1Report.mismatch, false);

    // M2: net 500,000 - 50,000 = 450,000 paise (Rs 4,500). Before was 450,000. Mismatch = false!
    const m2Report = migrationReport.users_compared.find(u => u.user_id === 'LEGACY_M2');
    assert.equal(m2Report.before_balance_paise, 450000n);
    assert.equal(m2Report.ledger_sum_paise, 450000n);
    assert.equal(m2Report.mismatch, false);

    // 3. Verify reconciliation for all migrated users
    for (const uid of ['LEGACY_M1', 'LEGACY_M2']) {
      const recon = await verifyWalletReconciliation(client, uid);
      assert.equal(recon.reconciled, true);
    }

    console.log('✅ TEST 8 PASSED: Historical data migrated cleanly with 100% reconciliation.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST 8 FAILED:', err);
  process.exit(1);
});
