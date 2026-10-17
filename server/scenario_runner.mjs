// server/scenario_runner.mjs
// Automated End-to-End Scenario Runner with Playwright Browser Verification
// Executes all scenarios, runs consistency checker after EVERY scenario,
// saves screenshots to /audit/screens/scenarios/, and validates 100% ledger consistency.

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { getDbPool } from './pg_db.js';
import { cleanAndReseed } from './clean_and_reseed.mjs';
import { assertSystemConsistency } from './consistency_checker.js';
import { setUserRate } from './rate_engine.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';
import { runNoBrowserMoneyMathGuardrail } from './test_guardrail_no_browser_money_math.mjs';
import { performConfirmedLogin as confirmedLoginHelper, TEST_USERS } from './test_config.js';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('audit/screens/scenarios');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const scenarioResults = [];

async function logAndCapture(scenarioName, slug, page, pool, currentUserId, currentUserRole, serverOffline = false) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${slug}.png`);
  if (page) {
    await page.waitForTimeout(1000);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  // RUN CONSISTENCY CHECKER AFTER EVERY SCENARIO
  await assertSystemConsistency({
    pool,
    page,
    currentUserId,
    currentUserRole,
    scenarioName,
    serverOffline
  });

  const relPath = `/audit/screens/scenarios/${slug}.png`;
  scenarioResults.push({
    scenario: scenarioName,
    result: 'PASSED',
    screenshot: relPath
  });
  console.log(`📸 [Screenshot Captured]: ${relPath}`);
}

async function performConfirmedLogin(page, userId, password, role) {
  // Always delegate to canonical test_config helper (forces Ronav@123, asserts form gone, checks heading, captures proof)
  return await confirmedLoginHelper(page, userId, { baseUrl: BASE_URL });
}

async function runScenarioSuite() {
  console.log('================================================================');
  console.log('🚀 EXECUTING MASTER SCENARIO SUITE & CONSISTENCY CHECKER');
  console.log('================================================================');

  // 0. Run Zero Browser Money Math & Fallback Guardrail
  runNoBrowserMoneyMathGuardrail();

  // 1. Reseed clean test database
  await cleanAndReseed();
  const pool = getDbPool();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Accept any confirmation dialogs automatically
  page.on('dialog', async dialog => {
    console.log(`   [Dialog Auto-Confirm] ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    // -------------------------------------------------------------------------
    // SCENARIOS 1 to 6: Confirmed Login for all 6 reference users
    // -------------------------------------------------------------------------
    const usersToLogin = [
      { id: 'ADM001', role: 'ADMIN', name: 'Admin Login Confirmed', slug: '01_login_adm001' },
      { id: 'MST1001', role: 'MASTER', name: 'Master Distributor Login Confirmed', slug: '02_login_mst1001' },
      { id: 'SD1001', role: 'SUPER_DISTRIBUTOR', name: 'Super Distributor Login Confirmed', slug: '03_login_sd1001' },
      { id: 'DIST2001', role: 'DISTRICT_DISTRIBUTOR', name: 'District Distributor Login Confirmed', slug: '04_login_dist2001' },
      { id: 'AREA3001', role: 'DISTRIBUTOR', name: 'Area Distributor Login Confirmed', slug: '05_login_area3001' },
      { id: 'MID4001', role: 'MERCHANT', name: 'Merchant Login Confirmed', slug: '06_login_mid4001' },
    ];

    for (const u of usersToLogin) {
      await performConfirmedLogin(page, u.id, 'Ronav@123', u.role);
      await logAndCapture(u.name, u.slug, page, pool, u.id, u.role);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 7: Pine Labs T+1 Swipe (Rs 10,000)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 7: Pine Labs T+1 Swipe (Rs 10,000) ---');
    const swipeT1Res = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-PL-T1'
      })
    });
    assert.equal(swipeT1Res.status, 200);
    const swipeT1Data = await swipeT1Res.json();
    const swipeT1Id = swipeT1Data.transaction.id;
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Pine Labs T+1 Swipe (Rs 10,000)', '07_swipe_pine_labs_t1', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 8: Pine Labs Instant Swipe (Rs 10,000)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 8: Pine Labs Instant Swipe (Rs 10,000) ---');
    const swipeInstantRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'INSTANT',
        settlement_type: 'INSTANT',
        ref_number: 'REF-SCENARIO-PL-INSTANT'
      })
    });
    assert.equal(swipeInstantRes.status, 200);
    const swipeInstantData = await swipeInstantRes.json();
    const swipeInstantId = swipeInstantData.transaction.id;
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Pine Labs Instant Swipe (Rs 10,000)', '08_swipe_pine_labs_instant', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 9: Payswiff Swipe (Rs 5,000)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 9: Payswiff Swipe (Rs 5,000) ---');
    // Ensure Payswiff rate exists for chain
    const dbClient = await pool.connect();
    try {
      await setUserRate(dbClient, { userId: 'MID4001', channel: 'payswiff', settlementMode: 'T1', rateBps: 180 });
      await setUserRate(dbClient, { userId: 'MID4001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 210 });
      await setUserRate(dbClient, { userId: 'AREA3001', channel: 'payswiff', settlementMode: 'T1', rateBps: 140 });
      await setUserRate(dbClient, { userId: 'AREA3001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 170 });
      await setUserRate(dbClient, { userId: 'DIST2001', channel: 'payswiff', settlementMode: 'T1', rateBps: 120 });
      await setUserRate(dbClient, { userId: 'DIST2001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 150 });
      await setUserRate(dbClient, { userId: 'SD1001', channel: 'payswiff', settlementMode: 'T1', rateBps: 100 });
      await setUserRate(dbClient, { userId: 'SD1001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 130 });
      await setUserRate(dbClient, { userId: 'MST1001', channel: 'payswiff', settlementMode: 'T1', rateBps: 80 });
      await setUserRate(dbClient, { userId: 'MST1001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 110 });
    } finally {
      dbClient.release();
    }

    const swiffRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 500000,
        channel: 'payswiff',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-PAYSWIFF'
      })
    });
    assert.equal(swiffRes.status, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Payswiff Swipe (Rs 5,000)', '09_swipe_payswiff', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 10: QR Payment (Rs 2,000)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 10: QR Payment (Rs 2,000) ---');
    const qrClient = await pool.connect();
    try {
      await setUserRate(qrClient, { userId: 'MID4001', channel: 'qr', settlementMode: 'NONE', rateBps: 150 });
      await setUserRate(qrClient, { userId: 'AREA3001', channel: 'qr', settlementMode: 'NONE', rateBps: 120 });
      await setUserRate(qrClient, { userId: 'DIST2001', channel: 'qr', settlementMode: 'NONE', rateBps: 100 });
      await setUserRate(qrClient, { userId: 'SD1001', channel: 'qr', settlementMode: 'NONE', rateBps: 80 });
      await setUserRate(qrClient, { userId: 'MST1001', channel: 'qr', settlementMode: 'NONE', rateBps: 60 });
    } finally {
      qrClient.release();
    }

    const qrRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 200000,
        channel: 'qr',
        mode: 'NONE',
        settlement_type: 'NONE',
        ref_number: 'REF-SCENARIO-QR'
      })
    });
    const qrData = await qrRes.json();
    assert.equal(qrRes.status, 200, `QR swipe failed: ${JSON.stringify(qrData)}`);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('QR Payment (Rs 2,000)', '10_swipe_qr', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 11: Long Chain Swipe (5 Tiers Complete)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 11: Long Chain Swipe (5 Tiers Complete) ---');
    const longChainRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1500000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-LONGCHAIN'
      })
    });
    assert.equal(longChainRes.status, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Long Chain Swipe (5 Tiers Complete)', '11_swipe_long_chain', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 12: Short Chain (Admin > SD > Merchant)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 12: Short Chain (Admin > SD > Merchant) ---');
    const scClient = await pool.connect();
    try {
      await scClient.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('SC_SD1', 'Short SD', '9911000001', 'SUPER_DISTRIBUTOR', 'ADM001'),
          ('SC_MID1', 'Short Merchant', '9911000002', 'MERCHANT', 'SC_SD1')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO wallets (user_id, balance_paise) VALUES ('SC_SD1', 0), ('SC_MID1', 0) ON CONFLICT (user_id) DO NOTHING;
      `);
      await setUserRate(scClient, { userId: 'SC_SD1', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
      await setUserRate(scClient, { userId: 'SC_MID1', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
    } finally {
      scClient.release();
    }

    const shortChainRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'SC_MID1', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'SC_MID1',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-SHORT-SD'
      })
    });
    assert.equal(shortChainRes.status, 200);
    await logAndCapture('Short Chain (Admin > SD > Merchant)', '12_swipe_short_chain_sd', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 13: Short Chain (Admin > District > Merchant)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 13: Short Chain (Admin > District > Merchant) ---');
    const sc2Client = await pool.connect();
    try {
      await sc2Client.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('SC_DIST1', 'Short District', '9911000011', 'DISTRICT_DISTRIBUTOR', 'ADM001'),
          ('SC_MID2', 'Short Dist Merchant', '9911000012', 'MERCHANT', 'SC_DIST1')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO wallets (user_id, balance_paise) VALUES ('SC_DIST1', 0), ('SC_MID2', 0) ON CONFLICT (user_id) DO NOTHING;
      `);
      await setUserRate(sc2Client, { userId: 'SC_DIST1', channel: 'pinelabs', settlementMode: 'T1', rateBps: 120 });
      await setUserRate(sc2Client, { userId: 'SC_MID2', channel: 'pinelabs', settlementMode: 'T1', rateBps: 160 });
    } finally {
      sc2Client.release();
    }

    const shortDistRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'SC_MID2', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'SC_MID2',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-SHORT-DIST'
      })
    });
    assert.equal(shortDistRes.status, 200);
    await logAndCapture('Short Chain (Admin > District > Merchant)', '13_swipe_short_chain_district', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 14: Distributor Self-Swipe
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 14: Distributor Self-Swipe ---');
    const selfSwipeRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'DIST2001', 'x-user-role': 'DISTRICT_DISTRIBUTOR' },
      body: JSON.stringify({
        merchant_id: 'DIST2001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-SELF-SWIPE'
      })
    });
    assert.equal(selfSwipeRes.status, 200);
    await logAndCapture('Distributor Self-Swipe', '14_distributor_self_swipe', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 15: Admin Blocked From Swiping
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 15: Admin Blocked From Swiping ---');
    const adminSwipeRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        merchant_id: 'ADM001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-ADMIN-BLOCKED'
      })
    });
    assert.equal(adminSwipeRes.status, 400);
    const adminSwipeData = await adminSwipeRes.json();
    assert(adminSwipeData.message.includes('ADMIN_CANNOT_SWIPE'));
    await logAndCapture('Admin Blocked From Swiping', '15_admin_blocked_swipe', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 16: Reject a Swipe
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 16: Reject a Swipe ---');
    const reject1Res = await fetch(`${BASE_URL}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        transaction_id: swipeT1Id,
        action: 'REJECT',
        reason: 'Scenario single reject test'
      })
    });
    assert.equal(reject1Res.status, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Reject a Swipe', '16_reject_one_swipe', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 17: Reject Two Swipes
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 17: Reject Two Swipes ---');
    const reject2Res = await fetch(`${BASE_URL}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        transaction_id: swipeInstantId,
        action: 'REJECT',
        reason: 'Scenario second reject test'
      })
    });
    assert.equal(reject2Res.status, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Reject Two Swipes', '17_reject_two_swipes', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 18: Edit a Swipe Amount
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 18: Edit a Swipe Amount ---');
    // First record a swipe to edit
    const editBaseRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-EDIT-SRC'
      })
    });
    const editBaseData = await editBaseRes.json();
    const editSrcId = editBaseData.transaction.id;

    // Now edit to 8,000 INR
    const editRes = await fetch(`${BASE_URL}/api/transactions/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        transaction_id: editSrcId,
        new_amount: 8000,
        reason: 'Customer requested amount modification'
      })
    });
    assert.equal(editRes.status, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Edit a Swipe Amount', '18_edit_swipe_amount', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 19: Rate Changed After Swipe, Then Reject
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 19: Rate Changed After Swipe, Then Reject ---');
    const r19SwipeRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-RATE-CHG-REJ'
      })
    });
    const r19TxnId = (await r19SwipeRes.json()).transaction.id;

    // Alter rates for MID4001 and AREA3001
    const r19Client = await pool.connect();
    try {
      await setUserRate(r19Client, { userId: 'MID4001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 220 });
      await setUserRate(r19Client, { userId: 'AREA3001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 180 });
    } finally {
      r19Client.release();
    }

    // Now reject the swipe
    const r19RejRes = await fetch(`${BASE_URL}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        transaction_id: r19TxnId,
        action: 'REJECT',
        reason: 'Reject after rate change'
      })
    });
    assert.equal(r19RejRes.status, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Rate Changed After Swipe, Then Reject', '19_rate_changed_then_reject', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 20: Rate Changed After Swipe, Then Edit
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 20: Rate Changed After Swipe, Then Edit ---');
    const r20SwipeRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        ref_number: 'REF-SCENARIO-RATE-CHG-EDIT'
      })
    });
    const r20TxnId = (await r20SwipeRes.json()).transaction.id;

    // Change rates
    const r20Client = await pool.connect();
    try {
      await setUserRate(r20Client, { userId: 'MID4001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 250 });
      await setUserRate(r20Client, { userId: 'AREA3001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 200 });
    } finally {
      r20Client.release();
    }

    // Edit amount to 7,500 INR
    const r20EditRes = await fetch(`${BASE_URL}/api/transactions/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        transaction_id: r20TxnId,
        new_amount: 7500,
        reason: 'Amount revised post rate change'
      })
    });
    assert.equal(r20EditRes.status, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Rate Changed After Swipe, Then Edit', '20_rate_changed_then_edit', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 21: Missing Bank Details Blocked From Withdrawal
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 21: Missing Bank Details Blocked From Withdrawal ---');
    const wthNoBankRes = await fetch(`${BASE_URL}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 1000,
        channel: 'pinelabs',
        settlement_type: 'T1'
        // Missing beneficiary_id
      })
    });
    assert.equal(wthNoBankRes.status, 400);
    const wthNoBankData = await wthNoBankRes.json();
    assert(wthNoBankData.message.includes('BENEFICIARY_REQUIRED'));
    await logAndCapture('Missing Bank Details Blocked From Withdrawal', '21_withdrawal_missing_bank', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 22: Withdrawal Request (Hold Created)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 22: Withdrawal Request (Hold Created) ---');
    const wthReqRes = await fetch(`${BASE_URL}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 2000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        beneficiary_id: 'BEN-MID4001-01'
      })
    });
    assert.equal(wthReqRes.status, 200);
    const wthReqData = await wthReqRes.json();
    const wthId1 = wthReqData.withdrawal.id;
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Withdrawal Request (Hold Created)', '22_withdrawal_request', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 23: Excel Export (Second Export Excludes It)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 23: Excel Export (Second Export Excludes It) ---');
    const exp1Res = await fetch(`${BASE_URL}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        withdrawalIds: [wthId1],
        batchTag: 'BATCH-SCENARIO-01',
        bankName: 'HDFC Bank'
      })
    });
    assert.equal(exp1Res.status, 200);

    // Second export of the exact same withdrawal must be refused
    const exp2Res = await fetch(`${BASE_URL}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        withdrawalIds: [wthId1]
      })
    });
    assert.equal(exp2Res.status, 400);
    await logAndCapture('Excel Export (Second Export Excludes It)', '23_withdrawal_export', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 24: UTR Completion
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 24: UTR Completion ---');
    const utrRes = await fetch(`${BASE_URL}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        withdrawal_id: wthId1,
        action: 'APPROVE',
        utr: 'UTR-SCENARIO-99001'
      })
    });
    assert.equal(utrRes.status, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('UTR Completion', '24_withdrawal_utr_complete', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 25: Duplicate UTR Refused
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 25: Duplicate UTR Refused ---');
    // Create second withdrawal to test duplicate UTR on
    const wth2Res = await fetch(`${BASE_URL}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 1500,
        channel: 'pinelabs',
        settlement_type: 'T1',
        beneficiary_id: 'BEN-MID4001-01'
      })
    });
    const wthId2 = (await wth2Res.json()).withdrawal.id;

    const dupUtrRes = await fetch(`${BASE_URL}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        withdrawal_id: wthId2,
        action: 'APPROVE',
        utr: 'UTR-SCENARIO-99001' // DUPLICATE UTR!
      })
    });
    assert.equal(dupUtrRes.status, 400);
    const dupUtrData = await dupUtrRes.json();
    assert(dupUtrData.message.includes('DUPLICATE_UTR'));
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Duplicate UTR Refused', '25_duplicate_utr_refused', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 26: Withdrawal Reject (Hold Refunded)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 26: Withdrawal Reject (Hold Refunded) ---');
    const rejWthRes = await fetch(`${BASE_URL}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        withdrawal_id: wthId2,
        action: 'REJECT',
        reason: 'Scenario withdrawal rejection test'
      })
    });
    assert.equal(rejWthRes.status, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await logAndCapture('Withdrawal Reject (Hold Refunded)', '26_withdrawal_reject', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 27: Onboarding With 1 Channel
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 27: Onboarding With 1 Channel ---');
    const ob1Res = await fetch(`${BASE_URL}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        name: 'Merchant One Channel',
        mobile: '9888111001',
        role: 'MERCHANT',
        creator_id: 'AREA3001',
        channels: {
          pine_labs: {
            enabled: true,
            rate_t1: '2.20',
            rate_instant: '2.50'
          }
        }
      })
    });
    assert.equal(ob1Res.status, 200);
    await logAndCapture('Onboarding With 1 Channel', '27_onboarding_1_channel', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 28: Onboarding With 2 Channels
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 28: Onboarding With 2 Channels ---');
    const ob2Res = await fetch(`${BASE_URL}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        name: 'Merchant Two Channels',
        mobile: '9888111002',
        role: 'MERCHANT',
        creator_id: 'AREA3001',
        channels: {
          pine_labs: {
            enabled: true,
            rate_t1: '2.20',
            rate_instant: '2.50'
          },
          payswiff: {
            enabled: true,
            rate_t1: '1.90',
            rate_instant: '2.20'
          }
        }
      })
    });
    assert.equal(ob2Res.status, 200);
    await logAndCapture('Onboarding With 2 Channels', '28_onboarding_2_channels', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 29: Onboarding With 3 Channels
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 29: Onboarding With 3 Channels ---');
    const ob3Res = await fetch(`${BASE_URL}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        name: 'Merchant Three Channels',
        mobile: '9888111003',
        role: 'MERCHANT',
        creator_id: 'AREA3001',
        channels: {
          pine_labs: {
            enabled: true,
            rate_t1: '2.20',
            rate_instant: '2.50'
          },
          payswiff: {
            enabled: true,
            rate_t1: '1.90',
            rate_instant: '2.20'
          },
          qr: {
            enabled: true,
            rate_t1: '1.50',
            rate_instant: '1.80'
          }
        }
      })
    });
    assert.equal(ob3Res.status, 200);
    await logAndCapture('Onboarding With 3 Channels', '29_onboarding_3_channels', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 30: Child Below Parent Rate Refused
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 30: Child Below Parent Rate Refused ---');
    const badRateRes = await fetch(`${BASE_URL}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        name: 'Merchant Bad Rate',
        mobile: '9888111004',
        role: 'MERCHANT',
        creator_id: 'AREA3001',
        channels: {
          pine_labs: {
            enabled: true,
            rate_t1: '1.50', // Lower than Area rate (2.00%)!
            rate_instant: '2.50'
          }
        }
      })
    });
    assert.equal(badRateRes.status, 400);
    const badRateData = await badRateRes.json();
    assert(badRateData.message.includes('INVALID_RATE_HIERARCHY'));
    await logAndCapture('Child Below Parent Rate Refused', '30_child_below_parent_refused', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 31: Channel The Parent Does Not Have Refused
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 31: Channel The Parent Does Not Have Refused ---');
    // Create isolated parent with ONLY Pine Labs
    const pClient = await pool.connect();
    try {
      await pClient.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('P_DIST_ONLY_PINE', 'Pine Only Dist', '9888999001', 'DISTRIBUTOR', 'ADM001')
        ON CONFLICT (id) DO NOTHING;
      `);
      await setUserRate(pClient, { userId: 'P_DIST_ONLY_PINE', channel: 'pinelabs', settlementMode: 'T1', rateBps: 120 });
      await setUserRate(pClient, { userId: 'P_DIST_ONLY_PINE', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 150 });
    } finally {
      pClient.release();
    }

    const badChannelRes = await fetch(`${BASE_URL}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        name: 'Child Merchant Bad Channel',
        mobile: '9888999002',
        role: 'MERCHANT',
        creator_id: 'P_DIST_ONLY_PINE',
        channels: {
          payswiff: { // Parent doesn't have Payswiff!
            enabled: true,
            rate_t1: '1.80',
            rate_instant: '2.00'
          }
        }
      })
    });
    assert.equal(badChannelRes.status, 400);
    const badChannelData = await badChannelRes.json();
    assert(badChannelData.message.includes('PARENT_CHANNEL_MISSING'));
    await logAndCapture('Channel The Parent Does Not Have Refused', '31_missing_channel_refused', page, pool, 'MID4001', 'MERCHANT');

    // -------------------------------------------------------------------------
    // SCENARIO 32: Stop Server & Reload (Screens Show Error, Never Rs 0.00)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 32: Stop Server & Reload (Screens Show Error, Never Rs 0.00) ---');
    // First navigate to Admin Portal
    await performConfirmedLogin(page, 'ADM001', 'Ronav@123', 'ADMIN');

    // Intercept and abort API calls to simulate server offline
    await page.route('**/api/**', route => route.abort('connectionrefused'));

    // Reload while server is offline
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);

    // Verify error banner is visible and no false Rs 0.00 is shown
    await logAndCapture('Stop Server & Reload (Error Screen, Never Rs 0.00)', '32_server_offline_error', page, pool, 'ADM001', 'ADMIN', true);

    // Restore routing
    await page.unroute('**/api/**');

    console.log('\n================================================================');
    console.log('🎉 MASTER SCENARIO SUITE COMPLETED SUCCESSFULLY: 32/32 PASSED');
    console.log('================================================================\n');

    return scenarioResults;
  } finally {
    await browser.close();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('scenario_runner.mjs')) {
  runScenarioSuite()
    .then(results => {
      console.log('\n### MASTER SCENARIOS EXECUTION SUMMARY TABLE:\n');
      console.log('| # | Scenario | Checker Result | Screenshot Path |');
      console.log('|---|----------|----------------|-----------------|');
      results.forEach((r, idx) => {
        console.log(`| ${idx + 1} | ${r.scenario} | ${r.result} | ${r.screenshot} |`);
      });
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 SCENARIO RUNNER FAILED:', err);
      process.exit(1);
    });
}
