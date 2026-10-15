import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { runExistingDataMigrationComparison } from '../scripts/migrate_existing_data_audit.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function runTest() {
  console.log('--- RUNNING TEST: Existing Data Migration & Audit Comparison ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // Seed real-world historical dataset into test database
    await client.query(`
      INSERT INTO users (id, name, mobile, role) VALUES
        ('ADM001', 'RONAV Super Admin', '9966203053', 'ADMIN'),
        ('SD1001', 'Telangana Super Distributor', '9848011223', 'SUPER_DISTRIBUTOR'),
        ('DIST2001', 'Hyderabad Central Distributor', '9848099887', 'DISTRIBUTOR'),
        ('MID3001', 'Ravi General Store (Koti)', '9876543210', 'MERCHANT'),
        ('MID3002', 'Lakshmi Supermarket (Ameerpet)', '9123456789', 'MERCHANT'),
        ('MID1001', 'Sri Krishna Enterprises', '9876540000', 'MERCHANT');

      -- Old cached balances shown by the app
      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('ADM001', 54200000),   -- Rs 542,000.00
        ('SD1001', 7840000),    -- Rs 78,400.00
        ('DIST2001', 3420000),  -- Rs 34,200.00
        ('MID3001', 3806075),   -- Rs 38,060.75
        ('MID3002', 2415050),   -- Rs 24,150.50
        ('MID1001', 982000);    -- Rs 9,820.00

      -- Approved Transactions
      INSERT INTO transactions (id, merchant_id, amount_paise, net_amount_paise, type, channel, status) VALUES
        ('TXN-OLD-01', 'MID3001', 19900000, 19550000, 'POS_SWIPE', 'pinelabs', 'APPROVED'),
        ('TXN-OLD-02', 'MID3002', 14200000, 13800000, 'POS_SWIPE', 'payswiff', 'APPROVED'),
        ('TXN-OLD-03', 'MID1001', 1000000, 982000, 'POS_SWIPE', 'pinelabs', 'APPROVED');

      -- Beneficiaries
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified) VALUES
        ('BEN-01', 'MID3001', 'SBI', '111', 'SBIN0001', 'Ravi Kumar', true),
        ('BEN-02', 'MID3002', 'Canara', '222', 'CNRB0001', 'Lakshmi Devi', true),
        ('BEN-03', 'MID1001', 'HDFC', '333', 'HDFC0001', 'Sri Krishna', true);

      -- Approved Withdrawals
      INSERT INTO withdrawals (id, merchant_id, amount_paise, fee_paise, net_payout_paise, beneficiary_id, channel, status) VALUES
        ('WTH-OLD-01', 'MID3001', 13500000, 0, 13500000, 'BEN-01', 'pinelabs', 'APPROVED'),
        ('WTH-OLD-02', 'MID3002', 8500000, 0, 8500000, 'BEN-02', 'payswiff', 'APPROVED');
    `);

    // Run the migration comparison tool
    console.log('Running runExistingDataMigrationComparison()...');
    const reportPath = path.resolve(process.cwd(), 'audit/MIGRATION_COMPARISON.md');
    const result = await runExistingDataMigrationComparison(client, reportPath);

    assert.ok(result.users_analyzed.length > 0);
    assert.ok(fs.existsSync(reportPath), 'MIGRATION_COMPARISON.md must be generated');

    const content = fs.readFileSync(reportPath, 'utf8');
    assert.ok(content.includes('MIGRATION COMPARISON'));
    assert.ok(content.includes('MID3001'));
    assert.ok(content.includes('MID1001'));

    console.log('✅ TEST PASSED: Existing data migration comparison executed and generated report.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
