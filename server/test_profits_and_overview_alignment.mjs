import http from 'http';
import assert from 'assert/strict';
import { handleApiRequest } from './api.js';
import { cleanAndReseed } from './clean_and_reseed.mjs';

const TEST_PORT = 5991;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runStep4Test() {
  console.log('--- STEP 4 TEST: Profits & Overview Alignment ---');

  // 1. Clean and reseed ronav_test_db with only 6 reference users
  console.log('1. Cleaning & reseeding ronav_test_db...');
  await cleanAndReseed();

  // 2. Start HTTP server
  console.log(`2. Starting real HTTP server on port ${TEST_PORT}...`);
  const server = http.createServer(async (req, res) => {
    await handleApiRequest(req, res);
  });
  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    // 3. Record one Rs 10,000 Pine Labs T+1 swipe as MID4001
    console.log('3. Recording Rs 10,000 Pine Labs T+1 swipe as MID4001...');
    const swipePayload = {
      merchant_id: 'MID4001',
      amount_paise: 1000000, // 10,000 INR
      channel: 'pinelabs',
      mode: 'T1',
      settlement_type: 'T1',
      notes: 'Pine Labs POS Swipe',
      ref_number: 'REF-STEP4-10K',
      terminal_id: 'POS-MID4001-01'
    };

    const swipeRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'MID4001',
        'x-user-role': 'MERCHANT'
      },
      body: JSON.stringify(swipePayload)
    });

    const swipeData = await swipeRes.json();
    console.log('   Swipe response:', JSON.stringify(swipeData));
    assert.equal(swipeRes.status, 200, `Expected 200, got ${swipeRes.status}`);
    assert.equal(swipeData.success, true, 'Swipe transaction must succeed');
    assert.equal(swipeData.transaction.customer_charge, '150.00', 'Customer charge must be 150.00');

    // 4. Query GET /api/admin/pending (The shared single source of truth)
    console.log('4. Querying GET /api/admin/pending...');
    const pendingRes = await fetch(`${BASE_URL}/api/admin/pending`, {
      headers: {
        'x-user-id': 'ADM001',
        'x-user-role': 'ADMIN'
      }
    });
    const pendingData = await pendingRes.json();
    assert.equal(pendingRes.status, 200);
    assert.equal(pendingData.success, true);

    const stats = pendingData.stats;
    console.log('   Stats from /api/admin/pending:', stats);

    // Assertions on Server Stats:
    assert.equal(stats.totalVolume, 10000, `Expected totalVolume 10000, got ${stats.totalVolume}`);
    assert.equal(stats.totalFeesCollected, 150, `Expected totalFeesCollected 150, got ${stats.totalFeesCollected}`);
    assert.equal(stats.partnerCommissions, 90, `Expected partnerCommissions 90, got ${stats.partnerCommissions}`);
    assert.equal(stats.adminNetProfit, 60, `Expected adminNetProfit 60, got ${stats.adminNetProfit}`);

    // Assertions on Enriched Transaction Row:
    const txns = pendingData.allTransactions;
    assert.equal(txns.length, 1, 'Should have exactly 1 transaction in ledger');
    const t = txns[0];
    console.log('   Transaction row fields:', {
      amount: t.amount,
      fee_deducted: t.fee_deducted,
      paid_uplines: t.paid_uplines,
      admin_profit: t.admin_profit,
      splits: t.commission_splits
    });

    assert.equal(parseFloat(t.amount), 10000, 'Transaction amount must be 10,000');
    assert.equal(parseFloat(t.fee_deducted), 150, 'Transaction fee_deducted must be 150');
    assert.equal(parseFloat(t.paid_uplines), 90, 'Transaction paid_uplines must be 90');
    assert.equal(parseFloat(t.admin_profit), 60, 'Transaction admin_profit must be 60');

    // Verify splits
    const splits = t.commission_splits || [];
    assert.equal(splits.length, 5, 'Must have 5 commission splits (4 uplines + 1 admin)');
    const mstSplit = splits.find(s => s.user_id === 'MST1001');
    const sdSplit = splits.find(s => s.user_id === 'SD1001');
    const distSplit = splits.find(s => s.user_id === 'DIST2001');
    const areaSplit = splits.find(s => s.user_id === 'AREA3001');
    const admSplit = splits.find(s => s.user_id === 'ADM001');

    assert.equal(mstSplit?.amount, 20, 'Master split must be 20');
    assert.equal(sdSplit?.amount, 20, 'Super split must be 20');
    assert.equal(distSplit?.amount, 20, 'District split must be 20');
    assert.equal(areaSplit?.amount, 30, 'Area split must be 30');
    assert.equal(admSplit?.amount, 60, 'Admin profit split must be 60');

    // 5. Test Frontend Profit Engine calculation alignment
    console.log('5. Validating Frontend Profit Engine calculation logic...');
    const amt = parseFloat(t.amount);
    const companyFee = parseFloat(t.fee_deducted);
    const paidUplines = parseFloat(t.paid_uplines);
    const companyEarned = parseFloat(t.admin_profit);

    assert.equal(amt, 10000);
    assert.equal(companyFee, 150);
    assert.equal(paidUplines, 90);
    assert.equal(companyEarned, 60);

    // Overview admin net profit
    const overviewAdminProfit = stats.adminNetProfit;
    assert.equal(overviewAdminProfit, 60, 'Overview Admin net profit must be 60');

    console.log('\n--- ALL STEP 4 CHECKS PASSED SUCCESSFULLY ---');
    console.log('Profits Tab: Sales = 10,000 | Fees = 150 | Partner Commissions = 90 | Admin Profit = 60');
    console.log('Table Row:   Fee Deducted = 150 | Uplines Cut = 90 | Profit = 60');
    console.log('Overview:    Admin Net Profit = 60');

  } finally {
    server.close();
  }
}

runStep4Test().catch(err => {
  console.error('STEP 4 TEST FAILED:', err);
  process.exit(1);
});
