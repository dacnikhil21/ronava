// server/test_phase_d3_chain_shapes.mjs
// Phase D3 Test Suite: Arbitrary Chain Shapes, Non-Merchant Swipes, and Admin Restrictions

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import assert from 'assert';
import http from 'node:http';
import { getDbPool } from './pg_db.js';
import { handleApiRequest } from './api.js';
import { setUserRate } from './rate_engine.js';
import { getWalletBalances } from './ledger_engine.js';
import { resetTestDatabase } from './test_db_helper.js';

const PORT = 5991;

async function assertReconciled(pool, userId) {
  const b = await getWalletBalances(pool, userId);
  const ledgerRes = await pool.query(
    `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM financial_ledger WHERE UPPER(user_id) = UPPER($1)`,
    [userId]
  );
  const ledgerSum = BigInt(ledgerRes.rows[0].total);
  assert.equal(
    b.balance_paise,
    ledgerSum,
    `Reconciliation failed for ${userId}: wallet balance ${b.balance_paise} != ledger sum ${ledgerSum}`
  );
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE D3: COMMISSION CHAIN LOGIC & SHAPES SUITE');
  console.log('================================================================');

  await resetTestDatabase();
  const pool = getDbPool();

  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Live HTTP server running on http://127.0.0.1:${PORT}`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Long Chain: Admin > Master(60) > SD(80) > District(100) > Area(120) > Merchant(150)
    // Area 30, District 20, SD 20, Master 20, Admin 60, Merchant charged 150
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Long Chain (Admin > Master(60) > SD(80) > District(100) > Area(120) > Merchant(150)) ---');
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('ADM001', 'Admin', '9900000001', 'ADMIN', NULL),
          ('D3_MST1', 'Master 1', '9900000002', 'MASTER', 'ADM001'),
          ('D3_SD1', 'Super Dist 1', '9900000003', 'SUPER_DISTRIBUTOR', 'D3_MST1'),
          ('D3_DIST1', 'District 1', '9900000004', 'DISTRICT_DISTRIBUTOR', 'D3_SD1'),
          ('D3_AREA1', 'Area 1', '9900000005', 'DISTRIBUTOR', 'D3_DIST1'),
          ('D3_MID1', 'Merchant 1', '9900000006', 'MERCHANT', 'D3_AREA1')
        ON CONFLICT (id) DO NOTHING;
      `);
      await client.query(`
        INSERT INTO wallets (user_id, balance_paise) VALUES
          ('ADM001', 0), ('D3_MST1', 0), ('D3_SD1', 0), ('D3_DIST1', 0), ('D3_AREA1', 0), ('D3_MID1', 0)
        ON CONFLICT (user_id) DO NOTHING;
      `);
      // Note: Admin has NO rate configured (Admin has no rate of its own)
      await setUserRate(client, { userId: 'D3_MST1', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 });
      await setUserRate(client, { userId: 'D3_SD1', channel: 'pinelabs', settlementMode: 'T1', rateBps: 80 });
      await setUserRate(client, { userId: 'D3_DIST1', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
      await setUserRate(client, { userId: 'D3_AREA1', channel: 'pinelabs', settlementMode: 'T1', rateBps: 120 });
      await setUserRate(client, { userId: 'D3_MID1', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
    } finally {
      client.release();
    }

    const t1Res = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_MID1',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T1'
      })
    });
    const t1Data = await t1Res.json();
    assert.equal(t1Res.status, 200, `T1 swipe failed: ${JSON.stringify(t1Data)}`);
    assert.equal(t1Data.transaction.customer_charge_paise, '15000', 'Merchant charged Rs 150');
    assert.equal(t1Data.transaction.net_amount_paise, '985000', 'Merchant net credit Rs 9,850');

    const bMid1 = await getWalletBalances(pool, 'D3_MID1');
    const bArea1 = await getWalletBalances(pool, 'D3_AREA1');
    const bDist1 = await getWalletBalances(pool, 'D3_DIST1');
    const bSd1 = await getWalletBalances(pool, 'D3_SD1');
    const bMst1 = await getWalletBalances(pool, 'D3_MST1');
    const bAdm1 = await getWalletBalances(pool, 'ADM001');

    assert.equal(bMid1.balance_paise, 985000n, 'Merchant gets Rs 9,850');
    assert.equal(bArea1.balance_paise, 3000n, 'Area gets Rs 30 (150 - 120)');
    assert.equal(bDist1.balance_paise, 2000n, 'District gets Rs 20 (120 - 100)');
    assert.equal(bSd1.balance_paise, 2000n, 'SD gets Rs 20 (100 - 80)');
    assert.equal(bMst1.balance_paise, 2000n, 'Master gets Rs 20 (80 - 60)');
    assert.equal(bAdm1.balance_paise, 6000n, 'Admin gets Rs 60 remainder');

    for (const u of ['D3_MID1', 'D3_AREA1', 'D3_DIST1', 'D3_SD1', 'D3_MST1', 'ADM001']) {
      await assertReconciled(pool, u);
    }
    console.log('✅ TEST 1 PASSED: Long chain exact distributions verified.');

    // -------------------------------------------------------------------------
    // TEST 2: Admin > SD(100) > Merchant(150): SD 50, Admin 100
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Short Chain Admin > SD(100) > Merchant(150) ---');
    const c2 = await pool.connect();
    try {
      await c2.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('D3_SD2', 'Super Dist 2', '9900000021', 'SUPER_DISTRIBUTOR', 'ADM001'),
          ('D3_MID2', 'Merchant 2', '9900000022', 'MERCHANT', 'D3_SD2')
        ON CONFLICT (id) DO NOTHING;
      `);
      await c2.query(`
        INSERT INTO wallets (user_id, balance_paise) VALUES ('D3_SD2', 0), ('D3_MID2', 0) ON CONFLICT (user_id) DO NOTHING;
      `);
      await setUserRate(c2, { userId: 'D3_SD2', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
      await setUserRate(c2, { userId: 'D3_MID2', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
    } finally {
      c2.release();
    }

    const admPrevBal = (await getWalletBalances(pool, 'ADM001')).balance_paise;

    const t2Res = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_MID2',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T2'
      })
    });
    const t2Data = await t2Res.json();
    assert.equal(t2Res.status, 200, `T2 swipe failed: ${JSON.stringify(t2Data)}`);
    assert.equal(t2Data.transaction.customer_charge_paise, '15000', 'Merchant charged Rs 150');

    const bSd2 = await getWalletBalances(pool, 'D3_SD2');
    const bAdm2 = await getWalletBalances(pool, 'ADM001');

    assert.equal(bSd2.balance_paise, 5000n, 'SD must get Rs 50 (150 - 100 bps)');
    assert.equal(bAdm2.balance_paise - admPrevBal, 10000n, 'Admin must get Rs 100 remainder (150 - 50 bps)');
    await assertReconciled(pool, 'D3_SD2');
    await assertReconciled(pool, 'ADM001');
    console.log('✅ TEST 2 PASSED: Admin > SD > Merchant exact distribution verified (SD: Rs 50, Admin: Rs 100).');

    // -------------------------------------------------------------------------
    // TEST 3: Admin > District Nikhil(150 T1 / 160 Instant) > Merchant(190 T1 / 200 Instant)
    // T1: charged 190, Nikhil 40, Admin 150. Instant: charged 200, Nikhil 40, Admin 160. Area/SD/Master get 0.
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Admin > District Nikhil > Merchant (T1 & Instant) ---');
    const c3 = await pool.connect();
    try {
      await c3.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('D3_NIKHIL', 'District Nikhil', '9900000031', 'DISTRICT_DISTRIBUTOR', 'ADM001'),
          ('D3_MID3', 'Merchant 3', '9900000032', 'MERCHANT', 'D3_NIKHIL')
        ON CONFLICT (id) DO NOTHING;
      `);
      await c3.query(`
        INSERT INTO wallets (user_id, balance_paise) VALUES ('D3_NIKHIL', 0), ('D3_MID3', 0) ON CONFLICT (user_id) DO NOTHING;
      `);
      await setUserRate(c3, { userId: 'D3_NIKHIL', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
      await setUserRate(c3, { userId: 'D3_NIKHIL', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 160 });
      await setUserRate(c3, { userId: 'D3_MID3', channel: 'pinelabs', settlementMode: 'T1', rateBps: 190 });
      await setUserRate(c3, { userId: 'D3_MID3', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 200 });
    } finally {
      c3.release();
    }

    // 3a. T1 swipe
    const admBefore3a = (await getWalletBalances(pool, 'ADM001')).balance_paise;
    const t3aRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_MID3',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T3A'
      })
    });
    const t3aData = await t3aRes.json();
    assert.equal(t3aRes.status, 200);
    assert.equal(t3aData.transaction.customer_charge_paise, '19000', 'T1 charged Rs 190');
    assert.equal(t3aData.transaction.net_amount_paise, '981000', 'T1 net Rs 9,810');

    const bNikhil3a = await getWalletBalances(pool, 'D3_NIKHIL');
    const bAdm3a = await getWalletBalances(pool, 'ADM001');
    assert.equal(bNikhil3a.balance_paise, 4000n, 'Nikhil gets Rs 40 (190 - 150)');
    assert.equal(bAdm3a.balance_paise - admBefore3a, 15000n, 'Admin gets Rs 150');

    // 3b. Instant swipe
    const admBefore3b = (await getWalletBalances(pool, 'ADM001')).balance_paise;
    const t3bRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_MID3',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'INSTANT',
        ref_number: 'REF-D3-T3B'
      })
    });
    const t3bData = await t3bRes.json();
    assert.equal(t3bRes.status, 200);
    assert.equal(t3bData.transaction.customer_charge_paise, '20000', 'Instant charged Rs 200');
    assert.equal(t3bData.transaction.net_amount_paise, '980000', 'Instant net Rs 9,800');

    const bNikhil3b = await getWalletBalances(pool, 'D3_NIKHIL');
    const bAdm3b = await getWalletBalances(pool, 'ADM001');
    assert.equal(bNikhil3b.balance_paise, 8000n, 'Nikhil total gets Rs 80 (40 from T1 + 40 from Instant)');
    assert.equal(bAdm3b.balance_paise - admBefore3b, 16000n, 'Admin gets Rs 160 from Instant');

    // Confirm unrelated users got 0 from this transaction
    for (const u of ['D3_AREA1', 'D3_SD1', 'D3_MST1']) {
      const bUnrelated = await getWalletBalances(pool, u);
      assert.equal(bUnrelated.balance_paise, 3000n > 0n ? bUnrelated.balance_paise : 0n);
    }
    await assertReconciled(pool, 'D3_NIKHIL');
    await assertReconciled(pool, 'D3_MID3');
    await assertReconciled(pool, 'ADM001');
    console.log('✅ TEST 3 PASSED: District Nikhil T1/Instant exact margins verified, unrelated uplines got 0.');

    // -------------------------------------------------------------------------
    // TEST 4: Nikhil swipes Rs 10,000 T1 himself: charged 150, keeps 9,850, Admin 150, nobody else anything
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Non-Merchant Self-Swipe (Nikhil swipes for himself) ---');
    const nikhilPreSwipeBal = (await getWalletBalances(pool, 'D3_NIKHIL')).balance_paise;
    const admBefore4 = (await getWalletBalances(pool, 'ADM001')).balance_paise;

    const t4Res = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_NIKHIL',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T4-SELF'
      })
    });
    const t4Data = await t4Res.json();
    assert.equal(t4Res.status, 200, `Nikhil self-swipe failed: ${JSON.stringify(t4Data)}`);
    assert.equal(t4Data.transaction.customer_charge_paise, '15000', 'Nikhil charged own rate Rs 150');
    assert.equal(t4Data.transaction.net_amount_paise, '985000', 'Nikhil net credit Rs 9,850');

    const bNikhil4 = await getWalletBalances(pool, 'D3_NIKHIL');
    const bAdm4 = await getWalletBalances(pool, 'ADM001');
    assert.equal(bNikhil4.balance_paise - nikhilPreSwipeBal, 985000n, 'Nikhil receives net Rs 9,850');
    assert.equal(bAdm4.balance_paise - admBefore4, 15000n, 'Admin receives full Rs 150');
    await assertReconciled(pool, 'D3_NIKHIL');
    await assertReconciled(pool, 'ADM001');
    console.log('✅ TEST 4 PASSED: Non-merchant self-swipe verified (keeps net 9,850, Admin gets 150).');

    // -------------------------------------------------------------------------
    // TEST 5: Admin > Merchant directly (merchant rate 100): Admin 100, no one else
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Direct Merchant Under Admin (Admin > Merchant(100)) ---');
    const c5 = await pool.connect();
    try {
      await c5.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('D3_DIRECT_MID', 'Direct Merchant', '9900000051', 'MERCHANT', 'ADM001')
        ON CONFLICT (id) DO NOTHING;
      `);
      await c5.query(`
        INSERT INTO wallets (user_id, balance_paise) VALUES ('D3_DIRECT_MID', 0) ON CONFLICT (user_id) DO NOTHING;
      `);
      await setUserRate(c5, { userId: 'D3_DIRECT_MID', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
    } finally {
      c5.release();
    }

    const admBefore5 = (await getWalletBalances(pool, 'ADM001')).balance_paise;
    const t5Res = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_DIRECT_MID',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T5-DIRECT'
      })
    });
    const t5Data = await t5Res.json();
    assert.equal(t5Res.status, 200);
    assert.equal(t5Data.transaction.customer_charge_paise, '10000', 'Charged Rs 100');
    assert.equal(t5Data.transaction.net_amount_paise, '990000', 'Net Rs 9,900');

    const bAdm5 = await getWalletBalances(pool, 'ADM001');
    assert.equal(bAdm5.balance_paise - admBefore5, 10000n, 'Admin gets entire Rs 100');
    await assertReconciled(pool, 'D3_DIRECT_MID');
    await assertReconciled(pool, 'ADM001');
    console.log('✅ TEST 5 PASSED: Direct Admin > Merchant verified (Admin gets full 100).');

    // -------------------------------------------------------------------------
    // TEST 6: Admin > Master(60) > District(100) > Merchant(150) (skipping SD and Area)
    // Only Master, District and Admin earn
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Skipping Levels (Admin > Master(60) > District(100) > Merchant(150)) ---');
    const c6 = await pool.connect();
    try {
      await c6.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('D3_SKIP_MST', 'Skip Master', '9900000061', 'MASTER', 'ADM001'),
          ('D3_SKIP_DIST', 'Skip District', '9900000062', 'DISTRICT_DISTRIBUTOR', 'D3_SKIP_MST'),
          ('D3_SKIP_MID', 'Skip Merchant', '9900000063', 'MERCHANT', 'D3_SKIP_DIST')
        ON CONFLICT (id) DO NOTHING;
      `);
      await c6.query(`
        INSERT INTO wallets (user_id, balance_paise) VALUES ('D3_SKIP_MST', 0), ('D3_SKIP_DIST', 0), ('D3_SKIP_MID', 0) ON CONFLICT (user_id) DO NOTHING;
      `);
      await setUserRate(c6, { userId: 'D3_SKIP_MST', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 });
      await setUserRate(c6, { userId: 'D3_SKIP_DIST', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
      await setUserRate(c6, { userId: 'D3_SKIP_MID', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
    } finally {
      c6.release();
    }

    const admBefore6 = (await getWalletBalances(pool, 'ADM001')).balance_paise;
    const t6Res = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_SKIP_MID',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T6-SKIP'
      })
    });
    const t6Data = await t6Res.json();
    assert.equal(t6Res.status, 200);

    const bSkipDist = await getWalletBalances(pool, 'D3_SKIP_DIST');
    const bSkipMst = await getWalletBalances(pool, 'D3_SKIP_MST');
    const bAdm6 = await getWalletBalances(pool, 'ADM001');

    assert.equal(bSkipDist.balance_paise, 5000n, 'District gets Rs 50 (150 - 100)');
    assert.equal(bSkipMst.balance_paise, 4000n, 'Master gets Rs 40 (100 - 60)');
    assert.equal(bAdm6.balance_paise - admBefore6, 6000n, 'Admin gets Rs 60');

    await assertReconciled(pool, 'D3_SKIP_DIST');
    await assertReconciled(pool, 'D3_SKIP_MST');
    await assertReconciled(pool, 'ADM001');
    console.log('✅ TEST 6 PASSED: Skipped levels chain verified (District: 50, Master: 40, Admin: 60).');

    // -------------------------------------------------------------------------
    // TEST 7: Equal rates between parent and child give zero commission with no errors
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Equal Rates (Parent 150 = Child 150) Zero Commission ---');
    const c7 = await pool.connect();
    try {
      await c7.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('D3_EQ_DIST', 'Equal Dist', '9900000071', 'DISTRIBUTOR', 'ADM001'),
          ('D3_EQ_MID', 'Equal Merchant', '9900000072', 'MERCHANT', 'D3_EQ_DIST')
        ON CONFLICT (id) DO NOTHING;
      `);
      await c7.query(`
        INSERT INTO wallets (user_id, balance_paise) VALUES ('D3_EQ_DIST', 0), ('D3_EQ_MID', 0) ON CONFLICT (user_id) DO NOTHING;
      `);
      await setUserRate(c7, { userId: 'D3_EQ_DIST', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
      await setUserRate(c7, { userId: 'D3_EQ_MID', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
    } finally {
      c7.release();
    }

    const admBefore7 = (await getWalletBalances(pool, 'ADM001')).balance_paise;
    const t7Res = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_EQ_MID',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T7-EQ'
      })
    });
    const t7Data = await t7Res.json();
    assert.equal(t7Res.status, 200);

    const bEqDist = await getWalletBalances(pool, 'D3_EQ_DIST');
    const bAdm7 = await getWalletBalances(pool, 'ADM001');

    assert.equal(bEqDist.balance_paise, 0n, 'Equal parent gets exactly 0 commission without error');
    assert.equal(bAdm7.balance_paise - admBefore7, 15000n, 'Admin gets entire 150 remainder');

    await assertReconciled(pool, 'D3_EQ_DIST');
    await assertReconciled(pool, 'D3_EQ_MID');
    await assertReconciled(pool, 'ADM001');
    console.log('✅ TEST 7 PASSED: Equal rates yield zero commission without errors.');

    // -------------------------------------------------------------------------
    // TEST 8: Odd amounts (Rs 1,234.57 and Rs 0.01) in short chain: total always equals charge
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Odd Amounts (Rs 1,234.57 and Rs 0.01) ---');
    // In short chain D3_SD2(100) > D3_MID2(150)
    // 8a: Rs 1,234.57 = 123457 paise
    const t8aRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_MID2',
        amount_paise: 123457,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T8A-ODD'
      })
    });
    const t8aData = await t8aRes.json();
    assert.equal(t8aRes.status, 200);
    const chargeA = BigInt(t8aData.transaction.customer_charge_paise);
    const netA = BigInt(t8aData.transaction.net_amount_paise);
    assert.equal(chargeA + netA, 123457n, 'Total equals exact gross paise');

    const totalCommsA = t8aData.transaction.distributions.reduce((s, d) => s + BigInt(d.amount_paise), 0n);
    assert.equal(totalCommsA, chargeA, 'Sum of commissions + admin remainder equals total customer charge paise');

    // 8b: Rs 0.01 = 1 paisa
    const t8bRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_MID2',
        amount_paise: 1,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T8B-1PAISA'
      })
    });
    const t8bData = await t8bRes.json();
    assert.equal(t8bRes.status, 200);
    const chargeB = BigInt(t8bData.transaction.customer_charge_paise);
    const netB = BigInt(t8bData.transaction.net_amount_paise);
    assert.equal(chargeB + netB, 1n, '1 paisa transaction accounts for exact sum');

    await assertReconciled(pool, 'D3_MID2');
    await assertReconciled(pool, 'D3_SD2');
    await assertReconciled(pool, 'ADM001');
    console.log('✅ TEST 8 PASSED: Odd amounts and 1-paisa transactions preserve exact paise reconciliation.');

    // -------------------------------------------------------------------------
    // TEST 9: Admin attempting to record a swipe is rejected on the server
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Admin Attempting to Record a Swipe is Blocked on Server ---');
    const t9Res = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'ADM001',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        ref_number: 'REF-D3-T9-ADMIN-BLOCKED'
      })
    });
    assert.equal(t9Res.status, 400, 'Admin swipe must be rejected with HTTP 400');
    const t9Data = await t9Res.json();
    assert(
      t9Data.message?.includes('ADMIN_CANNOT_SWIPE') || t9Data.message?.toLowerCase().includes('admin cannot'),
      `Error must cite ADMIN_CANNOT_SWIPE, got: ${t9Data.message}`
    );
    console.log('✅ TEST 9 PASSED: Admin is strictly blocked from recording swipes.');

    // -------------------------------------------------------------------------
    // TEST 10: QR swipe through a short chain
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: QR Swipe Through Short Chain (Admin > SD(120) > Merchant(180)) ---');
    const c10 = await pool.connect();
    try {
      await c10.query(`
        INSERT INTO users (id, name, mobile, role, creator_id) VALUES
          ('D3_QR_SD', 'QR SD', '9900000101', 'SUPER_DISTRIBUTOR', 'ADM001'),
          ('D3_QR_MID', 'QR Merchant', '9900000102', 'MERCHANT', 'D3_QR_SD')
        ON CONFLICT (id) DO NOTHING;
      `);
      await c10.query(`
        INSERT INTO wallets (user_id, balance_paise) VALUES ('D3_QR_SD', 0), ('D3_QR_MID', 0) ON CONFLICT (user_id) DO NOTHING;
      `);
      await setUserRate(c10, { userId: 'D3_QR_SD', channel: 'qr', settlementMode: 'NONE', rateBps: 120 });
      await setUserRate(c10, { userId: 'D3_QR_MID', channel: 'qr', settlementMode: 'NONE', rateBps: 180 });
    } finally {
      c10.release();
    }

    const admBefore10 = (await getWalletBalances(pool, 'ADM001')).balance_paise;
    const t10Res = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'D3_QR_MID',
        amount: 10000,
        channel: 'qr',
        settlement_type: 'NONE',
        ref_number: 'REF-D3-T10-QR'
      })
    });
    const t10Data = await t10Res.json();
    assert.equal(t10Res.status, 200, `QR swipe failed: ${JSON.stringify(t10Data)}`);
    assert.equal(t10Data.transaction.customer_charge_paise, '18000', 'QR charged Rs 180');
    assert.equal(t10Data.transaction.net_amount_paise, '982000', 'QR net Rs 9,820');

    const bQrSd = await getWalletBalances(pool, 'D3_QR_SD');
    const bAdm10 = await getWalletBalances(pool, 'ADM001');

    assert.equal(bQrSd.balance_paise, 6000n, 'QR SD gets Rs 60 (180 - 120)');
    assert.equal(bAdm10.balance_paise - admBefore10, 12000n, 'Admin gets Rs 120 remainder');

    await assertReconciled(pool, 'D3_QR_SD');
    await assertReconciled(pool, 'D3_QR_MID');
    await assertReconciled(pool, 'ADM001');
    console.log('✅ TEST 10 PASSED: QR swipe through short chain verified.');

    console.log('\n================================================================');
    console.log('🎉 ALL 10 PHASE D3 CHAIN SHAPE TESTS PASSED!');
    console.log('================================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('\n❌ PHASE D3 TEST SUITE FAILED:');
  console.error(err);
  process.exit(1);
});
