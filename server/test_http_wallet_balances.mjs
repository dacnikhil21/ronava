import http from 'node:http';
import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { handleApiRequest } from './api.js';
import { getDbPool } from './pg_db.js';
import { postLedgerEntry } from './ledger_engine.js';

const PORT = 5993;

async function runTest() {
  console.log('--- RUNNING TEST: HTTP Wallet Balances & Quotes via Phase B Ledger Engine ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'RONAV Admin', '9966203053', 'ADMIN', NULL),
        ('MID6001', 'Balance Merchant', '9876543222', 'MERCHANT', 'ADM001');

      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES
        ('MID6001', 0, 0);
    `);

    // Fund merchant wallet via ledger credit: Rs 1,000 (100,000 paise)
    await postLedgerEntry(client, {
      userId: 'MID6001',
      type: 'swipe_credit',
      amountPaise: 100000n, // Rs 1,000
      referenceId: 'TXN-FUND-6001',
      referenceType: 'SWIPE',
      channel: 'pinelabs',
      createdBy: 'SYSTEM'
    });

    // Post a withdrawal hold of Rs 200 (20,000 paise)
    await postLedgerEntry(client, {
      userId: 'MID6001',
      type: 'withdrawal_hold',
      amountPaise: -20000n, // -Rs 200
      referenceId: 'WTH-HOLD-6001',
      referenceType: 'WITHDRAWAL',
      channel: 'pinelabs',
      createdBy: 'SYSTEM'
    });
  } finally {
    client.release();
  }

  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`HTTP Test Server listening on http://127.0.0.1:${PORT}`);

  try {
    // 1. GET /api/wallets/balance?userId=MID6001
    console.log('1. Testing GET /api/wallets/balance...');
    const balRes = await fetch(`http://127.0.0.1:${PORT}/api/wallets/balance?userId=MID6001`);
    const balJson = await balRes.json();
    assert.equal(balRes.status, 200);
    assert.equal(balJson.success, true);
    assert.equal(balJson.balances.balance_paise, '80000', 'Balance must be 80,000 paise (Rs 800)');
    assert.equal(balJson.balances.held_paise, '0', 'Held is 0 because balance_paise is already net of hold');
    assert.equal(balJson.balances.reserve_locked_paise, '50000', 'Reserve must be 50,000 paise (Rs 500)');
    assert.equal(balJson.balances.withdrawable_balance_paise, '30000', 'Withdrawable must be 30,000 paise (Rs 300)');

    // 2. POST /api/withdrawals/quote (compliant)
    console.log('2. Testing POST /api/withdrawals/quote for compliant amount (Rs 200)...');
    const quoteOkRes = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'MID6001', amount: 200 })
    });
    const quoteOkJson = await quoteOkRes.json();
    assert.equal(quoteOkRes.status, 200);
    assert.equal(quoteOkJson.quote.reserve_compliant, true);
    assert.equal(quoteOkJson.quote.remaining_balance_paise, '60000');

    // 3. POST /api/withdrawals/quote (non-compliant)
    console.log('3. Testing POST /api/withdrawals/quote for non-compliant amount (Rs 400)...');
    const quoteBadRes = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'MID6001', amount: 400 })
    });
    const quoteBadJson = await quoteBadRes.json();
    assert.equal(quoteBadRes.status, 200);
    assert.equal(quoteBadJson.quote.reserve_compliant, false);
    assert.equal(quoteBadJson.quote.shortfall_paise, '10000');

    // 4. GET /api/wallet/MID6001 (Unified read from ledger)
    console.log('4. Testing GET /api/wallet/MID6001 reads from Phase B ledger...');
    const walletRes = await fetch(`http://127.0.0.1:${PORT}/api/wallet/MID6001`);
    const walletJson = await walletRes.json();
    assert.equal(walletRes.status, 200, `Expected 200, got ${walletRes.status}: ${JSON.stringify(walletJson)}`);
    assert.equal(walletJson.success, true);
    assert.equal(walletJson.wallet.balance_paise, '80000');
    assert.equal(walletJson.wallet.withdrawable_balance, 300);

    console.log('✅ TEST PASSED: Wallet balances and withdrawal quotes are 100% authoritative from ledger.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    try {
      const pool = getDbPool();
      await pool.end();
    } catch (_) {}
    try {
      await testPool.end();
    } catch (_) {}
  }
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
