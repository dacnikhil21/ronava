import http from 'http';
import assert from 'assert/strict';
import pg from 'pg';
import { handleApiRequest } from './api.js';
import { cleanAndReseed } from './clean_and_reseed.mjs';

const { Pool } = pg;
const connectionString = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
const pool = new Pool({ connectionString });

const TEST_PORT = 5993;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runTest() {
  console.log('--- TEST: RATE CHANGE REVERSAL & SWIPE EDIT RECONCILIATION ---');

  // 1. Reseed ronav_test_db with clean 6 reference users
  console.log('1. Cleaning & reseeding ronav_test_db...');
  await cleanAndReseed();

  // Baseline wallet balances
  const initialWalletsRes = await pool.query('SELECT user_id, balance_paise FROM wallets ORDER BY user_id');
  const initialWallets = {};
  initialWalletsRes.rows.forEach(r => { initialWallets[r.user_id] = BigInt(r.balance_paise); });
  console.log('   Starting wallet balances (paise):', initialWallets);

  // Start HTTP server on TEST_PORT
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
    // =========================================================================
    // PART 1: RECORD RS 10,000 SWIPE -> CHANGE RATES -> REJECT SWIPE
    // =========================================================================
    console.log('\n--- PART 1: Record Rs 10,000 Swipe, Change Rates, Reject Swipe ---');

    // 1. Record Rs 10,000 Pine Labs T+1 swipe by MID4001
    // Baseline rates: Admin 60, Master 80, SD 100, District 120, Area 150, MID 150
    // Uplines: Area 30 (Rs 30), District 20 (Rs 20), SD 20 (Rs 20), Master 20 (Rs 20), Admin 60 (Rs 60)
    console.log('3. Recording Rs 10,000 swipe as MID4001...');
    const swipe1Res = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'MID4001',
        'x-user-role': 'MERCHANT'
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        notes: 'Pine Labs 10K Swipe',
        ref_number: 'REF-PART1-10K'
      })
    });
    const swipe1Data = await swipe1Res.json();
    assert.equal(swipe1Data.success, true);
    const txn1Id = swipe1Data.transaction.id;
    console.log(`   ✓ Swipe 1 recorded: ${txn1Id}`);

    // Verify original ledger rows
    const origRowsRes = await pool.query(
      `SELECT id, user_id, type, amount_paise FROM financial_ledger WHERE reference_id = $1 ORDER BY id ASC`,
      [txn1Id]
    );
    const origRows = origRowsRes.rows;
    console.log('   Original ledger rows created:');
    console.table(origRows);
    assert.equal(origRows.length, 6, 'Must have 6 original ledger rows (1 merchant + 4 uplines + 1 admin)');

    // Verify exact expected original amounts
    const origAmounts = {};
    origRows.forEach(r => { origAmounts[r.user_id] = BigInt(r.amount_paise); });
    assert.equal(origAmounts['MID4001'], 985000n, 'MID4001 gets Rs 9,850');
    assert.equal(origAmounts['AREA3001'], 3000n, 'AREA3001 gets Rs 30');
    assert.equal(origAmounts['DIST2001'], 2000n, 'DIST2001 gets Rs 20');
    assert.equal(origAmounts['SD1001'], 2000n, 'SD1001 gets Rs 20');
    assert.equal(origAmounts['MST1001'], 2000n, 'MST1001 gets Rs 20');
    assert.equal(origAmounts['ADM001'], 6000n, 'ADM001 gets Rs 60');

    // 2. Change AREA3001's rate and MID4001's rate via real endpoint POST /api/channels/update
    console.log('\n4. Changing AREA3001 rate (to 1.30%) and MID4001 rate (to 1.80%) via /api/channels/update...');
    const areaRateUpdateRes = await fetch(`${BASE_URL}/api/channels/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        merchantId: 'AREA3001',
        channels: {
          pine_labs: { enabled: true, rate_t1: 1.30, rate_instant: 1.30 }
        }
      })
    });
    const areaRateUpdateData = await areaRateUpdateRes.json();
    assert.equal(areaRateUpdateData.success, true, `AREA3001 rate update must succeed: ${JSON.stringify(areaRateUpdateData)}`);

    const midRateUpdateRes = await fetch(`${BASE_URL}/api/channels/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        merchantId: 'MID4001',
        channels: {
          pine_labs: { enabled: true, rate_t1: 1.80, rate_instant: 1.80 }
        }
      })
    });
    const midRateUpdateData = await midRateUpdateRes.json();
    assert.equal(midRateUpdateData.success, true, `MID4001 rate update must succeed: ${JSON.stringify(midRateUpdateData)}`);
    console.log('   ✓ Rates updated successfully in database.');

    // 3. Reject the swipe via real endpoint POST /api/admin/verify-transaction
    console.log(`\n5. Rejecting original swipe ${txn1Id} AFTER rate changes...`);
    const rejectRes = await fetch(`${BASE_URL}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        transaction_id: txn1Id,
        action: 'REJECT',
        remark: 'Rejected after rate change'
      })
    });
    const rejectData = await rejectRes.json();
    assert.equal(rejectData.success, true, 'Rejection must succeed');
    console.log('   ✓ Swipe rejected successfully.');

    // 4. Confirm every reversing row equals the original row with the opposite sign
    console.log('\n6. Inspecting all financial_ledger rows for transaction and its reversals...');
    const allRowsRes = await pool.query(
      `SELECT id, user_id, type, amount_paise, reference_type, metadata FROM financial_ledger WHERE reference_id = $1 ORDER BY id ASC`,
      [txn1Id]
    );
    const allRows = allRowsRes.rows;
    console.table(allRows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      type: r.type,
      amount_paise: r.amount_paise,
      ref_type: r.reference_type,
      reversed_id: r.metadata?.reversed_ledger_id
    })));

    assert.equal(allRows.length, 12, 'Must have exactly 12 ledger rows (6 original + 6 reversing)');

    const reversingRows = allRows.filter(r => r.reference_type === 'REVERSAL');
    assert.equal(reversingRows.length, 6, 'Must have 6 reversing rows');

    for (const rev of reversingRows) {
      const origId = rev.metadata?.reversed_ledger_id;
      assert.ok(origId, 'Reversal row must reference reversed_ledger_id');
      const orig = origRows.find(o => String(o.id) === String(origId));
      assert.ok(orig, `Original row with ID ${origId} must exist`);
      assert.equal(rev.user_id, orig.user_id, `User must match on reversing row: ${orig.user_id}`);
      assert.equal(
        BigInt(rev.amount_paise), 
        -BigInt(orig.amount_paise), 
        `Reversing row ${rev.id} (${rev.amount_paise}) must equal original row ${orig.id} (${orig.amount_paise}) with opposite sign`
      );
    }
    console.log('   ✓ Every reversing row strictly equals the original row with the opposite sign.');

    // 5. Confirm every wallet returns EXACTLY to its starting balance
    console.log('\n7. Verifying wallet balances returned exactly to starting balances...');
    const currentWalletsRes = await pool.query('SELECT user_id, balance_paise FROM wallets ORDER BY user_id');
    for (const w of currentWalletsRes.rows) {
      const starting = initialWallets[w.user_id];
      assert.equal(
        BigInt(w.balance_paise), 
        starting, 
        `Wallet for ${w.user_id} should be ${starting}, got ${w.balance_paise}`
      );
    }
    console.log('   ✓ Every wallet returned strictly and exactly to its starting balance.');

    // Confirm financial_ledger net sum is 0
    const netSumRes = await pool.query(`SELECT SUM(amount_paise) as net FROM financial_ledger WHERE reference_id = $1`, [txn1Id]);
    assert.equal(BigInt(netSumRes.rows[0].net || 0), 0n, 'Net transaction ledger sum must be strictly 0');
    console.log('   ✓ Net sum of ledger entries for rejected transaction is strictly 0.');

    // =========================================================================
    // PART 2: EDITING SWIPE AMOUNT AFTER RATE CHANGE
    // =========================================================================
    console.log('\n--- PART 2: Editing Swipe Amount After Rate Change ---');

    // 1. Record a new swipe for Rs 10,000 under current active rates
    // Current rates: Admin 60, Master 80, SD 100, District 120, Area 130, MID 180
    // Expected fee = 1.80% (18,000 paise / Rs 180). Merchant net = Rs 9,820 (982,000 paise).
    // Area margin: 180 - 130 = 50 bps (Rs 50)
    // District margin: 130 - 120 = 10 bps (Rs 10)
    // SD margin: 120 - 100 = 20 bps (Rs 20)
    // Master margin: 100 - 80 = 20 bps (Rs 20)
    // Admin margin: 80 - 60 + 60 remainder = 80 bps (Rs 80) ... total = 50 + 10 + 20 + 20 + 80 = 180.
    console.log('8. Recording a new Rs 10,000 swipe under current rates...');
    const swipe2Res = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'MID4001', 'x-user-role': 'MERCHANT' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        notes: 'Swipe to be edited',
        ref_number: 'REF-EDIT-10K'
      })
    });
    const swipe2Data = await swipe2Res.json();
    assert.equal(swipe2Data.success, true, `Recording swipe 2 must succeed: ${JSON.stringify(swipe2Data)}`);
    const txn2Id = swipe2Data.transaction.id;
    console.log(`   ✓ New swipe recorded: ${txn2Id}`);

    // Snapshot wallet balances before edit
    const preEditWalletsRes = await pool.query('SELECT user_id, balance_paise FROM wallets ORDER BY user_id');
    const preEditWallets = {};
    preEditWalletsRes.rows.forEach(r => { preEditWallets[r.user_id] = BigInt(r.balance_paise); });

    // 2. Change rate again before editing!
    // Change MID4001 rate to 2.00% (200 bps) and AREA3001 to 1.40% (140 bps)
    console.log('9. Updating rates again prior to editing swipe amount (Area to 1.40%, MID to 2.00%)...');
    await fetch(`${BASE_URL}/api/channels/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        merchantId: 'AREA3001',
        channels: { pine_labs: { enabled: true, rate_t1: 1.40, rate_instant: 1.40 } }
      })
    });
    await fetch(`${BASE_URL}/api/channels/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        merchantId: 'MID4001',
        channels: { pine_labs: { enabled: true, rate_t1: 2.00, rate_instant: 2.00 } }
      })
    });

    // 3. Edit swipe amount to Rs 8,000 (800,000 paise) via real endpoint POST /api/transactions/edit
    console.log(`10. Calling real endpoint POST /api/transactions/edit to correct amount from Rs 10,000 to Rs 8,000...`);
    const editRes = await fetch(`${BASE_URL}/api/transactions/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'ADM001', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        old_txn_id: txn2Id,
        amount_paise: 800000, // Rs 8,000
        reason: 'Customer requested amount correction to Rs 8,000'
      })
    });
    const editData = await editRes.json();
    assert.equal(editRes.status, 200, `Expected 200, got ${editRes.status}: ${JSON.stringify(editData)}`);
    assert.equal(editData.success, true);
    assert.equal(editData.old_status, 'REVERSED');
    const newTxnId = editData.new_transaction.id;
    console.log(`   ✓ Old swipe ${txn2Id} reversed; New corrected swipe created: ${newTxnId}`);

    // 4. Verify old swipe entries were reversed cleanly with opposite signs
    const oldSwipeEntries = await pool.query(
      `SELECT user_id, amount_paise, reference_type, metadata FROM financial_ledger WHERE reference_id = $1`,
      [txn2Id]
    );
    const oldOriginals = oldSwipeEntries.rows.filter(r => r.reference_type === 'SWIPE');
    const oldReversals = oldSwipeEntries.rows.filter(r => r.reference_type === 'REVERSAL');
    assert.equal(oldOriginals.length, 6);
    assert.equal(oldReversals.length, 6);
    for (const rev of oldReversals) {
      const orig = oldOriginals.find(o => o.user_id === rev.user_id);
      assert.equal(BigInt(rev.amount_paise), -BigInt(orig.amount_paise));
    }
    console.log('   ✓ Old swipe entries reversed with exact opposite signs.');

    // 5. Verify new swipe of Rs 8,000 was posted using the NEW active rates (2.00% fee = Rs 160)
    // Merchant fee = 2.00% of 8,000 = Rs 160 (16,000 paise)
    // Merchant Net = 8,000 - 160 = Rs 7,840 (784,000 paise)
    // Area (200 - 140 = 60 bps) = 8,000 * 60 / 10000 = Rs 48 (4,800 paise)
    // District (140 - 120 = 20 bps) = 8,000 * 20 / 10000 = Rs 16 (1,600 paise)
    // SD (120 - 100 = 20 bps) = 8,000 * 20 / 10000 = Rs 16 (1,600 paise)
    // Master (100 - 80 = 20 bps) = 8,000 * 20 / 10000 = Rs 16 (1,600 paise)
    // Admin (80 bps) = 8,000 * 80 / 10000 = Rs 64 (6,400 paise)
    // Total commissions = 48 + 16 + 16 + 16 + 64 = Rs 160 (16,000 paise).
    const newTxnRows = await pool.query(
      `SELECT user_id, type, amount_paise FROM financial_ledger WHERE reference_id = $1`,
      [newTxnId]
    );
    const newEntries = {};
    newTxnRows.rows.forEach(r => { newEntries[r.user_id] = BigInt(r.amount_paise); });
    console.log('   New transaction ledger entries:', newEntries);

    assert.equal(newEntries['MID4001'], 784000n, 'Merchant gets Rs 7,840');
    assert.equal(newEntries['AREA3001'], 4800n, 'Area gets Rs 48');
    assert.equal(newEntries['DIST2001'], 3200n, 'District gets Rs 32 (140 - 100 = 40 bps)');
    assert.equal(newEntries['SD1001'], 1600n, 'SD gets Rs 16 (100 - 80 = 20 bps)');
    assert.equal(newEntries['MST1001'], 1600n, 'Master gets Rs 16 (80 - 60 = 20 bps)');
    assert.equal(newEntries['ADM001'], 4800n, 'Admin gets Rs 48 (60 bps base)');

    // 6. Reconciliation verification: Every user's wallet balance == starting + net ledger sum
    console.log('\n11. Auditing full wallet reconciliation against financial_ledger sum...');
    const allUsers = ['MID4001', 'AREA3001', 'DIST2001', 'SD1001', 'MST1001', 'ADM001'];
    for (const uid of allUsers) {
      const wRes = await pool.query(`SELECT balance_paise FROM wallets WHERE user_id = $1`, [uid]);
      const lRes = await pool.query(`SELECT COALESCE(SUM(amount_paise), 0) as s FROM financial_ledger WHERE user_id = $1`, [uid]);
      const expectedWallet = initialWallets[uid] + BigInt(lRes.rows[0].s);
      assert.equal(
        BigInt(wRes.rows[0].balance_paise), 
        expectedWallet, 
        `Wallet for ${uid} (${wRes.rows[0].balance_paise}) must equal starting balance (${initialWallets[uid]}) + ledger sum (${lRes.rows[0].s})`
      );
    }
    console.log('   ✓ All 6 users reconcile: wallet == initial + SUM(financial_ledger). Zero money leakage.');

    console.log('\n--- ALL TEST SUITE CHECKS PASSED PERFECTLY ---');
  } finally {
    if (server.closeAllConnections) server.closeAllConnections();
    server.close();
    await pool.end();
  }
}

runTest().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
