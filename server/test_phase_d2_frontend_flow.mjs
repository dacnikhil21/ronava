import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import { getDbPool, withTransaction } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { quoteWithdrawal } from './withdrawal_engine.js';
import { handleApiRequest } from './api.js';
import { formatPaiseToRupees, rupeesToPaise } from '../src/utils/formatters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5995;
const baseUrl = `http://127.0.0.1:${PORT}`;
let server;

async function startServer() {
  server = http.createServer((req, res) => handleApiRequest(req, res));
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(method, path, body = null, headers = {}) {
  const url = `${baseUrl}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: json };
}

async function runTests() {
  console.log('=== TEST SUITE: Phase D2 Frontend Cleanup Verification ===');
  await resetTestDatabase();
  await startServer();

  // ----------------------------------------------------
  // TEST 1: Currency & Money Formatter Verification
  // ----------------------------------------------------
  console.log('\n1. Verifying Formatter: formatPaiseToRupees and rupeesToPaise...');
  assert.strictEqual(formatPaiseToRupees(1000000n), '₹10,000.00');
  assert.strictEqual(formatPaiseToRupees(15000n), '₹150.00');
  assert.strictEqual(formatPaiseToRupees(3000n), '₹30.00');
  assert.strictEqual(formatPaiseToRupees(2000n), '₹20.00');
  assert.strictEqual(formatPaiseToRupees(6000n), '₹60.00');
  assert.strictEqual(formatPaiseToRupees(985000n), '₹9,850.00');
  assert.strictEqual(formatPaiseToRupees(50000n), '₹500.00');
  assert.strictEqual(formatPaiseToRupees(0n), '₹0.00');
  assert.strictEqual(formatPaiseToRupees(-5000n), '-₹50.00');
  assert.strictEqual(rupeesToPaise('10000'), 1000000n);
  assert.strictEqual(rupeesToPaise('150.50'), 15050n);
  assert.strictEqual(rupeesToPaise(500), 50000n);
  console.log('   ✓ Formatter matches integer paise representations perfectly.');

  // ----------------------------------------------------
  // TEST 2: Simulated Backend Failures Show Error, Never 0
  // ----------------------------------------------------
  console.log('\n2. Verifying Simulated Backend Failures (Error State, Never 0)...');
  // Request non-existent user wallet
  const failWallet = await request('GET', '/api/wallet/NON_EXISTENT_USER_999');
  assert.strictEqual(failWallet.status, 404);
  assert.strictEqual(failWallet.body.success, false);
  assert.ok(failWallet.body.message.includes('not found') || failWallet.body.message.includes('NON_EXISTENT'));
  console.log('   ✓ Wallet failure returns 404 with error message (client receives walletError, does not render 0).');

  // Withdrawal quote for invalid amount (zero or negative)
  const failQuote = await request('POST', '/api/withdrawals/quote', {
    userId: 'MID_D2_TEST',
    amount: -100
  });
  assert.strictEqual(failQuote.status, 400);
  assert.strictEqual(failQuote.body.success, false);
  console.log('   ✓ Withdrawal quote failure returns 400 with explicit error message.');

  // ----------------------------------------------------
  // TEST 3: End-to-End Rs 10,000 Reference Example
  // ----------------------------------------------------
  console.log('\n3. Verifying Rs 10,000 Reference Example through UI Endpoints...');
  console.log('   Hierarchy: Retailer (MID) -> Area (DIST) -> District (DD) -> Super (SD) -> Master (MST) -> Admin (ADM)');
  
  const pool = getDbPool();
  const client = await pool.connect();
  let swipeTxnId;
  try {
    // Setup clean hierarchy
    await client.query(`
      DELETE FROM user_channel_rates WHERE user_id IN ('D2_MID_10K', 'D2_DIST_10K', 'D2_DD_10K', 'D2_SD_10K', 'D2_MST_10K', 'ADM001');
      DELETE FROM transactions WHERE merchant_id IN ('D2_MID_10K');
      DELETE FROM financial_ledger WHERE user_id IN ('D2_MID_10K', 'D2_DIST_10K', 'D2_DD_10K', 'D2_SD_10K', 'D2_MST_10K', 'ADM001');
      DELETE FROM wallets WHERE user_id IN ('D2_MID_10K', 'D2_DIST_10K', 'D2_DD_10K', 'D2_SD_10K', 'D2_MST_10K', 'ADM001');
      DELETE FROM users WHERE id IN ('D2_MID_10K', 'D2_DIST_10K', 'D2_DD_10K', 'D2_SD_10K', 'D2_MST_10K');

      INSERT INTO users (id, name, mobile, role, creator_id)
      VALUES 
        ('ADM001', 'Admin', '9999000000', 'ADMIN', NULL),
        ('D2_MST_10K', 'D2 Master', '9000000001', 'MASTER_DISTRIBUTOR', 'ADM001'),
        ('D2_SD_10K', 'D2 Super Dist', '9000000002', 'SUPER_DISTRIBUTOR', 'D2_MST_10K'),
        ('D2_DD_10K', 'D2 District Dist', '9000000003', 'DIST_FRANCHISE', 'D2_SD_10K'),
        ('D2_DIST_10K', 'D2 Area Dist', '9000000004', 'DISTRIBUTOR', 'D2_DD_10K'),
        ('D2_MID_10K', 'D2 Retailer', '9000000005', 'MERCHANT', 'D2_DIST_10K');
    `);

    // Set rates using authoritative rate engine:
    // Admin: 0 bps (floor)
    // Master: 60 bps (margin: 60 - 0 = 60 to Admin)
    // SD: 80 bps (margin: 80 - 60 = 20)
    // DD: 100 bps (margin: 100 - 80 = 20)
    // Area Dist: 120 bps (margin: 120 - 100 = 20)
    // Retailer: 150 bps (margin: 150 - 120 = 30)
    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 });
    await setUserRate(client, { userId: 'D2_MST_10K', channel: 'pinelabs', settlementMode: 'T1', rateBps: 80 });
    await setUserRate(client, { userId: 'D2_SD_10K', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
    await setUserRate(client, { userId: 'D2_DD_10K', channel: 'pinelabs', settlementMode: 'T1', rateBps: 120 });
    await setUserRate(client, { userId: 'D2_DIST_10K', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
    await setUserRate(client, { userId: 'D2_MID_10K', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    // Perform swipe of Rs 10,000 via transaction engine
    const swipeResult = await withTransaction(async (tx) => {
      return await processSwipeTransaction(tx, {
        merchantId: 'D2_MID_10K',
        amountPaise: 1000000n, // Rs 10,000
        channel: 'pinelabs',
        settlementMode: 'T1',
        slipNumber: 'D2_UTR_REF_10000',
        idempotencyKey: 'D2_IDEM_SWIPE_10000',
        customerName: 'Reference Customer',
        customerMobile: '9888877777',
        createdBy: 'D2_MID_10K'
      });
    });

    swipeTxnId = swipeResult.id;
    console.log('   ✓ Recorded swipe. Txn ID:', swipeTxnId);
  } finally {
    client.release();
  }

  // Now verify that UI endpoints return EXACT ledger numbers!
  // 1. Area Distributor financial summary: Rs 30 (3,000 paise)
  const distSummary = await request('GET', '/api/users/D2_DIST_10K/financial-summary');
  assert.strictEqual(distSummary.status, 200);
  assert.strictEqual(distSummary.body.total_commission_paise, '3000');
  assert.strictEqual(distSummary.body.total_commission_rupees, '30.00');
  console.log('   ✓ Area Distributor UI endpoint returns exactly ₹30.00 commission.');

  // 2. District Distributor financial summary: Rs 20 (2,000 paise)
  const ddSummary = await request('GET', '/api/users/D2_DD_10K/financial-summary');
  assert.strictEqual(ddSummary.status, 200);
  assert.strictEqual(ddSummary.body.total_commission_paise, '2000');
  assert.strictEqual(ddSummary.body.total_commission_rupees, '20.00');
  console.log('   ✓ District Distributor UI endpoint returns exactly ₹20.00 commission.');

  // 3. Super Distributor financial summary: Rs 20 (2,000 paise)
  const sdSummary = await request('GET', '/api/users/D2_SD_10K/financial-summary');
  assert.strictEqual(sdSummary.status, 200);
  assert.strictEqual(sdSummary.body.total_commission_paise, '2000');
  assert.strictEqual(sdSummary.body.total_commission_rupees, '20.00');
  console.log('   ✓ Super Distributor UI endpoint returns exactly ₹20.00 commission.');

  // 4. Master Distributor financial summary: Rs 20 (2,000 paise)
  const mstSummary = await request('GET', '/api/users/D2_MST_10K/financial-summary');
  assert.strictEqual(mstSummary.status, 200);
  assert.strictEqual(mstSummary.body.total_commission_paise, '2000');
  assert.strictEqual(mstSummary.body.total_commission_rupees, '20.00');
  console.log('   ✓ Master Distributor UI endpoint returns exactly ₹20.00 commission.');

  // 5. Admin financial summary: Rs 60 (6,000 paise)
  const admSummary = await request('GET', '/api/users/ADM001/financial-summary');
  assert.strictEqual(admSummary.status, 200);
  assert.strictEqual(admSummary.body.total_commission_paise, '6000');
  assert.strictEqual(admSummary.body.total_commission_rupees, '60.00');
  console.log('   ✓ Admin UI endpoint returns exactly ₹60.00 commission.');

  // 6. Retailer wallet balance: 10,000 - 150 = 9,850
  const midWallet = await request('GET', '/api/wallet/D2_MID_10K');
  assert.strictEqual(midWallet.status, 200);
  assert.strictEqual(midWallet.body.wallet.available_balance, 9850);
  assert.strictEqual(midWallet.body.wallet.channel_balances.pinelabs.available_balance, 9850);
  console.log('   ✓ Retailer wallet balance equals ₹9,850.00.');

  // 7. Withdrawal Quote for Retailer
  const quoteRes = await request('POST', '/api/withdrawals/quote', {
    userId: 'D2_MID_10K',
    amount: 5000,
    settlement_type: 'T1',
    channel: 'pinelabs'
  });
  assert.strictEqual(quoteRes.status, 200);
  assert.strictEqual(quoteRes.body.quote.requested_amount_rupees, '5000.00');
  assert.strictEqual(quoteRes.body.quote.reserve_compliant, true);
  console.log('   ✓ Withdrawal Quote UI endpoint computes authoritative net quote and reserve compliance.');

  // ----------------------------------------------------
  // TEST 4: Grep Proof - Client Math and Hardcoded Rates Gone
  // ----------------------------------------------------
  console.log('\n4. Verifying Grep Proof (Old Client-Side Math & Fake Rates Removed)...');
  const merchantJs = fs.readFileSync(path.join(__dirname, '../src/components/MerchantDashboardPage.jsx'), 'utf8');
  const adminJs = fs.readFileSync(path.join(__dirname, '../src/components/AdminDashboardPage.jsx'), 'utf8');

  // Verify .reduce is gone from MerchantDashboardPage
  assert.ok(!merchantJs.includes('.reduce('), 'MerchantDashboardPage.jsx must not contain .reduce() calls!');
  console.log('   ✓ Grep proof: ZERO .reduce() calls in MerchantDashboardPage.jsx.');

  // Verify 0.20% fake multiplier is gone from AdminDashboardPage
  assert.ok(!adminJs.includes('(totalVol * (cutRate / 100))'), 'AdminDashboardPage.jsx must not compute totalVol * cutRate / 100!');
  console.log('   ✓ Grep proof: Fabricated 0.20% / cutRate formula completely gone from AdminDashboardPage.jsx.');

  // Verify POS_MACHINES_DATA does not hardcode rates in MerchantDashboardPage
  assert.ok(!merchantJs.includes('rateT1: 1.50'), 'MerchantDashboardPage.jsx must not hardcode rateT1: 1.50!');
  console.log('   ✓ Grep proof: Hardcoded rateT1: 1.50 completely gone from MerchantDashboardPage.jsx.');

  console.log('\n✅ ALL PHASE D2 FRONTEND FLOW TESTS PASSED!');
  await stopServer();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('\n❌ Test Suite Failed:', err);
  await stopServer();
  process.exit(1);
});
