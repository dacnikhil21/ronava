// server/test_step2_and_3_channel_balances.mjs
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import assert from 'node:assert/strict';
import { getDbPool, pgQuery, withTransaction } from './pg_db.js';
import { handleApiRequest } from './api.js';
import http from 'node:http';
import { generateToken } from './security.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';

const PORT = 5992;
const BASE_URL = `http://localhost:${PORT}`;

async function runTest() {
  console.log('--- RUNNING STEP 2 & 3 CHANNEL BALANCES & MY TEAM TEST ---');
  const pool = getDbPool();

  const server = http.createServer(async (req, res) => {
    try {
      await handleApiRequest(req, res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  await new Promise(r => server.listen(PORT, r));

  try {
    const midToken = generateToken({ id: 'MID1001', role: 'MERCHANT' });
    const distToken = generateToken({ id: 'DIST1001', role: 'DISTRIBUTOR' });
    const ddToken = generateToken({ id: 'DD1001', role: 'DISTRICT_DISTRIBUTOR' });
    const sdToken = generateToken({ id: 'SD1001', role: 'SUPER_DISTRIBUTOR' });
    const mstToken = generateToken({ id: 'MST1002', role: 'MASTER' });

    // -------------------------------------------------------------------------
    // TEST 1: Tagging of existing ledger rows
    // -------------------------------------------------------------------------
    console.log('\n1. Checking that all ledger rows are tagged with channel...');
    const untagged = await pgQuery("SELECT COUNT(*) as c FROM financial_ledger WHERE channel IS NULL OR channel = ''");
    assert.equal(parseInt(untagged[0].c), 0, 'No ledger rows should be untagged');
    console.log('   ✓ All ledger rows have valid channel tags.');

    // -------------------------------------------------------------------------
    // TEST 2: Per-channel balance equals SUM of that channel\'s ledger rows
    // -------------------------------------------------------------------------
    console.log('\n2. Checking per-channel balance === SUM(channel ledger rows)...');
    const userWalletRes = await fetch(`${BASE_URL}/api/wallet/MID1001`, {
      headers: { 'Authorization': `Bearer ${midToken}` }
    });
    const walletData = await userWalletRes.json();
    assert.ok(walletData.success, 'Failed to fetch /api/wallet/MID1001');

    const chBalances = walletData.wallet?.channel_balances;
    assert.ok(chBalances, 'Missing channel_balances in wallet response');
    console.log('   MID1001 Channel Balances:', JSON.stringify(chBalances, null, 2));

    // MID1001 has only Pine Labs money (Rs 9,840)
    assert.equal(chBalances.pinelabs.balance, 9840, `Pine Labs balance should be 9840, got ${chBalances.pinelabs.balance}`);
    assert.equal(chBalances.payswiff.balance, 0, `Payswiff balance should be 0, got ${chBalances.payswiff.balance}`);
    assert.equal(chBalances.qr.balance, 0, `QR balance should be 0, got ${chBalances.qr.balance}`);

    // Shared reserve rule: 9,840 - 500 = 9,340
    assert.equal(chBalances.pinelabs.withdrawable_balance, 9340, `Pine Labs withdrawable balance must be 9340 after 500 reserve, got ${chBalances.pinelabs.withdrawable_balance}`);
    assert.equal(chBalances.payswiff.withdrawable_balance, 0, `Payswiff withdrawable balance must be 0, got ${chBalances.payswiff.withdrawable_balance}`);
    console.log('   ✓ Per-channel balances and shared reserve match ledger rows.');

    // -------------------------------------------------------------------------
    // TEST 3: Payswiff withdrawal by merchant with Pine Labs money only is REFUSED
    // -------------------------------------------------------------------------
    console.log('\n3. Testing Payswiff withdrawal refused with plain-English message...');
    // Fetch a verified beneficiary for MID1001
    let bens = await pgQuery("SELECT id FROM beneficiaries WHERE merchant_id = 'MID1001' AND is_verified = true LIMIT 1");
    let benId = bens[0]?.id;
    if (!benId) {
      // Insert test beneficiary for MID1001 if none exists
      const newBen = await pgQuery(`
        INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
        VALUES ('BEN-MID1001-TEST', 'MID1001', 'State Bank of India', '12345678901', 'SBIN0001234', 'D Nik', true, true)
        ON CONFLICT (id) DO UPDATE SET is_verified = true
        RETURNING id
      `);
      benId = newBen[0].id;
    }

    const payswiffWithdrawRes = await fetch(`${BASE_URL}/api/withdrawals/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${midToken}`
      },
      body: JSON.stringify({
        merchant_id: 'MID1001',
        amount_paise: 50000, // Rs 500
        beneficiary_id: benId,
        channel: 'payswiff',
        settlement_type: 'T1'
      })
    });

    const payswiffData = await payswiffWithdrawRes.json();
    console.log('   Payswiff withdrawal response:', payswiffData);
    assert.equal(payswiffWithdrawRes.status >= 400 || !payswiffData.success, true, 'Payswiff withdrawal must be refused');
    assert.match(payswiffData.message || payswiffData.error || '', /You can withdraw at most Rs 0/i, 'Message must state plain-English maximum allowed (Rs 0)');
    console.log('   ✓ Payswiff withdrawal correctly refused with plain-English message.');

    // -------------------------------------------------------------------------
    // TEST 4: Shared Reserve Rule across multiple channels
    // -------------------------------------------------------------------------
    console.log('\n4. Testing shared reserve rule across multiple channels...');
    // We test that if a user has Pine Labs 9,840 and tries to withdraw 9,500 (> 9,340), it refuses stating max Rs 9,340
    const overReserveRes = await fetch(`${BASE_URL}/api/withdrawals/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${midToken}`
      },
      body: JSON.stringify({
        merchant_id: 'MID1001',
        amount_paise: 950000, // Rs 9,500
        beneficiary_id: benId,
        channel: 'pinelabs',
        settlement_type: 'T1'
      })
    });
    const overReserveData = await overReserveRes.json();
    console.log('   Over-reserve response:', overReserveData);
    assert.equal(overReserveRes.status >= 400 || !overReserveData.success, true, 'Over-reserve withdrawal must be refused');
    assert.match(overReserveData.message || overReserveData.error || '', /You can withdraw at most Rs 9,340/i, 'Must state "You can withdraw at most Rs 9,340."');
    console.log('   ✓ Over-reserve withdrawal correctly refused with exact plain-English maximum allowed.');

    // -------------------------------------------------------------------------
    // TEST 5: My Team Screen (/api/network/downstream) per-channel breakdown & margins
    // -------------------------------------------------------------------------
    console.log('\n5. Testing /api/network/downstream per-channel values & margins...');
    const downstreamRes = await fetch(`${BASE_URL}/api/network/downstream?creatorId=DIST1001`, {
      headers: { 'Authorization': `Bearer ${distToken}` }
    });
    const downstreamData = await downstreamRes.json();
    assert.ok(downstreamData.success, 'Failed to fetch /api/network/downstream');
    console.log('   DIST1001 downstream data:', JSON.stringify(downstreamData, null, 2));

    assert.ok(downstreamData.channel_volumes, 'Must include channel_volumes');
    assert.ok(downstreamData.channel_commissions, 'Must include channel_commissions');
    assert.equal(downstreamData.channel_commissions.pinelabs, 10, `DIST1001 pine commission must be 10, got ${downstreamData.channel_commissions.pinelabs}`);
    assert.equal(downstreamData.channel_volumes.pinelabs, 10000, `DIST1001 pine volume must be 10000, got ${downstreamData.channel_volumes.pinelabs}`);

    // Check partner margins are not undefined
    const partner = downstreamData.partners.find(p => p.id === 'MID1001');
    assert.ok(partner, 'MID1001 must be in partners list');
    assert.ok(partner.channel_margins, 'Partner must have channel_margins');
    assert.notEqual(partner.channel_margins.pinelabs, undefined, 'pinelabs margin must not be undefined');
    assert.equal(partner.channel_margins.pinelabs, 0.1, `MID1001 margin for DIST1001 should be 0.1% (10 bps), got ${partner.channel_margins.pinelabs}`);
    console.log('   ✓ /api/network/downstream returns real channel volume, commission, and margins.');

    console.log('\n✅ ALL STEP 2 & 3 TESTS PASSED!');
  } finally {
    await new Promise(r => server.close(r));
    await pool.end();
  }
}

runTest().then(() => {
  console.log('Done.');
}).catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
